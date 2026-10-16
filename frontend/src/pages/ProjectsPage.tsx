import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Flag,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Layers,
  ChevronRight,
  ShieldCheck,
  Activity,
  ArrowRight
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { Project, Milestone, Sprint } from '../types/index.js';
import { useToast } from '../context/ToastContext.js';

interface ProjectsPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({ onNavigate }) => {
  const { activeProjectId, setActiveProjectId, user } = useAuth();
  const toast = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal states
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);
  const [isSprintModalOpen, setIsSprintModalOpen] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneTarget, setNewMilestoneTarget] = useState('');
  const [newMilestoneReqs, setNewMilestoneReqs] = useState('');
  const [newSprintName, setNewSprintName] = useState('');
  const [newSprintGoal, setNewSprintGoal] = useState('');
  const [newSprintStart, setNewSprintStart] = useState('');
  const [newSprintEnd, setNewSprintEnd] = useState('');
  const [newSprintCapacity, setNewSprintCapacity] = useState('80');

  const fetchProjectData = async () => {
    setLoading(true);
    try {
      const [projRes, msRes, spRes, healthRes] = await Promise.all([
        apiRequest('/api/projects'),
        apiRequest(`/api/projects/${activeProjectId}/milestones`),
        apiRequest(`/api/projects/${activeProjectId}/sprints`),
        apiRequest(`/api/projects/${activeProjectId}/health`)
      ]);
      setProjects(projRes.projects || []);
      setMilestones(msRes.milestones || []);
      setSprints(spRes.sprints || []);
      setHealthData(healthRes);
    } catch (err: any) {
      toast.error(`Failed to load project data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [activeProjectId]);

  const activeProject = projects.find((p) => p.id === activeProjectId) || {
    id: activeProjectId,
    name: activeProjectId === 'blue-note-lounge' ? 'Blue Note Lounge' : 'Terminal 6',
    description:
      activeProjectId === 'blue-note-lounge'
        ? 'Noir mystery narrative game set in an evocative retro jazz lounge.'
        : 'Psychological horror game set around an abandoned, reality-shifting train station.',
    repository_id:
      activeProjectId === 'blue-note-lounge' ? 'BlueNote-Main@cindermarch' : 'Terminal6-Main@cindermarch',
    unity_version: '6000.0.25f1',
    status: 'active' as const,
    created_at: new Date().toISOString()
  };

  const handleCreateMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle || !newMilestoneTarget) {
      toast.error('Title and target date are required.');
      return;
    }
    try {
      await apiRequest(`/api/projects/${activeProjectId}/milestones`, {
        method: 'POST',
        body: JSON.stringify({
          title: newMilestoneTitle,
          target_date: newMilestoneTarget,
          completion_requirements: newMilestoneReqs,
          status: 'Planned'
        })
      });
      toast.success('Milestone created successfully.');
      setIsMilestoneModalOpen(false);
      setNewMilestoneTitle('');
      setNewMilestoneTarget('');
      setNewMilestoneReqs('');
      fetchProjectData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create milestone.');
    }
  };

  const handleCreateSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSprintName || !newSprintGoal || !newSprintStart || !newSprintEnd) {
      toast.error('All sprint fields are required.');
      return;
    }
    try {
      await apiRequest(`/api/projects/${activeProjectId}/sprints`, {
        method: 'POST',
        body: JSON.stringify({
          name: newSprintName,
          goal: newSprintGoal,
          start_date: newSprintStart,
          end_date: newSprintEnd,
          capacity_hours: Number(newSprintCapacity) || 80,
          status: 'Active'
        })
      });
      toast.success('Sprint created successfully.');
      setIsSprintModalOpen(false);
      setNewSprintName('');
      setNewSprintGoal('');
      setNewSprintStart('');
      setNewSprintEnd('');
      fetchProjectData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create sprint.');
    }
  };

  return (
    <div className="page-container">
      {/* Top Banner & Project Context Switcher */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Project HQ & Roadmaps</h1>
          <p className="page-subtitle">
            Authoritative production management, milestones, and sprint capacity across studio game titles.
          </p>
        </div>

        {/* Project Context Toggle */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn ${activeProjectId === 'terminal-6' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveProjectId('terminal-6')}
          >
            Terminal 6 (Horror)
          </button>
          <button
            type="button"
            className={`btn ${activeProjectId === 'blue-note-lounge' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveProjectId('blue-note-lounge')}
          >
            Blue Note Lounge (Noir)
          </button>
        </div>
      </div>

      {/* Project Meta Card */}
      <div
        className="card"
        style={{
          marginBottom: '24px',
          borderLeft: '4px solid var(--accent-orange)',
          background: 'linear-gradient(180deg, rgba(255, 94, 30, 0.04) 0%, var(--bg-surface) 100%)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-white)' }}>
                {activeProject.name}
              </h2>
              <span className="badge badge-primary">ACTIVE TITLE</span>
              <span className="badge badge-neutral">Unity {activeProject.unity_version || '6000.0.25f1'}</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '750px', fontSize: '13.5px', lineHeight: 1.5 }}>
              {activeProject.description}
            </p>
            <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>Repository: <strong style={{ color: 'var(--text-secondary)' }}>{activeProject.repository_id}</strong></span>
              <span>•</span>
              <span>Workspace: <strong style={{ color: 'var(--text-secondary)' }}>Cindermarch Studio</strong></span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigate('tasks', { filterProject: activeProjectId })}
            >
              View Project Tasks <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Project Health & Telemetry Grid */}
      {healthData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Health Status
              </span>
              <Activity size={18} color="var(--accent-orange)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  color:
                    healthData.health === 'healthy'
                      ? 'var(--status-green)'
                      : healthData.health === 'at_risk'
                      ? 'var(--accent-orange)'
                      : 'var(--status-red)'
                }}
              >
                {healthData.health.toUpperCase()}
              </span>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>({healthData.score}/100)</span>
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              {healthData.reasons?.[0] || 'Operational velocity steady.'}
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active QA Bugs
              </span>
              <AlertTriangle size={18} color="var(--status-amber)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-white)' }}>
                {healthData.metrics?.openBugs || 0}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--status-red)' }}>
                {healthData.metrics?.criticalBugs ? `${healthData.metrics.criticalBugs} Critical/Major` : 'Zero Critical'}
              </span>
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <button
                type="button"
                style={{ background: 'none', border: 'none', color: 'var(--accent-orange)', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                onClick={() => onNavigate('bugs', { projectId: activeProjectId })}
              >
                Inspect QA Lab & Bug Tracker →
              </button>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Task Velocity
              </span>
              <CheckCircle2 size={18} color="var(--status-green)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-white)' }}>
                {healthData.metrics?.completedTasks || 0} / {healthData.metrics?.totalTasks || 0}
              </span>
            </div>
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              {healthData.metrics?.overdueTasks ? (
                <span style={{ color: 'var(--status-red)' }}>{healthData.metrics.overdueTasks} task(s) overdue</span>
              ) : (
                <span style={{ color: 'var(--status-green)' }}>All active deadlines on track</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Two-Column Section: Milestones & Sprints */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Milestones Column */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flag size={18} color="var(--accent-orange)" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)' }}>Milestones Timeline</h3>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsMilestoneModalOpen(true)}
            >
              <Plus size={14} /> Add Milestone
            </button>
          </div>

          {milestones.length === 0 ? (
            <div className="empty-state">No milestones scheduled for this project.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {milestones.map((m) => (
                <div
                  key={m.id}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px',
                    transition: 'border-color var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-white)' }}>
                      {m.title}
                    </div>
                    <span
                      className={`badge ${
                        m.status === 'Completed'
                          ? 'badge-success'
                          : m.status === 'In Progress'
                          ? 'badge-primary'
                          : m.status === 'Blocked'
                          ? 'badge-danger'
                          : 'badge-neutral'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>

                  {m.description && (
                    <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      {m.description}
                    </p>
                  )}

                  {m.completion_requirements && (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '8px', padding: '6px 8px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)' }}>
                      <strong style={{ color: 'var(--text-secondary)' }}>Gates:</strong> {m.completion_requirements}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    <span>Target: <strong style={{ color: 'var(--text-secondary)' }}>{m.target_date.slice(0, 10)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sprints Column */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--accent-orange)" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)' }}>Production Sprints</h3>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsSprintModalOpen(true)}
            >
              <Plus size={14} /> Add Sprint
            </button>
          </div>

          {sprints.length === 0 ? (
            <div className="empty-state">No active sprints defined for this project.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sprints.map((s) => (
                <div
                  key={s.id}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-white)' }}>
                      {s.name}
                    </div>
                    <span className="badge badge-primary">{s.status}</span>
                  </div>

                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    Goal: {s.goal}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    <span>Cycle: {s.start_date.slice(0, 10)} to {s.end_date.slice(0, 10)}</span>
                    <span>•</span>
                    <span>Capacity: {s.capacity_hours} hrs</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Milestone */}
      {isMilestoneModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Schedule Project Milestone</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsMilestoneModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateMilestone}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Milestone Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. M1: Core Station Navigation & Physics"
                    value={newMilestoneTitle}
                    onChange={(e) => setNewMilestoneTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Target Delivery Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={newMilestoneTarget}
                    onChange={(e) => setNewMilestoneTarget(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Completion Requirements / Acceptance Gates</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="e.g. 60 FPS verified on baseline hardware, zero P0 bugs open, peer review complete"
                    value={newMilestoneReqs}
                    onChange={(e) => setNewMilestoneReqs(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsMilestoneModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Sprint */}
      {isSprintModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Start Production Sprint</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsSprintModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSprint}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Sprint Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Sprint 15: Spatial Occlusion & Dialogue Nodes"
                    value={newSprintName}
                    onChange={(e) => setNewSprintName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Sprint Goal</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Key objective for this sprint cycle"
                    value={newSprintGoal}
                    onChange={(e) => setNewSprintGoal(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Start Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newSprintStart}
                      onChange={(e) => setNewSprintStart(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="form-label">End Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={newSprintEnd}
                      onChange={(e) => setNewSprintEnd(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Capacity Estimate (Hours)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newSprintCapacity}
                    onChange={(e) => setNewSprintCapacity(e.target.value)}
                    min="1"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsSprintModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Launch Sprint
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
