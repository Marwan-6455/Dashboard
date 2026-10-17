import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  UserCheck,
  UserX,
  UserPlus,
  RefreshCw,
  Lock,
  AlertTriangle,
  CheckCircle2,
  FolderKanban,
  Clock,
  Settings,
  Mail,
  Layers,
  Search,
  Filter,
  ArrowRightLeft,
  Trash2,
  History,
  Bot,
  ExternalLink,
  Copy,
  ChevronRight,
  Eye,
  Key
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';
import { useToast } from '../context/ToastContext.js';
import { UserRole, AdminAuditEntry } from '../types/index.js';

interface AdminOverviewData {
  workspaceId: string;
  workspaceName: string;
  primaryOwner: {
    id: string;
    username: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
  };
  superAdmins: Array<{
    id: string;
    username: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    appointedAt: string;
  }>;
  superAdminSlots: {
    maxSlots: number;
    usedSlots: number;
    availableSlots: number;
  };
  counts: {
    totalMembers: number;
    activeMembers: number;
    suspendedMembers: number;
    pendingApprovals: number;
    invitations: number;
  };
  canManageSuperAdmins: boolean;
}

interface MemberDirectoryItem {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
  role: UserRole;
  status: 'active' | 'suspended' | 'pending_approval' | 'rejected';
  isSuspended: boolean;
  suspendedAt: string | null;
  suspensionReason: string | null;
  reinstatedAt: string | null;
  reinstatementReason: string | null;
  activeTasksCount: number;
  completedTasksCount: number;
  activeStrikesCount: number;
  teams: Array<{
    teamId: string;
    teamName: string;
    role: string;
  }>;
}

interface TeamData {
  id: string;
  name: string;
  slug: string;
  description: string;
  managerId: string | null;
  managerName?: string;
  projectId: string;
  discordChannelId?: string;
  membersCount?: number;
}

