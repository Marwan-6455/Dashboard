import { Router, Request, Response } from 'express';
import { getDb } from '../db/connection.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { getChangesets, getUVCSProvider, recordChangeset } from '../services/uvcsService.js';
import { createTestReport } from '../services/testReportService.js';
import { recordActivity } from '../services/activityService.js';
import { getDiscordLinkByUserId, verifyLinkCode, unlinkDiscordAccount } from '../services/discordLinkService.js';
import { getOutboxStats, enqueueDiscordEvent } from '../services/discordOutboxService.js';
import { getReminderStats } from '../services/reminderScheduler.js';

export const integrationRouter = Router();

// 1. UVCS Provider Endpoints
integrationRouter.get('/uvcs/status', authMiddleware, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const status = await getUVCSProvider().getStatus();
  res.json({ uvcs: status });
});

integrationRouter.post('/uvcs/test', authMiddleware, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const result = await getUVCSProvider().testConnection();
  res.json({ result });
});

integrationRouter.get('/uvcs/changesets', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { taskId, author } = req.query;
  const changesets = getChangesets({
    taskId: taskId as string,
    author: author as string
  });
  res.json({ changesets });
});

integrationRouter.post('/uvcs/changesets', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { changesetId, repositoryId, branch, comment, author, affectedFiles, externalLink, taskId } = req.body;

  if (!changesetId || !comment || !author) {
    res.status(400).json({ error: 'Changeset ID, comment, and author are required.' });
    return;
  }

  const cs = recordChangeset(
    {
      changesetId,
      repositoryId,
      branch,
      comment,
      author,
      affectedFiles,
      externalLink,
      taskId
    },
    req.user!.id
  );

  res.status(201).json({ changeset: cs });
});

// 2. Unity Test Framework / CI Ingestion Endpoint
// Supports API Key authentication so CI or Unity editor can push test reports directly
integrationRouter.post('/unity-test-report', (req: Request, res: Response): void => {
  const db = getDb();
  const cfgStmt = db.prepare('SELECT value_json FROM integration_configs WHERE key = ?');
  const cfgRow = cfgStmt.get('unity_test_runner') as { value_json: string } | undefined;
  const config = cfgRow ? JSON.parse(cfgRow.value_json) : {};

  const apiKeyHeader = req.headers['x-api-key'] || req.query.apiKey;
  const expectedKey = config.apiToken || 'cm-test-ingest-token-t6-dev';

  if (!apiKeyHeader || apiKeyHeader !== expectedKey) {
    res.status(401).json({ error: 'Invalid or missing API key for test report ingestion.' });
    return;
  }

  const {
    taskId,
    repositoryId,
    revision,
    unityVersion,
    testSuite,
    result,
    passedCount,
    failedCount,
    skippedCount,
    buildResult,
    runnerIdentity,
    startTime,
    endTime
  } = req.body;

  if (!revision || !unityVersion || !testSuite || !result) {
    res.status(400).json({
      error: 'Missing required fields: revision, unityVersion, testSuite, and result are mandatory.'
    });
    return;
  }

  const report = createTestReport(
    {
      taskId: taskId || null,
      repositoryId: repositoryId || 'Terminal6-Main@cindermarch',
      revision,
      unityVersion,
      testSuite,
      result,
      passedCount: Number(passedCount) || 0,
      failedCount: Number(failedCount) || 0,
      skippedCount: Number(skippedCount) || 0,
      buildResult: buildResult || 'Success',
      runnerIdentity: runnerIdentity || 'Unity Test Framework CLI Runner',
      source: 'unity_ci',
      verificationState: 'automated_verified',
      startTime,
      endTime
    },
    null,
    db
  );

  res.status(201).json({
    message: 'Unity test report ingested and verified successfully.',
    report
  });
});

