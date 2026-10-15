import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';
import { hubClient } from '../api/hubClient.js';

export const data = new SlashCommandBuilder()
  .setName('team')
  .setDescription('View authorized studio team members, roles, and current active task workloads');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });

  try {
    const data = await hubClient.getTeam(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle(`👥 Cindermarch Studio // Team Workload (${data.members.length} members)`)
      .setDescription('Active team roster on Terminal 6 with current task allocations.')
      .setColor(CONFIG.COLORS.PRIMARY)
      .setTimestamp();

    for (const m of data.members) {
      let parsedRoles = ['developer'];
      try {
        parsedRoles = JSON.parse(m.roles);
      } catch {}

      const discordTag = m.discord_username ? `@${m.discord_username}` : '*Not linked*';
      const roleBadges = parsedRoles.map((r: string) => `\`${r}\``).join(' ');

      embed.addFields({
        name: `${m.display_name} (${roleBadges})`,
        value:
          `• Discord: **${discordTag}**\n` +
          `• Active Tasks: **${m.active_tasks_count}**\n` +
          `• Reviews Pending: **${m.pending_reviews_count}**`
      });
    }

    embed.setFooter({ text: `${CONFIG.STUDIO.NAME} // Use /link to connect your Discord identity` });

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setTitle('❌ Error Loading Team')
          .setDescription(err.message || 'Unable to retrieve team members from Hub.')
          .setColor(CONFIG.COLORS.DANGER)
      ]
    });
  }
}
