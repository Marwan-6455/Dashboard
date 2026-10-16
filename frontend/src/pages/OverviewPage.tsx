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
  AlertTriangle
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge.js';
import { PriorityBadge } from '../components/PriorityBadge.js';
import { apiRequest } from '../api/client.js';

interface OverviewPageProps {
  onNavigate: (page: string, params?: any) => void;
  onOpenNewTaskModal: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate, onOpenNewTaskModal }) => {
  const [data, setData] = useState<any>(null);
  const [myStrikes, setMyStrikes] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [statsRes, strikeRes] = await Promise.allSettled([
        apiRequest('/api/stats/overview'),
        apiRequest('/api/strikes/my-status')
      ]);

      if (statsRes.status === 'fulfilled') {
        setData(statsRes.value);
      } else {
        throw statsRes.reason;
      }

      if (strikeRes.status === 'fulfilled') {
        setMyStrikes(strikeRes.value);
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

  if (isLoading) {
    return (
      <div className="page-wrapper">
        <div style={{ color: 'var(--text-secondary)', padding: '40px 0' }}>
          Loading Terminal 6 hub statistics...
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
      </div>
    );
  }

  const { metrics, workload, upcomingDeadlines, recentReviews, recentReports, recentActivity, integrations } = data;
  const teamWorkloads = data.teamWorkloads || [];

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h1>Terminal 6 // Development Overview</h1>
          <p>Real-time engineering hub status, six studio teams, verification gates, and developer workload.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={loadData}>
            Refresh Metrics
          </button>
          <button className="btn btn-primary" onClick={onOpenNewTaskModal}>
            + New Task
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
                  {myStrikes.activeStrikes} OF {myStrikes.maxStrikes} STRIKES ({myStrikes.remainingStrikes} REMAINING)
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
          padding: '12px 16px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          alignItems: 'center',
          justifyContent: 'space-between'
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
            <span className="badge badge-verified-complete">API ENDPOINT READY</span>
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
            >
              5-STRIKES AUTO-SUSPEND ({(data.disciplinary?.activeStrikesCount || 0)} ACTIVE)
            </span>
          </div>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => onNavigate('integrations')}
          style={{ fontSize: '11px' }}
        >
          View Integrations <ExternalLink size={12} />
        </button>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div
          className="metric-card accent-orange"
          style={{ cursor: 'pointer' }}
          onClick={() => onNavigate('tasks')}
        >
          <div className="metric-label">Open Tasks</div>
          <div className="metric-value">{metrics.openTasks}</div>
          <div className="metric-sub">{metrics.totalTasks} total tasks in database</div>
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
      </div>

      {/* Six Studio Teams Workload & Status Cards */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <CheckSquare size={16} color="var(--accent-orange)" />
            <span>Studio Departments // Six Dedicated Teams</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('team')}>
            Team Directory & Dashboards
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {teamWorkloads.map((team: any) => (
            <div
              key={team.id}
              style={{
                padding: '14px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease'
              }}
              onClick={() => onNavigate('tasks', { filterTeam: team.id })}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-orange)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)')}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong style={{ fontSize: '14px', color: 'var(--text-white)' }}>{team.name}</strong>
                <span className="badge badge-backlog" style={{ fontSize: '10.5px' }}>
                  {team.memberCount} members
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '10px', minHeight: '30px', lineHeight: '1.4' }}>
                {team.description}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <span>Active: <strong style={{ color: 'var(--accent-orange)' }}>{team.activeTasks}</strong></span>
                  <span>Overdue: <strong style={{ color: team.overdueTasks > 0 ? 'var(--status-blocked)' : 'var(--text-secondary)' }}>{team.overdueTasks}</strong></span>
                  <span>Done: <strong style={{ color: 'var(--status-complete)' }}>{team.completedTasks}</strong></span>
                </div>
                <ArrowRight size={12} color="var(--text-muted)" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Workload Breakdown */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <CheckSquare size={16} color="var(--accent-orange)" />
                <span>Developer Workload & Tasks</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('team')}
              >
                Team Directory
              </button>
            </div>

            {workload.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p>No active developers assigned to tasks.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-white)' }}>
                        {w.display_name} <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>({w.username})</span>
                      </div>
                      <span className="badge badge-backlog">{w.assigned_tasks} Tasks Assigned</span>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
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

          {/* Upcoming Deadlines */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Clock size={16} color="var(--accent-orange)" />
                <span>Upcoming Milestones & Deadlines</span>
              </div>
            </div>

            {upcomingDeadlines.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p>No open tasks have configured deadlines.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {upcomingDeadlines.map((t: any) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer'
                    }}
                    onClick={() => onNavigate('tasks', { taskId: t.id })}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
                        <span className="mono" style={{ fontSize: '12px', color: 'var(--accent-orange)', fontWeight: 600 }}>
                          {t.id}
                        </span>
                        <PriorityBadge priority={t.priority} />
                        <StatusBadge status={t.status} />
                        {t.is_deadline_exempt === 1 && (
                          <span className="badge badge-verified-complete" style={{ fontSize: '10px' }}>
                            POLICY EXEMPT
                          </span>
                        )}
                        {t.extended_deadline && (
                          <span className="badge badge-changes-requested" style={{ fontSize: '10px' }}>
                            EXTENDED
                          </span>
                        )}
                        {t.reassignment_required === 1 && (
                          <span className="badge badge-blocked" style={{ fontSize: '10px' }}>
                            REASSIGNMENT
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-white)', fontWeight: 500 }}>
                        {t.title}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                      {t.extended_deadline
                        ? `Ext: ${new Date(t.extended_deadline).toLocaleDateString()}`
                        : t.deadline
                        ? new Date(t.deadline).toLocaleDateString()
                        : 'No deadline'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Recent Reviews */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <FileCheck2 size={16} color="var(--accent-orange)" />
                <span>Recent Peer Reviews</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('reviews')}
              >
                Review Queue
              </button>
            </div>

            {recentReviews.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p>No peer reviews recorded yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentReviews.map((r: any) => (
                  <div
                    key={r.id}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="mono" style={{ fontSize: '12px', color: 'var(--accent-orange)', fontWeight: 600 }}>
                        {r.task_id}
                      </span>
                      <span
                        className={`badge ${
                          r.decision === 'Approved'
                            ? 'badge-verified-complete'
                            : r.decision === 'Changes Requested'
                            ? 'badge-changes-requested'
                            : 'badge-backlog'
                        }`}
                      >
                        {r.decision}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-white)', marginBottom: '4px' }}>
                      {r.task_title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Developer: <strong>{r.developer_name}</strong> • Reviewer: <strong>{r.reviewer_name}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Test Reports */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <FileText size={16} color="var(--accent-orange)" />
                <span>Recent Unity Test / Build Reports</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('test-reports')}
              >
                All Reports
              </button>
            </div>

            {recentReports.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p>No test reports recorded yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {recentReports.map((rpt: any) => (
                  <div
                    key={rpt.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span className="mono" style={{ fontSize: '12px', color: 'var(--text-white)', fontWeight: 600 }}>
                          {rpt.test_suite}
                        </span>
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          rev: {rpt.revision}
                        </span>
                        {rpt.source === 'manual' && <span className="demo-tag">MANUAL</span>}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {rpt.passed_count} passed • {rpt.failed_count} failed • Unity {rpt.unity_version}
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        rpt.result === 'Passed' ? 'badge-verified-complete' : 'badge-blocked'
                      }`}
                    >
                      {rpt.result}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity Feed */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Clock size={16} color="var(--accent-orange)" />
                <span>Auditable Activity Feed</span>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('activity')}
              >
                View Audit Log
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentActivity.slice(0, 5).map((act: any) => (
                <div
                  key={act.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '12.5px',
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-subtle)'
                  }}
                >
                  <div
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-orange)',
                      marginTop: '6px'
                    }}
                  ></div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                      {act.actor_name || 'System'}:
                    </span>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {act.action.replace(/_/g, ' ')}
                    </span>{' '}
                    {act.related_task_id && (
                      <span className="mono" style={{ color: 'var(--accent-orange)' }}>
                        [{act.related_task_id}]
                      </span>
                    )}
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Source: {act.source}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
