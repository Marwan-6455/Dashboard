import React, { useState, useEffect } from 'react';
import { Settings, Shield, RefreshCw, AlertTriangle, CheckCircle2, Flame } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';
import { useToast } from '../context/ToastContext.js';

interface SettingsPageProps {
  onNavigate?: (page: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onNavigate }) => {
  const { hasRole } = useAuth();
  const toast = useToast();
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
  const [strikePolicy, setStrikePolicy] = useState<any>(null);
  const [isSavingGates, setIsSavingGates] = useState(false);
  const [isReseeding, setIsReseeding] = useState(false);
  const [reseedConfirm, setResetConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  // Phoenix Mascot Preferences
  const [phoenixPrefs, setPhoenixPrefs] = useState<any>(() => {
    try {
      const stored = localStorage.getItem('cm_phoenix_companion_prefs');
      if (stored) return JSON.parse(stored);
    } catch {}
    return { enabled: true, reducedMotion: false, size: 'normal', speed: 'normal', muted: true };
  });

  const handleUpdatePhoenixPref = (key: string, value: any) => {
    const updated = { ...phoenixPrefs, [key]: value };
    setPhoenixPrefs(updated);
    try {
      localStorage.setItem('cm_phoenix_companion_prefs', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('cm_phoenix_prefs_updated', { detail: updated }));
      toast.success('Mascot preference updated');
    } catch {}
  };

  const fetchSettings = async () => {
    try {
      const [gatesRes, healthRes, policyRes] = await Promise.allSettled([
        apiRequest('/api/settings/gates'),
        apiRequest('/api/settings/health'),
        apiRequest('/api/strikes/policy')
      ]);

      if (gatesRes.status === 'fulfilled') setGateConfig(gatesRes.value.completionGates || {});
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
      if (policyRes.status === 'fulfilled') setStrikePolicy(policyRes.value.policy);
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
      toast.success('Studio completion gate policies updated successfully.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingGates(false);
    }
  };

  const handleReseed = async () => {
    if (!isAdmin) return;
    if (reseedConfirm !== 'RESET_TERMINAL_6') {
      toast.warning('Please type "RESET_TERMINAL_6" to confirm database reseed.');
      return;
    }

    setIsReseeding(true);
    try {
      const res = await apiRequest('/api/settings/reseed', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'RESET_TERMINAL_6' })
      });
      toast.success(res.message);
      setResetConfirm('');
      fetchSettings();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsReseeding(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h1>Cindermarch Studio // Hub Settings & Verification Gates</h1>
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

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Deadline Strikes & Suspension Governance Policy */}
          <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <div className="card-header">
              <div className="card-title">
                <AlertTriangle size={18} color="#EF4444" />
                <span>Deadline Strikes & Suspension Governance</span>
              </div>
              <span className="badge badge-changes-requested">5-STRIKE AUTO-SUSPENSION</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', marginBottom: '16px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Strike Threshold:</span>{' '}
                <strong className="mono">{strikePolicy?.max_strikes_threshold || 5} strikes</strong> (Automatic workspace suspension)
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Grace Period:</span>{' '}
                <strong className="mono">{strikePolicy?.grace_period_hours || 24} hours</strong> after task deadline
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Timezone:</span>{' '}
                <strong className="mono">{strikePolicy?.timezone || 'Africa/Cairo'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Discord DM Warnings:</span>{' '}
                <span className="badge badge-verified-complete" style={{ fontSize: '11px' }}>
                  {strikePolicy?.discord_dm_enabled !== false ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Workspace-Entry Warning:</span>{' '}
                <span className="badge badge-verified-complete" style={{ fontSize: '11px' }}>
                  {strikePolicy?.workspace_entry_modal_enabled !== false ? 'ACTIVE (DEDUPLICATED)' : 'DISABLED'}
                </span>
              </div>
            </div>

            {onNavigate && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => onNavigate('strikes')}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Open Studio Strikes & Governance Portal
              </button>
            )}
          </div>

          {/* System Health Diagnostics */}
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

          {/* Cindermarch Phoenix Mascot Settings */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Flame size={18} color="var(--accent-orange)" />
                <span>Cindermarch Phoenix Mascot</span>
              </div>
              <span className={`badge ${phoenixPrefs.enabled ? 'badge-verified-complete' : 'badge-blocked'}`}>
                {phoenixPrefs.enabled
                  ? phoenixPrefs.reducedMotion
                    ? 'STATIONARY'
                    : phoenixPrefs.speed === 'calm'
                    ? 'CALM PATROL'
                    : 'CORRIDOR ACTIVE'
                  : 'DISABLED'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Top Corridor Companion</strong>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Animated phoenix patrols dedicated top flight strip
                  </div>
                </div>
                <input
                  id="phoenix-toggle-enabled"
                  type="checkbox"
                  checked={phoenixPrefs.enabled}
                  onChange={(e) => handleUpdatePhoenixPref('enabled', e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-orange)', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Reduced Motion / Stationary</strong>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Keep avatar in gentle hover without horizontal roaming
                  </div>
                </div>
                <input
                  id="phoenix-toggle-reduced-motion"
                  type="checkbox"
                  checked={phoenixPrefs.reducedMotion}
                  onChange={(e) => handleUpdatePhoenixPref('reducedMotion', e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-orange)', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Flight Speed & Intensity</strong>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Calm (48px/s + long rests), Relaxed (56px/s), Normal (66px/s), Brisk (80px/s)
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['calm', 'relaxed', 'normal', 'brisk'] as const).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      className={`btn btn-sm ${phoenixPrefs.speed === spd ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '11px', padding: '2px 8px', textTransform: 'capitalize' }}
                      onClick={() => handleUpdatePhoenixPref('speed', spd)}
                    >
                      {spd}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Avatar Size</strong>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Dimensions of animated phoenix sprite
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['compact', 'normal', 'large'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`btn btn-sm ${phoenixPrefs.size === s ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '11px', padding: '2px 8px', textTransform: 'capitalize' }}
                      onClick={() => handleUpdatePhoenixPref('size', s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>Audio Chimes</strong>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Subtle chime sound on mascot interaction
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={!phoenixPrefs.muted}
                  onChange={(e) => handleUpdatePhoenixPref('muted', !e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-orange)', cursor: 'pointer' }}
                />
              </div>
            </div>
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
