import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  LayoutList,
  Kanban,
  Filter,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  User,
  Clock,
  Tag,
  ArrowUpDown,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  AlertCircle,
  CheckSquare,
  Send
} from 'lucide-react';
import { Task, TaskStatus, Priority } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { PriorityBadge } from '../components/PriorityBadge.js';
import { GateStatusWidget } from '../components/GateStatusWidget.js';
import { RequestTaskModal } from '../components/RequestTaskModal.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { apiRequest } from '../api/client.js';

interface TasksPageProps {
  onNavigateToTask: (taskId: string) => void;
  onOpenNewTaskModal: () => void;
  initialFilterStatus?: string;
  initialFilterTeam?: string;
  initialFilterOwner?: string;
  teamUsers?: any[];
}

const STATUS_COLUMNS: TaskStatus[] = [
  'Backlog',
  'In Progress',
  'Ready for Review',
  'Changes Requested',
  'Ready to Integrate',
  'Verified Complete',
  'Blocked'
];

const CATEGORIES = [
  'Gameplay',
  'Level Design',
  'Combat & Bosses',
  'Movement & Physics',
  'Abilities & Upgrades',
  'Exploration & Progression',
  'Engine',
  'Graphics/Shaders',
  'Art & Animation',
  'Audio & SFX',
  'Narrative & Lore',
  'Tooling',
  'UI/UX',
  'Optimization',
  'QA & Testing'
];

const STUDIO_TEAMS = [
  { id: 'team_story', name: 'Story Team' },
  { id: 'team_coding', name: 'Coding Team' },
  { id: 'team_marketing', name: 'Marketing Team' },
  { id: 'team_engine', name: 'Engine Team' },
  { id: 'team_3d_artists', name: '3D Artists' },
  { id: 'team_sound', name: 'Sound Team' }
];

type PresetTab = 'all' | 'my' | 'overdue' | 'in_progress' | 'review' | 'blocked' | 'complete';
type SortOption = 'deadline_asc' | 'deadline_desc' | 'priority_desc' | 'updated_desc' | 'created_desc';