export const AdministrationPage: React.FC<{ onNavigate?: (page: string, params?: any) => void }> = ({ onNavigate }) => {
  const { user } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'approvals' | 'projects_teams' | 'audit'>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [members, setMembers] = useState<MemberDirectoryItem[]>([]);
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<AdminAuditEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState<number>(0);

  // Filters for Members Directory
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [teamFilter, setTeamFilter] = useState<string>('');

  // Filters for Audit Log
  const [auditActionFilter, setAuditActionFilter] = useState<string>('');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');

  // Modals state
  const [isAppointModalOpen, setIsAppointModalOpen] = useState<boolean>(false);
  const [appointTargetUserId, setAppointTargetUserId] = useState<string>('');
  const [appointPassword, setAppointPassword] = useState<string>('');
  const [appointReason, setAppointReason] = useState<string>('');
  const [isAppointing, setIsAppointing] = useState<boolean>(false);

  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState<boolean>(false);
  const [revokeTargetUser, setRevokeTargetUser] = useState<any | null>(null);
  const [revokePassword, setRevokePassword] = useState<string>('');
  const [revokeReason, setRevokeReason] = useState<string>('');
  const [isRevoking, setIsRevoking] = useState<boolean>(false);

  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState<boolean>(false);
  const [suspendTargetUser, setSuspendTargetUser] = useState<MemberDirectoryItem | null>(null);
  const [suspendReason, setSuspendReason] = useState<string>('');
  const [isSuspending, setIsSuspending] = useState<boolean>(false);

  const [isReinstateModalOpen, setIsReinstateModalOpen] = useState<boolean>(false);
  const [reinstateTargetUser, setReinstateTargetUser] = useState<MemberDirectoryItem | null>(null);
  const [reinstateReason, setReinstateReason] = useState<string>('');
  const [isReinstating, setIsReinstating] = useState<boolean>(false);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);
  const [roleTargetUser, setRoleTargetUser] = useState<MemberDirectoryItem | null>(null);
  const [newSelectedRole, setNewSelectedRole] = useState<UserRole>('team_member');
  const [isUpdatingRole, setIsUpdatingRole] = useState<boolean>(false);

  const [isReassignModalOpen, setIsReassignModalOpen] = useState<boolean>(false);
  const [reassignFromUser, setReassignFromUser] = useState<MemberDirectoryItem | null>(null);
  const [reassignToUserId, setReassignToUserId] = useState<string>('');
  const [reassignReason, setReassignReason] = useState<string>('');
  const [isReassigning, setIsReassigning] = useState<boolean>(false);

  const [isManageTeamsModalOpen, setIsManageTeamsModalOpen] = useState<boolean>(false);
  const [teamsTargetUser, setTeamsTargetUser] = useState<MemberDirectoryItem | null>(null);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [isSavingTeams, setIsSavingTeams] = useState<boolean>(false);

  // New Invitation Form
  const [newInviteEmail, setNewInviteEmail] = useState<string>('');
  const [newInviteRole, setNewInviteRole] = useState<UserRole>('team_member');
  const [newInviteTeamId, setNewInviteTeamId] = useState<string>('');
  const [isCreatingInvite, setIsCreatingInvite] = useState<boolean>(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);

  // Check if current logged-in user is the Primary Owner
  const isPrimaryOwner = Boolean(overview?.primaryOwner?.id && user?.id === overview.primaryOwner.id);

  const fetchOverview = async () => {
    try {
      const data = await apiRequest('/api/admin/overview');
      setOverview(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load administration overview.');
    }
  };

  const fetchMembers = async () => {
    try {
      let url = '/api/admin/members?';
      if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;
      if (roleFilter) url += `role=${encodeURIComponent(roleFilter)}&`;
      if (statusFilter) url += `status=${encodeURIComponent(statusFilter)}&`;
      if (teamFilter) url += `teamId=${encodeURIComponent(teamFilter)}&`;

      const data = await apiRequest(url);
      setMembers(data.members || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load member directory.');
    }
  };

  const fetchTeamsAndApprovals = async () => {
    try {
      const [teamsRes, approvalsRes, invitesRes] = await Promise.all([
        apiRequest('/api/team'),
        apiRequest('/api/admin/pending-approvals'),
        apiRequest('/api/auth/invitations')
      ]);
      setTeams(teamsRes.teams || []);
      setPendingApprovals(approvalsRes.pendingMembers || []);
      setInvitations(invitesRes.invitations || []);
    } catch {
      // ignore
    }
  };

  const fetchAuditLog = async () => {
    try {
      let url = '/api/admin/audit-log?limit=50&';
      if (auditActionFilter) url += `action=${encodeURIComponent(auditActionFilter)}&`;
      if (auditSearchQuery) url += `search=${encodeURIComponent(auditSearchQuery)}&`;

      const data = await apiRequest(url);
      setAuditLog(data.events || []);
      setAuditTotal(data.total || 0);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load audit trail.');
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchOverview(),
      fetchMembers(),
      fetchTeamsAndApprovals(),
      fetchAuditLog()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [searchQuery, roleFilter, statusFilter, teamFilter]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLog();
    }
  }, [activeTab, auditActionFilter, auditSearchQuery]);

  // Handle Appoint Super Admin
  const handleAppointSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointTargetUserId) {
      toast.warning('Please select a member to appoint as Super Admin.');
      return;
    }
    if (!appointPassword) {
      toast.warning('Primary Owner password is required for security confirmation.');
      return;
    }

    setIsAppointing(true);
    try {
      await apiRequest('/api/admin/super-admins/appoint', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: appointTargetUserId,
          passwordConfirmation: appointPassword,
          reason: appointReason.trim() || undefined
        })
      });
      toast.success('Super Admin successfully appointed and authorized.');
      setIsAppointModalOpen(false);
      setAppointTargetUserId('');
      setAppointPassword('');
      setAppointReason('');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to appoint Super Admin.');
    } finally {
      setIsAppointing(false);
    }
  };

  // Handle Revoke Super Admin
  const handleRevokeSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeTargetUser) return;
    if (!revokePassword) {
      toast.warning('Primary Owner password is required to confirm revocation.');
      return;
    }

    setIsRevoking(true);
    try {
      await apiRequest('/api/admin/super-admins/revoke', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: revokeTargetUser.id,
          passwordConfirmation: revokePassword,
          reason: revokeReason.trim() || 'Administrative revocation by Primary Owner.'
        })
      });
      toast.success(`Super Admin privileges revoked for ${revokeTargetUser.displayName}.`);
      setIsRevokeModalOpen(false);
      setRevokeTargetUser(null);
      setRevokePassword('');
      setRevokeReason('');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke Super Admin.');
    } finally {
      setIsRevoking(false);
    }
  };

  // Handle Suspend Member
  const handleSuspendMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendTargetUser) return;
    if (!suspendReason.trim()) {
      toast.warning('A documented reason is mandatory to suspend an account.');
      return;
    }

    setIsSuspending(true);
    try {
      await apiRequest(`/api/admin/members/${suspendTargetUser.id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ reason: suspendReason.trim() })
      });
      toast.success(`Account for ${suspendTargetUser.displayName} suspended. Access revoked.`);
      setIsSuspendModalOpen(false);
      setSuspendTargetUser(null);
      setSuspendReason('');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to suspend member.');
    } finally {
      setIsSuspending(false);
    }
  };

  // Handle Reinstate Member
  const handleReinstateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reinstateTargetUser) return;
    if (!reinstateReason.trim()) {
      toast.warning('A documented reason is mandatory to reinstate an account.');
      return;
    }

    setIsReinstating(true);
    try {
      await apiRequest(`/api/admin/members/${reinstateTargetUser.id}/reinstate`, {
        method: 'POST',
        body: JSON.stringify({ reason: reinstateReason.trim() })
      });
      toast.success(`Account for ${reinstateTargetUser.displayName} reinstated to active status.`);
      setIsReinstateModalOpen(false);
      setReinstateTargetUser(null);
      setReinstateReason('');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reinstate member.');
    } finally {
      setIsReinstating(false);
    }
  };

  // Handle Change Member Role
  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleTargetUser) return;

    setIsUpdatingRole(true);
    try {
      await apiRequest(`/api/admin/members/${roleTargetUser.id}/role`, {
        method: 'POST',
        body: JSON.stringify({ role: newSelectedRole })
      });
      toast.success(`Role updated to ${newSelectedRole} for ${roleTargetUser.displayName}.`);
      setIsRoleModalOpen(false);
      setRoleTargetUser(null);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update member role.');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Handle Reassign Tasks
  const handleReassignTasks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignFromUser || !reassignToUserId) {
      toast.warning('Please select a recipient member to receive outstanding tasks.');
      return;
    }

    setIsReassigning(true);
    try {
      const res = await apiRequest(`/api/admin/members/${reassignFromUser.id}/reassign-tasks`, {
        method: 'POST',
        body: JSON.stringify({
          toUserId: reassignToUserId,
          reason: reassignReason.trim() || undefined
        })
      });
      toast.success(res.message || 'Tasks reassigned successfully.');
      setIsReassignModalOpen(false);
      setReassignFromUser(null);
      setReassignToUserId('');
      setReassignReason('');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reassign tasks.');
    } finally {
      setIsReassigning(false);
    }
  };

  // Handle Save Team Memberships
  const handleSaveTeams = async () => {
    if (!teamsTargetUser) return;
    setIsSavingTeams(true);

    try {
      const currentTeamIds = teamsTargetUser.teams.map((t) => t.teamId);

      // Add to selected teams
      for (const tId of selectedTeamIds) {
        if (!currentTeamIds.includes(tId)) {
          await apiRequest(`/api/team/${tId}/members`, {
            method: 'POST',
            body: JSON.stringify({ userId: teamsTargetUser.id, role: 'member' })
          });
        }
      }

      // Remove from unselected teams
      for (const tId of currentTeamIds) {
        if (!selectedTeamIds.includes(tId)) {
          await apiRequest(`/api/team/${tId}/members/${teamsTargetUser.id}`, {
            method: 'DELETE'
          });
        }
      }

      toast.success(`Team assignments updated for ${teamsTargetUser.displayName}.`);
      setIsManageTeamsModalOpen(false);
      setTeamsTargetUser(null);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update team assignments.');
    } finally {
      setIsSavingTeams(false);
    }
  };

  // Handle Create Invitation
  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInviteEmail) {
      toast.warning('Please enter a recipient email.');
      return;
    }

    setIsCreatingInvite(true);
    setGeneratedInviteLink(null);

    try {
      const res = await apiRequest('/api/auth/invitations', {
        method: 'POST',
        body: JSON.stringify({
          email: newInviteEmail.trim(),
          role: newInviteRole,
          teamId: newInviteTeamId || undefined
        })
      });

      const fullUrl = `${window.location.origin}${res.invitation.inviteUrl}`;
      setGeneratedInviteLink(fullUrl);
      toast.success(`Invitation created for ${newInviteEmail}. Link ready.`);
      setNewInviteEmail('');
      await fetchTeamsAndApprovals();
      await fetchAuditLog();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create invitation.');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  // Handle Revoke Invitation
  const handleRevokeInvitation = async (invId: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke the invitation for ${email}?`)) return;

    try {
      await apiRequest(`/api/auth/invitations/${invId}`, { method: 'DELETE' });
      toast.success(`Invitation for ${email} revoked.`);
      await fetchTeamsAndApprovals();
      await fetchAuditLog();
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke invitation.');
    }
  };

  // Handle Approve Registration
  const handleApproveMembership = async (userId: string, displayName: string) => {
    try {
      await apiRequest(`/api/admin/pending-approvals/${userId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ role: 'team_member' })
      });
      toast.success(`Membership approved for ${displayName}.`);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve membership.');
    }
  };

  // Handle Reject Registration
  const handleRejectMembership = async (userId: string, displayName: string) => {
    const reason = prompt(`Enter reason for rejecting membership for ${displayName}:`);
    if (reason === null) return;

    try {
      await apiRequest(`/api/admin/pending-approvals/${userId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() || 'Registration declined by administrator.' })
      });
      toast.success(`Registration rejected for ${displayName}.`);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject membership.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Invitation link copied to clipboard!');
  };

  return (
    <div className="page-wrapper">
      {/* Top Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div className="page-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={24} color="var(--accent-orange)" />
            <h1>Cindermarch Studio // Central Website Administration</h1>
          </div>
          <p style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
            Apex studio governance, strict three-super-admin access control, member administration, and audit oversight.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadAll}
            disabled={loading}
            title="Refresh administrative data"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Primary Owner & Three Super Admin Allocation Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 94, 30, 0.08) 0%, rgba(16, 19, 27, 0.95) 100%)',
          border: '1px solid rgba(255, 94, 30, 0.35)',
          padding: '20px',
          marginBottom: '24px',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 94, 30, 0.15)',
                border: '2px solid var(--accent-orange)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-orange)'
              }}
            >
              <Key size={26} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-orange)', textTransform: 'uppercase' }}>
                  Irrevocable Apex Authority
                </span>
                <span className="badge badge-verified-complete" style={{ fontSize: '10px', padding: '2px 8px' }}>
                  PRIMARY OWNER
                </span>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-white)', marginTop: '2px' }}>
                {overview?.primaryOwner?.displayName || 'KNG_MG'}
                <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '8px' }}>
                  ({overview?.primaryOwner?.email || 'marwanhossam20062007@gmail.com'})
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Sole authority to appoint or revoke Super Admins • Workspace security & integrations master • Protected from demotion or suspension.
              </div>
            </div>
          </div>

          {/* Super Admin Capacity Counter */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              backgroundColor: 'var(--bg-elevated)',
              padding: '12px 20px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Super Admin Allocation
              </div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-white)' }}>
                {1 + (overview?.superAdmins?.length || 0)} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>/ 3 Accounts Max</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                1 Primary Owner + {overview?.superAdmins?.length || 0}/2 Super Admins
              </div>
            </div>

            {isPrimaryOwner && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsAppointModalOpen(true)}
                disabled={(overview?.superAdminSlots?.availableSlots || 0) <= 0}
                style={{ whiteSpace: 'nowrap' }}
              >
                <UserPlus size={15} />
                <span>Appoint Super Admin</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '12px',
          overflowX: 'auto'
        }}
      >
        <button
          type="button"
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('overview')}
        >
          <Shield size={16} />
          <span>Super Admin Governance</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'members' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('members')}
        >
          <Users size={16} />
          <span>Members & Roles ({members.length})</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'approvals' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('approvals')}
        >
          <Mail size={16} />
          <span>Invitations & Approvals ({pendingApprovals.length})</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'projects_teams' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('projects_teams')}
        >
          <FolderKanban size={16} />
          <span>Projects & Teams ({teams.length})</span>
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('audit')}
        >
          <History size={16} />
          <span>Admin Audit Log ({auditTotal})</span>
        </button>
      </div>

      {/* TAB 1: SUPER ADMIN GOVERNANCE */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Strict 3-Admin Rule Summary */}
          <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--accent-orange)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <AlertTriangle size={20} color="var(--accent-orange)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                  Enforced Three-Account Administrative Ceiling
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.6 }}>
                  By studio architectural specification, exactly three accounts may hold Super Admin-level access across Cindermarch Hub:
                  <strong> Primary Owner (KNG_MG)</strong> and <strong>up to two appointed Super Admins</strong>.
                  This limit is enforced transactionally in SQLite with database triggers (<code>trg_enforce_super_admin_limit_insert</code> and <code>update</code>).
                  A fourth elevation attempt is automatically rejected at the database level.
                </div>
              </div>
            </div>
          </div>

          {/* Super Admin Slots Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Slot 0: Primary Owner */}
            <div
              className="card"
              style={{
                border: '1px solid rgba(255, 94, 30, 0.4)',
                backgroundColor: 'rgba(255, 94, 30, 0.03)'
              }}
            >
              <div className="card-header">
                <div className="card-title">
                  <Key size={17} color="var(--accent-orange)" />
                  <span>Apex Authority — Primary Owner</span>
                </div>
                <span className="badge badge-verified-complete">SLOT 1 OF 3</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg-surface-raised)',
                    border: '1px solid var(--accent-orange)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '18px',
                    color: 'var(--accent-orange)'
                  }}
                >
                  {overview?.primaryOwner?.displayName?.slice(0, 1) || 'K'}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-white)' }}>
                    {overview?.primaryOwner?.displayName}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    @{overview?.primaryOwner?.username} • {overview?.primaryOwner?.email}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                ✓ Appoints & revokes the 2 Super Admins<br />
                ✓ Manages studio security & policies<br />
                ✓ Protected: Account cannot be demoted or suspended
              </div>
            </div>

            {/* Slot 1: Super Admin Account 1 */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Shield size={17} color="var(--status-progress)" />
                  <span>Super Admin Slot 1</span>
                </div>
                <span className={overview?.superAdmins?.[0] ? 'badge badge-in-progress' : 'badge badge-backlog'}>
                  {overview?.superAdmins?.[0] ? 'APPOINTED' : 'VACANT'}
                </span>
              </div>

              {overview?.superAdmins?.[0] ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-surface-raised)',
                        border: '1px solid var(--status-progress)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '18px',
                        color: 'var(--status-progress)'
                      }}
                    >
                      {overview.superAdmins[0].displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-white)' }}>
                        {overview.superAdmins[0].displayName}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        @{overview.superAdmins[0].username} • {overview.superAdmins[0].email}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Appointed: {new Date(overview.superAdmins[0].appointedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginBottom: '14px' }}>
                    ✓ Broad operational management & reviews<br />
                    ✓ Task assignments, deadlines & suspensions<br />
                    ✓ Cannot grant self Primary Owner status
                  </div>

                  {isPrimaryOwner && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#EF4444' }}
                      onClick={() => {
                        setRevokeTargetUser(overview.superAdmins[0]);
                        setIsRevokeModalOpen(true);
                      }}
                    >
                      <UserX size={15} />
                      <span>Revoke Super Admin Access</span>
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 10px' }}>
                  <div style={{ color: 'var(--text-faint)', marginBottom: '12px' }}>
                    <Shield size={36} style={{ opacity: 0.4 }} />
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                    This Super Admin slot is currently vacant.
                  </div>
                  {isPrimaryOwner && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsAppointModalOpen(true)}
                    >
                      <UserPlus size={15} />
                      <span>Appoint to Slot 1</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Slot 2: Super Admin Account 2 */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">
                  <Shield size={17} color="var(--status-progress)" />
                  <span>Super Admin Slot 2</span>
                </div>
                <span className={overview?.superAdmins?.[1] ? 'badge badge-in-progress' : 'badge badge-backlog'}>
                  {overview?.superAdmins?.[1] ? 'APPOINTED' : 'VACANT'}
                </span>
              </div>

              {overview?.superAdmins?.[1] ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--bg-surface-raised)',
                        border: '1px solid var(--status-progress)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '18px',
                        color: 'var(--status-progress)'
                      }}
                    >
                      {overview.superAdmins[1].displayName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-white)' }}>
                        {overview.superAdmins[1].displayName}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        @{overview.superAdmins[1].username} • {overview.superAdmins[1].email}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Appointed: {new Date(overview.superAdmins[1].appointedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginBottom: '14px' }}>
                    ✓ Broad operational management & reviews<br />
                    ✓ Task assignments, deadlines & suspensions<br />
                    ✓ Cannot grant self Primary Owner status
                  </div>

                  {isPrimaryOwner && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.4)', color: '#EF4444' }}
                      onClick={() => {
                        setRevokeTargetUser(overview.superAdmins[1]);
                        setIsRevokeModalOpen(true);
                      }}
                    >
                      <UserX size={15} />
                      <span>Revoke Super Admin Access</span>
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 10px' }}>
                  <div style={{ color: 'var(--text-faint)', marginBottom: '12px' }}>
                    <Shield size={36} style={{ opacity: 0.4 }} />
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                    This Super Admin slot is currently vacant.
                  </div>
                  {isPrimaryOwner && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsAppointModalOpen(true)}
                    >
                      <UserPlus size={15} />
                      <span>Appoint to Slot 2</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Access-Control Hierarchy Matrix */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Layers size={17} color="var(--accent-orange)" />
                <span>Four-Tier Access Control Structure</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 14px' }}>Level</th>
                    <th style={{ padding: '10px 14px' }}>Role</th>
                    <th style={{ padding: '10px 14px' }}>Holding Accounts</th>
                    <th style={{ padding: '10px 14px' }}>Permitted Scope & Capabilities</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255, 94, 30, 0.04)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--accent-orange)' }}>1</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Primary Owner</td>
                    <td style={{ padding: '12px 14px' }}>Exactly 1 (KNG_MG)</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                      Full studio authority: appoints/revokes Super Admins, security settings, integrations, project governance, irrevocable status.
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--status-progress)' }}>2</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Super Admin</td>
                    <td style={{ padding: '12px 14px' }}>Up to 2 designated accounts</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                      Broad operational authority: project/team management, tasks & deadlines, reviews, invitations, member suspension & reinstatement.
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--status-review)' }}>3</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Team Manager</td>
                    <td style={{ padding: '12px 14px' }}>Assigned per team</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                      Authorized team-level management: task triage, team member assignments, sprint/milestone execution within assigned team only.
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-muted)' }}>4</td>
                    <td style={{ padding: '12px 14px', fontWeight: 600 }}>Team Member</td>
                    <td style={{ padding: '12px 14px' }}>Standard studio members</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                      Standard project and task access, UVCS changesets, peer reviews. Cannot elevate roles or access unauthorized data.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MEMBERS & ROLES DIRECTORY */}
      {activeTab === 'members' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Search & Filters */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search by name, email, username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-white)', width: '100%', fontSize: '13px' }}
                />
              </div>

              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="form-input"
                style={{ fontSize: '13px' }}
              >
                <option value="">All Roles</option>
                <option value="owner">Primary Owner</option>
                <option value="super_admin">Super Admin</option>
                <option value="team_manager">Team Manager</option>
                <option value="team_member">Team Member</option>
                <option value="developer">Developer</option>
                <option value="reviewer">Reviewer</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="form-input"
                style={{ fontSize: '13px' }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>

              {/* Team Filter */}
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="form-input"
                style={{ fontSize: '13px' }}
              >
                <option value="">All Teams</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Members Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Users size={17} color="var(--accent-orange)" />
                <span>Registered Studio Members ({members.length})</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 14px' }}>Member</th>
                    <th style={{ padding: '10px 14px' }}>Role</th>
                    <th style={{ padding: '10px 14px' }}>Teams</th>
                    <th style={{ padding: '10px 14px' }}>Workload</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Administrative Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const isTargetOwner = m.role === 'owner' || m.id === overview?.primaryOwner?.id;
                    const isTargetSuperAdmin = m.role === 'super_admin';

                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {/* Member Identity */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                backgroundColor: isTargetOwner ? 'rgba(255, 94, 30, 0.15)' : 'var(--bg-elevated)',
                                border: isTargetOwner ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '14px',
                                color: isTargetOwner ? 'var(--accent-orange)' : 'var(--text-white)'
                              }}
                            >
                              {m.displayName ? m.displayName.slice(0, 1).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                                {m.displayName}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                @{m.username} • {m.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role Badge */}
                        <td style={{ padding: '12px 14px' }}>
                          {isTargetOwner ? (
                            <span className="badge badge-verified-complete" style={{ fontSize: '10px' }}>
                              PRIMARY OWNER
                            </span>
                          ) : isTargetSuperAdmin ? (
                            <span className="badge badge-in-progress" style={{ fontSize: '10px' }}>
                              SUPER ADMIN
                            </span>
                          ) : m.role === 'team_manager' ? (
                            <span className="badge badge-review" style={{ fontSize: '10px' }}>
                              TEAM MANAGER
                            </span>
                          ) : (
                            <span className="badge badge-backlog" style={{ fontSize: '10px' }}>
                              {m.role?.toUpperCase() || 'MEMBER'}
                            </span>
                          )}
                        </td>

                        {/* Assigned Teams */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {m.teams && m.teams.length > 0 ? (
                              m.teams.map((t) => (
                                <span
                                  key={t.teamId}
                                  style={{
                                    fontSize: '10px',
                                    padding: '2px 6px',
                                    backgroundColor: 'var(--bg-elevated)',
                                    borderRadius: 'var(--radius-xs)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-subtle)'
                                  }}
                                >
                                  {t.teamName}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>None</span>
                            )}
                          </div>
                        </td>

                        {/* Workload & Strikes */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: '12px' }}>
                            <span style={{ color: 'var(--status-progress)' }}>{m.activeTasksCount} active</span>
                            <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>/</span>
                            <span style={{ color: 'var(--status-complete)' }}>{m.completedTasksCount} done</span>
                          </div>
                          {m.activeStrikesCount > 0 && (
                            <div style={{ fontSize: '11px', color: '#EF4444', marginTop: '2px' }}>
                              ⚠️ {m.activeStrikesCount} strike{m.activeStrikesCount > 1 ? 's' : ''}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 14px' }}>
                          {m.isSuspended ? (
                            <span className="badge badge-blocked" style={{ fontSize: '10px' }}>
                              SUSPENDED
                            </span>
                          ) : (
                            <span className="badge badge-verified-complete" style={{ fontSize: '10px' }}>
                              ACTIVE
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          {isTargetOwner ? (
                            <span style={{ fontSize: '11px', color: 'var(--accent-orange)' }}>
                              Protected Apex Account
                            </span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              {/* Manage Teams */}
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '4px 8px', fontSize: '11px' }}
                                onClick={() => {
                                  setTeamsTargetUser(m);
                                  setSelectedTeamIds(m.teams.map((t) => t.teamId));
                                  setIsManageTeamsModalOpen(true);
                                }}
                                title="Assign or remove from teams"
                              >
                                Teams
                              </button>

                              {/* Change Role (Non-super-admin) */}
                              {!isTargetSuperAdmin && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                  onClick={() => {
                                    setRoleTargetUser(m);
                                    setNewSelectedRole(m.role || 'team_member');
                                    setIsRoleModalOpen(true);
                                  }}
                                  title="Change workspace role"
                                >
                                  Role
                                </button>
                              )}

                              {/* Reassign Work */}
                              {m.activeTasksCount > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '11px' }}
                                  onClick={() => {
                                    setReassignFromUser(m);
                                    setReassignToUserId('');
                                    setIsReassignModalOpen(true);
                                  }}
                                  title="Reassign active tasks to another member"
                                >
                                  <ArrowRightLeft size={12} />
                                </button>
                              )}

                              {/* Suspend or Reinstate */}
                              {m.isSuspended ? (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--status-complete)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                                  onClick={() => {
                                    setReinstateTargetUser(m);
                                    setReinstateReason('');
                                    setIsReinstateModalOpen(true);
                                  }}
                                  title="Reinstate suspended member"
                                >
                                  <UserCheck size={12} />
                                  <span>Reinstate</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '11px', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                                  onClick={() => {
                                    setSuspendTargetUser(m);
                                    setSuspendReason('');
                                    setIsSuspendModalOpen(true);
                                  }}
                                  title="Suspend member access"
                                >
                                  <UserX size={12} />
                                  <span>Suspend</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INVITATIONS & PENDING APPROVALS */}
      {activeTab === 'approvals' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Privacy Notice */}
          <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--accent-orange)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <Lock size={20} color="var(--accent-orange)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                  Private Workspace Enforcement
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.6 }}>
                  Cindermarch Engine Hub is private. Registration alone never grants workspace access.
                  Every new developer must possess a valid, non-expired invitation token or be explicitly approved by an authorized administrator below.
                </div>
              </div>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Clock size={17} color="var(--status-review)" />
                <span>Pending Workspace Approvals ({pendingApprovals.length})</span>
              </div>
            </div>

            {pendingApprovals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 10px', color: 'var(--text-muted)' }}>
                No pending registration requests. All members are verified.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 14px' }}>Applicant</th>
                      <th style={{ padding: '10px 14px' }}>Registered At</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right' }}>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingApprovals.map((req) => (
                      <tr key={req.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>{req.display_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{req.username} • {req.email}</div>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                          {new Date(req.joined_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              type="button"
                              className="btn btn-primary"
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                              onClick={() => handleApproveMembership(req.id, req.display_name)}
                            >
                              Approve Access
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '4px 10px', fontSize: '12px', color: '#EF4444' }}
                              onClick={() => handleRejectMembership(req.id, req.display_name)}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Create Secure Invitation */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <UserPlus size={17} color="var(--accent-orange)" />
                <span>Issue Secure Workspace Invitation</span>
              </div>
            </div>

            <form onSubmit={handleCreateInvitation}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className="form-label">Recipient Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="developer@cindermarch.studio"
                    value={newInviteEmail}
                    onChange={(e) => setNewInviteEmail(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">Permitted Role *</label>
                  <select
                    value={newInviteRole}
                    onChange={(e) => setNewInviteRole(e.target.value as UserRole)}
                    className="form-input"
                  >
                    <option value="team_member">Team Member</option>
                    <option value="developer">Developer</option>
                    <option value="team_manager">Team Manager</option>
                    <option value="reviewer">Reviewer</option>
                    {isPrimaryOwner && (overview?.superAdminSlots?.availableSlots || 0) > 0 && (
                      <option value="super_admin">Super Admin (Primary Owner Only)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="form-label">Assign to Team (Optional)</label>
                  <select
                    value={newInviteTeamId}
                    onChange={(e) => setNewInviteTeamId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">No initial team assignment</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={isCreatingInvite}>
                {isCreatingInvite ? 'Issuing Invitation...' : 'Generate Secure Invitation Link'}
              </button>
            </form>

            {generatedInviteLink && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--status-complete)', marginBottom: '6px' }}>
                  ✓ Invitation token generated (valid for 14 days)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteLink}
                    className="form-input"
                    style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => copyToClipboard(generatedInviteLink)}
                    title="Copy invitation URL"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Active Invitations List */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Mail size={17} color="var(--accent-orange)" />
                <span>Existing Workspace Invitations ({invitations.length})</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 14px' }}>Recipient</th>
                    <th style={{ padding: '10px 14px' }}>Role</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Invited By</th>
                    <th style={{ padding: '10px 14px' }}>Expires</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {inv.email}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className="badge badge-backlog" style={{ fontSize: '10px' }}>
                          {inv.role?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          className={`badge ${
                            inv.status === 'accepted'
                              ? 'badge-verified-complete'
                              : inv.status === 'pending'
                              ? 'badge-in-progress'
                              : 'badge-blocked'
                          }`}
                          style={{ fontSize: '10px' }}
                        >
                          {inv.status?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                        {inv.invited_by_name || 'Admin'}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: '11px' }}>
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        {inv.status === 'pending' && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => {
                                const url = `${window.location.origin}/signup?invite=${inv.invitation_token}`;
                                copyToClipboard(url);
                              }}
                              title="Copy invite URL"
                            >
                              <Copy size={12} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px', color: '#EF4444' }}
                              onClick={() => handleRevokeInvitation(inv.id, inv.email)}
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
        </div>
      )}

      {/* TAB 4: PROJECTS & TEAMS GOVERNANCE */}
      {activeTab === 'projects_teams' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Studio Projects Overview */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <FolderKanban size={17} color="var(--accent-orange)" />
                <span>Studio Projects Governance</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-white)' }}>Terminal 6</div>
                  <span className="badge badge-verified-complete">PRIMARY PRODUCTION</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Industrial Sci-Fi FPS game with custom movement mechanics, spatial physics, and weapon balance.
                </div>
                <div style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                    onClick={() => onNavigate && onNavigate('projects')}
                  >
                    Manage Terminal 6 Sprints & Milestones
                  </button>
                </div>
              </div>

              <div style={{ padding: '16px', backgroundColor: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-white)' }}>Eclipsed</div>
                  <span className="badge badge-in-progress">ACTIVE DEVELOPMENT</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  Atmospheric 2D dark fantasy metroidvania featuring interconnected subterranean biomes and tight combat.
                </div>
                <div style={{ marginTop: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '11px', padding: '4px 10px' }}
                    onClick={() => onNavigate && onNavigate('projects')}
                  >
                    Manage Eclipsed Sprints & Milestones
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* The Six Core Studio Teams */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Users size={17} color="var(--accent-orange)" />
                <span>The Six Studio Teams Governance</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {teams.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--bg-elevated)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-white)' }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Slug: <code>{t.slug}</code> • Project: {t.projectId || 'Universal'}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: 1.4 }}>
                    {t.description || 'Core engineering and production division.'}
                  </div>

                  <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Manager: <strong style={{ color: 'var(--text-white)' }}>{t.managerName || 'Unassigned'}</strong>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                      onClick={() => onNavigate && onNavigate('team')}
                    >
                      Team View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Studio Policy Quick Nav */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Settings size={17} color="var(--accent-orange)" />
                <span>Verification Gates & Integration Policies</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onNavigate && onNavigate('settings')}
              >
                <ShieldCheck size={14} />
                <span>Configure Verification Completion Gates</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onNavigate && onNavigate('strikes')}
              >
                <AlertTriangle size={14} />
                <span>Deadline Strike & Suspension Policy</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onNavigate && onNavigate('integrations')}
              >
                <Bot size={14} />
                <span>Discord Webhook & Bot Integration</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ADMIN AUDIT LOG */}
      {activeTab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Filter & Search */}
          <div className="card" style={{ padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <Search size={16} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Search audit trail by actor, target, reason..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-white)', width: '100%', fontSize: '13px' }}
                />
              </div>

              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="form-input"
                style={{ fontSize: '13px' }}
              >
                <option value="">All Administrative Actions</option>
                <option value="super_admin_appointed">Super Admin Appointed</option>
                <option value="super_admin_revoked">Super Admin Revoked</option>
                <option value="member_suspended">Member Suspended</option>
                <option value="member_reinstated">Member Reinstated</option>
                <option value="member_role_changed">Member Role Changed</option>
                <option value="tasks_reassigned">Tasks Reassigned</option>
                <option value="invitation_created">Invitation Created</option>
                <option value="invitation_revoked">Invitation Revoked</option>
                <option value="membership_approved">Membership Approved</option>
                <option value="membership_rejected">Membership Rejected</option>
              </select>
            </div>
          </div>

          {/* Audit Trail Table */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <History size={17} color="var(--accent-orange)" />
                <span>Immutable Administrative Audit Records ({auditLog.length})</span>
              </div>
              <span className="badge badge-verified-complete" style={{ fontSize: '10px' }}>
                APPEND ONLY • SECURED
              </span>
            </div>

            {auditLog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 10px', color: 'var(--text-muted)' }}>
                No audit events found matching filters.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 14px' }}>Timestamp</th>
                      <th style={{ padding: '10px 14px' }}>Actor</th>
                      <th style={{ padding: '10px 14px' }}>Action</th>
                      <th style={{ padding: '10px 14px' }}>Target</th>
                      <th style={{ padding: '10px 14px' }}>Details / Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((ev) => {
                      let detailsParsed: any = null;
                      try {
                        if (ev.details_json) detailsParsed = JSON.parse(ev.details_json);
                      } catch {}

                      const isCritical = ev.action.includes('super_admin') || ev.action.includes('suspend');

                      return (
                        <tr key={ev.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {new Date(ev.created_at).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-white)' }}>
                            {ev.actor_name}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              className={`badge ${
                                isCritical
                                  ? 'badge-blocked'
                                  : ev.action.includes('reinstate') || ev.action.includes('approve')
                                  ? 'badge-verified-complete'
                                  : 'badge-in-progress'
                              }`}
                              style={{ fontSize: '10px' }}
                            >
                              {ev.action.toUpperCase().replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-white)', fontWeight: 500 }}>
                            {ev.target_name || ev.target_id || 'System'}
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {ev.reason && (
                              <div style={{ fontStyle: 'italic', color: 'var(--text-white)', marginBottom: '2px' }}>
                                "{ev.reason}"
                              </div>
                            )}
                            {detailsParsed && (
                              <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                                {JSON.stringify(detailsParsed)}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODALS
         ======================================================== */}

      {/* MODAL: Appoint Super Admin (Primary Owner Only) */}
      {isAppointModalOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="var(--accent-orange)" />
                <h3 className="modal-title">Appoint Super Admin</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsAppointModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAppointSuperAdmin}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  You are appointing a designated Super Admin. They will hold broad operational authority across Cindermarch Hub.
                  Strict limit: exactly 2 Super Admins alongside your Primary Owner account.
                </div>

                <div>
                  <label className="form-label">Select Workspace Member *</label>
                  <select
                    required
                    value={appointTargetUserId}
                    onChange={(e) => setAppointTargetUserId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select an active member...</option>
                    {members
                      .filter((m) => m.role !== 'owner' && m.role !== 'super_admin' && !m.isSuspended)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.displayName} (@{m.username} • {m.email})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Appointment Reason / Notes (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Lead studio operations & QA oversight"
                    value={appointReason}
                    onChange={(e) => setAppointReason(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                  <label className="form-label" style={{ color: 'var(--accent-orange)' }}>
                    Primary Owner Password Reauthentication *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter your Primary Owner password"
                    value={appointPassword}
                    onChange={(e) => setAppointPassword(e.target.value)}
                    className="form-input"
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Reauthentication is mandatory to guard sensitive executive promotions against session hijacking.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAppointModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isAppointing}
                >
                  {isAppointing ? 'Promoting...' : 'Confirm Super Admin Promotion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Revoke Super Admin (Primary Owner Only) */}
      {isRevokeModalOpen && revokeTargetUser && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserX size={20} color="#EF4444" />
                <h3 className="modal-title">Revoke Super Admin Privileges</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsRevokeModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRevokeSuperAdmin}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  You are revoking Super Admin status from <strong>{revokeTargetUser.displayName}</strong>.
                  Their account will revert to a standard Team Member.
                </div>

                <div>
                  <label className="form-label">Documented Reason *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Operational rotation or role change"
                    value={revokeReason}
                    onChange={(e) => setRevokeReason(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
                  <label className="form-label" style={{ color: '#EF4444' }}>
                    Primary Owner Password Reauthentication *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter your Primary Owner password"
                    value={revokePassword}
                    onChange={(e) => setRevokePassword(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRevokeModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{ backgroundColor: '#EF4444', color: 'white', borderColor: '#EF4444' }}
                  disabled={isRevoking}
                >
                  {isRevoking ? 'Revoking...' : 'Confirm Revocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Suspend Member */}
      {isSuspendModalOpen && suspendTargetUser && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserX size={20} color="#EF4444" />
                <h3 className="modal-title">Suspend Member Account</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsSuspendModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSuspendMember}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Suspending <strong>{suspendTargetUser.displayName}</strong> will immediately terminate all active sessions,
                  block API endpoints, and display the suspension notice upon next login. Work history and tasks are preserved.
                </div>

                <div>
                  <label className="form-label">Mandatory Suspension Reason *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Document the exact operational or policy reason for this suspension..."
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsSuspendModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{ backgroundColor: '#EF4444', color: 'white', borderColor: '#EF4444' }}
                  disabled={isSuspending}
                >
                  {isSuspending ? 'Suspending...' : 'Suspend Member Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reinstate Member */}
      {isReinstateModalOpen && reinstateTargetUser && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserCheck size={20} color="var(--status-complete)" />
                <h3 className="modal-title">Reinstate Member Account</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsReinstateModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReinstateMember}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Reinstating <strong>{reinstateTargetUser.displayName}</strong> will restore their access to active status,
                  allowing them to log in and interact with tasks and projects according to their permitted roles.
                </div>

                <div>
                  <label className="form-label">Mandatory Reinstatement Reason *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Document the reason for reinstatement (e.g. appeal granted, policy review resolved)..."
                    value={reinstateReason}
                    onChange={(e) => setReinstateReason(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsReinstateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isReinstating}
                >
                  {isReinstating ? 'Reinstating...' : 'Reinstate Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Change Member Role */}
      {isRoleModalOpen && roleTargetUser && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Change Member Role</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsRoleModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangeRole}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(235, 87, 87, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      color: 'var(--accent-orange)'
                    }}
                  >
                    {roleTargetUser.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-white)' }}>
                      {roleTargetUser.displayName}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      @{roleTargetUser.username}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right', marginBottom: '2px' }}>
                      Current Role
                    </div>
                    <span className="badge badge-backlog" style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
                      {roleTargetUser.role?.replace(/_/g, ' ') || 'DEVELOPER'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                    Select Permitted Role *
                  </label>
                  <select
                    value={newSelectedRole}
                    onChange={(e) => setNewSelectedRole(e.target.value as UserRole)}
                    className="form-input"
                    style={{ fontSize: '13px' }}
                  >
                    <option value="team_manager">Team Manager — Authorized Team-Level Lead</option>
                    <option value="developer">Developer — Standard Engineering & Execution (Default)</option>
                    <option value="team_member">Team Member — Studio General Contributor</option>
                    <option value="reviewer">Reviewer — Peer Review & Quality Assurance</option>
                  </select>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: 1.4 }}>
                    ℹ️ <strong>Governance Note:</strong> Irrevocable Apex Authority and Super Admin appointments cannot be granted through ordinary role management. Super Admins are appointed strictly through the Primary Owner Governance portal.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRoleModalOpen(false)}
                  disabled={isUpdatingRole}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isUpdatingRole}
                >
                  {isUpdatingRole ? 'Updating...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reassign Tasks */}
      {isReassignModalOpen && reassignFromUser && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowRightLeft size={20} color="var(--accent-orange)" />
                <h3 className="modal-title">Reassign Member's Outstanding Work</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsReassignModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReassignTasks}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Transferring <strong>{reassignFromUser.activeTasksCount} active tasks</strong> currently owned by{' '}
                  <strong>{reassignFromUser.displayName}</strong> to another studio member.
                </div>

                <div>
                  <label className="form-label">Assign To *</label>
                  <select
                    required
                    value={reassignToUserId}
                    onChange={(e) => setReassignToUserId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select recipient member...</option>
                    {members
                      .filter((m) => m.id !== reassignFromUser.id && !m.isSuspended)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.displayName} (@{m.username})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Transfer Reason</label>
                  <input
                    type="text"
                    placeholder="e.g. Workload balancing, leave of absence"
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsReassignModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isReassigning}
                >
                  {isReassigning ? 'Reassigning...' : 'Transfer Outstanding Tasks'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Manage Teams */}
      {isManageTeamsModalOpen && teamsTargetUser && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Manage Team Assignments</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsManageTeamsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Select team memberships for <strong>{teamsTargetUser.displayName}</strong> across all six studio teams:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {teams.map((t) => {
                  const isChecked = selectedTeamIds.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 14px',
                        backgroundColor: isChecked ? 'rgba(255, 94, 30, 0.08)' : 'var(--bg-elevated)',
                        border: isChecked ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedTeamIds(selectedTeamIds.filter((id) => id !== t.id));
                          } else {
                            setSelectedTeamIds([...selectedTeamIds, t.id]);
                          }
                        }}
                      />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)' }}>
                          {t.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {t.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsManageTeamsModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveTeams}
                disabled={isSavingTeams}
              >
                {isSavingTeams ? 'Saving...' : 'Update Team Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
