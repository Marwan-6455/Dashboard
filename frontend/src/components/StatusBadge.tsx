import React from 'react';
import { TaskStatus } from '../types/index.js';

interface StatusBadgeProps {
  status: TaskStatus | string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getBadgeClass = (s: string) => {
    switch (s) {
      case 'Backlog':
        return 'badge-backlog';
      case 'In Progress':
        return 'badge-in-progress';
      case 'Ready for Review':
        return 'badge-ready-for-review';
      case 'Changes Requested':
        return 'badge-changes-requested';
      case 'Ready to Integrate':
        return 'badge-ready-to-integrate';
      case 'Verified Complete':
        return 'badge-verified-complete';
      case 'Blocked':
        return 'badge-blocked';
      default:
        return 'badge-backlog';
    }
  };

  return <span className={`badge ${getBadgeClass(status)}`}>{status}</span>;
};
