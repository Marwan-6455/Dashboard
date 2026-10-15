import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Task, Review, ReviewDecision, ReviewChecklistItem } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReviewSubmitted: () => void;
  mode: 'request' | 'decision';
  task?: Task | null;
  reviewToDecide?: Review | null;
  teamUsers?: any[];
}

const DEFAULT_CHECKLIST: ReviewChecklistItem[] = [
  { id: 'chk_1', label: 'Correct task and scope alignment', passed: false },
  { id: 'chk_2', label: 'Changeset reference recorded & verified in UVCS', passed: false },
  { id: 'chk_3', label: 'Relevant code, shaders & assets inspected', passed: false },
  { id: 'chk_4', label: 'Acceptance criteria verified in Unity editor/PlayMode', passed: false },
  { id: 'chk_5', label: 'Edge cases and failure states checked', passed: false },
  { id: 'chk_6', label: 'No new Console warnings, shader errors, or memory leaks', passed: false },
  { id: 'chk_7', label: 'Automated test suite results verified', passed: false },
  { id: 'chk_8', label: 'Evidence artifacts accessible and inspected', passed: false },
  { id: 'chk_9', label: 'Integration requirements and dependencies satisfied', passed: false }
];

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  onReviewSubmitted,
  mode,
  task,
  reviewToDecide,
  teamUsers = []
}) => {
  const { user } = useAuth();
  const [reviewerId, setReviewerId] = useState('');
  const [decision, setDecision] = useState<ReviewDecision>('Approved');
  const [findings, setFindings] = useState('');
  const [requiredFixes, setRequiredFixes] = useState('');
  const [checklist, setChecklist] = useState<ReviewChecklistItem[]>(DEFAULT_CHECKLIST);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (reviewToDecide) {
      setDecision(reviewToDecide.decision === 'Pending' ? 'Approved' : reviewToDecide.decision);
      setFindings(reviewToDecide.findings || '');
      setRequiredFixes(reviewToDecide.required_fixes || '');
      setChecklist(reviewToDecide.checklist?.length ? reviewToDecide.checklist : DEFAULT_CHECKLIST);
    } else {
      setChecklist(DEFAULT_CHECKLIST);
      setFindings('');
      setRequiredFixes('');
      setDecision('Approved');
      // Suggest reviewer different from task owner
      if (task?.owner_id) {
        const otherUser = teamUsers.find((u) => u.id !== task.owner_id);
        if (otherUser) setReviewerId(otherUser.id);
      }
    }
    setError(null);
  }, [isOpen, reviewToDecide, task]);

  if (!isOpen) return null;

  const isSelfReviewAttempt =
    mode === 'decision' &&
    reviewToDecide &&
    user &&
    reviewToDecide.developer_id === user.id &&
    decision === 'Approved';

  const handleToggleChecklist = (id: string) => {
    setChecklist(
      checklist.map((item) => (item.id === id ? { ...item, passed: !item.passed } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'request') {
        if (!task) throw new Error('Task context missing.');
        if (!reviewerId) throw new Error('Please select an independent reviewer.');
        if (reviewerId === task.owner_id) {
          throw new Error('Self-review violation: A developer cannot review their own work.');
        }

        await apiRequest('/api/reviews', {
          method: 'POST',
          body: JSON.stringify({
            taskId: task.id,
            developerId: task.owner_id || user!.id,
            reviewerId,
            checklist
          })
        });
      } else {
        if (!reviewToDecide) throw new Error('Review context missing.');

        await apiRequest(`/api/reviews/${reviewToDecide.id}/decision`, {
          method: 'POST',
          body: JSON.stringify({
            decision,
            findings,
            requiredFixes: decision === 'Changes Requested' ? requiredFixes : null,
            checklist
          })
        });
      }

      onReviewSubmitted();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content large">
        <div className="modal-header">
          <div className="modal-title">
            {mode === 'request'
              ? `Request Peer Review: ${task?.id}`
              : `Peer Review Decision: ${reviewToDecide?.task_id || task?.id}`}
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            {isSelfReviewAttempt && (
              <div className="alert alert-error">
                <AlertCircle size={18} />
                <div>
                  <strong>Self-Approval Violation:</strong> You are the task owner. Studio completion gate rules strictly prohibit approving your own work. An independent reviewer must submit this decision.
                </div>
              </div>
            )}

            {mode === 'request' ? (
              <div>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '13px' }}>
                  Assign an independent studio developer to review the implementation and verify all completion criteria.
                </p>

                <div className="form-group">
                  <label className="form-label">Assign Reviewer *</label>
                  <select
                    className="form-control"
                    value={reviewerId}
                    onChange={(e) => setReviewerId(e.target.value)}
                    required
                  >
                    <option value="">Select Reviewer...</option>
                    {teamUsers
                      .filter((u) => u.id !== task?.owner_id)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.display_name || u.displayName} ({u.username})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label className="form-label">Review Decision *</label>
                  <select
                    className="form-control"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value as ReviewDecision)}
                  >
                    <option value="Approved">Approved (Meets studio quality gates)</option>
                    <option value="Changes Requested">Changes Requested (Fixes required)</option>
                    <option value="Rejected">Rejected (Fundamental rework required)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Mandatory Review Checklist</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {checklist.map((item) => (
                      <label
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          backgroundColor: 'var(--bg-elevated)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={item.passed}
                          onChange={() => handleToggleChecklist(item.id)}
                        />
                        <span style={{ fontSize: '13px', color: item.passed ? 'var(--text-white)' : 'var(--text-secondary)' }}>
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Review Findings & Architecture Notes</label>
                  <textarea
                    className="form-control"
                    placeholder="Document code inspection, PlayMode observations, audio/visual impressions..."
                    value={findings}
                    onChange={(e) => setFindings(e.target.value)}
                    rows={3}
                  />
                </div>

                {decision === 'Changes Requested' && (
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--status-changes)' }}>
                      Required Fixes * (Mandatory when requesting changes)
                    </label>
                    <textarea
                      className="form-control"
                      placeholder="Specify exact modifications required before revalidation..."
                      value={requiredFixes}
                      onChange={(e) => setRequiredFixes(e.target.value)}
                      rows={3}
                      required
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !!isSelfReviewAttempt}
            >
              {isSubmitting
                ? 'Submitting...'
                : mode === 'request'
                ? 'Send Review Request'
                : 'Submit Review Decision'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
