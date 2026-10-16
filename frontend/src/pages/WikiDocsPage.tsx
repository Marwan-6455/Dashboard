import React, { useState, useEffect } from 'react';
import {
  Library,
  GitPullRequest,
  Plus,
  Search,
  BookMarked,
  Pin,
  CheckCircle,
  FileCode,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { Document, Decision, DocumentCategory, DecisionStatus } from '../types/index.js';
import { useToast } from '../context/ToastContext.js';

interface WikiDocsPageProps {
  initialTab?: 'docs' | 'decisions';
}

export const WikiDocsPage: React.FC<WikiDocsPageProps> = ({ initialTab = 'docs' }) => {
  const { activeProjectId, user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'docs' | 'decisions'>(initialTab);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Reader
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [isNewDocModalOpen, setIsNewDocModalOpen] = useState(false);
  const [isNewDecisionModalOpen, setIsNewDecisionModalOpen] = useState(false);

  // Doc form
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState<DocumentCategory>('architecture');
  const [docContent, setDocContent] = useState('');

  // Decision form
  const [decTitle, setDecTitle] = useState('');
  const [decScope, setDecScope] = useState('Engine');
  const [decContext, setDecContext] = useState('');
  const [decOptions, setDecOptions] = useState('');
  const [decChosen, setDecChosen] = useState('');
  const [decReasoning, setDecReasoning] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docRes, decRes] = await Promise.all([
        apiRequest(`/api/wiki?projectId=${activeProjectId}`),
        apiRequest(`/api/decisions?projectId=${activeProjectId}`)
      ]);
      setDocuments(docRes.documents || []);
      setDecisions(decRes.decisions || []);
    } catch (err: any) {
      toast.error(`Failed to load knowledge base: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeProjectId]);

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle || !docContent) {
      toast.error('Title and content are required.');
      return;
    }
    try {
      await apiRequest('/api/wiki', {
        method: 'POST',
        body: JSON.stringify({
          project_id: activeProjectId,
          category: docCategory,
          title: docTitle,
          content: docContent
        })
      });
      toast.success('Document created in studio wiki.');
      setIsNewDocModalOpen(false);
      setDocTitle('');
      setDocContent('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create document.');
    }
  };

  const handleCreateDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decTitle || !decContext || !decChosen || !decReasoning) {
      toast.error('All decision fields are required.');
      return;
    }
    try {
      await apiRequest('/api/decisions', {
        method: 'POST',
        body: JSON.stringify({
          project_id: activeProjectId,
          title: decTitle,
          scope: decScope,
          context: decContext,
          options_considered: decOptions,
          chosen_approach: decChosen,
          reasoning: decReasoning,
          status: 'Accepted'
        })
      });
      toast.success('Architecture Decision Record (ADR) logged.');
      setIsNewDecisionModalOpen(false);
      setDecTitle('');
      setDecContext('');
      setDecOptions('');
      setDecChosen('');
      setDecReasoning('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to log decision.');
    }
  };

  const filteredDocs = documents.filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q);
  });

  const filteredDecisions = decisions.filter((dec) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      dec.title.toLowerCase().includes(q) ||
      dec.context.toLowerCase().includes(q) ||
      dec.chosen_approach.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Studio Wiki & Decision Log</h1>
          <p className="page-subtitle">
            Internal knowledge base, engineering conventions, rendering standards, and immutable Architecture Decision Records (ADRs).
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'docs' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsNewDocModalOpen(true)}
            >
              <Plus size={16} /> New Wiki Document
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsNewDecisionModalOpen(true)}
            >
              <Plus size={16} /> Record Decision (ADR)
            </button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'docs' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('docs')}
        >
          <Library size={16} /> Studio Documentation ({documents.length})
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'decisions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('decisions')}
        >
          <GitPullRequest size={16} /> Decision Records / ADRs ({decisions.length})
        </button>
      </div>

      {/* Search Input */}
      <div className="card" style={{ padding: '12px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Search size={16} color="var(--text-muted)" />
        <input
          type="text"
          className="form-input"
          style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
          placeholder={`Search ${activeTab === 'docs' ? 'documentation, guides, and conventions' : 'architectural decisions and options'}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Tab: Documentation */}
      {activeTab === 'docs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'border-color var(--transition-fast)'
              }}
              onClick={() => setSelectedDoc(doc)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="badge badge-primary">{doc.category.replace('_', ' ')}</span>
                {doc.is_pinned === 1 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--accent-orange)' }}>
                    <Pin size={12} /> Pinned
                  </span>
                )}
              </div>

              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-white)', marginBottom: '8px' }}>
                {doc.title}
              </div>

              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1, marginBottom: '12px' }}>
                {doc.content.slice(0, 110)}...
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--text-muted)', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <span>Author: {doc.author_name || 'Engineering'}</span>
                <span style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>Open Guide →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab: Decisions (ADRs) */}
      {activeTab === 'decisions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredDecisions.map((dec) => (
            <div
              key={dec.id}
              className="card"
              style={{
                borderLeft: '4px solid var(--accent-orange)',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedDecision(dec)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-orange)', fontSize: '14px' }}>
                    {dec.id}
                  </span>
                  <div style={{ fontWeight: 700, color: 'var(--text-white)', fontSize: '15px' }}>
                    {dec.title}
                  </div>
                </div>
                <span className={`badge ${dec.status === 'Accepted' ? 'badge-success' : 'badge-neutral'}`}>
                  {dec.status}
                </span>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Scope: <strong style={{ color: 'var(--text-secondary)' }}>{dec.scope}</strong> • Author: {dec.author_name || 'Lead'}
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                <strong>Chosen Approach:</strong> {dec.chosen_approach}
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                <strong>Reasoning:</strong> {dec.reasoning.slice(0, 140)}...
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Reader Modal */}
      {selectedDoc && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedDoc.title}</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setSelectedDoc(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: '12px' }}>
                <span className="badge badge-primary">{selectedDoc.category}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '10px' }}>
                  Version {selectedDoc.version || 1} • Last edited by {selectedDoc.author_name || 'Engineering'}
                </span>
              </div>
              <div style={{ fontSize: '13.5px', color: 'var(--text-white)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {selectedDoc.content}
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedDoc(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decision Reader Modal */}
      {selectedDecision && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedDecision.id}: {selectedDecision.title}</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setSelectedDecision(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div>
                <span className="badge badge-success">{selectedDecision.status}</span>
                <span className="badge badge-neutral" style={{ marginLeft: '6px' }}>Scope: {selectedDecision.scope}</span>
              </div>

              <div>
                <label className="form-label">Context & Problem Statement</label>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {selectedDecision.context}
                </div>
              </div>

              <div>
                <label className="form-label">Options Considered</label>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {selectedDecision.options_considered}
                </div>
              </div>

              <div style={{ background: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <label className="form-label" style={{ color: 'var(--accent-orange)' }}>Chosen Decision & Approach</label>
                <div style={{ fontSize: '13.5px', color: 'var(--text-white)', fontWeight: 600 }}>
                  {selectedDecision.chosen_approach}
                </div>
              </div>

              <div>
                <label className="form-label">Architectural Reasoning</label>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {selectedDecision.reasoning}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedDecision(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Document */}
      {isNewDocModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create Wiki Document</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsNewDocModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateDoc}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Document Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Engine Team Profiling & Shader Standards"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as DocumentCategory)}
                  >
                    <option value="architecture">Architecture</option>
                    <option value="tech_doc">Technical Documentation</option>
                    <option value="design">Design Specifications</option>
                    <option value="art_guide">Art Guidelines</option>
                    <option value="audio_guide">Audio Standards</option>
                    <option value="onboarding">Onboarding Guide</option>
                    <option value="release_process">Release Process</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Content (Markdown supported)</label>
                  <textarea
                    className="form-input"
                    rows={6}
                    placeholder="# Document Title&#10;&#10;Detailed instructions and technical specifications..."
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsNewDocModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Decision */}
      {isNewDecisionModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Record Architecture Decision (ADR)</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsNewDecisionModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateDecision}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Decision Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Compute Shader Depth Portal Pipeline"
                    value={decTitle}
                    onChange={(e) => setDecTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Scope</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Engine / Terminal 6 / Audio"
                    value={decScope}
                    onChange={(e) => setDecScope(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Context & Problem</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Why does this technical decision need to be made?"
                    value={decContext}
                    onChange={(e) => setDecContext(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Options Considered</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="1. Option A...&#10;2. Option B..."
                    value={decOptions}
                    onChange={(e) => setDecOptions(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Chosen Approach</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Specific architectural approach chosen"
                    value={decChosen}
                    onChange={(e) => setDecChosen(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Reasoning & Justification</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Key trade-offs and rationale"
                    value={decReasoning}
                    onChange={(e) => setDecReasoning(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsNewDecisionModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Commit ADR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
