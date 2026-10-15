import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';
import { hubClient } from '../api/hubClient.js';

export const data = new SlashCommandBuilder()
  .setName('health')
  .setDescription('Safe operational health and queue status for authorized studio administrators');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const health = await hubClient.getHealth();

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Cindermarch Operations Bot // System Health')
      .setDescription('Operational status of Hub integration, outbox dispatch queues, and reminder engine.')
      .setColor(health.status === 'operational' ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.WARNING)
      .addFields(
        {
          name: '🖥️ Service Status',
          value:
            `• State: **${health.status.toUpperCase()}**\n` +
            `• Database: **${health.database}**\n` +
            `• Engine Hub Uptime: **${Math.floor(health.uptimeSeconds / 60)} minutes**`,
          inline: true
        },
        {
          name: '📬 Outbox Queue',
          value:
            `• Pending: **${health.outbox.pending}**\n` +
            `• Delivered: **${health.outbox.delivered}**\n` +
            `• Failed: **${health.outbox.failed}**\n` +
            `• Last Delivered: ${health.outbox.lastDeliveredAt ? `<t:${Math.floor(new Date(health.outbox.lastDeliveredAt).getTime() / 1000)}:R>` : '*None*'}`,
          inline: true
        },
        {
          name: '⏰ Persistent Reminders',
          value:
            `• Pending: **${health.reminders.pending}**\n` +
            `• Sent: **${health.reminders.sent}**\n` +
            `• Cancelled: **${health.reminders.cancelled}**\n` +
            `• Next Due: ${health.reminders.nextDue ? `<t:${Math.floor(new Date(health.reminders.nextDue).getTime() / 1000)}:R>` : '*None*'}`,
          inline: true
        }
      );

    if (health.guildConfig) {
      embed.addFields({
        name: '🌐 Discord Guild & Channel Mappings',
        value:
          `• Guild: **${health.guildConfig.guild_name || health.guildConfig.guild_id}**\n` +
          `• Announcements: \`${health.guildConfig.announcements_channel_id || 'Not configured'}\`\n` +
          `• Engine: \`${health.guildConfig.engine_channel_id || 'Not configured'}\`\n` +
          `• QA Builds: \`${health.guildConfig.qa_channel_id || 'Not configured'}\`\n` +
          `• Escalation: \`${health.guildConfig.escalation_channel_id || 'Not configured'}\``
      });
    }

    embed.setFooter({
      text: 'No credentials, tokens, or environment secrets are exposed in this report.'
    });
    embed.setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Health Check Failed')
          .setDescription(err.message || 'Unable to retrieve health status.')
          .setColor(CONFIG.COLORS.DANGER)
      ]
    });
  }
}
