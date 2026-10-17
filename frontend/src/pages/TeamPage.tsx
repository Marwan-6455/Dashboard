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
  Edit,
  ArrowRight,
  ArrowLeft,
  Plus,
  BookOpen,
  Code,
  Megaphone,
  Cpu,
  Layers,
  Volume2,
  Hash,
  Activity,
  CheckSquare,
  FileCheck2
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { PriorityBadge } from '../components/PriorityBadge.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { useToast } from '../context/ToastContext.js';

interface TeamPageProps {
  onNavigateToTasksByOwner?: (ownerId: string) => void;
  onNavigateToTasksByTeam?: (teamId: string) => void;
}

// Icon helper for teams
const getTeamIcon = (slugOrName: string) => {
  const s = slugOrName.toLowerCase();
  if (s.includes('story')) return <BookOpen size={18} color="#FF9800" />;
  if (s.includes('coding')) return <Code size={18} color="#00E5FF" />;
  if (s.includes('marketing')) return <Megaphone size={18} color="#E91E63" />;
  if (s.includes('engine')) return <Cpu size={18} color="#FF5722" />;
  if (s.includes('artist') || s.includes('3d')) return <Layers size={18} color="#9C27B0" />;
  if (s.includes('sound') || s.includes('audio')) return <Volume2 size={18} color="#4CAF50" />;
  return <Users size={18} color="var(--accent-orange)" />;
};

