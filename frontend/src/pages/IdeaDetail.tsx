import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { ideasApi, usersApi, blockersApi } from '../services/api';
import type { IdeaDetail as IdeaDetailType, User, UserBasic, Blocker, BlockerType, BlockerPriority, IdeaStatus } from '../types';
import StatusBadge from '../components/StatusBadge';
import StatusWorkflow from '../components/StatusWorkflow';
import StatusChangeSelector from '../components/StatusChangeSelector';
import {
  ArrowLeft,
  Edit,
  Save,
  Trash2,
  Send,
  CheckCircle,
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
  Wifi,
  WifiOff,
} from 'lucide-react';

const IdeaDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isFreelancer } = useAuth();
  const { subscribe, joinIdea, leaveIdea, isConnected } = useSocket();

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
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const mentionListRef = useRef<(HTMLButtonElement | null)[]>([]);
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
  const [recentlyUpdated, setRecentlyUpdated] = useState(false);

  useEffect(() => {
    loadIdea();
    loadUsers();
    loadBlockers();
    if (isAdmin) {
      loadFreelancers();
    }
  }, [id]);

  // Join the idea's room for real-time updates
  useEffect(() => {
    if (id) {
      joinIdea(Number(id));
      return () => leaveIdea(Number(id));
    }
  }, [id, joinIdea, leaveIdea]);

  // Subscribe to real-time events for this idea
  useEffect(() => {
    // Handle idea updates (status changes, etc.)
    const unsubUpdated = subscribe('idea:updated', (updatedIdea) => {
      if (updatedIdea.id === Number(id)) {
        console.log('📝 Idea updated in real-time:', updatedIdea);
        setIdea(prev => prev ? { ...prev, ...updatedIdea } : null);
        setRecentlyUpdated(true);
        setTimeout(() => setRecentlyUpdated(false), 2000);
      }
    });

    // Handle new comments
    const unsubComment = subscribe('comment:new', (data) => {
      if (data.ideaId === Number(id)) {
        console.log('💬 New comment received:', data.comment);
        setIdea(prev => {
          if (!prev) return null;
          // Check if comment already exists
          if (prev.comments.some(c => c.id === data.comment.id)) {
            return prev;
          }
          return {
            ...prev,
            comments: [data.comment, ...prev.comments]
          };
        });
      }
    });

    // Handle idea deletion
    const unsubDeleted = subscribe('idea:deleted', ({ id: deletedId }) => {
      if (deletedId === Number(id)) {
        console.log('🗑️ This idea was deleted');
        alert('This template has been deleted.');
        navigate('/');
      }
    });

    return () => {
      unsubUpdated();
      unsubComment();
      unsubDeleted();
    };
  }, [id, subscribe, navigate]);

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

  const handleStatusChange = async (newStatus: IdeaStatus) => {
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
        setSelectedMentionIndex(0);
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
      // Get text before the @ symbol
      const before = comment.substring(0, lastAtIndex);
      // Get text after the current cursor position  
      const after = comment.substring(cursorPosition);
      // Create new comment: before + @handle + space + after
      const newComment = `${before}@${handle} ${after}`;
      
      setComment(newComment);
      
      // Set cursor position after the mention
      setTimeout(() => {
        if (commentInputRef.current) {
          const newCursorPos = lastAtIndex + handle.length + 2; // +2 for @ and space
          commentInputRef.current.selectionStart = newCursorPos;
          commentInputRef.current.selectionEnd = newCursorPos;
        }
      }, 0);
    }
    
    setShowMentionList(false);
    commentInputRef.current.focus();
  };

  const filteredUsers = allUsers.filter(
    u => u.handle.toLowerCase().includes(mentionSearch) || 
         u.username.toLowerCase().includes(mentionSearch)
  );
  const visibleMentionOptions = filteredUsers.slice(0, 5);

  useEffect(() => {
    setSelectedMentionIndex(prev => {
      if (visibleMentionOptions.length === 0) {
        return 0;
      }
      return Math.min(prev, visibleMentionOptions.length - 1);
    });
  }, [visibleMentionOptions.length]);

  // Auto-scroll selected mention into view
  useEffect(() => {
    if (showMentionList && mentionListRef.current[selectedMentionIndex]) {
      mentionListRef.current[selectedMentionIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedMentionIndex, showMentionList]);

  const handleCommentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentionList || visibleMentionOptions.length === 0) {
      // Allow normal behavior if mention list is not showing
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex(prev => (prev + 1) % visibleMentionOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex(prev => (prev - 1 + visibleMentionOptions.length) % visibleMentionOptions.length);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Only prevent default for Enter when mention list is showing
      e.preventDefault();
      const selectedUser = visibleMentionOptions[selectedMentionIndex];
      if (selectedUser) {
        insertMention(selectedUser.handle);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowMentionList(false);
    } else if (e.key === 'Tab') {
      // Tab also selects the currently highlighted mention
      e.preventDefault();
      const selectedUser = visibleMentionOptions[selectedMentionIndex];
      if (selectedUser) {
        insertMention(selectedUser.handle);
      }
    }
  };

  // Render comment text with highlighted mentions
  const renderCommentText = (text: string) => {
    if (!text) return null;
    
    const parts = text.split(/(@\w+)/g);
    
    return (
      <>
        {parts.map((part, index) => {
          if (part.startsWith('@')) {
            const handle = part.substring(1);
            const mentionedUser = allUsers.find(u => u.handle === handle);
            
            if (mentionedUser) {
              return (
                <span 
                  key={index} 
                  className="text-blue-600 font-semibold bg-blue-100 px-1.5 py-0.5 rounded hover:bg-blue-200 transition-colors cursor-pointer"
                  title={`@${handle} (${mentionedUser.username})`}
                >
                  {part}
                </span>
              );
            }
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await ideasApi.delete(Number(id));
      navigate('/');
    } catch (error) {
      console.error('Failed to delete template:', error);
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

  // Determine allowed status changes based on role and current status
  const getAllowedStatusChanges = (): IdeaStatus[] => {
    if (isAdmin) {
      // Admin can change to most statuses
      const allowed: IdeaStatus[] = [];
      if (idea.status === 'new') allowed.push('assigned');
      if (idea.status === 'assigned') allowed.push('in_progress', 'new');
      if (idea.status === 'in_progress') allowed.push('submitted', 'needs_fixes');
      if (idea.status === 'submitted') allowed.push('reviewed', 'needs_fixes', 'in_progress');
      if (idea.status === 'needs_fixes') allowed.push('submitted', 'in_progress');
      if (idea.status === 'reviewed') allowed.push('published', 'needs_fixes');
      if (idea.status === 'published') allowed.push('archived', 'reviewed');
      if (idea.status === 'archived') allowed.push('published'); // Allow republishing archived templates
      return allowed;
    } else if (isFreelancer && idea.assigned_to === user?.id) {
      // Template Creator can progress work forward and unsubmit if needed
      const allowed: IdeaStatus[] = [];
      if (idea.status === 'assigned') allowed.push('in_progress');
      if (idea.status === 'in_progress') allowed.push('submitted');
      if (idea.status === 'submitted') allowed.push('in_progress'); // Can unsubmit
      if (idea.status === 'needs_fixes') allowed.push('submitted', 'in_progress');
      return allowed;
    }
    return [];
  };

  const allowedStatuses = getAllowedStatusChanges();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
      <button
        onClick={() => navigate('/')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Dashboard</span>
      </button>
        
        {/* Real-time status indicator */}
        <div className="flex items-center gap-2">
          {recentlyUpdated && (
            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full animate-pulse">
              Updated!
            </span>
          )}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                <div className="flex items-center flex-wrap gap-3 mb-2">
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
                  <StatusBadge status={idea.status} showIcon={true} showTooltip={true} />
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
                                  <p className="text-sm text-gray-700">{renderCommentText(disc.message)}</p>
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
                  onKeyDown={handleCommentKeyDown}
                  className="input-field mb-3"
                  rows={3}
                  placeholder="Add a comment... Use @handle to mention someone"
                />
                
                {showMentionList && visibleMentionOptions.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 w-72 bg-white border-2 border-blue-200 rounded-lg shadow-2xl max-h-60 overflow-y-auto z-50 animate-fade-in">
                    <div className="px-3 py-2 bg-blue-50 border-b border-blue-200 text-xs font-semibold text-blue-700 flex items-center justify-between">
                      <span>Select a user to mention</span>
                      <span className="text-blue-500">↑↓ Navigate • Enter/Tab Select • Esc Close</span>
                    </div>
                    {visibleMentionOptions.map((u, index) => (
                      <button
                        key={u.id}
                        ref={el => mentionListRef.current[index] = el}
                        type="button"
                        onClick={() => insertMention(u.handle)}
                        className={`w-full px-4 py-3 text-left flex items-center space-x-3 transition-all duration-150 border-b border-gray-100 last:border-b-0 ${
                          index === selectedMentionIndex
                            ? 'bg-blue-500 text-white shadow-md scale-[1.02]'
                            : 'hover:bg-blue-50 text-gray-900'
                        }`}
                        onMouseEnter={() => setSelectedMentionIndex(index)}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          index === selectedMentionIndex ? 'bg-white text-blue-500' : 'bg-blue-100 text-blue-600'
                        }`}>
                          <AtSign className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className={`font-semibold ${index === selectedMentionIndex ? 'text-white' : 'text-gray-900'}`}>
                            @{u.handle}
                          </div>
                          <div className={`text-sm ${index === selectedMentionIndex ? 'text-blue-100' : 'text-gray-500'}`}>
                            {u.username}
                          </div>
                        </div>
                        {index === selectedMentionIndex && (
                          <div className="text-white text-xs font-semibold bg-blue-600 px-2 py-1 rounded">
                            Selected
                          </div>
                        )}
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
          {/* Workflow Progress */}
          <StatusWorkflow currentStatus={idea.status} />

          {/* Actions */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Actions</h3>

            {/* Assignment Section for Reviewer */}
            {isAdmin && idea.status === 'new' && (
              <div className="space-y-3 mb-6">
                <label className="block text-sm font-medium text-gray-700">
                  Assign to Template Creator
                </label>
                <select
                  value={selectedFreelancer}
                  onChange={(e) => setSelectedFreelancer(e.target.value)}
                  className="input-field"
                >
                  <option value="">Select Template Creator</option>
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
                  <span>Assign to Template Creator</span>
                </button>
              </div>
            )}

            {/* Self-Assignment for Template Creator */}
            {isFreelancer && idea.assigned_to === null && (
              <div className="space-y-3 mb-6">
                <button
                  onClick={handleSelfAssign}
                  className="w-full btn-primary flex items-center justify-center space-x-2"
                >
                  <Send className="w-4 h-4" />
                  <span>Assign to Myself</span>
                </button>
                <p className="text-sm text-gray-500 text-center">
                  This template is available. Click to start working on it.
                </p>
              </div>
            )}

            {/* Status Change Selector */}
            {allowedStatuses.length > 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Change Status
                </label>
                <StatusChangeSelector
                  currentStatus={idea.status}
                  allowedStatuses={allowedStatuses}
                  onStatusChange={handleStatusChange}
                  userRole={isAdmin ? 'admin' : 'freelancer'}
                />
              </div>
            )}

            {/* No actions available message */}
            {allowedStatuses.length === 0 && idea.assigned_to !== null && !isAdmin && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 text-center">
                  No actions available at this stage.
                </p>
              </div>
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

