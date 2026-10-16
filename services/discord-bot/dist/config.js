try {
    process.loadEnvFile?.();
}
catch { }
export const CONFIG = {
    BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || '',
    CLIENT_ID: process.env.DISCORD_CLIENT_ID || '1560406066867478681',
    GUILD_ID: process.env.DISCORD_GUILD_ID || '1394770347030483034',
    HUB_API_URL: process.env.HUB_API_URL || 'http://localhost:3001/api/bot',
    HUB_WEB_URL: process.env.CLIENT_ORIGIN || process.env.HUB_WEB_URL || 'http://localhost:5173',
    BOT_API_KEY: process.env.INTERNAL_BOT_API_KEY || process.env.SESSION_SECRET || 'cindermarch-bot-internal-secret-key',
    POLL_INTERVAL_MS: 15000,
    REMINDER_POLL_INTERVAL_MS: 30000,
    COLORS: {
        PRIMARY: 0xff5722, // Burnt orange
        METALLIC: 0x2a2d35, // Dark metallic grey
        SUCCESS: 0x16a34a, // Green (Verified Complete)
        DANGER: 0xdc2626, // Red (Blocked / Overdue)
        WARNING: 0xf59e0b, // Amber (Review / Due Soon)
        INFO: 0x0284c7 // Sky Blue
    },
    STUDIO: {
        NAME: 'Cindermarch Studio',
        PROJECT: 'Terminal 6',
        SUBTITLE: 'Internal Development Management'
    }
};
