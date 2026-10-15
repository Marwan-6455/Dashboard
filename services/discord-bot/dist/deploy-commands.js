import { REST, Routes } from 'discord.js';
import { CONFIG } from './config.js';
import { commands } from './commands/index.js';
async function deploy() {
    const token = CONFIG.BOT_TOKEN;
    const clientId = CONFIG.CLIENT_ID;
    const guildId = CONFIG.GUILD_ID;
    if (!token) {
        console.error('❌ DISCORD_BOT_TOKEN is not configured in the environment.');
        console.error('Please configure DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID in your .env file.');
        process.exit(1);
    }
    if (!clientId) {
        console.error('❌ DISCORD_CLIENT_ID is not configured in the environment.');
        process.exit(1);
    }
    const rest = new REST({ version: '10' }).setToken(token);
    const payload = commands.map((c) => c.data.toJSON());
    console.log(`⚡ Registering ${payload.length} application (slash) commands for Cindermarch Operations Bot...`);
    try {
        if (guildId) {
            console.log(`Deploying to Guild (${guildId}) for fast development testing...`);
            const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: payload });
            console.log(`✅ Successfully reloaded ${data.length} guild application commands.`);
        }
        else {
            console.log('Deploying globally to all guilds...');
            const data = await rest.put(Routes.applicationCommands(clientId), { body: payload });
            console.log(`✅ Successfully reloaded ${data.length} global application commands.`);
        }
    }
    catch (err) {
        console.error('❌ Failed to register Discord application commands:', err);
        process.exit(1);
    }
}
deploy();