// 3. Discord Operations Bot & Webhook Integration Management
integrationRouter.get('/discord', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const cfgStmt = db.prepare('SELECT value_json FROM integration_configs WHERE key = ?');
  const cfgRow = cfgStmt.get('discord') as { value_json: string } | undefined;
  const webhookConfig = cfgRow ? JSON.parse(cfgRow.value_json) : { status: 'not_configured' };

  // Check bot credentials in environment (never expose token secret!)
  const botToken = process.env.DISCORD_BOT_TOKEN || '';
  const clientId = process.env.DISCORD_CLIENT_ID || '1560406066867478681';
  const guildId = process.env.DISCORD_GUILD_ID || '1394770347030483034';

  const hasBotToken = !!(botToken && botToken.trim().length > 20);
  const hasClientId = !!(clientId && clientId.trim().length > 5);
  const hasGuildId = !!(guildId && guildId.trim().length > 5);

  // Bot installation URL (Least privilege: Send Messages, Embed Links, Attach Files, Read History, Use Slash Commands)
  // Permissions integer 379968
  const inviteUrl = hasClientId
    ? `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=379968&scope=bot%20applications.commands`
    : null;

  // Operational state
  let botStatus: 'not_configured' | 'configured' | 'operational' | 'degraded' = 'not_configured';
  if (hasBotToken && hasClientId) {
    botStatus = 'operational';
  } else if (hasBotToken || hasClientId || webhookConfig.webhookUrl) {
    botStatus = 'configured';
  }

  // Guild config
  const guildConfig = db.prepare(`
    SELECT * FROM discord_guild_configs WHERE workspace_id = 'ws_cindermarch'
  `).get() as any;

  // Account link for caller
  const userLink = req.user ? getDiscordLinkByUserId(req.user.id, db) : null;

  // Outbox & Reminder Stats
  const outboxStats = getOutboxStats(db);
  const reminderStats = getReminderStats(db);

  res.json({
    bot: {
      status: botStatus,
      hasBotToken,
      hasClientId,
      hasGuildId,
      clientId: clientId || null,
      inviteUrl
    },
    userLink: userLink
      ? {
        isLinked: true,
        discordUsername: userLink.discord_username,
        discordUserId: userLink.discord_user_id,
        verifiedAt: userLink.verified_at
      }
      : { isLinked: false },
    guildConfig: guildConfig || null,
    outboxStats,
    reminderStats,
    webhook: webhookConfig
  });
});

// POST /api/integrations/discord/link/verify (User submits code from /link in Hub)
integrationRouter.post('/discord/link/verify', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Verification code is required.' });
    return;
  }

  const result = verifyLinkCode(req.user!.id, code.trim());
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }

  res.json({
    success: true,
    message: `Discord account @${result.link?.discord_username} successfully linked!`,
    link: result.link
  });
});

// POST /api/integrations/discord/link/unlink
integrationRouter.post('/discord/link/unlink', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const success = unlinkDiscordAccount(req.user!.id, req.user!.id);
  if (!success) {
    res.status(404).json({ error: 'No Discord account is currently linked to your profile.' });
    return;
  }
  res.json({ success: true, message: 'Discord account successfully unlinked.' });
});

