import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';
import { hubClient } from '../api/hubClient.js';

export const data = new SlashCommandBuilder()
  .setName('standup')
  .setDescription('Generate an automated team standup summary from real Engine Hub data');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  try {
    const data = await hubClient.getStandup(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle(`⚡ Team Standup Summary // ${data.project}`)
      .setDescription(`Reporting snapshot generated from live Hub database at <t:${Math.floor(Date.now() / 1000)}:t>.`)
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTimestamp();

    // 1. Completed
    if (data.completed.length > 0) {
      const completedLines = data.completed.map(
        (t: any) => `• [${t.id}](${CONFIG.HUB_WEB_URL}/tasks/${t.id}) **${t.title}** (${t.owner_name ? `@${t.owner_name}` : 'Team'})`
      );
      embed.addFields({
        name: `✅ Verified Complete Recently (${data.completed.length})`,
        value: completedLines.join('\n')
      });
    } else {
      embed.addFields({
        name: '✅ Verified Complete Recently',
        value: '*No tasks completed in this reporting period.*'
      });
    }

    // 2. In Progress
    if (data.inProgress.length > 0) {
      const inProgLines = data.inProgress.map(
        (t: any) => `• [${t.id}](${CONFIG.HUB_WEB_URL}/tasks/${t.id}) **${t.title}** (${t.owner_name ? `@${t.owner_name}` : 'Unassigned'}${t.deadline ? ` • ⏰ ${t.deadline}` : ''})`
      );
      embed.addFields({
        name: `⚡ Currently In Progress (${data.inProgress.length})`,
        value: inProgLines.join('\n')
      });
    } else {
      embed.addFields({
        name: '⚡ Currently In Progress',
        value: '*No tasks currently in progress.*'
      });
    }

    // 3. Blocked
    if (data.blocked.length > 0) {
      const blockedLines = data.blocked.map(
        (t: any) => `• 🛑 [${t.id}](${CONFIG.HUB_WEB_URL}/tasks/${t.id}) **${t.title}** (${t.owner_name ? `@${t.owner_name}` : 'Unassigned'})`
      );
      embed.addFields({
        name: `🛑 Blocked / Needs Attention (${data.blocked.length})`,
        value: blockedLines.join('\n')
      });
    }

    // 4. Pending Reviews
    if (data.pendingReviews.length > 0) {
      const reviewLines = data.pendingReviews.map(
        (r: any) => `• [${r.task_id}](${CONFIG.HUB_WEB_URL}/reviews) **${r.task_title}** (Author: @${r.developer_name} ➔ Reviewer: **@${r.reviewer_name}**)`
      );
      embed.addFields({
        name: `🔍 Pending Peer Reviews (${data.pendingReviews.length})`,
        value: reviewLines.join('\n')
      });
    }

    // 5. Upcoming Deadlines
    if (data.upcomingDeadlines.length > 0) {
      const deadlineLines = data.upcomingDeadlines.slice(0, 5).map(
        (t: any) => `• [${t.id}](${CONFIG.HUB_WEB_URL}/tasks/${t.id}) **${t.title}** (Due: **${t.deadline}** • @${t.owner_name || 'Unassigned'})`
      );
      embed.addFields({
        name: `⏰ Upcoming Deadlines (${data.upcomingDeadlines.length})`,
        value: deadlineLines.join('\n')
      });
    }

    embed.setFooter({ text: `${CONFIG.STUDIO.NAME} // Authentic data from Terminal 6 system of record` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Standup Generation Failed')
          .setDescription(err.message || 'Unable to generate standup report.')
          .setColor(CONFIG.COLORS.DANGER)
      ]
    });
  }
}
