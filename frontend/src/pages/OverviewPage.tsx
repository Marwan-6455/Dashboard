import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  AlertCircle,
  FileCheck2,
  FileText,
  Clock,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  AlertTriangle,
  Plus,
  Users,
  Layers,
  Library,
  BookOpen,
  Code,
  Megaphone,
  Cpu,
  Volume2,
  Activity,
  CheckCircle2,
  RefreshCw,
  FolderKanban,
  Bug,
  Rocket
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge.js';
import { PriorityBadge } from '../components/PriorityBadge.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';

interface OverviewPageProps {
  onNavigate: (page: string, params?: any) => void;
  onOpenNewTaskModal: () => void;
}

// Icon helper for six teams
const getTeamIcon = (slugOrName: string) => {
  const s = slugOrName.toLowerCase();
  if (s.includes('story')) return <BookOpen size={16} color="#FF9800" />;
  if (s.includes('coding')) return <Code size={16} color="#00E5FF" />;
  if (s.includes('marketing')) return <Megaphone size={16} color="#E91E63" />;
  if (s.includes('engine')) return <Cpu size={16} color="#FF5722" />;
  if (s.includes('artist') || s.includes('3d')) return <Layers size={16} color="#9C27B0" />;
  if (s.includes('sound') || s.includes('audio')) return <Volume2 size={16} color="#4CAF50" />;
  return <Users size={16} color="var(--accent-orange)" />;
};

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate, onOpenNewTaskModal }) => {
  const { user, activeProjectId } = useAuth();
  const [data, setData] = useState<any>(null);
  const [myStrikes, setMyStrikes] = useState<any>(null);
  const [terminalHealth, setTerminalHealth] = useState<any>(null);
  const [eclipsedHealth, setEclipsedHealth] = useState<any>(null);
  const [activeBugs, setActiveBugs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [statsRes, strikeRes, t6Res, eclRes, bugsRes] = await Promise.allSettled([
        apiRequest('/api/stats/overview'),
        apiRequest('/api/strikes/my-status'),
        apiRequest('/api/projects/terminal-6/health'),
        apiRequest('/api/projects/eclipsed/health'),
        apiRequest('/api/bugs?status=Reported')
      ]);

      if (statsRes.status === 'fulfilled') {
        setData(statsRes.value);
      } else {
        throw statsRes.reason;
      }

      if (strikeRes.status === 'fulfilled') {
        setMyStrikes(strikeRes.value);
      }
      if (t6Res.status === 'fulfilled') {
        setTerminalHealth(t6Res.value);
      }
      if (eclRes.status === 'fulfilled') {
        setEclipsedHealth(eclRes.value);
      }
      if (bugsRes.status === 'fulfilled') {
        setActiveBugs(bugsRes.value.bugs || []);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getRelativeDeadline = (deadlineStr: string) => {
    const now = new Date().getTime();
    const due = new Date(deadlineStr).getTime();
    const diffHours = Math.round((due - now) / (1000 * 60 * 60));

    if (diffHours < 0) {
      const overdueDays = Math.abs(Math.floor(diffHours / 24));
      return {
        label: overdueDays === 0 ? `${Math.abs(diffHours)}h overdue` : `${overdueDays}d overdue`,
        severity: 'critical' as const
      };
    }
    if (diffHours <= 24) {
      return {
        label: diffHours === 0 ? 'Due now' : `Due in ${diffHours}h`,
        severity: 'warning' as const
      };
    }
    const days = Math.round(diffHours / 24);
    return {
      label: `Due in ${days}d`,
      severity: 'normal' as const
    };
  };

  if (isLoading) {
    return (
      <div className="page-wrapper">
        <div style={{ color: 'var(--text-secondary)', padding: '60px 0', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '2px solid var(--accent-orange)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '16px' }} />
          <div>Synchronizing {activeProjectId === 'eclipsed' ? 'Eclipsed' : 'Terminal 6'} Studio Command Center...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="page-wrapper">
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>Error loading dashboard metrics: {error}</span>
        </div>
        <button className="btn btn-secondary" onClick={loadData}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const { metrics, workload, upcomingDeadlines, recentReviews, recentReports, recentActivity, integrations } = data;
  const teamWorkloads = data.teamWorkloads || [];

  const timezone = data?.policy?.timezone || 'Africa/Cairo';
  const todayFormatted = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date());

  return (
    <div className="page-wrapper">
      {/* Personalized Studio Command Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '20px 24px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: 'var(--accent-orange)',
                textTransform: 'uppercase'
              }}
            >
              COMMAND CENTER // {activeProjectId === 'eclipsed' ? 'ECLIPSED' : 'TERMINAL 6'}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {todayFormatted} ({timezone})
            </span>
          </div>

          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-white)', letterSpacing: '-0.02em' }}>
            Welcome back, {user?.displayName || 'Developer'}
          </h1>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Role: <strong style={{ color: 'var(--text-white)' }}>{user?.roles?.join(' • ') || 'Developer'}</strong> • Six Dedicated Studio Teams Active
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={loadData} title="Refresh Live Metrics">
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('reviews')}>
            <FileCheck2 size={13} /> Review Queue ({metrics.awaitingReview})
          </button>
          <button className="btn btn-primary btn-sm" onClick={onOpenNewTaskModal}>
            <Plus size={14} /> New Task
          </button>
        </div>
      </div>

      {/* Active Strike Personalized Warning Banner */}
      {myStrikes && myStrikes.activeStrikes > 0 && (
        <div
          style={{
            marginBottom: '20px',
            padding: '16px 20px',
            backgroundColor:
              myStrikes.activeStrikes >= 4 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
            border: `1px solid ${
              myStrikes.activeStrikes >= 4 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'
            }`,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor:
                  myStrikes.activeStrikes >= 4 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: myStrikes.activeStrikes >= 4 ? '#EF4444' : '#F59E0B'
              }}
            >
              <AlertTriangle size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: myStrikes.activeStrikes >= 4 ? '#EF4444' : '#F59E0B'
                  }}
                >
                  {myStrikes.activeStrikes >= 4 ? 'CRITICAL DISCIPLINARY ALERT' : 'DEADLINE ACCOUNTABILITY NOTICE'}
                </span>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor:
                      myStrikes.activeStrikes >= 4 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: myStrikes.activeStrikes >= 4 ? '#EF4444' : '#F59E0B'
                  }}
                >
                  {myStrikes.activeStrikes} OF {myStrikes.maxThreshold || 5} STRIKES ({myStrikes.remainingStrikes} REMAINING)
                </span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-white)' }}>
                {myStrikes.activeStrikes >= 4
                  ? 'FINAL WARNING: One more qualifying missed deadline will immediately trigger automatic workspace suspension.'
                  : `You currently have ${myStrikes.activeStrikes} active deadline strike(s). Keep upcoming milestone deliverables on track.`}
              </div>
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate('strikes')}
            style={{
              borderColor: myStrikes.activeStrikes >= 4 ? '#EF4444' : '#F59E0B',
              color: myStrikes.activeStrikes >= 4 ? '#EF4444' : '#F59E0B'
            }}
          >
            Review Strike Details <ArrowRight size={13} style={{ marginLeft: '4px' }} />
          </button>
        </div>
      )}

      {/* Integration Status Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '24px',
          padding: '12px 18px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>UVCS Provider:</span>
            <span className="badge badge-ready-for-review">
              {integrations.uvcs.status === 'manual_mode' ? 'MANUAL MODE' : integrations.uvcs.status}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Unity Test Ingestion:</span>
            <span className="badge badge-verified-complete">API READY</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Discord Operations Bot:</span>
            <span
              className={`badge ${
                integrations.discord?.status === 'configured' || integrations.discord?.status === 'operational'
                  ? 'badge-verified-complete'
                  : 'badge-backlog'
              }`}
            >
              {integrations.discord?.status === 'configured' || integrations.discord?.status === 'operational'
                ? 'CONFIGURED (TOKEN READY)'
                : 'NOT CONFIGURED'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Strike Policy:</span>
            <span
              className={`badge ${
                data.disciplinary?.suspendedMembersCount > 0
                  ? 'badge-blocked'
                  : (data.disciplinary?.activeStrikesCount || 0) > 0
                  ? 'badge-changes-requested'
                  : 'badge-verified-complete'
              }`}
              style={{ cursor: 'pointer' }}
              onClick={() => onNavigate('strikes')}
              title="Click to view Studio Disciplinary Governance"
            >
              5-STRIKES AUTO-SUSPEND ({(data.disciplinary?.activeStrikesCount || 0)} ACTIVE)
            </span>
          </div>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigate('integrations')}
          style={{ fontSize: '11.5px' }}
        >
          View Integrations <ExternalLink size={12} />
        </button>
      </div>

      {/* Six Metric Cards */}
      <div className="metrics-grid">
        <div
          className="metric-card accent-orange"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('tasks')}
        >
          <div className="metric-label">Open Tasks</div>
          <div className="metric-value">{metrics.openTasks}</div>
          <div className="metric-sub">{metrics.totalTasks} total tasks in studio</div>
        </div>

        <div
          className="metric-card accent-blue"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('tasks', { filterStatus: 'In Progress' })}
        >
          <div className="metric-label">In Progress</div>
          <div className="metric-value">{metrics.inProgress}</div>
          <div className="metric-sub">Active engineering focus</div>
        </div>

        <div
          className="metric-card accent-amber"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('reviews')}
        >
          <div className="metric-label">Awaiting Review</div>
          <div className="metric-value">{metrics.awaitingReview}</div>
          <div className="metric-sub">{metrics.changesRequested} changes requested</div>
        </div>

        <div
          className="metric-card accent-green"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('tasks', { filterStatus: 'Verified Complete' })}
        >
          <div className="metric-label">Verified Complete</div>
          <div className="metric-value">{metrics.verifiedComplete}</div>
          <div className="metric-sub">Passed all 6 completion gates</div>
        </div>

        <div
          className="metric-card accent-red"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('tasks', { filterStatus: 'Blocked' })}
        >
          <div className="metric-label">Blocked Tasks</div>
          <div className="metric-value">{metrics.blocked}</div>
          <div className="metric-sub">{metrics.failedTests} failed test report(s)</div>
        </div>

        <div
          className="metric-card"
          style={{
            cursor: 'pointer',
            borderLeft: myStrikes?.activeStrikes > 0 ? '4px solid #EF4444' : '4px solid var(--border-strong)'
          }}
          onClick={() => onNavigate('strikes')}
        >
          <div className="metric-label">My Disciplinary Strikes</div>
          <div
            className="metric-value"
            style={{ color: myStrikes?.activeStrikes > 0 ? '#EF4444' : 'var(--text-white)' }}
          >
            {myStrikes?.activeStrikes || 0} / {myStrikes?.maxThreshold || 5}
          </div>
          <div className="metric-sub">
            {myStrikes?.activeStrikes === 0
              ? 'Clean disciplinary record'
              : `${myStrikes?.remainingStrikes || 0} strikes until suspension`}
          </div>
        </div>
      </div>

      {/* Project Portfolio // Health & Telemetry */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <FolderKanban size={17} color="var(--accent-orange)" />
            <span>Studio Production Portfolio // Health & QA Signals</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('projects')}>
            Open Project HQ <ArrowRight size={13} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginBottom: '14px' }}>
          {/* Terminal 6 Card */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
            onClick={() => onNavigate('projects')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--accent-orange)', letterSpacing: '0.05em' }}>
                  PROJECT T6
                </span>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-white)', margin: '2px 0 0' }}>
                  Terminal 6
                </h4>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  backgroundColor:
                    (terminalHealth?.health === 'healthy' || terminalHealth?.status === 'Healthy')
                      ? 'rgba(16, 185, 129, 0.15)'
                      : (terminalHealth?.health === 'blocked' || terminalHealth?.status === 'Blocked')
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(245, 158, 11, 0.15)',
                  color:
                    (terminalHealth?.health === 'healthy' || terminalHealth?.status === 'Healthy')
                      ? '#10B981'
                      : (terminalHealth?.health === 'blocked' || terminalHealth?.status === 'Blocked')
                      ? '#EF4444'
                      : '#F59E0B',
                  border: `1px solid ${
                    (terminalHealth?.health === 'healthy' || terminalHealth?.status === 'Healthy')
                      ? 'rgba(16, 185, 129, 0.3)'
                      : (terminalHealth?.health === 'blocked' || terminalHealth?.status === 'Blocked')
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'rgba(245, 158, 11, 0.3)'
                  }`
                }}
              >
                {((terminalHealth?.health || terminalHealth?.status) || 'CALCULATING').toUpperCase().replace('_', ' ')}
              </span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', height: '34px', overflow: 'hidden' }}>
              Psychological horror narrative in an abandoned metro transit facility. Unity 2022.3 LTS.
            </p>

            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              {terminalHealth?.reasons?.length > 0 ? (
                <div style={{ color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} />
                  <span>{terminalHealth.reasons[0]}</span>
                </div>
              ) : (
                <div style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} />
                  <span>Milestone progress on schedule, zero release blockers.</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
              <span>Critical Bugs: <strong style={{ color: (terminalHealth?.metrics?.criticalBugs || 0) > 0 ? '#EF4444' : 'var(--text-white)' }}>{terminalHealth?.metrics?.criticalBugs || 0}</strong></span>
              <span>Blocked Tasks: <strong style={{ color: (terminalHealth?.metrics?.blockedTasks || 0) > 0 ? '#EF4444' : 'var(--text-white)' }}>{terminalHealth?.metrics?.blockedTasks || 0}</strong></span>
              <span>Overdue: <strong style={{ color: 'var(--text-white)' }}>{terminalHealth?.metrics?.overdueTasks || 0}</strong></span>
            </div>
          </div>

          {/* Eclipsed Card */}
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
            onClick={() => onNavigate('projects')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#A855F7', letterSpacing: '0.05em' }}>
                  PROJECT ECL
                </span>
                <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-white)', margin: '2px 0 0' }}>
                  Eclipsed
                </h4>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  backgroundColor:
                    (eclipsedHealth?.health === 'healthy' || eclipsedHealth?.status === 'Healthy')
                      ? 'rgba(16, 185, 129, 0.15)'
                      : (eclipsedHealth?.health === 'blocked' || eclipsedHealth?.status === 'Blocked')
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(245, 158, 11, 0.15)',
                  color:
                    (eclipsedHealth?.health === 'healthy' || eclipsedHealth?.status === 'Healthy')
                      ? '#10B981'
                      : (eclipsedHealth?.health === 'blocked' || eclipsedHealth?.status === 'Blocked')
                      ? '#EF4444'
                      : '#F59E0B',
                  border: `1px solid ${
                    (eclipsedHealth?.health === 'healthy' || eclipsedHealth?.status === 'Healthy')
                      ? 'rgba(16, 185, 129, 0.3)'
                      : (eclipsedHealth?.health === 'blocked' || eclipsedHealth?.status === 'Blocked')
                      ? 'rgba(239, 68, 68, 0.3)'
                      : 'rgba(245, 158, 11, 0.3)'
                  }`
                }}
              >
                {((eclipsedHealth?.health || eclipsedHealth?.status) || 'CALCULATING').toUpperCase().replace('_', ' ')}
              </span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', height: '34px', overflow: 'hidden' }}>
              Atmospheric 2D metroidvania game featuring fluid combat, exploration, and upgrade progression.
            </p>

            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              {eclipsedHealth?.reasons?.length > 0 ? (
                <div style={{ color: 'var(--accent-orange)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} />
                  <span>{eclipsedHealth.reasons[0]}</span>
                </div>
              ) : (
                <div style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} />
                  <span>Production milestones and systems nominal.</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
              <span>Critical Bugs: <strong style={{ color: (eclipsedHealth?.metrics?.criticalBugs || 0) > 0 ? '#EF4444' : 'var(--text-white)' }}>{eclipsedHealth?.metrics?.criticalBugs || 0}</strong></span>
              <span>Blocked Tasks: <strong style={{ color: (eclipsedHealth?.metrics?.blockedTasks || 0) > 0 ? '#EF4444' : 'var(--text-white)' }}>{eclipsedHealth?.metrics?.blockedTasks || 0}</strong></span>
              <span>Overdue: <strong style={{ color: 'var(--text-white)' }}>{eclipsedHealth?.metrics?.overdueTasks || 0}</strong></span>
            </div>
          </div>
        </div>

        {/* Quick Hub Action Badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('bugs')} style={{ fontSize: '11.5px' }}>
            <Bug size={13} color="#EF4444" /> QA Bug Tracker ({activeBugs.length} open)
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('builds-releases')} style={{ fontSize: '11.5px' }}>
            <Rocket size={13} color="#10B981" /> Builds & Releases
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('assets')} style={{ fontSize: '11.5px' }}>
            <Layers size={13} color="var(--accent-orange)" /> Private Asset Vault
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('story-bible')} style={{ fontSize: '11.5px' }}>
            <BookOpen size={13} color="#F59E0B" /> Story Bible
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('wiki')} style={{ fontSize: '11.5px' }}>
            <Library size={13} color="#A855F7" /> Studio Wiki & ADRs
          </button>
        </div>
      </div>

      {/* Six Studio Teams Workload & Status */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <Users size={17} color="var(--accent-orange)" />
            <span>Studio Departments // Six Dedicated Teams</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('team')}>
            Team Directory & Dashboards <ArrowRight size={13} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {teamWorkloads.map((team: any) => {
            const completed = team.complete || 0;
            const total = team.total_tasks || 0;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

            return (
              <div
                key={team.id}
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
                onClick={() => onNavigate('tasks', { filterTeam: team.id })}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-orange)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getTeamIcon(team.slug || team.name)}
                    <strong style={{ fontSize: '14px', color: 'var(--text-white)' }}>{team.name}</strong>
                  </div>
                  <span className="badge badge-backlog" style={{ fontSize: '10.5px' }}>
                    {team.total_tasks || 0} Tasks
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', height: '36px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {team.description}
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '5px', backgroundColor: 'var(--bg-surface)', borderRadius: '3px', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{ width: `${pct}%`, height: '100%', backgroundColor: 'var(--status-complete)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Progress: <strong style={{ color: 'var(--text-white)' }}>{pct}%</strong></span>
                  <span>In Progress: <strong style={{ color: 'var(--status-progress)' }}>{team.in_progress || 0}</strong></span>
                  <span>Review: <strong style={{ color: 'var(--status-review)' }}>{team.review || 0}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Left Column: Workload Breakdown & Deadlines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Upcoming Deadlines Panel */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Clock size={16} color="var(--accent-orange)" />
                <span>Upcoming Milestones & Deadlines</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('tasks', { sort: 'deadline' })}
                style={{ fontSize: '11.5px' }}
              >
                All Milestones <ArrowRight size={12} />
              </button>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <div className="empty-state" style={{ padding: '28px 0' }}>
                <Clock size={28} />
                <h3>No Deadlines Configured</h3>
                <p>No open tasks have active milestone deadlines scheduled.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {upcomingDeadlines.map((t: any) => {
                  const effectiveDate = t.extended_deadline || t.deadline;
                  const rel = effectiveDate ? getRelativeDeadline(effectiveDate) : null;

                  return (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                      onClick={() => onNavigate('tasks', { taskId: t.id })}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-orange)';
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)';
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                          <span className="mono" style={{ fontSize: '12px', color: 'var(--accent-orange)', fontWeight: 700 }}>
                            {t.id}
                          </span>
                          <PriorityBadge priority={t.priority} />
                          <StatusBadge status={t.status} />

                          {t.is_deadline_exempt === 1 && (
                            <span className="badge badge-verified-complete" style={{ fontSize: '10px' }}>
                              EXEMPT
                            </span>
                          )}
                          {t.extended_deadline && (
                            <span className="badge badge-changes-requested" style={{ fontSize: '10px' }}>
                              EXTENDED
                            </span>
                          )}
                          {t.reassignment_required === 1 && (
                            <span className="badge badge-blocked" style={{ fontSize: '10px' }}>
                              REASSIGNMENT REQUIRED
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: '13px', color: 'var(--text-white)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          Owner: {t.owner_name || 'Unassigned'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {rel && (
                          <div
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              color:
                                rel.severity === 'critical'
                                  ? '#EF4444'
                                  : rel.severity === 'warning'
                                  ? '#F59E0B'
                                  : 'var(--text-secondary)',
                              marginBottom: '2px'
                            }}
                          >
                            {rel.label}
                          </div>
                        )}
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {effectiveDate ? new Date(effectiveDate).toLocaleDateString() : '—'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Developer Workload */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <CheckSquare size={16} color="var(--accent-orange)" />
                <span>Developer Workload & Distribution</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('team')}>
                Team Directory
              </button>
            </div>

            {workload.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p>No active developers assigned to tasks.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {workload.map((w: any) => (
                  <div
                    key={w.id}
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px 14px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-white)' }}>
                        {w.display_name} <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '11px' }}>({w.username})</span>
                      </div>
                      <span className="badge badge-backlog">{w.assigned_tasks} Assigned</span>
                    </div>

                    <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span>In Progress: <strong style={{ color: 'var(--status-progress)' }}>{w.in_progress_tasks || 0}</strong></span>
                      <span>Review: <strong style={{ color: 'var(--status-review)' }}>{w.review_tasks || 0}</strong></span>
                      <span>Complete: <strong style={{ color: 'var(--status-complete)' }}>{w.completed_tasks || 0}</strong></span>
                      {w.blocked_tasks > 0 && (
                        <span>Blocked: <strong style={{ color: 'var(--status-blocked)' }}>{w.blocked_tasks}</strong></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Peer Reviews & Recent Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Recent Reviews */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <FileCheck2 size={16} color="var(--accent-orange)" />
                <span>Recent Peer Reviews</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('reviews')}>
                Review Queue <ArrowRight size={12} />
              </button>
            </div>

            {recentReviews.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <FileCheck2 size={28} />
                <h3>No Peer Reviews Recorded</h3>
                <p>Task completion requires independent reviewer verification.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentReviews.slice(0, 5).map((r: any) => (
                  <div
                    key={r.id}
                    style={{
                      padding: '12px',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      transition: 'border-color var(--transition-fast)'
                    }}
                    onClick={() => onNavigate('tasks', { taskId: r.task_id })}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-orange)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="mono" style={{ fontSize: '11.5px', color: 'var(--accent-orange)', fontWeight: 600 }}>
                        {r.task_id}
                      </span>
                      <span
                        className={`badge ${
                          r.decision === 'Approved'
                            ? 'badge-verified-complete'
                            : r.decision === 'Changes Requested'
                            ? 'badge-changes-requested'
                            : 'badge-ready-for-review'
                        }`}
                      >
                        {r.decision}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '3px' }}>
                      {r.task_title || 'Task Review'}
                    </div>

                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Reviewer: {r.reviewer_name || 'Designated Reviewer'} • {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Real Recent Activity Stream */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Activity size={16} color="var(--accent-orange)" />
                <span>Studio Audit Stream</span>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('activity')}>
                Full Audit Trail
              </button>
            </div>

            {recentActivity.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p>No activity recorded yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentActivity.slice(0, 6).map((a: any) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12.5px'
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-orange)',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: '1px'
                      }}
                    >
                      {a.actor_name ? a.actor_name.slice(0, 1).toUpperCase() : 'S'}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: 'var(--text-white)', lineHeight: '1.4' }}>
                        <strong>{a.actor_name || 'System'}</strong>: {a.action.replace(/_/g, ' ')}{' '}
                        {a.task_title && (
                          <span
                            onClick={() => onNavigate('tasks', { taskId: a.related_task_id })}
                            style={{ color: 'var(--accent-orange)', cursor: 'pointer', fontWeight: 600 }}
                          >
                            on {a.related_task_id}
                          </span>
                        )}
                      </div>
                      <div className="mono" style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {new Date(a.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