export const TasksPage: React.FC<TasksPageProps> = ({
  onNavigateToTask,
  onOpenNewTaskModal,
  initialFilterStatus,
  initialFilterTeam,
  initialFilterOwner,
  teamUsers = []
}) => {
  const { user, activeProjectId, canManageTasks } = useAuth();
  const toast = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [activeTab, setActiveTab] = useState<PresetTab>('all');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const canManage = canManageTasks();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>(initialFilterStatus || '');
  const [teamFilter, setTeamFilter] = useState<string>(initialFilterTeam || '');
  const [ownerFilter, setOwnerFilter] = useState<string>(initialFilterOwner || '');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('updated_desc');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Gate failure alert modal
  const [gateFailureTask, setGateFailureTask] = useState<any | null>(null);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const query = new URLSearchParams();
      if (activeProjectId) query.set('projectId', activeProjectId);
      if (statusFilter) query.set('status', statusFilter);
      if (teamFilter) query.set('teamId', teamFilter);
      if (ownerFilter) query.set('ownerId', ownerFilter);
      if (categoryFilter) query.set('category', categoryFilter);
      if (priorityFilter) query.set('priority', priorityFilter);
      if (searchQuery) query.set('search', searchQuery);

      if (activeTab === 'my' && user?.id) {
        query.set('myTasksOnly', 'true');
      } else if (activeTab === 'overdue') {
        query.set('overdueOnly', 'true');
      } else if (activeTab === 'in_progress') {
        query.set('status', 'In Progress');
      } else if (activeTab === 'review') {
        query.set('status', 'Ready for Review');
      } else if (activeTab === 'blocked') {
        query.set('status', 'Blocked');
      } else if (activeTab === 'complete') {
        query.set('status', 'Verified Complete');
      }

      const res = await apiRequest(`/api/tasks?${query.toString()}`);
      setTasks(res.tasks || []);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialFilterStatus !== undefined) setStatusFilter(initialFilterStatus);
  }, [initialFilterStatus]);

  useEffect(() => {
    if (initialFilterTeam !== undefined) setTeamFilter(initialFilterTeam);
  }, [initialFilterTeam]);

  useEffect(() => {
    if (initialFilterOwner !== undefined) setOwnerFilter(initialFilterOwner);
  }, [initialFilterOwner]);

  useEffect(() => {
    fetchTasks();
  }, [statusFilter, teamFilter, ownerFilter, categoryFilter, priorityFilter, searchQuery, activeTab, activeProjectId]);

  // Client-side sorting for responsive instant ordering
  const sortedTasks = useMemo(() => {
    const list = [...tasks];
    list.sort((a, b) => {
      if (sortBy === 'deadline_asc') {
        const da = a.extended_deadline || a.deadline || '9999';
        const db = b.extended_deadline || b.deadline || '9999';
        return da.localeCompare(db);
      }
      if (sortBy === 'deadline_desc') {
        const da = a.extended_deadline || a.deadline || '0000';
        const db = b.extended_deadline || b.deadline || '0000';
        return db.localeCompare(da);
      }
      if (sortBy === 'priority_desc') {
        const pOrder: Record<string, number> = { P0: 3, P1: 2, P2: 1 };
        return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
      }
      if (sortBy === 'created_desc') {
        return (b.created_at || '').localeCompare(a.created_at || '');
      }
      // default: updated_desc
      return (b.updated_at || '').localeCompare(a.updated_at || '');
    });
    return list;
  }, [tasks, sortBy]);

  const handleQuickStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!canManage) {
      if (!targetTask || targetTask.owner_id !== user?.id) {
        toast.error('Developers can only change progress status on their assigned tasks.');
        return;
      }
      const allowedDevStatuses: TaskStatus[] = ['Backlog', 'In Progress', 'Ready for Review', 'Blocked'];
      if (!allowedDevStatuses.includes(newStatus)) {
        toast.error(`Transition to ${newStatus} requires review approval or management authorization.`);
        return;
      }
    }

    // Optimistic update
    const previousTasks = [...tasks];
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    try {
      await apiRequest(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      toast.success(`Task ${taskId} moved to ${newStatus}`);
      fetchTasks();
    } catch (err: any) {
      // Revert optimistic update
      setTasks(previousTasks);

      if (err.gateStatus) {
        setGateFailureTask({
          taskId,
          reasons: err.gateStatus.reasons,
          gateStatus: err.gateStatus
        });
        toast.error(`Cannot complete task: Quality completion gates failed.`, 'Gate Enforcement');
      } else {
        toast.error(err.message || 'Status transition rejected');
      }
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, colStatus: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colStatus) {
      setDragOverColumn(colStatus);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colStatus: TaskStatus) => {
    if (dragOverColumn === colStatus) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    setDraggedTaskId(null);

    if (!taskId) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    if (!canManage) {
      if (task.owner_id !== user?.id) {
        toast.error('Developers can only transition tasks assigned to themselves.');
        return;
      }
      const allowedDevStatuses: TaskStatus[] = ['Backlog', 'In Progress', 'Ready for Review', 'Blocked'];
      if (!allowedDevStatuses.includes(targetStatus)) {
        toast.error(`Transition to ${targetStatus} requires review approval or management authorization.`);
        return;
      }
    }

    await handleQuickStatusChange(taskId, targetStatus);
  };

  const resetAllFilters = () => {
    setStatusFilter('');
    setTeamFilter('');
    setOwnerFilter('');
    setCategoryFilter('');
    setPriorityFilter('');
    setSearchQuery('');
    setActiveTab('all');
  };

  const hasActiveFilters = Boolean(
    statusFilter || teamFilter || ownerFilter || categoryFilter || priorityFilter || searchQuery || activeTab !== 'all'
  );

  return (
    <div className="page-wrapper">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>{activeProjectId === 'eclipsed' ? 'Eclipsed' : 'Terminal 6'} // Development Tasks</h1>
          <p>
            Track technical scope, 6 verification completion gates, milestone deadlines, and peer reviews.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* View Mode Toggle */}
          <div
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px'
            }}
          >
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-secondary' : ''}`}
              style={{
                backgroundColor: viewMode === 'list' ? 'var(--bg-surface)' : 'transparent',
                border: 'none',
                color: viewMode === 'list' ? 'var(--text-white)' : 'var(--text-secondary)'
              }}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <LayoutList size={15} />
              <span>List</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-secondary' : ''}`}
              style={{
                backgroundColor: viewMode === 'kanban' ? 'var(--bg-surface)' : 'transparent',
                border: 'none',
                color: viewMode === 'kanban' ? 'var(--text-white)' : 'var(--text-secondary)'
              }}
              onClick={() => setViewMode('kanban')}
              title="Interactive Kanban Board"
            >
              <Kanban size={15} />
              <span>Kanban</span>
            </button>
          </div>

          {canManage ? (
            <button className="btn btn-primary btn-sm" onClick={onOpenNewTaskModal}>
              <Plus size={15} />
              <span>Create Task</span>
            </button>
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setIsRequestModalOpen(true)}
              style={{ gap: '6px' }}
              title="Request a new task assignment from Team Leadership"
            >
              <Send size={14} color="var(--accent-orange)" />
              <span>Request Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Preset Tab Bar */}
      <div className="tab-bar">
        {[
          { id: 'all', label: `All Tasks (${tasks.length})` },
          { id: 'my', label: 'My Assigned Tasks' },
          { id: 'overdue', label: 'Overdue Milestones' },
          { id: 'in_progress', label: 'In Progress' },
          { id: 'review', label: 'Needs Review' },
          { id: 'blocked', label: 'Blocked' },
          { id: 'complete', label: 'Verified Complete' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as PresetTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Rich Multi-Filter & Search Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={15} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by ID, title, description, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Studio Team Filter */}
        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '150px' }}
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        >
          <option value="">All Teams</option>
          {STUDIO_TEAMS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {/* Priority Filter */}
        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '130px' }}
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="P0">P0 — Critical Blocker</option>
          <option value="P1">P1 — Standard Scope</option>
          <option value="P2">P2 — Polish / Minor</option>
        </select>

        {/* Category Filter */}
        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '130px' }}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Assignee Filter */}
        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '140px' }}
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
        >
          <option value="">All Developers</option>
          {teamUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName || u.username}
            </option>
          ))}
        </select>

        {/* Sorting Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ArrowUpDown size={14} color="var(--text-muted)" />
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: '160px' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            <option value="updated_desc">Recently Updated</option>
            <option value="deadline_asc">Due Soonest</option>
            <option value="deadline_desc">Due Latest</option>
            <option value="priority_desc">P0 Priority First</option>
            <option value="created_desc">Newest Created</option>
          </select>
        </div>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={resetAllFilters}
            style={{ color: 'var(--accent-orange)' }}
          >
            <RotateCcw size={13} />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span>Error loading tasks: {error}</span>
        </div>
      )}

      {/* TABLE / LIST VIEW */}
      {viewMode === 'list' && (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Task ID</th>
                <th>Title & Technical Scope</th>
                <th style={{ width: '120px' }}>Category</th>
                <th style={{ width: '120px' }}>Team</th>
                <th style={{ width: '90px' }}>Priority</th>
                <th style={{ width: '170px' }}>Status</th>
                <th style={{ width: '140px' }}>Assignee</th>
                <th style={{ width: '120px' }}>Gate Progress</th>
                <th style={{ width: '130px' }}>Deadline</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Loading tasks...
                  </td>
                </tr>
              ) : sortedTasks.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '50px 20px', textAlign: 'center' }}>
                    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                      <CheckSquare size={32} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', marginBottom: '4px' }}>
                        {hasActiveFilters ? 'No tasks matching current filters' : 'Task Board is Clean & Ready'}
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', marginBottom: '16px' }}>
                        {hasActiveFilters
                          ? 'Try clearing your active filters or search terms.'
                          : 'Create your first development task for Terminal 6 to begin tracking work.'}
                      </p>
                      {canManage ? (
                        <button type="button" className="btn btn-primary btn-sm" onClick={onOpenNewTaskModal}>
                          <Plus size={14} /> Create Task
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setIsRequestModalOpen(true)}
                          style={{ gap: '6px' }}
                        >
                          <Send size={14} color="var(--accent-orange)" /> Request Task Assignment
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedTasks.map((task) => {
                  let tags: string[] = [];
                  if (task.tags_json) {
                    try {
                      tags = JSON.parse(task.tags_json);
                    } catch {
                      // ignore
                    }
                  }

                  const effectiveDeadline = task.extended_deadline || task.deadline;
                  const isOverdue =
                    effectiveDeadline &&
                    new Date(effectiveDeadline).getTime() < Date.now() &&
                    task.status !== 'Verified Complete';

                  return (
                    <tr
                      key={task.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onNavigateToTask(task.id)}
                    >
                      <td>
                        <span className="mono" style={{ color: 'var(--accent-orange)', fontWeight: 700, fontSize: '12px' }}>
                          {task.id}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-white)', fontSize: '13.5px' }}>
                          {task.title}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                            marginTop: '2px',
                            maxWidth: '460px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {task.description}
                        </div>
                        {tags.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {tags.map((tag) => (
                              <span
                                key={tag}
                                style={{
                                  backgroundColor: 'var(--bg-elevated)',
                                  color: 'var(--text-secondary)',
                                  borderRadius: '3px',
                                  fontSize: '10px',
                                  padding: '1px 5px',
                                  border: '1px solid var(--border-subtle)'
                                }}
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: 'rgba(255, 94, 30, 0.08)',
                            color: 'var(--accent-orange)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255, 94, 30, 0.22)'
                          }}
                        >
                          {task.category || 'Gameplay'}
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            color: 'var(--text-white)',
                            backgroundColor: 'var(--bg-elevated)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-subtle)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {(task as any).team_name || 'Studio'}
                        </span>
                      </td>

                      <td>
                        <PriorityBadge priority={task.priority} />
                      </td>

                      <td>
                        <div onClick={(e) => e.stopPropagation()}>
                          {!canManage && task.owner_id !== user?.id ? (
                            <StatusBadge status={task.status} />
                          ) : (
                            <select
                              className="form-control"
                              style={{ fontSize: '12px', padding: '4px 8px', width: 'auto' }}
                              value={task.status}
                              onChange={(e) => handleQuickStatusChange(task.id, e.target.value as TaskStatus)}
                            >
                              {(canManage
                                ? STATUS_COLUMNS
                                : Array.from(new Set(['Backlog', 'In Progress', 'Ready for Review', 'Blocked', task.status]))
                              ).map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '13px', color: task.owner_name ? 'var(--text-white)' : 'var(--text-muted)' }}>
                          {task.owner_name || 'Unassigned'}
                        </div>
                      </td>

                      <td>
                        <div className="mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          {task.criteria_satisfied || 0}/{task.criteria_total || 0} reqs
                        </div>
                        {task.changeset_count && task.changeset_count > 0 ? (
                          <div style={{ fontSize: '10.5px', color: 'var(--status-complete)', marginTop: '1px' }}>
                            {task.changeset_count} CS linked
                          </div>
                        ) : null}
                      </td>

                      <td>
                        <div
                          className="mono"
                          style={{
                            fontSize: '11.5px',
                            color: isOverdue ? '#EF4444' : 'var(--text-secondary)',
                            fontWeight: isOverdue ? 700 : 500
                          }}
                        >
                          {effectiveDeadline ? new Date(effectiveDeadline).toLocaleDateString() : '—'}
                        </div>
                        {task.is_deadline_exempt === 1 ? (
                          <div style={{ fontSize: '10px', color: 'var(--status-complete)' }}>POLICY EXEMPT</div>
                        ) : task.extended_deadline ? (
                          <div style={{ fontSize: '10px', color: 'var(--status-review)' }}>EXTENDED</div>
                        ) : isOverdue ? (
                          <div style={{ fontSize: '10px', color: '#EF4444' }}>OVERDUE</div>
                        ) : null}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <ChevronRight size={16} color="var(--text-muted)" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* KANBAN BOARD VIEW (Native Interactive Drag and Drop) */}
      {viewMode === 'kanban' && (
        <div className="kanban-board">
          {STATUS_COLUMNS.map((colStatus) => {
            const colTasks = sortedTasks.filter((t) => t.status === colStatus);
            const isDragOver = dragOverColumn === colStatus;

            return (
              <div
                key={colStatus}
                className={`kanban-column ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, colStatus)}
                onDragLeave={(e) => handleDragLeave(e, colStatus)}
                onDrop={(e) => handleDrop(e, colStatus)}
              >
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span>{colStatus}</span>
                    <span className="kanban-count">{colTasks.length}</span>
                  </div>
                </div>

                <div className="kanban-cards">
                  {colTasks.length === 0 ? (
                    <div
                      style={{
                        padding: '24px 12px',
                        textAlign: 'center',
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        border: '1px dashed var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      Drag tasks here
                    </div>
                  ) : (
                    colTasks.map((t) => {
                      const isDragging = draggedTaskId === t.id;
                      const effectiveDeadline = t.extended_deadline || t.deadline;
                      const isOverdue =
                        effectiveDeadline &&
                        new Date(effectiveDeadline).getTime() < Date.now() &&
                        t.status !== 'Verified Complete';

                      return (
                        <div
                          key={t.id}
                          className={`kanban-card ${isDragging ? 'dragging' : ''}`}
                          draggable={canManage || t.owner_id === user?.id}
                          onDragStart={(e) => handleDragStart(e, t.id)}
                          onClick={() => onNavigateToTask(t.id)}
                          style={{
                            cursor: canManage || t.owner_id === user?.id ? 'grab' : 'pointer'
                          }}
                        >
                          <div className="kanban-card-header">
                            <span
                              className="mono"
                              style={{ fontSize: '11px', color: 'var(--accent-orange)', fontWeight: 700 }}
                            >
                              {t.id}
                            </span>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <PriorityBadge priority={t.priority} />
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: 'var(--text-white)',
                              marginBottom: '6px',
                              lineHeight: '1.4'
                            }}
                          >
                            {t.title}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                backgroundColor: 'rgba(255, 94, 30, 0.08)',
                                color: 'var(--accent-orange)',
                                padding: '1px 5px',
                                borderRadius: '3px',
                                border: '1px solid rgba(255, 94, 30, 0.2)'
                              }}
                            >
                              {t.category || 'Gameplay'}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                backgroundColor: 'var(--bg-surface)',
                                color: 'var(--text-secondary)',
                                padding: '1px 5px',
                                borderRadius: '3px'
                              }}
                            >
                              {(t as any).team_name || 'Studio'}
                            </span>
                          </div>

                          <div className="kanban-card-footer">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                {t.owner_name || 'Unassigned'}
                              </span>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div
                                className="mono"
                                style={{
                                  fontSize: '10.5px',
                                  color: isOverdue ? '#EF4444' : 'var(--text-muted)',
                                  fontWeight: isOverdue ? 700 : 500
                                }}
                              >
                                {effectiveDeadline ? new Date(effectiveDeadline).toLocaleDateString() : 'No date'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completion Gate Failure Modal */}
      {gateFailureTask && (
        <div className="modal-overlay" onClick={() => setGateFailureTask(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={20} color="var(--status-blocked)" />
                <h2 className="modal-title">Verification Gate Failure: {gateFailureTask.taskId}</h2>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setGateFailureTask(null)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                <strong>Quality Standard Enforced:</strong> Task cannot transition to "Verified Complete" until all mandatory completion gates pass.
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  UNMET CRITICAL GATES:
                </div>
                <ul style={{ paddingLeft: '20px', color: 'var(--status-blocked)', fontSize: '13px', lineHeight: '1.6' }}>
                  {gateFailureTask.reasons.map((reason: string, idx: number) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>

              <GateStatusWidget gateStatus={gateFailureTask.gateStatus} />
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setGateFailureTask(null)}
              >
                Dismiss
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const id = gateFailureTask.taskId;
                  setGateFailureTask(null);
                  onNavigateToTask(id);
                }}
              >
                Open Task & Satisfy Gates
              </button>
            </div>
          </div>
        </div>
      )}

      <RequestTaskModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onRequestSubmitted={fetchTasks}
      />
    </div>
  );
};
