const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
} = require('discord.js');
const { getSupabase } = require('../supabase-client');
const packRarity = require('./packrarity');

module.exports = (client) => {
  const supabase = getSupabase();

  const packs = [
    { name: 'Bronze Pack', cost: 50, emoji: '🥉' },
    { name: 'Silver Pack', cost: 100, emoji: '🥈' },
    { name: 'Gold Pack', cost: 200, emoji: '🥇' },
    { name: 'Prestige Pack', cost: 500, emoji: '💎' },
    { name: 'Legendary Pack', cost: 1000, emoji: '🌟' },
  ];

  // Handle "ps" as a text command
  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const allowedCommands = ['ps','pshop'];

 if (allowedCommands.includes(message.content.trim().toLowerCase())) {
      // Award coins if first time
      const userId = message.author.id;
      // Check if user exists in coins table
      const { data: coinsUser, error: coinsError } = await supabase
        .from('coins')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      // If not, award 1000 coins
      if (!coinsUser) {
        const { error: coinInsertError } = await supabase
          .from('coins')
          .insert({ user_id: userId, balance: 100 });
        if (!coinInsertError) {
          await message.reply({ content: 'You have been awarded 100 coins' });
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('🛒 PokéShop')
        .setDescription(packs.map((p, i) => `**${i + 1}. ${p.emoji} ${p.name}** - ${p.cost} <:coin:1396453235077812315>`).join('\n'))
        .setFooter({ text: 'Use the buttons below to buy or learn more.' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('buy_pack').setLabel('🛍️ Buy Pack').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('rarity_info').setLabel('🎲 Rarity Info').setStyle(ButtonStyle.Secondary),
      );

      await message.reply({ embeds: [embed], components: [row] });
    }
  });

  // Handle button interactions
  client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    const { customId } = interaction;

    if (customId === 'rarity_info') {
      const embed = new EmbedBuilder()
        .setTitle('📊 Pack Rarity Info')
        .setColor('Aqua');

      for (const key in packRarity) {
        const rarities = packRarity[key];
        const details = Object.entries(rarities)
          .filter(([rarity]) => rarity !== 'groups')
          .map(([rarity, percent]) => `**${rarity}**: ${percent}%`)
          .join('\n');
        
        // Find the matching pack to get its emoji
        const packName = key.charAt(0).toUpperCase() + key.slice(1) + ' Pack';
        const packEmoji = packs.find(p => p.name.toLowerCase().includes(key.toLowerCase()))?.emoji || '';

        embed.addFields({ name: `${packEmoji} ${packName}`, value: details });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (customId === 'buy_pack') {
      const modal = new ModalBuilder()
        .setCustomId('buy_modal')
        .setTitle('Buy Packs')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('serial')
              .setLabel('Enter Pack Serial Number (e.g. 1)')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('qty')
              .setLabel('Enter Quantity')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );

      await interaction.showModal(modal);
    }
  });

  // Handle modal submit for buying packs
  client.on('interactionCreate', async interaction => {
    if (interaction.type !== InteractionType.ModalSubmit || interaction.customId !== 'buy_modal') return;

    const serial = parseInt(interaction.fields.getTextInputValue('serial'));
    const qty = parseInt(interaction.fields.getTextInputValue('qty'));
    const userId = interaction.user.id;

    if (isNaN(serial) || isNaN(qty) || serial < 1 || serial > packs.length || qty <= 0) {
      return interaction.reply({ content: '❌ Invalid input. Please enter a valid serial and quantity.', ephemeral: true });
    }

    const selectedPack = packs[serial - 1];
    const totalCost = selectedPack.cost * qty;

    // Get user coins
    let { data: coinUser, error: coinError } = await supabase
      .from('coins')
      .select('balance')
      .eq('user_id', userId)
      .single();

    // If user not in coins table, award coins and re-fetch
    if (!coinUser) {
      await supabase.from('coins').insert({ user_id: userId, balance: 1000 });
      // Re-fetch after insert
      ({ data: coinUser, error: coinError } = await supabase
        .from('coins')
        .select('balance')
        .eq('user_id', userId)
        .single());
    }

    if (coinError) {
      return interaction.reply({ content: '❌ Error fetching your coins.', ephemeral: true });
    }

    if (coinUser.balance < totalCost) {
      return interaction.reply({
        content: `❌ You need ${totalCost} coins but have only ${coinUser.balance}.`,
        ephemeral: true
      });
    }

    // Deduct coins
    const { error: updateError } = await supabase
      .from('coins')
      .update({ balance: coinUser.balance - totalCost })
      .eq('user_id', userId);

    if (updateError) {
      return interaction.reply({ content: '❌ Could not complete purchase. Try again.', ephemeral: true });
    }

    // Add to inventory table
    // First, check if user already has this pack in inventory
    const { data: existingPack, error: invError } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('pack_name', selectedPack.name.toLowerCase())
      .single();

    if (existingPack) {
      // Update quantity
      await supabase
        .from('inventory')
        .update({ quantity: existingPack.quantity + qty })
        .eq('id', existingPack.id);
    } else {
      // Insert new inventory row
      await supabase
        .from('inventory')
        .insert({
          user_id: userId,
          pack_name: selectedPack.name.toLowerCase(),
          quantity: qty,
          created_at: new Date().toISOString()
        });
    }

    return interaction.reply({
      content: `✅ You bought ${qty}x ${selectedPack.emoji} **${selectedPack.name}** for ${totalCost} <:coin:1397935096094261371>!`,
      ephemeral: true,
    });
  });
};