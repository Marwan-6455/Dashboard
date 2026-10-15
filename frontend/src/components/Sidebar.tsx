import React from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  History,
  FileCheck2,
  FileText,
  FileImage,
  Layers,
  Settings,
  LogOut,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenProfileModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  onOpenProfileModal
}) => {
  const { user, logout, activeWorkspace, unreadNotificationsCount } = useAuth();

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'activity', label: 'Activity', icon: History, badge: unreadNotificationsCount },
    { id: 'reviews', label: 'Reviews', icon: FileCheck2 },
    { id: 'test-reports', label: 'Test Reports', icon: FileText },
    { id: 'evidence', label: 'Evidence', icon: FileImage },
    { id: 'integrations', label: 'Integrations', icon: Layers },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const handleNavClick = (pageId: string) => {
    onNavigate(pageId);
    onCloseMobile();
  };

  return (
    <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-brand">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/cindermarch-logo.png"
              alt="Cindermarch Studio"
              style={{
                width: '32px',
                height: '32px',
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 8px rgba(255,106,0,0.4))'
              }}
            />
            <div className="brand-title" style={{ fontSize: '15px', letterSpacing: '1px' }}>
              <span>CINDERMARCH</span>
            </div>
          </div>
          <button
            className="mobile-menu-toggle"
            onClick={onCloseMobile}
            style={{ display: mobileOpen ? 'block' : 'none' }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="brand-subtitle" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
          {activeWorkspace?.name || 'Cindermarch Studio'} // TERMINAL 6
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">WORKSPACE</div>
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              className={`nav-link ${isActive ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={18} />
                <span>{item.label}</span>
              </div>
              {item.badge && item.badge > 0 ? (
                <span
                  style={{
                    backgroundColor: 'var(--accent-orange)',
                    color: '#080808',
                    fontSize: '10px',
                    fontWeight: 800,
                    borderRadius: '10px',
                    padding: '1px 6px'
                  }}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}

        <div className="nav-section-label" style={{ marginTop: '8px' }}>
          QUALITY & VERIFICATION
        </div>
        {navItems.slice(4, 7).map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              className={`nav-link ${isActive ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="nav-section-label" style={{ marginTop: '8px' }}>
          SYSTEM
        </div>
        {navItems.slice(7).map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              className={`nav-link ${isActive ? 'active' : ''}`}
              onClick={() => handleNavClick(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div
          className="user-profile-chip"
          onClick={onOpenProfileModal}
          style={{ cursor: onOpenProfileModal ? 'pointer' : 'default' }}
          title="Click to edit profile"
        >
          <div className="user-avatar">
            {user?.displayName ? user.displayName.slice(0, 1).toUpperCase() : 'U'}
          </div>
          <div className="user-details">
            <div className="user-name">{user?.displayName || 'Developer'}</div>
            <div className="user-role-tag">
              {user?.roles?.join(' • ') || 'developer'}
            </div>
          </div>
          <button
            className="logout-btn"
            title="Log Out"
            onClick={(e) => {
              e.stopPropagation();
              logout();
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
};
