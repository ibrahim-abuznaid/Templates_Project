import React from 'react';
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
  ArrowRight,
} from 'lucide-react';

interface StatusWorkflowProps {
  currentStatus: IdeaStatus;
  compact?: boolean;
}

const StatusWorkflow: React.FC<StatusWorkflowProps> = ({ currentStatus, compact = false }) => {
  const workflow: Array<{
    status: IdeaStatus;
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
  }> = [
    { status: 'new', label: 'New', icon: Circle, color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-300' },
    { status: 'assigned', label: 'Assigned', icon: UserPlus, color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-300' },
    { status: 'in_progress', label: 'In Progress', icon: Play, color: 'text-yellow-700', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-300' },
    { status: 'submitted', label: 'Submitted', icon: Send, color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-300' },
    { status: 'reviewed', label: 'Reviewed', icon: CheckCircle, color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-300' },
    { status: 'published', label: 'Published', icon: Rocket, color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-300' },
    { status: 'archived', label: 'Archived', icon: Archive, color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-300' },
  ];

  // Find the index of the current status in the workflow
  const currentIndex = workflow.findIndex(w => w.status === currentStatus);
  
  // Handle needs_fixes as a variant of in_progress
  const displayIndex = currentStatus === 'needs_fixes' ? workflow.findIndex(w => w.status === 'in_progress') : currentIndex;

  if (compact) {
    return (
      <div className="flex items-center space-x-1">
        {workflow.map((step, index) => {
          const Icon = step.icon;
          const isActive = index <= displayIndex;
          const isCurrent = 
            (step.status === currentStatus) || 
            (currentStatus === 'needs_fixes' && step.status === 'in_progress');

          return (
            <React.Fragment key={step.status}>
              <div
                className={`flex items-center justify-center rounded-full transition-all ${
                  isActive
                    ? `${step.bgColor} ${step.borderColor} border-2`
                    : 'bg-gray-100 border-2 border-gray-300'
                } ${isCurrent ? 'ring-2 ring-offset-1 ring-primary-400' : ''} ${
                  compact ? 'w-6 h-6' : 'w-8 h-8'
                }`}
                title={step.label}
              >
                <Icon
                  className={`${compact ? 'w-3 h-3' : 'w-4 h-4'} ${
                    isActive ? step.color : 'text-gray-400'
                  }`}
                />
              </div>
              {index < workflow.length - 1 && (
                <ArrowRight
                  className={`w-3 h-3 ${
                    index < displayIndex ? step.color : 'text-gray-300'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
        {currentStatus === 'needs_fixes' && (
          <div className="ml-2 flex items-center space-x-1 px-2 py-1 bg-red-50 border border-red-300 rounded-full">
            <AlertCircle className="w-3 h-3 text-red-700" />
            <span className="text-xs text-red-700 font-medium">Needs Fixes</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Workflow Progress</h3>
      
      {/* Special indicator for needs_fixes */}
      {currentStatus === 'needs_fixes' && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Changes Requested</p>
            <p className="text-xs text-red-700 mt-1">
              Reviewer has requested changes. Please review the comments, make the necessary fixes, and resubmit.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {workflow.map((step, index) => {
          const Icon = step.icon;
          const isActive = index <= displayIndex;
          const isCurrent = 
            (step.status === currentStatus) || 
            (currentStatus === 'needs_fixes' && step.status === 'in_progress');
          const isPast = index < displayIndex;

          return (
            <div key={step.status} className="flex items-start space-x-3">
              {/* Status Icon */}
              <div className="relative flex flex-col items-center">
                <div
                  className={`flex items-center justify-center rounded-full transition-all ${
                    isActive
                      ? `${step.bgColor} ${step.borderColor} border-2`
                      : 'bg-gray-100 border-2 border-gray-300'
                  } ${isCurrent ? 'ring-4 ring-offset-2 ring-primary-400 shadow-lg' : ''} w-10 h-10`}
                >
                  <Icon
                    className={`w-5 h-5 ${isActive ? step.color : 'text-gray-400'}`}
                  />
                </div>
                {/* Connecting Line */}
                {index < workflow.length - 1 && (
                  <div
                    className={`w-0.5 h-8 mt-2 ${
                      isPast ? step.borderColor.replace('border-', 'bg-') : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>

              {/* Status Info */}
              <div className="flex-1 pt-1">
                <div className="flex items-center space-x-2">
                  <h4
                    className={`font-medium ${
                      isCurrent ? 'text-primary-900 text-lg' : isActive ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </h4>
                  {isCurrent && (
                    <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                      Current
                    </span>
                  )}
                  {isPast && (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  )}
                </div>
                <p className={`text-sm mt-1 ${isCurrent ? 'text-gray-700' : 'text-gray-500'}`}>
                  {step.status === 'new' && 'Template created and awaiting assignment'}
                  {step.status === 'assigned' && 'Assigned to template creator, waiting to start'}
                  {step.status === 'in_progress' && 'Template creator is working on the template'}
                  {step.status === 'submitted' && 'Submitted for reviewer approval (can be unsubmitted)'}
                  {step.status === 'reviewed' && 'Approved by reviewer, ready to publish'}
                  {step.status === 'published' && 'Published and live in Public Library'}
                  {step.status === 'archived' && 'Archived and removed from Public Library'}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex justify-between text-xs text-gray-600 mb-2">
          <span>Progress</span>
          <span>{Math.round(((displayIndex + 1) / workflow.length) * 100)}%</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 ease-out rounded-full"
            style={{ width: `${((displayIndex + 1) / workflow.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default StatusWorkflow;
