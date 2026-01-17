import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Building2, UserPlus, Receipt, DollarSign, AlertTriangle, Zap, ChevronDown, BarChart3, Wrench, Lightbulb, BookOpen, Tags } from 'lucide-react';
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

  // Navigation group component for better organization
  const NavDivider = () => <div className="w-px h-5 bg-gray-200/80 mx-2" />;

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200/80 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Logo & Brand */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2.5 mr-8">
                <img src="/activepieces.webp" alt="Activepieces" className="w-8 h-8" />
                <span className="text-base font-semibold text-gray-900 hidden lg:block">Template Manager</span>
              </Link>
              
              {/* Navigation */}
              {user && (
                <nav className="hidden lg:flex items-center">
                  {/* Core Navigation Group */}
                  <div className="flex items-center gap-1 border-l border-gray-200/80 pl-6">
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
                  </div>

                  <NavDivider />

                  {/* Resources Group */}
                  <div className="flex items-center gap-1">
                    <Link
                      to="/suggestions"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive('/suggestions')
                          ? 'bg-amber-100 text-amber-700'
                          : 'text-amber-600 hover:bg-amber-50'
                      }`}
                    >
                      <Lightbulb className="w-4 h-4" />
                      <span>Suggestions</span>
                    </Link>

                    <Link
                      to="/guidebook"
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                        isActive('/guidebook')
                          ? 'bg-violet-100 text-violet-700'
                          : 'text-violet-600 hover:bg-violet-50'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Guidebook</span>
                    </Link>

                    {isAdmin && (
                      <Link
                        to="/quick-publish"
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                          isActive('/quick-publish')
                            ? 'bg-amber-100 text-amber-700'
                            : 'text-amber-600 hover:bg-amber-50'
                        }`}
                      >
                        <Zap className="w-4 h-4" />
                        <span>Quick Publish</span>
                      </Link>
                    )}
                  </div>

                  {isAdmin && (
                    <>
                      <NavDivider />
                      
                      {/* Admin Tools Group */}
                      <div className="flex items-center gap-1">
                        <Link
                          to="/analytics"
                          className={isActive('/analytics') ? 'nav-link-active' : 'nav-link'}
                        >
                          <BarChart3 className="w-4 h-4" />
                          <span>Performance</span>
                        </Link>

                        <Link
                          to="/maintenance"
                          className={isActive('/maintenance') ? 'nav-link-active' : 'nav-link'}
                        >
                          <Wrench className="w-4 h-4" />
                          <span>Maintenance</span>
                        </Link>

                        <Link
                          to="/categories"
                          className={isActive('/categories') ? 'nav-link-active' : 'nav-link'}
                        >
                          <Tags className="w-4 h-4" />
                          <span>Categories</span>
                        </Link>
                      </div>
                    </>
                  )}

                  <NavDivider />

                  {/* Finance Group */}
                  <div className="flex items-center gap-1">
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
                  </div>
                </nav>
              )}
            </div>

            {/* Right Side Actions */}
            {user && (
              <div className="flex items-center gap-0.5">
                {isAdmin && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                    title="Invite Users"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                )}
                
                <NotificationsInbox />
                
                {/* Divider */}
                <div className="hidden sm:block w-px h-6 bg-gray-200 mx-2" />
                
                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-lg hover:bg-gray-100 transition-all duration-150"
                  >
                    {/* Avatar with initials */}
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                      <span className="text-sm font-semibold text-white">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {/* User info */}
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium text-gray-900 truncate max-w-[100px] leading-tight">
                        {user.username}
                      </p>
                      <p className="text-xs text-gray-500 leading-tight">
                        {user.role === 'freelancer' ? 'Creator' : 'Reviewer'}
                      </p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {showUserMenu && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowUserMenu(false)}
                      />
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200/80 py-1 z-20 animate-fade-in overflow-hidden">
                        {/* User info header */}
                        <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm flex-shrink-0">
                              <span className="text-base font-semibold text-white">
                                {user.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">{user.username}</p>
                              {user.handle && (
                                <p className="text-xs text-gray-500 truncate">@{user.handle}</p>
                              )}
                            </div>
                          </div>
                          <div className="mt-2">
                            <span className="inline-flex items-center text-xs px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full font-medium border border-primary-100">
                              {user.role === 'freelancer' ? 'Template Creator' : 'Reviewer'}
                            </span>
                          </div>
                        </div>
                        {/* Menu items */}
                        <div className="py-1">
                          <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            <LogOut className="w-4 h-4 text-gray-500" />
                            <span>Sign out</span>
                          </button>
                        </div>
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
