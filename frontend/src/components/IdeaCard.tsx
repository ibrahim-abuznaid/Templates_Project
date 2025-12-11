import React from 'react';
import { Link } from 'react-router-dom';
import type { Idea } from '../types';
import StatusBadge from './StatusBadge';
import { Calendar, DollarSign, User } from 'lucide-react';

interface IdeaCardProps {
  idea: Idea;
}

const IdeaCard: React.FC<IdeaCardProps> = ({ idea }) => {
  return (
    <Link to={`/ideas/${idea.id}`} className="card hover:shadow-md transition-shadow cursor-pointer">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{idea.flow_name || idea.use_case}</h3>
        <StatusBadge status={idea.status} />
      </div>

      {idea.short_description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{idea.short_description}</p>
      )}

      <div className="flex items-center justify-between text-xs">
        {idea.department && (
          <span className="inline-block px-2 py-1 font-medium bg-primary-100 text-primary-700 rounded">
            {idea.department}
          </span>
        )}
        {idea.use_case && (
          <span className="text-gray-500 text-xs">{idea.use_case}</span>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          {idea.assigned_to_name && (
            <div className="flex items-center space-x-1">
              <User className="w-4 h-4" />
              <span>{idea.assigned_to_name}</span>
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

