import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Sliders, ChevronDown, ChevronRight, CheckSquare } from 'lucide-react';
import { Task, Priority, TaskStatus } from '../types/index.js';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskSaved: (savedTaskId?: string) => void;
  taskToEdit?: Task | null;
  teamUsers?: any[];
}

const CATEGORIES = [
  'Gameplay',
  'Level Design',
  'Combat & Bosses',
  'Movement & Physics',
  'Abilities & Upgrades',
  'Exploration & Progression',
  'Engine',
  'Graphics/Shaders',
  'Art & Animation',
  'Audio & SFX',
  'Narrative & Lore',
  'Tooling',
  'UI/UX',
  'Optimization',
  'QA & Testing'
];

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onTaskSaved,
  taskToEdit,
  teamUsers = []
}) => {
  const { activeProjectId } = useAuth();

  // Essential fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('terminal-6');
  const [teamId, setTeamId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [priority, setPriority] = useState<Priority>('P1');
  const [deadline, setDeadline] = useState('');

  // Advanced / Secondary fields
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [category, setCategory] = useState('Gameplay');
  const [status, setStatus] = useState<TaskStatus>('Backlog');
  const [reviewerId, setReviewerId] = useState('');
  const [estimatedEffort, setEstimatedEffort] = useState('');
  const [actualEffort, setActualEffort] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [criteria, setCriteria] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Exemptions (Lead overrides)
  const [isChangesetExempt, setIsChangesetExempt] = useState(false);
  const [changesetExemptionReason, setChangesetExemptionReason] = useState('');
  const [isTestExempt, setIsTestExempt] = useState(false);
  const [testExemptionReason, setTestExemptionReason] = useState('');
  const [isDeadlineExempt, setIsDeadlineExempt] = useState(false);
  const [deadlineExemptionReason, setDeadlineExemptionReason] = useState('');

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setSelectedProjectId(taskToEdit.project_id || activeProjectId || 'terminal-6');
      setTeamId((taskToEdit as any).team_id || '');
      setOwnerId(taskToEdit.owner_id || '');
      setPriority(taskToEdit.priority || 'P1');
      setDeadline(taskToEdit.deadline ? taskToEdit.deadline.slice(0, 10) : '');

      setCategory(taskToEdit.category || 'Gameplay');
      setStatus(taskToEdit.status || 'Backlog');
      setReviewerId(taskToEdit.reviewer_id || '');
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
      setIsDeadlineExempt(taskToEdit.is_deadline_exempt === 1);
      setDeadlineExemptionReason(taskToEdit.deadline_exemption_reason || '');
      setCriteria([]);
      setShowAdvanced(false);
    } else {
      setTitle('');
      setDescription('');
      setSelectedProjectId(activeProjectId || 'terminal-6');
      setTeamId('');
      setOwnerId('');
      setPriority('P1');
      setDeadline('');

      setCategory('Gameplay');
      setStatus('Backlog');
      setReviewerId('');
      setEstimatedEffort('');
      setActualEffort('');
      setTagsInput('');
      setCriteria([]);
      setIsChangesetExempt(false);
      setChangesetExemptionReason('');
      setIsTestExempt(false);
      setTestExemptionReason('');
      setIsDeadlineExempt(false);
      setDeadlineExemptionReason('');
      setShowAdvanced(false);
    }
    setError(null);
  }, [taskToEdit, isOpen, activeProjectId]);

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
      let savedTaskId: string | undefined;

      if (taskToEdit) {
        const res = await apiRequest(`/api/tasks/${taskToEdit.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title,
            description,
            projectId: selectedProjectId,
            category,
            priority,
            teamId: teamId || null,
            ownerId: ownerId || null,
            reviewerId: reviewerId || null,
            deadline: deadline ? `${deadline}T18:00:00Z` : null,
            estimatedEffort: estimatedEffort.trim() || null,
            actualEffort: actualEffort.trim() || null,
            tags,
            isChangesetExempt,
            changesetExemptionReason: isChangesetExempt ? changesetExemptionReason : null,
            isTestExempt,
            testExemptionReason: isTestExempt ? testExemptionReason : null,
            isDeadlineExempt,
            deadlineExemptionReason: isDeadlineExempt ? deadlineExemptionReason : null
          })
        });
        savedTaskId = res.task?.id || taskToEdit.id;
      } else {
        const filteredCriteria = criteria.map((c) => c.trim()).filter(Boolean);
        const res = await apiRequest('/api/tasks', {
          method: 'POST',
          body: JSON.stringify({
            title,
            description,
            projectId: selectedProjectId,
            category,
            priority,
            status,
            teamId: teamId || null,
            ownerId: ownerId || null,
            reviewerId: reviewerId || null,
            deadline: deadline ? `${deadline}T18:00:00Z` : null,
            estimatedEffort: estimatedEffort.trim() || null,
            actualEffort: actualEffort.trim() || null,
            tags,
            acceptanceCriteria: filteredCriteria
          })
        });
        savedTaskId = res.task?.id;
      }

      onTaskSaved(savedTaskId);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content large" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={18} color="var(--accent-orange)" />
            <span>{taskToEdit ? `Edit Task: ${taskToEdit.id}` : 'Create New Task'}</span>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && <div className="alert alert-error">{error}</div>}

            {/* Essential Field 1: Task Title */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Task Title *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Implement Cab Speedometer needle physics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Essential Row: Project & Team */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Project *</label>
                <select
                  className="form-control"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  required
                >
                  <option value="terminal-6">Terminal 6 (Horror)</option>
                  <option value="eclipsed">Eclipsed (Metroidvania)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Studio Team</label>
                <select
                  className="form-control"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                >
                  <option value="">No Team Assigned</option>
                  <option value="team_story">Story Team</option>
                  <option value="team_coding">Coding Team</option>
                  <option value="team_marketing">Marketing Team</option>
                  <option value="team_engine">Engine Team</option>
                  <option value="team_3d_artists">3D Artists</option>
                  <option value="team_sound">Sound Team</option>
                </select>
              </div>
            </div>

            {/* Essential Row: Assignee, Priority, Deadline */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Assignee (Developer)</label>
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

              <div className="form-group" style={{ marginBottom: 0 }}>
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

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Milestone Deadline</label>
                <input
                  type="date"
                  className="form-control"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>

            {/* Essential Field: Description */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Description & Technical Context *</label>
              <textarea
                className="form-control"
                placeholder="Scope, Unity systems involved, expected behavior, requirements..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
              />
            </div>

            {/* Expandable Advanced Settings Toggle */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)'
                }}
              >
                <Sliders size={13} />
                <span>
                  {showAdvanced
                    ? 'Hide Advanced Options'
                    : 'Show Advanced Options (Reviewer, Effort, Tags, Acceptance Criteria & Gates)'}
                </span>
                {showAdvanced ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            </div>

            {/* Advanced Section Content */}
            {showAdvanced && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  padding: '14px',
                  backgroundColor: 'var(--bg-elevated)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
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

                  <div className="form-group" style={{ marginBottom: 0 }}>
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

                  {!taskToEdit && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
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

                  <div className="form-group" style={{ marginBottom: 0 }}>
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
                    <div className="form-group" style={{ marginBottom: 0 }}>
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

                <div className="form-group" style={{ marginBottom: 0 }}>
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
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>
                        Acceptance Criteria (Optional verification checklist)
                      </label>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleAddCriterion}
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        <Plus size={12} />
                        <span>Add Item</span>
                      </button>
                    </div>

                    {criteria.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        No criteria added yet. You can also define checklist items after creating the task.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {criteria.map((c, index) => (
                          <div key={index} style={{ display: 'flex', gap: '6px' }}>
                            <input
                              type="text"
                              className="form-control"
                              placeholder={`Criterion ${index + 1}`}
                              value={c}
                              onChange={(e) => handleCriterionChange(index, e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleRemoveCriterion(index)}
                              style={{ padding: '0 8px', color: 'var(--status-blocked)' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {taskToEdit && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      VERIFICATION GATE EXEMPTIONS (Lead Override)
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isChangesetExempt}
                            onChange={(e) => setIsChangesetExempt(e.target.checked)}
                          />
                          <span style={{ fontSize: '12.5px' }}>Exempt from UVCS Changeset requirement</span>
                        </label>
                        {isChangesetExempt && (
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Document valid exemption reason..."
                            value={changesetExemptionReason}
                            onChange={(e) => setChangesetExemptionReason(e.target.value)}
                            style={{ marginTop: '4px' }}
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
                          <span style={{ fontSize: '12.5px' }}>Exempt from Automated Test report requirement</span>
                        </label>
                        {isTestExempt && (
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Document valid exemption reason..."
                            value={testExemptionReason}
                            onChange={(e) => setTestExemptionReason(e.target.value)}
                            style={{ marginTop: '4px' }}
                            required
                          />
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isDeadlineExempt}
                            onChange={(e) => setIsDeadlineExempt(e.target.checked)}
                          />
                          <span style={{ fontSize: '12.5px' }}>Exempt from Deadline Accountability Strikes</span>
                        </label>
                        {isDeadlineExempt && (
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Document valid deadline exemption reason..."
                            value={deadlineExemptionReason}
                            onChange={(e) => setDeadlineExemptionReason(e.target.value)}
                            style={{ marginTop: '4px' }}
                            required
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
