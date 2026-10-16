import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';
import { CONFIG } from './config.js';
import { commandMap } from './commands/index.js';
import { processOutboxQueue } from './worker/outboxDispatcher.js';
import { processDueReminders } from './worker/reminderWorker.js';

console.log('================================================================');
console.log(`🤖 STARTING ${CONFIG.STUDIO.NAME.toUpperCase()} OPERATIONS BOT`);
console.log(`Project: ${CONFIG.STUDIO.PROJECT} // Engine Hub Discord Connector`);
console.log('================================================================');

if (!CONFIG.BOT_TOKEN || CONFIG.BOT_TOKEN.trim().length === 0) {
  console.warn('\n⚠️  DISCORD_BOT_TOKEN is not configured in environment variables.');
  console.warn('The Cindermarch Operations Bot is standing by in OFFLINE/CONFIGURATION mode.');
  console.warn('To connect to Discord:');
  console.warn('1. Create a Discord Bot in https://discord.com/developers/applications');
  console.warn('2. Add DISCORD_BOT_TOKEN=<your_token> and DISCORD_CLIENT_ID=<client_id> to .env');
  console.warn('3. Run "npm run deploy:commands" to register slash commands');
  console.warn('4. Restart the bot service.\n');

  // Keep process alive for health status monitoring
  setInterval(() => {
    // idle heartbeat
  }, 60000);
} else {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
  });

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`✅ Logged in to Discord as ${readyClient.user.tag}!`);
    readyClient.user.setActivity('Terminal 6 Dev // /help', {
      type: ActivityType.Watching
    });

    console.log(`🌐 Connected to ${readyClient.guilds.cache.size} server(s).`);
    for (const guild of readyClient.guilds.cache.values()) {
      console.log(`   • ${guild.name} (ID: ${guild.id})`);
    }

    // Start background outbox polling loop
    console.log(`📬 Starting outbox queue dispatcher (every ${CONFIG.POLL_INTERVAL_MS / 1000}s)...`);
    setInterval(() => processOutboxQueue(client), CONFIG.POLL_INTERVAL_MS);

    // Start background reminder scheduler worker loop
    console.log(`⏰ Starting persistent reminder worker (every ${CONFIG.REMINDER_POLL_INTERVAL_MS / 1000}s)...`);
    setInterval(() => processDueReminders(client), CONFIG.REMINDER_POLL_INTERVAL_MS);
  });

  // Handle slash command interactions
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Enforce private guild allowlist
    if (CONFIG.GUILD_ID && interaction.guildId && interaction.guildId !== CONFIG.GUILD_ID) {
      console.warn(`[Bot] Rejected unauthorized interaction from foreign guild: ${interaction.guildId}`);
      await interaction.reply({
        content: `⛔ **Access Denied**: The Cindermarch Operations Bot is private to Cindermarch Studio (Authorized Guild ID: \`${CONFIG.GUILD_ID}\`). Interactions from this server are strictly prohibited.`,
        ephemeral: true
      }).catch(() => {});
      return;
    }

    const command = commandMap.get(interaction.commandName);
    if (!command) {
      console.warn(`[Bot] Received unknown command: /${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err: any) {
      console.error(`[Bot] Error executing /${interaction.commandName}:`, err);
      const errorMessage = 'An unexpected error occurred while processing this command.';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `❌ ${errorMessage}`, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: `❌ ${errorMessage}`, ephemeral: true }).catch(() => {});
      }
    }
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down Cindermarch Operations Bot cleanly...`);
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Connect
  client.login(CONFIG.BOT_TOKEN).catch((err) => {
    console.error('❌ Failed to login to Discord with provided DISCORD_BOT_TOKEN:', err.message);
  });
}
