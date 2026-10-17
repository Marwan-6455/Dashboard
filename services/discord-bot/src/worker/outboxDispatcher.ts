import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';
import { hubClient } from '../api/hubClient.js';

export async function processOutboxQueue(client: Client) {
  if (!client.isReady()) return;

  try {
    const { events } = await hubClient.pollOutbox().catch(() => ({ events: [] }));
    if (!events || events.length === 0) return;

    // Get guild configuration to find channel IDs
    const health = await hubClient.getHealth().catch(() => null);
    const guildConfig = health?.guildConfig;

    for (const event of events) {
      let payload: any = {};
      try {
        payload = JSON.parse(event.payload_json);
      } catch {
        payload = {};
      }

      // If target is direct message (DM), send to recipient
      if (event.target_channel_type === 'dm' && payload.recipientDiscordId) {
        try {
          const user = await client.users.fetch(payload.recipientDiscordId).catch(() => null);
          if (user) {
            const embed = createEmbedForEvent(event.event_type, payload);
            await user.send({ content: payload.content || undefined, embeds: [embed] });
            await hubClient.ackOutbox(event.id, true);
            console.log(`[Outbox] Delivered DM for event ${event.id} (${event.event_type}) to @${user.tag}`);
            continue;
          } else {
            await hubClient.ackOutbox(event.id, false, `Discord user ${payload.recipientDiscordId} not found.`);
            continue;
          }
        } catch (dmErr: any) {
          console.warn(`[Outbox] Failed to deliver DM for event ${event.id}:`, dmErr.message);
          await hubClient.ackOutbox(event.id, false, dmErr.message);
          continue;
        }
      }

      // Determine target channel ID from guild config
      let targetChannelId: string | null = null;
      if (guildConfig) {
        if (event.target_channel_type === 'story') {
          targetChannelId = guildConfig.story_channel_id || guildConfig.announcements_channel_id;
        } else if (event.target_channel_type === 'coding') {
          targetChannelId = guildConfig.coding_channel_id || guildConfig.announcements_channel_id;
        } else if (event.target_channel_type === 'marketing') {
          targetChannelId = guildConfig.marketing_channel_id || guildConfig.announcements_channel_id;
        } else if (event.target_channel_type === 'artists' || event.target_channel_type === '3d-artists') {
          targetChannelId = guildConfig.artists_channel_id || guildConfig.announcements_channel_id;
        } else if (event.target_channel_type === 'sound') {
          targetChannelId = guildConfig.sound_channel_id || guildConfig.announcements_channel_id;
        } else if (event.target_channel_type === 'qa') {
          targetChannelId = guildConfig.qa_channel_id || guildConfig.engine_channel_id || guildConfig.announcements_channel_id;
        } else if (event.target_channel_type === 'escalation') {
          targetChannelId = guildConfig.escalation_channel_id || guildConfig.engine_channel_id || guildConfig.announcements_channel_id;
        } else if (event.target_channel_type === 'engine') {
          targetChannelId = guildConfig.engine_channel_id || guildConfig.announcements_channel_id;
        } else {
          targetChannelId = guildConfig.announcements_channel_id || guildConfig.engine_channel_id;
        }
      }

      const isSnowflake = (id?: string | null): boolean => !!id && /^\d{17,20}$/.test(id);

      let channelToFetch = isSnowflake(targetChannelId) ? targetChannelId : null;
      if (!channelToFetch && isSnowflake(guildConfig?.engine_channel_id)) {
        channelToFetch = guildConfig.engine_channel_id;
      }
      if (!channelToFetch && isSnowflake(guildConfig?.announcements_channel_id)) {
        channelToFetch = guildConfig.announcements_channel_id;
      }

      let channel: any = null;
      if (channelToFetch) {
        channel = await client.channels.fetch(channelToFetch).catch(() => null);
      }

      // If still not found or not text-based, fallback to authorized guild's system or first text channel
      if (!channel || !(channel instanceof TextChannel)) {
        const authorizedGuild = client.guilds.cache.get(CONFIG.GUILD_ID) || client.guilds.cache.first();
        const fallback = authorizedGuild?.systemChannel || authorizedGuild?.channels.cache.find((c) => c.isTextBased() && c instanceof TextChannel);
        if (fallback instanceof TextChannel) {
          channel = fallback;
        }
      }

      if (!channel || !(channel instanceof TextChannel)) {
        await hubClient.ackOutbox(event.id, false, `No accessible Discord text channel found for target "${targetChannelId}".`);
        continue;
      }

      // Build event embed
      const embed = createEmbedForEvent(event.event_type, payload);
      try {
        await channel.send({ embeds: [embed] });
        await hubClient.ackOutbox(event.id, true);
        console.log(`[Outbox] Delivered event ${event.id} (${event.event_type}) to #${channel.name}`);
      } catch (err: any) {
        console.error(`[Outbox] Failed to deliver event ${event.id}:`, err);
        await hubClient.ackOutbox(event.id, false, err.message);
      }
    }
  } catch (err) {
    console.error('[Outbox] Error in processOutboxQueue:', err);
  }
}

