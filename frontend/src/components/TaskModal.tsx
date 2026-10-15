import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Tag, Clock } from 'lucide-react';
import { Task, Priority, TaskStatus } from '../types/index.js';
import { apiRequest } from '../api/client.js';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskSaved: () => void;
  taskToEdit?: Task | null;
  teamUsers?: any[];
}

const CATEGORIES = [
  'Gameplay',
  'Engine',
  'Graphics/Shaders',
  'Audio',
  'Physics',
  'Tooling',
  'UI/UX',
  'Optimization'
];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onTaskSaved,
  taskToEdit,
  teamUsers = []
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Gameplay');
  const [priority, setPriority] = useState<Priority>('P1');
  const [status, setStatus] = useState<TaskStatus>('Backlog');
  const [ownerId, setOwnerId] = useState('');
  const [reviewerId, setReviewerId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [estimatedEffort, setEstimatedEffort] = useState('');
  const [actualEffort, setActualEffort] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [criteria, setCriteria] = useState<string[]>(['']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exemptions
  const [isChangesetExempt, setIsChangesetExempt] = useState(false);
  const [changesetExemptionReason, setChangesetExemptionReason] = useState('');
  const [isTestExempt, setIsTestExempt] = useState(false);
  const [testExemptionReason, setTestExemptionReason] = useState('');

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description);
      setCategory(taskToEdit.category || 'Gameplay');
      setPriority(taskToEdit.priority);
      setStatus(taskToEdit.status);
      setOwnerId(taskToEdit.owner_id || '');
      setReviewerId(taskToEdit.reviewer_id || '');
      setDeadline(taskToEdit.deadline ? taskToEdit.deadline.slice(0, 10) : '');
      setEstimatedEffort(taskToEdit.estimated_effort || '');
      setActualEffort(taskToEdit.actual_effort || '');
      if (taskToEdit.tags_json) {
        try {
          setTagsInput(JSON.parse(taskToEdit.tags_json).join(', '));
        } catch {
          setTagsInput('');
        }
      } else {
        setTagsInput('');
      }
      setIsChangesetExempt(taskToEdit.is_changeset_exempt === 1);
      setChangesetExemptionReason(taskToEdit.changeset_exemption_reason || '');
      setIsTestExempt(taskToEdit.is_test_exempt === 1);
      setTestExemptionReason(taskToEdit.test_exemption_reason || '');
      setCriteria([]);
    } else {
      setTitle('');
      setDescription('');
      setCategory('Gameplay');
      setPriority('P1');
      setStatus('Backlog');
      setOwnerId('');
      setReviewerId('');
      setDeadline('');
      setEstimatedEffort('');
      setActualEffort('');
      setTagsInput('');
      setIsChangesetExempt(false);
      setChangesetExemptionReason('');
      setIsTestExempt(false);
      setTestExemptionReason('');
      setCriteria(['']);
    }
    setError(null);
  }, [taskToEdit, isOpen]);

  if (!isOpen) return null;

  const handleAddCriterion = () => {
    setCriteria([...criteria, '']);
  };

  const handleCriterionChange = (index: number, val: string) => {
    const updated = [...criteria];
    updated[index] = val;
    setCriteria(updated);
  };

  const handleRemoveCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (taskToEdit) {
        await apiRequest(`/api/tasks/${taskToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title,
            description,
            category,
            priority,
            ownerId: ownerId || null,
            reviewerId: reviewerId || null,
            deadline: deadline ? `${deadline}T18:00:00Z` : null,
            estimatedEffort: estimatedEffort.trim() || null,
            actualEffort: actualEffort.trim() || null,
            tags,
            isChangesetExempt,
            changesetExemptionReason: isChangesetExempt ? changesetExemptionReason : null,
            isTestExempt,
            testExemptionReason: isTestExempt ? testExemptionReason : null
          })
        });
      } else {
        const filteredCriteria = criteria.map((c) => c.trim()).filter(Boolean);
        await apiRequest('/api/tasks', {
          method: 'POST',
          body: JSON.stringify({
            title,
            description,
            category,
            priority,
            status,
            ownerId: ownerId || null,
            reviewerId: reviewerId || null,
            deadline: deadline ? `${deadline}T18:00:00Z` : null,
            estimatedEffort: estimatedEffort.trim() || null,
            actualEffort: actualEffort.trim() || null,
            tags,
            acceptanceCriteria: filteredCriteria
          })
        });
      }

      onTaskSaved();
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
            {taskToEdit ? `Edit Task: ${taskToEdit.id}` : 'Create New Development Task'}
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-group">
              <label className="form-label">Task Title *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Implement Cab Speedometer needle physics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description & Technical Context *</label>
              <textarea
                className="form-control"
                placeholder="Detailed scope, Unity systems involved, expected behavior..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-control"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <select
                  className="form-control"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                >
                  <option value="P0">P0 - Blocker / Engine Critical</option>
                  <option value="P1">P1 - High Priority Feature</option>
                  <option value="P2">P2 - Normal Scope / Polish</option>
                </select>
              </div>

              {!taskToEdit && (
                <div className="form-group">
                  <label className="form-label">Initial Status</label>
                  <select
                    className="form-control"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  >
                    <option value="Backlog">Backlog</option>
                    <option value="In Progress">In Progress</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Task Owner (Developer)</label>
                <select
                  className="form-control"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {teamUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name || u.displayName} ({u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Designated Reviewer</label>
                <select
                  className="form-control"
                  value={reviewerId}
                  onChange={(e) => setReviewerId(e.target.value)}
                >
                  <option value="">None Designated</option>
                  {teamUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name || u.displayName} ({u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Milestone Deadline</label>
                <input
                  type="date"
                  className="form-control"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Estimated Effort</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 4h, 2d"
                  value={estimatedEffort}
                  onChange={(e) => setEstimatedEffort(e.target.value)}
                />
              </div>

              {taskToEdit && (
                <div className="form-group">
                  <label className="form-label">Actual Effort Tracked</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 3.5h"
                    value={actualEffort}
                    onChange={(e) => setActualEffort(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginTop: '10px' }}>
              <label className="form-label">Tags (comma-separated)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. locomotive, physics, shaders, audio"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>

            {!taskToEdit && (
              <div className="form-group" style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>
                    Acceptance Criteria (Verification Gate Requirement)
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAddCriterion}
                  >
                    <Plus size={14} />
                    <span>Add Criteria</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {criteria.map((c, index) => (
                    <div key={index} style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-control"
                        placeholder={`Requirement ${index + 1}`}
                        value={c}
                        onChange={(e) => handleCriterionChange(index, e.target.value)}
                        required={index === 0}
                      />
                      {criteria.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleRemoveCriterion(index)}
                          style={{ padding: '0 8px', color: 'var(--status-blocked)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {taskToEdit && (
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  VERIFICATION GATE EXEMPTIONS (Lead Override Only)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isChangesetExempt}
                        onChange={(e) => setIsChangesetExempt(e.target.checked)}
                      />
                      <span style={{ fontSize: '13px' }}>Exempt from UVCS Changeset requirement</span>
                    </label>
                    {isChangesetExempt && (
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Document valid exemption reason..."
                        value={changesetExemptionReason}
                        onChange={(e) => setChangesetExemptionReason(e.target.value)}
                        style={{ marginTop: '6px' }}
                        required
                      />
                    )}
                  </div>

                  <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isTestExempt}
                        onChange={(e) => setIsTestExempt(e.target.checked)}
                      />
                      <span style={{ fontSize: '13px' }}>Exempt from Automated Test report requirement</span>
                    </label>
                    {isTestExempt && (
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Document valid exemption reason..."
                        value={testExemptionReason}
                        onChange={(e) => setTestExemptionReason(e.target.value)}
                        style={{ marginTop: '6px' }}
                        required
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : taskToEdit ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
