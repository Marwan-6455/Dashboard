import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  User,
  MapPin,
  Shield,
  Scroll,
  MessageSquare,
  Plus,
  Check,
  Search,
  Filter,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { StoryBibleEntry, StoryCategory } from '../types/index.js';
import { useToast } from '../context/ToastContext.js';

export const StoryBiblePage: React.FC = () => {
  const { activeProjectId, user } = useAuth();
  const toast = useToast();

  const [entries, setEntries] = useState<StoryBibleEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modals
  const [isNewEntryModalOpen, setIsNewEntryModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<StoryBibleEntry | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<StoryCategory>('character');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');

  const fetchStoryEntries = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(
        `/api/story?projectId=${activeProjectId}&category=${filterCategory}&status=${filterStatus}`
      );
      setEntries(data.entries || []);
    } catch (err: any) {
      toast.error(`Failed to load story bible: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoryEntries();
  }, [activeProjectId, filterCategory, filterStatus]);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !summary || !body) {
      toast.error('Title, summary, and narrative body are required.');
      return;
    }
    try {
      await apiRequest('/api/story', {
        method: 'POST',
        body: JSON.stringify({
          project_id: activeProjectId,
          category,
          title,
          summary,
          body,
          status: 'Draft'
        })
      });
      toast.success('Story entry added to bible.');
      setIsNewEntryModalOpen(false);
      setTitle('');
      setSummary('');
      setBody('');
      fetchStoryEntries();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add story entry.');
    }
  };

  const handleApproveEntry = async (entryId: string) => {
    try {
      await apiRequest(`/api/story/${entryId}/approve`, { method: 'POST' });
      toast.success('Narrative entry approved into studio canon.');
      fetchStoryEntries();
      if (selectedEntry && selectedEntry.id === entryId) {
        setSelectedEntry(prev => prev ? { ...prev, status: 'Canon Approved' } : null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Approval failed.');
    }
  };

  const filteredEntries = entries.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q)
    );
  });

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'character':
        return <User size={16} color="var(--accent-orange)" />;
      case 'location':
        return <MapPin size={16} color="var(--status-amber)" />;
      case 'faction':
        return <Shield size={16} color="var(--accent-blue)" />;
      case 'dialogue':
        return <MessageSquare size={16} color="var(--status-green)" />;
      default:
        return <Scroll size={16} color="var(--text-muted)" />;
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Story Development Toolkit & Canon Bible</h1>
          <p className="page-subtitle">
            World-building, characters, psychological horror narrative lore, and dialogue structures.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsNewEntryModalOpen(true)}
        >
          <Plus size={16} /> New Story Entry
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            className="form-input"
            style={{ width: '100%', padding: '6px 10px', fontSize: '13px' }}
            placeholder="Search characters, lore, and dialogue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="form-input"
          style={{ width: '160px', padding: '6px 10px', fontSize: '13px' }}
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          <option value="character">Characters</option>
          <option value="location">Locations</option>
          <option value="faction">Factions</option>
          <option value="lore">Lore & History</option>
          <option value="dialogue">Dialogue Trees</option>
          <option value="quest_beat">Narrative Beats</option>
        </select>

        <select
          className="form-input"
          style={{ width: '160px', padding: '6px 10px', fontSize: '13px' }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="In Review">In Review</option>
          <option value="Canon Approved">Canon Approved</option>
        </select>
      </div>

      {/* Story Bible Grid */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Retrieving narrative documents...
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="empty-state">
          <BookOpen size={36} color="var(--accent-orange)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)' }}>
            Story Bible is empty for this criteria
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Add characters, locations, or lore entries using the button above.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'border-color var(--transition-fast)'
              }}
              onClick={() => setSelectedEntry(entry)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {getCategoryIcon(entry.category)}
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {entry.category}
                  </span>
                </div>
                <span
                  className={`badge ${
                    entry.status === 'Canon Approved'
                      ? 'badge-success'
                      : entry.status === 'In Review'
                      ? 'badge-primary'
                      : 'badge-neutral'
                  }`}
                >
                  {entry.status}
                </span>
              </div>

              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-white)', marginBottom: '6px' }}>
                {entry.title}
              </div>

              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5, flex: 1, marginBottom: '12px' }}>
                {entry.summary}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px', color: 'var(--text-muted)', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                <span>Author: {entry.author_name || 'Narrative Lead'}</span>
                <span style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>Read Document →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reader Modal */}
      {selectedEntry && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getCategoryIcon(selectedEntry.category)}
                <h3 className="modal-title">{selectedEntry.title}</h3>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setSelectedEntry(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-primary">{selectedEntry.category}</span>
                <span className={`badge ${selectedEntry.status === 'Canon Approved' ? 'badge-success' : 'badge-neutral'}`}>
                  {selectedEntry.status}
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Version {selectedEntry.version || '1.0'}
                </span>
              </div>

              <div style={{ background: 'var(--bg-canvas)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontStyle: 'italic', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {selectedEntry.summary}
              </div>

              <div style={{ fontSize: '13.5px', color: 'var(--text-white)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {selectedEntry.body}
              </div>
            </div>

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div>
                {selectedEntry.status !== 'Canon Approved' && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleApproveEntry(selectedEntry.id)}
                  >
                    <Check size={14} /> Approve into Studio Canon
                  </button>
                )}
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedEntry(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Story Entry */}
      {isNewEntryModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3 className="modal-title">New Story Bible Entry</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsNewEntryModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateEntry}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Signal Tower Operator 4"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Category</label>
                  <select
                    className="form-input"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as StoryCategory)}
                  >
                    <option value="character">Character Profile</option>
                    <option value="location">Location / Environment</option>
                    <option value="faction">Faction / Organization</option>
                    <option value="lore">Lore & World History</option>
                    <option value="dialogue">Dialogue Script</option>
                    <option value="quest_beat">Quest / Narrative Beat</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Short Summary (Bible Index)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="One-to-two sentence synopsis"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Full Narrative Body</label>
                  <textarea
                    className="form-input"
                    rows={5}
                    placeholder="Full lore details, backstory, dialogue lines, and psychological horror themes..."
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsNewEntryModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save to Story Bible
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
