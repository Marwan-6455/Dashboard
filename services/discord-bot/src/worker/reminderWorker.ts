import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { CONFIG } from '../config.js';
import { hubClient } from '../api/hubClient.js';

export async function processDueReminders(client: Client) {
  if (!client.isReady()) return;

  try {
    const { reminders } = await hubClient.pollDueReminders().catch(() => ({ reminders: [] }));
    if (!reminders || reminders.length === 0) return;

    for (const rem of reminders) {
      // Check if task is already complete - suppress obsolete reminders
      if (rem.task_status === 'Verified Complete') {
        await hubClient.ackReminder(rem.id, true, 'Suppressed: Task already completed.');
        continue;
      }

      const targetDiscordId = rem.recipient_discord_id || rem.owner_discord_id;
      const embed = createReminderEmbed(rem);

      let delivered = false;

      // 1. Try to deliver via Direct Message to the assignee
      if (targetDiscordId) {
        try {
          const user = await client.users.fetch(targetDiscordId).catch(() => null);
          if (user) {
            await user.send({ embeds: [embed] });
            delivered = true;
            console.log(`[Reminders] DM delivered to @${user.tag} for task ${rem.task_id} (${rem.reminder_type})`);
          }
        } catch (dmErr: any) {
          console.warn(`[Reminders] Failed to DM user ${targetDiscordId}: ${dmErr.message}. Falling back to channel.`);
        }
      }

      // 2. If DM failed or no user Discord ID, post to configured channel
      if (!delivered) {
        try {
          const health = await hubClient.getHealth().catch(() => null);
          const channelId =
            rem.reminder_type === 'overdue_daily' || rem.reminder_type === 'escalation'
              ? health?.guildConfig?.escalation_channel_id || health?.guildConfig?.engine_channel_id
              : health?.guildConfig?.engine_channel_id || health?.guildConfig?.announcements_channel_id;

          if (channelId) {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel && channel instanceof TextChannel) {
              const mention = targetDiscordId ? `<@${targetDiscordId}> ` : '';
              await channel.send({ content: mention, embeds: [embed] });
              delivered = true;
              console.log(`[Reminders] Channel alert posted in #${channel.name} for task ${rem.task_id}`);
            }
          }
        } catch (chanErr: any) {
          console.error(`[Reminders] Failed to post in channel:`, chanErr);
        }
      }

      await hubClient.ackReminder(
        rem.id,
        delivered,
        delivered ? null : 'Failed to deliver via DM or channel'
      );
    }
  } catch (err) {
    console.error('[Reminders] Error in processDueReminders:', err);
  }
}

function createReminderEmbed(rem: any): EmbedBuilder {
  const embed = new EmbedBuilder().setTimestamp();
  const taskUrl = `${CONFIG.HUB_WEB_URL}/tasks/${rem.task_id}`;

  switch (rem.reminder_type) {
    case 'deadline_24h':
      return embed
        .setTitle(`⏰ Deadline Reminder: 24 Hours Remaining // [${rem.task_id}]`)
        .setURL(taskUrl)
        .setDescription(
          `Task **${rem.task_title}** is due tomorrow (**${rem.task_deadline}**).\n` +
          `Status: **${rem.task_status}** • Priority: \`${rem.task_priority}\``
        )
        .setColor(CONFIG.COLORS.WARNING)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // 24-Hour Advance Alert` });

    case 'deadline_2h':
      return embed
        .setTitle(`⚠️ Urgent Reminder: 2 Hours Until Deadline // [${rem.task_id}]`)
        .setURL(taskUrl)
        .setDescription(
          `Task **${rem.task_title}** is due in **2 hours** (**${rem.task_deadline}**).\n` +
          `Status: **${rem.task_status}** • Please ensure progress is updated.`
        )
        .setColor(CONFIG.COLORS.DANGER)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // 2-Hour Urgency Alert` });

    case 'deadline_due':
      return embed
        .setTitle(`⏰ Deadline Reached Today // [${rem.task_id}]`)
        .setURL(taskUrl)
        .setDescription(
          `The scheduled deadline for **${rem.task_title}** has arrived.\n` +
          `Current Status: **${rem.task_status}**.`
        )
        .setColor(CONFIG.COLORS.PRIMARY)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Scheduled Deadline Alert` });

    case 'overdue_daily':
      return embed
        .setTitle(`🚨 Task Overdue Daily Alert // [${rem.task_id}]`)
        .setURL(taskUrl)
        .setDescription(
          `Task **${rem.task_title}** is **OVERDUE** (Deadline was ${rem.task_deadline}).\n` +
          `Status: **${rem.task_status}** • Priority: \`${rem.task_priority}\`\n\n` +
          `*Please update the task status or request an adjusted deadline with the Engine Lead.*`
        )
        .setColor(CONFIG.COLORS.DANGER)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Overdue Escalation Policy` });

    default:
      return embed
        .setTitle(`⏰ Task Reminder // [${rem.task_id}]`)
        .setURL(taskUrl)
        .setDescription(`Reminder for task **${rem.task_title}** (Status: ${rem.task_status}).`)
        .setColor(CONFIG.COLORS.INFO)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Persistent Scheduled Reminders` });
  }
}
