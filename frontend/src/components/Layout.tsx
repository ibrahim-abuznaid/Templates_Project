import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, LayoutDashboard, Building2, UserPlus, Receipt, DollarSign, AlertTriangle } from 'lucide-react';
import NotificationsInbox from './NotificationsInbox';
import InviteUserModal from './InviteUserModal';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-8">
              <Link to="/" className="flex items-center space-x-2 text-xl font-bold text-primary-600">
                <LayoutDashboard className="w-6 h-6" />
                <span>Template Manager</span>
              </Link>
              
              {user && (
                <div className="flex items-center space-x-4">
                  <Link
                    to="/"
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive('/')
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>
                  
                  <Link
                    to="/departments"
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive('/departments')
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Departments</span>
                  </Link>
                  
                  <Link
                    to="/blockers"
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive('/blockers')
                        ? 'bg-primary-100 text-primary-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Blockers</span>
                  </Link>

                  {isAdmin ? (
                    <Link
                      to="/invoices"
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                        isActive('/invoices')
                          ? 'bg-primary-100 text-primary-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Receipt className="w-4 h-4" />
                      <span>Invoices</span>
                    </Link>
                  ) : (
                    <Link
                      to="/earnings"
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                        isActive('/earnings')
                          ? 'bg-primary-100 text-primary-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Earnings</span>
                    </Link>
                  )}
                </div>
              )}
            </div>

            {user && (
              <div className="flex items-center space-x-4">
                {isAdmin && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center space-x-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Invite Users"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                )}
                
                <NotificationsInbox />
                
                <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 rounded-lg">
                  <User className="w-5 h-5 text-gray-600" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700">{user.username}</span>
                    {user.handle && (
                      <span className="text-xs text-gray-500">@{user.handle}</span>
                    )}
                  </div>
                  <span className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded capitalize">
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {isAdmin && (
        <InviteUserModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
};

export default Layout;

