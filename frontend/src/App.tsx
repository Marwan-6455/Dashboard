import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar.js';
import { Header } from './components/Header.js';
import { TaskModal } from './components/TaskModal.js';
import { PhoenixCompanion } from './components/PhoenixCompanion.js';
import { ProfileModal } from './components/ProfileModal.js';
import { OverviewPage } from './pages/OverviewPage.js';
import { TasksPage } from './pages/TasksPage.js';
import { TaskDetailPage } from './pages/TaskDetailPage.js';
import { TeamPage } from './pages/TeamPage.js';
import { ActivityPage } from './pages/ActivityPage.js';
import { ReviewsPage } from './pages/ReviewsPage.js';
import { TestReportsPage } from './pages/TestReportsPage.js';
import { EvidencePage } from './pages/EvidencePage.js';
import { IntegrationsPage } from './pages/IntegrationsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { StrikesPage } from './pages/StrikesPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { WorkspaceEntryModal } from './components/WorkspaceEntryModal.js';
import { WorkspaceSuspendedScreen } from './components/WorkspaceSuspendedScreen.js';
import { useAuth } from './context/AuthContext.js';
import { Task, WorkspaceEntryWarning } from './types/index.js';
import { apiRequest } from './api/client.js';

export const App: React.FC = () => {
  const { user, isLoading, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState<string>('overview');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  // Strike & Suspension state
  const [entryWarning, setEntryWarning] = useState<WorkspaceEntryWarning | null>(null);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState<boolean>(false);
  const [isSuspended, setIsSuspended] = useState<boolean>(false);
  const [suspendedData, setSuspendedData] = useState<any>(null);

  // Filter params passed when navigating from Overview or Team cards
  const [taskFilterStatus, setTaskFilterStatus] = useState<string>('');
  const [taskFilterTeam, setTaskFilterTeam] = useState<string>('');
  const [taskFilterOwner, setTaskFilterOwner] = useState<string>('');
  const [tasksList, setTasksList] = useState<any[]>([]);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);

  const fetchGlobalData = async () => {
    if (!user) return;
    try {
      const [tasksRes, teamRes] = await Promise.all([
        apiRequest('/api/tasks'),
        apiRequest('/api/team')
      ]);
      setTasksList(tasksRes.tasks || []);
      setTeamUsers(teamRes.users || []);
    } catch {
      // ignore
    }
  };

  const checkWorkspaceEntry = async () => {
    if (!user) return;
    try {
      // 1. Obtain or generate genuine session ID for this browser tab session
      let sessionId = sessionStorage.getItem('cindermarch_workspace_session_id');
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        sessionStorage.setItem('cindermarch_workspace_session_id', sessionId);
      }

      // 2. Refresh latest authoritative strike count and warning from backend
      const data: WorkspaceEntryWarning = await apiRequest('/api/strikes/workspace-entry', {
        method: 'POST',
        body: JSON.stringify({ sessionId })
      });

      setEntryWarning(data);

      if (data.isSuspended) {
        setIsSuspended(true);
        setSuspendedData(data);
        return;
      }

      // If user has active strikes, check if dismissed in current session
      if (data.showWarning && data.activeStrikes > 0) {
        const dismissedSession = sessionStorage.getItem('cindermarch_strike_warning_dismissed');
        if (dismissedSession !== sessionId) {
          setIsWarningModalOpen(true);
        }
      }
    } catch (err: any) {
      if (err.status === 403 && err.isSuspended) {
        setIsSuspended(true);
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchGlobalData();
      checkWorkspaceEntry();
    }
  }, [user]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--bg-black)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-mono)'
        }}
      >
        Initializing Cindermarch Engine Hub...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (isSuspended) {
    return (
      <WorkspaceSuspendedScreen
        strikes={suspendedData?.strikes || []}
        suspensionReason={suspendedData?.suspensionReason}
        suspendedAt={suspendedData?.suspendedAt}
        onRefresh={() => {
          checkWorkspaceEntry();
          fetchGlobalData();
        }}
        onLogout={logout}
      />
    );
  }

  const handleDismissWarning = () => {
    setIsWarningModalOpen(false);
    const sessionId = sessionStorage.getItem('cindermarch_workspace_session_id');
    if (sessionId) {
      sessionStorage.setItem('cindermarch_strike_warning_dismissed', sessionId);
    }
  };

  const handleNavigate = (page: string, params?: any) => {
    if (page === 'tasks' && params?.taskId) {
      setSelectedTaskId(params.taskId);
      setCurrentPage('task-detail');
      return;
    }
    if (page === 'tasks') {
      setTaskFilterStatus(params?.filterStatus || '');
      setTaskFilterTeam(params?.filterTeam || '');
      setTaskFilterOwner(params?.filterOwner || '');
    } else {
      setTaskFilterStatus('');
      setTaskFilterTeam('');
      setTaskFilterOwner('');
    }

    setSelectedTaskId(null);
    setCurrentPage(page);
  };

  const handleOpenTaskDetail = (taskId: string) => {
    setSelectedTaskId(taskId);
    setCurrentPage('task-detail');
  };

  const handleEditTask = (task: Task) => {
    setTaskToEdit(task);
    setIsTaskModalOpen(true);
  };

  const handleCreateNewTask = () => {
    setTaskToEdit(null);
    setIsTaskModalOpen(true);
  };

  return (
    <div className="app-container">
      <Sidebar
        currentPage={currentPage === 'task-detail' ? 'tasks' : currentPage}
        onNavigate={handleNavigate}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
      />

      <div className="main-content">
        <Header
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          onOpenNewTaskModal={handleCreateNewTask}
          onOpenProfileModal={() => setIsProfileModalOpen(true)}
          onNavigate={handleNavigate}
        />

        {currentPage === 'overview' && (
          <OverviewPage
            onNavigate={handleNavigate}
            onOpenNewTaskModal={handleCreateNewTask}
          />
        )}

        {currentPage === 'tasks' && (
          <TasksPage
            onNavigateToTask={handleOpenTaskDetail}
            onOpenNewTaskModal={handleCreateNewTask}
            initialFilterStatus={taskFilterStatus}
            initialFilterTeam={taskFilterTeam}
            initialFilterOwner={taskFilterOwner}
            teamUsers={teamUsers}
          />
        )}

        {currentPage === 'task-detail' && selectedTaskId && (
          <TaskDetailPage
            taskId={selectedTaskId}
            onBack={() => setCurrentPage('tasks')}
            onEditTask={handleEditTask}
            teamUsers={teamUsers}
          />
        )}

        {currentPage === 'team' && (
          <TeamPage
            onNavigateToTasksByOwner={(ownerId) => {
              handleNavigate('tasks', { filterOwner: ownerId });
            }}
            onNavigateToTasksByTeam={(teamId) => {
              handleNavigate('tasks', { filterTeam: teamId });
            }}
          />
        )}

        {currentPage === 'activity' && (
          <ActivityPage
            onNavigateToTask={handleOpenTaskDetail}
            teamUsers={teamUsers}
          />
        )}

        {currentPage === 'reviews' && (
          <ReviewsPage
            onNavigateToTask={handleOpenTaskDetail}
            teamUsers={teamUsers}
          />
        )}

        {currentPage === 'test-reports' && (
          <TestReportsPage
            onNavigateToTask={handleOpenTaskDetail}
            tasks={tasksList}
          />
        )}

        {currentPage === 'evidence' && (
          <EvidencePage
            onNavigateToTask={handleOpenTaskDetail}
            tasks={tasksList}
          />
        )}

        {currentPage === 'integrations' && <IntegrationsPage />}

        {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} />}

        {currentPage === 'strikes' && (
          <StrikesPage onNavigateToTask={handleOpenTaskDetail} />
        )}
      </div>

      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => {
          setIsTaskModalOpen(false);
          setTaskToEdit(null);
        }}
        onTaskSaved={() => {
          fetchGlobalData();
        }}
        taskToEdit={taskToEdit}
        teamUsers={teamUsers}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Signature Cindermarch Roaming Phoenix Companion */}
      <PhoenixCompanion />

      {/* Workspace Entry Warning Modal */}
      {isWarningModalOpen && entryWarning && !isSuspended && (
        <WorkspaceEntryModal
          warning={entryWarning}
          onDismiss={handleDismissWarning}
          onNavigateToStrikes={() => {
            handleDismissWarning();
            handleNavigate('strikes');
          }}
          onNavigateToTask={(taskId) => {
            handleDismissWarning();
            handleOpenTaskDetail(taskId);
          }}
        />
      )}
    </div>
  );
};
