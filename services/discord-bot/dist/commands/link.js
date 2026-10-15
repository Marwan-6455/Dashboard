import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';
import { hubClient } from '../api/hubClient.js';
export const data = new SlashCommandBuilder()
    .setName('link')
    .setDescription('Start secure account linking between your Discord identity and Cindermarch Engine Hub');
export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        // Check if already linked
        const existing = await hubClient.getUser(interaction.user.id).catch(() => ({ linked: false }));
        if (existing.linked && existing.user) {
            const alreadyLinkedEmbed = new EmbedBuilder()
                .setTitle('✅ Account Already Linked')
                .setDescription(`Your Discord account is already connected to **${existing.user.displayName}** (\`${existing.user.username}\`).\n\n` +
                `Role(s): **${existing.user.roles.join(', ')}**\n` +
                `If you wish to disconnect, use \`/unlink\`.`)
                .setColor(CONFIG.COLORS.SUCCESS)
                .setTimestamp();
            await interaction.editReply({ embeds: [alreadyLinkedEmbed] });
            return;
        }
        // Generate single-use verification code
        const linkData = await hubClient.initiateLink(interaction.user.id, interaction.user.tag || interaction.user.username);
        const embed = new EmbedBuilder()
            .setTitle('🔗 Secure Account Linking // Cindermarch Engine Hub')
            .setDescription(`A single-use verification code has been generated for Discord user **@${interaction.user.username}**.\n\n` +
            `### Verification Code: \`${linkData.code}\`\n\n` +
            `**Steps to Complete Verification:**\n` +
            `1. Open the [Cindermarch Engine Hub](${linkData.hubUrl})\n` +
            `2. Log in with your studio credentials\n` +
            `3. Navigate to **Integrations** or enter code **\`${linkData.code}\`** in the Discord link dialog\n` +
            `4. Confirm connection\n\n` +
            `⚠️ *This code expires in 15 minutes. Never share this code with others.*`)
            .setColor(CONFIG.COLORS.PRIMARY)
            .setFooter({ text: 'Cindermarch Security // Immutable Discord Snowflake Binding' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (err) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Account Linking Error')
            .setDescription(err.message || 'Unable to connect to Engine Hub. Please ensure the backend is running.')
            .setColor(CONFIG.COLORS.DANGER);
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}
