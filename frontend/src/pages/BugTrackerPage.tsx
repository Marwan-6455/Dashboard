import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Filter,
  Plus,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronDown,
  RotateCcw
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { Bug, BugSeverity, BugStatus, Priority } from '../types/index.js';
import { useToast } from '../context/ToastContext.js';

interface BugTrackerPageProps {
  onNavigateToTask?: (taskId: string) => void;
}

export const BugTrackerPage: React.FC<BugTrackerPageProps> = ({ onNavigateToTask }) => {
  const { activeProjectId, user } = useAuth();
  const toast = useToast();

  const [bugs, setBugs] = useState<Bug[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [summary, setSummary] = useState<any>(null);

  // Modal states
  const [isNewBugModalOpen, setIsNewBugModalOpen] = useState<boolean>(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [selectedBugForVerification, setSelectedBugForVerification] = useState<Bug | null>(null);
  const [verificationPassed, setVerificationPassed] = useState<boolean>(true);
  const [verificationNotes, setVerificationNotes] = useState<string>('');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<BugSeverity>('Major');
  const [priority, setPriority] = useState<Priority>('P1');
  const [affectedBuild, setAffectedBuild] = useState('v0.8.2-alpha');
  const [platform, setPlatform] = useState('PC/Steam');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const [bugsRes, sumRes] = await Promise.all([
        apiRequest(`/api/bugs?projectId=${activeProjectId}&status=${filterStatus}&severity=${filterSeverity}`),
        apiRequest(`/api/bugs/triage/summary?projectId=${activeProjectId}`)
      ]);
      setBugs(bugsRes.bugs || []);
      setSummary(sumRes);
    } catch (err: any) {
      toast.error(`Failed to load QA bugs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugs();
  }, [activeProjectId, filterSeverity, filterStatus]);

  const handleCreateBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description) {
      toast.error('Title and description are required.');
      return;
    }
    try {
      await apiRequest('/api/bugs', {
        method: 'POST',
        body: JSON.stringify({
          project_id: activeProjectId,
          title,
          description,
          severity,
          priority,
          affected_build: affectedBuild,
          affected_platform: platform,
          steps_to_reproduce: steps,
          expected_behavior: expected,
          actual_behavior: actual
        })
      });
      toast.success('Bug report filed in QA Lab.');
      setIsNewBugModalOpen(false);
      setTitle('');
      setDescription('');
      setSteps('');
      setExpected('');
      setActual('');
      fetchBugs();
    } catch (err: any) {
      toast.error(err.message || 'Failed to file bug.');
    }
  };

  const handleOpenVerifyModal = (bug: Bug) => {
    setSelectedBugForVerification(bug);
    setVerificationPassed(true);
    setVerificationNotes('');
    setIsVerifyModalOpen(true);
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBugForVerification) return;
    try {
      await apiRequest(`/api/bugs/${selectedBugForVerification.id}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          passed: verificationPassed,
          notes: verificationNotes
        })
      });
      toast.success(
        verificationPassed
          ? `Bug ${selectedBugForVerification.id} verified and resolved by QA.`
          : `Bug ${selectedBugForVerification.id} reopened with QA rejection notes.`
      );
      setIsVerifyModalOpen(false);
      setSelectedBugForVerification(null);
      fetchBugs();
    } catch (err: any) {
      toast.error(err.message || 'Verification submission failed.');
    }
  };

  const filteredBugs = bugs.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.id.toLowerCase().includes(q) ||
      b.title.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">QA Lab & Bug Tracker</h1>
          <p className="page-subtitle">
            Defect lifecycle, reproduction telemetry, and strict QA verification gates.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsNewBugModalOpen(true)}
        >
          <Plus size={16} /> Report QA Bug
        </button>
      </div>

      {/* Triage Telemetry Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Open</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-white)', marginTop: '4px' }}>
              {summary.open}
            </div>
          </div>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Critical / P0</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--status-red)', marginTop: '4px' }}>
              {summary.critical}
            </div>
          </div>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fixed Awaiting QA</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-orange)', marginTop: '4px' }}>
              {summary.fixedAwaitingQA}
            </div>
          </div>
          <div className="card" style={{ padding: '14px' }}>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Verified Closed</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--status-green)', marginTop: '4px' }}>
              {summary.verified}
            </div>
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            className="form-input"
            style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
            placeholder="Search bugs by ID, description, or title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="form-input"
          style={{ width: '160px', padding: '6px 10px', fontSize: '13px' }}
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
        >
          <option value="">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="Major">Major</option>
          <option value="Minor">Minor</option>
          <option value="Trivial">Trivial</option>
        </select>

        <select
          className="form-input"
          style={{ width: '170px', padding: '6px 10px', fontSize: '13px' }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Reported">Reported</option>
          <option value="Confirmed">Confirmed</option>
          <option value="In Progress">In Progress</option>
          <option value="Fixed">Fixed (Needs QA)</option>
          <option value="Verified">Verified</option>
          <option value="Reopened">Reopened</option>
        </select>

        {(filterSeverity || filterStatus || searchQuery) && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setFilterSeverity('');
              setFilterStatus('');
              setSearchQuery('');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Bugs Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Retrieving QA defects...
          </div>
        ) : filteredBugs.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={36} color="var(--status-green)" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)' }}>
              No defects match the current filter
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              QA Lab has zero unverified bugs for this criteria.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>Bug ID</th>
                  <th>Defect Summary & Reproduction</th>
                  <th style={{ width: '110px' }}>Severity</th>
                  <th style={{ width: '120px' }}>Status</th>
                  <th style={{ width: '130px' }}>Build & Target</th>
                  <th style={{ width: '140px' }}>Assignee</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBugs.map((bug) => (
                  <tr key={bug.id}>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-orange)' }}>
                        {bug.id}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-white)', fontSize: '13.5px' }}>
                        {bug.title}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px', maxWidth: '500px' }}>
                        {bug.description}
                      </div>
                      {bug.steps_to_reproduce && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
                          Steps: {bug.steps_to_reproduce.slice(0, 90)}...
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          bug.severity === 'Critical'
                            ? 'badge-danger'
                            : bug.severity === 'Major'
                            ? 'badge-amber'
                            : 'badge-neutral'
                        }`}
                      >
                        {bug.severity}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          bug.status === 'Verified'
                            ? 'badge-success'
                            : bug.status === 'Fixed'
                            ? 'badge-primary'
                            : bug.status === 'Reopened'
                            ? 'badge-danger'
                            : 'badge-neutral'
                        }`}
                      >
                        {bug.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <div>{bug.affected_build || 'v0.8.2'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{bug.affected_platform}</div>
                    </td>
                    <td style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      {bug.assignee_name || 'Unassigned'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        {bug.status === 'Fixed' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleOpenVerifyModal(bug)}
                            title="Verify defect fix as QA tester"
                          >
                            <ShieldCheck size={14} /> QA Verify
                          </button>
                        )}
                        {bug.related_task_id && onNavigateToTask && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onNavigateToTask(bug.related_task_id!)}
                            title="Open related task"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: File Bug Report */}
      {isNewBugModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 className="modal-title">File QA Defect Report</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsNewBugModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateBug}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Defect Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Sub-level train car collision mesh inverted"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Severity</label>
                    <select
                      className="form-input"
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as BugSeverity)}
                    >
                      <option value="Critical">Critical (Blocker)</option>
                      <option value="Major">Major</option>
                      <option value="Minor">Minor</option>
                      <option value="Trivial">Trivial</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Priority</label>
                    <select
                      className="form-input"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as Priority)}
                    >
                      <option value="P0">P0 (Immediate)</option>
                      <option value="P1">P1 (High)</option>
                      <option value="P2">P2 (Normal)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="form-label">Detailed Description</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Summary of what failed and in what context"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Steps to Reproduce</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="1. Enter Platform 4 Subway Car&#10;2. Crouch near door latch&#10;3. Trigger reality shift"
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Expected Behavior</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Expected outcome"
                      value={expected}
                      onChange={(e) => setExpected(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">Actual Behavior</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Observed glitch"
                      value={actual}
                      onChange={(e) => setActual(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsNewBugModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit to QA Lab
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: QA Verification Gate */}
      {isVerifyModalOpen && selectedBugForVerification && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">QA Verification Gate: {selectedBugForVerification.id}</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsVerifyModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleVerifySubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-white)', fontSize: '13.5px' }}>
                    {selectedBugForVerification.title}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Developer has marked this defect as <strong>Fixed</strong>. As an authorized QA tester or reviewer, confirm if this fix passes verification.
                  </div>
                </div>

                <div>
                  <label className="form-label">QA Retest Outcome</label>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className={`btn ${verificationPassed ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setVerificationPassed(true)}
                    >
                      <CheckCircle2 size={15} /> Pass & Mark Verified
                    </button>
                    <button
                      type="button"
                      className={`btn ${!verificationPassed ? 'btn-danger' : 'btn-secondary'}`}
                      style={{ flex: 1 }}
                      onClick={() => setVerificationPassed(false)}
                    >
                      <RotateCcw size={15} /> Fail & Reopen
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label">Verification Notes / Evidence</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Document test environment, test build ID, and verified behaviors..."
                    value={verificationNotes}
                    onChange={(e) => setVerificationNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsVerifyModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm QA Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
