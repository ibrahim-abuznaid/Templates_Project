import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { invitationsApi } from '../services/api';
import { LayoutDashboard, User, Lock, AlertCircle, CheckCircle } from 'lucide-react';

const Register: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [inviteData, setInviteData] = useState<{ email: string; role: string } | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/');
      return;
    }

    if (!token) {
      setError('Invalid invitation link. Please request a new invitation.');
      setLoading(false);
      return;
    }

    // Check if invitation is valid
    invitationsApi.check(token)
      .then(response => {
        setInviteData(response.data);
      })
      .catch(() => {
        setError('This invitation link is invalid or has expired. Please request a new invitation.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setSubmitting(true);
      const response = await invitationsApi.accept(token!, username, password);
      
      // Store token and user data
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      // Redirect to home
      window.location.href = '/';
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create account');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
        <div className="max-w-md w-full">
          <div className="card text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="btn-primary"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary-600 rounded-xl">
              <LayoutDashboard className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Create Your Account</h1>
          <p className="text-gray-600 mt-2">You've been invited to join Template Manager</p>
        </div>

        <div className="card">
          {inviteData && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 text-green-700">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Valid Invitation</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                Email: {inviteData.email}
              </p>
              <p className="text-sm text-green-600">
                Role: <span className="capitalize font-medium">{inviteData.role}</span>
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field pl-10"
                  placeholder="Choose a username"
                  autoFocus
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                This will also be your @handle for mentions
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pl-10"
                  placeholder="Create a password"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field pl-10"
                  placeholder="Confirm your password"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full disabled:opacity-50"
            >
              {submitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;

