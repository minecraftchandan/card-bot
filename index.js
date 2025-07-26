require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Import initialized Firestore DB from firestore.js
const db = require('./firestore');

// Setup Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // ⬅️ Needed to read messages like "pcd"
  ],
  partials: [Partials.Channel],
});

// ✅ Import cooldown logic directly
const cooldown = require('./features/cooldown');

// 🔁 Load all feature files EXCEPT cooldown.js (already imported)
const featureDir = path.join(__dirname, 'features');

if (fs.existsSync(featureDir)) {
  const featureFiles = fs
    .readdirSync(featureDir)
    .filter(file => file.endsWith('.js') && file !== 'cooldown.js'); // ⬅️ Exclude cooldown.js

  for (const file of featureFiles) {
    const featurePath = path.join(featureDir, file);
    const feature = require(featurePath);

    // Call each feature function and pass the client/db/cooldown helper
    if (typeof feature === 'function') {
      feature(client, db, cooldown);
    } else {
      console.warn(`⚠️ Feature ${file} does not export a function`);
    }
  }
}

// ✅ Listen for "pcd"/"pcooldown" commands globally
client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return;

  // Handle "pcd" / "pcooldown" commands using your cooldown module
  await cooldown.handleMessage(message);
});

// 🟢 Bot is ready
client.once(Events.ClientReady, () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
});

// 🔐 Log in to Discord
client.login(process.env.BOT_TOKEN);
