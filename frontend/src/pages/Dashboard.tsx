import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useSearchParams } from 'react-router-dom';
import { ideasApi, departmentsApi, analyticsApi } from '../services/api';
import type { Idea, Department, User } from '../types';
import IdeaCard from '../components/IdeaCard';
import StatusLegend from '../components/StatusLegend';
import { Plus, Loader, Wifi, WifiOff, X, ChevronDown, Search, User as UserIcon, Users } from 'lucide-react';

// Template analytics map type
interface TemplateAnalytics {
  totalViews: number;
  totalInstalls: number;
  uniqueUsersInstalled: number;
  activeFlows: number;
  conversionRate: number;
}

// Format normalization helpers
const normalizeCostPerYear = (value: string): string => {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (/^\$[\d,]+\/year$/i.test(trimmed)) return trimmed;
  const numericMatch = trimmed.replace(/,/g, '').match(/[\d.]+/);
  if (!numericMatch) return value;
  const numericValue = parseFloat(numericMatch[0]);
  if (isNaN(numericValue)) return value;
  const formattedNumber = numericValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `$${formattedNumber}/year`;
};

const normalizeTimeSavePerWeek = (value: string): string => {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim().toLowerCase();
  if (/^[\d.]+\s+(hours?|minutes?)$/i.test(trimmed)) {
    const match = trimmed.match(/^([\d.]+)\s*(hours?|minutes?)$/i);
    if (match) {
      const num = match[1];
      const unit = match[2].toLowerCase();
      const normalizedUnit = unit.startsWith('hour') 
        ? (parseFloat(num) === 1 ? 'hour' : 'hours')
        : (parseFloat(num) === 1 ? 'minute' : 'minutes');
      return `${num} ${normalizedUnit}`;
    }
  }
  const numericMatch = trimmed.match(/^([\d.]+)/);
  if (!numericMatch) return value;
  const numericValue = parseFloat(numericMatch[1]);
  if (isNaN(numericValue)) return value;
  const isMinutes = /min|m$|mins/i.test(trimmed);
  if (isMinutes) {
    return `${numericValue} ${numericValue === 1 ? 'minute' : 'minutes'}`;
  }
  return `${numericValue} ${numericValue === 1 ? 'hour' : 'hours'}`;
};

