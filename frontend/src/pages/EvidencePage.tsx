import React, { useState, useEffect } from 'react';
import { FileImage, Plus, Download, ExternalLink, Trash2 } from 'lucide-react';
import { Evidence } from '../types/index.js';
import { EvidenceModal } from '../components/EvidenceModal.js';
import { apiRequest } from '../api/client.js';

interface EvidencePageProps {
  onNavigateToTask: (taskId: string) => void;
  tasks?: any[];
}

export const EvidencePage: React.FC<EvidencePageProps> = ({ onNavigateToTask, tasks = [] }) => {
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchEvidence = async () => {
    try {
      setIsLoading(true);
      const query = new URLSearchParams();
      if (typeFilter) query.set('evidenceType', typeFilter);

      const res = await apiRequest(`/api/evidence?${query.toString()}`);
      setEvidenceList(res.evidence || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, [typeFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this verification evidence?')) return;
    try {
      await apiRequest(`/api/evidence/${id}`, { method: 'DELETE' });
      fetchEvidence();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h1>Terminal 6 // Verification Evidence</h1>
          <p>Visual captures, Unity PlayMode screenshots, profiler breakdowns, and execution logs.</p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Attach Evidence
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '180px' }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Evidence Types</option>
          <option value="screenshot">Screenshots</option>
          <option value="video">Videos</option>
          <option value="test_log">Test Logs</option>
          <option value="build_log">Build Logs</option>
          <option value="document">Documents</option>
          <option value="external_link">External Links</option>
        </select>

        {typeFilter && (
          <button className="btn btn-secondary btn-sm" onClick={() => setTypeFilter('')}>
            Clear Filters
          </button>
        )}
      </div>

      {evidenceList.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <FileImage size={32} />
            <h3>No Evidence Artifacts Found</h3>
            <p>Upload screenshots, PlayMode videos, or log files to provide objective verification of task completion.</p>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(true)}>
              Attach Evidence
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {evidenceList.map((item) => (
            <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="badge badge-backlog">{item.evidence_type.toUpperCase()}</span>
                <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {item.file_size > 0 ? `${(item.file_size / 1024).toFixed(1)} KB` : 'Link'}
                </span>
              </div>

              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-white)', marginBottom: '4px' }}>
                {item.original_filename}
              </div>

              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '12px', flex: 1 }}>
                {item.description}
              </div>

              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Uploaded by <strong>{item.uploader_name}</strong>
                  </div>
                  {item.task_id && (
                    <button
                      className="mono"
                      style={{ fontSize: '11px', color: 'var(--accent-orange)', textDecoration: 'underline' }}
                      onClick={() => onNavigateToTask(item.task_id!)}
                    >
                      {item.task_id}
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {item.stored_filename ? (
                    <a
                      href={`/api/evidence/${item.id}/file`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                    >
                      <Download size={14} /> View File
                    </a>
                  ) : item.external_url ? (
                    <a
                      href={item.external_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                    >
                      <ExternalLink size={14} /> Open Link
                    </a>
                  ) : null}

                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(item.id)}
                    title="Delete evidence"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <EvidenceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEvidenceUploaded={fetchEvidence}
        tasks={tasks}
      />
    </div>
  );
};
