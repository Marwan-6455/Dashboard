import React, { useState, useEffect } from 'react';
import { FileCheck2, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { Review, ReviewDecision } from '../types/index.js';
import { ReviewModal } from '../components/ReviewModal.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';

interface ReviewsPageProps {
  onNavigateToTask: (taskId: string) => void;
  teamUsers?: any[];
}

export const ReviewsPage: React.FC<ReviewsPageProps> = ({ onNavigateToTask, teamUsers = [] }) => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [decisionFilter, setDecisionFilter] = useState('');
  const [selectedReviewForDecision, setSelectedReviewForDecision] = useState<Review | null>(null);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      const query = new URLSearchParams();
      if (decisionFilter) query.set('decision', decisionFilter);

      const res = await apiRequest(`/api/reviews?${query.toString()}`);
      setReviews(res.reviews || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [decisionFilter]);

  const pendingReviews = reviews.filter((r) => r.decision === 'Pending');
  const pastReviews = reviews.filter((r) => r.decision !== 'Pending');

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h1>Terminal 6 // Peer Review System</h1>
          <p>Mandatory independent verification gates, review checklists, and architectural decisions.</p>
        </div>
      </div>

      {/* Review Queue (Pending) */}
      <div className="card" style={{ marginBottom: '28px' }}>
        <div className="card-header">
          <div className="card-title">
            <Clock size={16} color="var(--status-review)" />
            <span>Review Queue (Awaiting Verification)</span>
          </div>
          <span className="badge badge-ready-for-review">{pendingReviews.length} Pending</span>
        </div>

        {pendingReviews.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <FileCheck2 size={32} />
            <h3>No Reviews Awaiting Decision</h3>
            <p>All requested code reviews have been evaluated.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingReviews.map((rev) => {
              const isOwner = !!(user && rev.developer_id === user.id);
              return (
                <div
                  key={rev.id}
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="mono" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-orange)' }}>
                        {rev.task_id}
                      </span>
                      <span className="badge badge-ready-for-review">PENDING REVIEW</span>
                      {isOwner && (
                        <span className="badge badge-blocked">
                          YOUR TASK (SELF-APPROVAL PROHIBITED)
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-white)' }}>
                      {rev.task_title}
                    </div>

                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Developer: <strong>{rev.developer_name}</strong> • Assigned Reviewer: <strong>{rev.reviewer_name}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
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

          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={decisionFilter}
            onChange={(e) => setDecisionFilter(e.target.value)}
          >
            <option value="">All Decisions</option>
            <option value="Approved">Approved</option>
            <option value="Changes Requested">Changes Requested</option>
            <option value="Rejected">Rejected</option>
          </select>
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
                  padding: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="mono" style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-orange)' }}>
                      {rev.task_id}
                    </span>
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

                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-white)', marginBottom: '4px' }}>
                  {rev.task_title}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Developer: <strong>{rev.developer_name}</strong> • Evaluated by Reviewer: <strong>{rev.reviewer_name}</strong>
                </div>

                {rev.findings && (
                  <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-white)' }}>
                    <strong>Findings:</strong> {rev.findings}
                  </div>
                )}

                {rev.required_fixes && (
                  <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--status-changes)' }}>
                    <strong>Required Fixes:</strong> {rev.required_fixes}
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
