import React, { useState } from 'react';
import { X, Upload, Link } from 'lucide-react';
import { apiRequest } from '../api/client.js';

interface EvidenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEvidenceUploaded: () => void;
  defaultTaskId?: string | null;
  tasks?: any[];
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({
  isOpen,
  onClose,
  onEvidenceUploaded,
  defaultTaskId,
  tasks = []
}) => {
  const [mode, setMode] = useState<'file' | 'link'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [taskId, setTaskId] = useState(defaultTaskId || '');
  const [description, setDescription] = useState('');
  const [evidenceType, setEvidenceType] = useState('screenshot');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      // Auto-detect evidence type
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        setEvidenceType('screenshot');
      } else if (['.mp4', '.webm'].includes(ext)) {
        setEvidenceType('video');
      } else if (['.txt', '.log'].includes(ext)) {
        setEvidenceType('test_log');
      } else {
        setEvidenceType('document');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'file') {
        if (!selectedFile) throw new Error('Please select a file to upload.');

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('description', description);
        formData.append('evidenceType', evidenceType);
        if (taskId) formData.append('taskId', taskId);

        await apiRequest('/api/evidence/upload', {
          method: 'POST',
          body: formData
        });
      } else {
        if (!externalUrl) throw new Error('Please enter a valid URL.');

        await apiRequest('/api/evidence/upload', {
          method: 'POST',
          body: JSON.stringify({
            externalUrl,
            description,
            evidenceType: 'external_link',
            taskId: taskId || null
          })
        });
      }

      onEvidenceUploaded();
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
          <div className="modal-title">Attach Verification Evidence</div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                className={`btn btn-sm ${mode === 'file' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('file')}
              >
                <Upload size={14} /> Upload File (Screenshots, Logs)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${mode === 'link' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('link')}
              >
                <Link size={14} /> External Artifact URL
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Associated Task</label>
              <select
                className="form-control"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                <option value="">No task (General studio artifact)</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id}: {t.title}
                  </option>
                ))}
              </select>
            </div>

            {mode === 'file' ? (
              <>
                <div className="form-group">
                  <label className="form-label">Select Evidence File (Max 25MB) *</label>
                  <input
                    type="file"
                    className="form-control"
                    onChange={handleFileChange}
                    accept="image/*,video/mp4,video/webm,.txt,.log,.json,.pdf,.zip"
                    required
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Supported: PNG, JPEG, WebP, MP4, WebM, Text/Unity console logs (.log, .txt), JSON, PDF
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Evidence Type</label>
                  <select
                    className="form-control"
                    value={evidenceType}
                    onChange={(e) => setEvidenceType(e.target.value)}
                  >
                    <option value="screenshot">In-Editor / PlayMode Screenshot</option>
                    <option value="video">Gameplay Capture / Short Video</option>
                    <option value="test_log">Unity Test Runner Log</option>
                    <option value="build_log">Build / Compilation Output Log</option>
                    <option value="document">Technical Design / Architecture Spec</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="form-group">
                <label className="form-label">Artifact URL *</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://cloud.unity.com/... or shared drive link"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Description & Verification Notes *</label>
              <textarea
                className="form-control"
                placeholder="What does this evidence show? (e.g. Profiler capture showing 60 FPS in Platform 3 tunnel pass)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
              {isSubmitting ? 'Uploading...' : 'Attach Evidence'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
