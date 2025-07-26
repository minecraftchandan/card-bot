const {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
} = require('discord.js');
const { readFileSync } = require('fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const db = require('../firebase');
const cooldown = require('./cooldown');
const { formatCooldown } = cooldown;
const rarityWeights = require('./rarity');
const { getSupabase } = require('../supabase-client');
const supabase = getSupabase();

let counter = 0;
const chars = 'abcdefghijklmnopqrstuvwxyz';

async function generateUniqueCode() {
  while (true) {
    const code = encodeCode(counter++);
    const snapshot = await db.collection('codes').doc(code).get();
    if (!snapshot.exists) return code;
  }
}

function encodeCode(num) {
  let result = '';
  // 3 letters
  if (num < 26 ** 3) {
    for (let i = 0; i < 3; i++) {
      result = chars[num % 26] + result;
      num = Math.floor(num / 26);
    }
  }
  // 2 letters + 1 digit
  else if (num < 26 * 26 * 10 + 26 ** 3) {
    num -= 26 ** 3;
    result = chars[Math.floor(num / (26 * 10))] + chars[Math.floor((num % (26 * 10)) / 10)] + String(num % 10);
  }
  // 1 letter + 2 digits
  else if (num < 26 * 100 + 26 * 26 * 10 + 26 ** 3) {
    num -= 26 ** 3 + 26 * 26 * 10;
    result = chars[Math.floor(num / 100)] + String(num % 100).padStart(2, '0');
  }
  // 3 digits
  else if (num < 1000 + 26 * 100 + 26 * 26 * 10 + 26 ** 3) {
    num -= 26 ** 3 + 26 * 26 * 10 + 26 * 100;
    result = String(num).padStart(3, '0');
  }
  // 4 letters
  else if (num < 26 ** 4 + 1000 + 26 * 100 + 26 * 26 * 10 + 26 ** 3) {
    num -= 26 ** 3 + 26 * 26 * 10 + 26 * 100 + 1000;
    for (let i = 0; i < 4; i++) {
      result = chars[num % 26] + result;
      num = Math.floor(num / 26);
    }
  }
  // 2 digits + 2 letters
  else if (num < 100 * 26 * 26 + 26 ** 4 + 1000 + 26 * 100 + 26 * 26 * 10 + 26 ** 3) {
    num -= 26 ** 3 + 26 * 26 * 10 + 26 * 100 + 1000 + 26 ** 4;
    result = String(Math.floor(num / (26 * 26))).padStart(2, '0') + chars[Math.floor((num % (26 * 26)) / 26)] + chars[num % 26];
  }
  // 1 digit + 3 letters
  else if (num < 10 * 26 ** 3 + 100 * 26 * 26 + 26 ** 4 + 1000 + 26 * 100 + 26 * 26 * 10 + 26 ** 3) {
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
  }
  // 4 letters 
  else {
    num -= 26 ** 3 + 26 * 26 * 10 + 26 * 100 + 1000 + 26 ** 4 + 100 * 26 * 26 + 10 * 26 ** 3;
    for (let i = 0; i < 4; i++) {
      result = chars[num % 26] + result;
      num = Math.floor(num / 26);
    }
  }
  return result;
}

function weightedRandom(rarityMap) {
  const totalWeight = Object.values(rarityMap).reduce((acc, val) => acc + val, 0);
  const rand = Math.random() * totalWeight;
  let cumulative = 0;
  for (const [rarity, weight] of Object.entries(rarityMap)) {
    cumulative += weight;
    if (rand < cumulative) return rarity;
  }
  return 'Common';
}

function getAdjustedRarityWeight(card, rarityWeight) {
  if (!card.gid) return rarityWeight;

  if (card.gid < 10) {
    return rarityWeight * 0.1;
  } else if (card.gid < 100) {
    return rarityWeight * 0.3;
  }
  return rarityWeight;
}

module.exports = (client) => {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    const prefix = 'p';
    const content = message.content.trim();
    if (!content.toLowerCase().startsWith(prefix)) return;

    if (!cooldown.checkGlobal(message)) return;

    const args = content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    const validDropCommands = ['d', 'pd', 'drop', 'pdrop'];
    if (!validDropCommands.includes(command)) return;

    const userId = message.author.id;
    const dropTime = cooldown.dropCooldowns.get(userId);
    if (dropTime && Date.now() - dropTime < cooldown.DROP_DURATION) {
      const remaining = cooldown.DROP_DURATION - (Date.now() - dropTime);
      return message.reply(`⏳ You must wait **${formatCooldown(remaining)}** before dropping again.`);
    }

    cooldown.setCooldown('drop', userId, message.channel);
    
    // Track drop in Supabase
    try {
      // Check if user exists in tracker table
      const { data: trackerData, error: trackerError } = await supabase
        .from('tracker')
        .select('drops')
        .eq('user_id', userId)
        .single();
      
      if (trackerError && trackerError.code === 'PGRST116') {
        // User doesn't exist, create new record
        await supabase.from('tracker').insert({
          user_id: userId,
          drops: 1,
          grabs: 0
        });
      } else if (!trackerError) {
        // User exists, increment drops
        await supabase.from('tracker')
          .update({ drops: trackerData.drops + 1 })
          .eq('user_id', userId);
      }
    } catch (error) {
      console.error('Error tracking drop:', error);
      // Continue with drop even if tracking fails
    }
    
    const data = JSON.parse(readFileSync('cards.json', 'utf-8'));

    const selected = [];

    while (selected.length < 3) {
      const rarity = weightedRandom(rarityWeights);
      const filtered = data.filter((c) => c.rarity === rarity);

      if (!filtered.length) continue;

      // Pick random card but bias selection based on gid
      const weightedCards = [];
      for (const card of filtered) {
        const tempGid = Math.floor(Math.random() * 2000) + 1;
        const adjustedWeight = getAdjustedRarityWeight({ ...card, gid: tempGid }, rarityWeights[rarity]);
        weightedCards.push({ card, gid: tempGid, weight: adjustedWeight });
      }

      const total = weightedCards.reduce((sum, c) => sum + c.weight, 0);
      let r = Math.random() * total;
      let selectedCard;

      for (const entry of weightedCards) {
        r -= entry.weight;
        if (r <= 0) {
          selectedCard = { ...entry.card, gid: entry.gid };
          break;
        }
      }

      if (selectedCard && !selected.find(c => c.id === selectedCard.id && c.gid === selectedCard.gid)) {
        selected.push(selectedCard);
      }
    }

    // Try to load images, handle broken URLs
    const images = [];
    for (let i = 0; i < selected.length; i++) {
      try {
        const img = await loadImage(selected[i].image);
        images.push(img);
      } catch (error) {
        console.error(`Failed to load image: ${selected[i].image}`);
        
        // Store broken URL in a separate collection
        await db.collection('broken_urls').add({
          url: selected[i].image,
          cardId: selected[i].id,
          cardName: selected[i].name,
          timestamp: new Date(),
          error: error.message
        });
        
        // Try to find a replacement card
        const rarity = selected[i].rarity;
        const filtered = data.filter((c) => c.rarity === rarity && c.id !== selected[i].id);
        
        if (filtered.length > 0) {
          // Pick a random replacement
          const replacement = filtered[Math.floor(Math.random() * filtered.length)];
          selected[i] = { ...replacement, gid: Math.floor(Math.random() * 2000) + 1 };
          
          try {
            const replacementImg = await loadImage(selected[i].image);
            images.push(replacementImg);
          } catch (secondError) {
            // If replacement also fails, use a placeholder image
            console.error(`Replacement image also failed: ${selected[i].image}`);
            // Use a simple canvas as placeholder
            const placeholderCanvas = createCanvas(245, 342);
            const ctx = placeholderCanvas.getContext('2d');
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, 245, 342);
            ctx.fillStyle = '#333333';
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Image Unavailable', 122, 171);
            images.push(placeholderCanvas);
          }
        } else {
          // If no replacement found, use placeholder
          const placeholderCanvas = createCanvas(245, 342);
          const ctx = placeholderCanvas.getContext('2d');
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(0, 0, 245, 342);
          ctx.fillStyle = '#333333';
          ctx.font = '20px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('Image Unavailable', 122, 171);
          images.push(placeholderCanvas);
        }
      }
    }

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
    const attachment = new AttachmentBuilder(buffer, { name: 'drop.png' });

    const row = new ActionRowBuilder().addComponents(
      selected.map((_, i) =>
        new ButtonBuilder()
          .setCustomId(`claim_${i}`)
          .setLabel(`${i + 1}`)
          .setStyle(ButtonStyle.Primary)
      )
    );

    const sent = await message.channel.send({
      content: `<@${userId}> is dropping the cards!`,
      files: [attachment],
      components: [row],
    });

    const claimed = new Map();
    const claimLocks = new Map();
    const collector = sent.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', async (interaction) => {
      const user = interaction.user;
      const uid = user.id;
      const claimIndex = parseInt(interaction.customId.split('_')[1]);
      const card = selected[claimIndex];

      const grabTime = cooldown.grabCooldowns.get(uid);
      if (grabTime && Date.now() - grabTime < cooldown.GRAB_DURATION) {
        const left = cooldown.GRAB_DURATION - (Date.now() - grabTime);
        return interaction.reply({
          content: `⏳ Wait **${formatCooldown(left)}** before claiming again.`,
          ephemeral: true,
        });
      }

      if (uid !== userId && Date.now() - sent.createdTimestamp < 5000) {
        return interaction.reply({
          content: 'Dropper priority',
          ephemeral: true,
        });
      }

      if (claimLocks.has(claimIndex) && claimLocks.get(claimIndex) !== uid) {
        return interaction.reply({
          content: `Already claimed by <@${claimLocks.get(claimIndex)}>!`,
          ephemeral: false,
        });
      }

      if (claimed.has(claimIndex)) {
        return interaction.reply({ content: 'Already claimed!', ephemeral: true });
      }

      await interaction.deferUpdate();

      claimLocks.set(claimIndex, uid);
      claimed.set(claimIndex, true);
      cooldown.setCooldown('grab', uid, message.channel);
      
      // Track grab in Supabase
      try {
        // Check if user exists in tracker table
        const { data: trackerData, error: trackerError } = await supabase
          .from('tracker')
          .select('grabs')
          .eq('user_id', uid)
          .single();
        
        if (trackerError && trackerError.code === 'PGRST116') {
          // User doesn't exist, create new record
          await supabase.from('tracker').insert({
            user_id: uid,
            drops: 0,
            grabs: 1
          });
        } else if (!trackerError) {
          // User exists, increment grabs
          await supabase.from('tracker')
            .update({ grabs: trackerData.grabs + 1 })
            .eq('user_id', uid);
        }
      } catch (error) {
        console.error('Error tracking grab:', error);
        // Continue with grab even if tracking fails
      }

      const code = await generateUniqueCode();

      await db.collection(user.username).add({
        id: card.id,
        name: card.name,
        image: card.image,
        types: card.types || [],
        rarity: card.rarity || '',
        supertype: card.supertype || '',
        subtypes: card.subtypes || [],
        gid: card.gid,
        owned: user.id,
        code,
        claimedAt: new Date(),
      });

      await db.collection('codes').doc(code).set({
        claimedBy: uid,
        cardId: card.id,
        image: card.image,
        gid: card.gid,
        cardName: card.name,
        timestamp: new Date(),
      });

      const updatedRow = ActionRowBuilder.from(row);
      updatedRow.components[claimIndex]
        .setDisabled(true)
        .setStyle(ButtonStyle.Secondary);

      await sent.edit({ components: [updatedRow] });

      await interaction.followUp({
        content: `<@${uid}> claimed **${card.name}**! \`${code}\` | GID: \`${card.gid}\``,
        ephemeral: false,
      });
    });

    collector.on('end', async () => {
      const finalRow = ActionRowBuilder.from(row);
      finalRow.components.forEach((b) => b.setDisabled(true));
      await sent.edit({
        content: `<@${userId}> Drop expired.`,
        components: [finalRow],
      });
    });
  });
};
