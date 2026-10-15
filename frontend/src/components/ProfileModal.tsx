import React, { useState } from 'react';
import { X, User, Lock, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_PRESETS = [
  { id: 'lead', label: 'Engine Lead', color: '#FF6A00' },
  { id: 'code', label: 'Core Dev', color: '#E05500' },
  { id: 'systems', label: 'Systems Arch', color: '#C0C0C0' },
  { id: 'graphics', label: 'Shaders & VFX', color: '#FF8533' },
  { id: 'qa', label: 'QA & Reviewer', color: '#888888' }
];

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [selectedPreset, setSelectedPreset] = useState(user?.avatarUrl || 'lead');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword && !currentPassword) {
      setError('Current password is required to set a new password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        avatarUrl: selectedPreset,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined
      });
      setSuccess('Profile updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: '480px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <User size={20} style={{ color: 'var(--accent-orange)' }} />
            <h2 className="modal-title">Developer Profile Settings</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success" style={{ marginBottom: '16px' }}>
              <Check size={16} />
              <span>{success}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              type="text"
              className="form-control"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Account Roles</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {user?.roles?.map((r) => (
                <span
                  key={r}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    color: 'var(--text-white)',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}
                >
                  {r}
                </span>
              ))}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
              Role changes must be granted by the Workspace Owner to prevent privilege escalation.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Avatar Identity Preset</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {AVATAR_PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedPreset(preset.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px 4px',
                      borderRadius: '6px',
                      border: isSelected ? '2px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
                      backgroundColor: isSelected ? 'rgba(255,106,0,0.1)' : 'var(--bg-elevated)',
                      cursor: 'pointer'
                    }}
                  >
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: preset.color,
                        color: '#080808',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '12px'
                      }}
                    >
                      {preset.label.slice(0, 1)}
                    </div>
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: '1.1' }}>
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', marginTop: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-white)',
                marginBottom: '12px'
              }}
            >
              <Lock size={14} style={{ color: 'var(--accent-orange)' }} />
              <span>Change Password</span>
            </div>

            <div className="form-group">
              <label className="form-label">Current Password</label>
              <input
                type="password"
                className="form-control"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: '16px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
