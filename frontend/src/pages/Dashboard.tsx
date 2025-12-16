import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { ideasApi, departmentsApi } from '../services/api';
import type { Idea, Department, User } from '../types';
import IdeaCard from '../components/IdeaCard';
import StatusLegend from '../components/StatusLegend';
import { Plus, Filter, Loader, Wifi, WifiOff, X, ChevronDown } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user, isAdmin, isFreelancer } = useAuth();
  const { subscribe, isConnected } = useSocket();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState<number | null>(null);
  const [newIdea, setNewIdea] = useState({ 
    flow_name: '',
    summary: '', 
    description: '', 
    time_save_per_week: '',
    cost_per_year: '',
    author: 'Activepieces Team',
    idea_notes: '',
    scribe_url: '',
    reviewer_name: '',
    price: '' 
  });
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([]);
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [adminUsers, setAdminUsers] = useState<User[]>([]);

  useEffect(() => {
    loadIdeas();
    loadDepartments();
    if (isAdmin) {
      loadAdmins();
    }
  }, [isAdmin]);

  const loadDepartments = async () => {
    try {
      const response = await departmentsApi.getAll();
      setAllDepartments(response.data);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const loadAdmins = async () => {
    try {
      const response = await ideasApi.getAdmins();
      setAdminUsers(response.data);
    } catch (error) {
      console.error('Failed to load admins:', error);
    }
  };

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
        flow_name: newIdea.flow_name,
        summary: newIdea.summary,
        description: newIdea.description,
        department_ids: selectedDepartmentIds,
        time_save_per_week: newIdea.time_save_per_week,
        cost_per_year: newIdea.cost_per_year,
        author: newIdea.author,
        idea_notes: newIdea.idea_notes,
        scribe_url: newIdea.scribe_url,
        reviewer_name: newIdea.reviewer_name,
        price: parseFloat(newIdea.price) || 0,
      });
      setShowCreateModal(false);
      setShowDeptDropdown(false);
      setNewIdea({ 
        flow_name: '',
        summary: '', 
        description: '', 
        time_save_per_week: '',
        cost_per_year: '',
        author: 'Activepieces Team',
        idea_notes: '',
        scribe_url: '',
        reviewer_name: '',
        price: '' 
      });
      setSelectedDepartmentIds([]);
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
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center overflow-y-auto">
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 my-4 sm:my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Create New Template</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setShowDeptDropdown(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateIdea} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Flow Name *
                    </label>
                    <input
                      type="text"
                      value={newIdea.flow_name}
                      onChange={(e) => setNewIdea({ ...newIdea, flow_name: e.target.value })}
                      className="input-field"
                      placeholder="e.g., Instant Message Alerts"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Summary
                    </label>
                    <textarea
                      value={newIdea.summary}
                      onChange={(e) => setNewIdea({ ...newIdea, summary: e.target.value })}
                      className="input-field"
                      rows={2}
                      placeholder="Brief summary for public library"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newIdea.description}
                      onChange={(e) => setNewIdea({ ...newIdea, description: e.target.value })}
                      className="input-field"
                      rows={3}
                      placeholder="Detailed description"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Scribe URL (Article/Blog URL)
                    </label>
                    <input
                      type="url"
                      value={newIdea.scribe_url}
                      onChange={(e) => setNewIdea({ ...newIdea, scribe_url: e.target.value })}
                      className="input-field"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                  {/* Departments Dropdown */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Departments *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowDeptDropdown(!showDeptDropdown)}
                      className="input-field w-full text-left flex items-center justify-between"
                    >
                      <span className={selectedDepartmentIds.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
                        {selectedDepartmentIds.length === 0 
                          ? 'Select departments...' 
                          : `${selectedDepartmentIds.length} selected`}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDeptDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Selected Tags */}
                    {selectedDepartmentIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {selectedDepartmentIds.map(id => {
                          const dept = allDepartments.find(d => d.id === id);
                          return dept ? (
                            <span 
                              key={id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs"
                            >
                              {dept.name}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDepartmentIds(selectedDepartmentIds.filter(dId => dId !== id));
                                }}
                                className="hover:text-primary-900"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}

                    {/* Dropdown Menu */}
                    {showDeptDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {allDepartments.map((dept) => (
                          <label
                            key={dept.id}
                            className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedDepartmentIds.includes(dept.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedDepartmentIds([...selectedDepartmentIds, dept.id]);
                                } else {
                                  setSelectedDepartmentIds(selectedDepartmentIds.filter(id => id !== dept.id));
                                }
                              }}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
                            />
                            <span className="text-sm text-gray-700">{dept.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    
                    {selectedDepartmentIds.length === 0 && (
                      <p className="text-xs text-red-500 mt-1">Select at least one department</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Time Save / Week
                      </label>
                      <input
                        type="text"
                        value={newIdea.time_save_per_week}
                        onChange={(e) => setNewIdea({ ...newIdea, time_save_per_week: e.target.value })}
                        className="input-field"
                        placeholder="e.g., 2 hours"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cost Savings / Year
                      </label>
                      <input
                        type="text"
                        value={newIdea.cost_per_year}
                        onChange={(e) => setNewIdea({ ...newIdea, cost_per_year: e.target.value })}
                        className="input-field"
                        placeholder="e.g., $150/year"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Author
                    </label>
                    <input
                      type="text"
                      value={newIdea.author}
                      onChange={(e) => setNewIdea({ ...newIdea, author: e.target.value })}
                      className="input-field"
                      placeholder="Activepieces Team"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Idea Notes <span className="text-xs text-gray-500">(Internal)</span>
                    </label>
                    <textarea
                      value={newIdea.idea_notes}
                      onChange={(e) => setNewIdea({ ...newIdea, idea_notes: e.target.value })}
                      className="input-field"
                      rows={2}
                      placeholder="Internal notes about the template idea..."
                    />
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <p className="text-xs text-gray-500 mb-3">Internal Fields (not sent to Public Library)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Reviewer
                        </label>
                        <select
                          value={newIdea.reviewer_name}
                          onChange={(e) => setNewIdea({ ...newIdea, reviewer_name: e.target.value })}
                          className="input-field"
                        >
                          <option value="">Select reviewer...</option>
                          {adminUsers.map((admin) => (
                            <option key={admin.id} value={admin.username}>
                              {admin.username}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col-reverse sm:flex-row gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setShowDeptDropdown(false);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary flex-1"
                  disabled={selectedDepartmentIds.length === 0 || !newIdea.flow_name}
                >
                  Create Template
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

