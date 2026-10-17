import React, { useState, useRef, useEffect } from 'react';
import { Menu, Plus, Bell, Check, Search, ExternalLink, ChevronRight, CheckSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface HeaderProps {
  currentPage: string;
  onToggleMobileMenu: () => void;
  onOpenNewTaskModal: () => void;
  onOpenGlobalSearch: () => void;
  onOpenProfileModal?: () => void;
  onNavigate?: (page: string, params?: any) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onToggleMobileMenu,
  onOpenNewTaskModal,
  onOpenGlobalSearch,
  onOpenProfileModal,
  onNavigate
}) => {
  const {
    user,
    activeWorkspace,
    workspaces,
    switchWorkspace,
    notifications,
    unreadNotificationsCount,
    markNotificationRead,
    markAllNotificationsRead,
    activeProjectId,
    setActiveProjectId
  } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const wsMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (wsMenuRef.current && !wsMenuRef.current.contains(e.target as Node)) {
        setShowWorkspaceMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageTitle = (page: string) => {
    switch (page) {
      case 'overview':
        return 'Studio Command Center';
      case 'projects':
        return 'Project HQ & Roadmaps';
      case 'tasks':
        return 'Development Tasks';
      case 'task-detail':
        return 'Task Specification';
      case 'bugs':
        return 'QA Lab & Bug Tracker';
      case 'assets':
        return 'Private Asset Vault';
      case 'story-bible':
        return 'Story Development Toolkit';
      case 'wiki':
        return 'Studio Wiki & Knowledge Base';
      case 'decisions':
        return 'Architecture Decision Records';
      case 'standups-meetings':
        return 'Daily Standups & Meetings';
      case 'builds-releases':
        return 'Unity Build & Release Center';
      case 'marketing':
        return 'Marketing & Release Calendar';
      case 'team':
        return 'Studio Departments & Teams';
      case 'reviews':
        return 'Peer Review Queue';
      case 'strikes':
        return 'Deadline Strikes & Policy';
      case 'evidence':
        return 'Verification Evidence Locker';
      case 'test-reports':
        return 'Automated Test Ingestion';
      case 'integrations':
        return 'Discord Operations Bot';
      case 'activity':
        return 'Studio Audit Trail';
      case 'settings':
        return 'Hub Settings & Verification Gates';
      default:
        return page.charAt(0).toUpperCase() + page.slice(1);
    }
  };

  return (
    <header className="top-header">
      {/* Left: Mobile Toggle + Breadcrumbs + Engine Badge */}
      <div className="header-left">
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={onToggleMobileMenu}
          aria-label="Toggle navigation drawer"
        >
          <Menu size={20} />
        </button>

        {/* Studio Breadcrumb Trail */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>
            {activeProjectId === 'eclipsed' ? 'ECLIPSED' : 'TERMINAL 6'}
          </span>
          <ChevronRight size={14} color="var(--border-strong)" />
          <span style={{ color: 'var(--text-white)', fontWeight: 700, letterSpacing: '-0.01em' }}>
            {getPageTitle(currentPage)}
          </span>
        </div>

        {/* Studio Active Project Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
          <button
            type="button"
            onClick={() => setActiveProjectId('terminal-6')}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              borderRadius: 'var(--radius-sm)',
              border: activeProjectId === 'terminal-6' ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
              backgroundColor: activeProjectId === 'terminal-6' ? 'rgba(255, 94, 30, 0.15)' : 'var(--bg-elevated)',
              color: activeProjectId === 'terminal-6' ? 'var(--accent-orange)' : 'var(--text-secondary)',
              fontWeight: activeProjectId === 'terminal-6' ? 700 : 500,
              cursor: 'pointer'
            }}
            title="Switch project context to Terminal 6 (Psychological Horror)"
            aria-label="Switch project context to Terminal 6"
          >
            T6
          </button>
          <button
            type="button"
            onClick={() => setActiveProjectId('eclipsed')}
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              borderRadius: 'var(--radius-sm)',
              border: activeProjectId === 'eclipsed' ? '1px solid var(--accent-orange)' : '1px solid var(--border-subtle)',
              backgroundColor: activeProjectId === 'eclipsed' ? 'rgba(255, 94, 30, 0.15)' : 'var(--bg-elevated)',
              color: activeProjectId === 'eclipsed' ? 'var(--accent-orange)' : 'var(--text-secondary)',
              fontWeight: activeProjectId === 'eclipsed' ? 700 : 500,
              cursor: 'pointer'
            }}
            title="Switch project context to Eclipsed (2D Metroidvania)"
            aria-label="Switch project context to Eclipsed"
          >
            ECL
          </button>
        </div>

        {/* Engine Build Indicator */}
        <div className="project-tag" style={{ display: 'none' }}>
          <span className="project-indicator"></span>
          <span>Unity 6000.0.25f1</span>
        </div>

        {/* Workspace Switcher */}
        <div ref={wsMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11.5px',
              color: 'var(--text-white)',
              cursor: workspaces.length > 1 ? 'pointer' : 'default',
              transition: 'border-color var(--transition-fast)'
            }}
            title={workspaces.length > 1 ? 'Switch Workspace' : undefined}
          >
            <span style={{ color: 'var(--accent-orange)', fontWeight: 800 }}>WS:</span>
            <span>{activeWorkspace?.name || 'Cindermarch Studio'}</span>
          </button>

          {showWorkspaceMenu && workspaces.length > 1 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '6px',
                width: '220px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
                padding: '6px 0',
                animation: 'modal-pop 0.15s ease'
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  padding: '6px 14px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                Switch Workspace
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => {
                    switchWorkspace(ws.id);
                    setShowWorkspaceMenu(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 14px',
                    fontSize: '12.5px',
                    backgroundColor: ws.id === activeWorkspace?.id ? 'var(--bg-elevated)' : 'transparent',
                    color: ws.id === activeWorkspace?.id ? 'var(--accent-orange)' : 'var(--text-white)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background var(--transition-fast)'
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{ws.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Role: {ws.role}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Global Search Trigger + New Task + Notification Bell + Profile */}
      <div className="header-right">
        {/* Quick Global Task Search Trigger */}
        <button
          type="button"
          className="header-search-trigger"
          onClick={onOpenGlobalSearch}
          title="Quick Search (Ctrl+K)"
        >
          <Search size={14} color="var(--accent-orange)" />
          <span style={{ fontSize: '12px' }}>Search studio...</span>
          <kbd>Ctrl+K</kbd>
        </button>

        {/* Quick Create Task Action */}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onOpenNewTaskModal}
          style={{ gap: '6px' }}
        >
          <Plus size={15} />
          <span>New Task</span>
        </button>

        {/* Studio Notifications Dropdown */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
            style={{
              position: 'relative',
              padding: '7px 11px',
              backgroundColor: showNotifications ? 'var(--bg-hover)' : undefined
            }}
          >
            <Bell size={16} />
            {unreadNotificationsCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  backgroundColor: 'var(--accent-orange)',
                  color: '#080A0E',
                  fontSize: '10px',
                  fontWeight: 900,
                  borderRadius: '10px',
                  padding: '1px 5px',
                  lineHeight: '1.2',
                  boxShadow: '0 0 8px var(--accent-orange-glow)'
                }}
              >
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                width: '340px',
                maxHeight: '440px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 200,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'modal-pop 0.15s ease'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-elevated)'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-white)' }}>
                  Studio Notifications ({unreadNotificationsCount} unread)
                </div>
                {unreadNotificationsCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '11px',
                      color: 'var(--accent-orange)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: 600
                    }}
                  >
                    <Check size={12} />
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ overflowY: 'auto', flex: 1 }}>
                {notifications.length === 0 ? (
                  <div
                    style={{
                      padding: '32px 20px',
                      textAlign: 'center',
                      fontSize: '12.5px',
                      color: 'var(--text-muted)'
                    }}
                  >
                    No studio notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.is_read) markNotificationRead(n.id);
                        if (n.related_task_id && onNavigate) {
                          onNavigate('tasks', { taskId: n.related_task_id });
                          setShowNotifications(false);
                        }
                      }}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: n.is_read ? 'transparent' : 'rgba(255, 94, 30, 0.06)',
                        cursor: 'pointer',
                        transition: 'background var(--transition-fast)'
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-hover)')}
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.backgroundColor = n.is_read
                          ? 'transparent'
                          : 'rgba(255, 94, 30, 0.06)')
                      }
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 700,
                            color: n.is_read ? 'var(--text-white)' : 'var(--accent-orange)'
                          }}
                        >
                          {n.title}
                        </span>
                        <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {n.message}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
