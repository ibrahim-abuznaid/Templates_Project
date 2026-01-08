import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { suggestionsApi, departmentsApi } from '../services/api';
import type { SuggestedIdea, Department, SuggestionStatus } from '../types';
import { 
  Lightbulb, 
  Plus, 
  Loader, 
  X, 
  ChevronDown, 
  Check, 
  XCircle, 
  Clock,
  MessageSquare,
  User,
  Calendar,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Suggestions: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const { subscribe } = useSocket();
  const [suggestions, setSuggestions] = useState<SuggestedIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState<SuggestedIdea | null>(null);
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus | 'all'>('all');
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([]);
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [newSuggestion, setNewSuggestion] = useState({
    flow_name: '',
    idea_notes: ''
  });

  const [reviewData, setReviewData] = useState({
    review_note: ''
  });

  useEffect(() => {
    loadSuggestions();
    loadDepartments();
  }, [statusFilter]);

  // Subscribe to real-time suggestion events
  useEffect(() => {
    const unsubCreated = subscribe('suggestion:created', (newSuggestion) => {
      setSuggestions(prev => [newSuggestion, ...prev]);
    });

    const unsubUpdated = subscribe('suggestion:updated', (updated) => {
      setSuggestions(prev => prev.map(s => s.id === updated.id ? updated : s));
    });

    const unsubApproved = subscribe('suggestion:approved', (approved) => {
      setSuggestions(prev => prev.map(s => s.id === approved.id ? approved : s));
    });

    const unsubDenied = subscribe('suggestion:denied', (denied) => {
      setSuggestions(prev => prev.map(s => s.id === denied.id ? denied : s));
    });

    const unsubDeleted = subscribe('suggestion:deleted', ({ id }) => {
      setSuggestions(prev => prev.filter(s => s.id !== id));
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubApproved();
      unsubDenied();
      unsubDeleted();
    };
  }, [subscribe]);

  const loadSuggestions = async () => {
    try {
      const response = await suggestionsApi.getAll(statusFilter === 'all' ? undefined : statusFilter);
      setSuggestions(response.data);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const response = await departmentsApi.getAll();
      setAllDepartments(response.data);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const handleCreateSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuggestion.flow_name.trim()) return;
    if (selectedDepartmentIds.length === 0) return;
    
    setSubmitting(true);
    try {
      await suggestionsApi.create({
        flow_name: newSuggestion.flow_name.trim(),
        idea_notes: newSuggestion.idea_notes.trim() || undefined,
        department_ids: selectedDepartmentIds
      });
      
      setShowCreateModal(false);
      setNewSuggestion({ flow_name: '', idea_notes: '' });
      setSelectedDepartmentIds([]);
      loadSuggestions();
    } catch (error) {
      console.error('Failed to create suggestion:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (suggestion: SuggestedIdea) => {
    setSubmitting(true);
    try {
      await suggestionsApi.approve(suggestion.id, { review_note: reviewData.review_note });
      setShowReviewModal(null);
      setReviewData({ review_note: '' });
      loadSuggestions();
    } catch (error) {
      console.error('Failed to approve suggestion:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeny = async (suggestion: SuggestedIdea) => {
    setSubmitting(true);
    try {
      await suggestionsApi.deny(suggestion.id, { review_note: reviewData.review_note });
      setShowReviewModal(null);
      setReviewData({ review_note: '' });
      loadSuggestions();
    } catch (error) {
      console.error('Failed to deny suggestion:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this suggestion?')) return;
    
    try {
      await suggestionsApi.delete(id);
      loadSuggestions();
    } catch (error) {
      console.error('Failed to delete suggestion:', error);
    }
  };

  const getStatusBadge = (status: SuggestionStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Clock className="w-3 h-3" />
            Pending Review
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <Check className="w-3 h-3" />
            Approved
          </span>
        );
      case 'denied':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            Not Approved
          </span>
        );
    }
  };

  const stats = {
    total: suggestions.length,
    pending: suggestions.filter(s => s.status === 'pending').length,
    approved: suggestions.filter(s => s.status === 'approved').length,
    denied: suggestions.filter(s => s.status === 'denied').length
  };

  const filteredSuggestions = statusFilter === 'all' 
    ? suggestions 
    : suggestions.filter(s => s.status === statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-amber-500" />
            Template Suggestions
          </h1>
          <p className="text-gray-600 mt-1">
            {isAdmin 
              ? 'Review and manage template suggestions from creators'
              : 'Suggest new template ideas for the platform'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>Suggest an Idea</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <button
          onClick={() => setStatusFilter('all')}
          className={`card text-left transition-all duration-150 hover:shadow-md ${
            statusFilter === 'all' 
              ? 'bg-blue-100 border-blue-400 ring-2 ring-blue-200' 
              : 'bg-blue-50 border-blue-200 hover:border-blue-300'
          }`}
        >
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-blue-800">Total</div>
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          className={`card text-left transition-all duration-150 hover:shadow-md ${
            statusFilter === 'pending' 
              ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-200' 
              : 'bg-amber-50 border-amber-200 hover:border-amber-300'
          }`}
        >
          <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
          <div className="text-sm text-amber-800">Pending</div>
        </button>
        <button
          onClick={() => setStatusFilter('approved')}
          className={`card text-left transition-all duration-150 hover:shadow-md ${
            statusFilter === 'approved' 
              ? 'bg-green-100 border-green-400 ring-2 ring-green-200' 
              : 'bg-green-50 border-green-200 hover:border-green-300'
          }`}
        >
          <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          <div className="text-sm text-green-800">Approved</div>
        </button>
        <button
          onClick={() => setStatusFilter('denied')}
          className={`card text-left transition-all duration-150 hover:shadow-md ${
            statusFilter === 'denied' 
              ? 'bg-red-100 border-red-400 ring-2 ring-red-200' 
              : 'bg-red-50 border-red-200 hover:border-red-300'
          }`}
        >
          <div className="text-2xl font-bold text-red-600">{stats.denied}</div>
          <div className="text-sm text-red-800">Not Approved</div>
        </button>
      </div>

      {/* Suggestions List */}
      {filteredSuggestions.length === 0 ? (
        <div className="card text-center py-12">
          <Lightbulb className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {statusFilter === 'all' ? 'No suggestions yet' : `No ${statusFilter} suggestions`}
          </h3>
          <p className="text-gray-500 mb-6">
            {isAdmin 
              ? 'Template creators can submit suggestions for new template ideas.'
              : 'Have an idea for a new template? Click the button above to suggest it!'}
          </p>
          {!isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Suggest an Idea
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSuggestions.map((suggestion) => (
            <div 
              key={suggestion.id} 
              className={`card hover:shadow-md transition-shadow ${
                suggestion.status === 'pending' && isAdmin 
                  ? 'border-l-4 border-l-amber-400' 
                  : ''
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {suggestion.flow_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          {suggestion.suggested_by_name || 'Unknown'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {new Date(suggestion.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    {getStatusBadge(suggestion.status)}
                  </div>
                  
                  {suggestion.idea_notes && (
                    <div className="bg-gray-50 rounded-lg p-3 mb-3">
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">Idea Notes</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{suggestion.idea_notes}</p>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2">
                    {suggestion.departments?.map((dept) => (
                      <span 
                        key={dept.id}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
                      >
                        {dept.name}
                      </span>
                    ))}
                  </div>
                  
                  {/* Review Note (shown when reviewed) */}
                  {suggestion.review_note && suggestion.status !== 'pending' && (
                    <div className={`mt-3 p-3 rounded-lg ${
                      suggestion.status === 'approved' ? 'bg-green-50' : 'bg-red-50'
                    }`}>
                      <p className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        Review Note from {suggestion.reviewed_by_name}
                      </p>
                      <p className={`text-sm ${
                        suggestion.status === 'approved' ? 'text-green-700' : 'text-red-700'
                      }`}>
                        {suggestion.review_note}
                      </p>
                    </div>
                  )}
                  
                  {/* Link to created idea */}
                  {suggestion.status === 'approved' && suggestion.converted_idea_id && (
                    <Link 
                      to={`/ideas/${suggestion.converted_idea_id}`}
                      className="mt-3 inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      View Created Template
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex flex-row md:flex-col gap-2">
                  {isAdmin && suggestion.status === 'pending' && (
                    <>
                      <button
                        onClick={() => {
                          setShowReviewModal(suggestion);
                          setReviewData({ review_note: '' });
                        }}
                        className="btn-primary text-sm py-2 px-4"
                      >
                        Review
                      </button>
                    </>
                  )}
                  {/* Owner can delete their pending suggestions */}
                  {suggestion.suggested_by === user?.id && suggestion.status === 'pending' && (
                    <button
                      onClick={() => handleDelete(suggestion.id)}
                      className="btn-secondary text-sm py-2 px-4 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Suggestion Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center overflow-y-auto">
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Lightbulb className="w-6 h-6 text-amber-500" />
                Suggest a Template Idea
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleCreateSuggestion} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Flow Name *
                </label>
                <input
                  type="text"
                  value={newSuggestion.flow_name}
                  onChange={(e) => setNewSuggestion({ ...newSuggestion, flow_name: e.target.value })}
                  className="input-field"
                  placeholder="e.g., Slack to Notion Meeting Notes Sync"
                  required
                  autoFocus
                />
              </div>

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
                
                {showDeptDropdown && (
                  <>
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

              {/* Selected Departments Tags */}
              {selectedDepartmentIds.length > 0 && (
                <div className="flex flex-wrap gap-1">
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
                          onClick={() => setSelectedDepartmentIds(selectedDepartmentIds.filter(dId => dId !== id))}
                          className="hover:text-primary-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Idea Notes
                </label>
                <textarea
                  value={newSuggestion.idea_notes}
                  onChange={(e) => setNewSuggestion({ ...newSuggestion, idea_notes: e.target.value })}
                  className="input-field"
                  rows={4}
                  placeholder="Describe the template idea, what problem it solves, who would use it..."
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary flex-1"
                  disabled={!newSuggestion.flow_name.trim() || selectedDepartmentIds.length === 0 || submitting}
                >
                  {submitting ? (
                    <Loader className="w-5 h-5 animate-spin mx-auto" />
                  ) : (
                    'Submit Suggestion'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal (Admin only) */}
      {showReviewModal && isAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center overflow-y-auto">
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Review Suggestion</h2>
              <button
                type="button"
                onClick={() => setShowReviewModal(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              {/* Suggestion Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 text-lg mb-2">
                  {showReviewModal.flow_name}
                </h3>
                <p className="text-sm text-gray-500 mb-3">
                  Suggested by {showReviewModal.suggested_by_name} on{' '}
                  {new Date(showReviewModal.created_at).toLocaleDateString()}
                </p>
                
                {showReviewModal.idea_notes && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">Idea Notes</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{showReviewModal.idea_notes}</p>
                  </div>
                )}
                
                <div className="flex flex-wrap gap-2">
                  {showReviewModal.departments?.map((dept) => (
                    <span 
                      key={dept.id}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
                    >
                      {dept.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* What happens when approved */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-medium text-green-800 mb-2">When Approved:</h4>
                <p className="text-sm text-green-700">
                  A new template will be created and automatically assigned to <strong>{showReviewModal.suggested_by_name}</strong>.
                  They can unassign themselves if they don't want to work on it.
                </p>
              </div>

              {/* Review Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Review Note (optional)
                  </label>
                  <textarea
                    value={reviewData.review_note}
                    onChange={(e) => setReviewData({ ...reviewData, review_note: e.target.value })}
                    className="input-field"
                    rows={3}
                    placeholder="Add a note for the suggester (will be shown to them)..."
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeny(showReviewModal)}
                  className="px-6 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium"
                  disabled={submitting}
                >
                  {submitting ? <Loader className="w-5 h-5 animate-spin" /> : 'Deny'}
                </button>
                <button
                  onClick={() => handleApprove(showReviewModal)}
                  className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-medium"
                  disabled={submitting}
                >
                  {submitting ? <Loader className="w-5 h-5 animate-spin" /> : 'Approve & Create Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suggestions;
