import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';

export const data = new SlashCommandBuilder()
  .setName('subscribe')
  .setDescription('Configure your personal notification preferences and reminder policies')
  .addStringOption((opt) =>
    opt
      .setName('category')
      .setDescription('Notification category')
      .setRequired(true)
      .addChoices(
        { name: 'All Task Assignments & Deadlines', value: 'all' },
        { name: 'Direct Mentions & Assignments Only', value: 'direct_only' },
        { name: 'Urgent Reminders Only (2h & Overdue)', value: 'urgent_only' },
        { name: 'Mute Discord DMs (In-App Only)', value: 'mute_dms' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const choice = interaction.options.getString('category', true);

  const labels: Record<string, string> = {
    all: 'All Task Assignments & Deadlines (24h, 2h, due, overdue)',
    direct_only: 'Direct Mentions & Assignments Only',
    urgent_only: 'Urgent Reminders Only (2h before deadline and daily overdue alerts)',
    mute_dms: 'Mute Discord Direct Messages (Notifications remain visible in Hub Notification Center)'
  };

  const embed = new EmbedBuilder()
    .setTitle('🔔 Notification Preferences Updated')
    .setDescription(
      `Your notification preference has been saved as:\n**${labels[choice] || choice}**\n\n` +
      `You can update this at any time using \`/subscribe\` or in your [Engine Hub Profile](${CONFIG.HUB_WEB_URL}/settings).`
    )
    .setColor(CONFIG.COLORS.PRIMARY)
    .setFooter({ text: `${CONFIG.STUDIO.NAME} // Notification Delivery Engine` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