function createEmbedForEvent(eventType: string, payload: any): EmbedBuilder {
  const embed = new EmbedBuilder().setTimestamp();

  switch (eventType) {
    case 'task_created':
      return embed
        .setTitle(`🆕 New Task Created // [${payload.taskId}]`)
        .setURL(`${CONFIG.HUB_WEB_URL}/tasks/${payload.taskId}`)
        .setDescription(payload.description || payload.title)
        .setColor(CONFIG.COLORS.PRIMARY)
        .addFields(
          { name: 'Title', value: payload.title, inline: false },
          { name: 'Project', value: payload.projectName || (payload.projectId === 'eclipsed' || payload.taskId?.startsWith('ECL') ? 'Eclipsed' : 'Terminal 6'), inline: true },
          { name: 'Priority', value: `\`${payload.priority || 'P1'}\``, inline: true },
          { name: 'Category', value: payload.category || 'Gameplay', inline: true },
          { name: 'Deadline', value: payload.deadline ? `⏰ ${payload.deadline}` : '*None*', inline: true }
        )
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // New Assignment Announcement` });

    case 'task_assigned':
      return embed
        .setTitle(`👤 Task Assigned // [${payload.taskId}]`)
        .setURL(`${CONFIG.HUB_WEB_URL}/tasks/${payload.taskId}`)
        .setDescription(`Task **${payload.title || payload.taskId}** has been assigned to <@${payload.assigneeId || payload.newOwnerId}>.`)
        .setColor(CONFIG.COLORS.INFO)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Task Assignment Engine` });

    case 'deadline_changed':
      return embed
        .setTitle(`⏰ Deadline Changed // [${payload.taskId}]`)
        .setURL(`${CONFIG.HUB_WEB_URL}/tasks/${payload.taskId}`)
        .setDescription(
          `Task **${payload.title || payload.taskId}** deadline updated:\n` +
          `• Old: *${payload.oldDeadline || 'None'}*\n` +
          `• New: **${payload.newDeadline || 'None'}**\n\n` +
          `Reminders have been automatically updated.`
        )
        .setColor(CONFIG.COLORS.WARNING)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Schedule Engine` });

    case 'task_completed':
      return embed
        .setTitle(`✅ Task Verified Complete // [${payload.taskId}]`)
        .setURL(`${CONFIG.HUB_WEB_URL}/tasks/${payload.taskId}`)
        .setDescription(
          `**${payload.title || payload.taskId}** has passed all 6 completion verification gates and is now **Verified Complete**!`
        )
        .setColor(CONFIG.COLORS.SUCCESS)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Quality Verification Verified` });

    case 'task_blocked':
      return embed
        .setTitle(`🛑 Task Blocked // [${payload.taskId}]`)
        .setURL(`${CONFIG.HUB_WEB_URL}/tasks/${payload.taskId}`)
        .setDescription(
          `Task **${payload.title || payload.taskId}** is marked **Blocked** and requires team attention.`
        )
        .setColor(CONFIG.COLORS.DANGER)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Escalation Alert` });

    case 'review_requested':
      return embed
        .setTitle(`🔍 Peer Review Requested // [${payload.taskId}]`)
        .setURL(`${CONFIG.HUB_WEB_URL}/reviews`)
        .setDescription(
          `Task **${payload.taskId}** is submitted for peer review.\n` +
          `Assigned reviewer: <@${payload.reviewerId}>.\n` +
          `*Remember: Self-approval is strictly forbidden by studio gates.*`
        )
        .setColor(CONFIG.COLORS.WARNING)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Code & Asset Quality Review` });

    case 'review_decision':
      return embed
        .setTitle(`🔍 Review Decision: ${payload.decision} // [${payload.taskId}]`)
        .setURL(`${CONFIG.HUB_WEB_URL}/reviews`)
        .setDescription(
          `Review decision for task **${payload.taskId}** has been submitted as **${payload.decision}**.\n` +
          `Task status transitioned to: **${payload.newStatus}**.`
        )
        .setColor(payload.decision === 'Approved' ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.DANGER)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Peer Review Workflow` });

    case 'test_report_ingested':
      return embed
        .setTitle(`🧪 Test Report Ingested // ${payload.suite}`)
        .setDescription(
          `Result: **${payload.result}** (${payload.passedCount} passed, ${payload.failedCount} failed)\n` +
          `Build: **${payload.buildResult}** • Revision: \`${payload.revision}\`\n` +
          `Runner: *${payload.runnerIdentity}*`
        )
        .setColor(payload.result === 'Passed' ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.DANGER)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Unity UTF CI Ingestion` });

    case 'workspace_entry_warning':
    case 'strike_warning':
    case 'threshold_warning':
      return embed
        .setTitle(`⚠️ ${payload.title || 'Cindermarch Deadline Warning'}`)
        .setURL(`${CONFIG.HUB_WEB_URL}/tasks`)
        .setDescription(payload.message || payload.content || 'Active deadline strike notification.')
        .setColor(
          payload.activeStrikes >= 5
            ? CONFIG.COLORS.DANGER
            : payload.activeStrikes === 4
            ? CONFIG.COLORS.DANGER
            : CONFIG.COLORS.WARNING
        )
        .addFields(
          { name: 'Active Strikes', value: `\`${payload.activeStrikes || 0} / ${payload.maxThreshold || 5}\``, inline: true },
          { name: 'Remaining Strikes', value: `\`${payload.remainingStrikes ?? 'N/A'}\``, inline: true },
          { name: 'Policy Action', value: payload.activeStrikes >= 5 ? '🛑 Workspace Suspended' : '⚠️ Keep Deadlines on Track', inline: true }
        )
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Deadline Accountability System` });

    case 'strike_reversed':
      return embed
        .setTitle(`⚖️ Strike Reversed // [${payload.taskId || payload.strikeId}]`)
        .setURL(`${CONFIG.HUB_WEB_URL}/tasks`)
        .setDescription(`A deadline strike has been formally reversed by studio administration.\nReason: *${payload.reason}*`)
        .setColor(CONFIG.COLORS.SUCCESS)
        .addFields(
          { name: 'Current Active Strikes', value: `\`${payload.currentActiveStrikes}\``, inline: true }
        )
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Administrative Strike Audit Trail` });

    case 'member_suspended':
      return embed
        .setTitle(`🛑 WORKSPACE SUSPENSION ALERT // ${payload.userId}`)
        .setURL(`${CONFIG.HUB_WEB_URL}`)
        .setDescription(
          `**Workspace Access Suspended**\n` +
          `Member has reached the 5-strike threshold.\n` +
          `Reason: *${payload.reason}*\n\n` +
          `Please contact the Workspace Owner/Admin to request a review.`
        )
        .setColor(CONFIG.COLORS.DANGER)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Automatic Suspension Policy` });

    case 'member_reinstated':
      return embed
        .setTitle(`✅ Workspace Access Reinstated // ${payload.userId}`)
        .setURL(`${CONFIG.HUB_WEB_URL}`)
        .setDescription(
          `Your private workspace membership has been officially reinstated by studio administration.\n` +
          `Reason: *${payload.reason}*`
        )
        .setColor(CONFIG.COLORS.SUCCESS)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Member Reinstatement` });

    case 'test_ping':
    default:
      return embed
        .setTitle('⚡ Cindermarch Operations Bot // Test Dispatch')
        .setDescription(payload.message || 'Connection ping from Terminal 6 Engine Hub.')
        .setColor(CONFIG.COLORS.PRIMARY)
        .setFooter({ text: `${CONFIG.STUDIO.NAME} // Verified Dispatch Ping` });
  }
}
