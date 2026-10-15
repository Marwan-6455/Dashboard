import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Plus,
  GitCommit,
  FileCheck2,
  FileImage,
  FileText,
  MessageSquare,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Send,
  Download,
  Trash2,
  Edit,
  ExternalLink
} from 'lucide-react';
import { Task, TaskStatus, Priority } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { PriorityBadge } from '../components/PriorityBadge.js';
import { GateStatusWidget } from '../components/GateStatusWidget.js';
import { ChangesetModal } from '../components/ChangesetModal.js';
import { ReviewModal } from '../components/ReviewModal.js';
import { EvidenceModal } from '../components/EvidenceModal.js';
import { TestReportModal } from '../components/TestReportModal.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';

interface TaskDetailPageProps {
  taskId: string;
  onBack: () => void;
  onEditTask: (task: Task) => void;
  teamUsers?: any[];
}

export const TaskDetailPage: React.FC<TaskDetailPageProps> = ({
  taskId,
  onBack,
  onEditTask,
  teamUsers = []
}) => {
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'criteria' | 'changesets' | 'reviews' | 'evidence' | 'tests' | 'comments'>('details');

  // New criterion input
  const [newCriterionTitle, setNewCriterionTitle] = useState('');
  // New comment input
  const [newComment, setNewComment] = useState('');

  // Modals
  const [isChangesetModalOpen, setIsChangesetModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewModalMode, setReviewModalMode] = useState<'request' | 'decision'>('request');
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [isTestReportModalOpen, setIsTestReportModalOpen] = useState(false);

  const fetchTask = async () => {
    try {
      setIsLoading(true);
      const res = await apiRequest(`/api/tasks/${taskId}`);
      setTask(res.task);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      await apiRequest(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      fetchTask();
    } catch (err: any) {
      alert(`Cannot move to ${newStatus}:\n\n${err.message}`);
      fetchTask(); // reset UI
    }
  };

  const handleToggleCriterion = async (critId: string, currentStatus: number) => {
    try {
      await apiRequest(`/api/tasks/${taskId}/criteria/${critId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isSatisfied: currentStatus === 1 ? false : true })
      });
      fetchTask();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCriterionTitle.trim()) return;

    try {
      await apiRequest(`/api/tasks/${taskId}/criteria`, {
        method: 'POST',
        body: JSON.stringify({ title: newCriterionTitle.trim() })
      });
      setNewCriterionTitle('');
      fetchTask();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      await apiRequest(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: newComment.trim() })
      });
      setNewComment('');
      fetchTask();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUnlinkChangeset = async (csId: string) => {
    if (!confirm('Unlink this changeset reference from the task?')) return;
    try {
      await apiRequest(`/api/tasks/${taskId}/changesets/${csId}`, {
        method: 'DELETE'
      });
      fetchTask();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="page-wrapper">
        <div style={{ color: 'var(--text-secondary)', padding: '40px 0' }}>
          Loading task {taskId}...
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="page-wrapper">
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: '16px' }}>
          <ArrowLeft size={16} /> Back to Tasks
        </button>
        <div className="alert alert-error">Error loading task: {error || 'Task not found'}</div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      {/* Top Breadcrumb & Action Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Tasks
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            className="form-control"
            style={{ width: 'auto', fontWeight: 600 }}
            value={task.status}
            onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
          >
            <option value="Backlog">Backlog</option>
            <option value="In Progress">In Progress</option>
            <option value="Ready for Review">Ready for Review</option>
            <option value="Changes Requested">Changes Requested</option>
            <option value="Ready to Integrate">Ready to Integrate</option>
            <option value="Verified Complete">Verified Complete</option>
            <option value="Blocked">Blocked</option>
          </select>

          <button className="btn btn-secondary btn-sm" onClick={() => onEditTask(task)}>
            <Edit size={14} /> Edit Task
          </button>
        </div>
      </div>

      {/* Task Heading */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-orange)' }}>
            {task.id}
          </span>
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
          {task.completed_at && (
            <span className="badge badge-verified-complete">
              COMPLETED ON {new Date(task.completed_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-white)' }}>
          {task.title}
        </h1>
      </div>

      {/* Completion Gate Status Banner */}
      <GateStatusWidget gateStatus={task.completion_gate_status} />

      {/* Tab Navigation */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Overview & Context
        </button>
        <button
          className={`tab-btn ${activeTab === 'criteria' ? 'active' : ''}`}
          onClick={() => setActiveTab('criteria')}
        >
          Acceptance Criteria ({task.acceptance_criteria?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'changesets' ? 'active' : ''}`}
          onClick={() => setActiveTab('changesets')}
        >
          UVCS Changesets ({task.changesets?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Peer Reviews ({task.reviews?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'evidence' ? 'active' : ''}`}
          onClick={() => setActiveTab('evidence')}
        >
          Evidence ({task.evidence?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'tests' ? 'active' : ''}`}
          onClick={() => setActiveTab('tests')}
        >
          Test Reports ({task.test_reports?.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          Comments ({task.comments?.length || 0})
        </button>
      </div>

      {/* Tab: Details */}
      {activeTab === 'details' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Technical Description & Scope</div>
            </div>
            <div style={{ fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap', color: 'var(--text-white)' }}>
              {task.description}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Task Metadata & Roles</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Owner (Developer):</span>{' '}
                <strong>{task.owner_name || 'Unassigned'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Designated Reviewer:</span>{' '}
                <strong>{task.reviewer_name || 'None'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Created By:</span>{' '}
                <strong>{task.creator_name || 'System'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Target Milestone Deadline:</span>{' '}
                <strong className="mono">
                  {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'None scheduled'}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Last Updated:</span>{' '}
                <span className="mono">{new Date(task.updated_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Acceptance Criteria */}
      {activeTab === 'criteria' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Task Acceptance Criteria (Gate 1)</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {task.acceptance_criteria?.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <p>No acceptance criteria defined yet. Add at least one criterion to satisfy the completion gate.</p>
              </div>
            ) : (
              task.acceptance_criteria?.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleToggleCriterion(c.id, c.is_satisfied)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {c.is_satisfied === 1 ? (
                      <CheckCircle2 size={18} color="var(--status-complete)" />
                    ) : (
                      <Circle size={18} color="var(--text-muted)" />
                    )}
                    <span
                      style={{
                        fontSize: '13.5px',
                        color: c.is_satisfied === 1 ? 'var(--text-white)' : 'var(--text-secondary)',
                        textDecoration: c.is_satisfied === 1 ? 'line-through' : 'none'
                      }}
                    >
                      {c.title}
                    </span>
                  </div>

                  {c.is_satisfied === 1 && (
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--status-complete)' }}>
                      Satisfied {c.satisfied_by_name ? `by ${c.satisfied_by_name}` : ''}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddCriterion} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Add another verifiable acceptance criterion..."
              value={newCriterionTitle}
              onChange={(e) => setNewCriterionTitle(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary">
              <Plus size={16} /> Add
            </button>
          </form>
        </div>
      )}

      {/* Tab: UVCS Changesets */}
      {activeTab === 'changesets' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Unity Version Control (UVCS) Changesets (Gate 2)</div>
            <button className="btn btn-primary btn-sm" onClick={() => setIsChangesetModalOpen(true)}>
              <Plus size={14} /> Link Changeset
            </button>
          </div>

          {task.is_changeset_exempt === 1 && (
            <div className="alert alert-warning">
              <div>
                <strong>Changeset Exemption Active:</strong> {task.changeset_exemption_reason || 'Non-code task'}.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {task.changesets?.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <GitCommit size={32} />
                <h3>No UVCS Changesets Linked</h3>
                <p>Record the Plastic SCM / Unity Version Control changeset ID to satisfy the code verification gate.</p>
                <button className="btn btn-secondary btn-sm" onClick={() => setIsChangesetModalOpen(true)}>
                  Link Changeset
                </button>
              </div>
            ) : (
              task.changesets?.map((cs) => (
                <div
                  key={cs.id}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="mono" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-orange)' }}>
                        {cs.changeset_id}
                      </span>
                      <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        branch: {cs.branch || '/main'}
                      </span>
                      <span className="demo-tag">MANUALLY RECORDED</span>
                    </div>

                    <button
                      className="logout-btn"
                      title="Unlink"
                      onClick={() => handleUnlinkChangeset(cs.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div style={{ fontSize: '13px', color: 'var(--text-white)', marginBottom: '6px' }}>
                    {cs.comment}
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Author: <strong>{cs.author}</strong> • Recorded in hub by {cs.linked_by_name || 'Developer'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Reviews */}
      {activeTab === 'reviews' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Peer Review History & Gates (Gate 3)</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setReviewModalMode('request');
                  setIsReviewModalOpen(true);
                }}
              >
                Request Review
              </button>
              {task.reviews?.some((r) => r.decision === 'Pending') && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setReviewModalMode('decision');
                    setIsReviewModalOpen(true);
                  }}
                >
                  Submit Decision
                </button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {task.reviews?.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <FileCheck2 size={32} />
                <h3>No Peer Reviews Conducted</h3>
                <p>Request an independent studio developer to review this implementation before it can be marked complete.</p>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setReviewModalMode('request');
                    setIsReviewModalOpen(true);
                  }}
                >
                  Request Review
                </button>
              </div>
            ) : (
              task.reviews?.map((rev) => (
                <div
                  key={rev.id}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        className={`badge ${
                          rev.decision === 'Approved'
                            ? 'badge-verified-complete'
                            : rev.decision === 'Changes Requested'
                            ? 'badge-changes-requested'
                            : rev.decision === 'Pending'
                            ? 'badge-ready-for-review'
                            : 'badge-blocked'
                        }`}
                      >
                        {rev.decision}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Developer: <strong>{rev.developer_name}</strong> • Reviewer: <strong>{rev.reviewer_name}</strong>
                      </span>
                    </div>

                    {rev.decision === 'Pending' && user && rev.reviewer_id === user.id && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setReviewModalMode('decision');
                          setIsReviewModalOpen(true);
                        }}
                      >
                        Submit Decision
                      </button>
                    )}
                  </div>

                  {rev.findings && (
                    <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-white)' }}>
                      <strong>Findings:</strong> {rev.findings}
                    </div>
                  )}

                  {rev.required_fixes && (
                    <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--status-changes)' }}>
                      <strong>Required Fixes:</strong> {rev.required_fixes}
                    </div>
                  )}

                  {rev.checklist && rev.checklist.length > 0 && (
                    <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        VERIFIED CHECKLIST:
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '4px' }}>
                        {rev.checklist.map((item: any) => (
                          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px' }}>
                            {item.passed ? (
                              <CheckCircle2 size={13} color="var(--status-complete)" />
                            ) : (
                              <Circle size={13} color="var(--text-muted)" />
                            )}
                            <span style={{ color: item.passed ? 'var(--text-white)' : 'var(--text-secondary)' }}>
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Evidence */}
      {activeTab === 'evidence' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Verification Evidence Artifacts (Gate 4)</div>
            <button className="btn btn-primary btn-sm" onClick={() => setIsEvidenceModalOpen(true)}>
              <Plus size={14} /> Attach Evidence
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {task.evidence?.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <FileImage size={32} />
                <h3>No Evidence Uploaded</h3>
                <p>Attach in-editor screenshots, video clips, or Unity profile/test logs to prove completion.</p>
                <button className="btn btn-secondary btn-sm" onClick={() => setIsEvidenceModalOpen(true)}>
                  Attach Evidence
                </button>
              </div>
            ) : (
              task.evidence?.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="badge badge-backlog">{ev.evidence_type.toUpperCase()}</span>
                      <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-white)' }}>
                        {ev.original_filename}
                      </span>
                      {ev.file_size > 0 && (
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          ({(ev.file_size / 1024).toFixed(1)} KB)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                      {ev.description}
                    </div>
                  </div>

                  <div>
                    {ev.stored_filename ? (
                      <a
                        href={`/api/evidence/${ev.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        <Download size={14} /> View File
                      </a>
                    ) : ev.external_url ? (
                      <a
                        href={ev.external_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                      >
                        <ExternalLink size={14} /> Open Link
                      </a>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Tests */}
      {activeTab === 'tests' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Unity Test Framework Reports (Gate 5)</div>
            <button className="btn btn-primary btn-sm" onClick={() => setIsTestReportModalOpen(true)}>
              <Plus size={14} /> Record Test Run
            </button>
          </div>

          {task.is_test_exempt === 1 && (
            <div className="alert alert-warning">
              <div>
                <strong>Automated Test Exemption Active:</strong> {task.test_exemption_reason || 'Non-testable scope'}.
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {task.test_reports?.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <FileText size={32} />
                <h3>No Test Reports on Record</h3>
                <p>Record a passing test run for this task or its associated changeset revision.</p>
                <button className="btn btn-secondary btn-sm" onClick={() => setIsTestReportModalOpen(true)}>
                  Record Test Run
                </button>
              </div>
            ) : (
              task.test_reports?.map((rpt) => (
                <div
                  key={rpt.id}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-white)' }}>
                        {rpt.test_suite}
                      </span>
                      <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        rev: {rpt.revision}
                      </span>
                      {rpt.source === 'manual' && <span className="demo-tag">MANUAL ENTRY</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Passed: <strong style={{ color: 'var(--status-complete)' }}>{rpt.passed_count}</strong> • Failed: <strong style={{ color: 'var(--status-changes)' }}>{rpt.failed_count}</strong> • Unity {rpt.unity_version} • Runner: {rpt.runner_identity}
                    </div>
                  </div>

                  <span
                    className={`badge ${
                      rpt.result === 'Passed' ? 'badge-verified-complete' : 'badge-changes-requested'
                    }`}
                  >
                    {rpt.result}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Comments */}
      {activeTab === 'comments' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Development Discussion</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {task.comments?.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <MessageSquare size={32} />
                <p>No comments on this task yet.</p>
              </div>
            ) : (
              task.comments?.map((c) => (
                <div
                  key={c.id}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '13px', color: 'var(--text-white)' }}>
                      {c.user_name}
                    </strong>
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {c.content}
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
              className="form-control"
              placeholder="Post a technical comment, bug note, or implementation update..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary btn-sm">
                <Send size={14} /> Post Comment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modals */}
      <ChangesetModal
        isOpen={isChangesetModalOpen}
        onClose={() => setIsChangesetModalOpen(false)}
        onChangesetLinked={fetchTask}
        taskId={taskId}
      />

      <ReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onReviewSubmitted={fetchTask}
        mode={reviewModalMode}
        task={task}
        reviewToDecide={task.reviews?.find((r) => r.decision === 'Pending')}
        teamUsers={teamUsers}
      />

      <EvidenceModal
        isOpen={isEvidenceModalOpen}
        onClose={() => setIsEvidenceModalOpen(false)}
        onEvidenceUploaded={fetchTask}
        defaultTaskId={taskId}
        tasks={[task]}
      />

      <TestReportModal
        isOpen={isTestReportModalOpen}
        onClose={() => setIsTestReportModalOpen(false)}
        onReportSaved={fetchTask}
        defaultTaskId={taskId}
        tasks={[task]}
      />
    </div>
  );
};
