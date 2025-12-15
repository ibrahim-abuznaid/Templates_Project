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
  ChevronDown,
  Info,
} from 'lucide-react';

interface StatusChangeSelectorProps {
  currentStatus: IdeaStatus;
  allowedStatuses: IdeaStatus[];
  onStatusChange: (newStatus: IdeaStatus) => void;
  userRole?: 'admin' | 'freelancer'; // Optional for future use
}

const StatusChangeSelector: React.FC<StatusChangeSelectorProps> = ({
  currentStatus,
  allowedStatuses,
  onStatusChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<IdeaStatus | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const statusConfig: Record<IdeaStatus, {
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    description: string;
    action: string;
    confirmMessage: string;
    republishMessage?: string;
  }> = {
    new: {
      label: 'New',
      icon: Circle,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 border-blue-300',
      description: 'Template awaiting assignment',
      action: 'Mark as New',
      confirmMessage: 'Mark this template as new?'
    },
    assigned: {
      label: 'Assigned',
      icon: UserPlus,
      color: 'text-purple-700',
      bgColor: 'bg-purple-50 border-purple-300',
      description: 'Assigned to freelancer',
      action: 'Assign Template',
      confirmMessage: 'Assign this template to a freelancer?'
    },
    in_progress: {
      label: 'In Progress',
      icon: Play,
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-50 border-yellow-300',
      description: 'Currently being worked on',
      action: 'Continue Working',
      confirmMessage: 'Move this template back to in progress? You can make changes and resubmit when ready.'
    },
    submitted: {
      label: 'Submitted',
      icon: Send,
      color: 'text-indigo-700',
      bgColor: 'bg-indigo-50 border-indigo-300',
      description: 'Submitted for review',
      action: 'Submit for Review',
      confirmMessage: 'Submit this template for reviewer approval? You can unsubmit later if you need to make changes.'
    },
    needs_fixes: {
      label: 'Needs Fixes',
      icon: AlertCircle,
      color: 'text-red-700',
      bgColor: 'bg-red-50 border-red-300',
      description: 'Changes requested by reviewer',
      action: 'Request Fixes',
      confirmMessage: 'Request changes from the template creator? Make sure to add comments explaining what needs to be fixed.'
    },
    reviewed: {
      label: 'Reviewed',
      icon: CheckCircle,
      color: 'text-green-700',
      bgColor: 'bg-green-50 border-green-300',
      description: 'Approved and ready to publish',
      action: 'Approve Template',
      confirmMessage: 'Approve this template? This will trigger payment processing for the template creator.'
    },
    published: {
      label: 'Published',
      icon: Rocket,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50 border-emerald-300',
      description: 'Live in Public Library',
      action: 'Publish Template',
      confirmMessage: 'Publish this template? It will be added to the Public Library and visible to all users.',
      republishMessage: 'Republish this archived template? It will be restored to the Public Library and visible to all users again.'
    },
    archived: {
      label: 'Archived',
      icon: Archive,
      color: 'text-gray-700',
      bgColor: 'bg-gray-50 border-gray-300',
      description: 'Archived and removed from Public Library',
      action: 'Archive Template',
      confirmMessage: 'Archive this template? It will be removed from the Public Library.'
    },
  };

  const handleStatusSelect = (status: IdeaStatus) => {
    setSelectedStatus(status);
    setShowConfirmation(true);
    setIsOpen(false);
  };

  const handleConfirm = () => {
    if (selectedStatus) {
      onStatusChange(selectedStatus);
      setShowConfirmation(false);
      setSelectedStatus(null);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setSelectedStatus(null);
  };

  const currentConfig = statusConfig[currentStatus];
  const CurrentIcon = currentConfig.icon;

  return (
    <div className="relative">
      {/* Current Status Display & Dropdown Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg hover:border-primary-500 transition-all flex items-center justify-between group"
      >
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${currentConfig.bgColor} border`}>
            <CurrentIcon className={`w-5 h-5 ${currentConfig.color}`} />
          </div>
          <div className="text-left">
            <div className="font-medium text-gray-900">{currentConfig.label}</div>
            <div className="text-xs text-gray-500">{currentConfig.description}</div>
          </div>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 mb-2">
                Change Status
              </div>
              {allowedStatuses.map((status) => {
                const config = statusConfig[status];
                const Icon = config.icon;
                const isCurrent = status === currentStatus;

                return (
                  <button
                    key={status}
                    onClick={() => handleStatusSelect(status)}
                    disabled={isCurrent}
                    className={`w-full px-3 py-3 rounded-lg flex items-start space-x-3 transition-all ${
                      isCurrent
                        ? 'bg-gray-50 cursor-not-allowed opacity-60'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${config.bgColor} border flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900">{config.label}</span>
                        {isCurrent && (
                          <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{config.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && selectedStatus && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start space-x-4 mb-4">
              <div className={`p-3 rounded-lg ${statusConfig[selectedStatus].bgColor} border flex-shrink-0`}>
                {React.createElement(statusConfig[selectedStatus].icon, {
                  className: `w-6 h-6 ${statusConfig[selectedStatus].color}`
                })}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {currentStatus === 'archived' && selectedStatus === 'published' 
                    ? 'Republish Template'
                    : statusConfig[selectedStatus].action
                  }
                </h3>
                <p className="text-sm text-gray-600">
                  {currentStatus === 'archived' && selectedStatus === 'published' && statusConfig[selectedStatus].republishMessage
                    ? statusConfig[selectedStatus].republishMessage
                    : statusConfig[selectedStatus].confirmMessage
                  }
                </p>
              </div>
            </div>

            {/* Additional context based on status */}
            {selectedStatus === 'in_progress' && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start space-x-2">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">
                  Moving back to "In Progress" allows you to make changes. You can resubmit when ready.
                </p>
              </div>
            )}

            {selectedStatus === 'needs_fixes' && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start space-x-2">
                <Info className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  The template creator will be notified. Please add comments explaining what needs to be fixed.
                </p>
              </div>
            )}

            {selectedStatus === 'reviewed' && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-2">
                <Info className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-800">
                  This will create an invoice item for the template creator and mark the work as complete.
                </p>
              </div>
            )}

            {selectedStatus === 'published' && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-lg flex items-start space-x-2">
                <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-800">
                  {currentStatus === 'archived' 
                    ? 'The template will be restored to the Public Library and visible to all users again.'
                    : 'The template will be added to the Public Library and visible to all users.'
                  }
                </p>
              </div>
            )}

            {selectedStatus === 'archived' && (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-300 rounded-lg flex items-start space-x-2">
                <Info className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-gray-800">
                  The template will be removed from the Public Library.
                </p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={handleConfirm}
                className="flex-1 btn-primary"
              >
                Confirm
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusChangeSelector;
