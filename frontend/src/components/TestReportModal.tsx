import React, { useState } from 'react';
import { X } from 'lucide-react';
import { TestResult, BuildResult } from '../types/index.js';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../api/client.js';

interface TestReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReportSaved: () => void;
  defaultTaskId?: string | null;
  tasks?: any[];
}

export const TestReportModal: React.FC<TestReportModalProps> = ({
  isOpen,
  onClose,
  onReportSaved,
  defaultTaskId,
  tasks = []
}) => {
  const { user } = useAuth();
  const [taskId, setTaskId] = useState(defaultTaskId || '');
  const [revision, setRevision] = useState('');
  const [unityVersion, setUnityVersion] = useState('6000.0.25f1');
  const [testSuite, setTestSuite] = useState('PlayMode.Integration');
  const [result, setResult] = useState<TestResult>('Passed');
  const [passedCount, setPassedCount] = useState(1);
  const [failedCount, setFailedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [buildResult, setBuildResult] = useState<BuildResult>('Success');
  const [runnerIdentity, setRunnerIdentity] = useState(
    user?.displayName ? `${user.displayName} (Unity Test Framework Manual Run)` : 'Local Unity Test Runner'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await apiRequest('/api/test-reports', {
        method: 'POST',
        body: JSON.stringify({
          taskId: taskId || null,
          revision: revision.trim(),
          unityVersion: unityVersion.trim(),
          testSuite: testSuite.trim(),
          result,
          passedCount: Number(passedCount),
          failedCount: Number(failedCount),
          skippedCount: Number(skippedCount),
          buildResult,
          runnerIdentity: runnerIdentity.trim()
        })
      });

      onReportSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div className="modal-title">Record Unity Test / Build Report</div>
          <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="alert alert-warning" style={{ fontSize: '12px' }}>
              <div>
                <strong>Manual Entry Note:</strong> Reports submitted here are labeled as <em>MANUAL / UNVERIFIED</em>. When Unity CI / Test Framework is connected via webhook, automated reports will be signed automatically.
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Related Task</label>
              <select
                className="form-control"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                <option value="">General suite (No specific task)</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id}: {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Tested Revision / Changeset ID *</label>
                <input
                  type="text"
                  className="form-control mono"
                  placeholder="e.g. cs:1042"
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Unity Version *</label>
                <input
                  type="text"
                  className="form-control mono"
                  placeholder="6000.0.25f1"
                  value={unityVersion}
                  onChange={(e) => setUnityVersion(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Test Suite Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="PlayMode.LocomotiveSystems"
                  value={testSuite}
                  onChange={(e) => setTestSuite(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Test Outcome *</label>
                <select
                  className="form-control"
                  value={result}
                  onChange={(e) => setResult(e.target.value as TestResult)}
                >
                  <option value="Passed">Passed</option>
                  <option value="Failed">Failed</option>
                  <option value="Error">Error</option>
                  <option value="Not Run">Not Run</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Passed</label>
                <input
                  type="number"
                  min="0"
                  className="form-control mono"
                  value={passedCount}
                  onChange={(e) => setPassedCount(parseInt(e.target.value, 10) || 0)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Failed</label>
                <input
                  type="number"
                  min="0"
                  className="form-control mono"
                  value={failedCount}
                  onChange={(e) => setFailedCount(parseInt(e.target.value, 10) || 0)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Skipped</label>
                <input
                  type="number"
                  min="0"
                  className="form-control mono"
                  value={skippedCount}
                  onChange={(e) => setSkippedCount(parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Build Result</label>
                <select
                  className="form-control"
                  value={buildResult}
                  onChange={(e) => setBuildResult(e.target.value as BuildResult)}
                >
                  <option value="Success">Success</option>
                  <option value="Failed">Failed</option>
                  <option value="Not Applicable">Not Applicable</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Runner Identity</label>
                <input
                  type="text"
                  className="form-control"
                  value={runnerIdentity}
                  onChange={(e) => setRunnerIdentity(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Recording...' : 'Record Test Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
