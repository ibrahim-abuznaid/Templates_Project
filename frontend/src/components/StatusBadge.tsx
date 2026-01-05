import React, { useState } from 'react';
import type { IdeaStatus } from '../types';
import {
  Circle,
  UserPlus,
  Play,
  Send,
  AlertCircle,
  CheckCircle,
  Rocket,
  Archive,
  Info,
  RotateCcw,
} from 'lucide-react';

interface StatusBadgeProps {
  status: IdeaStatus;
  showTooltip?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fixCount?: number; // Number of times marked as needs_fixes
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  showTooltip = true, 
  showIcon = true,
  size = 'md',
  fixCount = 0
}) => {
  const [showInfo, setShowInfo] = useState(false);
  
  // Check if this is a resubmission (submitted status with previous fixes)
  const isResubmission = status === 'submitted' && fixCount > 0;

  const statusConfig: Record<IdeaStatus, { 
    label: string; 
    className: string;
    icon: React.ElementType;
    description: string;
    nextAction: string;
  }> = {
    new: { 
      label: 'New', 
      className: 'badge-new',
      icon: Circle,
      description: 'Template created and awaiting assignment',
      nextAction: 'Needs to be assigned to a template creator'
    },
    assigned: { 
      label: 'Assigned', 
      className: 'badge-assigned',
      icon: UserPlus,
      description: 'Assigned to a template creator but work not yet started',
      nextAction: 'Waiting for template creator to start working'
    },
    in_progress: { 
      label: 'In Progress', 
      className: 'badge-in_progress',
      icon: Play,
      description: 'Template creator is actively working on this template',
      nextAction: 'Waiting for template creator to submit for review'
    },
    submitted: { 
      label: 'Submitted', 
      className: 'badge-submitted',
      icon: Send,
      description: 'Work submitted and waiting for reviewer approval',
      nextAction: 'Reviewer needs to review and approve or request fixes. Creator can unsubmit if needed.'
    },
    needs_fixes: { 
      label: 'Needs Fixes', 
      className: 'badge-needs_fixes',
      icon: AlertCircle,
      description: 'Reviewer requested changes or fixes',
      nextAction: 'Template creator needs to make changes and resubmit'
    },
    reviewed: { 
      label: 'Reviewed', 
      className: 'badge-reviewed',
      icon: CheckCircle,
      description: 'Work approved by reviewer, ready for publishing',
      nextAction: 'Reviewer can publish the template'
    },
    published: {
      label: 'Published',
      className: 'badge-published',
      icon: Rocket,
      description: 'Template is published and live in the Public Library',
      nextAction: 'Can be archived when no longer needed'
    },
    archived: {
      label: 'Archived',
      className: 'badge-archived',
      icon: Archive,
      description: 'Template is archived and removed from Public Library',
      nextAction: 'Template is complete and archived'
    },
  };

  const config = statusConfig[status];
  
  // Override for resubmissions
  const displayLabel = isResubmission ? 'Resubmitted' : config.label;
  const displayDescription = isResubmission 
    ? `Work resubmitted after ${fixCount} fix request${fixCount > 1 ? 's' : ''}`
    : config.description;
  const Icon = isResubmission ? RotateCcw : config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  // Special styling for resubmissions - use amber/orange to differentiate from fresh submissions
  const badgeClassName = isResubmission 
    ? 'bg-amber-100 text-amber-800 border border-amber-300' 
    : config.className;

  return (
    <div className="relative inline-block group">
      <span 
        className={`badge ${badgeClassName} ${sizeClasses[size]} flex items-center space-x-1.5 cursor-help transition-all hover:shadow-md`}
        onMouseEnter={() => setShowInfo(true)}
        onMouseLeave={() => setShowInfo(false)}
      >
        {showIcon && <Icon className={iconSizes[size]} />}
        <span>{displayLabel}</span>
        {isResubmission && fixCount > 1 && (
          <span className="ml-0.5 text-xs bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full font-semibold">
            ×{fixCount}
          </span>
        )}
        {showTooltip && <Info className={`${iconSizes[size]} opacity-60`} />}
      </span>
      
      {showTooltip && showInfo && (
        <div className="absolute z-50 w-72 p-3 mt-2 bg-gray-900 text-white text-sm rounded-lg shadow-xl left-0 top-full">
          <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 transform rotate-45"></div>
          <div className="relative z-10">
            <div className="font-semibold mb-2 flex items-center space-x-2">
              <Icon className="w-4 h-4" />
              <span>{displayLabel}</span>
            </div>
            <p className="text-gray-300 mb-2 text-xs leading-relaxed">
              {displayDescription}
            </p>
            <div className="pt-2 border-t border-gray-700">
              <p className="text-xs text-gray-400 font-medium">Next Step:</p>
              <p className="text-xs text-gray-300">{config.nextAction}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusBadge;

