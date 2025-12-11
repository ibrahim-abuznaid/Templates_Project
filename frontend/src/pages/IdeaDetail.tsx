import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ideasApi, usersApi, blockersApi } from '../services/api';
import type { IdeaDetail as IdeaDetailType, User, UserBasic, Blocker, BlockerType, BlockerPriority } from '../types';
import StatusBadge from '../components/StatusBadge';
import {
  ArrowLeft,
  Edit,
  Save,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  MessageSquare,
  Activity,
  User as UserIcon,
  Loader,
  AtSign,
  AlertTriangle,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const IdeaDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isFreelancer } = useAuth();

  const [idea, setIdea] = useState<IdeaDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [comment, setComment] = useState('');
  const [freelancers, setFreelancers] = useState<User[]>([]);
  const [selectedFreelancer, setSelectedFreelancer] = useState('');
  const [allUsers, setAllUsers] = useState<UserBasic[]>([]);
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [showBlockerForm, setShowBlockerForm] = useState(false);
  const [showResolvedBlockers, setShowResolvedBlockers] = useState(false);
  const [newBlocker, setNewBlocker] = useState({
    blocker_type: 'missing_integration' as BlockerType,
    title: '',
    description: '',
    priority: 'medium' as BlockerPriority
  });
  const [expandedBlocker, setExpandedBlocker] = useState<number | null>(null);
  const [blockerDiscussions, setBlockerDiscussions] = useState<{[key: number]: any[]}>({});
  const [discussionMessage, setDiscussionMessage] = useState<{[key: number]: string}>({});

  useEffect(() => {
    loadIdea();
    loadUsers();
    loadBlockers();
    if (isAdmin) {
      loadFreelancers();
    }
  }, [id]);

  const loadBlockers = async () => {
    try {
      const response = await blockersApi.getForIdea(Number(id), showResolvedBlockers);
      setBlockers(response.data);
    } catch (error) {
      console.error('Failed to load blockers:', error);
    }
  };

  useEffect(() => {
    if (id) {
      loadBlockers();
    }
  }, [showResolvedBlockers]);

  const loadBlockerDiscussions = async (blockerId: number) => {
    try {
      const response = await blockersApi.getDiscussions(blockerId);
      setBlockerDiscussions(prev => ({ ...prev, [blockerId]: response.data }));
    } catch (error) {
      console.error('Failed to load blocker discussions:', error);
    }
  };

  const toggleBlockerExpansion = (blockerId: number) => {
    if (expandedBlocker === blockerId) {
      setExpandedBlocker(null);
    } else {
      setExpandedBlocker(blockerId);
      if (!blockerDiscussions[blockerId]) {
        loadBlockerDiscussions(blockerId);
      }
    }
  };

  const handleAddDiscussion = async (blockerId: number, e: React.FormEvent) => {
    e.preventDefault();
    const message = discussionMessage[blockerId];
    if (!message || !message.trim()) return;

    try {
      await blockersApi.addDiscussion(blockerId, message);
      setDiscussionMessage(prev => ({ ...prev, [blockerId]: '' }));
      loadBlockerDiscussions(blockerId);
      loadBlockers(); // Reload to update discussion count
    } catch (error) {
      console.error('Failed to add discussion:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await usersApi.getAll();
      setAllUsers(response.data);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadIdea = async () => {
    try {
      const response = await ideasApi.getById(Number(id));
      setIdea(response.data);
      setEditData({
        use_case: response.data.use_case,
        flow_name: response.data.flow_name || '',
        short_description: response.data.short_description || '',
        description: response.data.description || '',
        setup_guide: response.data.setup_guide || '',
        template_url: response.data.template_url || '',
        scribe_url: response.data.scribe_url || '',
        department: response.data.department || '',
        tags: response.data.tags || '',
        reviewer_name: response.data.reviewer_name || '',
        price: response.data.price,
      });
    } catch (error) {
      console.error('Failed to load idea:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFreelancers = async () => {
    try {
      const response = await ideasApi.getFreelancers();
      setFreelancers(response.data);
    } catch (error) {
      console.error('Failed to load freelancers:', error);
    }
  };

  const handleUpdate = async () => {
    try {
      await ideasApi.update(Number(id), editData);
      setEditing(false);
      loadIdea();
    } catch (error) {
      console.error('Failed to update idea:', error);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await ideasApi.update(Number(id), { status: newStatus });
      loadIdea();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedFreelancer) return;
    try {
      await ideasApi.assign(Number(id), Number(selectedFreelancer));
      setSelectedFreelancer('');
      loadIdea();
    } catch (error) {
      console.error('Failed to assign idea:', error);
    }
  };

  const handleSelfAssign = async () => {
    try {
      await ideasApi.selfAssign(Number(id));
      loadIdea();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to assign idea to yourself');
      console.error('Failed to self-assign idea:', error);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      await ideasApi.addComment(Number(id), comment);
      setComment('');
      setShowMentionList(false);
      loadIdea();
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setComment(value);

    // Check if we should show mention list
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt.toLowerCase());
        setShowMentionList(true);
        return;
      }
    }
    setShowMentionList(false);
  };

  const insertMention = (handle: string) => {
    if (!commentInputRef.current) return;
    
    const cursorPosition = commentInputRef.current.selectionStart;
    const textBeforeCursor = comment.substring(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const before = comment.substring(0, lastAtIndex);
      const after = comment.substring(cursorPosition);
      const newComment = `${before}@${handle} ${after}`;
      setComment(newComment);
    }
    
    setShowMentionList(false);
    commentInputRef.current.focus();
  };

  const filteredUsers = allUsers.filter(
    u => u.handle.toLowerCase().includes(mentionSearch) || 
         u.username.toLowerCase().includes(mentionSearch)
  );

  // Render comment text with highlighted mentions
  const renderCommentText = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const handle = part.substring(1);
        const mentionedUser = allUsers.find(u => u.handle === handle);
        if (mentionedUser) {
          return (
            <span key={index} className="text-primary-600 font-medium bg-primary-50 px-1 rounded">
              {part}
            </span>
          );
        }
      }
      return part;
    });
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this idea?')) return;

    try {
      await ideasApi.delete(Number(id));
      navigate('/');
    } catch (error) {
      console.error('Failed to delete idea:', error);
    }
  };

  const handleAddBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBlocker.title || !newBlocker.description) return;

    try {
      await blockersApi.create({
        idea_id: Number(id),
        ...newBlocker
      });
      setNewBlocker({
        blocker_type: 'missing_integration',
        title: '',
        description: '',
        priority: 'medium'
      });
      setShowBlockerForm(false);
      loadBlockers();
    } catch (error) {
      console.error('Failed to add blocker:', error);
    }
  };

  const handleUpdateBlockerStatus = async (blockerId: number, status: string) => {
    let resolution_notes = '';
    
    if (status === 'resolved') {
      resolution_notes = prompt('Enter resolution notes (optional):') || '';
    }
    
    try {
      await blockersApi.update(blockerId, { 
        status: status as any,
        ...(resolution_notes && { resolution_notes })
      });
      loadBlockers();
    } catch (error) {
      console.error('Failed to update blocker:', error);
    }
  };

  const handleDeleteBlocker = async (blockerId: number) => {
    if (!confirm('Delete this blocker?')) return;

    try {
      await blockersApi.delete(blockerId);
      loadBlockers();
    } catch (error) {
      console.error('Failed to delete blocker:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Idea not found.</p>
      </div>
    );
  }

  const canEdit = isAdmin || (isFreelancer && idea.assigned_to === user?.id);
  const canReview = isAdmin;

  return (
    <div>
      <button
        onClick={() => navigate('/')}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  {editing ? (
                    <input
                      type="text"
                      value={editData.flow_name}
                      onChange={(e) => setEditData({ ...editData, flow_name: e.target.value })}
                      className="input-field text-2xl font-bold"
                      placeholder="Flow Name (Main Title)"
                    />
                  ) : (
                    <h1 className="text-2xl font-bold text-gray-900">{idea.flow_name || idea.use_case}</h1>
                  )}
                  <StatusBadge status={idea.status} />
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  {idea.department && (
                    <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded font-medium">
                      {idea.department}
                    </span>
                  )}
                  <span>Use Case: {idea.use_case}</span>
                  <span>• Created by {idea.created_by_name}</span>
                  {idea.assigned_to_name && <span>• Assigned to {idea.assigned_to_name}</span>}
                  <span>• ${idea.price}</span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {canEdit && !editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                )}
                {editing && (
                  <>
                    <button
                      onClick={handleUpdate}
                      className="btn-primary flex items-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setEditData({
                          use_case: idea.use_case,
                          flow_name: idea.flow_name || '',
                          short_description: idea.short_description || '',
                          description: idea.description || '',
                          setup_guide: idea.setup_guide || '',
                          template_url: idea.template_url || '',
                          scribe_url: idea.scribe_url || '',
                          department: idea.department || '',
                          tags: idea.tags || '',
                          reviewer_name: idea.reviewer_name || '',
                          price: idea.price,
                        });
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {isAdmin && (
                  <button onClick={handleDelete} className="btn-danger">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Use Case
                </label>
                {editing && isAdmin ? (
                  <input
                    type="text"
                    value={editData.use_case}
                    onChange={(e) => setEditData({ ...editData, use_case: e.target.value })}
                    className="input-field"
                    placeholder="Enter the use case category"
                  />
                ) : (
                  <p className="text-gray-600">{idea.use_case}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                {editing && isAdmin ? (
                  <select
                    value={editData.department}
                    onChange={(e) => setEditData({ ...editData, department: e.target.value })}
                    className="input-field"
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
                ) : (
                  <p className="text-gray-600">{idea.department || 'Not specified'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Short Description
                </label>
                {editing ? (
                  <textarea
                    value={editData.short_description}
                    onChange={(e) => setEditData({ ...editData, short_description: e.target.value })}
                    className="input-field"
                    rows={2}
                  />
                ) : (
                  <p className="text-gray-600">{idea.short_description || 'No short description provided'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                {editing ? (
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    className="input-field"
                    rows={4}
                  />
                ) : (
                  <p className="text-gray-600 whitespace-pre-wrap">{idea.description || 'No description provided'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Setup Guide
                </label>
                {editing ? (
                  <textarea
                    value={editData.setup_guide}
                    onChange={(e) => setEditData({ ...editData, setup_guide: e.target.value })}
                    className="input-field"
                    rows={6}
                  />
                ) : (
                  <p className="text-gray-600 whitespace-pre-wrap">
                    {idea.setup_guide || 'Not provided'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template URL
                </label>
                {editing ? (
                  <input
                    type="url"
                    value={editData.template_url}
                    onChange={(e) => setEditData({ ...editData, template_url: e.target.value })}
                    className="input-field"
                  />
                ) : idea.template_url ? (
                  <a
                    href={idea.template_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    {idea.template_url}
                  </a>
                ) : (
                  <p className="text-gray-600">Not provided</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scribe URL
                </label>
                {editing ? (
                  <input
                    type="url"
                    value={editData.scribe_url}
                    onChange={(e) => setEditData({ ...editData, scribe_url: e.target.value })}
                    className="input-field"
                  />
                ) : idea.scribe_url ? (
                  <a
                    href={idea.scribe_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline"
                  >
                    {idea.scribe_url}
                  </a>
                ) : (
                  <p className="text-gray-600">Not provided</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tags
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={editData.tags}
                    onChange={(e) => setEditData({ ...editData, tags: e.target.value })}
                    className="input-field"
                    placeholder="e.g., automation, integration, workflow"
                  />
                ) : idea.tags ? (
                  <div className="flex flex-wrap gap-2">
                    {idea.tags.split(',').map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                      >
                        {tag.trim()}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600">No tags</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reviewer Name
                </label>
                {editing && isAdmin ? (
                  <input
                    type="text"
                    value={editData.reviewer_name}
                    onChange={(e) => setEditData({ ...editData, reviewer_name: e.target.value })}
                    className="input-field"
                  />
                ) : (
                  <p className="text-gray-600">{idea.reviewer_name || 'Not assigned'}</p>
                )}
              </div>

              {isAdmin && editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    value={editData.price}
                    onChange={(e) => setEditData({ ...editData, price: parseFloat(e.target.value) })}
                    className="input-field"
                    min="0"
                    step="0.01"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Blockers */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center space-x-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <span>Blockers & Issues</span>
                  {blockers.filter(b => b.status === 'open' || b.status === 'in_progress').length > 0 && (
                    <span className="text-sm px-2 py-1 bg-orange-100 text-orange-700 rounded">
                      {blockers.filter(b => b.status === 'open' || b.status === 'in_progress').length}
                    </span>
                  )}
                </h2>
                <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showResolvedBlockers}
                    onChange={(e) => setShowResolvedBlockers(e.target.checked)}
                    className="rounded"
                  />
                  <span>Show resolved</span>
                </label>
              </div>
              {canEdit && !showBlockerForm && (
                <button
                  onClick={() => setShowBlockerForm(true)}
                  className="btn-secondary flex items-center space-x-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Blocker</span>
                </button>
              )}
            </div>

            {showBlockerForm && (
              <form onSubmit={handleAddBlocker} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-medium">Add New Blocker</h3>
                  <button type="button" onClick={() => setShowBlockerForm(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={newBlocker.blocker_type}
                        onChange={(e) => setNewBlocker({ ...newBlocker, blocker_type: e.target.value as BlockerType })}
                        className="input-field text-sm"
                      >
                        <option value="missing_integration">Missing Integration</option>
                        <option value="missing_action">Missing Action</option>
                        <option value="platform_limitation">Platform Limitation</option>
                        <option value="bug">Bug</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        value={newBlocker.priority}
                        onChange={(e) => setNewBlocker({ ...newBlocker, priority: e.target.value as BlockerPriority })}
                        className="input-field text-sm"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={newBlocker.title}
                      onChange={(e) => setNewBlocker({ ...newBlocker, title: e.target.value })}
                      className="input-field"
                      placeholder="e.g., Need Slack integration"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={newBlocker.description}
                      onChange={(e) => setNewBlocker({ ...newBlocker, description: e.target.value })}
                      className="input-field"
                      rows={3}
                      placeholder="Describe what's blocking progress..."
                      required
                    />
                  </div>

                  <div className="flex space-x-2">
                    <button type="submit" className="btn-primary text-sm">Add Blocker</button>
                    <button type="button" onClick={() => setShowBlockerForm(false)} className="btn-secondary text-sm">Cancel</button>
                  </div>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {blockers.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No blockers reported</p>
              ) : (
                blockers.map((blocker) => (
                  <div
                    key={blocker.id}
                    className={`rounded-lg border ${
                      blocker.status === 'resolved' 
                        ? 'bg-green-50 border-green-200' 
                        : blocker.priority === 'critical'
                        ? 'bg-red-50 border-red-300'
                        : blocker.priority === 'high'
                        ? 'bg-orange-50 border-orange-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* Blocker Header */}
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium text-gray-900">{blocker.title}</h4>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              blocker.priority === 'critical' ? 'bg-red-100 text-red-700' :
                              blocker.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                              blocker.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {blocker.priority}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 capitalize">
                              {blocker.blocker_type.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{blocker.description}</p>
                          <div className="text-xs text-gray-500">
                            Added by @{blocker.created_by_handle} on {new Date(blocker.created_at).toLocaleDateString()}
                            {blocker.resolved_at && (
                              <span> • Resolved by @{blocker.resolved_by_handle} on {new Date(blocker.resolved_at).toLocaleDateString()}</span>
                            )}
                          </div>
                          {blocker.resolution_notes && (
                            <div className="mt-2 p-2 bg-white rounded border border-green-200">
                              <p className="text-xs font-medium text-green-700 mb-1">Resolution Notes:</p>
                              <p className="text-sm text-gray-700">{blocker.resolution_notes}</p>
                            </div>
                          )}
                        </div>
                        {canEdit && (
                          <div className="flex items-center space-x-2 ml-4">
                            {blocker.status !== 'resolved' && (
                              <button
                                onClick={() => handleUpdateBlockerStatus(blocker.id, 'resolved')}
                                className="text-green-600 hover:text-green-700 text-sm"
                                title="Mark as resolved"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteBlocker(blocker.id)}
                              className="text-red-600 hover:text-red-700 text-sm"
                              title="Delete blocker"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className={`text-xs font-medium ${
                          blocker.status === 'resolved' ? 'text-green-700' :
                          blocker.status === 'in_progress' ? 'text-blue-700' :
                          'text-orange-700'
                        }`}>
                          Status: {blocker.status.replace('_', ' ').toUpperCase()}
                        </div>
                        <button
                          onClick={() => toggleBlockerExpansion(blocker.id)}
                          className="text-sm text-primary-600 hover:text-primary-700 flex items-center space-x-1"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>Discussion ({blocker.discussion_count || 0})</span>
                          {expandedBlocker === blocker.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Discussion Thread */}
                    {expandedBlocker === blocker.id && (
                      <div className="border-t border-gray-200 bg-white p-4">
                        <h5 className="font-medium text-sm mb-3">Discussion</h5>
                        
                        {/* Discussion List */}
                        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                          {blockerDiscussions[blocker.id]?.length === 0 ? (
                            <p className="text-xs text-gray-500 text-center py-2">No discussion yet. Start the conversation!</p>
                          ) : (
                            blockerDiscussions[blocker.id]?.map((disc: any) => (
                              <div key={disc.id} className="flex space-x-2">
                                <div className="flex-shrink-0">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                    disc.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {disc.username.charAt(0).toUpperCase()}
                                  </div>
                                </div>
                                <div className="flex-1 bg-gray-50 rounded-lg p-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-gray-900">@{disc.handle}</span>
                                    <span className="text-xs text-gray-500">{new Date(disc.created_at).toLocaleString()}</span>
                                  </div>
                                  <p className="text-sm text-gray-700">{disc.message}</p>
                                  {disc.is_solution && (
                                    <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">✓ Solution</span>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Add Discussion Form */}
                        <form onSubmit={(e) => handleAddDiscussion(blocker.id, e)} className="flex space-x-2">
                          <input
                            type="text"
                            value={discussionMessage[blocker.id] || ''}
                            onChange={(e) => setDiscussionMessage(prev => ({ ...prev, [blocker.id]: e.target.value }))}
                            placeholder="Add to discussion..."
                            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <button type="submit" className="btn-primary text-sm px-4 py-2">Send</button>
                        </form>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Comments</span>
            </h2>

            <form onSubmit={handleAddComment} className="mb-6 relative">
              <div className="relative">
                <textarea
                  ref={commentInputRef}
                  value={comment}
                  onChange={handleCommentChange}
                  className="input-field mb-3"
                  rows={3}
                  placeholder="Add a comment... Use @handle to mention someone"
                />
                
                {showMentionList && filteredUsers.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
                    {filteredUsers.slice(0, 5).map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => insertMention(u.handle)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center space-x-2"
                      >
                        <AtSign className="w-4 h-4 text-primary-500" />
                        <div>
                          <span className="font-medium text-gray-900">@{u.handle}</span>
                          <span className="text-sm text-gray-500 ml-2">{u.username}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <button type="submit" className="btn-primary">
                  Add Comment
                </button>
                <span className="text-xs text-gray-500">
                  Tip: Type @ to mention someone
                </span>
              </div>
            </form>

            <div className="space-y-4">
              {idea.comments.length === 0 ? (
                <p className="text-gray-500 text-sm">No comments yet.</p>
              ) : (
                idea.comments.map((c: any) => (
                  <div key={c.id} className="border-l-4 border-primary-200 pl-4 py-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <UserIcon className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-900">{c.username}</span>
                      {c.handle && (
                        <span className="text-sm text-gray-500">@{c.handle}</span>
                      )}
                      <span className="text-sm text-gray-500">
                        {new Date(c.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700">{renderCommentText(c.comment)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>

            {isAdmin && idea.status === 'new' && (
              <div className="space-y-3">
                <select
                  value={selectedFreelancer}
                  onChange={(e) => setSelectedFreelancer(e.target.value)}
                  className="input-field"
                >
                  <option value="">Select Freelancer</option>
                  {freelancers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.username}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAssign}
                  disabled={!selectedFreelancer}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Assign to Freelancer</span>
                </button>
              </div>
            )}

            {isFreelancer && idea.assigned_to === null && (
              <div className="space-y-3">
                <button
                  onClick={handleSelfAssign}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Assign to Myself</span>
                </button>
                <p className="text-sm text-gray-500 text-center">
                  This idea is available. Click to start working on it.
                </p>
              </div>
            )}

            {isFreelancer && idea.assigned_to === user?.id && (
              <div className="space-y-3">
                {idea.status === 'assigned' && (
                  <button
                    onClick={() => handleStatusChange('in_progress')}
                    className="w-full btn-primary"
                  >
                    Start Working
                  </button>
                )}
                {(idea.status === 'in_progress' || idea.status === 'needs_fixes') && (
                  <button
                    onClick={() => handleStatusChange('submitted')}
                    className="w-full btn-success flex items-center justify-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Submit for Review</span>
                  </button>
                )}
              </div>
            )}

            {canReview && idea.status === 'submitted' && (
              <div className="space-y-3">
                <button
                  onClick={() => handleStatusChange('reviewed')}
                  className="w-full btn-success flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Approve</span>
                </button>
                <button
                  onClick={() => handleStatusChange('needs_fixes')}
                  className="w-full btn-danger flex items-center justify-center space-x-2"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Request Fixes</span>
                </button>
              </div>
            )}

            {canReview && idea.status === 'reviewed' && (
              <button
                onClick={() => handleStatusChange('published')}
                className="w-full btn-success flex items-center justify-center space-x-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Publish Template</span>
              </button>
            )}
          </div>

          {/* Activity Log */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
              <Activity className="w-5 h-5" />
              <span>Activity</span>
            </h3>
            <div className="space-y-3">
              {idea.activities.length === 0 ? (
                <p className="text-gray-500 text-sm">No activity yet.</p>
              ) : (
                idea.activities.map((a) => (
                  <div key={a.id} className="text-sm">
                    <div className="font-medium text-gray-900">{a.username}</div>
                    <div className="text-gray-600">{a.action}</div>
                    <div className="text-gray-500 text-xs">
                      {new Date(a.created_at).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdeaDetail;

