import React, { useState, useEffect, useMemo } from 'react';
import { FileImage, Plus, Download, ExternalLink, Trash2, Search, Filter, Eye, FileText, CheckCircle2 } from 'lucide-react';
import { Evidence } from '../types/index.js';
import { EvidenceModal } from '../components/EvidenceModal.js';
import { apiRequest } from '../api/client.js';
import { useToast } from '../context/ToastContext.js';

interface EvidencePageProps {
  onNavigateToTask: (taskId: string) => void;
  tasks?: any[];
}

export const EvidencePage: React.FC<EvidencePageProps> = ({ onNavigateToTask, tasks = [] }) => {
  const toast = useToast();
  const [evidenceList, setEvidenceList] = useState<Evidence[]>([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchEvidence = async () => {
    try {
      setIsLoading(true);
      const query = new URLSearchParams();
      if (typeFilter) query.set('evidenceType', typeFilter);

      const res = await apiRequest(`/api/evidence?${query.toString()}`);
      setEvidenceList(res.evidence || []);
    } catch (err: any) {
      toast.error(`Failed to load evidence artifacts: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
  }, [typeFilter]);

  const handleDelete = async (id: string, filename: string) => {
    if (!confirm(`Are you sure you want to remove evidence "${filename}"?`)) return;
    try {
      await apiRequest(`/api/evidence/${id}`, { method: 'DELETE' });
      toast.success(`Removed evidence artifact "${filename}".`);
      fetchEvidence();
    } catch (err: any) {
      toast.error(`Failed to remove evidence: ${err.message}`);
    }
  };

  // Filtered evidence by search query
  const filteredEvidence = useMemo(() => {
    if (!searchQuery.trim()) return evidenceList;
    const q = searchQuery.toLowerCase();
    return evidenceList.filter((item) =>
      item.original_filename?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.uploader_name?.toLowerCase().includes(q) ||
      (item.task_id && item.task_id.toLowerCase().includes(q))
    );
  }, [evidenceList, searchQuery]);

  // Metric counts
  const screenshotCount = evidenceList.filter(e => e.evidence_type === 'screenshot').length;
  const videoCount = evidenceList.filter(e => e.evidence_type === 'video').length;
  const logCount = evidenceList.filter(e => ['test_log', 'build_log'].includes(e.evidence_type)).length;
  const linkCount = evidenceList.filter(e => e.evidence_type === 'external_link' || !!e.external_url).length;

  const isImageFile = (filename: string) => {
    return /\.(png|jpe?g|webp|gif)$/i.test(filename);
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

      {/* Metrics Bar */}
      <div className="metrics-grid" style={{ marginBottom: '24px' }}>
        <div className="metric-card accent-orange">
          <div className="metric-label">Total Artifacts</div>
          <div className="metric-value">{evidenceList.length}</div>
          <div className="metric-sub">Recorded in repository</div>
        </div>
        <div className="metric-card accent-blue">
          <div className="metric-label">Screenshots</div>
          <div className="metric-value">{screenshotCount}</div>
          <div className="metric-sub">Visual PlayMode captures</div>
        </div>
        <div className="metric-card accent-green">
          <div className="metric-label">Test & Build Logs</div>
          <div className="metric-value">{logCount}</div>
          <div className="metric-sub">Profiler & UTF execution</div>
        </div>
        <div className="metric-card accent-purple">
          <div className="metric-label">Videos & Links</div>
          <div className="metric-value">{videoCount + linkCount}</div>
          <div className="metric-sub">Demos & external proofs</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '34px' }}
            placeholder="Search evidence by file, task ID, desc..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

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

        {(typeFilter || searchQuery) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setTypeFilter('');
              setSearchQuery('');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--text-secondary)', padding: '40px 0', textAlign: 'center' }}>
          Loading verification artifacts...
        </div>
      ) : filteredEvidence.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <FileImage size={36} color="var(--accent-orange)" />
            <h3>No Evidence Artifacts Found</h3>
            <p>Upload screenshots, PlayMode videos, or log files to provide objective verification of task completion.</p>
            <button className="btn btn-secondary btn-sm" onClick={() => setIsModalOpen(true)}>
              <Plus size={14} /> Attach Evidence
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {filteredEvidence.map((item) => {
            const hasImagePreview = item.stored_filename && isImageFile(item.original_filename);
            const fileUrl = item.stored_filename ? `/api/evidence/${item.id}/file` : null;

            return (
              <div
                key={item.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'border-color var(--transition-normal), transform var(--transition-fast)'
                }}
              >
                {/* Visual Thumbnail for Images */}
                {hasImagePreview && fileUrl && (
                  <div
                    style={{
                      height: '140px',
                      backgroundColor: 'var(--bg-black)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      marginBottom: '12px',
                      position: 'relative',
                      cursor: 'pointer',
                      border: '1px solid var(--border-subtle)'
                    }}
                    onClick={() => setPreviewImage(fileUrl)}
                    title="Click to expand full resolution"
                  >
                    <img
                      src={fileUrl}
                      alt={item.original_filename}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.9,
                        transition: 'opacity var(--transition-fast)'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        borderRadius: '4px',
                        padding: '4px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--text-white)'
                      }}
                    >
                      <Eye size={12} />
                      <span>Preview</span>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span
                    className={`badge ${
                      item.evidence_type === 'screenshot'
                        ? 'badge-ready-for-review'
                        : item.evidence_type === 'video'
                        ? 'badge-in-progress'
                        : 'badge-backlog'
                    }`}
                  >
                    {item.evidence_type.toUpperCase().replace('_', ' ')}
                  </span>
                  <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {item.file_size > 0 ? `${(item.file_size / 1024).toFixed(1)} KB` : 'External Link'}
                  </span>
                </div>

                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '14px',
                    color: 'var(--text-white)',
                    marginBottom: '6px',
                    wordBreak: 'break-all'
                  }}
                >
                  {item.original_filename}
                </div>

                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px', flex: 1 }}>
                  {item.description || 'No description provided.'}
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Uploaded by <strong style={{ color: 'var(--text-primary)' }}>{item.uploader_name}</strong>
                    </div>
                    {item.task_id && (
                      <button
                        className="mono"
                        style={{
                          fontSize: '11px',
                          color: 'var(--accent-orange)',
                          textDecoration: 'underline',
                          fontWeight: 600
                        }}
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
                        <Download size={14} /> Download / View
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
                      onClick={() => handleDelete(item.id, item.original_filename)}
                      title="Delete evidence"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal for full image preview */}
      {previewImage && (
        <div
          className="modal-overlay"
          onClick={() => setPreviewImage(null)}
          style={{ zIndex: 1200, cursor: 'zoom-out' }}
        >
          <div
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              position: 'relative',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.9)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewImage}
              alt="Verification Evidence Preview"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />
          </div>
        </div>
      )}

      <EvidenceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onEvidenceUploaded={() => {
          toast.success('Evidence artifact attached successfully.');
          fetchEvidence();
        }}
        tasks={tasks}
      />
    </div>
  );
};
