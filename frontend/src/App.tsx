import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import IdeaDetail from './pages/IdeaDetail';
import DepartmentView from './pages/DepartmentView';
import InvoiceManagement from './pages/InvoiceManagement';
import MyEarnings from './pages/MyEarnings';
import BlockersOverview from './pages/BlockersOverview';
import QuickPublish from './pages/QuickPublish';
import Analytics from './pages/Analytics';
import Maintenance from './pages/Maintenance';
import Suggestions from './pages/Suggestions';
import Guidebook from './pages/Guidebook';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
};

const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" /> : <Login />}
      />
      <Route
        path="/register"
        element={<Register />}
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/ideas/:id"
        element={
          <PrivateRoute>
            <Layout>
              <IdeaDetail />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/departments"
        element={
          <PrivateRoute>
            <Layout>
              <DepartmentView />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/invoices"
        element={
          <PrivateRoute>
            <Layout>
              <InvoiceManagement />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/earnings"
        element={
          <PrivateRoute>
            <Layout>
              <MyEarnings />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/blockers"
        element={
          <PrivateRoute>
            <Layout>
              <BlockersOverview />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/quick-publish"
        element={
          <PrivateRoute>
            <Layout>
              <QuickPublish />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <PrivateRoute>
            <Layout>
              <Analytics />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/maintenance"
        element={
          <PrivateRoute>
            <Layout>
              <Maintenance />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/suggestions"
        element={
          <PrivateRoute>
            <Layout>
              <Suggestions />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/guidebook"
        element={
          <PrivateRoute>
            <Layout>
              <Guidebook />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

