import React from 'react';
import { Priority } from '../types/index.js';

interface PriorityBadgeProps {
  priority: Priority | string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const getBadgeClass = (p: string) => {
    switch (p) {
      case 'P0':
        return 'badge-p0';
      case 'P1':
        return 'badge-p1';
      case 'P2':
        return 'badge-p2';
      default:
        return 'badge-p2';
    }
  };

  return <span className={`badge ${getBadgeClass(priority)}`}>{priority}</span>;
};
