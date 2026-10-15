import React, { useState, useEffect } from 'react';
import { Settings, Shield, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';

export const SettingsPage: React.FC = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [gateConfig, setGateConfig] = useState<any>({
    requireAcceptanceCriteria: true,
    requireChangeset: true,
    requirePeerReview: true,
    requireEvidence: true,
    requirePassingTests: true,
    allowChangesetExemptions: true,
    allowTestExemptions: true
  });
  const [health, setHealth] = useState<any>(null);
  const [isSavingGates, setIsSavingGates] = useState(false);
  const [isReseeding, setIsReseeding] = useState(false);
  const [reseedConfirm, setResetConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const gatesRes = await apiRequest('/api/settings/gates');
      setGateConfig(gatesRes.completionGates || {});

      const healthRes = await apiRequest('/api/settings/health');
      setHealth(healthRes);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggleGate = (key: string) => {
    if (!isAdmin) return;
    setGateConfig({
      ...gateConfig,
      [key]: !gateConfig[key]
    });
  };

  const handleSaveGates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSavingGates(true);
    setMessage(null);

    try {
      const res = await apiRequest('/api/settings/gates', {
        method: 'PATCH',
        body: JSON.stringify(gateConfig)
      });
      setGateConfig(res.completionGates);
      setMessage('Studio completion gate policies updated successfully.');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSavingGates(false);
    }
  };

  const handleReseed = async () => {
    if (!isAdmin) return;
    if (reseedConfirm !== 'RESET_TERMINAL_6') {
      alert('Please type "RESET_TERMINAL_6" to confirm database reseed.');
      return;
    }

    setIsReseeding(true);
    try {
      const res = await apiRequest('/api/settings/reseed', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'RESET_TERMINAL_6' })
      });
      alert(res.message);
      setResetConfirm('');
      fetchSettings();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsReseeding(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h1>Terminal 6 // Studio Hub Settings</h1>
          <p>Global verification gate rules, system health, and database management.</p>
        </div>
      </div>

      {message && <div className="alert alert-success">{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Completion Gates Policy */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <Shield size={18} color="var(--accent-orange)" />
              <span>Completion Gates Policy Configuration</span>
            </div>
            {isAdmin ? (
              <span className="badge badge-verified-complete">ADMIN PRIVILEGES</span>
            ) : (
              <span className="badge badge-backlog">VIEW ONLY</span>
            )}
          </div>

          <form onSubmit={handleSaveGates}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {[
                { key: 'requireAcceptanceCriteria', label: 'Mandatory Acceptance Criteria (All satisfied)' },
                { key: 'requireChangeset', label: 'Mandatory UVCS Changeset reference' },
                { key: 'requirePeerReview', label: 'Mandatory Independent Peer Review (No self-approval)' },
                { key: 'requireEvidence', label: 'Mandatory Verification Evidence attachment' },
                { key: 'requirePassingTests', label: 'Mandatory Passing Unity Test / Build report' },
                { key: 'allowChangesetExemptions', label: 'Allow authorized changeset exemptions for non-code tasks' },
                { key: 'allowTestExemptions', label: 'Allow authorized test exemptions for non-testable tasks' }
              ].map((item) => (
                <label
                  key={item.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: isAdmin ? 'pointer' : 'default'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!gateConfig[item.key]}
                    onChange={() => handleToggleGate(item.key)}
                    disabled={!isAdmin}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--text-white)' }}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>

            {isAdmin && (
              <button type="submit" className="btn btn-primary" disabled={isSavingGates}>
                {isSavingGates ? 'Saving Policies...' : 'Update Gate Policies'}
              </button>
            )}
          </form>
        </div>

        {/* System Health Diagnostics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Settings size={18} color="var(--text-secondary)" />
                <span>System Health & Diagnostics</span>
              </div>
              <span className="badge badge-verified-complete">HEALTHY</span>
            </div>

            {health && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>System:</span>{' '}
                  <strong>{health.system}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Active Project:</span>{' '}
                  <strong className="mono">{health.project}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Database Engine:</span>{' '}
                  <span className="mono">SQLite 3.49 (WAL mode enabled)</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Node Runtime:</span>{' '}
                  <span className="mono">{health.nodeVersion}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Server Time:</span>{' '}
                  <span className="mono">{new Date(health.timestamp).toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          {/* Database Reset & Reseed (Admin Only) */}
          {isAdmin && (
            <div className="card" style={{ borderColor: 'rgba(220, 38, 38, 0.4)' }}>
              <div className="card-header">
                <div className="card-title" style={{ color: '#EF4444' }}>
                  <AlertTriangle size={18} />
                  <span>Reset & Reseed Development Database</span>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Resets the database and restores the initial Terminal 6 demo datasets for Engine Lead, Yehia, and Joe. All newly created tasks and logs will be reset.
              </p>

              <div className="form-group">
                <label className="form-label" style={{ color: '#EF4444' }}>
                  Type "RESET_TERMINAL_6" to confirm:
                </label>
                <input
                  type="text"
                  className="form-control mono"
                  placeholder="RESET_TERMINAL_6"
                  value={reseedConfirm}
                  onChange={(e) => setResetConfirm(e.target.value)}
                />
              </div>

              <button
                className="btn btn-danger"
                disabled={reseedConfirm !== 'RESET_TERMINAL_6' || isReseeding}
                onClick={handleReseed}
              >
                {isReseeding ? 'Reseeding...' : 'Confirm Reset & Reseed Database'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
