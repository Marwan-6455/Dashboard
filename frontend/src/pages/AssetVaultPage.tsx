import React, { useState, useEffect } from 'react';
import {
  Box,
  Music,
  FileImage,
  Film,
  Plus,
  CheckCircle,
  Clock,
  Check,
  Search,
  Filter,
  Layers,
  Sliders,
  ExternalLink
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { Asset, AssetCategory, AssetStatus } from '../types/index.js';
import { useToast } from '../context/ToastContext.js';

export const AssetVaultPage: React.FC = () => {
  const { activeProjectId, user } = useAuth();
  const toast = useToast();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modals
  const [isNewAssetModalOpen, setIsNewAssetModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('3d_model');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('v1.0');
  const [previewUrl, setPreviewUrl] = useState('');
  const [pipelineStage, setPipelineStage] = useState('Blockout');
  const [polycount, setPolycount] = useState('');
  const [sampleRate, setSampleRate] = useState('48000');

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const data = await apiRequest(
        `/api/assets?projectId=${activeProjectId}&category=${filterCategory}&status=${filterStatus}`
      );
      setAssets(data.assets || []);
    } catch (err: any) {
      toast.error(`Failed to load assets: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [activeProjectId, filterCategory, filterStatus]);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !category) {
      toast.error('Name and category are required.');
      return;
    }

    const technicalMeta = category === '3d_model'
      ? { polycount: Number(polycount) || 2000, stage: pipelineStage }
      : category === 'sfx' || category === 'music'
      ? { sampleRate: Number(sampleRate) || 48000, channels: 2 }
      : null;

    try {
      await apiRequest('/api/assets', {
        method: 'POST',
        body: JSON.stringify({
          project_id: activeProjectId,
          name,
          category,
          description,
          version,
          status: 'Proposed',
          pipeline_stage: pipelineStage,
          preview_url: previewUrl || null,
          technical_meta_json: technicalMeta ? JSON.stringify(technicalMeta) : null
        })
      });
      toast.success('Asset registered in studio vault.');
      setIsNewAssetModalOpen(false);
      setName('');
      setDescription('');
      setPreviewUrl('');
      fetchAssets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to register asset.');
    }
  };

  const handleUpdateStatus = async (assetId: string, newStatus: AssetStatus, stage?: string) => {
    try {
      await apiRequest(`/api/assets/${assetId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus, pipelineStage: stage })
      });
      toast.success(`Asset status updated to ${newStatus}.`);
      fetchAssets();
      if (selectedAsset && selectedAsset.id === assetId) {
        setSelectedAsset(prev => prev ? { ...prev, status: newStatus, pipeline_stage: stage || prev.pipeline_stage } : null);
      }
    } catch (err: any) {
      toast.error(err.message || 'Status update failed.');
    }
  };

  const filteredAssets = assets.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return a.name.toLowerCase().includes(q) || (a.description && a.description.toLowerCase().includes(q));
  });

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Private Asset Vault</h1>
          <p className="page-subtitle">
            Curated 3D models, audio stems, concept art, textures, and pipeline integration records.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setIsNewAssetModalOpen(true)}
        >
          <Plus size={16} /> Register Asset
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
            placeholder="Search assets by name or tag..."
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
          <option value="3d_model">3D Models</option>
          <option value="material">Materials & Textures</option>
          <option value="animation">Animations</option>
          <option value="concept_art">Concept Art</option>
          <option value="audio">Audio / Music</option>
          <option value="sfx">Sound Effects (SFX)</option>
        </select>

        <select
          className="form-input"
          style={{ width: '160px', padding: '6px 10px', fontSize: '13px' }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Proposed">Proposed</option>
          <option value="In Progress">In Progress</option>
          <option value="Ready for Review">Ready for Review</option>
          <option value="Approved">Approved</option>
          <option value="Integrated">Integrated</option>
        </select>
      </div>

      {/* Assets Grid */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading asset vault...
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="empty-state">
          <Box size={36} color="var(--accent-orange)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)' }}>
            No assets found
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Register 3D meshes, textures, or audio stems using the button above.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {filteredAssets.map((asset) => {
            let metaObj: any = null;
            try {
              if (asset.technical_meta_json) metaObj = JSON.parse(asset.technical_meta_json);
            } catch {}

            return (
              <div
                key={asset.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 0,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'transform var(--transition-fast), border-color var(--transition-fast)'
                }}
                onClick={() => setSelectedAsset(asset)}
              >
                {/* Visual Thumbnail or Category Graphic */}
                <div
                  style={{
                    height: '140px',
                    backgroundColor: 'var(--bg-canvas)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    borderBottom: '1px solid var(--border-subtle)'
                  }}
                >
                  {asset.preview_url ? (
                    <img
                      src={asset.preview_url}
                      alt={asset.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : asset.category === '3d_model' ? (
                    <Box size={36} color="var(--accent-orange)" />
                  ) : asset.category === 'sfx' || asset.category === 'music' ? (
                    <Music size={36} color="var(--status-amber)" />
                  ) : (
                    <FileImage size={36} color="var(--text-muted)" />
                  )}

                  <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                    <span
                      className={`badge ${
                        asset.status === 'Integrated'
                          ? 'badge-success'
                          : asset.status === 'Approved'
                          ? 'badge-primary'
                          : asset.status === 'Ready for Review'
                          ? 'badge-amber'
                          : 'badge-neutral'
                      }`}
                    >
                      {asset.status}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-white)', marginBottom: '4px' }}>
                    {asset.name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                    {asset.category.replace('_', ' ')} • {asset.version}
                  </div>

                  {asset.description && (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4, flex: 1, marginBottom: '10px' }}>
                      {asset.description.slice(0, 85)}...
                    </p>
                  )}

                  {/* Technical Metadata Snippet */}
                  {metaObj && (
                    <div style={{ background: 'var(--bg-canvas)', padding: '6px 8px', borderRadius: 'var(--radius-sm)', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      {metaObj.polycount && <span>Polycount: {metaObj.polycount} tris • </span>}
                      {metaObj.sampleRate && <span>{metaObj.sampleRate} Hz • </span>}
                      {metaObj.durationSec && <span>{metaObj.durationSec}s • </span>}
                      <span>Stage: {asset.pipeline_stage || 'Draft'}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Owner: {asset.owner_name || 'Joe'}</span>
                    <span style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>Inspect →</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Drawer / Modal for Selected Asset */}
      {selectedAsset && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedAsset.name}</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setSelectedAsset(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {selectedAsset.preview_url && (
                <div style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', height: '200px', backgroundColor: '#000' }}>
                  <img
                    src={selectedAsset.preview_url}
                    alt={selectedAsset.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              )}

              <div>
                <span className="badge badge-primary">{selectedAsset.category}</span>
                <span className="badge badge-neutral" style={{ marginLeft: '6px' }}>{selectedAsset.version}</span>
                <span className="badge badge-success" style={{ marginLeft: '6px' }}>{selectedAsset.status}</span>
              </div>

              <div>
                <label className="form-label">Description</label>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {selectedAsset.description || 'No description provided.'}
                </div>
              </div>

              {selectedAsset.technical_meta_json && (
                <div>
                  <label className="form-label">Technical Parameters</label>
                  <pre style={{ background: 'var(--bg-canvas)', padding: '10px', borderRadius: 'var(--radius-sm)', fontSize: '11.5px', color: 'var(--text-secondary)', overflowX: 'auto' }}>
                    {JSON.stringify(JSON.parse(selectedAsset.technical_meta_json), null, 2)}
                  </pre>
                </div>
              )}

              {/* Status Update Quick Actions */}
              <div>
                <label className="form-label">Production Workflow Actions</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleUpdateStatus(selectedAsset.id, 'In Progress', 'Refinement')}
                  >
                    Move to In Progress
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleUpdateStatus(selectedAsset.id, 'Ready for Review', 'Review')}
                  >
                    Request Review
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => handleUpdateStatus(selectedAsset.id, 'Approved', 'Approved')}
                  >
                    <Check size={14} /> Approve Asset
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleUpdateStatus(selectedAsset.id, 'Integrated', 'Integrated')}
                  >
                    Mark Integrated
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedAsset(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Register New Asset */}
      {isNewAssetModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Register Studio Asset</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsNewAssetModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateAsset}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="form-label">Asset Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Victorian Platform Bench"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Category</label>
                    <select
                      className="form-input"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as AssetCategory)}
                    >
                      <option value="3d_model">3D Model</option>
                      <option value="material">Material / Texture</option>
                      <option value="animation">Animation</option>
                      <option value="concept_art">Concept Art</option>
                      <option value="sfx">Sound FX</option>
                      <option value="music">Music Track</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Version</label>
                    <input
                      type="text"
                      className="form-input"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Description & Context</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Visual notes, platform location, or audio trigger description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div>
                  <label className="form-label">Preview Image URL (Optional)</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://..."
                    value={previewUrl}
                    onChange={(e) => setPreviewUrl(e.target.value)}
                  />
                </div>

                {category === '3d_model' && (
                  <div>
                    <label className="form-label">Estimated Polygon / Triangle Budget</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="e.g. 4200"
                      value={polycount}
                      onChange={(e) => setPolycount(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsNewAssetModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Register Asset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
