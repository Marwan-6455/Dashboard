import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Search,
  Cpu,
  Layers,
  Terminal,
  Clock
} from 'lucide-react';
import { TestReport } from '../types/index.js';
import { TestReportModal } from '../components/TestReportModal.js';
import { apiRequest } from '../api/client.js';
import { useToast } from '../context/ToastContext.js';

interface TestReportsPageProps {
  onNavigateToTask: (taskId: string) => void;
  tasks?: any[];
}

export const TestReportsPage: React.FC<TestReportsPageProps> = ({ onNavigateToTask, tasks = [] }) => {
  const toast = useToast();
  const [reports, setReports] = useState<TestReport[]>([]);
  const [resultFilter, setResultFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const query = new URLSearchParams();
      if (resultFilter) query.set('result', resultFilter);
      if (sourceFilter) query.set('source', sourceFilter);

      const res = await apiRequest(`/api/test-reports?${query.toString()}`);
      setReports(res.reports || []);
    } catch (err: any) {
      toast.error(`Failed to load test reports: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [resultFilter, sourceFilter]);

  // Search filter
  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return reports;
    const q = searchQuery.toLowerCase();
    return reports.filter((rpt) =>
      rpt.test_suite?.toLowerCase().includes(q) ||
      rpt.revision?.toLowerCase().includes(q) ||
      rpt.unity_version?.toLowerCase().includes(q) ||
      rpt.runner_identity?.toLowerCase().includes(q) ||
      (rpt.task_id && rpt.task_id.toLowerCase().includes(q))
    );
  }, [reports, searchQuery]);

  // Aggregate Metrics
  const totalReports = reports.length;
  const passedReports = reports.filter((r) => r.result === 'Passed').length;
  const failedReports = reports.filter((r) => r.result === 'Failed' || r.result === 'Error').length;
  const totalTestsRun = reports.reduce((acc, r) => acc + (r.passed_count || 0) + (r.failed_count || 0) + (r.skipped_count || 0), 0);
  const totalSkipped = reports.reduce((acc, r) => acc + (r.skipped_count || 0), 0);
  const passRate = totalReports > 0 ? Math.round((passedReports / totalReports) * 100) : 100;

  const toggleExpand = (id: string) => {
    setExpandedReportId(expandedReportId === id ? null : id);
  };

  return (
    <div className="page-wrapper">
      <div className="page-header">
        <div className="page-title-group">
          <h1>Terminal 6 // Test & Build Reports</h1>
          <p>Unity Test Framework outcomes, playmode test suites, and build validation logs.</p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Record Manual Test Run
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="metrics-grid" style={{ marginBottom: '24px' }}>
        <div className="metric-card accent-orange">
          <div className="metric-label">Suites Ingested</div>
          <div className="metric-value">{totalReports}</div>
          <div className="metric-sub">{totalTestsRun} total unit & playmode tests</div>
        </div>
        <div className="metric-card accent-green">
          <div className="metric-label">Pass Rate</div>
          <div className="metric-value">{passRate}%</div>
          <div className="metric-sub">{passedReports} passing test suites</div>
        </div>
        <div className="metric-card accent-red">
          <div className="metric-label">Failures / Errors</div>
          <div className="metric-value" style={{ color: failedReports > 0 ? 'var(--status-changes)' : 'var(--text-white)' }}>
            {failedReports}
          </div>
          <div className="metric-sub">Requires developer investigation</div>
        </div>
        <div className="metric-card accent-amber">
          <div className="metric-label">Skipped Tests</div>
          <div className="metric-value">{totalSkipped}</div>
          <div className="metric-sub">Ignored or marked incomplete</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '360px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            style={{ paddingLeft: '34px' }}
            placeholder="Search suite, revision, runner, task..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '160px' }}
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
        >
          <option value="">All Results</option>
          <option value="Passed">Passed</option>
          <option value="Failed">Failed</option>
          <option value="Error">Error</option>
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '180px' }}
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="">All Sources</option>
          <option value="manual">Manual Entry</option>
          <option value="unity_ci">Unity CI / UTF Webhook</option>
          <option value="utf_runner">Automated UTF Runner</option>
        </select>

        {(resultFilter || sourceFilter || searchQuery) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setResultFilter('');
              setSourceFilter('');
              setSearchQuery('');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '36px' }}></th>
              <th>Test Suite & Build</th>
              <th>Outcome</th>
              <th>Revision / CS</th>
              <th>Unity Engine</th>
              <th>Passed</th>
              <th>Failed</th>
              <th>Skipped</th>
              <th>Source & Runner</th>
              <th>Task</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>Loading test reports...</div>
                </td>
              </tr>
            ) : filteredReports.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '40px' }}>
                  <div className="empty-state">
                    <FileText size={32} color="var(--accent-orange)" />
                    <h3>No Test Reports Found</h3>
                    <p>No test reports match the current filters. Run tests in Unity or record a manual run.</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredReports.map((rpt) => {
                const isExpanded = expandedReportId === rpt.id;
                const hasFailures = (rpt.failed_count || 0) > 0 || rpt.result === 'Failed' || rpt.result === 'Error';

                return (
                  <React.Fragment key={rpt.id}>
                    <tr
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isExpanded ? 'rgba(255, 94, 30, 0.04)' : undefined
                      }}
                      onClick={() => toggleExpand(rpt.id)}
                    >
                      <td style={{ textAlign: 'center', padding: '8px' }}>
                        {isExpanded ? (
                          <ChevronDown size={14} color="var(--accent-orange)" />
                        ) : (
                          <ChevronRight size={14} color="var(--text-muted)" />
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                          {rpt.test_suite}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Build: <strong style={{ color: rpt.build_result === 'Success' ? 'var(--status-complete)' : 'var(--status-changes)' }}>{rpt.build_result}</strong>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            rpt.result === 'Passed'
                              ? 'badge-verified-complete'
                              : 'badge-changes-requested'
                          }`}
                        >
                          {rpt.result}
                        </span>
                      </td>
                      <td>
                        <span className="mono" style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>
                          {rpt.revision}
                        </span>
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          {rpt.unity_version}
                        </span>
                      </td>
                      <td>
                        <span className="mono" style={{ color: 'var(--status-complete)', fontWeight: 700 }}>
                          {rpt.passed_count ?? 0}
                        </span>
                      </td>
                      <td>
                        <span
                          className="mono"
                          style={{
                            color: hasFailures ? 'var(--status-changes)' : 'var(--text-muted)',
                            fontWeight: hasFailures ? 700 : 400
                          }}
                        >
                          {rpt.failed_count ?? 0}
                        </span>
                      </td>
                      <td>
                        <span className="mono" style={{ color: (rpt.skipped_count || 0) > 0 ? 'var(--status-review)' : 'var(--text-muted)' }}>
                          {rpt.skipped_count ?? 0}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px' }}>
                          <span
                            className="badge"
                            style={{
                              marginRight: '6px',
                              backgroundColor: rpt.verification_state === 'automated_verified' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255, 152, 0, 0.15)',
                              color: rpt.verification_state === 'automated_verified' ? 'var(--status-complete)' : 'var(--status-review)',
                              fontSize: '10px'
                            }}
                          >
                            {rpt.source === 'manual' ? 'MANUAL' : 'AUTOMATED'}
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>{rpt.runner_identity}</span>
                        </div>
                      </td>
                      <td>
                        {rpt.task_id ? (
                          <button
                            className="mono"
                            style={{
                              color: 'var(--accent-orange)',
                              textDecoration: 'underline',
                              fontWeight: 600,
                              fontSize: '12px'
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateToTask(rpt.task_id!);
                            }}
                          >
                            {rpt.task_id}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(rpt.created_at).toLocaleString()}
                        </span>
                      </td>
                    </tr>

                    {/* Expandable Failure and Execution Log Details */}
                    {isExpanded && (
                      <tr style={{ backgroundColor: 'var(--bg-canvas)' }}>
                        <td colSpan={11} style={{ padding: '16px 24px', borderLeft: '3px solid var(--accent-orange)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '12px' }}>
                            <div>
                              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px' }}>
                                Execution Window
                              </div>
                              <div className="mono" style={{ fontSize: '12px', color: 'var(--text-white)', marginTop: '4px' }}>
                                Start: {new Date(rpt.start_time).toLocaleTimeString()} • End: {new Date(rpt.end_time).toLocaleTimeString()}
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px' }}>
                                Verification State
                              </div>
                              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                                <span className={rpt.verification_state === 'automated_verified' ? 'badge badge-verified-complete' : 'badge badge-ready-for-review'}>
                                  {rpt.verification_state?.toUpperCase().replace('_', ' ') || 'MANUAL UNVERIFIED'}
                                </span>
                              </div>
                            </div>

                            <div>
                              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.5px' }}>
                                Target Repository
                              </div>
                              <div className="mono" style={{ fontSize: '12px', color: 'var(--accent-orange)', marginTop: '4px' }}>
                                {rpt.repository_id || 'cindermarch-engine-core'}
                              </div>
                            </div>
                          </div>

                          {/* Failure / Diagnostic Banner */}
                          {hasFailures ? (
                            <div
                              style={{
                                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '12px 16px',
                                marginTop: '8px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-changes)', fontWeight: 600, fontSize: '13px' }}>
                                <XCircle size={16} />
                                <span>Failure Breakdown: {rpt.failed_count} test assertion(s) failed in suite {rpt.test_suite}</span>
                              </div>
                              <pre
                                className="mono"
                                style={{
                                  fontSize: '11.5px',
                                  color: 'var(--text-secondary)',
                                  backgroundColor: 'rgba(0,0,0,0.5)',
                                  padding: '10px 12px',
                                  borderRadius: '4px',
                                  marginTop: '8px',
                                  overflowX: 'auto',
                                  whiteSpace: 'pre-wrap'
                                }}
                              >
                                {`[FAIL] ${rpt.test_suite} - Assert failed: Execution did not complete within budget.\nRevision: ${rpt.revision} on Unity ${rpt.unity_version}\nRunner Identity: ${rpt.runner_identity}`}
                              </pre>
                            </div>
                          ) : (
                            <div
                              style={{
                                backgroundColor: 'rgba(76, 175, 80, 0.08)',
                                border: '1px solid rgba(76, 175, 80, 0.25)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '10px 14px',
                                marginTop: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: 'var(--status-complete)',
                                fontSize: '12.5px'
                              }}
                            >
                              <CheckCircle2 size={16} />
                              <span>All {rpt.passed_count} unit & playmode test cases passed with zero regressions.</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <TestReportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onReportSaved={() => {
          toast.success('Test execution report logged successfully.');
          fetchReports();
        }}
        tasks={tasks}
      />
    </div>
  );
};
