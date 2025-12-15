import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { ideasApi } from '../services/api';
import type { Idea } from '../types';
import IdeaCard from '../components/IdeaCard';
import StatusLegend from '../components/StatusLegend';
import { Plus, Filter, Loader, Wifi, WifiOff } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user, isAdmin, isFreelancer } = useAuth();
  const { subscribe, isConnected } = useSocket();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState<number | null>(null);
  const [newIdea, setNewIdea] = useState({ 
    use_case: '', 
    flow_name: '',
    short_description: '', 
    description: '', 
    department: '',
    tags: '',
    reviewer_name: '',
    price: '' 
  });

  useEffect(() => {
    loadIdeas();
  }, []);

  // Subscribe to real-time idea events
  useEffect(() => {
    // Handle new idea created
    const unsubCreated = subscribe('idea:created', (newIdea) => {
      console.log('🆕 New idea received:', newIdea);
      setIdeas(prev => {
        // Check if idea already exists
        if (prev.some(i => i.id === newIdea.id)) {
          return prev;
        }
        // For freelancers, only show unassigned or their assigned ideas
        if (isFreelancer && newIdea.assigned_to !== null && newIdea.assigned_to !== user?.id) {
          return prev;
        }
        return [newIdea, ...prev];
      });
      setRecentlyUpdated(newIdea.id);
      setTimeout(() => setRecentlyUpdated(null), 3000);
    });

    // Handle idea updated (status change, etc.)
    const unsubUpdated = subscribe('idea:updated', (updatedIdea) => {
      console.log('📝 Idea updated:', updatedIdea);
      setIdeas(prev => prev.map(idea => 
        idea.id === updatedIdea.id ? updatedIdea : idea
      ));
      setRecentlyUpdated(updatedIdea.id);
      setTimeout(() => setRecentlyUpdated(null), 3000);
    });

    // Handle idea assigned
    const unsubAssigned = subscribe('idea:assigned', (assignedIdea) => {
      console.log('👤 Idea assigned:', assignedIdea);
      setIdeas(prev => {
        // For freelancers: if assigned to someone else, remove from available list
        // unless it's their own
        if (isFreelancer && assignedIdea.assigned_to !== user?.id) {
          return prev.filter(idea => idea.id !== assignedIdea.id);
        }
        // Otherwise, update the idea
        return prev.map(idea => 
          idea.id === assignedIdea.id ? assignedIdea : idea
        );
      });
      setRecentlyUpdated(assignedIdea.id);
      setTimeout(() => setRecentlyUpdated(null), 3000);
    });

    // Handle idea deleted
    const unsubDeleted = subscribe('idea:deleted', ({ id }) => {
      console.log('🗑️ Idea deleted:', id);
      setIdeas(prev => prev.filter(idea => idea.id !== id));
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubAssigned();
      unsubDeleted();
    };
  }, [subscribe, isFreelancer, user?.id]);

  const loadIdeas = async () => {
    try {
      const response = await ideasApi.getAll();
      setIdeas(response.data);
    } catch (error) {
      console.error('Failed to load ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ideasApi.create({
        use_case: newIdea.use_case,
        flow_name: newIdea.flow_name,
        short_description: newIdea.short_description,
        description: newIdea.description,
        department: newIdea.department,
        tags: newIdea.tags,
        reviewer_name: newIdea.reviewer_name,
        price: parseFloat(newIdea.price) || 0,
      });
      setShowCreateModal(false);
      setNewIdea({ 
        use_case: '', 
        flow_name: '',
        short_description: '', 
        description: '', 
        department: '',
        tags: '',
        reviewer_name: '',
        price: '' 
      });
      loadIdeas();
    } catch (error) {
      console.error('Failed to create idea:', error);
    }
  };

  const filteredIdeas = ideas.filter((idea) => {
    if (filter === 'all') return true;
    if (filter === 'my_ideas' && isFreelancer) return idea.assigned_to === user?.id;
    if (filter === 'available' && isFreelancer) return idea.assigned_to === null;
    return idea.status === filter;
  });

  const myIdeas = ideas.filter((i) => i.assigned_to === user?.id);
  const availableIdeas = ideas.filter((i) => i.assigned_to === null);

  const stats = {
    total: ideas.length,
    my_ideas: myIdeas.length,
    available: availableIdeas.length,
    new: ideas.filter((i) => i.status === 'new').length,
    assigned: ideas.filter((i) => i.status === 'assigned').length,
    in_progress: ideas.filter((i) => i.status === 'in_progress').length,
    submitted: ideas.filter((i) => i.status === 'submitted').length,
    needs_fixes: ideas.filter((i) => i.status === 'needs_fixes').length,
    reviewed: ideas.filter((i) => i.status === 'reviewed').length,
    published: ideas.filter((i) => i.status === 'published').length,
    archived: ideas.filter((i) => i.status === 'archived').length,
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
      {/* Status Legend Helper */}
      <StatusLegend />

      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-600">Welcome back, {user?.username}!</p>
            <span 
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                isConnected 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-500'
              }`}
              title={isConnected ? 'Real-time updates active' : 'Reconnecting...'}
            >
              {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add New Template</span>
          </button>
        )}
      </div>

      {/* Stats */}
      {isFreelancer ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card bg-blue-50 border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{stats.my_ideas}</div>
            <div className="text-sm text-blue-800">My Templates</div>
          </div>
          <div className="card bg-green-50 border-green-200">
            <div className="text-2xl font-bold text-green-600">{stats.available}</div>
            <div className="text-sm text-green-800">Available</div>
          </div>
          <div className="card bg-yellow-50 border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">{stats.in_progress}</div>
            <div className="text-sm text-yellow-800">In Progress</div>
          </div>
          <div className="card bg-purple-50 border-purple-200">
            <div className="text-2xl font-bold text-purple-600">{stats.submitted}</div>
            <div className="text-sm text-purple-800">Submitted</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          <div className="card bg-blue-50 border-blue-200">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-blue-800">Total</div>
          </div>
          <div className="card bg-purple-50 border-purple-200">
            <div className="text-2xl font-bold text-purple-600">{stats.new}</div>
            <div className="text-sm text-purple-800">New</div>
          </div>
          <div className="card bg-indigo-50 border-indigo-200">
            <div className="text-2xl font-bold text-indigo-600">{stats.assigned}</div>
            <div className="text-sm text-indigo-800">Assigned</div>
          </div>
          <div className="card bg-yellow-50 border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">{stats.in_progress}</div>
            <div className="text-sm text-yellow-800">In Progress</div>
          </div>
          <div className="card bg-pink-50 border-pink-200">
            <div className="text-2xl font-bold text-pink-600">{stats.submitted}</div>
            <div className="text-sm text-pink-800">Submitted</div>
          </div>
          <div className="card bg-red-50 border-red-200">
            <div className="text-2xl font-bold text-red-600">{stats.needs_fixes}</div>
            <div className="text-sm text-red-800">Needs Fixes</div>
          </div>
          <div className="card bg-green-50 border-green-200">
            <div className="text-2xl font-bold text-green-600">{stats.reviewed}</div>
            <div className="text-sm text-green-800">Reviewed</div>
          </div>
          <div className="card bg-emerald-50 border-emerald-200">
            <div className="text-2xl font-bold text-emerald-600">{stats.published}</div>
            <div className="text-sm text-emerald-800">Published</div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="card mb-6">
        <div className="flex items-center space-x-4">
          <Filter className="w-5 h-5 text-gray-600" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input-field w-64"
          >
            <option value="all">All Templates ({stats.total})</option>
            {isFreelancer && (
              <>
                <option value="my_ideas">My Templates ({stats.my_ideas})</option>
                <option value="available">Available Templates ({stats.available})</option>
              </>
            )}
            {!isFreelancer && <option value="new">New ({stats.new})</option>}
            <option value="assigned">Assigned ({stats.assigned})</option>
            <option value="in_progress">In Progress ({stats.in_progress})</option>
            <option value="submitted">Submitted ({stats.submitted})</option>
            <option value="needs_fixes">Needs Fixes ({stats.needs_fixes})</option>
            <option value="reviewed">Reviewed ({stats.reviewed})</option>
            <option value="published">Published ({stats.published})</option>
            <option value="archived">Archived ({stats.archived})</option>
          </select>
        </div>
      </div>

      {/* Templates Grid */}
      {filteredIdeas.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">No templates found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {filteredIdeas.map((idea) => (
            <IdeaCard 
              key={idea.id} 
              idea={idea} 
              isHighlighted={recentlyUpdated === idea.id}
            />
          ))}
        </div>
      )}

      {/* Create Idea Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="card max-w-2xl w-full my-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Use Case</h2>
            <form onSubmit={handleCreateIdea} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Use Case * <span className="text-xs text-gray-500">(Category)</span>
                </label>
                <input
                  type="text"
                  value={newIdea.use_case}
                  onChange={(e) => setNewIdea({ ...newIdea, use_case: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Employee Onboarding, Invoice Processing"
                  required
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department *
                </label>
                <select
                  value={newIdea.department}
                  onChange={(e) => setNewIdea({ ...newIdea, department: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select Department</option>
                  <option value="HR">HR</option>
                  <option value="Finance">Finance</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Sales">Sales</option>
                  <option value="IT">IT</option>
                  <option value="Operations">Operations</option>
                  <option value="Customer Service">Customer Service</option>
                  <option value="Legal">Legal</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Flow Name <span className="text-xs text-gray-500">(Main Display Title)</span>
                </label>
                <input
                  type="text"
                  value={newIdea.flow_name}
                  onChange={(e) => setNewIdea({ ...newIdea, flow_name: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Automated Employee Onboarding Flow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Short Description
                </label>
                <textarea
                  value={newIdea.short_description}
                  onChange={(e) => setNewIdea({ ...newIdea, short_description: e.target.value })}
                  className="input-field"
                  rows={2}
                  placeholder="Brief summary of the use case"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newIdea.description}
                  onChange={(e) => setNewIdea({ ...newIdea, description: e.target.value })}
                  className="input-field"
                  rows={4}
                  placeholder="Detailed description of the use case"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                <input
                  type="text"
                  value={newIdea.tags}
                  onChange={(e) => setNewIdea({ ...newIdea, tags: e.target.value })}
                  className="input-field"
                  placeholder="e.g., automation, integration, workflow (comma-separated)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reviewer Name
                </label>
                <input
                  type="text"
                  value={newIdea.reviewer_name}
                  onChange={(e) => setNewIdea({ ...newIdea, reviewer_name: e.target.value })}
                  className="input-field"
                  placeholder="Name of the person who will review this"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price ($)
                </label>
                <input
                  type="number"
                  value={newIdea.price}
                  onChange={(e) => setNewIdea({ ...newIdea, price: e.target.value })}
                  className="input-field"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="btn-primary flex-1">
                  Create Use Case
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

