import React from 'react';
import { Link } from 'react-router-dom';
import type { Idea } from '../types';

interface IdeaCardProps {
  idea: Idea;
  isHighlighted?: boolean;
}

// Minimal status dot colors (Linear-style)
const statusDot: Record<string, string> = {
  new: 'bg-gray-400',
  assigned: 'bg-violet-500',
  in_progress: 'bg-yellow-500',
  submitted: 'bg-blue-500',
  needs_fixes: 'bg-red-500',
  reviewed: 'bg-emerald-500',
  published: 'bg-green-500',
  archived: 'bg-gray-300',
};

const statusLabel: Record<string, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  needs_fixes: 'Needs Fixes',
  reviewed: 'Reviewed',
  published: 'Published',
  archived: 'Archived',
};

const IdeaCard: React.FC<IdeaCardProps> = ({ idea, isHighlighted = false }) => {
  const description = idea.summary || idea.short_description;
  const price = Number(idea.price || 0);
  const dotColor = statusDot[idea.status] || statusDot.new;
  const label = statusLabel[idea.status] || 'New';

  return (
    <Link to={`/ideas/${idea.id}`} className="block h-full group">
      <div
        className={`
          h-full rounded-lg bg-white
          border border-gray-200/80
          transition-all duration-150 ease-out
          hover:bg-gray-50/50 hover:border-gray-300
          ${isHighlighted ? 'ring-2 ring-violet-500' : ''}
        `}
      >
        {/* Main Content */}
        <div className="px-4 py-4">
          {/* Title Row */}
          <div className="flex items-start gap-3 mb-1">
            {/* Status Dot */}
            <span 
              className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${dotColor}`} 
              title={label}
            />
            {/* Title */}
            <h3 className="text-[15px] font-medium text-gray-900 leading-snug line-clamp-2 group-hover:text-violet-600 transition-colors">
              {idea.flow_name || 'Untitled'}
            </h3>
          </div>

          {/* Description */}
          {description && (
            <p className="text-[13px] text-gray-500 leading-relaxed line-clamp-2 ml-[22px] mt-1">
              {description}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          {/* Left: Assignee */}
          <div className="flex items-center gap-2 min-w-0">
            {idea.assigned_to_name ? (
              <>
                <span className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center text-[10px] font-medium text-white uppercase">
                  {idea.assigned_to_name.charAt(0)}
                </span>
                <span className="text-[13px] text-gray-600 truncate max-w-[100px]">
                  {idea.assigned_to_name}
                </span>
              </>
            ) : (
              <span className="text-[13px] text-gray-400">Unassigned</span>
            )}
          </div>

          {/* Right: Price */}
          <span className="text-[15px] font-semibold text-gray-900 tabular-nums">
            ${price}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default IdeaCard;
