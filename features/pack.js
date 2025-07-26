const { Events, AttachmentBuilder } = require('discord.js');
const { readFileSync } = require('fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { getSupabase } = require('../supabase-client');
const supabase = getSupabase();
const db = require('../firebase');
const packRarityFull = require('./packrarity');
const chars = 'abcdefghijklmnopqrstuvwxyz';

let counter = 0;

const packMap = {
  bronze: 'bronze pack',
  silver: 'silver pack',
  gold: 'gold pack',
  daily: 'daily pack',
  prestige: 'prestige pack',
  legendary: 'legendary pack',
};

async function generateUniqueCode() {
  while (true) {
    const code = encodeCode(counter++);
    const snapshot = await db.collection('codes').doc(code).get();
    if (!snapshot.exists) return code;
  }
}

function encodeCode(num) {
  let result = '';
  if (num < 26 ** 3) {
    for (let i = 0; i < 3; i++) {
      result = chars[num % 26] + result;
      num = Math.floor(num / 26);
    }
  } else if (num < 26 * 26 * 10 + 26 ** 3) {
    num -= 26 ** 3;
    result = chars[Math.floor(num / (26 * 10))] + chars[Math.floor((num % (26 * 10)) / 10)] + String(num % 10);
  } else if (num < 26 * 100 + 26 * 26 * 10 + 26 ** 3) {
    num -= 26 ** 3 + 26 * 26 * 10;
    result = chars[Math.floor(num / 100)] + String(num % 100).padStart(2, '0');
  } else if (num < 1000 + 26 * 100 + 26 * 26 * 10 + 26 ** 3) {
    num -= 26 ** 3 + 26 * 26 * 10 + 26 * 100;
    result = String(num).padStart(3, '0');
  } else if (num < 26 ** 4 + 1000 + 26 * 100 + 26 * 26 * 10 + 26 ** 3) {
    num -= 26 ** 3 + 26 * 26 * 10 + 26 * 100 + 1000;
    for (let i = 0; i < 4; i++) {
      result = chars[num % 26] + result;
      num = Math.floor(num / 26);
    }
  } else if (num < 100 * 26 * 26 + 26 ** 4 + 1000 + 26 * 100 + 26 * 26 * 10 + 26 ** 3) {
    num -= 26 ** 3 + 26 * 26 * 10 + 26 * 100 + 1000 + 26 ** 4;
    result = String(Math.floor(num / (26 * 26))).padStart(2, '0') +
             chars[Math.floor((num % (26 * 26)) / 26)] +
             chars[num % 26];
  } else if (num < 10 * 26 ** 3 + 100 * 26 * 26 + 26 ** 4 + 1000 + 26 * 100 + 26 * 26 * 10 + 26 ** 3) {
    num -= 26 ** 3 + 26 * 26 * 10 + 26 * 100 + 1000 + 26 ** 4 + 100 * 26 * 26;
    result = String(Math.floor(num / (26 ** 3))) + (() => {
      let n = num % (26 ** 3);
      let s = '';
      for (let i = 0; i < 3; i++) {
        s = chars[n % 26] + s;
        n = Math.floor(n / 26);
      }
      return s;
    })();
  } else {
    num -= 26 ** 3 + 26 * 26 * 10 + 26 * 100 + 1000 + 26 ** 4 + 100 * 26 * 26 + 10 * 26 ** 3;
    for (let i = 0; i < 4; i++) {
      result = chars[num % 26] + result;
      num = Math.floor(num / 26);
    }
  }
  return result;
}

function weightedRandom(weights) {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  for (const [key, weight] of Object.entries(weights)) {
    if (rand < weight) return key;
    rand -= weight;
  }
  return 'Common';
}

function generateGID() {
  // Ensure GID is between 1 and 2000 (inclusive)
  return Math.min(2000, Math.max(1, Math.floor(Math.random() * 2000) + 1));
}

module.exports = (client) => {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const prefix = 'p';
    const content = message.content.trim();
    if (!content.toLowerCase().startsWith(prefix)) return;

    const args = content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    if (command !== 'open' && command !== 'pp') return;

    const inputPack = args[0]?.toLowerCase();
    const packName = packMap[inputPack];
    const packRarity = packRarityFull[inputPack];

    if (!packName || !packRarity) {
      return message.reply('Invalid pack name! use `ppack <pack_name>`');
    }

    const { data: inventory, error } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('user_id', message.author.id)
      .eq('pack_name', packName)
      .single();

    if (error && error.code !== 'PGRST116') {
      return message.reply('Error checking your inventory. Please try again later.');
    }

    if (!inventory || inventory.quantity < 1) {
      return message.reply(`You do not own any **${packName}**! Buy more packs to open.`);
    }

    const loadingMsg = await message.channel.send({
      embeds: [{
        title: `Opening ${packName}...`,
        description: "Please wait while we reveal your cards!",
        image: { url: "https://media.tenor.com/On7kvXhzml4AAAAj/loading-gif.gif" },
        color: 0xFFD700,
      }]
    });

    const data = JSON.parse(readFileSync('cards.json', 'utf-8'));
    const groupWeights = { ...packRarity };
    delete groupWeights.groups;

    const selected = [];

    while (selected.length < 3) {
      const group = weightedRandom(groupWeights);
      const rarities = packRarity.groups[group];
      const rarity = rarities[Math.floor(Math.random() * rarities.length)];
      const filtered = data.filter(c => c.rarity === rarity);
      if (!filtered.length) continue;
      const card = filtered[Math.floor(Math.random() * filtered.length)];
      const gid = generateGID();
      if (!selected.find(c => c.id === card.id && c.gid === gid)) {
        selected.push({ ...card, gid });
      }
    }

    const images = await Promise.all(selected.map(c => loadImage(c.image)));

    const TARGET_WIDTH = 300;
    const TARGET_HEIGHT = 420;
    const GAP = 30;
    const totalWidth = (TARGET_WIDTH * images.length) + GAP * (images.length - 1);
    const canvas = createCanvas(totalWidth, TARGET_HEIGHT);
    const ctx = canvas.getContext('2d');

    let x = 0;
    for (const img of images) {
      const scale = Math.min(TARGET_WIDTH / img.width, TARGET_HEIGHT / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      const offsetX = (TARGET_WIDTH - drawWidth) / 2;
      const offsetY = (TARGET_HEIGHT - drawHeight) / 2;
      ctx.drawImage(img, x + offsetX, offsetY, drawWidth, drawHeight);
      x += TARGET_WIDTH + GAP;
    }

    const buffer = canvas.toBuffer('image/png');
    const attachment = new AttachmentBuilder(buffer, { name: 'pack.png' });

    let desc = '';
    for (const card of selected) {
      const code = await generateUniqueCode();

      await db.collection(message.author.username).add({
        id: card.id,
        name: card.name,
        image: card.image,
        types: card.types || [],
        rarity: card.rarity || '',
        supertype: card.supertype || '',
        subtypes: card.subtypes || [],
        gid: card.gid,
        owned: message.author.id,
        code,
        claimedAt: new Date(),
        pack: packName,
      });

      await db.collection('codes').doc(code).set({
        claimedBy: message.author.id,
        cardId: card.id,
        image: card.image,
        gid: card.gid,
        cardName: card.name,
        pack: packName,
        timestamp: new Date(),
      });

      desc += `**${card.name}**\nGID: \`${card.gid}\`\nCode: \`${code}\`\nRarity: *${card.rarity}*\n\n`;
    }

    await supabase
      .from('inventory')
      .update({ quantity: inventory.quantity - 1 })
      .eq('id', inventory.id);

    const embed = {
      title: `${message.author.username}'s ${packName}`,
      description: desc.trim(),
      image: { url: 'attachment://pack.png' },
      color: 0xFFD700,
    };

    await loadingMsg.edit({
      content: `<@${message.author.id}> opened a **${packName}**!`,
      embeds: [embed],
      files: [attachment],
    });
  });
};
// features/pack.js