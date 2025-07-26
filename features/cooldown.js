const { EmbedBuilder } = require('discord.js');

// Maps to track user cooldowns
const dropCooldowns = new Map();
const grabCooldowns = new Map();
const globalCooldown = new Map(); // ✅ global spam protection

// Cooldown durations (in milliseconds)
const DROP_DURATION = 20 * 1000;  // 1 second
const GRAB_DURATION = 10 * 1000;  // 1 second
const GLOBAL_COOLDOWN_TIME = 3 * 1000; // 3 seconds anti-spam

/**
 * Sets a cooldown for a user and schedules a message when it's ready.
 * @param {'drop' | 'grab'} type
 * @param {string} userId
 * @param {TextChannel} [channel]
 */
function setCooldown(type, userId, channel) {
  const now = Date.now();

  if (type === 'drop') {
    dropCooldowns.set(userId, now);
    setTimeout(() => {
      dropCooldowns.delete(userId);
      if (channel) channel.send(`<@${userId}> You can now **drop**!`);
    }, DROP_DURATION);
  } else if (type === 'grab') {
    grabCooldowns.set(userId, now);
    setTimeout(() => {
      grabCooldowns.delete(userId);
      if (channel) channel.send(`<@${userId}> You can now **grab**!`);
    }, GRAB_DURATION);
  }
}

/**
 * Returns how much time is left on a cooldown.
 * @param {number} startTime 
 * @param {number} duration 
 * @returns {number}
 */
function getRemainingTime(startTime, duration) {
  const now = Date.now();
  const elapsed = now - startTime;
  return Math.max(0, duration - elapsed);
}

/**
 * Formats milliseconds into a readable string.
 * @param {number} ms 
 * @returns {string}
 */
function formatCooldown(ms) {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000);
  return `${minutes > 0 ? `${minutes}m ` : ''}${seconds}s`;
}

/**
 * Global cooldown check (used in each command file).
 * Returns false and replies if user is spamming.
 * @param {Message} message 
 * @returns {boolean}
 */
function checkGlobal(message) {
  const userId = message.author.id;
  const now = Date.now();

  const lastUsed = globalCooldown.get(userId);
  if (lastUsed && now - lastUsed < GLOBAL_COOLDOWN_TIME) {
    const wait = GLOBAL_COOLDOWN_TIME - (now - lastUsed);
    message.reply(`🕒 Please wait ${formatCooldown(wait)} before using another command.`);
    return false;
  }

  globalCooldown.set(userId, now);
  setTimeout(() => globalCooldown.delete(userId), GLOBAL_COOLDOWN_TIME);
  return true;
}

/**
 * Handles the "pcd" command to show cooldown status.
 * @param {Message} message 
 */
async function handleMessage(message) {

  if (message.author.bot) return;
  const cmd = message.content.trim().toLowerCase();
  if (cmd !== 'pcd' && cmd !== 'pcooldown') return;

  const userId = message.author.id;
  const username = message.author.username;

  const dropTime = dropCooldowns.get(userId);
  const grabTime = grabCooldowns.get(userId);

  const dropLeft = dropTime ? getRemainingTime(dropTime, DROP_DURATION) : 0;
  const grabLeft = grabTime ? getRemainingTime(grabTime, GRAB_DURATION) : 0;

  const embed = new EmbedBuilder()
    .setTitle('⏳ Cooldown Status')
    .setColor(0x1abc9c)
    .setDescription(
      `\n` +
      `**Drop:**\n   ${dropLeft > 0 ? `⏱ ${formatCooldown(dropLeft)}` : '✅ Ready!'}\n\n` +
      `**Grab:**\n   ${grabLeft > 0 ? `⏱ ${formatCooldown(grabLeft)}` : '✅ Ready!'}\n`
    )
    .setFooter({ text: username, iconURL: message.author.displayAvatarURL() });

  await message.reply({ embeds: [embed] });
}

module.exports = {
  handleMessage,
  setCooldown,
  DROP_DURATION,
  GRAB_DURATION,
  dropCooldowns,
  grabCooldowns,
  formatCooldown,
  checkGlobal // ✅ Exported to be used in command files
};
