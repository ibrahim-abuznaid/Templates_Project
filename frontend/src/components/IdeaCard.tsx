import React from 'react';
import { Link } from 'react-router-dom';
import type { Idea } from '../types';
import { User, DollarSign } from 'lucide-react';

interface IdeaCardProps {
  idea: Idea;
  isHighlighted?: boolean;
}

const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  new: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', label: 'New' },
  assigned: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500', label: 'Assigned' },
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500', label: 'In Progress' },
  submitted: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500', label: 'Submitted' },
  needs_fixes: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500', label: 'Needs Fixes' },
  reviewed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Reviewed' },
  published: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500', label: 'Published' },
  archived: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400', label: 'Archived' },
};

const IdeaCard: React.FC<IdeaCardProps> = ({ idea, isHighlighted = false }) => {
  const description = idea.summary || idea.short_description;
  const status = statusConfig[idea.status] || statusConfig.new;
  const price = Number(idea.price || 0);

  return (
    <Link 
      to={`/ideas/${idea.id}`} 
      className={`group block h-full ${isHighlighted ? 'scale-[1.02]' : ''}`}
    >
      <div className={`
        relative h-full bg-white rounded-2xl overflow-hidden
        border-2 transition-all duration-300 ease-out
        ${isHighlighted 
          ? 'border-primary-400 shadow-xl shadow-primary-100' 
          : 'border-gray-100 hover:border-primary-200 hover:shadow-lg hover:shadow-gray-100'
        }
      `}>
        {/* Status Bar - Top accent */}
        <div className={`h-1.5 w-full ${status.dot}`} />
        
        {/* Card Content */}
        <div className="p-5 flex flex-col h-[calc(100%-6px)]">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3">
            {/* Title */}
            <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2 leading-tight flex-1">
              {idea.flow_name || 'Untitled Template'}
            </h3>
            
            {/* Status Badge */}
            <span className={`
              shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
              ${status.bg} ${status.text} ${status.border} border
            `}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>

          {/* Description */}
          <div className="flex-1 mb-4">
            {description ? (
              <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
                {description}
              </p>
            ) : (
              <p className="text-sm text-gray-300 italic">No description</p>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between">
              {/* Assigned To */}
              <div className="flex items-center gap-2">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center
                  ${idea.assigned_to_name 
                    ? 'bg-gradient-to-br from-primary-100 to-primary-200' 
                    : 'bg-gray-100'
                  }
                `}>
                  <User className={`w-4 h-4 ${idea.assigned_to_name ? 'text-primary-600' : 'text-gray-400'}`} />
                </div>
                <span className={`text-sm truncate max-w-[100px] ${
                  idea.assigned_to_name ? 'text-gray-700 font-medium' : 'text-gray-400'
                }`}>
                  {idea.assigned_to_name || 'Unassigned'}
                </span>
              </div>

              {/* Price */}
              <div className={`
                flex items-center gap-1 px-3 py-1.5 rounded-lg
                ${price > 0 
                  ? 'bg-gradient-to-r from-primary-50 to-violet-50 border border-primary-100' 
                  : 'bg-gray-50'
                }
              `}>
                <DollarSign className={`w-4 h-4 ${price > 0 ? 'text-primary-500' : 'text-gray-400'}`} />
                <span className={`text-lg font-bold ${price > 0 ? 'text-primary-600' : 'text-gray-400'}`}>
                  {price}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Hover Overlay Effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary-50/0 to-primary-50/0 group-hover:from-primary-50/30 group-hover:to-transparent transition-all duration-300 pointer-events-none rounded-2xl" />
      </div>
    </Link>
  );
};

export default IdeaCard;
