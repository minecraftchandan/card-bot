const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
} = require('discord.js');
const db = require('../firebase');
const rarityValues = require('./rarity');

module.exports = (client) => {
  client.on('messageCreate', async (message) => {
   const command = message.content.trim().split(/\s+/)[0].toLowerCase();
const validCommands = ['pc', 'pcollection'];

if (message.author.bot || !validCommands.includes(command)) return;

    const args = message.content.trim().split(/\s+/).slice(1);
    let targetUser = message.mentions.users.first();

    // Case: Reply to message
    if (!targetUser && message.reference) {
      try {
        const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
        if (repliedMsg) targetUser = repliedMsg.author;
      } catch (e) {
        console.warn('Failed to fetch replied message:', e);
      }
    }

    // Case: User ID passed
    if (!targetUser && args[0] && /^\d{17,19}$/.test(args[0])) {
      try {
        targetUser = await message.client.users.fetch(args[0]);
      } catch (e) {
        return message.reply("Could not find user by that ID.");
      }
    }

    // Fallback to self
    if (!targetUser) targetUser = message.author;

    const perPage = 10;
    const username = targetUser.username;
    const userCollection = db.collection(username);

    try {
      const snapshot = await userCollection.get();
      if (snapshot.empty) {
        return message.reply(`${targetUser.id === message.author.id ? 'You don\'t' : `${username} doesn\'t`} have any Pokémon cards yet!`);
      }

      let cards = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        cards.push({
          name: data.name || 'Unknown',
          code: data.code || '???',
          gid: data.gid || '???',
          rarity: data.rarity || 'Unknown',
          claimedAt: data.claimedAt?.toMillis?.() || new Date(data.claimedAt).getTime(),
        });
      });

      let currentPage = 1;
      let currentSort = 'default';
      const totalPages = () => Math.ceil(cards.length / perPage);

      const sortCards = () => {
        if (currentSort === 'gid') {
          cards.sort((a, b) => a.gid - b.gid);
        } else if (currentSort === 'newest') {
          cards.sort((a, b) => b.claimedAt - a.claimedAt);
        } else if (currentSort === 'rarity') {
          // Sort by rarity (rarest first)
          cards.sort((a, b) => {
            const rarityA = rarityValues[a.rarity] || rarityValues['Unknown'];
            const rarityB = rarityValues[b.rarity] || rarityValues['Unknown'];
            return rarityA - rarityB; // Lower values are rarer
          });
        }
      };

      sortCards();


      const generateEmbed = (page) => {
        const start = (page - 1) * perPage;
        const cardsToShow = cards.slice(start, start + perPage);
        const description = cardsToShow.length
          ? cardsToShow.map(card =>
              `\n**${card.name}**\n` +
              `> Code: \`${card.code}\`   GID: \`${card.gid}\``
            ).join('\n')
          : 'No cards found.';

        return new EmbedBuilder()
          .setTitle(`📦  ${username}'s Pokémon Collection`)
          .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
          .setDescription(`\n${description}\n`)
          .setColor('#4F8EF7')
          .setFooter({ text: `Page ${page} of ${totalPages()}  •  Total: ${cards.length} card${cards.length === 1 ? '' : 's'}` });
      };

      const generateButtons = (page) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('first_page')
            .setLabel('⏪')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 1),
          new ButtonBuilder()
            .setCustomId('prev_page')
            .setLabel('◀️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === 1),
          new ButtonBuilder()
            .setCustomId('next_page')
            .setLabel('▶️')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === totalPages()),
          new ButtonBuilder()
            .setCustomId('last_page')
            .setLabel('⏩')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === totalPages())
        );
      };

      const generateDropdown = () => {
        return new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('sort_menu')
            .setPlaceholder('Sort cards...')
            .addOptions(
              {
                label: 'Sort by GID',
                value: 'gid',
              },
              {
                label: 'Sort by Newest',
                value: 'newest',
              },
              {
                label: 'Sort by Rarity',
                value: 'rarity',
                description: 'Sort from rarest to most common',
              }
            )
        );
      };

      const embedMessage = await message.reply({
        embeds: [generateEmbed(currentPage)],
        components: [generateDropdown(), generateButtons(currentPage)],
      });

      const collector = embedMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60_000,
      });

      const dropdownCollector = embedMessage.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60_000,
      });

      collector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) {
          return interaction.reply({ content: '⛔ Only the command user can navigate.', ephemeral: true });
        }

        switch (interaction.customId) {
          case 'first_page': currentPage = 1; break;
          case 'prev_page': if (currentPage > 1) currentPage--; break;
          case 'next_page': if (currentPage < totalPages()) currentPage++; break;
          case 'last_page': currentPage = totalPages(); break;
        }

        await interaction.update({
          embeds: [generateEmbed(currentPage)],
          components: [generateDropdown(), generateButtons(currentPage)],
        });
      });

      dropdownCollector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) {
          return interaction.reply({ content: '⛔ Only the command user can sort this.', ephemeral: true });
        }

        currentSort = interaction.values[0];
        sortCards();
        currentPage = 1;

        await interaction.update({
          embeds: [generateEmbed(currentPage)],
          components: [generateDropdown(), generateButtons(currentPage)],
        });
      });

      collector.on('end', async () => {
        try {
          await embedMessage.edit({ components: [] });
        } catch (e) {
          console.warn('Could not disable buttons:', e);
        }
      });

    } catch (err) {
      console.error('Error fetching collection:', err);
      return message.reply('⚠️ Error fetching card collection.');
    }
  });
};
