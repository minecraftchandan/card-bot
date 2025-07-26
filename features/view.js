const {
  EmbedBuilder,
} = require('discord.js');
const db = require('../firebase');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !/^pv$/i.test(message.content.split(' ')[0])) return;

    const args = message.content.trim().split(' ').slice(1);
    const username = message.author.username;
    const userId = message.author.id;
    let cardData = null;
    let ownerUsername = username;
    let ownerId = userId;

    try {
      if (args.length === 0) {
        const userCollection = db.collection(username);
        const querySnapshot = await userCollection.orderBy('claimedAt', 'desc').limit(1).get();

        if (querySnapshot.empty) {
          return message.reply("❌ You don't own any cards yet.");
        }

        cardData = querySnapshot.docs[0].data();
      } else {
        const codeArg = args[0].toLowerCase();

        // 🔍 Search all collections (excluding 'codes') for the card
        const collections = await db.listCollections();
        const userCollections = collections.filter(col => col.id !== 'codes');

        for (const col of userCollections) {
          const snapshot = await col.get();
          const match = snapshot.docs.find(doc =>
            (doc.data().code || '').toLowerCase() === codeArg
          );
          if (match) {
            cardData = match.data();
            ownerUsername = col.id;
            ownerId = (match.data().owned || userId); // fallback to command caller
            break;
          }
        }

        if (!cardData) {
          return message.reply(`❌ No card found with code: \`${codeArg}\``);
        }
      }
      const embed = new EmbedBuilder()
        .setTitle(`\u2003${cardData.name || 'Unknown Card'}`)
        .setDescription(
          `\n` +
          `**Code:** \`${cardData.code || '???'}\`\n` +
          `**GID:** \`${cardData.gid || '???'}\`\n` +
          `**Owner:** <@${ownerId}>\n`)
        .setImage(cardData.image || 'https://i.imgur.com/MI9vU6f.png')
        .setColor('#F7C744');

      await message.reply({ embeds: [embed] });

    } catch (err) {
      console.error('Error in pv command:', err);
      return message.reply('⚠️ Error showing the card.');
    }
  });
};
