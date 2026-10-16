import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';
import { Strike, StrikePolicy, StrikeOverviewMember } from '../types/index.js';

interface StrikesPageProps {
  onNavigateToTask?: (taskId: string) => void;
}

export const StrikesPage: React.FC<StrikesPageProps> = ({ onNavigateToTask }) => {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('owner');

  // Member state
  const [memberStatus, setMemberStatus] = useState<any>(null);
  const [isLoadingMember, setIsLoadingMember] = useState(true);

  // Admin state
  const [adminTab, setAdminTab] = useState<'overview' | 'history' | 'disputes' | 'entry-logs' | 'policy'>('overview');
  const [overviewData, setOverviewData] = useState<{ summary: any; members: StrikeOverviewMember[]; policy: StrikePolicy } | null>(null);
  const [historyStrikes, setHistoryStrikes] = useState<any[]>([]);
  const [entryLogs, setEntryLogs] = useState<any[]>([]);
  const [policyData, setPolicyData] = useState<StrikePolicy | null>(null);
  const [filterUserId, setFilterUserId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modals
  const [disputeModalStrike, setDisputeModalStrike] = useState<Strike | null>(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [reverseModalStrike, setReverseModalStrike] = useState<any | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [suspendModalUser, setSuspendModalUser] = useState<StrikeOverviewMember | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [reinstateModalUser, setReinstateModalUser] = useState<StrikeOverviewMember | null>(null);
  const [reinstateReason, setReinstateReason] = useState('');

  // Messages
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const fetchMemberStatus = async () => {
    setIsLoadingMember(true);
    try {
      const data = await apiRequest('/api/strikes/my-status');
      setMemberStatus(data);
    } catch (err: any) {
      console.error('Failed to fetch strike status:', err);
    } finally {
      setIsLoadingMember(false);
    }
  };

  const fetchAdminOverview = async () => {
    if (!isAdmin) return;
    try {
      const data = await apiRequest(`/api/strikes/overview${filterUserId ? `?userId=${filterUserId}` : ''}`);
      setOverviewData(data);
    } catch (err: any) {
      console.error('Failed to fetch admin overview:', err);
    }
  };

  const fetchAdminHistory = async () => {
    if (!isAdmin) return;
    try {
      const query = new URLSearchParams();
      if (filterStatus) query.append('status', filterStatus);
      if (filterUserId) query.append('userId', filterUserId);
      const data = await apiRequest(`/api/strikes/history?${query.toString()}`);
      setHistoryStrikes(data.strikes || []);
    } catch (err: any) {
      console.error('Failed to fetch history:', err);
    }
  };

  const fetchEntryLogs = async () => {
    if (!isAdmin) return;
    try {
      const data = await apiRequest('/api/strikes/entry-logs');
      setEntryLogs(data.logs || []);
    } catch (err: any) {
      console.error('Failed to fetch entry logs:', err);
    }
  };

  const fetchPolicy = async () => {
    try {
      const data = await apiRequest('/api/strikes/policy');
      setPolicyData(data.policy);
    } catch (err: any) {
      console.error('Failed to fetch policy:', err);
    }
  };

  useEffect(() => {
    fetchMemberStatus();
    if (isAdmin) {
      fetchAdminOverview();
      fetchAdminHistory();
      fetchEntryLogs();
      fetchPolicy();
    }
  }, [isAdmin, filterUserId, filterStatus]);

  const handleManualEvaluation = async () => {
    setIsEvaluating(true);
    setActionSuccess(null);
    setActionError(null);
    try {
      const res = await apiRequest('/api/strikes/evaluate-now', { method: 'POST' });
      setActionSuccess(`Deadline evaluation complete: ${res.issuedCount} qualifying strike(s) issued.`);
      fetchMemberStatus();
      if (isAdmin) {
        fetchAdminOverview();
        fetchAdminHistory();
      }
    } catch (err: any) {
      setActionError(err.message || 'Evaluation failed.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeModalStrike || !disputeReason.trim()) return;
    try {
      await apiRequest(`/api/strikes/${disputeModalStrike.id}/dispute`, {
        method: 'POST',
        body: JSON.stringify({ reason: disputeReason.trim() })
      });
      setActionSuccess('Dispute submitted successfully for administrative review.');
      setDisputeModalStrike(null);
      setDisputeReason('');
      fetchMemberStatus();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleReverseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseModalStrike || !reversalReason.trim()) return;
    try {
      await apiRequest(`/api/strikes/${reverseModalStrike.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: reversalReason.trim() })
      });
      setActionSuccess('Strike reversed and active count recalculated.');
      setReverseModalStrike(null);
      setReversalReason('');
      fetchMemberStatus();
      fetchAdminOverview();
      fetchAdminHistory();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleReviewDispute = async (strikeId: string, action: 'approve' | 'reject') => {
    const notes = prompt(`Enter review notes for ${action === 'approve' ? 'approving (reversing strike)' : 'rejecting'} dispute:`);
    if (!notes || !notes.trim()) return;
    try {
      await apiRequest(`/api/strikes/${strikeId}/review-dispute`, {
        method: 'POST',
        body: JSON.stringify({ action, notes: notes.trim() })
      });
      setActionSuccess(`Dispute ${action}d successfully.`);
      fetchAdminOverview();
      fetchAdminHistory();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleSuspendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendModalUser || !suspendReason.trim()) return;
    try {
      await apiRequest(`/api/strikes/members/${suspendModalUser.id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason: suspendReason.trim() })
      });
      setActionSuccess(`Member ${suspendModalUser.display_name} has been suspended.`);
      setSuspendModalUser(null);
      setSuspendReason('');
      fetchAdminOverview();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleReinstateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reinstateModalUser || !reinstateReason.trim()) return;
    try {
      await apiRequest(`/api/strikes/members/${reinstateModalUser.id}/reinstate`, {
        method: 'POST',
        body: JSON.stringify({ reason: reinstateReason.trim() })
      });
      setActionSuccess(`Member ${reinstateModalUser.display_name} has been reinstated.`);
      setReinstateModalUser(null);
      setReinstateReason('');
      fetchAdminOverview();
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handlePolicySave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyData) return;
    try {
      const res = await apiRequest('/api/strikes/policy', {
        method: 'PATCH',
        body: JSON.stringify(policyData)
      });
      setActionSuccess('Policy configuration updated and audited.');
      setPolicyData(res.policy);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  return (
    <div style={{ padding: '24px 32px', color: '#f3f4f6', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#ff5722', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-mono)' }}>
            Terminal 6 Dev // Disciplinary Governance
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: '24px', color: '#fff', letterSpacing: '-0.02em' }}>
            Deadline Strikes & Accountability Engine
          </h1>
          <p style={{ margin: '6px 0 0', color: '#9ca3af', fontSize: '13px' }}>
            Automated qualifying missed deadline detection, progressive warnings, and 5-strike private workspace suspension.
          </p>
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleManualEvaluation}
              disabled={isEvaluating}
              style={{
                padding: '9px 18px',
                backgroundColor: '#ff5722',
                border: 'none',
                color: '#fff',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '13px',
                boxShadow: '0 0 12px rgba(255, 87, 34, 0.3)'
              }}
            >
              {isEvaluating ? 'Evaluating...' : '⚡ Evaluate Overdue Deadlines Now'}
            </button>
          </div>
        )}
      </div>

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#34d399', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#f87171', borderRadius: '8px', marginBottom: '20px', fontSize: '13px' }}>
          {actionError}
        </div>
      )}

      {/* Section 1: Member Accountability Card */}
      {memberStatus && (
        <div
          style={{
            backgroundColor: '#12141c',
            border: memberStatus.activeStrikes >= 4 ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '32px',
            boxShadow: memberStatus.activeStrikes >= 4 ? '0 0 25px rgba(239, 68, 68, 0.2)' : 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: memberStatus.activeStrikes >= 4 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 87, 34, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px'
                }}
              >
                {memberStatus.isSuspended ? '🛑' : memberStatus.activeStrikes >= 4 ? '🚨' : '⏰'}
              </div>

              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>
                  Your Deadline Accountability Status ({user?.displayName})
                </h3>
                <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                  Workspace Policy: Automatic suspension at {memberStatus.maxThreshold} active qualifying strikes (Grace period: {memberStatus.policy.grace_period_hours}h).
                </span>
              </div>
            </div>

            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: memberStatus.isSuspended
                  ? '#ef4444'
                  : memberStatus.activeStrikes === 4
                  ? '#dc2626'
                  : memberStatus.activeStrikes === 3
                  ? '#d97706'
                  : memberStatus.activeStrikes > 0
                  ? '#ff5722'
                  : '#10b981',
                color: '#fff',
                fontFamily: 'var(--font-mono)'
              }}
            >
              {memberStatus.isSuspended
                ? 'WORKSPACE SUSPENDED'
                : memberStatus.warningLevel === 'final_warning'
                ? 'FINAL WARNING (4 / 5)'
                : memberStatus.warningLevel === 'escalation'
                ? 'ESCALATED (3 / 5)'
                : memberStatus.warningLevel === 'second_warning'
                ? 'SECOND WARNING (2 / 5)'
                : memberStatus.warningLevel === 'first_warning'
                ? 'FIRST WARNING (1 / 5)'
                : 'CLEAN STANDING (0 STRIKES)'}
            </span>
          </div>

          {/* Metric gauges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Active Strikes</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: memberStatus.activeStrikes > 0 ? '#ff5722' : '#10b981', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                {memberStatus.activeStrikes}
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Threshold</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#9ca3af', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                {memberStatus.maxThreshold}
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Strikes Remaining</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: memberStatus.remainingStrikes <= 1 ? '#ef4444' : '#10b981', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                {memberStatus.remainingStrikes}
              </div>
            </div>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Active Tasks</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                {memberStatus.upcomingDeadlines.length}
              </div>
            </div>
          </div>

          {/* Active Strikes List */}
          {memberStatus.activeStrikesList.length > 0 ? (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
                Active Strikes Detail ({memberStatus.activeStrikesList.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {memberStatus.activeStrikesList.map((s: Strike) => (
                  <div key={s.id} style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                          {s.task_id}
                        </span>
                        <strong style={{ color: '#e5e7eb' }}>{s.task_title || 'Task'}</strong>
                        <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', backgroundColor: s.status === 'disputed' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: s.status === 'disputed' ? '#fbbf24' : '#f87171', fontFamily: 'var(--font-mono)' }}>
                          {s.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                        {s.reason}
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                        Deadline: {s.applicable_deadline} • Detected: {new Date(s.detected_at).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      {s.status === 'active' && (
                        <button
                          onClick={() => setDisputeModalStrike(s)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'transparent',
                            border: '1px solid #4b5563',
                            color: '#e5e7eb',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Dispute Strike
                        </button>
                      )}
                      {s.status === 'disputed' && (
                        <span style={{ fontSize: '12px', color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                          Dispute Pending Review
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '14px', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', color: '#34d399', fontSize: '13px' }}>
              ✓ You have 0 active deadline strikes. Keep up the high standard of engineering execution!
            </div>
          )}

          {/* Upcoming Deadlines */}
          {memberStatus.upcomingDeadlines.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
                Upcoming Deadlines Requiring Diligence ({memberStatus.upcomingDeadlines.length})
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                {memberStatus.upcomingDeadlines.map((t: any) => (
                  <div
                    key={t.id}
                    onClick={() => onNavigateToTask?.(t.id)}
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#38bdf8', fontWeight: 700, fontSize: '12px', fontFamily: 'var(--font-mono)' }}>{t.id}</span>
                      <span style={{ fontSize: '11px', color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>{t.extended_deadline || t.deadline}</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#e5e7eb', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 2: Studio Admin Governance Panel */}
      {isAdmin && (
        <div style={{ backgroundColor: '#12141c', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '24px' }}>
          <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>
                Studio Owner & Lead Administration
              </h2>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                Team overview, audit trails, dispute adjudication, and policy configuration.
              </span>
            </div>

            {/* Admin Tabs */}
            <div style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '3px', borderRadius: '6px' }}>
              {(['overview', 'history', 'entry-logs', 'policy'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setAdminTab(tab)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: adminTab === tab ? '#ff5722' : 'transparent',
                    color: adminTab === tab ? '#fff' : '#9ca3af',
                    fontWeight: adminTab === tab ? 700 : 500,
                    fontSize: '12px',
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {tab.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Admin Tab 1: Overview across authorized teams */}
          {adminTab === 'overview' && overviewData && (
            <div>
              {/* Summary Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>TOTAL MEMBERS</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginTop: '4px' }}>{overviewData.summary.totalMembers}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>ACTIVE STRIKES WORKSPACE-WIDE</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: '#ff5722', marginTop: '4px' }}>{overviewData.summary.totalActiveStrikes}</div>
                </div>
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>SUSPENDED MEMBERS</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: overviewData.summary.totalSuspendedMembers > 0 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                    {overviewData.summary.totalSuspendedMembers}
                  </div>
                </div>
                <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>PENDING DISPUTES</div>
                  <div style={{ fontSize: '22px', fontWeight: 800, color: overviewData.summary.totalDisputedStrikes > 0 ? '#fbbf24' : '#9ca3af', marginTop: '4px' }}>
                    {overviewData.summary.totalDisputedStrikes}
                  </div>
                </div>
              </div>

              {/* Members Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#9ca3af', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px' }}>Member</th>
                      <th style={{ padding: '10px 12px' }}>Role</th>
                      <th style={{ padding: '10px 12px' }}>Active Strikes</th>
                      <th style={{ padding: '10px 12px' }}>Status</th>
                      <th style={{ padding: '10px 12px' }}>Discord Link</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overviewData.members.map((m) => (
                      <tr key={m.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '12px' }}>
                          <strong style={{ color: '#fff' }}>{m.display_name}</strong>
                          <div style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'var(--font-mono)' }}>@{m.username} • {m.email}</div>
                        </td>
                        <td style={{ padding: '12px', textTransform: 'capitalize', color: '#9ca3af' }}>{m.workspace_role}</td>
                        <td style={{ padding: '12px' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: m.active_strikes >= 5 ? '#ef4444' : m.active_strikes === 4 ? '#dc2626' : m.active_strikes > 0 ? '#ff5722' : 'rgba(16, 185, 129, 0.2)',
                              color: '#fff',
                              fontFamily: 'var(--font-mono)'
                            }}
                          >
                            {m.active_strikes} / {overviewData.policy.strike_threshold}
                          </span>
                        </td>
                        <td style={{ padding: '12px' }}>
                          {m.is_suspended === 1 || m.active_strikes >= overviewData.policy.strike_threshold ? (
                            <span style={{ color: '#f87171', fontWeight: 700 }}>🛑 Suspended</span>
                          ) : (
                            <span style={{ color: '#34d399' }}>✓ Active Access</span>
                          )}
                        </td>
                        <td style={{ padding: '12px', color: m.discord_username ? '#38bdf8' : '#6b7280', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                          {m.discord_username ? `✓ @${m.discord_username}` : 'Not linked'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {m.is_suspended === 1 ? (
                              <button
                                onClick={() => setReinstateModalUser(m)}
                                style={{
                                  padding: '5px 12px',
                                  backgroundColor: '#10b981',
                                  border: 'none',
                                  color: '#fff',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  fontSize: '12px'
                                }}
                              >
                                Reinstate
                              </button>
                            ) : (
                              <button
                                onClick={() => setSuspendModalUser(m)}
                                style={{
                                  padding: '5px 10px',
                                  backgroundColor: 'transparent',
                                  border: '1px solid rgba(239, 68, 68, 0.4)',
                                  color: '#f87171',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '12px'
                                }}
                              >
                                Suspend
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Admin Tab 2: Strike History */}
          {adminTab === 'history' && (
            <div>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: '6px', backgroundColor: '#0f1117', border: '1px solid #374151', color: '#fff', fontSize: '12px' }}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="disputed">Disputed</option>
                  <option value="reversed">Reversed</option>
                  <option value="excused">Excused</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {historyStrikes.map((s) => (
                  <div key={s.id} style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: '#fff' }}>{s.member_name}</strong>
                        <span style={{ color: '#38bdf8', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>[{s.task_id}] {s.task_title}</span>
                        <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', backgroundColor: s.status === 'active' ? '#ef4444' : s.status === 'disputed' ? '#d97706' : '#10b981', color: '#fff', fontFamily: 'var(--font-mono)' }}>
                          {s.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                        {s.reason}
                      </div>
                      {s.reversal_reason && (
                        <div style={{ fontSize: '12px', color: '#34d399', marginTop: '2px' }}>
                          Reversed by {s.reversed_by_name}: {s.reversal_reason}
                        </div>
                      )}
                      {s.appeal_reason && (
                        <div style={{ fontSize: '12px', color: '#fbbf24', marginTop: '2px' }}>
                          Appeal: {s.appeal_reason}
                        </div>
                      )}
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                        Deadline: {s.applicable_deadline} • Detected: {new Date(s.detected_at).toLocaleString()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {s.status === 'disputed' && (
                        <>
                          <button
                            onClick={() => handleReviewDispute(s.id, 'approve')}
                            style={{ padding: '5px 10px', backgroundColor: '#10b981', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            Approve Dispute
                          </button>
                          <button
                            onClick={() => handleReviewDispute(s.id, 'reject')}
                            style={{ padding: '5px 10px', backgroundColor: '#ef4444', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            Reject Dispute
                          </button>
                        </>
                      )}
                      {s.status === 'active' && (
                        <button
                          onClick={() => setReverseModalStrike(s)}
                          style={{ padding: '5px 10px', backgroundColor: 'transparent', border: '1px solid #4b5563', color: '#e5e7eb', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          Reverse Strike
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Tab 3: Workspace Entry Logs */}
          {adminTab === 'entry-logs' && (
            <div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '12px' }}>
                Chronological workspace entry events and Discord DM warning delivery outcomes.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {entryLogs.map((l) => (
                  <div key={l.id} style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ color: '#fff', fontSize: '13px' }}>{l.member_name}</strong>
                        <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>@{l.member_username}</span>
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#374151', color: '#e5e7eb', fontFamily: 'var(--font-mono)' }}>
                          {l.warning_level}
                        </span>
                        <span style={{ fontSize: '12px', color: '#ff5722', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          {l.active_strike_count} active strike(s)
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                        Session: {l.session_id} • Entered: {new Date(l.entered_at).toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          backgroundColor: l.discord_dm_status === 'delivered' ? 'rgba(16, 185, 129, 0.2)' : l.discord_dm_status === 'not_linked' ? 'rgba(107, 114, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: l.discord_dm_status === 'delivered' ? '#34d399' : l.discord_dm_status === 'not_linked' ? '#9ca3af' : '#f87171',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        Discord: {l.discord_dm_status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Tab 4: Policy Configuration */}
          {adminTab === 'policy' && policyData && (
            <form onSubmit={handlePolicySave} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                  Suspension Strike Threshold (Default: 5)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={policyData.strike_threshold}
                  onChange={(e) => setPolicyData({ ...policyData, strike_threshold: parseInt(e.target.value, 10) || 5 })}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f1117', border: '1px solid #374151', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                  Grace Period in Hours (Default: 24)
                </label>
                <input
                  type="number"
                  min="0"
                  max="168"
                  value={policyData.grace_period_hours}
                  onChange={(e) => setPolicyData({ ...policyData, grace_period_hours: parseInt(e.target.value, 10) || 24 })}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f1117', border: '1px solid #374151', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                  Studio Timezone (Default: Africa/Cairo)
                </label>
                <select
                  value={policyData.timezone}
                  onChange={(e) => setPolicyData({ ...policyData, timezone: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f1117', border: '1px solid #374151', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
                >
                  <option value="Africa/Cairo">Africa/Cairo (UTC+2 / UTC+3)</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e5e7eb', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={policyData.manager_escalation_enabled}
                    onChange={(e) => setPolicyData({ ...policyData, manager_escalation_enabled: e.target.checked })}
                  />
                  Escalate 4th strike to Studio Manager
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#e5e7eb', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={policyData.discord_dm_enabled}
                    onChange={(e) => setPolicyData({ ...policyData, discord_dm_enabled: e.target.checked })}
                  />
                  Send private Discord DM warnings
                </label>
              </div>

              <button
                type="submit"
                style={{
                  alignSelf: 'flex-start',
                  padding: '9px 20px',
                  backgroundColor: '#ff5722',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                  marginTop: '10px'
                }}
              >
                Save Policy Configuration
              </button>
            </form>
          )}
        </div>
      )}

      {/* Reversal Modal */}
      {reverseModalStrike && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '480px', backgroundColor: '#161922', border: '1px solid #374151', borderRadius: '10px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 10px', color: '#fff', fontSize: '16px' }}>Reverse Strike</h3>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#9ca3af' }}>
              Reversing a strike preserves it in the audit trail but deducts it from the member's active count. A documented reason is mandatory.
            </p>
            <form onSubmit={handleReverseSubmit}>
              <textarea
                rows={3}
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="Reason for reversal (e.g. approved extension or UVCS latency proof)..."
                style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f1117', border: '1px solid #374151', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" onClick={() => setReverseModalStrike(null)} style={{ padding: '7px 14px', backgroundColor: 'transparent', border: '1px solid #4b5563', color: '#d1d5db', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '7px 18px', backgroundColor: '#10b981', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}>Confirm Reversal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspend Modal */}
      {suspendModalUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '480px', backgroundColor: '#161922', border: '1px solid #ef4444', borderRadius: '10px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 10px', color: '#ef4444', fontSize: '16px' }}>Suspend Member Workspace Access</h3>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#9ca3af' }}>
              Are you sure you want to suspend <strong>{suspendModalUser.display_name}</strong>? Their session will be invalidated and incomplete tasks marked for reassignment.
            </p>
            <form onSubmit={handleSuspendSubmit}>
              <textarea
                rows={3}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Mandatory administrative reason for suspension..."
                style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f1117', border: '1px solid #374151', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" onClick={() => setSuspendModalUser(null)} style={{ padding: '7px 14px', backgroundColor: 'transparent', border: '1px solid #4b5563', color: '#d1d5db', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '7px 18px', backgroundColor: '#ef4444', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}>Suspend Access</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reinstate Modal */}
      {reinstateModalUser && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '480px', backgroundColor: '#161922', border: '1px solid #10b981', borderRadius: '10px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 10px', color: '#10b981', fontSize: '16px' }}>Reinstate Member Workspace Access</h3>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#9ca3af' }}>
              Reinstate workspace access for <strong>{reinstateModalUser.display_name}</strong>. A documented administrative reason is required.
            </p>
            <form onSubmit={handleReinstateSubmit}>
              <textarea
                rows={3}
                value={reinstateReason}
                onChange={(e) => setReinstateReason(e.target.value)}
                placeholder="Documented reason for reinstatement (e.g. review approved, strikes resolved)..."
                style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f1117', border: '1px solid #374151', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" onClick={() => setReinstateModalUser(null)} style={{ padding: '7px 14px', backgroundColor: 'transparent', border: '1px solid #4b5563', color: '#d1d5db', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '7px 18px', backgroundColor: '#10b981', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}>Confirm Reinstatement</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispute Modal for Member */}
      {disputeModalStrike && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '480px', backgroundColor: '#161922', border: '1px solid #374151', borderRadius: '10px', padding: '24px' }}>
            <h3 style={{ margin: '0 0 10px', color: '#fff', fontSize: '16px' }}>
              Dispute Strike for Task [{disputeModalStrike.task_id}]
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#9ca3af' }}>
              Please provide clear details explaining why this strike should be excused or reversed.
            </p>
            <form onSubmit={handleDisputeSubmit}>
              <textarea
                rows={4}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Explain the circumstances, attach references to changesets or test reports..."
                style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0f1117', border: '1px solid #374151', borderRadius: '6px', color: '#fff', fontSize: '13px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
                <button type="button" onClick={() => setDisputeModalStrike(null)} style={{ padding: '7px 14px', backgroundColor: 'transparent', border: '1px solid #4b5563', color: '#d1d5db', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" style={{ padding: '7px 18px', backgroundColor: '#ff5722', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}>Submit Dispute</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
