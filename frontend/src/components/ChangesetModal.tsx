import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';

interface ChangesetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangesetLinked: () => void;
  taskId: string;
}

export const ChangesetModal: React.FC<ChangesetModalProps> = ({
  isOpen,
  onClose,
  onChangesetLinked,
  taskId
}) => {
  const { user } = useAuth();
  const [rawChangesetId, setRawChangesetId] = useState('');
  const [comment, setComment] = useState('');
  const [branch, setBranch] = useState('/main');
  const [author, setAuthor] = useState(user?.displayName || 'Developer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await apiRequest(`/api/tasks/${taskId}/changesets`, {
        method: 'POST',
        body: JSON.stringify({
          rawChangesetId: rawChangesetId.trim(),
          comment: comment.trim(),
          branch: branch.trim(),
          author: author.trim(),
          repositoryId: 'Terminal6-Main@cindermarch'
        })
      });

      onChangesetLinked();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">Link Unity Version Control (UVCS) Changeset</div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="alert alert-warning" style={{ fontSize: '12px' }}>
              <div>
                <strong>Manual UVCS Mode:</strong> Changesets entered here are recorded manually and flagged as <em>MANUAL / UNVERIFIED</em> until Plastic SCM / Unity DevOps automated connection is configured.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Changeset ID *</label>
                <input
                  type="text"
                  className="form-control mono"
                  placeholder="e.g. cs:1044 or 1044"
                  value={rawChangesetId}
                  onChange={(e) => setRawChangesetId(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Branch Path</label>
                <input
                  type="text"
                  className="form-control mono"
                  placeholder="/main/feature/..."
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">UVCS Author *</label>
              <input
                type="text"
                className="form-control"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Commit / Changeset Comment *</label>
              <textarea
                className="form-control"
                placeholder="Paste the commit message describing the changes made in Unity..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Linking...' : 'Link Changeset to Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
