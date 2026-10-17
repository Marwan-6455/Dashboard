import React, { useState, useEffect, useRef } from 'react';
import {
  CalendarCheck,
  Users,
  MessageSquare,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Filter,
  Search,
  Check,
  X,
  HelpCircle,
  RefreshCw,
  Send,
  Calendar,
  Layers,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { Standup, Meeting, Retrospective } from '../types/index.js';
import { useToast } from '../context/ToastContext.js';

export const MeetingsStandupsPage: React.FC = () => {
  const { user, activeProjectId } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'standups' | 'meetings' | 'retros'>('standups');
  const [standups, setStandups] = useState<Standup[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [retros, setRetros] = useState<Retrospective[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Standup Form State
  const [teamId, setTeamId] = useState('team_engine');
  const [completedYesterday, setCompletedYesterday] = useState('');
  const [plannedToday, setPlannedToday] = useState('');
  const [blockers, setBlockers] = useState('');
  const [helpNeeded, setHelpNeeded] = useState('');
  const [submittingStandup, setSubmittingStandup] = useState(false);

  // Standup Filters
  const [standupTeamFilter, setStandupTeamFilter] = useState('all');
  const [standupSearch, setStandupSearch] = useState('');

  // Meeting Form Modal
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingProject, setMeetingProject] = useState('terminal-6');
  const [meetingTeam, setMeetingTeam] = useState('team_engine');
  const [meetingParticipants, setMeetingParticipants] = useState('');
  const [meetingAgenda, setMeetingAgenda] = useState('');
  const [meetingNotes, setMeetingNotes] = useState('');
  const [meetingDecisions, setMeetingDecisions] = useState('');
  const [submittingMeeting, setSubmittingMeeting] = useState(false);
  const recordMeetingBtnRef = useRef<HTMLButtonElement>(null);

  // Retrospective Form Modal
  const [isRetroModalOpen, setIsRetroModalOpen] = useState(false);
  const [retroTitle, setRetroTitle] = useState('');
  const [retroPeriod, setRetroPeriod] = useState('');
  const [retroProject, setRetroProject] = useState('terminal-6');
  const [retroTeam, setRetroTeam] = useState('team_engine');
  const [whatWentWell, setWhatWentWell] = useState('');
  const [whatCausedProblems, setWhatCausedProblems] = useState('');
  const [whatShouldChange, setWhatShouldChange] = useState('');
  const [submittingRetro, setSubmittingRetro] = useState(false);
  const recordRetroBtnRef = useRef<HTMLButtonElement>(null);

  // Teams lookup
  const teamsList = [
    { id: 'team_engine', name: 'Engine Team' },
    { id: 'team_coding', name: 'Coding Team' },
    { id: 'team_sound', name: 'Sound Team' },
    { id: 'team_3d_artists', name: '3D Artists' },
    { id: 'team_story', name: 'Story Team' },
    { id: 'team_marketing', name: 'Marketing Team' }
  ];

  // Projects lookup
  const projectsList = [
    { id: 'terminal-6', name: 'Terminal 6 (Psychological Horror)' },
    { id: 'eclipsed', name: 'Eclipsed (2D Metroidvania)' }
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const [stdRes, mtgRes, retRes] = await Promise.all([
        apiRequest('/api/standups'),
        apiRequest('/api/meetings'),
        apiRequest('/api/retrospectives')
      ]);
      setStandups(stdRes.standups || []);
      setMeetings(mtgRes.meetings || []);
      setRetros(retRes.retrospectives || []);
    } catch (err: any) {
      toast.error(`Failed to load collaboration records: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Keyboard navigation for modals (Escape key closes)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isMeetingModalOpen) {
          setIsMeetingModalOpen(false);
          recordMeetingBtnRef.current?.focus();
        }
        if (isRetroModalOpen) {
          setIsRetroModalOpen(false);
          recordRetroBtnRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMeetingModalOpen, isRetroModalOpen]);

  // Set default participants when opening meeting modal
  useEffect(() => {
    if (isMeetingModalOpen && !meetingParticipants) {
      setMeetingParticipants(user?.displayName || 'Marwan Hossam, Yehia, Joe');
    }
    if (isMeetingModalOpen && !meetingDate) {
      const now = new Date();
      const isoStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setMeetingDate(isoStr);
    }
  }, [isMeetingModalOpen, user]);

  const handleSubmitStandup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completedYesterday.trim() || !plannedToday.trim()) {
      toast.error('Completed work and today\'s plan are required.');
      return;
    }

    setSubmittingStandup(true);
    try {
      await apiRequest('/api/standups', {
        method: 'POST',
        body: JSON.stringify({
          team_id: teamId,
          completed_yesterday: completedYesterday.trim(),
          planned_today: plannedToday.trim(),
          blockers: blockers.trim() || null,
          help_needed: helpNeeded.trim() || null
        })
      });

      toast.success('Daily standup recorded successfully.');
      // Clear inputs only on success
      setCompletedYesterday('');
      setPlannedToday('');
      setBlockers('');
      setHelpNeeded('');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit standup.');
    } finally {
      setSubmittingStandup(false);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingTitle.trim() || !meetingDate || !meetingAgenda.trim() || !meetingNotes.trim()) {
      toast.error('Meeting title, date, agenda, and notes are required.');
      return;
    }

    setSubmittingMeeting(true);
    try {
      const participantsArray = meetingParticipants
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);

      await apiRequest('/api/meetings', {
        method: 'POST',
        body: JSON.stringify({
          title: meetingTitle.trim(),
          date: meetingDate,
          project_id: meetingProject || null,
          team_id: meetingTeam || null,
          participants_json: JSON.stringify(participantsArray.length > 0 ? participantsArray : [user?.displayName || 'Marwan Hossam']),
          agenda: meetingAgenda.trim(),
          notes: meetingNotes.trim(),
          decisions: meetingDecisions.trim() || null
        })
      });

      toast.success('Meeting notes and decisions recorded.');
      setIsMeetingModalOpen(false);
      setMeetingTitle('');
      setMeetingDate('');
      setMeetingAgenda('');
      setMeetingNotes('');
      setMeetingDecisions('');
      setMeetingParticipants('');
      recordMeetingBtnRef.current?.focus();
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save meeting.');
    } finally {
      setSubmittingMeeting(false);
    }
  };

  const handleCreateRetro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retroTitle.trim() || !retroPeriod.trim() || !whatWentWell.trim() || !whatCausedProblems.trim() || !whatShouldChange.trim()) {
      toast.error('All retrospective evaluation sections are required.');
      return;
    }

    setSubmittingRetro(true);
    try {
      await apiRequest('/api/retrospectives', {
        method: 'POST',
        body: JSON.stringify({
          title: retroTitle.trim(),
          period: retroPeriod.trim(),
          project_id: retroProject || null,
          team_id: retroTeam || null,
          what_went_well: whatWentWell.trim(),
          what_caused_problems: whatCausedProblems.trim(),
          what_should_change: whatShouldChange.trim()
        })
      });

      toast.success('Sprint retrospective recorded successfully.');
      setIsRetroModalOpen(false);
      setRetroTitle('');
      setRetroPeriod('');
      setWhatWentWell('');
      setWhatCausedProblems('');
      setWhatShouldChange('');
      recordRetroBtnRef.current?.focus();
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save retrospective.');
    } finally {
      setSubmittingRetro(false);
    }
  };

  // Filter standups
  const filteredStandups = standups.filter(s => {
    if (standupTeamFilter !== 'all' && s.team_id !== standupTeamFilter) {
      return false;
    }
    if (standupSearch.trim()) {
      const q = standupSearch.toLowerCase();
      const matchText = (s.completed_yesterday || '') + ' ' + (s.planned_today || '') + ' ' + (s.blockers || '') + ' ' + (s.user_name || '');
      if (!matchText.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="page-wrapper" style={{ paddingBottom: '30px' }}>
      {/* 1. Header */}
      <div className="page-header" style={{ marginBottom: '22px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Daily Standups & Collaboration Center</h1>
            <span className="badge badge-verified-complete" style={{ fontSize: '10px' }}>
              ● Synced
            </span>
          </div>
          <p className="page-subtitle" style={{ marginTop: '4px' }}>
            Synchronous & asynchronous developer standups, meeting notes, action items, and sprint retrospectives.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {activeTab === 'meetings' && (
            <button
              ref={recordMeetingBtnRef}
              type="button"
              className="btn btn-primary"
              onClick={() => setIsMeetingModalOpen(true)}
            >
              <Plus size={15} /> Record Meeting
            </button>
          )}

          {activeTab === 'retros' && (
            <button
              ref={recordRetroBtnRef}
              type="button"
              className="btn btn-primary"
              onClick={() => setIsRetroModalOpen(true)}
            >
              <Plus size={15} /> Log Retrospective
            </button>
          )}

          {activeTab === 'standups' && (
            <button
              ref={recordMeetingBtnRef}
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsMeetingModalOpen(true)}
              title="Record a team meeting"
            >
              <Users size={14} /> Record Meeting
            </button>
          )}
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="segmented-control" style={{ marginBottom: '24px', maxWidth: '640px' }}>
        <button
          type="button"
          className={`segmented-btn ${activeTab === 'standups' ? 'active' : ''}`}
          onClick={() => setActiveTab('standups')}
        >
          <CalendarCheck size={15} />
          <span>Daily Standups</span>
          <span className="badge" style={{ fontSize: '10px', padding: '1px 6px', backgroundColor: activeTab === 'standups' ? 'rgba(0,0,0,0.3)' : 'var(--bg-canvas)' }}>
            {standups.length}
          </span>
        </button>

        <button
          type="button"
          className={`segmented-btn ${activeTab === 'meetings' ? 'active' : ''}`}
          onClick={() => setActiveTab('meetings')}
        >
          <Users size={15} />
          <span>Team Meetings</span>
          <span className="badge" style={{ fontSize: '10px', padding: '1px 6px', backgroundColor: activeTab === 'meetings' ? 'rgba(0,0,0,0.3)' : 'var(--bg-canvas)' }}>
            {meetings.length}
          </span>
        </button>

        <button
          type="button"
          className={`segmented-btn ${activeTab === 'retros' ? 'active' : ''}`}
          onClick={() => setActiveTab('retros')}
        >
          <Sparkles size={15} />
          <span>Sprint Retrospectives</span>
          <span className="badge" style={{ fontSize: '10px', padding: '1px 6px', backgroundColor: activeTab === 'retros' ? 'rgba(0,0,0,0.3)' : 'var(--bg-canvas)' }}>
            {retros.length}
          </span>
        </button>
      </div>

      {/* 3. TAB: DAILY STANDUPS */}
      {activeTab === 'standups' && (
        <div className="standup-layout">
          {/* Left Column: Standup Submission Panel */}
          <div className="standup-submission-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--accent-orange-dim)',
                  border: '1px solid var(--accent-orange-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-orange)'
                }}
              >
                <CalendarCheck size={16} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', margin: 0 }}>
                  Log Today's Standup
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  Synchronize daily work, goals, and team blockers.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitStandup}>
              <div className="form-group">
                <label className="form-label">Team Context</label>
                <select
                  className="form-input"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  disabled={submittingStandup}
                >
                  {teamsList.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--status-complete)' }}>●</span> Completed Since Yesterday
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="What deliverables, code changes, or assets were finished or verified?"
                  value={completedYesterday}
                  onChange={(e) => setCompletedYesterday(e.target.value)}
                  disabled={submittingStandup}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--accent-orange)' }}>●</span> Planned For Today
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Primary milestones, task tickets, or systems targeted today..."
                  value={plannedToday}
                  onChange={(e) => setPlannedToday(e.target.value)}
                  disabled={submittingStandup}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--status-red)' }}>▲</span> Active Blockers (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Dependencies, missing assets, broken builds, or test failures..."
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  disabled={submittingStandup}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--status-review)' }}>●</span> Help Needed (Optional)
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Assistance requested from specific leads or developers..."
                  value={helpNeeded}
                  onChange={(e) => setHelpNeeded(e.target.value)}
                  disabled={submittingStandup}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingStandup || !completedYesterday.trim() || !plannedToday.trim()}
                style={{ width: '100%', height: '42px', justifyContent: 'center', marginTop: '6px' }}
              >
                {submittingStandup ? (
                  <>
                    <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Recording Standup...</span>
                  </>
                ) : (
                  <>
                    <Send size={15} />
                    <span>Post Daily Standup</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Standup History / Feed */}
          <div>
            {/* Filter Bar */}
            <div className="collaboration-filter-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
                <Search size={14} color="var(--text-muted)" />
                <input
                  type="text"
                  className="form-input"
                  style={{ padding: '6px 10px', height: '34px', fontSize: '12px' }}
                  placeholder="Filter standups by keyword, task, developer..."
                  value={standupSearch}
                  onChange={(e) => setStandupSearch(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={14} color="var(--accent-orange)" />
                <select
                  className="form-input"
                  style={{ padding: '6px 12px', height: '34px', fontSize: '12px', width: 'auto', minWidth: '150px' }}
                  value={standupTeamFilter}
                  onChange={(e) => setStandupTeamFilter(e.target.value)}
                >
                  <option value="all">All Departments ({standups.length})</option>
                  {teamsList.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                {(standupTeamFilter !== 'all' || standupSearch) && (
                  <button
                    type="button"
                    onClick={() => { setStandupTeamFilter('all'); setStandupSearch(''); }}
                    className="btn btn-secondary btn-sm"
                    style={{ height: '34px', fontSize: '11.5px' }}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Standup Updates Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredStandups.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '48px 24px', backgroundColor: 'var(--bg-surface)' }}>
                  <CalendarCheck size={40} color="var(--accent-orange)" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-white)', margin: '0 0 6px' }}>
                    No Standup Updates Found
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto' }}>
                    {standupTeamFilter !== 'all' || standupSearch
                      ? 'No standup submissions match the active filter criteria. Try clearing your search.'
                      : 'No developer standups have been recorded yet for today. Use the left panel to log your update.'}
                  </p>
                </div>
              ) : (
                filteredStandups.map((s) => (
                  <div key={s.id} className="standup-feed-card">
                    {/* Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '13px' }}>
                          {s.user_name?.slice(0, 1).toUpperCase() || 'D'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ color: 'var(--text-white)', fontSize: '13.5px' }}>
                              {s.user_name || 'Developer'}
                            </strong>
                            <span
                              className="badge"
                              style={{
                                backgroundColor: 'var(--bg-elevated)',
                                border: '1px solid var(--border-strong)',
                                color: 'var(--accent-orange)',
                                fontSize: '10.5px'
                              }}
                            >
                              {s.team_name || s.team_id}
                            </span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Logged: {s.date}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11px' }}>
                        <Clock size={12} />
                        <span>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* Content Section: Completed */}
                    <div style={{ marginBottom: '10px', fontSize: '13px', lineHeight: 1.6 }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-complete)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <CheckCircle2 size={13} color="var(--status-complete)" /> Completed Yesterday
                      </div>
                      <div style={{ color: 'var(--text-secondary)', paddingLeft: '18px' }}>
                        {s.completed_yesterday}
                      </div>
                    </div>

                    {/* Content Section: Planned */}
                    <div style={{ marginBottom: '10px', fontSize: '13px', lineHeight: 1.6 }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-orange)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <ArrowRight size={13} color="var(--accent-orange)" /> Planned For Today
                      </div>
                      <div style={{ color: 'var(--text-white)', paddingLeft: '18px' }}>
                        {s.planned_today}
                      </div>
                    </div>

                    {/* Blockers Alert Box */}
                    {s.blockers && s.blockers !== 'None.' && (
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '10px 14px',
                          backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '12.5px',
                          color: 'var(--status-red)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px'
                        }}
                      >
                        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong>Active Blocker:</strong> {s.blockers}
                        </div>
                      </div>
                    )}

                    {/* Help Needed Box */}
                    {s.help_needed && s.help_needed !== 'None.' && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '10px 14px',
                          backgroundColor: 'rgba(245, 158, 11, 0.08)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '12.5px',
                          color: '#F59E0B',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px'
                        }}
                      >
                        <HelpCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong>Help Requested:</strong> {s.help_needed}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB: TEAM MEETINGS */}
      {activeTab === 'meetings' && (
        <div>
          {meetings.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '56px 24px', backgroundColor: 'var(--bg-surface)' }}>
              <Users size={44} color="var(--accent-orange)" style={{ margin: '0 auto 14px', opacity: 0.8 }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)', margin: '0 0 6px' }}>
                No Recorded Meetings Yet
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                Maintain structured syncs between Engine, Sound, Coding, and Art departments with trackable agendas, decisions, and action items.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsMeetingModalOpen(true)}
              >
                <Plus size={15} /> Record First Meeting
              </button>
            </div>
          ) : (
            <div className="collaboration-card-grid">
              {meetings.map((m) => {
                let parsedParticipants: string[] = [];
                try {
                  parsedParticipants = JSON.parse(m.participants_json || '[]');
                } catch {
                  parsedParticipants = [m.participants_json];
                }

                return (
                  <div key={m.id} className="standup-feed-card">
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-white)', margin: 0 }}>
                            {m.title}
                          </h3>
                          {m.project_name && (
                            <span className="badge badge-primary" style={{ fontSize: '10.5px' }}>
                              {m.project_name}
                            </span>
                          )}
                          {m.team_name && (
                            <span className="badge" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', fontSize: '10.5px' }}>
                              {m.team_name}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Organized by {m.creator_name || 'Studio Lead'}
                        </div>
                      </div>

                      <div className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', padding: '4px 10px' }}>
                        <Calendar size={13} color="var(--accent-orange)" />
                        <span>{new Date(m.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </div>
                    </div>

                    {/* Participants */}
                    <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        Participants:
                      </span>
                      {parsedParticipants.map((p, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '11.5px',
                            color: 'var(--text-secondary)',
                            backgroundColor: 'var(--bg-elevated)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>

                    {/* Agenda */}
                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-orange)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                        Meeting Agenda
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-canvas)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                        {m.agenda}
                      </div>
                    </div>

                    {/* Decisions & Notes */}
                    {m.decisions && (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-complete)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle2 size={13} color="var(--status-complete)" /> Agreed Decisions
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--text-white)', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                          {m.decisions}
                        </div>
                      </div>
                    )}

                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-white)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                        Notes & Action Items
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6, paddingLeft: '4px' }}>
                        {m.notes}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB: SPRINT RETROSPECTIVES */}
      {activeTab === 'retros' && (
        <div>
          {retros.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '56px 24px', backgroundColor: 'var(--bg-surface)' }}>
              <Sparkles size={44} color="var(--accent-orange)" style={{ margin: '0 auto 14px', opacity: 0.8 }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)', margin: '0 0 6px' }}>
                No Retrospectives Logged Yet
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.5 }}>
                Capture sprint insights, problem root causes, and concrete commitments to continuously elevate production quality.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsRetroModalOpen(true)}
              >
                <Plus size={15} /> Log First Retrospective
              </button>
            </div>
          ) : (
            <div className="collaboration-card-grid">
              {retros.map((r) => (
                <div key={r.id} className="standup-feed-card">
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-white)', margin: '0 0 4px' }}>
                        {r.title}
                      </h3>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        Facilitated by {r.facilitator_name || 'Studio Lead'}
                      </div>
                    </div>

                    <span className="badge badge-primary" style={{ fontSize: '11.5px', padding: '4px 10px' }}>
                      {r.period}
                    </span>
                  </div>

                  {/* 3-Column Structured Grid */}
                  <div className="retro-three-col">
                    {/* 1. What Went Well */}
                    <div style={{ backgroundColor: 'var(--bg-canvas)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--status-complete)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={15} color="var(--status-complete)" /> What Went Well
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {r.what_went_well}
                      </div>
                    </div>

                    {/* 2. What Caused Problems */}
                    <div style={{ backgroundColor: 'var(--bg-canvas)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--status-red)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <AlertTriangle size={15} color="var(--status-red)" /> What Caused Problems
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {r.what_caused_problems}
                      </div>
                    </div>

                    {/* 3. Actions Agreed Upon */}
                    <div style={{ backgroundColor: 'var(--bg-canvas)', border: '1px solid var(--accent-orange-border)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--accent-orange)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={15} color="var(--accent-orange)" /> Agreed Action Items
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-white)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {r.what_should_change}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. MODAL: RECORD MEETING */}
      {isMeetingModalOpen && (
        <div className="modal-overlay" onClick={() => setIsMeetingModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '600px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="meeting-modal-title"
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} color="var(--accent-orange)" />
                <h3 id="meeting-modal-title" className="modal-title">Record Meeting Notes</h3>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsMeetingModalOpen(false)}
                title="Close dialog (Escape)"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateMeeting}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '72vh' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Meeting Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Weekly Engine & Sound Occlusion Sync"
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Date & Time</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Department / Team Scope</label>
                    <select
                      className="form-input"
                      value={meetingTeam}
                      onChange={(e) => setMeetingTeam(e.target.value)}
                    >
                      {teamsList.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Participants (comma separated)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Marwan Hossam, Yehia, Joe..."
                    value={meetingParticipants}
                    onChange={(e) => setMeetingParticipants(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Agenda Topics</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="1. Spatial portal occlusion drop in sub-level tunnel&#10;2. Frame pacing baseline on GTX 1060&#10;3. Review UTF test results"
                    value={meetingAgenda}
                    onChange={(e) => setMeetingAgenda(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Agreed Decisions (Optional)</label>
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Agreed technical approach, architecture decisions, trade-offs accepted..."
                    value={meetingDecisions}
                    onChange={(e) => setMeetingDecisions(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Meeting Notes & Action Items</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    placeholder="Detailed sync notes and assigned deliverables:&#10;- Marwan: Profile corridor frametime by Friday&#10;- Yehia: Verify steam train reverberation curve"
                    value={meetingNotes}
                    onChange={(e) => setMeetingNotes(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsMeetingModalOpen(false)}
                  disabled={submittingMeeting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingMeeting || !meetingTitle.trim() || !meetingDate}
                >
                  {submittingMeeting ? (
                    <>
                      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Saving Meeting...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Save Meeting</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: LOG RETROSPECTIVE */}
      {isRetroModalOpen && (
        <div className="modal-overlay" onClick={() => setIsRetroModalOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: '620px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="retro-modal-title"
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--accent-orange)" />
                <h3 id="retro-modal-title" className="modal-title">Log Sprint Retrospective</h3>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setIsRetroModalOpen(false)}
                title="Close dialog (Escape)"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRetro}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '72vh' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Retrospective Title</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Sprint 14: Sub-level Occlusion & AI Pathing Retrospective"
                    value={retroTitle}
                    onChange={(e) => setRetroTitle(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Sprint / Period</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Sprint 14 (Oct 10 – Oct 24, 2026)"
                      value={retroPeriod}
                      onChange={(e) => setRetroPeriod(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Team Context</label>
                    <select
                      className="form-input"
                      value={retroTeam}
                      onChange={(e) => setRetroTeam(e.target.value)}
                    >
                      {teamsList.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={13} color="var(--status-complete)" /> What Went Well
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Wins, successful technical deliveries, high-velocity workflows..."
                    value={whatWentWell}
                    onChange={(e) => setWhatWentWell(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={13} color="var(--status-red)" /> What Caused Problems
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Bottlenecks, unexpected bugs, dependencies, missed deadlines..."
                    value={whatCausedProblems}
                    onChange={(e) => setWhatCausedProblems(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={13} color="var(--accent-orange)" /> Agreed Action Items & Changes
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Concrete adjustments, responsible owners, and standards to enforce next sprint..."
                    value={whatShouldChange}
                    onChange={(e) => setWhatShouldChange(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRetroModalOpen(false)}
                  disabled={submittingRetro}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingRetro || !retroTitle.trim() || !retroPeriod.trim()}
                >
                  {submittingRetro ? (
                    <>
                      <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                      <span>Saving Retrospective...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Save Retrospective</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
