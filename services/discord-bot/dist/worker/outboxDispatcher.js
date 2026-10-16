import { TextChannel, EmbedBuilder } from 'discord.js';
import { CONFIG } from '../config.js';
import { hubClient } from '../api/hubClient.js';
export async function processOutboxQueue(client) {
    if (!client.isReady())
        return;
    try {
        const { events } = await hubClient.pollOutbox().catch(() => ({ events: [] }));
        if (!events || events.length === 0)
            return;
        // Get guild configuration to find channel IDs
        const health = await hubClient.getHealth().catch(() => null);
        const guildConfig = health?.guildConfig;
        for (const event of events) {
            let payload = {};
            try {
                payload = JSON.parse(event.payload_json);
            }
            catch {
                payload = {};
            }
            // Determine target channel ID from guild config
            let targetChannelId = null;
            if (guildConfig) {
                if (event.target_channel_type === 'story') {
                    targetChannelId = guildConfig.story_channel_id || guildConfig.announcements_channel_id;
                }
                else if (event.target_channel_type === 'coding') {
                    targetChannelId = guildConfig.coding_channel_id || guildConfig.announcements_channel_id;
                }
                else if (event.target_channel_type === 'marketing') {
                    targetChannelId = guildConfig.marketing_channel_id || guildConfig.announcements_channel_id;
                }
                else if (event.target_channel_type === 'artists' || event.target_channel_type === '3d-artists') {
                    targetChannelId = guildConfig.artists_channel_id || guildConfig.announcements_channel_id;
                }
                else if (event.target_channel_type === 'sound') {
                    targetChannelId = guildConfig.sound_channel_id || guildConfig.announcements_channel_id;
                }
                else if (event.target_channel_type === 'qa') {
                    targetChannelId = guildConfig.qa_channel_id || guildConfig.engine_channel_id || guildConfig.announcements_channel_id;
                }
                else if (event.target_channel_type === 'escalation') {
                    targetChannelId = guildConfig.escalation_channel_id || guildConfig.engine_channel_id || guildConfig.announcements_channel_id;
                }
                else if (event.target_channel_type === 'engine') {
                    targetChannelId = guildConfig.engine_channel_id || guildConfig.announcements_channel_id;
                }
                else {
                    targetChannelId = guildConfig.announcements_channel_id || guildConfig.engine_channel_id;
                }
            }
            // If no configured channel, try finding the first accessible system or text channel in guilds
            if (!targetChannelId) {
                const guild = client.guilds.cache.first();
                const fallbackChannel = guild?.systemChannel || guild?.channels.cache.find((c) => c.isTextBased());
                targetChannelId = fallbackChannel ? fallbackChannel.id : null;
            }
            if (!targetChannelId) {
                console.warn(`[Outbox] No accessible channel found for event ${event.id} (${event.event_type}). Skipping for now.`);
                continue;
            }
            const channel = await client.channels.fetch(targetChannelId).catch(() => null);
            if (!channel || !(channel instanceof TextChannel)) {
                await hubClient.ackOutbox(event.id, false, `Channel ${targetChannelId} not found or not text-based.`);
                continue;
            }
            // Build event embed
            const embed = createEmbedForEvent(event.event_type, payload);
            try {
                await channel.send({ embeds: [embed] });
                await hubClient.ackOutbox(event.id, true);
                console.log(`[Outbox] Delivered event ${event.id} (${event.event_type}) to #${channel.name}`);
            }
            catch (err) {
                console.error(`[Outbox] Failed to deliver event ${event.id}:`, err);
                await hubClient.ackOutbox(event.id, false, err.message);
            }
        }
    }
    catch (err) {
        console.error('[Outbox] Error in processOutboxQueue:', err);
    }
}
function createEmbedForEvent(eventType, payload) {
    const embed = new EmbedBuilder().setTimestamp();
    switch (eventType) {
        case 'task_created':
            return embed
                .setTitle(`🆕 New Task Created // [${payload.taskId}]`)
                .setURL(`${CONFIG.HUB_WEB_URL}/tasks/${payload.taskId}`)
                .setDescription(payload.description || payload.title)
                .setColor(CONFIG.COLORS.PRIMARY)
                .addFields({ name: 'Title', value: payload.title, inline: false }, { name: 'Priority', value: `\`${payload.priority || 'P1'}\``, inline: true }, { name: 'Category', value: payload.category || 'Gameplay', inline: true }, { name: 'Deadline', value: payload.deadline ? `⏰ ${payload.deadline}` : '*None*', inline: true })
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
                .setDescription(`Task **${payload.title || payload.taskId}** deadline updated:\n` +
                `• Old: *${payload.oldDeadline || 'None'}*\n` +
                `• New: **${payload.newDeadline || 'None'}**\n\n` +
                `Reminders have been automatically updated.`)
                .setColor(CONFIG.COLORS.WARNING)
                .setFooter({ text: `${CONFIG.STUDIO.NAME} // Schedule Engine` });
        case 'task_completed':
            return embed
                .setTitle(`✅ Task Verified Complete // [${payload.taskId}]`)
                .setURL(`${CONFIG.HUB_WEB_URL}/tasks/${payload.taskId}`)
                .setDescription(`**${payload.title || payload.taskId}** has passed all 6 completion verification gates and is now **Verified Complete**!`)
                .setColor(CONFIG.COLORS.SUCCESS)
                .setFooter({ text: `${CONFIG.STUDIO.NAME} // Quality Verification Verified` });
        case 'task_blocked':
            return embed
                .setTitle(`🛑 Task Blocked // [${payload.taskId}]`)
                .setURL(`${CONFIG.HUB_WEB_URL}/tasks/${payload.taskId}`)
                .setDescription(`Task **${payload.title || payload.taskId}** is marked **Blocked** and requires team attention.`)
                .setColor(CONFIG.COLORS.DANGER)
                .setFooter({ text: `${CONFIG.STUDIO.NAME} // Escalation Alert` });
        case 'review_requested':
            return embed
                .setTitle(`🔍 Peer Review Requested // [${payload.taskId}]`)
                .setURL(`${CONFIG.HUB_WEB_URL}/reviews`)
                .setDescription(`Task **${payload.taskId}** is submitted for peer review.\n` +
                `Assigned reviewer: <@${payload.reviewerId}>.\n` +
                `*Remember: Self-approval is strictly forbidden by studio gates.*`)
                .setColor(CONFIG.COLORS.WARNING)
                .setFooter({ text: `${CONFIG.STUDIO.NAME} // Code & Asset Quality Review` });
        case 'review_decision':
            return embed
                .setTitle(`🔍 Review Decision: ${payload.decision} // [${payload.taskId}]`)
                .setURL(`${CONFIG.HUB_WEB_URL}/reviews`)
                .setDescription(`Review decision for task **${payload.taskId}** has been submitted as **${payload.decision}**.\n` +
                `Task status transitioned to: **${payload.newStatus}**.`)
                .setColor(payload.decision === 'Approved' ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.DANGER)
                .setFooter({ text: `${CONFIG.STUDIO.NAME} // Peer Review Workflow` });
        case 'test_report_ingested':
            return embed
                .setTitle(`🧪 Test Report Ingested // ${payload.suite}`)
                .setDescription(`Result: **${payload.result}** (${payload.passedCount} passed, ${payload.failedCount} failed)\n` +
                `Build: **${payload.buildResult}** • Revision: \`${payload.revision}\`\n` +
                `Runner: *${payload.runnerIdentity}*`)
                .setColor(payload.result === 'Passed' ? CONFIG.COLORS.SUCCESS : CONFIG.COLORS.DANGER)
                .setFooter({ text: `${CONFIG.STUDIO.NAME} // Unity UTF CI Ingestion` });
        case 'test_ping':
        default:
            return embed
                .setTitle('⚡ Cindermarch Operations Bot // Test Dispatch')
                .setDescription(payload.message || 'Connection ping from Terminal 6 Engine Hub.')
                .setColor(CONFIG.COLORS.PRIMARY)
                .setFooter({ text: `${CONFIG.STUDIO.NAME} // Verified Dispatch Ping` });
    }
}