const Dashboard: React.FC = () => {
  const { user, isAdmin, isFreelancer } = useAuth();
  const { subscribe, isConnected } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Status filter - default to 'active_and_available' for freelancers (hides published), 'all' for admins
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus) return urlStatus;
    return isFreelancer ? 'active_and_available' : 'all';
  });
  // Assignee filter - 'all' means no assignee filter, null means unassigned, number means specific user
  const [assigneeFilter, setAssigneeFilter] = useState<string>(() => {
    return searchParams.get('assignee') || 'all';
  });
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    return searchParams.get('search') || '';
  });
  const [filtersInitialized, setFiltersInitialized] = useState(false);
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
  const [freelancerUsers, setFreelancerUsers] = useState<User[]>([]);
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [templateAnalytics, setTemplateAnalytics] = useState<Map<number, TemplateAnalytics>>(new Map());

  useEffect(() => {
    loadIdeas();
    loadDepartments();
    loadTemplateAnalytics();
    if (isAdmin) {
      loadAdmins();
      loadFreelancers();
    }
  }, [isAdmin]);

  // Initialize filters from URL on mount (handles browser back/forward and page refresh)
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    const urlAssignee = searchParams.get('assignee');
    const urlSearch = searchParams.get('search');
    
    if (urlStatus) setStatusFilter(urlStatus);
    if (urlAssignee) setAssigneeFilter(urlAssignee);
    if (urlSearch) setSearchQuery(urlSearch);
    
    setFiltersInitialized(true);
  }, []); // Only run once on mount

  // Sync filters TO URL parameters when they change (after initialization)
  useEffect(() => {
    if (!filtersInitialized) return;
    
    const params = new URLSearchParams();
    
    // Only add non-default values to URL
    const defaultStatus = isFreelancer ? 'active_and_available' : 'all';
    if (statusFilter !== defaultStatus) {
      params.set('status', statusFilter);
    }
    if (assigneeFilter !== 'all') {
      params.set('assignee', assigneeFilter);
    }
    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
    }
    
    setSearchParams(params, { replace: true });
  }, [statusFilter, assigneeFilter, searchQuery, isFreelancer, filtersInitialized, setSearchParams]);

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

  const loadFreelancers = async () => {
    try {
      const response = await ideasApi.getFreelancers();
      setFreelancerUsers(response.data);
    } catch (error) {
      console.error('Failed to load freelancers:', error);
    }
  };

  const loadTemplateAnalytics = async () => {
    try {
      const response = await analyticsApi.getPublishedTemplatesAnalytics();
      const analyticsMap = new Map<number, TemplateAnalytics>();
      response.data.templates.forEach((t) => {
        analyticsMap.set(t.ideaId, t.analytics);
      });
      setTemplateAnalytics(analyticsMap);
    } catch (error) {
      console.error('Failed to load template analytics:', error);
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

  // "Available to pick up" = unassigned AND status is 'new' (ready for someone to take)
  const availableIdeas = ideas.filter((i) => i.assigned_to === null && i.status === 'new');
  
  // "My templates" = assigned to current user (excluding published/archived for active count)
  const myIdeas = ideas.filter((i) => i.assigned_to === user?.id);
  const myActiveIdeas = myIdeas.filter((i) => i.status !== 'published' && i.status !== 'archived');
  
  // For freelancers: templates they have published
  const myPublishedIdeas = ideas.filter((i) => i.assigned_to === user?.id && i.status === 'published');

  // Get the base ideas list for filtering
  // For freelancers: Only show templates that are relevant to them
  const getBaseIdeasForFreelancer = () => {
    return ideas.filter((idea) => {
      // Show unassigned/new templates (available to pick up)
      if (idea.assigned_to === null && idea.status === 'new') return true;
      // Show templates assigned to current user
      if (idea.assigned_to === user?.id) return true;
      // Hide everything else (templates assigned to others)
      return false;
    });
  };

  const filteredIdeas = (isFreelancer ? getBaseIdeasForFreelancer() : ideas).filter((idea) => {
    // First, apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const name = (idea.flow_name || '').toLowerCase();
      if (!name.includes(query)) return false;
    }
    
    // For freelancers: Apply simple category filter
    if (isFreelancer) {
      if (statusFilter === 'all') return true;
      // Default view: Available to pick up + My active work (excludes published)
      if (statusFilter === 'active_and_available') {
        // Show available templates OR my non-published templates
        const isAvailable = idea.assigned_to === null && idea.status === 'new';
        const isMyActive = idea.assigned_to === user?.id && idea.status !== 'published' && idea.status !== 'archived';
        return isAvailable || isMyActive;
      }
      if (statusFilter === 'available') return idea.assigned_to === null && idea.status === 'new';
      if (statusFilter === 'my_active') return idea.assigned_to === user?.id && idea.status !== 'published' && idea.status !== 'archived';
      if (statusFilter === 'my_published') return idea.assigned_to === user?.id && idea.status === 'published';
      // Individual status filters - only show their own templates with that status
      if (['assigned', 'in_progress', 'submitted', 'needs_fixes', 'reviewed'].includes(statusFilter)) {
        return idea.assigned_to === user?.id && idea.status === statusFilter;
      }
      return idea.status === statusFilter;
    }
    
    // For admins: Apply both status and assignee filters
    let passesStatusFilter = true;
    let passesAssigneeFilter = true;
    
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'active') {
        passesStatusFilter = idea.status !== 'published' && idea.status !== 'archived';
      } else {
        passesStatusFilter = idea.status === statusFilter;
      }
    }
    
    // Assignee filter
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned') {
        passesAssigneeFilter = idea.assigned_to === null;
      } else {
        passesAssigneeFilter = idea.assigned_to === parseInt(assigneeFilter, 10);
      }
    }
    
    return passesStatusFilter && passesAssigneeFilter;
  });

  // Get ideas filtered by current assignee (for admin stats)
  const getIdeasForCurrentAssignee = () => {
    if (assigneeFilter === 'all') return ideas;
    if (assigneeFilter === 'unassigned') return ideas.filter(i => i.assigned_to === null);
    return ideas.filter(i => i.assigned_to === parseInt(assigneeFilter, 10));
  };
  
  const assigneeFilteredIdeas = getIdeasForCurrentAssignee();

  // Get filtered count for assignee filter context (shows count per assignee for dropdown)
  const getCountForAssignee = (assigneeId: string) => {
    const baseIdeas = statusFilter === 'all' 
      ? ideas 
      : statusFilter === 'active' 
        ? ideas.filter(i => i.status !== 'published' && i.status !== 'archived')
        : ideas.filter(i => i.status === statusFilter);
    
    if (assigneeId === 'all') return baseIdeas.length;
    if (assigneeId === 'unassigned') return baseIdeas.filter(i => i.assigned_to === null).length;
    return baseIdeas.filter(i => i.assigned_to === parseInt(assigneeId, 10)).length;
  };

  // For admins: stats reflect the current assignee filter
  // For freelancers: stats are based on all their visible ideas
  const statsBase = isAdmin ? assigneeFilteredIdeas : ideas;

  const stats = {
    total: assigneeFilteredIdeas.length, // Shows count for current assignee
    totalAll: ideas.length, // Total overall for reference
    active: statsBase.filter((i) => i.status !== 'published' && i.status !== 'archived').length,
    my_ideas: myActiveIdeas.length,
    my_published: myPublishedIdeas.length,
    available: availableIdeas.length,
    new: statsBase.filter((i) => i.status === 'new').length,
    assigned: statsBase.filter((i) => i.status === 'assigned').length,
    in_progress: statsBase.filter((i) => i.status === 'in_progress').length,
    submitted: statsBase.filter((i) => i.status === 'submitted').length,
    // Breakdown of submitted: new submissions vs resubmissions
    submitted_new: statsBase.filter((i) => i.status === 'submitted' && (i.fix_count || 0) === 0).length,
    submitted_resubmitted: statsBase.filter((i) => i.status === 'submitted' && (i.fix_count || 0) > 0).length,
    needs_fixes: statsBase.filter((i) => i.status === 'needs_fixes').length,
    reviewed: statsBase.filter((i) => i.status === 'reviewed').length,
    published: statsBase.filter((i) => i.status === 'published').length,
    archived: statsBase.filter((i) => i.status === 'archived').length,
  };
  
  // Clear filters helper
  const clearFilters = () => {
    const defaultStatus = isFreelancer ? 'active_and_available' : 'all';
    setStatusFilter(defaultStatus);
    setAssigneeFilter('all');
    setSearchQuery('');
    // Clear URL params
    setSearchParams({}, { replace: true });
  };
  
  const defaultStatusFilter = isFreelancer ? 'active_and_available' : 'all';
  const hasActiveFilters = statusFilter !== defaultStatusFilter || assigneeFilter !== 'all' || searchQuery.trim() !== '';

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <button
            onClick={() => setStatusFilter('available')}
            className={`card text-left transition-all duration-150 hover:shadow-md ${
              statusFilter === 'available' 
                ? 'bg-green-100 border-green-400 ring-2 ring-green-200' 
                : 'bg-green-50 border-green-200 hover:border-green-300'
            }`}
          >
            <div className="text-2xl font-bold text-green-600">{stats.available}</div>
            <div className="text-sm text-green-800">Available</div>
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`card text-left transition-all duration-150 hover:shadow-md ${
              statusFilter === 'in_progress' 
                ? 'bg-yellow-100 border-yellow-400 ring-2 ring-yellow-200' 
                : 'bg-yellow-50 border-yellow-200 hover:border-yellow-300'
            }`}
          >
            <div className="text-2xl font-bold text-yellow-600">{myIdeas.filter(i => i.status === 'in_progress').length}</div>
            <div className="text-sm text-yellow-800">In Progress</div>
          </button>
          <button
            onClick={() => setStatusFilter('submitted')}
            className={`card text-left transition-all duration-150 hover:shadow-md ${
              statusFilter === 'submitted' 
                ? 'bg-pink-100 border-pink-400 ring-2 ring-pink-200' 
                : 'bg-pink-50 border-pink-200 hover:border-pink-300'
            }`}
          >
            <div className="text-2xl font-bold text-pink-600">{myIdeas.filter(i => i.status === 'submitted').length}</div>
            <div className="text-sm text-pink-800">Submitted</div>
          </button>
          <button
            onClick={() => setStatusFilter('needs_fixes')}
            className={`card text-left transition-all duration-150 hover:shadow-md ${
              statusFilter === 'needs_fixes' 
                ? 'bg-red-100 border-red-400 ring-2 ring-red-200' 
                : 'bg-red-50 border-red-200 hover:border-red-300'
            }`}
          >
            <div className="text-2xl font-bold text-red-600">{myIdeas.filter(i => i.status === 'needs_fixes').length}</div>
            <div className="text-sm text-red-800">Needs Fixes</div>
          </button>
          <button
            onClick={() => setStatusFilter('reviewed')}
            className={`card text-left transition-all duration-150 hover:shadow-md ${
              statusFilter === 'reviewed' 
                ? 'bg-teal-100 border-teal-400 ring-2 ring-teal-200' 
                : 'bg-teal-50 border-teal-200 hover:border-teal-300'
            }`}
          >
            <div className="text-2xl font-bold text-teal-600">{myIdeas.filter(i => i.status === 'reviewed').length}</div>
            <div className="text-sm text-teal-800">Reviewed</div>
          </button>
          <button
            onClick={() => setStatusFilter('my_published')}
            className={`card text-left transition-all duration-150 hover:shadow-md ${
              statusFilter === 'my_published' 
                ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-200' 
                : 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
            }`}
          >
            <div className="text-2xl font-bold text-emerald-600">{stats.my_published}</div>
            <div className="text-sm text-emerald-800">Published</div>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
          <button
            onClick={() => { setStatusFilter('all'); setAssigneeFilter('all'); }}
            className={`card text-left transition-all duration-150 hover:shadow-md cursor-pointer ${
              statusFilter === 'all' && assigneeFilter === 'all'
                ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-200' 
                : 'bg-blue-50 border-blue-200 hover:border-blue-300'
            }`}
          >
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-blue-800">Total</div>
          </button>
          <button
            onClick={() => setStatusFilter('new')}
            className={`card text-left transition-all duration-150 hover:shadow-md cursor-pointer ${
              statusFilter === 'new'
                ? 'bg-purple-100 border-purple-400 ring-2 ring-purple-200' 
                : 'bg-purple-50 border-purple-200 hover:border-purple-300'
            }`}
          >
            <div className="text-2xl font-bold text-purple-600">{stats.new}</div>
            <div className="text-sm text-purple-800">New</div>
          </button>
          <button
            onClick={() => setStatusFilter('assigned')}
            className={`card text-left transition-all duration-150 hover:shadow-md cursor-pointer ${
              statusFilter === 'assigned'
                ? 'bg-indigo-100 border-indigo-400 ring-2 ring-indigo-200' 
                : 'bg-indigo-50 border-indigo-200 hover:border-indigo-300'
            }`}
          >
            <div className="text-2xl font-bold text-indigo-600">{stats.assigned}</div>
            <div className="text-sm text-indigo-800">Assigned</div>
          </button>
          <button
            onClick={() => setStatusFilter('in_progress')}
            className={`card text-left transition-all duration-150 hover:shadow-md cursor-pointer ${
              statusFilter === 'in_progress'
                ? 'bg-yellow-100 border-yellow-400 ring-2 ring-yellow-200' 
                : 'bg-yellow-50 border-yellow-200 hover:border-yellow-300'
            }`}
          >
            <div className="text-2xl font-bold text-yellow-600">{stats.in_progress}</div>
            <div className="text-sm text-yellow-800">In Progress</div>
          </button>
          <button
            onClick={() => setStatusFilter('submitted')}
            className={`card text-left transition-all duration-150 hover:shadow-md cursor-pointer ${
              statusFilter === 'submitted'
                ? 'bg-pink-100 border-pink-400 ring-2 ring-pink-200' 
                : 'bg-pink-50 border-pink-200 hover:border-pink-300'
            }`}
          >
            <div className="text-2xl font-bold text-pink-600">{stats.submitted}</div>
            <div className="text-sm text-pink-800">Submitted</div>
            {stats.submitted_resubmitted > 0 && (
              <div className="text-xs text-pink-600 mt-1 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{stats.submitted_new} new</span>
                <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">{stats.submitted_resubmitted} resub</span>
              </div>
            )}
          </button>
          <button
            onClick={() => setStatusFilter('needs_fixes')}
            className={`card text-left transition-all duration-150 hover:shadow-md cursor-pointer ${
              statusFilter === 'needs_fixes'
                ? 'bg-red-100 border-red-400 ring-2 ring-red-200' 
                : 'bg-red-50 border-red-200 hover:border-red-300'
            }`}
          >
            <div className="text-2xl font-bold text-red-600">{stats.needs_fixes}</div>
            <div className="text-sm text-red-800">Needs Fixes</div>
          </button>
          <button
            onClick={() => setStatusFilter('reviewed')}
            className={`card text-left transition-all duration-150 hover:shadow-md cursor-pointer ${
              statusFilter === 'reviewed'
                ? 'bg-green-100 border-green-400 ring-2 ring-green-200' 
                : 'bg-green-50 border-green-200 hover:border-green-300'
            }`}
          >
            <div className="text-2xl font-bold text-green-600">{stats.reviewed}</div>
            <div className="text-sm text-green-800">Reviewed</div>
          </button>
          <button
            onClick={() => setStatusFilter('published')}
            className={`card text-left transition-all duration-150 hover:shadow-md cursor-pointer ${
              statusFilter === 'published'
                ? 'bg-emerald-100 border-emerald-400 ring-2 ring-emerald-200' 
                : 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
            }`}
          >
            <div className="text-2xl font-bold text-emerald-600">{stats.published}</div>
            <div className="text-sm text-emerald-800">Published</div>
          </button>
        </div>
      )}

      {/* Search & Filter */}
      <div className="card mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates by name..."
            className="input-field pl-10 w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Filters Section */}
        {isFreelancer ? (
          /* Freelancer Filter Pills */
          <div className="space-y-3">
            {/* Quick Filters Row */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">Quick Filters:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter('active_and_available')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                  statusFilter === 'active_and_available'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200'
                }`}
              >
                🏠 My Work ({stats.available + stats.my_ideas})
              </button>
              <button
                onClick={() => setStatusFilter('available')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                  statusFilter === 'available'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                }`}
              >
                🆕 Available ({stats.available})
              </button>
              <button
                onClick={() => setStatusFilter('my_active')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                  statusFilter === 'my_active'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                👤 My Active ({stats.my_ideas})
              </button>
              <button
                onClick={() => setStatusFilter('my_published')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                  statusFilter === 'my_published'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                ✓ My Published ({stats.my_published})
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                  statusFilter === 'all'
                    ? 'bg-gray-700 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({getBaseIdeasForFreelancer().length})
              </button>
            </div>
            
            {/* Status Filters Row */}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                <span className="font-medium">By Status:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const myAssigned = myIdeas.filter(i => i.status === 'assigned').length;
                  const myInProgress = myIdeas.filter(i => i.status === 'in_progress').length;
                  const mySubmitted = myIdeas.filter(i => i.status === 'submitted').length;
                  const myNeedsFixes = myIdeas.filter(i => i.status === 'needs_fixes').length;
                  const myReviewed = myIdeas.filter(i => i.status === 'reviewed').length;
                  
                  return (
                    <>
                      <button
                        onClick={() => setStatusFilter('assigned')}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                          statusFilter === 'assigned'
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                        }`}
                      >
                        Assigned ({myAssigned})
                      </button>
                      <button
                        onClick={() => setStatusFilter('in_progress')}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                          statusFilter === 'in_progress'
                            ? 'bg-yellow-600 text-white shadow-sm'
                            : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                        }`}
                      >
                        In Progress ({myInProgress})
                      </button>
                      <button
                        onClick={() => setStatusFilter('submitted')}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                          statusFilter === 'submitted'
                            ? 'bg-pink-600 text-white shadow-sm'
                            : 'bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200'
                        }`}
                      >
                        Submitted ({mySubmitted})
                      </button>
                      <button
                        onClick={() => setStatusFilter('needs_fixes')}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                          statusFilter === 'needs_fixes'
                            ? 'bg-red-600 text-white shadow-sm'
                            : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                        }`}
                      >
                        Needs Fixes ({myNeedsFixes})
                      </button>
                      <button
                        onClick={() => setStatusFilter('reviewed')}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
                          statusFilter === 'reviewed'
                            ? 'bg-teal-600 text-white shadow-sm'
                            : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200'
                        }`}
                      >
                        Reviewed ({myReviewed})
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : (
          /* Admin Filters */
          <div className="space-y-4">
            {/* Status Filter Pills */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">Status:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                    statusFilter === 'all'
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({stats.total})
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                    statusFilter === 'active'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  In Progress ({stats.active})
                </button>
                <button
                  onClick={() => setStatusFilter('new')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                    statusFilter === 'new'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                  }`}
                >
                  New ({stats.new})
                </button>
                <button
                  onClick={() => setStatusFilter('assigned')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                    statusFilter === 'assigned'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                  }`}
                >
                  Assigned ({stats.assigned})
                </button>
                <button
                  onClick={() => setStatusFilter('in_progress')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                    statusFilter === 'in_progress'
                      ? 'bg-yellow-600 text-white shadow-sm'
                      : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200'
                  }`}
                >
                  Working ({stats.in_progress})
                </button>
                <button
                  onClick={() => setStatusFilter('submitted')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                    statusFilter === 'submitted'
                      ? 'bg-pink-600 text-white shadow-sm'
                      : 'bg-pink-50 text-pink-700 hover:bg-pink-100 border border-pink-200'
                  }`}
                >
                  Submitted ({stats.submitted})
                </button>
                <button
                  onClick={() => setStatusFilter('needs_fixes')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                    statusFilter === 'needs_fixes'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                  }`}
                >
                  Needs Fixes ({stats.needs_fixes})
                </button>
                <button
                  onClick={() => setStatusFilter('reviewed')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                    statusFilter === 'reviewed'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  Reviewed ({stats.reviewed})
                </button>
                <button
                  onClick={() => setStatusFilter('published')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
                    statusFilter === 'published'
                      ? 'bg-green-600 text-white shadow-sm'
                      : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                  }`}
                >
                  Published ({stats.published})
                </button>
              </div>
            </div>
            
            {/* Assignee Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4" />
                <span className="font-medium">Assigned to:</span>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowAssigneeDropdown(!showAssigneeDropdown)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors min-w-[200px]"
                >
                  <UserIcon className="w-4 h-4 text-gray-400" />
                  <span className="flex-1 text-left text-sm">
                    {assigneeFilter === 'all' 
                      ? 'All Assignees' 
                      : assigneeFilter === 'unassigned'
                        ? 'Unassigned'
                        : freelancerUsers.find(u => u.id === parseInt(assigneeFilter, 10))?.username || 'Unknown'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showAssigneeDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showAssigneeDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowAssigneeDropdown(false)}
                    />
                    <div className="absolute z-20 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                      <button
                        onClick={() => { setAssigneeFilter('all'); setShowAssigneeDropdown(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                          assigneeFilter === 'all' ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                        }`}
                      >
                        <Users className="w-4 h-4" />
                        <span className="flex-1 text-left">All Assignees</span>
                        <span className="text-xs text-gray-400">({getCountForAssignee('all')})</span>
                      </button>
                      <button
                        onClick={() => { setAssigneeFilter('unassigned'); setShowAssigneeDropdown(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                          assigneeFilter === 'unassigned' ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300" />
                        <span className="flex-1 text-left">Unassigned</span>
                        <span className="text-xs text-gray-400">({getCountForAssignee('unassigned')})</span>
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <div className="px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Creators
                      </div>
                      {freelancerUsers.map((freelancer) => (
                        <button
                          key={freelancer.id}
                          onClick={() => { setAssigneeFilter(String(freelancer.id)); setShowAssigneeDropdown(false); }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${
                            assigneeFilter === String(freelancer.id) ? 'bg-primary-50 text-primary-700' : 'text-gray-700'
                          }`}
                        >
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                            <span className="text-xs font-medium text-white">
                              {freelancer.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="flex-1 text-left truncate">{freelancer.username}</span>
                          <span className="text-xs text-gray-400">({getCountForAssignee(String(freelancer.id))})</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              
              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Filter Results Summary */}
        {(searchQuery || (isFreelancer ? statusFilter !== 'active_and_available' : hasActiveFilters)) && (
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium text-gray-700">{filteredIdeas.length}</span> template{filteredIdeas.length !== 1 ? 's' : ''}
              {searchQuery && <span> matching "<span className="font-medium">{searchQuery}</span>"</span>}
            </div>
            {isFreelancer && statusFilter !== 'active_and_available' && (
              <button
                onClick={() => setStatusFilter('active_and_available')}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Reset to default
              </button>
            )}
          </div>
        )}
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
              analytics={templateAnalytics.get(idea.id)}
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
                      <>
                        {/* Click outside overlay */}
                        <div 
                          className="fixed inset-0 z-[5]" 
                          onClick={() => setShowDeptDropdown(false)}
                        />
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
                      </>
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
                        onBlur={(e) => setNewIdea({ ...newIdea, time_save_per_week: normalizeTimeSavePerWeek(e.target.value) })}
                        className="input-field"
                        placeholder="e.g., 2 hours"
                      />
                      <p className="text-xs text-gray-400 mt-1">Auto-formats on blur</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cost Savings / Year
                      </label>
                      <input
                        type="text"
                        value={newIdea.cost_per_year}
                        onChange={(e) => setNewIdea({ ...newIdea, cost_per_year: e.target.value })}
                        onBlur={(e) => setNewIdea({ ...newIdea, cost_per_year: normalizeCostPerYear(e.target.value) })}
                        className="input-field"
                        placeholder="e.g., $150/year"
                      />
                      <p className="text-xs text-gray-400 mt-1">Auto-formats on blur</p>
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

