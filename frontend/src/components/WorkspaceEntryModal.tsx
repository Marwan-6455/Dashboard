import React from 'react';
import { WorkspaceEntryWarning, Strike } from '../types/index.js';

interface WorkspaceEntryModalProps {
  warning: WorkspaceEntryWarning;
  onDismiss: () => void;
  onNavigateToStrikes: () => void;
  onNavigateToTask: (taskId: string) => void;
}

export const WorkspaceEntryModal: React.FC<WorkspaceEntryModalProps> = ({
  warning,
  onDismiss,
  onNavigateToStrikes,
  onNavigateToTask
}) => {
  const isFinalWarning = warning.activeStrikes === 4 || warning.warningLevel === 'final_warning';
  const isEscalation = warning.activeStrikes === 3 || warning.warningLevel === 'escalation';

  const getHeaderTitle = () => {
    if (isFinalWarning) return 'FINAL WARNING — WORKSPACE SUSPENSION IMMINENT';
    if (isEscalation) return 'DEADLINE ALERT — ESCALATED ACCOUNTABILITY';
    if (warning.activeStrikes === 2) return 'DEADLINE WARNING — SECOND WARNING';
    return 'DEADLINE WARNING — FIRST WARNING';
  };

  const getPolicyStatement = () => {
    if (isFinalWarning) {
      return `FINAL WARNING — You currently have ${warning.activeStrikes} of ${warning.maxThreshold} strikes. One additional qualifying missed deadline will trigger immediate workspace suspension under the Cindermarch policy. Review your deadlines immediately.`;
    }
    if (isEscalation) {
      return `DEADLINE ALERT — You currently have ${warning.activeStrikes} of ${warning.maxThreshold} strikes. Repeated missed deadlines may lead to workspace suspension. Please review your outstanding tasks and upcoming deadlines.`;
    }
    if (warning.activeStrikes === 2) {
      return `DEADLINE WARNING — You currently have 2 of ${warning.maxThreshold} strikes. Ensure outstanding deadlines are managed promptly to prevent escalation toward suspension.`;
    }
    return `DEADLINE WARNING — You currently have 1 of ${warning.maxThreshold} strikes. A task deadline was missed. Review the task and keep future deadlines on track.`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 7, 10, 0.88)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          backgroundColor: '#12141a',
          borderRadius: '12px',
          border: isFinalWarning ? '2px solid #ef4444' : isEscalation ? '2px solid #f59e0b' : '1px solid #ff5722',
          boxShadow: isFinalWarning
            ? '0 0 35px rgba(239, 68, 68, 0.35), 0 20px 40px rgba(0, 0, 0, 0.8)'
            : '0 0 25px rgba(255, 87, 34, 0.25), 0 20px 40px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Top Accent Ribbon */}
        <div
          style={{
            height: '6px',
            background: isFinalWarning
              ? 'linear-gradient(90deg, #dc2626, #ef4444, #dc2626)'
              : isEscalation
              ? 'linear-gradient(90deg, #d97706, #f59e0b, #d97706)'
              : 'linear-gradient(90deg, #ff5722, #ea580c, #ff5722)'
          }}
        />

        {/* Modal Header */}
        <div
          style={{
            padding: '24px 28px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px'
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '10px',
              backgroundColor: isFinalWarning ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 87, 34, 0.15)',
              border: `1px solid ${isFinalWarning ? '#ef4444' : '#ff5722'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              flexShrink: 0
            }}
          >
            {isFinalWarning ? '🚨' : isEscalation ? '⚠️' : '⏰'}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  backgroundColor: isFinalWarning ? '#ef4444' : isEscalation ? '#f59e0b' : '#ff5722',
                  color: '#fff',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {getHeaderTitle()}
              </span>

              {warning.discordDmStatus === 'delivered' && (
                <span
                  style={{
                    fontSize: '11px',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontFamily: 'var(--font-mono)'
                  }}
                  title="Private Discord notice delivered"
                >
                  💬 Discord DM Dispatched
                </span>
              )}
            </div>

            <h2
              style={{
                margin: 0,
                fontSize: '18px',
                color: '#fff',
                fontFamily: 'var(--font-display, inherit)',
                letterSpacing: '-0.01em'
              }}
            >
              Workspace Entry Deadline Accountability Notice
            </h2>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 28px', overflowY: 'auto', maxHeight: '65vh' }}>
          {/* Strikes Counter Meter */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              marginBottom: '20px'
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '12px 14px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                Active Strikes
              </div>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: 800,
                  color: isFinalWarning ? '#ef4444' : '#ff5722',
                  fontFamily: 'var(--font-mono)',
                  marginTop: '4px'
                }}
              >
                {warning.activeStrikes}
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '12px 14px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                Suspension Threshold
              </div>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: 800,
                  color: '#9ca3af',
                  fontFamily: 'var(--font-mono)',
                  marginTop: '4px'
                }}
              >
                {warning.maxThreshold}
              </div>
            </div>

            <div
              style={{
                backgroundColor: isFinalWarning ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                border: isFinalWarning ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '12px 14px',
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '11px', color: isFinalWarning ? '#fca5a5' : '#9ca3af', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                Strikes Remaining
              </div>
              <div
                style={{
                  fontSize: '26px',
                  fontWeight: 800,
                  color: isFinalWarning ? '#ef4444' : '#10b981',
                  fontFamily: 'var(--font-mono)',
                  marginTop: '4px'
                }}
              >
                {warning.remainingStrikes}
              </div>
            </div>
          </div>

          {/* Statement Banner */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '8px',
              backgroundColor: isFinalWarning ? 'rgba(239, 68, 68, 0.12)' : 'rgba(255, 87, 34, 0.08)',
              borderLeft: `4px solid ${isFinalWarning ? '#ef4444' : '#ff5722'}`,
              marginBottom: '20px',
              color: '#f3f4f6',
              fontSize: '13.5px',
              lineHeight: '1.55'
            }}
          >
            {getPolicyStatement()}
          </div>

          {/* Tasks Causing Active Strikes */}
          <div style={{ marginBottom: '20px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#9ca3af',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '10px',
                fontFamily: 'var(--font-mono)'
              }}
            >
              Tasks That Caused Active Strikes ({warning.strikes.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {warning.strikes.map((s: Strike) => (
                <div
                  key={s.id}
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '6px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => {
                          onDismiss();
                          onNavigateToTask(s.task_id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: '#38bdf8',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontFamily: 'var(--font-mono)',
                          textDecoration: 'underline'
                        }}
                      >
                        {s.task_id}
                      </button>
                      <span style={{ color: '#e5e7eb', fontSize: '13px', fontWeight: 500 }}>
                        {s.task_title || 'Assigned Task'}
                      </span>
                    </div>

                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        backgroundColor: s.status === 'disputed' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: s.status === 'disputed' ? '#fbbf24' : '#f87171',
                        fontFamily: 'var(--font-mono)'
                      }}
                    >
                      {s.status === 'disputed' ? 'Appeal Pending Review' : 'Active Strike'}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#9ca3af', lineHeight: '1.4' }}>
                    <span style={{ color: '#d1d5db' }}>Reason:</span> {s.reason}
                  </div>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#6b7280', fontFamily: 'var(--font-mono)' }}>
                    <span>Missed Deadline: <strong style={{ color: '#fca5a5' }}>{s.applicable_deadline}</strong></span>
                    <span>Detected: {new Date(s.detected_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Guidance */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              padding: '14px 16px'
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#e5e7eb',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <span>🧭 What you must do next:</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '18px', color: '#9ca3af', fontSize: '12.5px', lineHeight: '1.6' }}>
              <li>Review the affected tasks immediately and communicate any genuine blockers.</li>
              <li>If you believe a strike was issued in error (e.g. UVCS sync latency or approved exception), submit an appeal in the Strikes tab.</li>
              <li>Prioritize upcoming deadlines to avoid reaching the {warning.maxThreshold}-strike workspace suspension threshold.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#0d0f14',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}
        >
          <button
            onClick={() => {
              onDismiss();
              onNavigateToStrikes();
            }}
            style={{
              padding: '9px 18px',
              backgroundColor: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#e5e7eb',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>⚖️ Open Strike & Appeal History</span>
          </button>

          <button
            onClick={onDismiss}
            style={{
              padding: '9px 22px',
              backgroundColor: isFinalWarning ? '#dc2626' : '#ff5722',
              border: 'none',
              color: '#fff',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              letterSpacing: '0.02em',
              boxShadow: isFinalWarning ? '0 0 15px rgba(239, 68, 68, 0.4)' : '0 0 15px rgba(255, 87, 34, 0.4)'
            }}
          >
            Acknowledge for this Session
          </button>
        </div>
      </div>
    </div>
  );
};
