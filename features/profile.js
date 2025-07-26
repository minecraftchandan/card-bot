const { Events, EmbedBuilder } = require('discord.js');
const { getSupabase } = require('../supabase-client');
const supabase = getSupabase();

async function resolveUserId(message, args) {
  // Check for user mention
  if (args[0] && args[0].match(/^<@!?(\d+)>$/)) {
    return args[0].replace(/<@!?(\d+)>/, '$1');
  }
  
  // Check for user ID
  if (args[0] && /^\d+$/.test(args[0])) {
    return args[0];
  }
  
  // Check for username
  if (args[0]) {
    try {
      // Try to find user by username
      const users = await message.guild.members.fetch();
      const member = users.find(m => 
        m.user.username.toLowerCase() === args[0].toLowerCase() || 
        (m.nickname && m.nickname.toLowerCase() === args[0].toLowerCase())
      );
      if (member) return member.user.id;
    } catch (error) {
      console.error('Error finding user by name:', error);
    }
  }
  
  // Check if replying to a message
  if (message.reference && message.reference.messageId) {
    try {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (repliedMessage) return repliedMessage.author.id;
    } catch {}
  }
  
  // Default to message author
  return message.author.id;
}

module.exports = (client) => {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    
    const content = message.content.trim().toLowerCase();
    // Check for all valid command formats: ppro, pprofile, profile
    if (!content.startsWith('ppro') && !content.startsWith('pprofile') && !content.startsWith('profile')) return;
    
    const args = content.split(/\s+/).slice(1);
    const userId = await resolveUserId(message, args);
    
    try {
      // Fetch user object to get username and avatar
      const user = await client.users.fetch(userId);
      
      // Get tracker data (drops and grabs)
      const { data: trackerData, error: trackerError } = await supabase
        .from('tracker')
        .select('drops, grabs')
        .eq('user_id', userId)
        .single();
      
      // Get trade count - counts trades where user is either sender or receiver
      const { count: tradeCount, error: tradeError } = await supabase
        .from('trade_logs')
        .select('id', { count: 'exact', head: true })
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
        
      // Alternative approach with separate counts if you want to show sent vs received
      // const { count: sentTrades } = await supabase
      //   .from('trade_logs')
      //   .select('id', { count: 'exact', head: true })
      //   .eq('from_user_id', userId);
      // 
      // const { count: receivedTrades } = await supabase
      //   .from('trade_logs')
      //   .select('id', { count: 'exact', head: true })
      //   .eq('to_user_id', userId);
      
      // Prepare data for display
      const drops = trackerData?.drops || 0;
      const grabs = trackerData?.grabs || 0;
      const trades = tradeCount || 0;
      
      // Create embed with clean structure
      const embed = new EmbedBuilder()
        .setTitle(`${user.username}'s Profile`)
        .setDescription(`<@${userId}>`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setColor('#4F8EF7')
        .addFields(
          { name: '📦 Drops', value: `${drops}`, inline: true },
          { name: '🎯 Grabs', value: `${grabs}`, inline: true },
          { name: '🔄 Trades', value: `${trades}`, inline: true }
        )
        .setFooter({ text: `Requested by ${message.author.username}` })
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
      
    } catch (error) {
      console.error('Error fetching profile:', error);
      await message.reply('❌ Error fetching profile data.');
    }
  });
};