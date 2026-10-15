import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserPlus,
  Copy,
  Check,
  X,
  Trash2,
  ExternalLink,
  Edit
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

interface TeamPageProps {
  onNavigateToTasksByOwner: (ownerId: string) => void;
}

export const TeamPage: React.FC<TeamPageProps> = ({ onNavigateToTasksByOwner }) => {
  const { user, hasRole, activeWorkspace } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'developer' | 'reviewer' | 'admin'>('developer');
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Edit user modal
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTeam = async () => {
    try {
      setIsLoading(true);
      const [teamRes, invRes] = await Promise.all([
        apiRequest('/api/team'),
        apiRequest('/api/auth/invitations').catch(() => ({ invitations: [] }))
      ]);
      setUsers(teamRes.users || []);
      setInvitations(invRes.invitations || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, []);

  const handleOpenEdit = (member: any) => {
    setEditingUser(member);
    setEditDisplayName(member.display_name);
    setEditRoles(member.roles || []);
  };

  const handleToggleRole = (role: string) => {
    if (editRoles.includes(role)) {
      setEditRoles(editRoles.filter((r) => r !== role));
    } else {
      setEditRoles([...editRoles, role]);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSaving(true);

    try {
      await apiRequest(`/api/team/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: editDisplayName.trim(),
          roles: editRoles
        })
      });
      setEditingUser(null);
      fetchTeam();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    setError(null);

    try {
      const res = await apiRequest('/api/auth/workspace/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole
        })
      });

      const fullUrl = `${window.location.origin}/signup?invite=${res.invitation.invitationToken}`;
      setGeneratedInviteLink(fullUrl);
      fetchTeam();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyInvite = () => {
    if (generatedInviteLink) {
      navigator.clipboard.writeText(generatedInviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevokeInvite = async (invId: string) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;
    try {
      await apiRequest(`/api/auth/invitations/${invId}`, { method: 'DELETE' });
      fetchTeam();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const isOwnerOrAdmin = hasRole('owner') || hasRole('admin');

  return (
    <div className="page-wrapper">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div className="page-title-group">
          <h1>{activeWorkspace?.name || 'Cindermarch Studio'} // Team Directory</h1>
          <p>Multi-user platform profiles, role-based authorization, workload distribution, and secure invitations.</p>
        </div>

        {isOwnerOrAdmin && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setIsInviteModalOpen(true);
              setGeneratedInviteLink(null);
              setInviteEmail('');
            }}
          >
            <UserPlus size={16} />
            <span>Invite Team Member</span>
          </button>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      {/* Invitations Section */}
      {invitations.length > 0 && isOwnerOrAdmin && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={18} style={{ color: 'var(--accent-orange)' }} />
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)' }}>
                Active Studio Invitations ({invitations.filter(i => i.status === 'pending').length} pending)
              </h2>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invited Email</th>
                  <th>Assigned Role</th>
                  <th>Status</th>
                  <th>Invited By</th>
                  <th>Expires</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600, color: 'var(--text-white)' }}>{inv.email}</td>
                    <td>
                      <span className="badge" style={{ textTransform: 'uppercase' }}>
                        {inv.role}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor:
                            inv.status === 'accepted'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : inv.status === 'pending'
                              ? 'rgba(245, 158, 11, 0.2)'
                              : 'rgba(239, 68, 68, 0.2)',
                          color:
                            inv.status === 'accepted'
                              ? 'var(--status-complete)'
                              : inv.status === 'pending'
                              ? 'var(--status-review)'
                              : 'var(--status-blocked)'
                        }}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: '12px' }}>{inv.invited_by_name || 'Owner'}</td>
                    <td className="mono" style={{ fontSize: '12px' }}>
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {inv.status === 'pending' && (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              const url = `${window.location.origin}/signup?invite=${inv.invitation_token}`;
                              navigator.clipboard.writeText(url);
                              alert('Invitation link copied to clipboard!');
                            }}
                            title="Copy invitation link"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleRevokeInvite(inv.id)}
                            style={{ color: 'var(--status-blocked)' }}
                            title="Revoke invitation"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team Member Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {users.map((member) => {
          const totalTasks = member.assigned_tasks_count || 0;
          const completedTasks = member.completed_count || 0;
          const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

          return (
            <div key={member.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    className="user-avatar"
                    style={{
                      width: '42px',
                      height: '42px',
                      fontSize: '16px',
                      backgroundColor: 'var(--accent-orange)',
                      color: '#080808',
                      fontWeight: 800
                    }}
                  >
                    {member.display_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)' }}>
                      {member.display_name}
                    </div>
                    <div className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      @{member.username} • {member.email}
                    </div>
                  </div>
                </div>

                {isOwnerOrAdmin && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenEdit(member)}
                    title="Manage Member Role"
                  >
                    <Edit size={14} />
                  </button>
                )}
              </div>

              {/* Roles Badges */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {member.workspace_role && (
                  <span
                    className="badge"
                    style={{
                      backgroundColor: 'rgba(255, 106, 0, 0.15)',
                      color: 'var(--accent-orange)',
                      border: '1px solid rgba(255, 106, 0, 0.3)',
                      textTransform: 'uppercase',
                      fontWeight: 700
                    }}
                  >
                    {member.workspace_role}
                  </span>
                )}
                {member.roles?.map((r: string) => (
                  <span
                    key={r}
                    className="badge"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase'
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>

              {/* Workload Progress Bar */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Task Completion Workload</span>
                  <span className="mono" style={{ color: 'var(--text-white)' }}>
                    {completedTasks}/{totalTasks} ({completionPct}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${completionPct}%`,
                      height: '100%',
                      backgroundColor: 'var(--status-complete)',
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>

              {/* Task Stat Counters */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '8px',
                  backgroundColor: 'var(--bg-elevated)',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}
              >
                <div>
                  <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-white)' }}>
                    {member.in_progress_count || 0}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Active
                  </div>
                </div>
                <div>
                  <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--status-review)' }}>
                    {member.awaiting_review_count || 0}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    In Review
                  </div>
                </div>
                <div>
                  <div className="mono" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--status-complete)' }}>
                    {member.completed_count || 0}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Complete
                  </div>
                </div>
                <div>
                  <div
                    className="mono"
                    style={{
                      fontSize: '18px',
                      fontWeight: 700,
                      color: member.overdue_count > 0 ? 'var(--status-blocked)' : 'var(--text-secondary)'
                    }}
                  >
                    {member.overdue_count || 0}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Overdue
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => onNavigateToTasksByOwner(member.id)}
                >
                  <span>View Member Tasks</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invite Member Modal */}
      {isInviteModalOpen && (
        <div className="modal-overlay" onClick={() => setIsInviteModalOpen(false)}>
          <div className="modal-container" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <UserPlus size={18} style={{ color: 'var(--accent-orange)' }} />
                <h2 className="modal-title">Invite to Cindermarch Studio</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setIsInviteModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {!generatedInviteLink ? (
                <form onSubmit={handleCreateInvite}>
                  <div className="form-group">
                    <label className="form-label">Developer Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      placeholder="e.g. yehia@cindermarch.studio or joe@cindermarch.studio"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label className="form-label">Studio Role & Permissions</label>
                    <select
                      className="form-control"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as any)}
                    >
                      <option value="developer">Developer (Task execution, evidence, submit reviews)</option>
                      <option value="reviewer">Reviewer (Peer review approval, test evaluation)</option>
                      <option value="admin">Admin (Full project and workspace management)</option>
                    </select>
                  </div>

                  <div className="modal-footer" style={{ padding: '16px 0 0 0' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setIsInviteModalOpen(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isInviting}>
                      {isInviting ? 'Generating...' : 'Generate Secure Invite'}
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="alert alert-success" style={{ marginBottom: '16px' }}>
                    <CheckCircle2 size={16} />
                    <span>Invitation created successfully for {inviteEmail}.</span>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Unique Registration Link</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-control mono"
                        value={generatedInviteLink}
                        readOnly
                        style={{ fontSize: '11px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleCopyInvite}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', display: 'block' }}>
                      Send this link to the developer. It is valid for 14 days and grants direct access to the Cindermarch Studio workspace.
                    </span>
                  </div>

                  <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: '16px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setIsInviteModalOpen(false);
                        setGeneratedInviteLink(null);
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit User Roles Modal */}
      {editingUser && (
        <div className="modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="modal-container" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Team Member: {editingUser.display_name}</h2>
              <button className="modal-close-btn" onClick={() => setEditingUser(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="modal-body">
              <div className="form-group">
                <label className="form-label">Display Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Roles</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {['admin', 'developer', 'reviewer'].map((r) => (
                    <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editRoles.includes(r)}
                        onChange={() => handleToggleRole(r)}
                      />
                      <span style={{ fontSize: '13px', textTransform: 'capitalize' }}>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
