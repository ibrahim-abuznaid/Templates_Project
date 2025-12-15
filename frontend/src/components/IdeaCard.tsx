import React from 'react';
import { Link } from 'react-router-dom';
import type { Idea } from '../types';
import StatusBadge from './StatusBadge';
import StatusWorkflow from './StatusWorkflow';
import { Calendar, DollarSign, User } from 'lucide-react';

interface IdeaCardProps {
  idea: Idea;
  isHighlighted?: boolean;
}

const IdeaCard: React.FC<IdeaCardProps> = ({ idea, isHighlighted = false }) => {
  return (
    <Link 
      to={`/ideas/${idea.id}`} 
      className={`card hover:shadow-md transition-all duration-500 cursor-pointer group block h-full flex flex-col ${
        isHighlighted ? 'ring-2 ring-blue-400 ring-offset-2 scale-[1.02] shadow-lg' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
          {idea.flow_name || idea.use_case}
        </h3>
        <StatusBadge status={idea.status} showIcon={true} showTooltip={false} size="sm" />
      </div>

      {idea.short_description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{idea.short_description}</p>
      )}

      {/* Compact Workflow Progress */}
      <div className="mb-4 pb-4 border-b border-gray-100">
        <StatusWorkflow currentStatus={idea.status} compact={true} />
      </div>

      <div className="flex items-center justify-between text-xs mb-3">
        {idea.department && (
          <span className="inline-block px-2 py-1 font-medium bg-primary-100 text-primary-700 rounded">
            {idea.department}
          </span>
        )}
        {idea.use_case && !idea.flow_name && (
          <span className="text-gray-500 text-xs">{idea.use_case}</span>
        )}
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

