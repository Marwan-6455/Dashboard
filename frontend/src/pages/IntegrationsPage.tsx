import React, { useState, useEffect } from 'react';
import {
  GitCommit,
  FileText,
  MessageSquare,
  Terminal,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Link as LinkIcon,
  Unlink,
  Clock,
  Send,
  ExternalLink,
  ShieldCheck,
  Bell
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useToast } from '../context/ToastContext.js';

export const IntegrationsPage: React.FC = () => {
  const toast = useToast();
  const [uvcsStatus, setUvcsStatus] = useState<any>(null);
  const [discordData, setDiscordData] = useState<any>(null);
  const [isTestingUVCS, setIsTestingUVCS] = useState(false);
  const [uvcsTestResult, setUvcsTestResult] = useState<any>(null);

  // Bot & Channel Mappings State
  const [guildId, setGuildId] = useState('1394770347030483034');
  const [guildName, setGuildName] = useState('Cindermarch Studio');
  const [announcementsChannel, setAnnouncementsChannel] = useState('');
  const [storyChannel, setStoryChannel] = useState('');
  const [codingChannel, setCodingChannel] = useState('');
  const [marketingChannel, setMarketingChannel] = useState('');
  const [engineChannel, setEngineChannel] = useState('');
  const [artistsChannel, setArtistsChannel] = useState('');
  const [soundChannel, setSoundChannel] = useState('');
  const [qaChannel, setQaChannel] = useState('');
  const [escalationChannel, setEscalationChannel] = useState('');
  const [isSavingChannels, setIsSavingChannels] = useState(false);

  // Account Linking State
  const [linkCodeInput, setLinkCodeInput] = useState('');
  const [isVerifyingLink, setIsVerifyingLink] = useState(false);
  const [linkMessage, setLinkMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Test Dispatch State
  const [isDispatchingTest, setIsDispatchingTest] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  // Webhook State (legacy compatibility)
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState<any>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  const fetchIntegrations = async () => {
    try {
      const uvcsRes = await apiRequest('/api/integrations/uvcs/status');
      setUvcsStatus(uvcsRes.uvcs);

      const discRes = await apiRequest('/api/integrations/discord');
      setDiscordData(discRes);

      if (discRes.guildConfig) {
        setGuildId(discRes.guildConfig.guild_id || '1394770347030483034');
        setGuildName(discRes.guildConfig.guild_name || 'Cindermarch Studio');
        setAnnouncementsChannel(discRes.guildConfig.announcements_channel_id || '');
        setStoryChannel(discRes.guildConfig.story_channel_id || '');
        setCodingChannel(discRes.guildConfig.coding_channel_id || '');
        setMarketingChannel(discRes.guildConfig.marketing_channel_id || '');
        setEngineChannel(discRes.guildConfig.engine_channel_id || '');
        setArtistsChannel(discRes.guildConfig.artists_channel_id || '');
        setSoundChannel(discRes.guildConfig.sound_channel_id || '');
        setQaChannel(discRes.guildConfig.qa_channel_id || '');
        setEscalationChannel(discRes.guildConfig.escalation_channel_id || '');
      }

      setWebhookUrl(discRes.webhook?.webhookUrl || '');
    } catch (err) {
      console.error('Failed to load integrations:', err);
    }
  };

  useEffect(() => {
    // Check if URL has linkCode parameter (e.g. redirected from Discord)
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('linkCode');
    if (codeParam) {
      setLinkCodeInput(codeParam);
    }
    fetchIntegrations();
  }, []);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkCodeInput.trim()) return;

    setIsVerifyingLink(true);
    setLinkMessage(null);
    try {
      const res = await apiRequest('/api/integrations/discord/link/verify', {
        method: 'POST',
        body: JSON.stringify({ code: linkCodeInput.trim() })
      });
      setLinkMessage({ text: res.message, type: 'success' });
      setLinkCodeInput('');
      fetchIntegrations();
    } catch (err: any) {
      setLinkMessage({ text: err.message, type: 'error' });
    } finally {
      setIsVerifyingLink(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Are you sure you want to unlink your Discord account?')) return;
    try {
      const res = await apiRequest('/api/integrations/discord/link/unlink', { method: 'POST' });
      toast.success(res.message);
      fetchIntegrations();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSaveChannels = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingChannels(true);
    try {
      await apiRequest('/api/integrations/discord/guild-config', {
        method: 'PATCH',
        body: JSON.stringify({
          guildId: guildId.trim(),
          guildName: guildName.trim(),
          announcementsChannelId: announcementsChannel.trim(),
          storyChannelId: storyChannel.trim(),
          codingChannelId: codingChannel.trim(),
          marketingChannelId: marketingChannel.trim(),
          engineChannelId: engineChannel.trim(),
          artistsChannelId: artistsChannel.trim(),
          soundChannelId: soundChannel.trim(),
          qaChannelId: qaChannel.trim(),
          escalationChannelId: escalationChannel.trim(),
          reminderPolicy: {
            timezone: 'Africa/Cairo',
            deadline24h: true,
            deadline2h: true,
            deadlineDue: true,
            overdueDaily: true,
            escalationEnabled: true
          }
        })
      });
      toast.success('Discord guild & 6-team channel mappings saved successfully.');
      fetchIntegrations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingChannels(false);
    }
  };

  const handleDispatchTest = async () => {
    setIsDispatchingTest(true);
    setDispatchResult(null);
    try {
      const res = await apiRequest('/api/integrations/discord/dispatch-test', { method: 'POST' });
      setDispatchResult(res);
      toast.success('Test notification dispatched to Discord outbox.');
      fetchIntegrations();
    } catch (err: any) {
      setDispatchResult({ queued: false, message: err.message });
      toast.error(`Dispatch failed: ${err.message}`);
    } finally {
      setIsDispatchingTest(false);
    }
  };

  const handleTestUVCS = async () => {
    setIsTestingUVCS(true);
    setUvcsTestResult(null);
    try {
      const res = await apiRequest('/api/integrations/uvcs/test', { method: 'POST' });
      setUvcsTestResult(res.result);
      toast.success('UVCS connection test completed.');
    } catch (err: any) {
      setUvcsTestResult({ status: 'error', message: err.message });
      toast.error(`UVCS test error: ${err.message}`);
    } finally {
      setIsTestingUVCS(false);
    }
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingWebhook(true);
    try {
      await apiRequest('/api/integrations/discord', {
        method: 'PATCH',
        body: JSON.stringify({
          webhookUrl: webhookUrl.trim(),
          notifyOnReview: true,
          notifyOnComplete: true,
          notifyOnFailedTest: true
        })
      });
      toast.success('Discord webhook configuration saved.');
      fetchIntegrations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    setIsTestingWebhook(true);
    setWebhookTestResult(null);
    try {
      const res = await apiRequest('/api/integrations/discord/test', {
        method: 'POST',
        body: JSON.stringify({ webhookUrl })
      });
      setWebhookTestResult(res);
    } catch (err: any) {
      setWebhookTestResult({ connected: false, message: err.message });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const botConfig = discordData?.bot || {};
  const userLink = discordData?.userLink || { isLinked: false };
  const outboxStats = discordData?.outboxStats || { pending: 0, delivered: 0, failed: 0 };
  const reminderStats = discordData?.reminderStats || { pending: 0, sent: 0, cancelled: 0 };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h1>Cindermarch Studio // External Integrations & Operations Bot</h1>
          <p>Cindermarch Operations Discord Bot, Unity Version Control (Plastic SCM), and UTF CI test ingestion.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', marginBottom: '24px' }}>
        {/* ========================================================================= */}
        {/* 1. MAIN DISCORD OPERATIONS BOT CARD */}
        {/* ========================================================================= */}
        <div className="card" style={{ border: '1px solid rgba(255, 87, 34, 0.4)' }}>
          <div className="card-header" style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bot size={22} color="var(--accent-orange)" />
              <div>
                <span style={{ fontSize: '16px', fontWeight: 600 }}>Cindermarch Operations Bot</span>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 400 }}>
                  Real-time two-way synchronization, slash commands, durable reminders & six team channels
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                className={`badge ${
                  botConfig.status === 'operational'
                    ? 'badge-verified-complete'
                    : botConfig.status === 'configured'
                    ? 'badge-ready-for-review'
                    : 'badge-backlog'
                }`}
              >
                {botConfig.status ? botConfig.status.toUpperCase() : 'CHECKING...'}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginTop: '16px' }}>
            {/* Column A: Bot Credentials & Invite URL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                Bot Identity & Installation
              </h3>
              <div style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)', fontSize: '12.5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Bot Token:</span>
                  <strong>{botConfig.hasBotToken ? 'Configured securely in .env' : 'Missing (set DISCORD_BOT_TOKEN)'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Application / Client ID:</span>
                  <span className="mono">{botConfig.clientId || '1560406066867478681'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Allowed Server (Guild) ID:</span>
                  <span className="mono">{guildId || '1394770347030483034'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Default Timezone:</span>
                  <span className="mono">Africa/Cairo</span>
                </div>

                {botConfig.inviteUrl ? (
                  <a
                    href={botConfig.inviteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: '6px' }}
                  >
                    <ExternalLink size={14} />
                    Invite Bot to Discord Server
                  </a>
                ) : (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Configure DISCORD_CLIENT_ID in .env to generate the instant server installation URL.
                  </div>
                )}
              </div>

              {/* Account Linking Panel */}
              <div style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <LinkIcon size={16} color="var(--accent-orange)" />
                  <strong style={{ fontSize: '13px' }}>Your Discord Account Link</strong>
                </div>

                {userLink.isLinked ? (
                  <div>
                    <div style={{ fontSize: '12.5px', marginBottom: '10px' }}>
                      Linked to Discord user: <strong className="mono" style={{ color: 'var(--accent-orange)' }}>@{userLink.discordUsername}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        ID: {userLink.discordUserId} • Verified: {new Date(userLink.verifiedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={handleUnlink} style={{ display: 'flex', gap: '6px' }}>
                      <Unlink size={13} />
                      Unlink Discord Account
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleVerifyCode}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Run <code className="mono">/link</code> in Discord to get your 6-character code, then enter it below:
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-control mono"
                        placeholder="e.g. 8F2K9A"
                        maxLength={8}
                        value={linkCodeInput}
                        onChange={(e) => setLinkCodeInput(e.target.value.toUpperCase())}
                        style={{ maxWidth: '140px', textTransform: 'uppercase' }}
                      />
                      <button type="submit" className="btn btn-primary btn-sm" disabled={isVerifyingLink || !linkCodeInput.trim()}>
                        {isVerifyingLink ? 'Verifying...' : 'Link Account'}
                      </button>
                    </div>
                    {linkMessage && (
                      <div
                        className={`alert ${linkMessage.type === 'success' ? 'alert-success' : 'alert-error'}`}
                        style={{ fontSize: '11px', marginTop: '8px', padding: '6px 10px' }}
                      >
                        {linkMessage.text}
                      </div>
                    )}
                  </form>
                )}
              </div>
            </div>

            {/* Column B: Channel Mappings for All 6 Teams */}
            <div>
              <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '12px' }}>
                Server & Six Team Channel Mappings
              </h3>
              <form onSubmit={handleSaveChannels} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>Server ID (Guild)</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="1394770347030483034"
                      value={guildId}
                      onChange={(e) => setGuildId(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>Server Name</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Cindermarch Studio"
                      value={guildName}
                      onChange={(e) => setGuildName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '11px' }}>📢 Studio Announcements Channel ID</label>
                  <input
                    type="text"
                    className="form-control mono"
                    placeholder="Enter Discord Channel ID"
                    value={announcementsChannel}
                    onChange={(e) => setAnnouncementsChannel(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>📖 Story Team Channel ID</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="Channel ID"
                      value={storyChannel}
                      onChange={(e) => setStoryChannel(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>💻 Coding Team Channel ID</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="Channel ID"
                      value={codingChannel}
                      onChange={(e) => setCodingChannel(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>📣 Marketing Team Channel ID</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="Channel ID"
                      value={marketingChannel}
                      onChange={(e) => setMarketingChannel(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>⚙️ Engine Team Channel ID</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="Channel ID"
                      value={engineChannel}
                      onChange={(e) => setEngineChannel(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>🎨 3D Artists Channel ID</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="Channel ID"
                      value={artistsChannel}
                      onChange={(e) => setArtistsChannel(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>🎵 Sound Team Channel ID</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="Channel ID"
                      value={soundChannel}
                      onChange={(e) => setSoundChannel(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>🧪 QA & Build Reports Channel</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="Channel ID"
                      value={qaChannel}
                      onChange={(e) => setQaChannel(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>🛑 Escalation / Blockers Channel</label>
                    <input
                      type="text"
                      className="form-control mono"
                      placeholder="Channel ID"
                      value={escalationChannel}
                      onChange={(e) => setEscalationChannel(e.target.value)}
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-secondary btn-sm" disabled={isSavingChannels} style={{ alignSelf: 'flex-start', marginTop: '6px' }}>
                  {isSavingChannels ? 'Saving Mappings...' : 'Save All Channel Mappings'}
                </button>
              </form>
            </div>

            {/* Column C: Outbox & Reminder Observability */}
            <div>
              <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: '12px' }}>
                Delivery Engine & Queue Health
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>OUTBOX QUEUE</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-orange)', marginTop: '2px' }}>
                    {outboxStats.pending} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-secondary)' }}>pending</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Delivered: <strong>{outboxStats.delivered}</strong> • Failed: <strong>{outboxStats.failed}</strong>
                  </div>
                </div>

                <div style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '10px', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <Clock size={12} />
                    <span>REMINDERS</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-white)', marginTop: '2px' }}>
                    {reminderStats.pending} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-secondary)' }}>scheduled</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Sent: <strong>{reminderStats.sent}</strong> • Cancelled: <strong>{reminderStats.cancelled}</strong>
                  </div>
                </div>
              </div>

              {/* Test Notification Dispatch Button */}
              <div style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Queue a live verification announcement to the configured Discord Announcements channel.
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleDispatchTest}
                  disabled={isDispatchingTest}
                  style={{ display: 'flex', gap: '6px' }}
                >
                  <Send size={13} />
                  {isDispatchingTest ? 'Queueing Dispatch...' : 'Send Live Test Announcement'}
                </button>

                {dispatchResult && (
                  <div
                    className={`alert ${dispatchResult.queued ? 'alert-success' : 'alert-error'}`}
                    style={{ fontSize: '11.5px', marginTop: '10px', padding: '8px 10px' }}
                  >
                    {dispatchResult.message}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. OTHER INTEGRATIONS (UVCS, UTF CI, WEBHOOK FALLBACK, UNITY EDITOR EXT) */}
      {/* ========================================================================= */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px' }}>
        {/* UVCS Provider Card */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <GitCommit size={18} color="var(--accent-orange)" />
              <span>Unity Version Control (Plastic SCM)</span>
            </div>
            <span className="badge badge-ready-for-review">
              {uvcsStatus?.status === 'manual_mode' ? 'MANUAL MODE' : 'NOT CONNECTED'}
            </span>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            The studio uses Unity Version Control. Operating in <strong>manual changeset mode</strong>. Changeset references are linked by developers to provide verifiable commit history.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', marginBottom: '20px' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Target Repository:</span>{' '}
              <strong className="mono">Terminal6-Main@cindermarch</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Server Endpoint:</span>{' '}
              <span className="mono">https://cloud.plasticscm.com</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Provider Interface:</span>{' '}
              <span className="mono">ManualUVCSProvider (IUVCSProvider)</span>
            </div>
          </div>

          {uvcsTestResult && (
            <div
              className={`alert ${uvcsTestResult.status === 'connected_and_verified' ? 'alert-success' : 'alert-warning'}`}
              style={{ fontSize: '12px' }}
            >
              <div>
                <strong>Connection Test Result:</strong> {uvcsTestResult.message}
                {uvcsTestResult.errorDetail && (
                  <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                    {uvcsTestResult.errorDetail}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleTestUVCS}
              disabled={isTestingUVCS}
            >
              <RefreshCw size={14} className={isTestingUVCS ? 'spin' : ''} />
              {isTestingUVCS ? 'Testing Provider...' : 'Test UVCS Connection'}
            </button>
          </div>
        </div>

        {/* Unity Test Framework Ingestion */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <FileText size={18} color="var(--status-complete)" />
              <span>Unity Test Framework / CI Ingestion</span>
            </div>
            <span className="badge badge-verified-complete">API READY</span>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Automated ingestion endpoint ready to receive UTF test runner results from local batchmode runs or CI build jobs.
          </div>

          <div style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              INGESTION ENDPOINT:
            </div>
            <div className="mono" style={{ fontSize: '12px', color: 'var(--accent-orange)' }}>
              POST /api/integrations/unity-test-report
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', marginBottom: '4px', textTransform: 'uppercase' }}>
              HEADER AUTHENTICATION:
            </div>
            <div className="mono" style={{ fontSize: '12px', color: 'var(--text-white)' }}>
              x-api-key: cm-test-ingest-token-t6-dev
            </div>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>Sample UTF Batchmode Execution:</strong>
            <pre
              className="mono"
              style={{
                backgroundColor: 'var(--bg-black)',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                marginTop: '6px',
                fontSize: '11px',
                overflowX: 'auto',
                border: '1px solid var(--border-subtle)'
              }}
            >
{`Unity.exe -batchmode -runTests -testResults results.xml \\
  -projectPath . -testPlatform PlayMode`}
            </pre>
          </div>
        </div>

        {/* Webhook Fallback Compatibility */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <MessageSquare size={18} color="#5865F2" />
              <span>Discord Incoming Webhook (Fallback)</span>
            </div>
            <span className={`badge ${discordData?.webhook?.status === 'configured' ? 'badge-verified-complete' : 'badge-backlog'}`}>
              {discordData?.webhook?.status === 'configured' ? 'CONFIGURED' : 'NOT CONFIGURED'}
            </span>
          </div>

          <form onSubmit={handleSaveWebhook}>
            <div className="form-group">
              <label className="form-label">Discord Incoming Webhook URL</label>
              <input
                type="url"
                className="form-control mono"
                placeholder="https://discord.com/api/webhooks/..."
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>

            {webhookTestResult && (
              <div
                className={`alert ${webhookTestResult.connected ? 'alert-success' : 'alert-error'}`}
                style={{ fontSize: '12px', marginBottom: '14px' }}
              >
                {webhookTestResult.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleTestWebhook}
                disabled={isTestingWebhook}
              >
                {isTestingWebhook ? 'Pinging Webhook...' : 'Test Webhook Ping'}
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={isSavingWebhook}>
                {isSavingWebhook ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>

        {/* Future Unity Editor Extension */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Terminal size={18} color="var(--text-white)" />
              <span>Future Unity Editor Extension (C#)</span>
            </div>
            <span className="badge badge-backlog">FUTURE INTEGRATION</span>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            A planned custom C# Unity EditorWindow extension will allow Cindermarch Studio developers and team managers to review assigned tasks, inspect completion gates, and attach changesets directly from inside Unity 6 without switching windows.
          </div>

          <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Status: Architecture prepared. REST endpoints ready for authentication tokens. Editor script to be implemented after dashboard stabilization.
          </div>
        </div>
      </div>
    </div>
  );
};
