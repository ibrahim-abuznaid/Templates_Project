import React from 'react';
import type { IdeaStatus } from '../types';

interface StatusBadgeProps {
  status: IdeaStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusConfig: Record<IdeaStatus, { label: string; className: string }> = {
    new: { label: 'New', className: 'badge-new' },
    assigned: { label: 'Assigned', className: 'badge-assigned' },
    in_progress: { label: 'In Progress', className: 'badge-in_progress' },
    submitted: { label: 'Submitted', className: 'badge-submitted' },
    needs_fixes: { label: 'Needs Fixes', className: 'badge-needs_fixes' },
    reviewed: { label: 'Reviewed', className: 'badge-reviewed' },
    published: { label: 'Published', className: 'badge-published' },
  };

  const config = statusConfig[status];

  return <span className={`badge ${config.className}`}>{config.label}</span>;
};

export default StatusBadge;

