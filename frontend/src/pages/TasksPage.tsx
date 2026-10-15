import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  LayoutList,
  Kanban,
  Filter,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  User,
  Clock,
  Tag
} from 'lucide-react';
import { Task, TaskStatus, Priority } from '../types/index.js';
import { StatusBadge } from '../components/StatusBadge.js';
import { PriorityBadge } from '../components/PriorityBadge.js';
import { GateStatusWidget } from '../components/GateStatusWidget.js';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

interface TasksPageProps {
  onNavigateToTask: (taskId: string) => void;
  onOpenNewTaskModal: () => void;
  initialFilterStatus?: string;
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
  'Engine',
  'Graphics/Shaders',
  'Audio',
  'Physics',
  'Tooling',
  'UI/UX',
  'Optimization'
];

export const TasksPage: React.FC<TasksPageProps> = ({
  onNavigateToTask,
  onOpenNewTaskModal,
  initialFilterStatus,
  teamUsers = []
}) => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilterStatus || '');
  const [ownerFilter, setOwnerFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [myTasksOnly, setMyTasksOnly] = useState<boolean>(false);
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Gate failure alert modal state
  const [gateFailureTask, setGateFailureTask] = useState<any | null>(null);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const query = new URLSearchParams();
      if (statusFilter) query.set('status', statusFilter);
      if (ownerFilter) query.set('ownerId', ownerFilter);
      if (categoryFilter) query.set('category', categoryFilter);
      if (priorityFilter) query.set('priority', priorityFilter);
      if (searchQuery) query.set('search', searchQuery);
      if (myTasksOnly) query.set('myTasksOnly', 'true');
      if (overdueOnly) query.set('overdueOnly', 'true');

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
    fetchTasks();
  }, [statusFilter, ownerFilter, categoryFilter, priorityFilter, searchQuery, myTasksOnly, overdueOnly]);

  const handleQuickStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await apiRequest(`/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      fetchTasks();
    } catch (err: any) {
      if (err.gateStatus) {
        setGateFailureTask({
          taskId,
          reasons: err.gateStatus.reasons,
          gateStatus: err.gateStatus
        });
      } else {
        alert(err.message);
      }
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h1>Terminal 6 // Task Management</h1>
          <p>Shared development tasks, completion-gate verification, and multi-developer coordination.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', padding: '2px' }}>
            <button
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : ''}`}
              style={{ padding: '6px 12px' }}
              onClick={() => setViewMode('list')}
            >
              <LayoutList size={15} /> List
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : ''}`}
              style={{ padding: '6px 12px' }}
              onClick={() => setViewMode('kanban')}
            >
              <Kanban size={15} /> Kanban
            </button>
          </div>
          <button className="btn btn-primary" onClick={onOpenNewTaskModal}>
            <Plus size={16} /> New Task
          </button>
        </div>
      </div>

      {/* Scope Toggles Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`btn btn-sm ${!myTasksOnly && !overdueOnly ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setMyTasksOnly(false);
            setOverdueOnly(false);
          }}
        >
          All Project Tasks
        </button>
        <button
          type="button"
          className={`btn btn-sm ${myTasksOnly ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setMyTasksOnly(!myTasksOnly);
            setOverdueOnly(false);
          }}
        >
          <User size={13} />
          <span>My Tasks</span>
        </button>
        <button
          type="button"
          className={`btn btn-sm ${overdueOnly ? 'btn-primary' : 'btn-secondary'}`}
          style={{ borderColor: overdueOnly ? 'var(--status-blocked)' : undefined }}
          onClick={() => {
            setOverdueOnly(!overdueOnly);
            setMyTasksOnly(false);
          }}
        >
          <Clock size={13} />
          <span>Overdue Tasks</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={16} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by ID, title, keyword (e.g. Locomotive)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '130px' }}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '140px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {STATUS_COLUMNS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '150px' }}
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
        >
          <option value="">All Owners</option>
          {teamUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.display_name || u.displayName}
            </option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '120px' }}
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="P0">P0 (Critical)</option>
          <option value="P1">P1 (High)</option>
          <option value="P2">P2 (Normal)</option>
        </select>

        {(statusFilter || ownerFilter || categoryFilter || priorityFilter || searchQuery || myTasksOnly || overdueOnly) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setStatusFilter('');
              setOwnerFilter('');
              setCategoryFilter('');
              setPriorityFilter('');
              setSearchQuery('');
              setMyTasksOnly(false);
              setOverdueOnly(false);
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Task ID</th>
                <th>Title & Context</th>
                <th style={{ width: '110px' }}>Category</th>
                <th style={{ width: '80px' }}>Priority</th>
                <th style={{ width: '150px' }}>Status</th>
                <th style={{ width: '140px' }}>Owner</th>
                <th style={{ width: '90px' }}>Effort</th>
                <th style={{ width: '120px' }}>Criteria</th>
                <th style={{ width: '100px' }}>UVCS</th>
                <th style={{ width: '100px' }}>Deadline</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>
                      No tasks matched your filter criteria.
                    </div>
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  let tags: string[] = [];
                  if (task.tags_json) {
                    try {
                      tags = JSON.parse(task.tags_json);
                    } catch {
                      // ignore
                    }
                  }

                  return (
                    <tr
                      key={task.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onNavigateToTask(task.id)}
                    >
                      <td>
                        <span className="mono" style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>
                          {task.id}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                          {task.title}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '420px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                            backgroundColor: 'rgba(255, 106, 0, 0.1)',
                            color: 'var(--accent-orange)',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid rgba(255, 106, 0, 0.25)'
                          }}
                        >
                          {task.category || 'Gameplay'}
                        </span>
                      </td>
                      <td>
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td>
                        <div onClick={(e) => e.stopPropagation()}>
                          <select
                            className="form-control"
                            style={{ fontSize: '12px', padding: '4px 8px' }}
                            value={task.status}
                            onChange={(e) => handleQuickStatusChange(task.id, e.target.value as TaskStatus)}
                          >
                            {STATUS_COLUMNS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px' }}>
                          {task.owner_name || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}
                        </div>
                      </td>
                      <td>
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {task.estimated_effort || '—'}
                        </div>
                      </td>
                      <td>
                        <div className="mono" style={{ fontSize: '12px' }}>
                          {task.criteria_satisfied || 0}/{task.criteria_total || 0} satisfied
                        </div>
                      </td>
                      <td>
                        <div className="mono" style={{ fontSize: '12px' }}>
                          {task.is_changeset_exempt === 1 ? (
                            <span className="demo-tag">EXEMPT</span>
                          ) : task.changeset_count && task.changeset_count > 0 ? (
                            <span style={{ color: 'var(--status-complete)' }}>{task.changeset_count} linked</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>None</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                          {task.deadline ? new Date(task.deadline).toLocaleDateString() : '—'}
                        </div>
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

      {/* Kanban Board View */}
      {viewMode === 'kanban' && (
        <div className="kanban-board">
          {STATUS_COLUMNS.map((colStatus) => {
            const colTasks = tasks.filter((t) => t.status === colStatus);

            return (
              <div key={colStatus} className="kanban-column">
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span>{colStatus}</span>
                    <span className="kanban-count">{colTasks.length}</span>
                  </div>
                </div>

                <div className="kanban-cards">
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      className="kanban-card"
                      onClick={() => onNavigateToTask(t.id)}
                    >
                      <div className="kanban-card-header">
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--accent-orange)', fontWeight: 600 }}>
                          {t.id}
                        </span>
                        <PriorityBadge priority={t.priority} />
                      </div>

                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '6px' }}>
                        {t.title}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            backgroundColor: 'rgba(255, 106, 0, 0.1)',
                            color: 'var(--accent-orange)',
                            padding: '2px 6px',
                            borderRadius: '3px'
                          }}
                        >
                          {t.category || 'Gameplay'}
                        </span>
                        {t.estimated_effort && (
                          <span className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                            Est: {t.estimated_effort}
                          </span>
                        )}
                      </div>

                      <div className="kanban-card-footer">
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {t.owner_name || 'Unassigned'}
                        </span>
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {t.criteria_satisfied || 0}/{t.criteria_total || 0} reqs
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Gate Failure Modal when moving prematurely to Verified Complete */}
      {gateFailureTask && (
        <div className="modal-overlay" onClick={() => setGateFailureTask(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={20} color="var(--status-blocked)" />
                <h2 className="modal-title">Verification Gate Failure: {gateFailureTask.taskId}</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setGateFailureTask(null)}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="alert alert-error" style={{ marginBottom: '16px' }}>
                <strong>Quality Standard Enforced:</strong> Task cannot transition to "Verified Complete" until all mandatory completion gates pass.
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
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
                className="btn btn-secondary"
                onClick={() => setGateFailureTask(null)}
              >
                Dismiss
              </button>
              <button
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
    </div>
  );
};
