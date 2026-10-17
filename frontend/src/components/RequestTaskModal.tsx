import React, { useState } from 'react';
import { X, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';

interface RequestTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestSubmitted?: () => void;
}

export const RequestTaskModal: React.FC<RequestTaskModalProps> = ({
  isOpen,
  onClose,
  onRequestSubmitted
}) => {
  const { activeProjectId } = useAuth();
  const toast = useToast();

  const [projectId, setProjectId] = useState<string>(activeProjectId || 'terminal-6');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState<'P1' | 'P2' | 'P3'>('P2');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !reason.trim()) {
      setError('Please fill in all required fields (title, technical scope, and justification).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await apiRequest('/api/tasks/request', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          description: description.trim(),
          reason: reason.trim(),
          priority
        })
      });

      toast.success('Task request submitted to Team Leadership for review and scheduling.');
      setTitle('');
      setDescription('');
      setReason('');
      if (onRequestSubmitted) onRequestSubmitted();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit task request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Send size={18} color="var(--accent-orange)" />
            <span>Request Task Assignment</span>
          </div>
          <button type="button" onClick={onClose} style={{ color: 'var(--text-secondary)' }} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(255, 94, 30, 0.08)',
                border: '1px solid rgba(255, 94, 30, 0.25)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12.5px',
                color: 'var(--text-secondary)',
                lineHeight: '1.5'
              }}
            >
              <strong style={{ color: 'var(--text-white)' }}>Developer Workflow Notice:</strong> Task creation and milestone schedules are authorized by Team Managers and Studio Leadership. Submit your proposed scope below to request a task assignment.
            </div>

            {/* Target Project */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Target Studio Project *</label>
              <select
                className="form-control"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="terminal-6">Terminal 6 (Psychological Horror)</option>
                <option value="eclipsed">Eclipsed (2D Metroidvania)</option>
              </select>
            </div>

            {/* Proposed Task Title */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Proposed Task Title *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Implement Cab Speedometer needle physics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Technical Scope & Description */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Technical Scope & Description *</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Detail the engine systems, assets, or scripts requiring development..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Justification / Reason */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Justification / Reason for Work *</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Why is this work needed now? Does it unblock other deliverables or resolve a defect?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            {/* Urgency / Priority */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Suggested Priority</label>
              <select
                className="form-control"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
              >
                <option value="P1">P1 - Urgent / Milestone Blocker</option>
                <option value="P2">P2 - Standard Sprint Milestone</option>
                <option value="P3">P3 - Low Priority / Enhancement</option>
              </select>
            </div>
          </div>

          <div
            className="modal-footer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              padding: '16px 20px',
              borderTop: '1px solid var(--border-subtle)'
            }}
          >
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={isSubmitting || !title.trim() || !description.trim() || !reason.trim()}
              style={{ gap: '6px' }}
            >
              <Send size={14} />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
