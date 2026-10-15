import React, { useState, useEffect } from 'react';
import { History, Filter, Search } from 'lucide-react';
import { apiRequest } from '../api/client.js';

interface ActivityPageProps {
  onNavigateToTask: (taskId: string) => void;
  teamUsers?: any[];
}

export const ActivityPage: React.FC<ActivityPageProps> = ({ onNavigateToTask, teamUsers = [] }) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [actorFilter, setActorFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      const query = new URLSearchParams();
      if (actorFilter) query.set('actorId', actorFilter);
      if (sourceFilter) query.set('source', sourceFilter);
      query.set('limit', '50');

      const res = await apiRequest(`/api/activity?${query.toString()}`);
      setActivities(res.activities || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [actorFilter, sourceFilter]);

  const formatAction = (action: string) => {
    switch (action) {
      case 'task_created':
        return 'created task';
      case 'status_changed':
        return 'changed status to';
      case 'priority_changed':
        return 'updated priority to';
      case 'task_assigned':
        return 'assigned task';
      case 'acceptance_criteria_updated':
        return 'updated acceptance criterion';
      case 'changeset_linked':
        return 'linked UVCS changeset';
      case 'review_requested':
        return 'requested peer review for';
      case 'review_approved':
        return 'approved peer review for';
      case 'changes_requested':
        return 'requested changes on';
      case 'task_verified_complete':
        return 'verified and completed';
      case 'task_reopened':
        return 'reopened task';
      case 'evidence_uploaded':
        return 'uploaded verification evidence to';
      case 'test_report_submitted':
        return 'submitted test report for';
      default:
        return action.replace(/_/g, ' ');
    }
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h1>Terminal 6 // Auditable Activity Log</h1>
          <p>Chronological, immutable event audit log of all task updates, reviews, and test runs.</p>
        </div>
      </div>

      <div className="filter-bar">
        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '180px' }}
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
        >
          <option value="">All Actors / Developers</option>
          {teamUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.display_name || u.displayName}
            </option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '180px' }}
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="">All Event Sources</option>
          <option value="application">Application Manual Event</option>
          <option value="review">Peer Review Event</option>
          <option value="unity_test_runner">Unity Test Runner</option>
          <option value="uvcs">Unity Version Control</option>
        </select>

        {(actorFilter || sourceFilter) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setActorFilter('');
              setSourceFilter('');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="card">
        {activities.length === 0 ? (
          <div className="empty-state">
            <History size={32} />
            <h3>No Audit Activity Recorded</h3>
            <p>Application events will appear here chronologically as team members interact with Terminal 6.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activities.map((act, idx) => (
              <div
                key={act.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '16px',
                  padding: '14px 16px',
                  borderBottom: idx === activities.length - 1 ? 'none' : '1px solid var(--border-subtle)'
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-orange)',
                    marginTop: '6px',
                    flexShrink: 0
                  }}
                />

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13.5px', color: 'var(--text-white)' }}>
                    <strong>{act.actor_name || 'System / Webhook'}</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>{formatAction(act.action)}</span>{' '}
                    {act.related_task_id && (
                      <button
                        style={{
                          color: 'var(--accent-orange)',
                          fontWeight: 600,
                          fontFamily: 'var(--font-mono)',
                          textDecoration: 'underline'
                        }}
                        onClick={() => onNavigateToTask(act.related_task_id)}
                      >
                        {act.related_task_id}
                      </button>
                    )}
                    {act.new_value && !act.related_task_id && (
                      <span className="mono" style={{ color: 'var(--text-white)', fontWeight: 600 }}>
                        {' '}"{act.new_value}"
                      </span>
                    )}
                  </div>

                  {act.task_title && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {act.task_title}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
                    <span>{new Date(act.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <span>Source: {act.source}</span>
                    <span>•</span>
                    <span>Event ID: {act.id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
