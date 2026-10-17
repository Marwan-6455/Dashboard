import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Users,
  History,
  FileCheck2,
  FileText,
  FileImage,
  Layers,
  Settings,
  LogOut,
  X,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Bot,
  User,
  FolderKanban,
  AlertCircle,
  Box,
  BookOpen,
  Library,
  GitPullRequest,
  CalendarCheck,
  Megaphone,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string, params?: any) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenProfileModal?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: any;
  customAction?: () => void;
  badge?: number | string;
}

interface NavSection {
  id: string;
  label: string;
  isCollapsible?: boolean;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  mobileOpen,
  onCloseMobile,
  onOpenProfileModal
}) => {
  const { user, logout, activeWorkspace, unreadNotificationsCount } = useAuth();

  const isSuperAdminOrOwner =
    user?.roles?.includes('owner') ||
    user?.roles?.includes('super_admin') ||
    user?.roles?.includes('admin') ||
    activeWorkspace?.role === 'owner' ||
    activeWorkspace?.role === 'super_admin' ||
    activeWorkspace?.role === 'admin';

  // Collapsed sidebar preference persisted in localStorage
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('cm_sidebar_collapsed') === 'true';
  });

  // Track expanded state for secondary tool sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('cm_sidebar_expanded_sections');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      engineering: false,
      creative: false,
      system: false
    };
  });

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = { ...prev, [sectionId]: !prev[sectionId] };
      localStorage.setItem('cm_sidebar_expanded_sections', JSON.stringify(next));
      return next;
    });
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('cm_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Auto-expand group if currentPage is inside it
  useEffect(() => {
    if (['bugs', 'builds-releases', 'test-reports', 'evidence', 'strikes'].includes(currentPage)) {
      setExpandedSections((prev) => ({ ...prev, engineering: true }));
    } else if (['assets', 'story-bible', 'marketing', 'wiki', 'decisions'].includes(currentPage)) {
      setExpandedSections((prev) => ({ ...prev, creative: true }));
    } else if (['integrations', 'activity', 'settings'].includes(currentPage)) {
      setExpandedSections((prev) => ({ ...prev, system: true }));
    }
  }, [currentPage]);

  const navSections: NavSection[] = [
    {
      id: 'workspace',
      label: 'WORKSPACE ESSENTIALS',
      isCollapsible: false,
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        {
          id: 'my-tasks',
          label: 'My Tasks',
          icon: User,
          customAction: () => onNavigate('tasks', { filterOwner: user?.id })
        },
        { id: 'tasks', label: 'All Tasks', icon: CheckSquare },
        { id: 'projects', label: 'Project HQ', icon: FolderKanban },
        { id: 'team', label: 'Studio Teams', icon: Users },
        { id: 'reviews', label: 'Peer Reviews', icon: FileCheck2 },
        { id: 'standups-meetings', label: 'Standups & Mtgs', icon: CalendarCheck },
        ...(isSuperAdminOrOwner
          ? [{ id: 'admin', label: 'Administration', icon: ShieldCheck }]
          : [])
      ]
    },
    {
      id: 'engineering',
      label: 'ENGINEERING & QUALITY',
      isCollapsible: true,
      items: [
        { id: 'bugs', label: 'QA Bug Tracker', icon: AlertCircle },
        { id: 'builds-releases', label: 'Builds & Releases', icon: Layers },
        { id: 'test-reports', label: 'Test Reports', icon: FileText },
        { id: 'evidence', label: 'Evidence Vault', icon: FileImage },
        { id: 'strikes', label: 'Strike Policy & Status', icon: ShieldAlert }
      ]
    },
    {
      id: 'creative',
      label: 'CREATIVE & STUDIO DOCS',
      isCollapsible: true,
      items: [
        { id: 'assets', label: 'Asset Vault', icon: Box },
        { id: 'story-bible', label: 'Story Bible', icon: BookOpen },
        { id: 'marketing', label: 'Marketing Calendar', icon: Megaphone },
        { id: 'wiki', label: 'Studio Wiki', icon: Library },
        { id: 'decisions', label: 'Decision Log', icon: GitPullRequest }
      ]
    },
    {
      id: 'system',
      label: 'SYSTEM & SETTINGS',
      isCollapsible: true,
      items: [
        { id: 'integrations', label: 'Integrations', icon: Bot },
        { id: 'activity', label: 'Audit Trail', icon: History, badge: unreadNotificationsCount },
        { id: 'settings', label: 'Hub Settings', icon: Settings }
      ]
    }
  ];

  const handleNavClick = (item: NavItem) => {
    if (item.customAction) {
      item.customAction();
    } else {
      onNavigate(item.id);
    }
    onCloseMobile();
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Sidebar Branding & Collapse Toggle */}
      <div className="sidebar-brand">
        <div className="brand-header-row">
          <div className="brand-logo-group">
            <div className="brand-crest">
              <img
                src="/cindermarch-logo.png"
                alt="Cindermarch Studio"
                style={{
                  width: '30px',
                  height: '30px',
                  objectFit: 'contain'
                }}
              />
            </div>
            {!collapsed && (
              <div>
                <div className="brand-title">CINDERMARCH</div>
                <div className="brand-subtitle">
                  {activeWorkspace?.name || 'Cindermarch Studio'} // T6
                </div>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            type="button"
            className="sidebar-collapse-toggle"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={onCloseMobile}
            style={{ display: mobileOpen ? 'flex' : 'none' }}
            aria-label="Close navigation drawer"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Categorized Navigation */}
      <nav className="sidebar-nav">
        {navSections.map((section, sIdx) => {
          const isExpanded = !section.isCollapsible || expandedSections[section.id];
          const hasActiveChild = section.items.some((item) => currentPage === item.id);

          return (
            <React.Fragment key={section.id}>
              {section.isCollapsible && !collapsed ? (
                <button
                  type="button"
                  className="nav-section-label"
                  onClick={() => toggleSection(section.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    marginTop: sIdx > 0 ? '10px' : '0',
                    padding: '8px 10px',
                    color: hasActiveChild ? 'var(--accent-orange)' : 'var(--text-muted)'
                  }}
                  title={`Toggle ${section.label}`}
                >
                  <span>{section.label}</span>
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              ) : (
                <div className="nav-section-label" style={{ marginTop: sIdx > 0 ? '10px' : '0' }}>
                  {section.label}
                </div>
              )}

              {(collapsed || isExpanded) &&
                section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`nav-link ${isActive ? 'active' : ''}`}
                      onClick={() => handleNavClick(item)}
                      title={collapsed ? item.label : undefined}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>

                      {typeof item.badge === 'number' && item.badge > 0 ? (
                        <span className="nav-count-badge badge-alert">
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Footer User Profile & Logout */}
      <div className="sidebar-footer">
        <div
          className="user-profile-chip"
          onClick={onOpenProfileModal}
          style={{ cursor: onOpenProfileModal ? 'pointer' : 'default' }}
          title={collapsed ? `${user?.displayName || 'Developer'} (Click to view profile)` : 'Click to view profile'}
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
            type="button"
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
