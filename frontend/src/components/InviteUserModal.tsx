import React, { useState, useEffect } from 'react';
import { invitationsApi } from '../services/api';
import type { Invitation } from '../types';
import { X, Mail, UserPlus, Trash2, Copy, Check, Clock, AlertCircle } from 'lucide-react';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const InviteUserModal: React.FC<InviteUserModalProps> = ({ isOpen, onClose }) => {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'freelancer' | 'admin'>('freelancer'); // 'freelancer' displayed as 'Template Creator'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedToken, setCopiedToken] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadInvitations();
    }
  }, [isOpen]);

  const loadInvitations = async () => {
    try {
      setLoading(true);
      const response = await invitationsApi.getAll();
      setInvitations(response.data);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Email is required');
      return;
    }

    try {
      const response = await invitationsApi.create(email, role);
      setInvitations(prev => [response.data.invitation, ...prev]);
      setEmail('');
      setSuccess('Invitation sent successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to send invitation');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await invitationsApi.delete(id);
      setInvitations(prev => prev.filter(inv => inv.id !== id));
    } catch (error) {
      console.error('Failed to delete invitation:', error);
    }
  };

  const copyInviteLink = (invitation: Invitation) => {
    const link = `${window.location.origin}/register?token=${invitation.token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(invitation.id);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <UserPlus className="w-6 h-6 text-primary-600" />
            <h2 className="text-xl font-bold text-gray-900">Invite Users</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {/* Invite Form */}
          <form onSubmit={handleInvite} className="mb-6">
            <div className="flex space-x-3">
              <div className="flex-1">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="input-field pl-10 w-full"
                  />
                </div>
              </div>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'freelancer' | 'admin')}
                className="input-field w-32"
              >
                <option value="freelancer">Template Creator</option>
                <option value="admin">Reviewer</option>
              </select>
              <button type="submit" className="btn-primary whitespace-nowrap">
                Send Invite
              </button>
            </div>

            {error && (
              <p className="mt-2 text-sm text-red-600 flex items-center space-x-1">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </p>
            )}
            {success && (
              <p className="mt-2 text-sm text-green-600 flex items-center space-x-1">
                <Check className="w-4 h-4" />
                <span>{success}</span>
              </p>
            )}
          </form>

          {/* Invitations List */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Pending Invitations</h3>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              </div>
            ) : invitations.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No pending invitations</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className={`p-4 rounded-lg border ${
                      invitation.accepted_at
                        ? 'bg-green-50 border-green-200'
                        : isExpired(invitation.expires_at)
                        ? 'bg-red-50 border-red-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{invitation.email}</span>
                          <span className={`text-xs px-2 py-0.5 rounded capitalize ${
                            invitation.role === 'admin' 
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {invitation.role}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {invitation.accepted_at
                                ? 'Accepted'
                                : isExpired(invitation.expires_at)
                                ? 'Expired'
                                : `Expires ${new Date(invitation.expires_at).toLocaleDateString()}`}
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {!invitation.accepted_at && !isExpired(invitation.expires_at) && (
                          <button
                            onClick={() => copyInviteLink(invitation)}
                            className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Copy invite link"
                          >
                            {copiedToken === invitation.id ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-600" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(invitation.id)}
                          className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                          title="Delete invitation"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteUserModal;

