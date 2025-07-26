const { Events, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = (client) => {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    
    const content = message.content.trim().toLowerCase();
    if (!content.startsWith('phelp') && !content.startsWith('help')) return;
    
    const embed = new EmbedBuilder()
      .setTitle('🎮 Card Bot - Commands')
      .setThumbnail('attachment://gif.gif')
      .setColor('#4F8EF7')
      .setDescription(
        '`pi` - View your inventory\n' +
        '`pd` - Drop 3 random cards\n' +
        '`pv` - View card details\n' +
        '`pc` - View your card collection\n' +
        '`pct @user` - Start a trade\n' +
        '`ppro` - View user profile\n' +
        '`popen <pack_name>` - Open a pack\n' +
        '`pshop` - Open the pack shop'
      )
      .setTimestamp();
    
    const attachment = new AttachmentBuilder('./gif.gif', { name: 'gif.gif' });
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setURL('https://example.com').setLabel('Site').setStyle(ButtonStyle.Link),
      new ButtonBuilder().setCustomId('hidden_tip').setLabel('Hidden Tip').setStyle(ButtonStyle.Secondary)
    );
    
    await message.reply({ embeds: [embed], files: [attachment], components: [row] });
  });
  
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    
    
    if (interaction.customId === 'hidden_tip') {
      const embed = new EmbedBuilder()
        .setTitle('💡 Hidden Tips')
        .setDescription(
          'Use `ps` for first time to get 100 <:coin:1397935096094261371>\n' +
          'Get 10 <:coin:1397935096094261371> in the web\n' +
          'Get daily pack in web every 24 hr'
        )
        .setColor('#4F8EF7');
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  });
};