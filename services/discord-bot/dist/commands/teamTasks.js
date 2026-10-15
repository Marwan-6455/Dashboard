import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';
import { hubClient } from '../api/hubClient.js';
export const data = new SlashCommandBuilder()
    .setName('team-tasks')
    .setDescription('View active team tasks on Terminal 6 with optional filters')
    .addStringOption((opt) => opt
    .setName('status')
    .setDescription('Filter by task status')
    .setRequired(false)
    .addChoices({ name: 'In Progress', value: 'In Progress' }, { name: 'Ready for Review', value: 'Ready for Review' }, { name: 'Changes Requested', value: 'Changes Requested' }, { name: 'Blocked', value: 'Blocked' }, { name: 'Ready to Integrate', value: 'Ready to Integrate' }, { name: 'Backlog', value: 'Backlog' }))
    .addStringOption((opt) => opt
    .setName('priority')
    .setDescription('Filter by priority (P0, P1, P2)')
    .setRequired(false)
    .addChoices({ name: 'P0 (Critical / Blocker)', value: 'P0' }, { name: 'P1 (High)', value: 'P1' }, { name: 'P2 (Normal)', value: 'P2' }))
    .addStringOption((opt) => opt
    .setName('category')
    .setDescription('Filter by category (Gameplay, Engine, Graphics, Audio, QA)')
    .setRequired(false))
    .addStringOption((opt) => opt
    .setName('search')
    .setDescription('Search query in title or description')
    .setRequired(false));
export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    try {
        const status = interaction.options.getString('status') || undefined;
        const priority = interaction.options.getString('priority') || undefined;
        const category = interaction.options.getString('category') || undefined;
        const search = interaction.options.getString('search') || undefined;
        const data = await hubClient.getTeamTasks(interaction.user.id, {
            status,
            priority,
            category,
            search
        });
        if (data.total === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setTitle('📋 Team Tasks // Terminal 6')
                .setDescription('No tasks found matching your filter criteria.')
                .setColor(CONFIG.COLORS.INFO)
                .setTimestamp();
            await interaction.editReply({ embeds: [emptyEmbed] });
            return;
        }
        const embed = new EmbedBuilder()
            .setTitle(`📋 Team Tasks // Terminal 6 (${data.total} tasks)`)
            .setDescription(`Active team tasks${status ? ` • Status: **${status}**` : ''}${priority ? ` • Priority: **${priority}**` : ''}`)
            .setColor(CONFIG.COLORS.PRIMARY)
            .setTimestamp();
        // Show up to 15 tasks to fit cleanly in Discord embed
        const displayTasks = data.tasks.slice(0, 15);
        const lines = displayTasks.map((t) => {
            const link = `[${t.id}](${CONFIG.HUB_WEB_URL}/tasks/${t.id})`;
            const assignee = t.owner_name ? `@${t.owner_name}` : '*Unassigned*';
            const deadline = t.deadline ? ` • ⏰ ${t.deadline}` : '';
            return `${link} **${t.title}**\n↳ \`${t.priority}\` • \`${t.status}\` • Assignee: **${assignee}**${deadline}`;
        });
        embed.addFields({
            name: `Showing ${displayTasks.length} of ${data.total} tasks`,
            value: lines.join('\n\n')
        });
        if (data.total > 15) {
            embed.setFooter({
                text: `+${data.total - 15} more tasks on Engine Hub. Use filters or open dashboard.`
            });
        }
        await interaction.editReply({ embeds: [embed] });
    }
    catch (err) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Error Loading Team Tasks')
            .setDescription(err.message || 'Unable to load tasks from Engine Hub.')
            .setColor(CONFIG.COLORS.DANGER);
        await interaction.editReply({ embeds: [errorEmbed] });
    }
}
