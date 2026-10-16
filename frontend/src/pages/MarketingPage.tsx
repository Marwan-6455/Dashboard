import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Calendar,
  Share2,
  CheckCircle2,
  Clock,
  Plus,
  ExternalLink,
  Filter,
  Layers,
  Sparkles,
  Youtube,
  Globe,
  FileText,
  List,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Tag,
  User,
  Check
} from 'lucide-react';
import { apiRequest } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { MarketingItem, MarketingChannel, MarketingStatus } from '../types/index.js';
import { useToast } from '../context/ToastContext.js';

export const MarketingPage: React.FC = () => {
  const { activeProjectId } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<MarketingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [activeView, setActiveView] = useState<'board' | 'list' | 'calendar'>('board');

  // Calendar State
  const [currentCalendarDate, setCurrentCalendarDate] = useState<Date>(new Date(2026, 10, 1)); // November 2026

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [campaign, setCampaign] = useState('');
  const [channel, setChannel] = useState<MarketingChannel>('Steam');
  const [title, setTitle] = useState('');
  const [copy, setCopy] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [status, setStatus] = useState<MarketingStatus>('Idea');

  const fetchItems = async () => {
    setLoading(true);
    try {
      let query = `/api/marketing?projectId=${activeProjectId}`;
      if (selectedChannel !== 'all') query += `&channel=${selectedChannel}`;
      if (selectedStatus !== 'all') query += `&status=${selectedStatus}`;

      const res = await apiRequest(query);
      setItems(res.items || []);
    } catch (err: any) {
      toast.error('Failed to load marketing deliverables: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [activeProjectId, selectedChannel, selectedStatus]);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !copy.trim() || !campaign.trim()) {
      toast.error('Please enter campaign name, title, and copy.');
      return;
    }

    try {
      await apiRequest('/api/marketing', {
        method: 'POST',
        body: JSON.stringify({
          project_id: activeProjectId,
          campaign,
          channel,
          title,
          copy,
          scheduled_date: scheduledDate || null,
          status,
          deliverables: deliverables || null,
          external_url: externalUrl || null
        })
      });

      toast.success('Marketing deliverable registered successfully.');
      setIsModalOpen(false);
      resetForm();
      fetchItems();
    } catch (err: any) {
      toast.error('Failed to create marketing item: ' + err.message);
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: MarketingStatus) => {
    try {
      await apiRequest(`/api/marketing/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      toast.success(`Deliverable status updated to ${newStatus}`);
      fetchItems();
    } catch (err: any) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  const resetForm = () => {
    setTitle('');
    setCopy('');
    setCampaign('');
    setDeliverables('');
    setExternalUrl('');
    setScheduledDate('');
    setStatus('Idea');
    setChannel('Steam');
  };

  const channels: MarketingChannel[] = ['Steam', 'Discord', 'YouTube', 'Twitter/X', 'Press', 'Reddit', 'TikTok'];
  const statuses: MarketingStatus[] = ['Idea', 'Draft', 'Review', 'Approved', 'Scheduled', 'Published'];

  const campaigns = Array.from(new Set(items.map(i => i.campaign))).filter(Boolean);

  const filteredItems = items.filter(item => {
    if (selectedCampaign !== 'all' && item.campaign !== selectedCampaign) return false;
    return true;
  });

  const getChannelIcon = (ch: MarketingChannel) => {
    switch (ch) {
      case 'YouTube':
        return <Youtube size={14} color="#EF4444" />;
      case 'Steam':
        return <Globe size={14} color="#38BDF8" />;
      case 'Discord':
        return <Share2 size={14} color="#818CF8" />;
      case 'Twitter/X':
        return <Share2 size={14} color="#38BDF8" />;
      default:
        return <Megaphone size={14} color="var(--accent-orange)" />;
    }
  };

  const getStatusBadge = (st: MarketingStatus) => {
    switch (st) {
      case 'Published':
        return <span className="badge badge-verified-complete">Published</span>;
      case 'Approved':
        return <span className="badge badge-ready-to-integrate">Approved</span>;
      case 'Scheduled':
        return <span className="badge badge-in-progress">Scheduled</span>;
      case 'Review':
        return <span className="badge badge-ready-for-review">In Review</span>;
      case 'Draft':
        return <span className="badge badge-changes-requested">Draft</span>;
      default:
        return <span className="badge badge-backlog">Idea</span>;
    }
  };

  const formatDateDisplay = (dateStr?: string | null) => {
    if (!dateStr) return 'Unscheduled';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Calendar Helpers
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  const monthName = currentCalendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const calendarDays = [];
  // Prev month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarDays.push({
      day: prevMonthDays - i,
      month: month - 1,
      isCurrentMonth: false,
      dateString: `${year}-${String(month).padStart(2, '0')}-${String(prevMonthDays - i).padStart(2, '0')}`
    });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarDays.push({
      day: i,
      month: month,
      isCurrentMonth: true,
      dateString: dStr
    });
  }
  // Next month padding to fill 35 or 42
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    calendarDays.push({
      day: i,
      month: month + 1,
      isCurrentMonth: false,
      dateString: `${year}-${String(month + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    });
  }

  const prevMonth = () => {
    setCurrentCalendarDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentCalendarDate(new Date(year, month + 1, 1));
  };
  const resetToCurrent = () => {
    setCurrentCalendarDate(new Date());
  };

  return (
    <div className="page-wrapper">
      {/* 3.1 Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span
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
              <Megaphone size={18} />
            </span>
            <h1 className="page-title">Marketing & Release Calendar</h1>
            <span
              className="badge"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                color: 'var(--accent-orange)'
              }}
            >
              {activeProjectId === 'terminal-6'
                ? 'TERMINAL 6'
                : activeProjectId === 'blue-note-lounge'
                ? 'BLUE NOTE LOUNGE'
                : 'STUDIO-WIDE'}
            </span>
          </div>
          <p className="page-subtitle">
            Private marketing workspace: Campaign management, store deliverables, trailer schedules, and press beats.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Segmented View Switcher */}
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-btn ${activeView === 'board' ? 'active' : ''}`}
              onClick={() => setActiveView('board')}
            >
              <Layers size={14} /> Pipeline
            </button>
            <button
              type="button"
              className={`segmented-btn ${activeView === 'list' ? 'active' : ''}`}
              onClick={() => setActiveView('list')}
            >
              <List size={14} /> List View
            </button>
            <button
              type="button"
              className={`segmented-btn ${activeView === 'calendar' ? 'active' : ''}`}
              onClick={() => setActiveView('calendar')}
            >
              <Calendar size={14} /> Calendar
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary"
          >
            <Plus size={15} /> New Deliverable
          </button>
        </div>
      </div>

      {/* 3.2 Summary Metric Cards */}
      <div className="marketing-grid">
        <div className="metric-card accent-orange">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="metric-label">Total Deliverables</span>
            <Megaphone size={16} color="var(--accent-orange)" />
          </div>
          <div className="metric-value">{items.length}</div>
          <div className="metric-sub">Across all studio campaigns</div>
        </div>

        <div className="metric-card accent-amber">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="metric-label">In Review / Approval</span>
            <CheckCircle2 size={16} color="var(--status-review)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--status-review)' }}>
            {items.filter(i => i.status === 'Review' || i.status === 'Approved').length}
          </div>
          <div className="metric-sub">Creative sign-off required</div>
        </div>

        <div className="metric-card accent-blue">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="metric-label">Scheduled Ahead</span>
            <Calendar size={16} color="var(--status-progress)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--status-progress)' }}>
            {items.filter(i => i.status === 'Scheduled').length}
          </div>
          <div className="metric-sub">Target delivery dates set</div>
        </div>

        <div className="metric-card accent-green">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="metric-label">Live & Published</span>
            <Globe size={16} color="var(--status-complete)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--status-complete)' }}>
            {items.filter(i => i.status === 'Published').length}
          </div>
          <div className="metric-sub">Verified external releases</div>
        </div>
      </div>

      {/* 3.4 Filter Toolbar */}
      <div className="filter-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '12px' }}>
          <Filter size={14} color="var(--accent-orange)" />
          <span>Filters:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Channel</span>
          <select
            value={selectedChannel}
            onChange={e => setSelectedChannel(e.target.value)}
            className="form-control"
            style={{ width: 'auto', padding: '6px 30px 6px 10px', fontSize: '12px' }}
          >
            <option value="all">All Channels</option>
            {channels.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</span>
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="form-control"
            style={{ width: 'auto', padding: '6px 30px 6px 10px', fontSize: '12px' }}
          >
            <option value="all">All Statuses</option>
            {statuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {campaigns.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Campaign</span>
            <select
              value={selectedCampaign}
              onChange={e => setSelectedCampaign(e.target.value)}
              className="form-control"
              style={{ width: 'auto', padding: '6px 30px 6px 10px', fontSize: '12px' }}
            >
              <option value="all">All Campaigns</option>
              {campaigns.map(cp => (
                <option key={cp} value={cp}>{cp}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
          Showing <strong style={{ color: 'var(--text-white)' }}>{filteredItems.length}</strong> deliverable{filteredItems.length === 1 ? '' : 's'}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>
          <Clock size={24} color="var(--accent-orange)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <div>Synchronizing marketing calendar and production deliverables...</div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card empty-state">
          <Megaphone size={36} />
          <h3>No Marketing Deliverables Found</h3>
          <p>
            No active marketing beats or campaign items match your selected filters. Create a new campaign item to schedule store updates, teaser reveals, or social drops.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary"
          >
            <Plus size={14} /> Create First Deliverable
          </button>
        </div>
      ) : activeView === 'board' ? (
        /* 3.3.A Pipeline / Kanban View */
        <div className="marketing-pipeline">
          {statuses.map(st => {
            const colItems = filteredItems.filter(i => i.status === st);
            return (
              <div
                key={st}
                className="kanban-column"
                style={{ width: 'auto', minWidth: '250px' }}
              >
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span>{st}</span>
                  </div>
                  <span className="kanban-count">{colItems.length}</span>
                </div>

                <div className="kanban-cards">
                  {colItems.map(item => (
                    <div key={item.id} className="deliverable-card">
                      <div className="deliverable-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {getChannelIcon(item.channel)}
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-white)' }}>
                            {item.channel}
                          </span>
                        </div>
                        {getStatusBadge(item.status)}
                      </div>

                      <div style={{ fontSize: '10.5px', color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>
                        {item.campaign}
                      </div>

                      <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-white)', lineHeight: 1.35 }}>
                        {item.title}
                      </h4>

                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.45, maxHeight: '60px', overflow: 'hidden' }}>
                        {item.copy}
                      </p>

                      <div className="deliverable-meta-row">
                        <Calendar size={13} color="var(--accent-orange)" />
                        <span>{formatDateDisplay(item.scheduled_date)}</span>
                      </div>

                      {item.external_url && (
                        <a
                          href={item.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '11px',
                            color: 'var(--status-progress)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            textDecoration: 'none'
                          }}
                        >
                          <ExternalLink size={12} /> Publication Link
                        </a>
                      )}

                      {/* Footer Actions */}
                      <div className="deliverable-footer">
                        <span style={{ color: 'var(--text-muted)' }}>{item.owner_name || 'Marketing Lead'}</span>

                        {item.status === 'Idea' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.id, 'Draft')}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                          >
                            To Draft →
                          </button>
                        )}
                        {item.status === 'Draft' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.id, 'Review')}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11px', borderColor: 'var(--status-review)', color: 'var(--status-review)' }}
                          >
                            Submit Review →
                          </button>
                        )}
                        {item.status === 'Review' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.id, 'Approved')}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11px', borderColor: 'var(--status-integrate)', color: 'var(--status-integrate)' }}
                          >
                            Approve ✓
                          </button>
                        )}
                        {item.status === 'Approved' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.id, 'Scheduled')}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11px', borderColor: 'var(--status-progress)', color: 'var(--status-progress)' }}
                          >
                            Schedule 🗓
                          </button>
                        )}
                        {item.status === 'Scheduled' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.id, 'Published')}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                          >
                            Mark Live 🚀
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {colItems.length === 0 && (
                    <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '11.5px' }}>
                      No items in {st}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : activeView === 'list' ? (
        /* 3.3.B List View */
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Campaign & Title</th>
                <th>Channel</th>
                <th>Target Date</th>
                <th>Deliverables</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Workflow Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-white)' }}>{item.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>{item.campaign}</span>
                      <span>•</span>
                      <span>Owner: {item.owner_name || 'Marketing'}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '480px' }}>
                      {item.copy}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      {getChannelIcon(item.channel)}
                      <span>{item.channel}</span>
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatDateDisplay(item.scheduled_date)}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {item.deliverables || 'Standard release copy & media pack'}
                  </td>
                  <td>{getStatusBadge(item.status)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      {item.external_url && (
                        <a
                          href={item.external_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          title="Open Live Post"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <select
                        value={item.status}
                        onChange={e => handleStatusChange(item.id, e.target.value as MarketingStatus)}
                        className="form-control"
                        style={{ width: 'auto', padding: '4px 26px 4px 8px', fontSize: '11.5px' }}
                      >
                        {statuses.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* 3.3.C Interactive Calendar View */
        <div className="calendar-view-container">
          <div className="calendar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-white)' }}>
                {monthName}
              </h3>
              <button
                type="button"
                onClick={resetToCurrent}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '11px' }}
              >
                Today
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={prevMonth}
                className="btn btn-secondary btn-sm"
                title="Previous Month"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="btn btn-secondary btn-sm"
                title="Next Month"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="calendar-grid">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="calendar-day-header">{d}</div>
            ))}

            {calendarDays.map((cd, idx) => {
              const dayItems = filteredItems.filter(i => {
                if (!i.scheduled_date) return false;
                return i.scheduled_date.startsWith(cd.dateString);
              });
              const isToday = new Date().toISOString().startsWith(cd.dateString);

              return (
                <div
                  key={idx}
                  className={`calendar-day-cell ${!cd.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`}
                >
                  <span className="calendar-day-number">{cd.day}</span>

                  {dayItems.map(item => (
                    <div
                      key={item.id}
                      className="calendar-item-pill"
                      title={`${item.title} (${item.channel}) - ${item.status}`}
                    >
                      {getChannelIcon(item.channel)}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3.5 New Deliverable Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Megaphone size={18} color="var(--accent-orange)" />
                <h3 className="modal-title">New Marketing Deliverable</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn-icon"
                style={{ color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateItem}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Campaign Name</label>
                    <input
                      type="text"
                      required
                      value={campaign}
                      onChange={e => setCampaign(e.target.value)}
                      placeholder="e.g. Steam Wishlist Push, Teaser Drop"
                      className="form-control"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Marketing Channel</label>
                    <select
                      value={channel}
                      onChange={e => setChannel(e.target.value as MarketingChannel)}
                      className="form-control"
                    >
                      {channels.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Deliverable Title / Headline</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Terminal 6 Gameplay Teaser Reveal"
                    className="form-control"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Draft Copy / Content Text</label>
                  <textarea
                    required
                    rows={4}
                    value={copy}
                    onChange={e => setCopy(e.target.value)}
                    placeholder="Enter full draft post copy, calls to action, tags..."
                    className="form-control"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Target Scheduled Date</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                      className="form-control"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Workflow Status</label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as MarketingStatus)}
                      className="form-control"
                    >
                      {statuses.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Deliverables & Asset Pack</label>
                  <input
                    type="text"
                    value={deliverables}
                    onChange={e => setDeliverables(e.target.value)}
                    placeholder="e.g. 1080p60 cut, vertical reels, Steam capsule assets"
                    className="form-control"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">External / Published URL (Optional)</label>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={e => setExternalUrl(e.target.value)}
                    placeholder="https://..."
                    className="form-control"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Deliverable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
