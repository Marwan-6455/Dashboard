import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';
import { hubClient } from '../api/hubClient.js';
export const data = new SlashCommandBuilder()
    .setName('deadlines')
    .setDescription('View upcoming or overdue task deadlines on Terminal 6')
    .addStringOption((opt) => opt
    .setName('window')
    .setDescription('Time window filter')
    .setRequired(false)
    .addChoices({ name: 'Due in Next 7 Days', value: '7days' }, { name: 'Due Today', value: 'today' }, { name: 'Due Tomorrow', value: 'tomorrow' }, { name: 'Overdue Tasks', value: 'overdue' }));
export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: false });
    try {
        const window = interaction.options.getString('window') || '7days';
        const data = await hubClient.getDeadlines(interaction.user.id, window);
        const titles = {
            today: 'Tasks Due Today',
            tomorrow: 'Tasks Due Tomorrow',
            '7days': 'Tasks Due in Next 7 Days',
            overdue: '⚠️ Overdue Tasks'
        };
        const embedColor = window === 'overdue' ? CONFIG.COLORS.DANGER : CONFIG.COLORS.PRIMARY;
        if (data.total === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setTitle(`⏰ Deadlines // ${titles[window] || 'Upcoming'}`)
                .setDescription('No tasks match this deadline window. Excellent work!')
                .setColor(CONFIG.COLORS.SUCCESS)
                .setTimestamp();
            await interaction.editReply({ embeds: [emptyEmbed] });
            return;
        }
        const embed = new EmbedBuilder()
            .setTitle(`⏰ Deadlines // ${titles[window] || 'Upcoming'} (${data.total} tasks)`)
            .setColor(embedColor)
            .setTimestamp();
        const lines = data.tasks.slice(0, 15).map((t) => {
            const link = `[${t.id}](${CONFIG.HUB_WEB_URL}/tasks/${t.id})`;
            const assignee = t.owner_name ? `@${t.owner_name}` : '*Unassigned*';
            return `${link} **${t.title}**\n↳ Deadline: **${t.deadline}** • Assignee: **${assignee}** • Priority: \`${t.priority}\``;
        });
        embed.setDescription(lines.join('\n\n'));
        embed.setFooter({ text: `${CONFIG.STUDIO.NAME} // Timezone: Africa/Cairo` });
        await interaction.editReply({ embeds: [embed] });
    }
    catch (err) {
        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setTitle('❌ Error Loading Deadlines')
                    .setDescription(err.message || 'Unable to load deadlines from Engine Hub.')
                    .setColor(CONFIG.COLORS.DANGER)
            ]
        });
    }
}