export const TeamPage: React.FC<TeamPageProps> = ({
  onNavigateToTasksByOwner,
  onNavigateToTasksByTeam
}) => {
  const { user, hasRole, activeWorkspace } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'teams' | 'directory' | 'invitations'>('teams');
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected team for dedicated Team Dashboard view
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeamData, setSelectedTeamData] = useState<any | null>(null);
  const [isLoadingTeamDetail, setIsLoadingTeamDetail] = useState(false);

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'developer' | 'team_manager' | 'reviewer' | 'admin'>('developer');
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Create Team modal
  const [isCreateTeamModalOpen, setIsCreateTeamModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [newTeamDiscordChannel, setNewTeamDiscordChannel] = useState('');
  const [newTeamManagerId, setNewTeamManagerId] = useState('');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);

  // Assign Member to Team modal
  const [assigningTeam, setAssigningTeam] = useState<any | null>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRole, setAssignRole] = useState<'member' | 'manager'>('member');
  const [isAssigning, setIsAssigning] = useState(false);

  // Edit user modal
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [isSavingUser, setIsSavingUser] = useState(false);

  const isOwnerOrAdmin = hasRole('owner') || hasRole('admin');

  const fetchTeamData = async () => {
    try {
      setIsLoading(true);
      const [teamRes, invRes] = await Promise.all([
        apiRequest('/api/team'),
        apiRequest('/api/auth/invitations').catch(() => ({ invitations: [] }))
      ]);
      setTeams(teamRes.teams || []);
      setUsers(teamRes.users || []);
      setInvitations(invRes.invitations || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTeamDetail = async (teamId: string) => {
    try {
      setIsLoadingTeamDetail(true);
      const res = await apiRequest(`/api/team/${teamId}`);
      setSelectedTeamData(res.team);
    } catch (err: any) {
      toast.error(`Failed to load team dashboard: ${err.message}`);
      setSelectedTeamId(null);
    } finally {
      setIsLoadingTeamDetail(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      fetchTeamDetail(selectedTeamId);
    } else {
      setSelectedTeamData(null);
    }
  }, [selectedTeamId]);

  // Handle invitation generation
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
      toast.success('Workspace invitation link generated.');
      fetchTeamData();
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyInvite = () => {
    if (generatedInviteLink) {
      navigator.clipboard.writeText(generatedInviteLink);
      setCopied(true);
      toast.success('Invitation link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRevokeInvite = async (invId: string) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) return;
    try {
      await apiRequest(`/api/auth/invitations/${invId}`, { method: 'DELETE' });
      toast.success('Invitation revoked successfully.');
      fetchTeamData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Handle dynamic team creation
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setIsCreatingTeam(true);

    try {
      await apiRequest('/api/team/teams', {
        method: 'POST',
        body: JSON.stringify({
          name: newTeamName.trim(),
          description: newTeamDescription.trim(),
          discordChannelId: newTeamDiscordChannel.trim() || null,
          managerId: newTeamManagerId || null,
          projectId: 'terminal-6'
        })
      });

      setIsCreateTeamModalOpen(false);
      setNewTeamName('');
      setNewTeamDescription('');
      setNewTeamDiscordChannel('');
      setNewTeamManagerId('');
      toast.success(`Studio team "${newTeamName.trim()}" created successfully.`);
      fetchTeamData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsCreatingTeam(false);
    }
  };

  // Handle member assignment to team
  const handleAssignMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningTeam || !assignUserId) return;
    setIsAssigning(true);

    try {
      await apiRequest(`/api/team/${assigningTeam.id}/members`, {
        method: 'POST',
        body: JSON.stringify({
          userId: assignUserId,
          role: assignRole
        })
      });

      setAssigningTeam(null);
      setAssignUserId('');
      toast.success('Member assigned to team successfully.');
      fetchTeamData();
      if (selectedTeamId === assigningTeam.id) {
        fetchTeamDetail(assigningTeam.id);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle member removal from team
  const handleRemoveMember = async (teamId: string, memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this team?`)) return;
    try {
      await apiRequest(`/api/team/${teamId}/members/${memberId}`, { method: 'DELETE' });
      toast.success(`Removed ${memberName} from team.`);
      fetchTeamData();
      if (selectedTeamId === teamId) {
        fetchTeamDetail(teamId);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Handle user edit
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
    setIsSavingUser(true);

    try {
      await apiRequest(`/api/team/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: editDisplayName.trim(),
          roles: editRoles
        })
      });
      setEditingUser(null);
      toast.success('Team member profile and roles updated.');
      fetchTeamData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingUser(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-wrapper">
        <div style={{ color: 'var(--text-secondary)', padding: '40px 0' }}>
          Loading Cindermarch Studio teams and workspace roster...
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: DEDICATED TEAM DASHBOARD (Filtered view for a specific team)
  // =========================================================================
  if (selectedTeamId && selectedTeamData) {
    const t = selectedTeamData;
    const isTeamManager = t.managerId === user?.id;
    const canManageThisTeam = isOwnerOrAdmin || isTeamManager;

    return (
      <div className="page-wrapper">
        {/* Navigation Breadcrumb */}
        <div style={{ marginBottom: '16px' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedTeamId(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            <span>Back to All Studio Teams</span>
          </button>
        </div>

        {/* Team Header */}
        <div className="page-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                {getTeamIcon(t.name)}
              </div>
              <h1 style={{ margin: 0 }}>{t.name}</h1>
              <span className="badge badge-backlog" style={{ textTransform: 'uppercase' }}>
                {t.projectId || 'terminal-6'}
              </span>
              {t.discordChannelId && (
                <span className="badge" style={{ backgroundColor: 'rgba(88, 101, 242, 0.15)', color: '#5865F2' }}>
                  <Hash size={12} style={{ marginRight: '2px' }} />
                  {t.discordChannelId}
                </span>
              )}
            </div>
            <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: '720px' }}>
              {t.description || 'Dedicated departmental team for Cindermarch Studio development.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {canManageThisTeam && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setAssigningTeam(t);
                  setAssignUserId('');
                  setAssignRole('member');
                }}
              >
                <Plus size={16} />
                <span>Assign Member</span>
              </button>
            )}

            {onNavigateToTasksByTeam && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onNavigateToTasksByTeam(t.id)}
              >
                <CheckSquare size={16} />
                <span>Open Team Task Board</span>
              </button>
            )}
          </div>
        </div>

        {/* Team Metrics Bar */}
        <div className="metrics-grid" style={{ marginBottom: '24px' }}>
          <div className="metric-card accent-orange">
            <div className="metric-label">Active Tasks</div>
            <div className="metric-value">{t.tasks?.active?.length || 0}</div>
            <div className="metric-sub">Under active development</div>
          </div>
          <div className="metric-card accent-amber">
            <div className="metric-label">Due Soon (7 Days)</div>
            <div className="metric-value">{t.tasks?.dueSoon?.length || 0}</div>
            <div className="metric-sub">Upcoming milestones</div>
          </div>
          <div className="metric-card accent-red">
            <div className="metric-label">Overdue Tasks</div>
            <div className="metric-value" style={{ color: (t.tasks?.overdue?.length || 0) > 0 ? 'var(--status-blocked)' : 'var(--text-white)' }}>
              {t.tasks?.overdue?.length || 0}
            </div>
            <div className="metric-sub">Passed deadline</div>
          </div>
          <div className="metric-card accent-red">
            <div className="metric-label">Blocked</div>
            <div className="metric-value">{t.tasks?.blocked?.length || 0}</div>
            <div className="metric-sub">Waiting on dependencies</div>
          </div>
          <div className="metric-card accent-blue">
            <div className="metric-label">In Review</div>
            <div className="metric-value">{t.tasks?.pendingReviews?.length || 0}</div>
            <div className="metric-sub">Awaiting peer review</div>
          </div>
          <div className="metric-card accent-green">
            <div className="metric-label">Verified Complete</div>
            <div className="metric-value">{t.tasks?.completed?.length || 0}</div>
            <div className="metric-sub">Passed completion gates</div>
          </div>
        </div>

        {/* 2 Columns: Tasks & Team Roster */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
          {/* Column A: Team Tasks */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <CheckSquare size={16} color="var(--accent-orange)" />
                  <span>Team Active Tasks ({t.tasks?.active?.length || 0})</span>
                </div>
                {onNavigateToTasksByTeam && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onNavigateToTasksByTeam(t.id)}
                  >
                    View All
                  </button>
                )}
              </div>

              {(!t.tasks?.active || t.tasks.active.length === 0) ? (
                <div className="empty-state" style={{ padding: '28px 0' }}>
                  <p>No active tasks assigned to this team.</p>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Tasks created with the team selector will appear here.
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {t.tasks.active.map((task: any) => (
                    <div
                      key={task.id}
                      style={{
                        padding: '12px',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="mono" style={{ fontSize: '12px', color: 'var(--accent-orange)', fontWeight: 600 }}>
                            {task.id}
                          </span>
                          <PriorityBadge priority={task.priority} />
                          <StatusBadge status={task.status} />
                        </div>
                        {task.deadline && (
                          <span
                            className="mono"
                            style={{
                              fontSize: '11px',
                              color: new Date(task.deadline) < new Date() ? 'var(--status-blocked)' : 'var(--text-secondary)'
                            }}
                          >
                            Due: {new Date(task.deadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-white)', marginBottom: '4px' }}>
                        {task.title}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        Assignee: <strong>{task.owner_name || 'Unassigned'}</strong>
                        {task.reviewer_name && <> • Reviewer: <strong>{task.reviewer_name}</strong></>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Team Activity Feed */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Activity size={16} color="var(--accent-orange)" />
                  <span>Recent Team Activity</span>
                </div>
              </div>

              {(!t.recentActivity || t.recentActivity.length === 0) ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <p>No recent activity recorded for this team.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {t.recentActivity.slice(0, 10).map((act: any) => (
                    <div
                      key={act.id}
                      style={{
                        padding: '8px 10px',
                        backgroundColor: 'var(--bg-elevated)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <strong>{act.actor_name || 'System'}</strong> {act.description || act.event_type}
                        {act.task_title && (
                          <span style={{ color: 'var(--text-muted)' }}> on "{act.task_title}"</span>
                        )}
                      </div>
                      <span className="mono" style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Column B: Team Roster & Members */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Users size={16} color="var(--accent-orange)" />
                  <span>Team Roster ({t.members?.length || 0})</span>
                </div>
                {canManageThisTeam && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setAssigningTeam(t);
                      setAssignUserId('');
                      setAssignRole('member');
                    }}
                  >
                    <Plus size={13} />
                    <span>Assign</span>
                  </button>
                )}
              </div>

              {(!t.members || t.members.length === 0) ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <p>No developers assigned to this team yet.</p>
                  {canManageThisTeam && (
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: '8px' }}
                      onClick={() => {
                        setAssigningTeam(t);
                        setAssignUserId('');
                        setAssignRole('member');
                      }}
                    >
                      Assign Workspace Member
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {t.members.map((m: any) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        backgroundColor: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent-orange)',
                            color: '#000',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px'
                          }}
                        >
                          {m.display_name?.slice(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <strong style={{ fontSize: '13px', color: 'var(--text-white)' }}>
                              {m.display_name}
                            </strong>
                            {m.team_role === 'manager' && (
                              <span className="badge badge-ready-for-review" style={{ fontSize: '10px', fontWeight: 700 }}>
                                {t.id === 'team_engine' ? 'ENGINE LEAD' : 'MANAGER'}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            @{m.username} • {m.active_tasks_count || 0} active team tasks
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {onNavigateToTasksByOwner && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onNavigateToTasksByOwner(m.id)}
                            title="View developer's tasks"
                          >
                            Tasks
                          </button>
                        )}

                        {canManageThisTeam && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleRemoveMember(t.id, m.id, m.display_name)}
                            style={{ color: 'var(--status-blocked)' }}
                            title="Remove member from team"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manager Box */}
            <div className="card" style={{ border: '1px solid rgba(255, 87, 34, 0.3)' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.05em' }}>
                TEAM MANAGER / LEAD
              </div>
              {t.manager ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-orange)',
                      color: '#000',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px'
                    }}
                  >
                    {t.manager.displayName?.slice(0, 2).toUpperCase() || 'M'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)', fontSize: '14px' }}>
                      {t.manager.displayName}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      @{t.manager.username} • Department Lead
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  No lead or manager appointed yet. Workspace Owner or Admin can assign a manager through the Assign Member dialog.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: MAIN PAGE (Studio Teams Grid, Directory, and Invitations)
  // =========================================================================
  return (
    <div className="page-wrapper">
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div className="page-title-group">
          <h1>{activeWorkspace?.name || 'Cindermarch Studio'} // Teams & Platform Roster</h1>
          <p>Departmental teams, role-based authorization, workload distribution, and secure workspace invitations.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {isOwnerOrAdmin && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsCreateTeamModalOpen(true)}
              >
                <Plus size={16} />
                <span>Create Team</span>
              </button>

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
            </>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '24px',
          paddingBottom: '2px'
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('teams')}
          style={{
            padding: '8px 16px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'teams' ? '2px solid var(--accent-orange)' : '2px solid transparent',
            color: activeTab === 'teams' ? 'var(--text-white)' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '13.5px',
            cursor: 'pointer'
          }}
        >
          Studio Teams ({teams.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          style={{
            padding: '8px 16px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'directory' ? '2px solid var(--accent-orange)' : '2px solid transparent',
            color: activeTab === 'directory' ? 'var(--text-white)' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '13.5px',
            cursor: 'pointer'
          }}
        >
          Workspace Directory ({users.length})
        </button>

        {isOwnerOrAdmin && (
          <button
            type="button"
            onClick={() => setActiveTab('invitations')}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'invitations' ? '2px solid var(--accent-orange)' : '2px solid transparent',
              color: activeTab === 'invitations' ? 'var(--text-white)' : 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: '13.5px',
              cursor: 'pointer'
            }}
          >
            Invitations ({invitations.filter((i) => i.status === 'pending').length} pending)
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: STUDIO TEAMS GRID */}
      {/* ===================================================================== */}
      {activeTab === 'teams' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
          {teams.map((team) => {
            const m = team.metrics || {
              activeTasksCount: 0,
              dueSoonCount: 0,
              overdueCount: 0,
              blockedCount: 0,
              completedTasksCount: 0
            };

            return (
              <div
                key={team.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  border: team.managerId === user?.id ? '1px solid rgba(255, 87, 34, 0.4)' : undefined
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--bg-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      {getTeamIcon(team.name)}
                    </div>
                    <div>
                      <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-white)' }}>
                        {team.name}
                      </h2>
                      <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        ID: {team.id}
                      </span>
                    </div>
                  </div>

                  <span className="badge badge-backlog" style={{ textTransform: 'uppercase', fontSize: '10.5px' }}>
                    {team.projectId || 'terminal-6'}
                  </span>
                </div>

                {/* Description */}
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '14px', minHeight: '36px', lineHeight: '1.4' }}>
                  {team.description || 'Departmental team for Cindermarch Studio.'}
                </div>

                {/* Manager & Discord Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Team Lead / Manager:</span>
                    <strong style={{ color: team.manager ? 'var(--text-white)' : 'var(--text-muted)' }}>
                      {team.manager ? team.manager.displayName : 'None Appointed'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Discord Channel:</span>
                    {team.discordChannelId ? (
                      <span className="mono" style={{ color: '#5865F2', fontSize: '11px' }}>
                        #{team.discordChannelId}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unconfigured</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Active Members:</span>
                    <strong style={{ color: 'var(--text-white)' }}>
                      {team.memberCount || 0} developer(s)
                    </strong>
                  </div>
                </div>

                {/* Metrics Summary Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '6px',
                    padding: '10px',
                    backgroundColor: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '16px',
                    textAlign: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-orange)' }}>
                      {m.activeTasksCount}
                    </div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Active
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--status-review)' }}>
                      {m.dueSoonCount}
                    </div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Due Soon
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: m.overdueCount > 0 ? 'var(--status-blocked)' : 'var(--text-secondary)'
                      }}
                    >
                      {m.overdueCount}
                    </div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Overdue
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--status-complete)' }}>
                      {m.completedTasksCount}
                    </div>
                    <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Done
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    <span>Team Dashboard</span>
                    <ArrowRight size={13} />
                  </button>

                  {onNavigateToTasksByTeam && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNavigateToTasksByTeam(team.id)}
                      title="Filter Task Board by this team"
                    >
                      <CheckSquare size={13} />
                    </button>
                  )}

                  {(isOwnerOrAdmin || team.managerId === user?.id) && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setAssigningTeam(team);
                        setAssignUserId('');
                        setAssignRole('member');
                      }}
                      title="Assign member to this team"
                    >
                      <Plus size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: WORKSPACE DIRECTORY */}
      {/* ===================================================================== */}
      {activeTab === 'directory' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-white)' }}>
              Studio Accounts & Workload Distribution ({users.length})
            </h2>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Real authenticated user profiles in Cindermarch Studio
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Developer</th>
                  <th>Workspace Role</th>
                  <th>Assigned Teams</th>
                  <th>Active Tasks</th>
                  <th>Overdue</th>
                  <th>Completed</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent-orange)',
                            color: '#000',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px'
                          }}
                        >
                          {member.display_name?.slice(0, 2).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-white)', fontSize: '13px' }}>
                            {member.display_name}
                          </div>
                          <div className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            @{member.username} • {member.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {member.id === 'usr_lead' || member.teams?.some((t: any) => t.teamId === 'team_engine' && t.role === 'manager') ? (
                        <span className="badge badge-ready-for-review" style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                          Engine Lead
                        </span>
                      ) : member.workspace_role === 'owner' ? (
                        <span className="badge badge-primary" style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                          Owner / Admin
                        </span>
                      ) : member.roles?.includes('reviewer') ? (
                        <span className="badge badge-backlog" style={{ textTransform: 'uppercase' }}>
                          Developer / Reviewer
                        </span>
                      ) : (
                        <span className="badge badge-backlog" style={{ textTransform: 'uppercase' }}>
                          {member.workspace_role || 'Developer'}
                        </span>
                      )}
                    </td>
                    <td>
                      {member.teams && member.teams.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {member.teams.map((tm: any) => (
                            <span
                              key={tm.teamId}
                              className="badge"
                              style={{
                                fontSize: '10.5px',
                                backgroundColor: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-white)'
                              }}
                            >
                              {tm.teamName}
                              {tm.role === 'manager' && ' (Lead)'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No team assigned
                        </span>
                      )}
                    </td>
                    <td>
                      <strong style={{ color: member.assigned_tasks_count > 0 ? 'var(--status-progress)' : 'var(--text-secondary)' }}>
                        {member.assigned_tasks_count || 0}
                      </strong>
                    </td>
                    <td>
                      <strong style={{ color: member.overdue_count > 0 ? 'var(--status-blocked)' : 'var(--text-secondary)' }}>
                        {member.overdue_count || 0}
                      </strong>
                    </td>
                    <td>
                      <strong style={{ color: member.completed_count > 0 ? 'var(--status-complete)' : 'var(--text-secondary)' }}>
                        {member.completed_count || 0}
                      </strong>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {onNavigateToTasksByOwner && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onNavigateToTasksByOwner(member.id)}
                            title="View member tasks"
                          >
                            Tasks
                          </button>
                        )}
                        {isOwnerOrAdmin && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(member)}
                            title="Edit roles"
                          >
                            <Edit size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: INVITATIONS */}
      {/* ===================================================================== */}
      {activeTab === 'invitations' && isOwnerOrAdmin && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-white)' }}>
              Studio Workspace Invitations
            </h2>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setIsInviteModalOpen(true);
                setGeneratedInviteLink(null);
                setInviteEmail('');
              }}
            >
              <UserPlus size={14} />
              <span>Generate New Invite</span>
            </button>
          </div>

          {invitations.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <p>No invitations created yet.</p>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Invitations grant secure access to join the private Cindermarch Studio workspace.
              </span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email Address</th>
                    <th>Role</th>
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
                                toast.success('Invitation link copied to clipboard!');
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
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: INVITE MEMBER */}
      {/* ===================================================================== */}
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
                      placeholder="developer@cindermarch.studio"
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
                      <option value="team_manager">Team Manager (Lead and assign team tasks, review work)</option>
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

      {/* ===================================================================== */}
      {/* MODAL: CREATE NEW TEAM */}
      {/* ===================================================================== */}
      {isCreateTeamModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCreateTeamModalOpen(false)}>
          <div className="modal-container" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Plus size={18} style={{ color: 'var(--accent-orange)' }} />
                <h2 className="modal-title">Create New Studio Team</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setIsCreateTeamModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="modal-body">
              <div className="form-group">
                <label className="form-label">Team Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. VFX & Shaders Team"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description & Mission</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Responsibilities, scope, and objectives..."
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Appoint Team Manager (Optional)</label>
                <select
                  className="form-control"
                  value={newTeamManagerId}
                  onChange={(e) => setNewTeamManagerId(e.target.value)}
                >
                  <option value="">No manager appointed yet</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Discord Channel ID (Optional)</label>
                <input
                  type="text"
                  className="form-control mono"
                  placeholder="e.g. 1394770347030483034"
                  value={newTeamDiscordChannel}
                  onChange={(e) => setNewTeamDiscordChannel(e.target.value)}
                />
              </div>

              <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateTeamModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isCreatingTeam || !newTeamName.trim()}>
                  {isCreatingTeam ? 'Creating Team...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: ASSIGN MEMBER TO TEAM */}
      {/* ===================================================================== */}
      {assigningTeam && (
        <div className="modal-overlay" onClick={() => setAssigningTeam(null)}>
          <div className="modal-container" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Assign Member to {assigningTeam.name}</h2>
              <button className="modal-close-btn" onClick={() => setAssigningTeam(null)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignMember} className="modal-body">
              <div className="form-group">
                <label className="form-label">Select Workspace Member</label>
                <select
                  className="form-control"
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  required
                >
                  <option value="">Choose a member...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.display_name} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Role within Team</label>
                <select
                  className="form-control"
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value as any)}
                >
                  <option value="member">Team Member (Executes and submits tasks)</option>
                  <option value="manager">Team Manager (Lead and manages team tasks)</option>
                </select>
              </div>

              <div className="modal-footer" style={{ padding: '16px 0 0 0', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAssigningTeam(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isAssigning || !assignUserId}>
                  {isAssigning ? 'Assigning...' : 'Assign to Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: EDIT USER ROLES */}
      {/* ===================================================================== */}
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
                <button type="submit" className="btn btn-primary" disabled={isSavingUser}>
                  {isSavingUser ? 'Saving...' : 'Save Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
