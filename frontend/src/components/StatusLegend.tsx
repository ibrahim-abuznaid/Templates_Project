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
  HelpCircle,
  X,
} from 'lucide-react';

const StatusLegend: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  const statuses: Array<{
    status: IdeaStatus;
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    description: string;
    whoCanChange: string;
  }> = [
    {
      status: 'new',
      label: 'New',
      icon: Circle,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50 border-blue-300',
      description: 'Template has been created and is awaiting assignment to a template creator.',
      whoCanChange: 'Reviewer can assign to a template creator',
    },
    {
      status: 'assigned',
      label: 'Assigned',
      icon: UserPlus,
      color: 'text-purple-700',
      bgColor: 'bg-purple-50 border-purple-300',
      description: 'Template has been assigned to a template creator but work has not started yet.',
      whoCanChange: 'Template creator can start working',
    },
    {
      status: 'in_progress',
      label: 'In Progress',
      icon: Play,
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-50 border-yellow-300',
      description: 'Template creator is actively working on completing the template.',
      whoCanChange: 'Template creator can submit for review',
    },
    {
      status: 'submitted',
      label: 'Submitted',
      icon: Send,
      color: 'text-indigo-700',
      bgColor: 'bg-indigo-50 border-indigo-300',
      description: 'Work has been submitted and is waiting for reviewer approval. Template creator can unsubmit if changes are needed.',
      whoCanChange: 'Reviewer can approve or request fixes. Creator can unsubmit to make changes.',
    },
    {
      status: 'needs_fixes',
      label: 'Needs Fixes',
      icon: AlertCircle,
      color: 'text-red-700',
      bgColor: 'bg-red-50 border-red-300',
      description: 'Reviewer has reviewed the work and requested changes or fixes.',
      whoCanChange: 'Template creator needs to make changes and resubmit',
    },
    {
      status: 'reviewed',
      label: 'Reviewed',
      icon: CheckCircle,
      color: 'text-green-700',
      bgColor: 'bg-green-50 border-green-300',
      description: 'Work has been approved by reviewer and is ready to be published.',
      whoCanChange: 'Reviewer can publish the template',
    },
    {
      status: 'published',
      label: 'Published',
      icon: Rocket,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50 border-emerald-300',
      description: 'Template is published and live in the Public Library.',
      whoCanChange: 'Reviewer can archive when no longer needed',
    },
    {
      status: 'archived',
      label: 'Archived',
      icon: Archive,
      color: 'text-gray-700',
      bgColor: 'bg-gray-50 border-gray-300',
      description: 'Template is archived and removed from the Public Library.',
      whoCanChange: 'Reviewer can archive published templates',
    },
  ];

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-primary-600 text-white rounded-full p-3 shadow-lg hover:bg-primary-700 transition-all hover:scale-110 z-40 flex items-center space-x-2"
        title="Status Guide"
      >
        <HelpCircle className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">Status Guide</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Template Status Guide</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Understand the workflow and what each status means
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-6 space-y-4">
              {/* Workflow Diagram */}
              <div className="bg-gradient-to-r from-blue-50 to-emerald-50 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Workflow Flow:</h3>
                <div className="flex items-center justify-center space-x-2 text-xs flex-wrap">
                  {statuses.filter(s => s.status !== 'needs_fixes').map((status, index) => {
                    const Icon = status.icon;
                    return (
                      <React.Fragment key={status.status}>
                        <div className="flex flex-col items-center">
                          <div className={`${status.bgColor} border rounded-full p-2`}>
                            <Icon className={`w-4 h-4 ${status.color}`} />
                          </div>
                          <span className="mt-1 font-medium text-gray-700">{status.label}</span>
                        </div>
                        {index < statuses.length - 2 && (
                          <span className="text-gray-400 text-xl">→</span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center justify-center text-xs text-gray-600">
                  <AlertCircle className="w-4 h-4 text-red-600 mr-2" />
                  <span className="italic">
                    "Needs Fixes" can occur between Submitted and Reviewed. Template creators can also unsubmit to make changes.
                  </span>
                </div>
              </div>

              {/* Status Details */}
              <div className="space-y-3">
                {statuses.map((status) => {
                  const Icon = status.icon;
                  return (
                    <div
                      key={status.status}
                      className={`${status.bgColor} border rounded-lg p-4`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`p-2 bg-white rounded-lg border ${status.color}`}>
                          <Icon className={`w-5 h-5 ${status.color}`} />
                        </div>
                        <div className="flex-1">
                          <h4 className={`font-semibold ${status.color} text-lg mb-1`}>
                            {status.label}
                          </h4>
                          <p className="text-sm text-gray-700 mb-2">
                            {status.description}
                          </p>
                          <div className="bg-white bg-opacity-50 rounded px-3 py-2 border border-gray-200">
                            <p className="text-xs font-medium text-gray-600">
                              <span className="font-semibold">Next Action:</span> {status.whoCanChange}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tips Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center space-x-2">
                  <HelpCircle className="w-4 h-4" />
                  <span>Quick Tips</span>
                </h3>
                <ul className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Hover over any status badge to see detailed information and next steps</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>The workflow progress indicator shows where each template is in the process</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 mt-0.5">•</span>
<span>Template creators can unsubmit their work to make changes before reviewer approval</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Use comments to communicate with team members at any stage</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <span className="text-blue-600 mt-0.5">•</span>
                    <span>Payment is automatically processed when a template reaches "Reviewed" or "Published"</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <button
                onClick={() => setIsOpen(false)}
                className="w-full btn-primary"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StatusLegend;
