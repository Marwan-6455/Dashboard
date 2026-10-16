import React, { useState, useEffect } from 'react';
import {
  Layers,
  Rocket,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Plus,
  FileText,
  ExternalLink,
  ShieldCheck,
  Check
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { Build, Release, BuildTarget, BuildStatus } from '../types/index.js';
import { useToast } from '../context/ToastContext.js';

interface BuildsReleasesPageProps {
  onNavigateToReports?: () => void;
}

export const BuildsReleasesPage: React.FC<BuildsReleasesPageProps> = ({ onNavigateToReports }) => {
  const { activeProjectId } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'builds' | 'releases'>('builds');
  const [builds, setBuilds] = useState<Build[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [isRegisterBuildModalOpen, setIsRegisterBuildModalOpen] = useState(false);
  const [isNewReleaseModalOpen, setIsNewReleaseModalOpen] = useState(false);

  // Build form
  const [buildNumber, setBuildNumber] = useState('');
  const [version, setVersion] = useState('v0.8.3-alpha');
  const [branch, setBranch] = useState('main');
  const [target, setTarget] = useState<BuildTarget>('Windows');
  const [changelog, setChangelog] = useState('');
  const [status, setStatus] = useState<BuildStatus>('Succeeded');

  // Release form
  const [releaseName, setReleaseName] = useState('');
  const [releaseVersion, setReleaseVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [buildsRes, releasesRes, readyRes] = await Promise.all([
        apiRequest(`/api/builds?projectId=${activeProjectId}`),
        apiRequest(`/api/releases?projectId=${activeProjectId}`),
        apiRequest(`/api/releases/readiness/evaluate?projectId=${activeProjectId}`)
      ]);
      setBuilds(buildsRes.builds || []);
      setReleases(releasesRes.releases || []);
      setReadiness(readyRes);
    } catch (err: any) {
      toast.error(`Failed to load build data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeProjectId]);

  const handleRegisterBuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buildNumber || !version) {
      toast.error('Build number and version are required.');
      return;
    }
    try {
      await apiRequest('/api/builds', {
        method: 'POST',
        body: JSON.stringify({
          project_id: activeProjectId,
          build_number: buildNumber,
          version,
          branch,
          build_target: target,
          unity_version: '6000.0.25f1',
          status,
          changelog
        })
      });
      toast.success('Unity build registered.');
      setIsRegisterBuildModalOpen(false);
      setBuildNumber('');
      setChangelog('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to register build.');
    }
  };

  const handleCreateRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseName || !releaseVersion) {
      toast.error('Release name and version are required.');
      return;
    }
    try {
      await apiRequest('/api/releases', {
        method: 'POST',
        body: JSON.stringify({
          project_id: activeProjectId,
          name: releaseName,
          version: releaseVersion,
          status: 'Released',
          notes: releaseNotes
        })
      });
      toast.success('Release candidate committed.');
      setIsNewReleaseModalOpen(false);
      setReleaseName('');
      setReleaseVersion('');
      setReleaseNotes('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create release.');
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Unity Build & Release Center</h1>
          <p className="page-subtitle">
            CI runner ingestion, artifact versioning, UTF test linkage, and automated release-readiness checklists.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsRegisterBuildModalOpen(true)}
          >
            <Plus size={16} /> Register Build Artifact
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsNewReleaseModalOpen(true)}
          >
            <Rocket size={16} /> Create Release
          </button>
        </div>
      </div>

      {/* Release Readiness Evaluator Card */}
      {readiness && (
        <div
          className="card"
          style={{
            marginBottom: '24px',
            borderLeft: readiness.ready ? '4px solid var(--status-green)' : '4px solid var(--status-amber)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <ShieldCheck size={18} color={readiness.ready ? 'var(--status-green)' : 'var(--status-amber)'} />
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)' }}>
                  Automated Release Readiness Evaluator
                </h3>
                <span className={`badge ${readiness.ready ? 'badge-success' : 'badge-amber'}`}>
                  {readiness.ready ? 'ALL GATES SATISFIED' : 'RELEASE BLOCKED / PENDING GATES'}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '20px', marginTop: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  {readiness.checklist?.testsPassed ? (
                    <CheckCircle2 size={16} color="var(--status-green)" />
                  ) : (
                    <XCircle size={16} color="var(--status-red)" />
                  )}
                  <span style={{ color: readiness.checklist?.testsPassed ? 'var(--text-white)' : 'var(--text-muted)' }}>
                    UTF Automated Tests Passed
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  {readiness.checklist?.noCriticalBugs ? (
                    <CheckCircle2 size={16} color="var(--status-green)" />
                  ) : (
                    <XCircle size={16} color="var(--status-red)" />
                  )}
                  <span style={{ color: readiness.checklist?.noCriticalBugs ? 'var(--text-white)' : 'var(--text-muted)' }}>
                    Zero Critical/Major QA Defects
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  {readiness.checklist?.buildSucceeded ? (
                    <CheckCircle2 size={16} color="var(--status-green)" />
                  ) : (
                    <XCircle size={16} color="var(--status-red)" />
                  )}
                  <span style={{ color: readiness.checklist?.buildSucceeded ? 'var(--text-white)' : 'var(--text-muted)' }}>
                    Target Build Artifact Succeeded
                  </span>
                </div>
              </div>

              {readiness.unmetRequirements?.length > 0 && (
                <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--status-red)' }}>
                  <strong>Blocking Conditions:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {readiness.unmetRequirements.map((req: string, i: number) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {onNavigateToReports && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onNavigateToReports}
              >
                <FileText size={14} /> Open UTF Test Reports
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'builds' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('builds')}
        >
          <Layers size={16} /> Build Artifacts ({builds.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'releases' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('releases')}
        >
          <Rocket size={16} /> Releases & Milestones ({releases.length})
        </button>
      </div>

      {/* Tab: Builds */}
      {activeTab === 'builds' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {builds.length === 0 ? (
            <div className="empty-state">No build records found for this project.</div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Build ID & Number</th>
                    <th>Version & Target</th>
                    <th>Status</th>
                    <th>Branch</th>
                    <th>Changelog</th>
                    <th>Registered At</th>
                  </tr>
                </thead>
                <tbody>
                  {builds.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-orange)' }}>
                          {b.build_number}
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {b.id}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>{b.version}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {b.build_target} • Unity {b.unity_version}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            b.status === 'Succeeded'
                              ? 'badge-success'
                              : b.status === 'Running'
                              ? 'badge-primary'
                              : 'badge-danger'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td style={{ fontSize: '12.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {b.branch}
                      </td>
                      <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                        {b.changelog || 'No changelog recorded.'}
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {b.created_at.slice(0, 16).replace('T', ' ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Releases */}
      {activeTab === 'releases' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {releases.length === 0 ? (
            <div className="empty-state">No formal releases registered yet.</div>
          ) : (
            releases.map((rel) => (
              <div key={rel.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)' }}>
                      {rel.name}
                    </h3>
                    <div style={{ fontSize: '12px', color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                      Version {rel.version}
                    </div>
                  </div>
                  <span className="badge badge-success">{rel.status}</span>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  {rel.notes || 'No release notes.'}
                </div>

                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  <span>Released by: <strong style={{ color: 'var(--text-secondary)' }}>{rel.creator_name || 'Marwan Hossam'}</strong></span>
                  <span>•</span>
                  <span>Date: {rel.created_at.slice(0, 10)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal: Register Build */}
      {isRegisterBuildModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Register Unity Build</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsRegisterBuildModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleRegisterBuild}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Build Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. B-083"
                      value={buildNumber}
                      onChange={(e) => setBuildNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">Version</label>
                    <input
                      type="text"
                      className="form-input"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Target Platform</label>
                    <select
                      className="form-input"
                      value={target}
                      onChange={(e) => setTarget(e.target.value as BuildTarget)}
                    >
                      <option value="Windows">Windows (Steam)</option>
                      <option value="Linux">Linux</option>
                      <option value="macOS">macOS</option>
                      <option value="PS5">PlayStation 5</option>
                      <option value="Xbox">Xbox Series X</option>
                      <option value="Switch">Nintendo Switch</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <select
                      className="form-input"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as BuildStatus)}
                    >
                      <option value="Succeeded">Succeeded</option>
                      <option value="Running">Running</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Changelog & Changesets</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Summary of code, asset, or scene modifications included in this build..."
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRegisterBuildModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Record Build
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Release */}
      {isNewReleaseModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Release Candidate</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsNewReleaseModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateRelease}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Release Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Terminal 6 Studio Alpha 1.0"
                    value={releaseName}
                    onChange={(e) => setReleaseName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Version Tag</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. v1.0.0-alpha"
                    value={releaseVersion}
                    onChange={(e) => setReleaseVersion(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Release Notes</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Highlights, known accepted limitations, and test verification summary..."
                    value={releaseNotes}
                    onChange={(e) => setReleaseNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsNewReleaseModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Publish Release
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