// PATCH /api/integrations/discord/guild-config
integrationRouter.patch('/discord/guild-config', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const {
    guildId,
    guildName,
    announcementsChannelId,
    storyChannelId,
    codingChannelId,
    marketingChannelId,
    engineChannelId,
    artistsChannelId,
    soundChannelId,
    qaChannelId,
    escalationChannelId,
    reminderPolicy
  } = req.body;

  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO discord_guild_configs (
      id, workspace_id, guild_id, guild_name,
      announcements_channel_id, story_channel_id, coding_channel_id,
      marketing_channel_id, engine_channel_id, artists_channel_id, sound_channel_id,
      qa_channel_id, escalation_channel_id, reminder_policy_json, is_active, created_at, updated_at
    ) VALUES ('dgc_ws_cindermarch', 'ws_cindermarch', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(workspace_id) DO UPDATE SET
      guild_id = COALESCE(excluded.guild_id, guild_id),
      guild_name = COALESCE(excluded.guild_name, guild_name),
      announcements_channel_id = excluded.announcements_channel_id,
      story_channel_id = excluded.story_channel_id,
      coding_channel_id = excluded.coding_channel_id,
      marketing_channel_id = excluded.marketing_channel_id,
      engine_channel_id = excluded.engine_channel_id,
      artists_channel_id = excluded.artists_channel_id,
      sound_channel_id = excluded.sound_channel_id,
      qa_channel_id = excluded.qa_channel_id,
      escalation_channel_id = excluded.escalation_channel_id,
      reminder_policy_json = COALESCE(excluded.reminder_policy_json, reminder_policy_json),
      updated_at = excluded.updated_at
  `).run(
    guildId || '1394770347030483034',
    guildName || 'Cindermarch Studio Operations',
    announcementsChannelId || null,
    storyChannelId || null,
    codingChannelId || null,
    marketingChannelId || null,
    engineChannelId || null,
    artistsChannelId || null,
    soundChannelId || null,
    qaChannelId || null,
    escalationChannelId || null,
    reminderPolicy ? JSON.stringify(reminderPolicy) : null,
    now,
    now
  );

  // Also update team channel mappings on teams table
  const channelUpdates = [
    { teamId: 'team_story', channelId: storyChannelId },
    { teamId: 'team_coding', channelId: codingChannelId },
    { teamId: 'team_marketing', channelId: marketingChannelId },
    { teamId: 'team_engine', channelId: engineChannelId },
    { teamId: 'team_3d_artists', channelId: artistsChannelId },
    { teamId: 'team_sound', channelId: soundChannelId }
  ];

  for (const cu of channelUpdates) {
    if (cu.channelId !== undefined) {
      db.prepare('UPDATE teams SET discord_channel_id = ?, updated_at = ? WHERE id = ?').run(
        cu.channelId || null,
        now,
        cu.teamId
      );
    }
  }

  const updated = db.prepare("SELECT * FROM discord_guild_configs WHERE workspace_id = 'ws_cindermarch'").get();
  res.json({ guildConfig: updated });
});

// POST /api/integrations/discord/dispatch-test (Queue a test announcement)
integrationRouter.post('/discord/dispatch-test', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDb();
  const event = enqueueDiscordEvent(
    'test_ping',
    {
      message: `Cindermarch Operations Bot connection test dispatched from Engine Hub by ${req.user!.display_name} (${req.user!.username}).`,
      sender: req.user!.display_name,
      timestamp: new Date().toISOString()
    },
    'announcements',
    null,
    'ws_cindermarch',
    db
  );

  // If webhook is also configured, send immediately to webhook
  const cfgStmt = db.prepare('SELECT value_json FROM integration_configs WHERE key = ?');
  const cfgRow = cfgStmt.get('discord') as { value_json: string } | undefined;
  const webhookConfig = cfgRow ? JSON.parse(cfgRow.value_json) : null;

  let webhookResult: any = null;
  if (webhookConfig?.webhookUrl && webhookConfig.webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    try {
      const fetchRes = await fetch(webhookConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `**[Cindermarch Operations Bot // Test Ping]**\nVerified dispatch from Terminal 6 Development Hub by **${req.user!.display_name}**.`
        })
      });
      webhookResult = { delivered: fetchRes.ok, status: fetchRes.status };
    } catch (err: any) {
      webhookResult = { delivered: false, error: err.message };
    }
  }

  res.json({
    queued: true,
    outboxEventId: event.id,
    webhookResult,
    message: 'Test event queued in Discord outbox and dispatched to configured endpoints.'
  });
});

// POST /api/integrations/discord/test (Legacy Webhook test compatibility)
integrationRouter.post('/discord/test', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { webhookUrl } = req.body;

  if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
    res.json({
      connected: false,
      status: 'not_configured',
      message: 'Discord webhook URL is not configured or invalid. Enter a valid Discord webhook URL to test connection.'
    });
    return;
  }

  try {
    const fetchRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `**[Cindermarch Engine Hub]** Connection test verified from Terminal 6 Development Hub by ${req.user!.display_name}.`
      })
    });

    if (fetchRes.ok) {
      res.json({
        connected: true,
        status: 'connected',
        message: 'Discord test ping sent successfully.'
      });
    } else {
      res.json({
        connected: false,
        status: 'error',
        message: `Discord rejected webhook: HTTP ${fetchRes.status}`
      });
    }
  } catch (err: any) {
    res.json({
      connected: false,
      status: 'error',
      message: `Failed to reach Discord: ${err.message}`
    });
  }
});

integrationRouter.patch('/discord', authMiddleware, (req: AuthenticatedRequest, res: Response): void => {
  const { webhookUrl, channel, notifyOnReview, notifyOnComplete, notifyOnFailedTest } = req.body;
  const db = getDb();
  const now = new Date().toISOString();

  const status = webhookUrl && webhookUrl.startsWith('https://discord.com/') ? 'configured' : 'not_configured';

  const updatedConfig = {
    status,
    webhookUrl: webhookUrl || '',
    channel: channel || '#t6-dev-alerts',
    notifyOnReview: !!notifyOnReview,
    notifyOnComplete: !!notifyOnComplete,
    notifyOnFailedTest: !!notifyOnFailedTest,
    notes: status === 'configured' ? 'Webhook configured.' : 'Discord webhook not configured.'
  };

  db.prepare(`
    INSERT INTO integration_configs (key, value_json, updated_at)
    VALUES ('discord', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `).run(JSON.stringify(updatedConfig), now);

  res.json({ discord: updatedConfig });
});
