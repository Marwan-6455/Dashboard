import React, { useState, useEffect } from 'react';
import { FileText, Plus, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { TestReport, TestResult } from '../types/index.js';
import { TestReportModal } from '../components/TestReportModal.js';
import { apiRequest } from '../api/client.js';

interface TestReportsPageProps {
  onNavigateToTask: (taskId: string) => void;
  tasks?: any[];
}

export const TestReportsPage: React.FC<TestReportsPageProps> = ({ onNavigateToTask, tasks = [] }) => {
  const [reports, setReports] = useState<TestReport[]>([]);
  const [resultFilter, setResultFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchReports = async () => {
    try {
      setIsLoading(true);
      const query = new URLSearchParams();
      if (resultFilter) query.set('result', resultFilter);
      if (sourceFilter) query.set('source', sourceFilter);

      const res = await apiRequest(`/api/test-reports?${query.toString()}`);
      setReports(res.reports || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [resultFilter, sourceFilter]);

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

      <div className="filter-bar">
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
        </select>

        {(resultFilter || sourceFilter) && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setResultFilter('');
              setSourceFilter('');
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
              <th>Test Suite</th>
              <th>Outcome</th>
              <th>Revision / CS</th>
              <th>Unity Engine</th>
              <th>Passed</th>
              <th>Failed</th>
              <th>Source & Runner</th>
              <th>Associated Task</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    No test reports recorded matching your filters.
                  </div>
                </td>
              </tr>
            ) : (
              reports.map((rpt) => (
                <tr key={rpt.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-white)' }}>
                      {rpt.test_suite}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Build status: {rpt.build_result}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        rpt.result === 'Passed' ? 'badge-verified-complete' : 'badge-changes-requested'
                      }`}
                    >
                      {rpt.result}
                    </span>
                  </td>
                  <td>
                    <span className="mono" style={{ color: 'var(--accent-orange)' }}>
                      {rpt.revision}
                    </span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: '12px' }}>
                      {rpt.unity_version}
                    </span>
                  </td>
                  <td>
                    <span className="mono" style={{ color: 'var(--status-complete)', fontWeight: 600 }}>
                      {rpt.passed_count}
                    </span>
                  </td>
                  <td>
                    <span className="mono" style={{ color: rpt.failed_count > 0 ? 'var(--status-changes)' : 'var(--text-muted)' }}>
                      {rpt.failed_count}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '12px' }}>
                      {rpt.source === 'manual' ? (
                        <span className="demo-tag" style={{ marginRight: '6px' }}>MANUAL</span>
                      ) : (
                        <span className="badge badge-verified-complete" style={{ marginRight: '6px' }}>AUTOMATED</span>
                      )}
                      <span>{rpt.runner_identity}</span>
                    </div>
                  </td>
                  <td>
                    {rpt.task_id ? (
                      <button
                        className="mono"
                        style={{ color: 'var(--accent-orange)', textDecoration: 'underline' }}
                        onClick={() => onNavigateToTask(rpt.task_id!)}
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
              ))
            )}
          </tbody>
        </table>
      </div>

      <TestReportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onReportSaved={fetchReports}
        tasks={tasks}
      />
    </div>
  );
};
