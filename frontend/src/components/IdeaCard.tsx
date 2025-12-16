import React from 'react';
import { Link } from 'react-router-dom';
import type { Idea } from '../types';
import StatusBadge from './StatusBadge';
import StatusWorkflow from './StatusWorkflow';
import { Calendar, DollarSign, User, Clock, TrendingDown } from 'lucide-react';

interface IdeaCardProps {
  idea: Idea;
  isHighlighted?: boolean;
}

const IdeaCard: React.FC<IdeaCardProps> = ({ idea, isHighlighted = false }) => {
  // Use summary, fallback to short_description for backward compatibility
  const description = idea.summary || idea.short_description;

  return (
    <Link 
      to={`/ideas/${idea.id}`} 
      className={`card hover:shadow-md transition-all duration-500 cursor-pointer group block h-full flex flex-col ${
        isHighlighted ? 'ring-2 ring-blue-400 ring-offset-2 scale-[1.02] shadow-lg' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0 mr-2">
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors truncate">
            {idea.flow_name || 'Untitled Template'}
          </h3>
          {idea.public_library_id && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
              Published
            </span>
          )}
        </div>
        <StatusBadge status={idea.status} showIcon={true} showTooltip={false} size="sm" />
      </div>

      {description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{description}</p>
      )}

      {/* Time Save & Cost Tags */}
      {(idea.time_save_per_week || idea.cost_per_year) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {idea.time_save_per_week && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
              <Clock className="w-3 h-3" />
              {idea.time_save_per_week}
            </span>
          )}
          {idea.cost_per_year && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
              <TrendingDown className="w-3 h-3" />
              {idea.cost_per_year}
            </span>
          )}
        </div>
      )}

      {/* Compact Workflow Progress */}
      <div className="mb-4 pb-4 border-b border-gray-100">
        <StatusWorkflow currentStatus={idea.status} compact={true} />
      </div>

      <div className="flex items-center justify-between text-xs mb-3">
        <div className="flex flex-wrap gap-1">
          {idea.departments && idea.departments.length > 0 ? (
            idea.departments.map((dept) => (
              <span 
                key={dept.id}
                className="inline-block px-2 py-1 font-medium bg-primary-100 text-primary-700 rounded text-xs"
              >
                {dept.name}
              </span>
            ))
          ) : idea.department ? (
          <span className="inline-block px-2 py-1 font-medium bg-primary-100 text-primary-700 rounded">
            {idea.department}
          </span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 mt-auto">
        <div className="flex items-center space-x-4">
          {idea.assigned_to_name && (
            <div className="flex items-center space-x-1">
              <User className="w-4 h-4" />
              <span className="truncate max-w-[100px]">{idea.assigned_to_name}</span>
            </div>
          )}
          <div className="flex items-center space-x-1">
            <DollarSign className="w-4 h-4" />
            <span>${idea.price}</span>
          </div>
        </div>
        <div className="flex items-center space-x-1">
          <Calendar className="w-4 h-4" />
          <span>{new Date(idea.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </Link>
  );
};

export default IdeaCard;

