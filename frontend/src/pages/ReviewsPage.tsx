import React, { useState, useEffect, useMemo } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Search,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  GitCommit,
  CheckSquare
} from 'lucide-react';
import { Review, ReviewDecision } from '../types/index.js';
import { ReviewModal } from '../components/ReviewModal.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';
import { useToast } from '../context/ToastContext.js';

interface ReviewsPageProps {
  onNavigateToTask: (taskId: string) => void;
  teamUsers?: any[];
}

export const ReviewsPage: React.FC<ReviewsPageProps> = ({ onNavigateToTask, teamUsers = [] }) => {
  const { user, activeProjectId } = useAuth();
  const toast = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [decisionFilter, setDecisionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReviewForDecision, setSelectedReviewForDecision] = useState<Review | null>(null);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      const query = new URLSearchParams();
      if (decisionFilter) query.set('decision', decisionFilter);

      const res = await apiRequest(`/api/reviews?${query.toString()}`);
      setReviews(res.reviews || []);
    } catch (err: any) {
      toast.error(`Failed to load peer review queue: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [decisionFilter]);

  const filteredReviews = useMemo(() => {
    if (!searchQuery.trim()) return reviews;
    const q = searchQuery.toLowerCase();
    return reviews.filter((r) =>
      r.task_id?.toLowerCase().includes(q) ||
      r.task_title?.toLowerCase().includes(q) ||
      r.developer_name?.toLowerCase().includes(q) ||
      r.reviewer_name?.toLowerCase().includes(q)
    );
  }, [reviews, searchQuery]);

  const pendingReviews = filteredReviews.filter((r) => r.decision === 'Pending');
  const pastReviews = filteredReviews.filter((r) => r.decision !== 'Pending');

  // Metrics
  const totalApproved = reviews.filter((r) => r.decision === 'Approved').length;
  const totalChangesReq = reviews.filter((r) => r.decision === 'Changes Requested').length;
  const totalPending = reviews.filter((r) => r.decision === 'Pending').length;

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h1>{activeProjectId === 'eclipsed' ? 'Eclipsed' : 'Terminal 6'} // Peer Review System</h1>
          <p>Mandatory independent verification gates, review checklists, and architectural decisions.</p>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="metrics-grid" style={{ marginBottom: '24px' }}>
        <div className="metric-card accent-orange">
          <div className="metric-label">Awaiting Verification</div>
          <div className="metric-value">{totalPending}</div>
          <div className="metric-sub">Active in review queue</div>
        </div>
        <div className="metric-card accent-green">
          <div className="metric-label">Approved & Verified</div>
          <div className="metric-value">{totalApproved}</div>
          <div className="metric-sub">Passed peer evaluation</div>
        </div>
        <div className="metric-card accent-amber">
          <div className="metric-label">Changes Requested</div>
          <div className="metric-value">{totalChangesReq}</div>
          <div className="metric-sub">Iterating with feedback</div>
        </div>
        <div className="metric-card accent-blue">
          <div className="metric-label">Total Evaluated</div>
          <div className="metric-value">{reviews.length}</div>
          <div className="metric-sub">Across all studio projects</div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="filter-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '34px' }}
            placeholder="Search reviews by task ID, title, developer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '180px' }}
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
        >
          <option value="">All Review Statuses</option>
          <option value="Pending">Pending Decision</option>
          <option value="Approved">Approved</option>
          <option value="Changes Requested">Changes Requested</option>
          <option value="Rejected">Rejected</option>
        </select>

        {(decisionFilter || searchQuery) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setDecisionFilter('');
              setSearchQuery('');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Review Queue (Pending) */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="card-header">
          <div className="card-title">
            <Clock size={16} color="var(--status-review)" />
            <span>Active Review Queue</span>
          </div>
          <span className="badge badge-ready-for-review">{pendingReviews.length} Awaiting Decision</span>
        </div>

        {isLoading ? (
          <div style={{ color: 'var(--text-secondary)', padding: '24px', textAlign: 'center' }}>
            Loading active review queue...
          </div>
        ) : pendingReviews.length === 0 ? (
          <div className="empty-state" style={{ padding: '28px 0' }}>
            <FileCheck2 size={36} color="var(--accent-orange)" />
            <h3>No Reviews Awaiting Decision</h3>
            <p>All requested code and asset reviews have been evaluated.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingReviews.map((rev) => {
              const isOwner = !!(user && rev.developer_id === user.id);
              const isAssignedReviewer = !!(user && rev.reviewer_id === user.id);

              return (
                <div
                  key={rev.id}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                    transition: 'border-color var(--transition-normal)'
                  }}
                >
                  <div style={{ flex: '1 1 300px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span className="mono" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-orange)' }}>
                        {rev.task_id}
                      </span>
                      <span className="badge badge-ready-for-review">PENDING REVIEW</span>
                      {isOwner && (
                        <span className="badge badge-blocked" title="Self-approval is strictly prohibited by studio policy">
                          YOUR TASK (SELF-APPROVAL PROHIBITED)
                        </span>
                      )}
                      {isAssignedReviewer && (
                        <span className="badge badge-verified-complete">
                          ASSIGNED TO YOU
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '6px' }}>
                      {rev.task_title}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Author: <strong style={{ color: 'var(--text-primary)' }}>{rev.developer_name}</strong> • Assigned Reviewer: <strong style={{ color: 'var(--text-primary)' }}>{rev.reviewer_name}</strong>
                      <span style={{ margin: '0 8px', color: 'var(--border-subtle)' }}>|</span>
                      Submitted: <span className="mono">{new Date(rev.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onNavigateToTask(rev.task_id)}
                    >
                      Inspect Task
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={isOwner}
                      onClick={() => setSelectedReviewForDecision(rev)}
                      title={isOwner ? 'Self-approval is prohibited' : 'Conduct review'}
                    >
                      Conduct Review
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Reviews History */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <FileCheck2 size={16} color="var(--accent-orange)" />
            <span>Completed Peer Reviews History</span>
          </div>
          <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {pastReviews.length} record(s)
          </span>
        </div>

        {pastReviews.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <p>No historical review decisions found.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {pastReviews.map((rev) => (
              <div
                key={rev.id}
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px 20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      className="mono"
                      style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-orange)', textDecoration: 'underline' }}
                      onClick={() => onNavigateToTask(rev.task_id)}
                    >
                      {rev.task_id}
                    </button>
                    <span
                      className={`badge ${
                        rev.decision === 'Approved'
                          ? 'badge-verified-complete'
                          : rev.decision === 'Changes Requested'
                          ? 'badge-changes-requested'
                          : 'badge-blocked'
                      }`}
                    >
                      {rev.decision}
                    </span>
                  </div>

                  <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Decided on: {rev.decision_at ? new Date(rev.decision_at).toLocaleString() : '—'}
                  </span>
                </div>

                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '4px' }}>
                  {rev.task_title}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Developer: <strong style={{ color: 'var(--text-primary)' }}>{rev.developer_name}</strong> • Evaluated by Reviewer: <strong style={{ color: 'var(--text-primary)' }}>{rev.reviewer_name}</strong>
                </div>

                {rev.findings && (
                  <div
                    style={{
                      marginTop: '10px',
                      fontSize: '12.5px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '2px solid var(--border-subtle)'
                    }}
                  >
                    <strong style={{ color: 'var(--text-white)' }}>Findings:</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>{rev.findings}</span>
                  </div>
                )}

                {rev.required_fixes && (
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '12.5px',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '2px solid var(--status-changes)'
                    }}
                  >
                    <strong style={{ color: 'var(--status-changes)' }}>Required Fixes:</strong>{' '}
                    <span style={{ color: 'var(--text-white)' }}>{rev.required_fixes}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {selectedReviewForDecision && (
        <ReviewModal
          isOpen={true}
          onClose={() => setSelectedReviewForDecision(null)}
          onReviewSubmitted={() => {
            setSelectedReviewForDecision(null);
            toast.success('Peer review decision recorded and synced with gate system.');
            fetchReviews();
          }}
          mode="decision"
          reviewToDecide={selectedReviewForDecision}
          teamUsers={teamUsers}
        />
      )}
    </div>
  );
};
