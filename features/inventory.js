const { Events } = require('discord.js');
const { getSupabase } = require('../supabase-client');
const supabase = getSupabase();

// Pack emojis mapping
const packEmojis = {
  'bronze pack': '🥉',
  'silver pack': '🥈',
  'gold pack': '🥇',
  'prestige pack': '💎',
  'legendary pack': '🌟',
  'daily pack': '📅'
};

async function resolveUserId(message, args) {
  if (args[0] && args[0].match(/^<@!?(\d+)>$/)) {
    return args[0].replace(/<@!?(\d+)>/, '$1');
  }
  if (args[0] && /^\d+$/.test(args[0])) {
    return args[0];
  }
  if (message.reference && message.reference.messageId) {
    try {
      const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      if (repliedMessage) return repliedMessage.author.id;
    } catch {}
  }
  return message.author.id;
}

module.exports = (client) => {
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    const prefix = 'p';
    const content = message.content.trim();
    if (!content.toLowerCase().startsWith(prefix)) return;

    const args = content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    if (command !== 'i' && command !== 'inventory') return;

    const userId = await resolveUserId(message, args);
    
    // Get user object to display username and avatar
    let user;
    try {
      user = await client.users.fetch(userId);
    } catch (error) {
      return message.reply('Could not find that user.');
    }

    try {
      const { data: inventory, error: invErr } = await supabase
        .from('inventory')
        .select('pack_name, quantity, created_at')
        .eq('user_id', userId)
        .gt('quantity', 0) // Only get items with quantity > 0
        .order('created_at', { ascending: false });

      const { data: coins, error: coinErr } = await supabase
        .from('coins')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (invErr) throw new Error(invErr?.message);
      // Ignore coinErr for users who don't have coin records yet

      let invStr = '';
      if (!inventory || inventory.length === 0) {
        invStr = '_No packs in inventory._';
      } else {
        invStr = inventory.map(
          (item) => {
            const emoji = packEmojis[item.pack_name.toLowerCase()] || '📦'; // Default to 📦 if no emoji found
            return `${emoji} **${item.pack_name}** × ${item.quantity} *(added: <t:${Math.floor(new Date(item.created_at).getTime() / 1000)}:R>)*`;
          }
        ).join('\n');
      }

      await message.reply({
        embeds: [
          {
            title: `${user.username}'s Inventory`,
            description: `${invStr}\n\n**Balance:** ${coins?.balance ?? 0} <:coin:1397935096094261371>`,
            color: 0xFFD700,
            thumbnail: { url: user.displayAvatarURL({ dynamic: true }) },
            footer: { text: `Requested by ${message.author.username}` }
          }
        ]
      });
    } catch (e) {
      await message.reply({ content: 'No inventory found. Use `pshop` to make one!' });
    }
  });
};
