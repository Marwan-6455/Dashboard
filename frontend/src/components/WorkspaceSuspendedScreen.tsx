import React, { useState } from 'react';
import { Strike } from '../types/index.js';
import { apiRequest } from '../api/client.js';

interface WorkspaceSuspendedScreenProps {
  strikes: Strike[];
  suspensionReason?: string | null;
  suspendedAt?: string | null;
  onRefresh: () => void;
  onLogout: () => void;
}

export const WorkspaceSuspendedScreen: React.FC<WorkspaceSuspendedScreenProps> = ({
  strikes,
  suspensionReason,
  suspendedAt,
  onRefresh,
  onLogout
}) => {
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [selectedStrikeId, setSelectedStrikeId] = useState<string>(strikes[0]?.id || '');
  const [appealReason, setAppealReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appealSuccess, setAppealSuccess] = useState<string | null>(null);
  const [appealError, setAppealError] = useState<string | null>(null);

  const handleSubmitAppeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStrikeId || !appealReason.trim()) {
      setAppealError('Please select a strike and provide an explanation for your appeal.');
      return;
    }

    setIsSubmitting(true);
    setAppealError(null);
    try {
      await apiRequest(`/api/strikes/${selectedStrikeId}/dispute`, {
        method: 'POST',
        body: JSON.stringify({ reason: appealReason.trim() })
      });
      setAppealSuccess('Your appeal has been officially submitted to Studio Administration for review.');
      setAppealReason('');
      onRefresh();
    } catch (err: any) {
      setAppealError(err.message || 'Failed to submit appeal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#090a0f',
        color: '#f3f4f6',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 20px',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '740px',
          backgroundColor: '#12141c',
          borderRadius: '14px',
          border: '2px solid #ef4444',
          boxShadow: '0 0 50px rgba(239, 68, 68, 0.25), 0 25px 60px rgba(0, 0, 0, 0.9)',
          overflow: 'hidden'
        }}
      >
        {/* Crimson Hazard Warning Banner */}
        <div
          style={{
            padding: '24px 32px',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.3) 100%)',
            borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '20px'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              backgroundColor: '#ef4444',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              flexShrink: 0,
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.5)'
            }}
          >
            🛑
          </div>

          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: '#fca5a5',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontFamily: 'var(--font-mono)'
              }}
            >
              Cindermarch Studio // Disciplinary Governance
            </div>
            <h1
              style={{
                margin: '4px 0 0',
                fontSize: '22px',
                color: '#fff',
                fontFamily: 'var(--font-display, inherit)',
                letterSpacing: '-0.01em'
              }}
            >
              WORKSPACE ACCESS SUSPENDED
            </h1>
          </div>
        </div>

        {/* Suspension Content */}
        <div style={{ padding: '28px 32px' }}>
          <div
            style={{
              padding: '16px 20px',
              borderRadius: '8px',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              marginBottom: '24px',
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#f3f4f6'
            }}
          >
            <strong>WORKSPACE SUSPENDED</strong> — Your account has reached the five-strike threshold under the Cindermarch deadline accountability policy. Normal workspace access is suspended.
            <div style={{ marginTop: '8px', fontSize: '12.5px', color: '#9ca3af' }}>
              {suspensionReason && <div><strong>Reason:</strong> {suspensionReason}</div>}
              {suspendedAt && <div><strong>Suspended At:</strong> {new Date(suspendedAt).toLocaleString()}</div>}
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '8px',
              fontSize: '12.5px',
              color: '#6ee7b7',
              marginBottom: '24px'
            }}
          >
            🛡️ <strong>Integrity Guarantee:</strong> Your user account, tasks, UVCS changesets, reviews, and test reports are preserved in full. Your incomplete tasks have been flagged for team reassignment rather than deleted.
          </div>

          {/* Qualifying Strikes List */}
          <div style={{ marginBottom: '24px' }}>
            <h3
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                margin: '0 0 12px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              Qualifying Strikes Recorded ({strikes.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {strikes.map((s, idx) => (
                <div
                  key={s.id}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    padding: '12px 16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          fontFamily: 'var(--font-mono)'
                        }}
                      >
                        Strike #{idx + 1}
                      </span>
                      <strong style={{ color: '#e5e7eb', fontSize: '13px' }}>
                        [{s.task_id}] {s.task_title || 'Assigned Task'}
                      </strong>
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        color: s.status === 'disputed' ? '#fbbf24' : '#ef4444',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {s.status === 'disputed' ? 'Dispute Under Review' : 'Active Strike'}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>
                    {s.reason}
                  </div>

                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
                    Applicable Deadline: <span style={{ color: '#fca5a5' }}>{s.applicable_deadline}</span> • Detected: {new Date(s.detected_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Row */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: '20px',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setAppealModalOpen(true)}
                style={{
                  padding: '10px 18px',
                  backgroundColor: '#ff5722',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                  boxShadow: '0 0 12px rgba(255, 87, 34, 0.3)'
                }}
              >
                ⚖️ Submit Administrative Appeal
              </button>

              <button
                onClick={onRefresh}
                style={{
                  padding: '10px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#e5e7eb',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                🔄 Check Reinstatement Status
              </button>
            </div>

            <button
              onClick={onLogout}
              style={{
                padding: '10px 16px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Appeal Submission Modal */}
      {appealModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100000,
            padding: '20px'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: '#161922',
              borderRadius: '10px',
              border: '1px solid #374151',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>
              Submit Strike Appeal
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af', lineHeight: '1.5' }}>
              Provide clear details regarding technical blockers, external dependency delays, or Plastic SCM changeset evidence to request an administrative review.
            </p>

            {appealSuccess && (
              <div style={{ padding: '10px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', borderRadius: '6px', fontSize: '13px' }}>
                {appealSuccess}
              </div>
            )}
            {appealError && (
              <div style={{ padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#f87171', borderRadius: '6px', fontSize: '13px' }}>
                {appealError}
              </div>
            )}

            <form onSubmit={handleSubmitAppeal} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                  Select Strike to Appeal:
                </label>
                <select
                  value={selectedStrikeId}
                  onChange={(e) => setSelectedStrikeId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#0f1117',
                    border: '1px solid #374151',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                >
                  {strikes.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.task_id}] {s.task_title || s.applicable_deadline} ({s.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                  Documented Explanation & Proof:
                </label>
                <textarea
                  rows={4}
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder="Detail the reasons why this deadline was missed, including any Plastic SCM revision tags, build logs, or approved exceptions..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    backgroundColor: '#0f1117',
                    border: '1px solid #374151',
                    color: '#fff',
                    fontSize: '13px',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setAppealModalOpen(false);
                    setAppealSuccess(null);
                    setAppealError(null);
                  }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    border: '1px solid #4b5563',
                    color: '#d1d5db',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#ff5722',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 700
                  }}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit to Engine Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
