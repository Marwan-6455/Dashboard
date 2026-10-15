import React, { useState, useRef, useEffect } from 'react';
import { Menu, Plus, Bell, Check, User, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  onOpenNewTaskModal: () => void;
  onOpenProfileModal?: () => void;
  onNavigate?: (page: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  onOpenNewTaskModal,
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
    markAllNotificationsRead
  } = useAuth();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="top-header">
      <div className="header-left">
        <button
          className="mobile-menu-toggle"
          onClick={onToggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>

        <div className="project-tag">
          <span className="project-indicator"></span>
          <span>Terminal 6 // Unity 6000.0.25f1</span>
        </div>

        {/* Workspace Indicator & Switcher */}
        <div style={{ position: 'relative' }}>
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
              fontSize: '12px',
              color: 'var(--text-white)',
              cursor: workspaces.length > 1 ? 'pointer' : 'default'
            }}
          >
            <span style={{ color: 'var(--accent-orange)', fontWeight: 700 }}>WS:</span>
            <span>{activeWorkspace?.name || 'Cindermarch Studio'}</span>
          </button>

          {showWorkspaceMenu && workspaces.length > 1 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                width: '200px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                zIndex: 100,
                padding: '6px 0'
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--text-secondary)',
                  padding: '4px 12px',
                  textTransform: 'uppercase'
                }}
              >
                Switch Workspace
              </div>
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => {
                    switchWorkspace(ws.id);
                    setShowWorkspaceMenu(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    fontSize: '12px',
                    background: ws.id === activeWorkspace?.id ? 'var(--bg-elevated)' : 'transparent',
                    color: ws.id === activeWorkspace?.id ? 'var(--accent-orange)' : 'var(--text-white)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {ws.name} ({ws.role})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Notification Bell Dropdown */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications"
            style={{
              position: 'relative',
              padding: '6px 10px',
              backgroundColor: showNotifications ? 'var(--bg-elevated)' : undefined
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
                  color: '#080808',
                  fontSize: '10px',
                  fontWeight: 800,
                  borderRadius: '10px',
                  padding: '1px 5px',
                  lineHeight: '1.2'
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
                width: '320px',
                maxHeight: '400px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
                zIndex: 200,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-white)' }}>
                  Notifications ({unreadNotificationsCount} unread)
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
                      gap: '4px'
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
                      padding: '24px',
                      textAlign: 'center',
                      fontSize: '12px',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.is_read) markNotificationRead(n.id);
                        if (n.related_task_id && onNavigate) {
                          onNavigate('tasks');
                          setShowNotifications(false);
                        }
                      }}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: n.is_read ? 'transparent' : 'rgba(255, 106, 0, 0.06)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '4px'
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: n.is_read ? 'var(--text-white)' : 'var(--accent-orange)'
                          }}
                        >
                          {n.title}
                        </span>
                        <span
                          className="mono"
                          style={{ fontSize: '10px', color: 'var(--text-secondary)' }}
                        >
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {n.message}
                      </div>
                      {n.related_task_id && (
                        <div
                          className="mono"
                          style={{
                            fontSize: '10px',
                            color: 'var(--accent-orange)',
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          Task {n.related_task_id} <ExternalLink size={10} />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar Trigger */}
        {onOpenProfileModal && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenProfileModal}
            title="Edit Profile"
            style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-orange)',
                color: '#080808',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: 800
              }}
            >
              {user?.displayName ? user.displayName.slice(0, 1).toUpperCase() : 'U'}
            </div>
            <span style={{ fontSize: '12px', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.displayName || 'Profile'}
            </span>
          </button>
        )}

        <button className="btn btn-primary btn-sm" onClick={onOpenNewTaskModal}>
          <Plus size={16} />
          <span>New Task</span>
        </button>
      </div>
    </header>
  );
};
