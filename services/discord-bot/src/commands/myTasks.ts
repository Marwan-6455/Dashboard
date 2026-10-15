import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';
import { hubClient } from '../api/hubClient.js';

export const data = new SlashCommandBuilder()
  .setName('my-tasks')
  .setDescription('Show your assigned tasks grouped by status and upcoming deadlines');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const data = await hubClient.getMyTasks(interaction.user.id);

    if (data.total === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle(`📋 My Tasks // ${data.user.displayName}`)
        .setDescription('You currently have no tasks assigned to you in Terminal 6.')
        .setColor(CONFIG.COLORS.INFO)
        .setTimestamp();

      await interaction.editReply({ embeds: [emptyEmbed] });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 My Tasks // ${data.user.displayName} (${data.total} total)`)
      .setDescription('Active tasks assigned to you on Terminal 6, grouped by status.')
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTimestamp();

    const statusIcons: Record<string, string> = {
      'In Progress': '⚡',
      'Ready for Review': '🔍',
      'Changes Requested': '⚠️',
      'Backlog': '📦',
      'Blocked': '🛑',
      'Ready to Integrate': '🔗',
      'Verified Complete': '✅'
    };

    for (const [status, tasks] of Object.entries(data.grouped)) {
      if (tasks.length === 0) continue;

      const taskLines = tasks.map((t: any) => {
        const priorityBadge = `\`${t.priority}\``;
        const deadlineText = t.deadline ? ` • ⏰ ${t.deadline}` : '';
        const link = `[${t.id}](${CONFIG.HUB_WEB_URL}/tasks/${t.id})`;
        return `${link} **${t.title}** (${priorityBadge}${deadlineText})`;
      });

      const icon = statusIcons[status] || '•';
      embed.addFields({
        name: `${icon} ${status} (${tasks.length})`,
        value: taskLines.join('\n')
      });
    }

    embed.setFooter({ text: `${CONFIG.STUDIO.NAME} // Open dashboard link to view evidence & gates` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error Loading Tasks')
      .setDescription(err.message || 'Unable to retrieve your tasks from Engine Hub.')
      .setColor(CONFIG.COLORS.DANGER);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
