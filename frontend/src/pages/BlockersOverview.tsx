import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { blockersApi } from '../services/api';
import type { Blocker, BlockerType } from '../types';
import { AlertTriangle, CheckCircle, Filter, Loader, MessageSquare } from 'lucide-react';

const BlockersOverview: React.FC = () => {
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<BlockerType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'open' | 'resolved' | 'all'>('open');
  const navigate = useNavigate();

  useEffect(() => {
    loadBlockers();
    loadStats();
  }, [filterStatus]);

  const loadBlockers = async () => {
    try {
      setLoading(true);
      const response = await blockersApi.getAll(filterStatus === 'all' ? undefined : filterStatus);
      setBlockers(response.data);
    } catch (error) {
      console.error('Failed to load blockers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await blockersApi.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const filteredBlockers = filterType === 'all' 
    ? blockers 
    : blockers.filter(b => b.blocker_type === filterType);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTypeLabel = (type: string) => {
    return type.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Blockers & Issues</h1>
        <p className="text-gray-600">Track what's preventing templates from being completed</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-orange-700 mb-1">Total Open</p>
                <p className="text-3xl font-bold text-orange-900">{stats.total_open}</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-orange-400" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 mb-1">Total Resolved</p>
                <p className="text-3xl font-bold text-green-900">{stats.total_resolved}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-400" />
            </div>
          </div>

          <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div>
              <p className="text-sm text-blue-700 mb-2">By Type</p>
              <div className="space-y-1">
                {stats.by_type.slice(0, 3).map((item: any) => (
                  <div key={item.blocker_type} className="flex justify-between text-xs">
                    <span className="text-blue-700">{getTypeLabel(item.blocker_type)}:</span>
                    <span className="font-bold text-blue-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <div>
              <p className="text-sm text-red-700 mb-2">By Priority</p>
              <div className="space-y-1">
                {stats.by_priority.map((item: any) => (
                  <div key={item.priority} className="flex justify-between text-xs">
                    <span className="text-red-700 capitalize">{item.priority}:</span>
                    <span className="font-bold text-red-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-700 mb-1">Resolved (7d)</p>
                <p className="text-3xl font-bold text-purple-900">{stats.recently_resolved}</p>
              </div>
              <CheckCircle className="w-12 h-12 text-purple-400" />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex items-center space-x-4 flex-wrap">
          <Filter className="w-5 h-5 text-gray-600" />
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="input-field w-40"
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="all">All</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-gray-700">Type:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="input-field w-64"
            >
              <option value="all">All Types ({blockers.length})</option>
              <option value="missing_integration">Missing Integration</option>
              <option value="missing_action">Missing Action</option>
              <option value="platform_limitation">Platform Limitation</option>
              <option value="bug">Bug</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Blockers List */}
      <div className="space-y-4">
        {filteredBlockers.length === 0 ? (
          <div className="card text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No open blockers!</p>
            <p className="text-sm text-gray-400 mt-1">All templates are ready to go 🎉</p>
          </div>
        ) : (
          filteredBlockers.map((blocker) => (
            <div
              key={blocker.id}
              onClick={() => navigate(`/ideas/${blocker.idea_id}`)}
              className={`card cursor-pointer hover:shadow-lg transition-all border-l-4 ${
                blocker.status === 'resolved' 
                  ? 'border-l-green-500 bg-green-50'
                  : blocker.priority === 'critical' 
                  ? 'border-l-red-500' 
                  : blocker.priority === 'high' 
                  ? 'border-l-orange-500' 
                  : blocker.priority === 'medium' 
                  ? 'border-l-yellow-500' 
                  : 'border-l-gray-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {blocker.flow_name || blocker.use_case}
                    </h3>
                    {blocker.department && (
                      <span className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded">
                        {blocker.department}
                      </span>
                    )}
                    {blocker.status === 'resolved' && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded flex items-center">
                        <CheckCircle className="w-3 h-3 mr-1" /> Resolved
                      </span>
                    )}
                  </div>

                  <div className="flex items-start space-x-3 mb-3">
                    {blocker.status === 'resolved' ? (
                      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-500" />
                    ) : (
                      <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        blocker.priority === 'critical' ? 'text-red-500' :
                        blocker.priority === 'high' ? 'text-orange-500' :
                        'text-yellow-500'
                      }`} />
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 mb-1">{blocker.title}</p>
                      <p className="text-sm text-gray-600">{blocker.description}</p>
                      {blocker.resolution_notes && (
                        <div className="mt-2 p-2 bg-green-100 rounded text-sm">
                          <p className="font-medium text-green-800">Resolution:</p>
                          <p className="text-gray-700">{blocker.resolution_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 text-xs text-gray-500">
                    <span className={`px-2 py-1 rounded font-medium ${getPriorityColor(blocker.priority)}`}>
                      {blocker.priority.toUpperCase()}
                    </span>
                    <span className="px-2 py-1 rounded bg-blue-100 text-blue-700">
                      {getTypeLabel(blocker.blocker_type)}
                    </span>
                    {blocker.discussion_count !== undefined && blocker.discussion_count > 0 && (
                      <span className="flex items-center space-x-1 px-2 py-1 rounded bg-purple-100 text-purple-700">
                        <MessageSquare className="w-3 h-3" />
                        <span>{blocker.discussion_count}</span>
                      </span>
                    )}
                    {blocker.assigned_to_name && (
                      <span>Assigned to: {blocker.assigned_to_name}</span>
                    )}
                    <span>Added {new Date(blocker.created_at).toLocaleDateString()}</span>
                    {blocker.resolved_at && (
                      <span>• Resolved {new Date(blocker.resolved_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BlockersOverview;

