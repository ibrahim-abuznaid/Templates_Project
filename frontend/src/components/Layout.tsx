import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, LayoutDashboard, Building2, UserPlus, Receipt, DollarSign, AlertTriangle, Zap, ChevronDown, BarChart3 } from 'lucide-react';
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
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 items-center">
            {/* Logo & Brand */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-2.5">
                <img src="/activepieces.webp" alt="Activepieces" className="w-8 h-8" />
                <span className="text-lg font-semibold text-gray-900">Template Manager</span>
              </Link>
              
              {/* Navigation */}
              {user && (
                <nav className="hidden md:flex items-center gap-1">
                  <Link
                    to="/"
                    className={isActive('/') ? 'nav-link-active' : 'nav-link'}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Dashboard</span>
                  </Link>
                  
                  <Link
                    to="/departments"
                    className={isActive('/departments') ? 'nav-link-active' : 'nav-link'}
                  >
                    <Building2 className="w-4 h-4" />
                    <span>Departments</span>
                  </Link>
                  
                  <Link
                    to="/blockers"
                    className={isActive('/blockers') ? 'nav-link-active' : 'nav-link'}
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Blockers</span>
                  </Link>

                  {isAdmin && (
                    <Link
                      to="/quick-publish"
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive('/quick-publish')
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'text-amber-600 hover:bg-amber-50'
                      }`}
                    >
                      <Zap className="w-4 h-4" />
                      <span>Quick Publish</span>
                    </Link>
                  )}

                  {isAdmin && (
                    <Link
                      to="/analytics"
                      className={isActive('/analytics') ? 'nav-link-active' : 'nav-link'}
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span>Analytics</span>
                    </Link>
                  )}

                  {isAdmin ? (
                    <Link
                      to="/invoices"
                      className={isActive('/invoices') ? 'nav-link-active' : 'nav-link'}
                    >
                      <Receipt className="w-4 h-4" />
                      <span>Invoices</span>
                    </Link>
                  ) : (
                    <Link
                      to="/earnings"
                      className={isActive('/earnings') ? 'nav-link-active' : 'nav-link'}
                    >
                      <DollarSign className="w-4 h-4" />
                      <span>Earnings</span>
                    </Link>
                  )}
                </nav>
              )}
            </div>

            {/* Right Side Actions */}
            {user && (
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                    title="Invite Users"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                )}
                
                <NotificationsInbox />
                
                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary-600" />
                    </div>
                    <div className="hidden sm:flex flex-col items-start">
                      <span className="text-sm font-medium text-gray-900">{user.username}</span>
                      <span className="text-xs text-gray-500">
                        {user.role === 'freelancer' ? 'Creator' : 'Reviewer'}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>

                  {/* Dropdown Menu */}
                  {showUserMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowUserMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-elevated border border-gray-100 py-2 z-20 animate-fade-in">
                        <div className="px-4 py-2 border-b border-gray-100">
                          <p className="text-sm font-medium text-gray-900">{user.username}</p>
                          {user.handle && (
                            <p className="text-xs text-gray-500">@{user.handle}</p>
                          )}
                          <span className="inline-block mt-1.5 text-xs px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full font-medium">
                            {user.role === 'freelancer' ? 'Template Creator' : 'Reviewer'}
                          </span>
                        </div>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Sign out</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
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
