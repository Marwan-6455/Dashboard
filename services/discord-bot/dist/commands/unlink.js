import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';
import { hubClient } from '../api/hubClient.js';
export const data = new SlashCommandBuilder()
    .setName('unlink')
    .setDescription('Unlink your Discord account from your Cindermarch Engine Hub profile');
export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const res = await hubClient.unlink(interaction.user.id);
        const embed = new EmbedBuilder()
            .setTitle('🔓 Discord Account Unlinked')
            .setDescription('Your Discord account has been disconnected from the Cindermarch Engine Hub.\n' +
            'An audit record of this action has been saved. To re-link at any time, run `/link`.')
            .setColor(CONFIG.COLORS.METALLIC)
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
    catch (err) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Unlink Failed')
            .setDescription(err.message || 'Unable to unlink account. Ensure your account is currently linked.')
            .setColor(CONFIG.COLORS.DANGER);
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}
