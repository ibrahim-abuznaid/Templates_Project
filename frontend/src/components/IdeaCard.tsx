import React from 'react';
import { Link } from 'react-router-dom';
import type { Idea } from '../types';

interface IdeaCardProps {
  idea: Idea;
  isHighlighted?: boolean;
}

const statusConfig: Record<string, { dot: string; text: string; label: string }> = {
  new: { dot: 'bg-gray-400', text: 'text-gray-500', label: 'New' },
  assigned: { dot: 'bg-violet-500', text: 'text-violet-600', label: 'Assigned' },
  in_progress: { dot: 'bg-amber-500', text: 'text-amber-600', label: 'In Progress' },
  submitted: { dot: 'bg-blue-500', text: 'text-blue-600', label: 'Submitted' },
  needs_fixes: { dot: 'bg-red-500', text: 'text-red-600', label: 'Needs Fixes' },
  reviewed: { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'Reviewed' },
  published: { dot: 'bg-green-500', text: 'text-green-600', label: 'Published' },
  archived: { dot: 'bg-gray-300', text: 'text-gray-400', label: 'Archived' },
};

const IdeaCard: React.FC<IdeaCardProps> = ({ idea, isHighlighted = false }) => {
  const description = idea.summary || idea.short_description;
  const price = Number(idea.price || 0);
  const status = statusConfig[idea.status] || statusConfig.new;

  return (
    <Link to={`/ideas/${idea.id}`} className="block h-full group">
      <div
        className={`
          h-full rounded-lg bg-white flex flex-col
          border border-gray-200
          transition-all duration-150
          hover:border-gray-300 hover:shadow-sm
          ${isHighlighted ? 'ring-2 ring-violet-500' : ''}
        `}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3">
          {/* Status Row */}
          <div className="flex items-center gap-1.5 mb-3">
            <span className={`w-2 h-2 rounded-full ${status.dot}`} />
            <span className={`text-xs font-medium ${status.text}`}>
              {status.label}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-[15px] font-semibold text-gray-900 leading-tight line-clamp-2 group-hover:text-violet-600 transition-colors">
            {idea.flow_name || 'Untitled'}
          </h3>

          {/* Description */}
          {description && (
            <p className="text-sm text-gray-500 leading-relaxed line-clamp-2 mt-2">
              {description}
            </p>
          )}
        </div>

        {/* Footer - pushed to bottom */}
        <div className="mt-auto px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          {/* Assignee */}
          <div className="flex items-center gap-2 min-w-0">
            {idea.assigned_to_name ? (
              <>
                <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-semibold uppercase">
                  {idea.assigned_to_name.charAt(0)}
                </span>
                <span className="text-sm text-gray-600 truncate max-w-[90px]">
                  {idea.assigned_to_name}
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-400">Unassigned</span>
            )}
          </div>

          {/* Price */}
          <span className="text-base font-bold text-gray-900">
            ${price}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default IdeaCard;
