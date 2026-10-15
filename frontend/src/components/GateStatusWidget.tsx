import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, ShieldAlert } from 'lucide-react';
import { CompletionGateStatus } from '../types/index.js';

interface GateStatusWidgetProps {
  gateStatus?: CompletionGateStatus;
  compact?: boolean;
}

export const GateStatusWidget: React.FC<GateStatusWidgetProps> = ({ gateStatus, compact = false }) => {
  if (!gateStatus) {
    return (
      <div className="gate-widget">
        <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
          Completion gate criteria evaluating...
        </div>
      </div>
    );
  }

  const { passed, gates, reasons } = gateStatus;

  return (
    <div className="gate-widget">
      <div className="gate-widget-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {passed ? (
            <ShieldCheck size={18} color="var(--status-complete)" />
          ) : (
            <ShieldAlert size={18} color="var(--status-changes)" />
          )}
          <span>VERIFICATION GATES STATUS</span>
        </span>
        <span className={`badge ${passed ? 'badge-verified-complete' : 'badge-changes-requested'}`}>
          {passed ? 'READY FOR COMPLETION' : 'GATES PENDING'}
        </span>
      </div>

      {!passed && reasons.length > 0 && (
        <div className="alert alert-error" style={{ marginBottom: '14px', fontSize: '12.5px' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: '2px' }}>
              Completion blocked by {reasons.length} requirement(s):
            </div>
            <ul style={{ paddingLeft: '18px', marginTop: '4px' }}>
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {passed && (
        <div className="alert alert-success" style={{ marginBottom: '14px', fontSize: '12.5px' }}>
          <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            All mandatory verification gates satisfied! This task meets studio standards and can be marked <strong>Verified Complete</strong>.
          </div>
        </div>
      )}

      {!compact && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Gate 1 */}
          <div className={`gate-item ${gates.acceptanceCriteria.passed ? 'passed' : 'failed'}`}>
            {gates.acceptanceCriteria.passed ? (
              <CheckCircle2 className="gate-icon" />
            ) : (
              <XCircle className="gate-icon" />
            )}
            <div>
              <div className="gate-title">1. Acceptance Criteria Verified</div>
              <div className="gate-desc">{gates.acceptanceCriteria.detail}</div>
            </div>
          </div>

          {/* Gate 2 */}
          <div className={`gate-item ${gates.changesetLinked.passed ? 'passed' : 'failed'}`}>
            {gates.changesetLinked.passed ? (
              <CheckCircle2 className="gate-icon" />
            ) : (
              <XCircle className="gate-icon" />
            )}
            <div>
              <div className="gate-title">
                2. UVCS Changeset Linked {gates.changesetLinked.exempt && <span className="demo-tag">EXEMPT</span>}
              </div>
              <div className="gate-desc">{gates.changesetLinked.detail}</div>
            </div>
          </div>

          {/* Gate 3 */}
          <div className={`gate-item ${gates.peerReview.passed ? 'passed' : 'failed'}`}>
            {gates.peerReview.passed ? (
              <CheckCircle2 className="gate-icon" />
            ) : (
              <XCircle className="gate-icon" />
            )}
            <div>
              <div className="gate-title">3. Independent Peer Review (No Self-Approval)</div>
              <div className="gate-desc">{gates.peerReview.detail}</div>
            </div>
          </div>

          {/* Gate 4 */}
          <div className={`gate-item ${gates.evidence.passed ? 'passed' : 'failed'}`}>
            {gates.evidence.passed ? (
              <CheckCircle2 className="gate-icon" />
            ) : (
              <XCircle className="gate-icon" />
            )}
            <div>
              <div className="gate-title">4. Evidence Artifacts Attached</div>
              <div className="gate-desc">{gates.evidence.detail}</div>
            </div>
          </div>

          {/* Gate 5 */}
          <div className={`gate-item ${gates.testReports.passed ? 'passed' : 'failed'}`}>
            {gates.testReports.passed ? (
              <CheckCircle2 className="gate-icon" />
            ) : (
              <XCircle className="gate-icon" />
            )}
            <div>
              <div className="gate-title">
                5. Test & Build Reports Verified {gates.testReports.exempt && <span className="demo-tag">EXEMPT</span>}
              </div>
              <div className="gate-desc">{gates.testReports.detail}</div>
            </div>
          </div>

          {/* Gate 6 */}
          <div className={`gate-item ${gates.dependencies.passed ? 'passed' : 'failed'}`}>
            {gates.dependencies.passed ? (
              <CheckCircle2 className="gate-icon" />
            ) : (
              <XCircle className="gate-icon" />
            )}
            <div>
              <div className="gate-title">6. Task Dependencies Satisfied</div>
              <div className="gate-desc">{gates.dependencies.detail}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
