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
  Send,
  Download,
  Trash2,
  Edit,
  ExternalLink,
  Calendar,
  AlertTriangle,
  X,
  Play,
  ArrowRight,
  ShieldAlert,
  HelpCircle
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
import { useToast } from '../context/ToastContext.js';

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
  const { user, hasRole, canManageTasks } = useAuth();
  const toast = useToast();
  const canManage = canManageTasks();
  const isAdminOrOwner = canManage;

  const [task, setTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Consolidated 3 streamlined tabs: 'work', 'reviews', 'discussion'
  const [activeTab, setActiveTab] = useState<'work' | 'reviews' | 'discussion'>('work');

  // Input states
  const [newCriterionTitle, setNewCriterionTitle] = useState('');
  const [newComment, setNewComment] = useState('');

  // Modals
  const [isChangesetModalOpen, setIsChangesetModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewModalMode, setReviewModalMode] = useState<'request' | 'decision'>('request');
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [isTestReportModalOpen, setIsTestReportModalOpen] = useState(false);

  // Strike Policy deadline modals
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [newExtendedDeadline, setNewExtendedDeadline] = useState('');
  const [extensionReason, setExtensionReason] = useState('');
  const [isSubmittingExtension, setIsSubmittingExtension] = useState(false);

  const [isExemptModalOpen, setIsExemptModalOpen] = useState(false);
  const [exemptionReason, setExemptionReason] = useState('');
  const [isSubmittingExemption, setIsSubmittingExemption] = useState(false);

  // Developer deadline extension request modal state
  const [isRequestExtensionModalOpen, setIsRequestExtensionModalOpen] = useState(false);
  const [requestedExtensionDeadline, setRequestedExtensionDeadline] = useState('');
  const [requestedExtensionReason, setRequestedExtensionReason] = useState('');
  const [isSubmittingExtensionRequest, setIsSubmittingExtensionRequest] = useState(false);

  const fetchTask = async () => {
    try {
      setIsLoading(true);
      const res = await apiRequest(`/api/tasks/${taskId}`);
      setTask(res.task);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      toast.error(`Failed to load task details: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTask();
  }, [taskId]);

  const handleExtendDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExtendedDeadline || !extensionReason) {
      toast.warning('Please provide both the new deadline and an approved justification reason.');
      return;
    }
    setIsSubmittingExtension(true);
    try {
      await apiRequest(`/api/tasks/${taskId}/extend-deadline`, {
        method: 'POST',
        body: JSON.stringify({
          extendedDeadline: newExtendedDeadline,
          reason: extensionReason
        })
      });
      setIsExtendModalOpen(false);
      setNewExtendedDeadline('');
      setExtensionReason('');
      toast.success('Deadline extension recorded and deadline reset.');
      fetchTask();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingExtension(false);
    }
  };

  const handleExemptDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exemptionReason) {
      toast.warning('Please document a valid reason for exempting this deadline from strikes.');
      return;
    }
    setIsSubmittingExemption(true);
    try {
      await apiRequest(`/api/tasks/${taskId}/exempt-deadline`, {
        method: 'POST',
        body: JSON.stringify({
          reason: exemptionReason
        })
      });
      setIsExemptModalOpen(false);
      setExemptionReason('');
      toast.success('Task deadline exempted from strike evaluation.');
      fetchTask();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmittingExemption(false);
    }
  };

  const handleRequestExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedExtensionDeadline || !requestedExtensionReason.trim()) {
      toast.warning('Please provide both the proposed deadline and justification reason.');
      return;
    }
    setIsSubmittingExtensionRequest(true);
    try {
      await apiRequest(`/api/tasks/${taskId}/request-extension`, {
        method: 'POST',
        body: JSON.stringify({
          requestedDeadline: requestedExtensionDeadline,
          reason: requestedExtensionReason.trim()
        })
      });
      setIsRequestExtensionModalOpen(false);
      setRequestedExtensionDeadline('');
      setRequestedExtensionReason('');
      toast.success('Deadline extension request submitted to Team Leadership.');
      fetchTask();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit extension request.');
    } finally {
      setIsSubmittingExtensionRequest(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    if (!window.confirm(`Are you sure you want to permanently delete task ${task.id}? This action cannot be undone.`)) {
      return;
    }
    try {
      await apiRequest(`/api/tasks/${taskId}`, { method: 'DELETE' });
      toast.success(`Task ${task.id} has been deleted.`);
      onBack();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete task.');
    }
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    try {
      await apiRequest(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      toast.success(`Task status moved to ${newStatus}`);
      fetchTask();
    } catch (err: any) {
      toast.error(`Cannot move to ${newStatus}: ${err.message}`);
      fetchTask();
    }
  };

  const handleToggleCriterion = async (critId: string, currentStatus: number) => {
    try {
      await apiRequest(`/api/tasks/${taskId}/criteria/${critId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isSatisfied: currentStatus === 1 ? false : true })
      });
      toast.success('Acceptance criterion updated.');
      fetchTask();
    } catch (err: any) {
      toast.error(err.message);
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
      toast.success('Acceptance criterion added.');
      fetchTask();
    } catch (err: any) {
      toast.error(err.message);
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
      toast.success('Comment posted to task record.');
      fetchTask();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUnlinkChangeset = async (csId: string) => {
    try {
      await apiRequest(`/api/tasks/${taskId}/changesets/${csId}`, {
        method: 'DELETE'
      });
      toast.success('UVCS changeset unlinked.');
      fetchTask();
    } catch (err: any) {
      toast.error(err.message);
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

  // Next Action Guidance computation
  const isOwner = !!(user && task.owner_id === user.id);
  const isReviewer = !!(user && task.reviewer_id === user.id);
  const hasPendingReview = task.reviews?.some((r) => r.decision === 'Pending');

  const renderNextActionBanner = () => {
    switch (task.status) {
      case 'Backlog':
        return (
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-progress)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                NEXT ACTION: READY TO BEGIN
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-white)', marginTop: '2px' }}>
                This task is currently in Backlog. When you are ready to start engineering, move it to In Progress.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleStatusChange('In Progress')}
            >
              <Play size={14} />
              <span>Start Work (In Progress)</span>
            </button>
          </div>
        );

      case 'In Progress':
        return (
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-review)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                NEXT ACTION: DEVELOPMENT IN PROGRESS
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-white)', marginTop: '2px' }}>
                Complete checklist criteria, link changesets/evidence, and submit for peer review when ready.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEvidenceModalOpen(true)}
              >
                <FileImage size={14} />
                <span>Attach Evidence</span>
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setReviewModalMode('request');
                  setIsReviewModalOpen(true);
                }}
              >
                <FileCheck2 size={14} />
                <span>Submit for Review</span>
              </button>
            </div>
          </div>
        );

      case 'Ready for Review':
        return (
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(251, 146, 60, 0.08)',
              border: '1px solid rgba(251, 146, 60, 0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-changes)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                NEXT ACTION: PEER REVIEW EVALUATION
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-white)', marginTop: '2px' }}>
                {isReviewer
                  ? 'You are the designated reviewer for this task. Inspect evidence and code changes, then approve or request changes.'
                  : isOwner
                  ? `Task submitted for review. Awaiting evaluation from ${task.reviewer_name || 'designated reviewer'}.`
                  : `Awaiting peer review evaluation from ${task.reviewer_name || 'reviewer'}.`}
              </div>
            </div>
            <div>
              {(isReviewer || isAdminOrOwner) && !isOwner && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setReviewModalMode('decision');
                    setIsReviewModalOpen(true);
                  }}
                >
                  <FileCheck2 size={14} />
                  <span>Conduct Review (Approve / Changes)</span>
                </button>
              )}
            </div>
          </div>
        );

      case 'Changes Requested':
        return (
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-blocked)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                NEXT ACTION: ITERATION REQUIRED
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-white)', marginTop: '2px' }}>
                Reviewer requested changes. See feedback under Quality & Reviews tab, address findings, and re-submit.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setReviewModalMode('request');
                setIsReviewModalOpen(true);
              }}
            >
              <FileCheck2 size={14} />
              <span>Re-submit for Review</span>
            </button>
          </div>
        );

      case 'Ready to Integrate':
        return (
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(167, 139, 250, 0.08)',
              border: '1px solid rgba(167, 139, 250, 0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-integrate)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                NEXT ACTION: READY TO INTEGRATE
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-white)', marginTop: '2px' }}>
                Peer review passed! Merge changesets to main branch and mark verified complete once verified in engine build.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleStatusChange('Verified Complete')}
            >
              <CheckCircle2 size={14} />
              <span>Mark Verified Complete</span>
            </button>
          </div>
        );

      case 'Verified Complete':
        return (
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <CheckCircle2 size={18} color="var(--status-complete)" />
            <div style={{ fontSize: '13px', color: 'var(--status-complete)', fontWeight: 600 }}>
              VERIFIED COMPLETE: All six completion gates satisfied and audited.
            </div>
          </div>
        );

      case 'Blocked':
        return (
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '14px',
              flexWrap: 'wrap'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                NEXT ACTION: RESOLVE BLOCKER
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-white)', marginTop: '2px' }}>
                Task is marked as Blocked. Post notes on the dependency in discussion or coordinate with team lead.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleStatusChange('In Progress')}
            >
              <span>Unblock (Move In Progress)</span>
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="page-wrapper">
      {/* Top Breadcrumb & Action Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Tasks
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {canManage ? (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setNewExtendedDeadline(task.extended_deadline || task.deadline || '');
                  setIsExtendModalOpen(true);
                }}
              >
                <Calendar size={14} /> Extend Deadline
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setExemptionReason(task.deadline_exemption_reason || '');
                  setIsExemptModalOpen(true);
                }}
              >
                <ShieldCheck size={14} /> {task.is_deadline_exempt === 1 ? 'Update Exemption' : 'Exempt from Strikes'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEditTask(task)}>
                <Edit size={14} /> Edit Task
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.35)' }}
                onClick={handleDeleteTask}
                title="Permanently remove task (Leadership Only)"
              >
                <Trash2 size={14} /> Delete
              </button>
            </>
          ) : (
            <>
              {isOwner && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const currentDl = task.extended_deadline || task.deadline;
                    setRequestedExtensionDeadline(currentDl ? currentDl.slice(0, 10) : '');
                    setIsRequestExtensionModalOpen(true);
                  }}
                  title="Request a deadline extension from Team Leadership"
                >
                  <Clock size={14} color="var(--accent-orange)" /> Request Extension
                </button>
              )}
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-elevated)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <ShieldAlert size={13} color="var(--accent-orange)" /> Managed by Team Leadership
              </span>
            </>
          )}

          {!canManage && !isOwner ? (
            <StatusBadge status={task.status} />
          ) : (
            <select
              className="form-control"
              style={{ width: 'auto', fontWeight: 600 }}
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
            >
              {(canManage
                ? ['Backlog', 'In Progress', 'Ready for Review', 'Changes Requested', 'Ready to Integrate', 'Verified Complete', 'Blocked']
                : Array.from(new Set(['Backlog', 'In Progress', 'Ready for Review', 'Blocked', task.status]))
              ).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Reassignment Warning Banner */}
      {task.reassignment_required === 1 && (
        <div
          style={{
            marginBottom: '20px',
            padding: '14px 18px',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <AlertTriangle size={20} color="#EF4444" />
          <div style={{ fontSize: '13px' }}>
            <strong style={{ color: '#EF4444' }}>REASSIGNMENT REQUIRED:</strong>{' '}
            <span>
              This task was assigned to a member whose access is suspended. Please reassign to an active developer.
            </span>
          </div>
        </div>
      )}

      {/* Task Heading */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-orange)' }}>
            {task.id}
          </span>
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
          {task.is_deadline_exempt === 1 && (
            <span className="badge badge-verified-complete">EXEMPT FROM STRIKE POLICY</span>
          )}
          {task.extended_deadline && (
            <span className="badge badge-changes-requested">
              DEADLINE EXTENDED: {new Date(task.extended_deadline).toLocaleDateString()}
            </span>
          )}
          {task.completed_at && (
            <span className="badge badge-verified-complete">
              COMPLETED {new Date(task.completed_at).toLocaleDateString()}
            </span>
          )}
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-white)' }}>
          {task.title}
        </h1>
      </div>

      {/* Dynamic Next Action Guidance Card */}
      {renderNextActionBanner()}

      {/* Simplified 3-Tab Bar */}
      <div className="tab-bar" style={{ marginBottom: '20px' }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'work' ? 'active' : ''}`}
          onClick={() => setActiveTab('work')}
        >
          Overview & Work
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Quality & Reviews ({task.reviews?.length || 0})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'discussion' ? 'active' : ''}`}
          onClick={() => setActiveTab('discussion')}
        >
          Discussion & History ({task.comments?.length || 0})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & WORK */}
      {activeTab === 'work' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          {/* Left Column: Scope & Criteria */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Technical Scope Card */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Technical Description & Scope</div>
              </div>
              <div style={{ fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap', color: 'var(--text-white)' }}>
                {task.description}
              </div>
            </div>

            {/* Acceptance Criteria Checklist (Gate 1) */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <CheckCircle2 size={16} color="var(--accent-orange)" />
                  <span>Acceptance Criteria Checklist</span>
                </div>
                <span className="badge badge-backlog" style={{ fontSize: '11px' }}>
                  {task.acceptance_criteria?.filter((c) => c.is_satisfied === 1).length || 0} / {task.acceptance_criteria?.length || 0} Satisfied
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {task.acceptance_criteria?.length === 0 ? (
                  <div className="empty-state" style={{ padding: '16px 0' }}>
                    <p style={{ margin: 0 }}>No criteria added yet. Add checklist items below to define verification requirements.</p>
                  </div>
                ) : (
                  task.acceptance_criteria?.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleToggleCriterion(c.id, c.is_satisfied)}
                      title="Click to toggle status"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                          Verified
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>

              {canManage ? (
                <form onSubmit={handleAddCriterion} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Add verifiable acceptance item..."
                    value={newCriterionTitle}
                    onChange={(e) => setNewCriterionTitle(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary btn-sm" disabled={!newCriterionTitle.trim()}>
                    <Plus size={14} /> Add Item
                  </button>
                </form>
              ) : (
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                  Acceptance criteria definitions are managed by Team Leadership. Check items off as work is completed.
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Artifacts (Changesets, Tests, Evidence) + Metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Task Metadata Card */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Assignment & Schedule</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Assignee:</span>
                  <strong>{task.owner_name || 'Unassigned'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Designated Reviewer:</span>
                  <strong>{task.reviewer_name || 'None Assigned'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Target Milestone:</span>
                  <strong className="mono">
                    {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'None scheduled'}
                  </strong>
                </div>
                {task.extended_deadline && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--status-review)' }}>
                    <span>Approved Extension:</span>
                    <strong className="mono">{new Date(task.extended_deadline).toLocaleDateString()}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Disciplinary Status:</span>
                  {task.is_deadline_exempt === 1 ? (
                    <span style={{ color: 'var(--status-complete)', fontWeight: 600 }}>Exempt from Strikes</span>
                  ) : (
                    <span>Subject to 5-strike policy</span>
                  )}
                </div>
              </div>
            </div>

            {/* Implementation Artifacts Card (UVCS, Tests, Evidence in one clean panel) */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <GitCommit size={16} color="var(--accent-orange)" />
                  <span>Technical Artifacts & Evidence</span>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsChangesetModalOpen(true)}
                    title="Link UVCS Changeset"
                  >
                    <Plus size={13} /> UVCS
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsTestReportModalOpen(true)}
                    title="Record Test Run"
                  >
                    <Plus size={13} /> Test
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsEvidenceModalOpen(true)}
                    title="Attach Evidence"
                  >
                    <Plus size={13} /> Evidence
                  </button>
                </div>
              </div>

              {/* Linked Changesets */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  UVCS CHANGESETS ({task.changesets?.length || 0})
                </div>
                {task.changesets?.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    No changesets linked yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {task.changesets?.map((cs) => (
                      <div
                        key={cs.id}
                        style={{
                          padding: '8px 10px',
                          backgroundColor: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <span className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-orange)' }}>
                            {cs.changeset_id}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                            {cs.comment}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="logout-btn"
                          onClick={() => handleUnlinkChangeset(cs.id)}
                          title="Unlink"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Test Reports */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  AUTOMATED TEST RUNS ({task.test_reports?.length || 0})
                </div>
                {task.test_reports?.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    No test reports attached.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {task.test_reports?.map((rpt) => (
                      <div
                        key={rpt.id}
                        style={{
                          padding: '8px 10px',
                          backgroundColor: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div style={{ fontSize: '12px', color: 'var(--text-white)' }}>
                          <strong>{rpt.test_suite}</strong> ({rpt.passed_count} passed, {rpt.failed_count} failed)
                        </div>
                        <span className={`badge ${rpt.result === 'Passed' ? 'badge-verified-complete' : 'badge-changes-requested'}`}>
                          {rpt.result}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Evidence Artifacts */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  ATTACHED EVIDENCE ({task.evidence?.length || 0})
                </div>
                {task.evidence?.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    No screenshots or media attached.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {task.evidence?.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          padding: '8px 10px',
                          backgroundColor: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                          <span className="badge badge-backlog" style={{ fontSize: '10px' }}>{ev.evidence_type}</span>
                          <span style={{ color: 'var(--text-white)' }}>{ev.original_filename}</span>
                        </div>
                        {ev.stored_filename ? (
                          <a href={`/api/evidence/${ev.id}/file`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }}>
                            <Download size={12} /> View
                          </a>
                        ) : ev.external_url ? (
                          <a href={ev.external_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }}>
                            <ExternalLink size={12} /> Link
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUALITY & REVIEWS */}
      {activeTab === 'reviews' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Completion Gate Status Widget */}
          <GateStatusWidget gateStatus={task.completion_gate_status} />

          {/* Peer Reviews History & Decision Center */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <FileCheck2 size={16} color="var(--accent-orange)" />
                <span>Peer Review Decisions & Checklists</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setReviewModalMode('request');
                    setIsReviewModalOpen(true);
                  }}
                >
                  <Plus size={14} /> Request Review
                </button>
                {hasPendingReview && (isReviewer || isAdminOrOwner) && !isOwner && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setReviewModalMode('decision');
                      setIsReviewModalOpen(true);
                    }}
                  >
                    Conduct Review
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {task.reviews?.length === 0 ? (
                <div className="empty-state" style={{ padding: '28px 0' }}>
                  <FileCheck2 size={36} color="var(--accent-orange)" />
                  <h3>No Peer Reviews on Record</h3>
                  <p>Request an independent studio developer to evaluate this implementation before marking it complete.</p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setReviewModalMode('request');
                      setIsReviewModalOpen(true);
                    }}
                  >
                    Request Peer Review
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
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
                        <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          Author: <strong>{rev.developer_name}</strong> • Reviewer: <strong>{rev.reviewer_name}</strong>
                        </span>
                      </div>

                      {rev.decision === 'Pending' && (isReviewer || isAdminOrOwner) && !isOwner && (
                        <button
                          type="button"
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
                      <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-white)' }}>
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
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                          VERIFIED CHECKLIST:
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '6px' }}>
                          {rev.checklist.map((item: any) => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
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
        </div>
      )}

      {/* TAB 3: DISCUSSION & HISTORY */}
      {activeTab === 'discussion' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <MessageSquare size={16} color="var(--accent-orange)" />
              <span>Development Discussion & Comments</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {task.comments?.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <MessageSquare size={32} />
                <p>No discussion comments on this task yet. Post updates or questions below.</p>
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
              placeholder="Post a technical comment, implementation update, or note..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={!newComment.trim()}>
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

      {/* Extend Deadline Modal */}
      {isExtendModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div className="modal-title">Approve Deadline Extension</div>
              <button onClick={() => setIsExtendModalOpen(false)} style={{ color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleExtendDeadline}>
              <div className="modal-body">
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Extending a task deadline updates the accountability baseline under the 5-strike policy.
                </div>
                <div className="form-group">
                  <label className="form-label">New Extended Deadline</label>
                  <input
                    type="date"
                    className="form-control"
                    value={newExtendedDeadline ? newExtendedDeadline.slice(0, 10) : ''}
                    onChange={(e) => setNewExtendedDeadline(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Approved Justification / Reason</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Document technical dependency, engine scope change, or external blocker..."
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsExtendModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isSubmittingExtension}
                >
                  {isSubmittingExtension ? 'Saving Extension...' : 'Confirm Deadline Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Exempt Deadline Policy Modal */}
      {isExemptModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div className="modal-title">Exempt Task from Strike Policy</div>
              <button onClick={() => setIsExemptModalOpen(false)} style={{ color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleExemptDeadline}>
              <div className="modal-body">
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Exempted tasks do not incur disciplinary strikes upon missing their milestone deadline.
                </div>
                <div className="form-group">
                  <label className="form-label">Exemption Reason (Mandatory)</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Explain research spike, non-blocking exploration, or partner dependency..."
                    value={exemptionReason}
                    onChange={(e) => setExemptionReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsExemptModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isSubmittingExemption}
                >
                  {isSubmittingExemption ? 'Recording Exemption...' : 'Confirm Strike Exemption'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Request Deadline Extension Modal (Developer Workflow) */}
      {isRequestExtensionModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--accent-orange)" />
                <span>Request Deadline Extension</span>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestExtensionModalOpen(false)}
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleRequestExtension}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: 'rgba(255, 94, 30, 0.08)',
                    border: '1px solid rgba(255, 94, 30, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.4'
                  }}
                >
                  <strong style={{ color: 'var(--text-white)' }}>Policy Notice:</strong> Milestone deadlines cannot be directly edited by developers. Submitting this request sends a formal extension petition with your justification to Team Leadership.
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Current Deadline</label>
                  <input
                    type="text"
                    className="form-control"
                    value={task.extended_deadline || task.deadline || 'None'}
                    disabled
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Proposed New Deadline *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={requestedExtensionDeadline}
                    onChange={(e) => setRequestedExtensionDeadline(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Justification & Unforeseen Blockers *</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Describe technical complexity, blocking engine bugs, or cross-team dependency delays..."
                    value={requestedExtensionReason}
                    onChange={(e) => setRequestedExtensionReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsRequestExtensionModalOpen(false)}
                  disabled={isSubmittingExtensionRequest}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={isSubmittingExtensionRequest || !requestedExtensionDeadline || !requestedExtensionReason}
                >
                  {isSubmittingExtensionRequest ? 'Submitting...' : 'Submit Extension Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
