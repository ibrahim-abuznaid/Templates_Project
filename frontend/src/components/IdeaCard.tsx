import React from 'react';
import { Link } from 'react-router-dom';
import type { Idea } from '../types';
import StatusBadge from './StatusBadge';
import { User } from 'lucide-react';

interface IdeaCardProps {
  idea: Idea;
  isHighlighted?: boolean;
}

const IdeaCard: React.FC<IdeaCardProps> = ({ idea, isHighlighted = false }) => {
  const description = idea.summary || idea.short_description;

  return (
    <Link 
      to={`/ideas/${idea.id}`} 
      className={`block bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 hover:shadow-md transition-all duration-200 cursor-pointer group h-full ${
        isHighlighted ? 'ring-2 ring-primary-400 ring-offset-2 shadow-lg' : ''
      }`}
    >
      {/* Header: Title + Status */}
      <div className="flex justify-between items-start gap-3 mb-3">
        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-2 leading-snug">
          {idea.flow_name || 'Untitled Template'}
        </h3>
        <StatusBadge status={idea.status} size="sm" />
      </div>

      {/* Description */}
      {description && (
        <p className="text-gray-500 text-sm mb-4 line-clamp-2 leading-relaxed">
          {description}
        </p>
      )}

      {/* Footer: Assigned + Price */}
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
        {/* Assigned To */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {idea.assigned_to_name ? (
            <>
              <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center">
                <User className="w-4 h-4 text-primary-600" />
              </div>
              <span className="truncate max-w-[120px]">{idea.assigned_to_name}</span>
            </>
          ) : (
            <span className="text-gray-400 italic">Unassigned</span>
          )}
        </div>

        {/* Price - Prominent */}
        <div className="text-right">
          <span className="text-xl font-bold text-primary-600">
            ${Number(idea.price || 0).toFixed(0)}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default IdeaCard;
