// src/pages/DashboardPage.tsx
// Journalist dashboard — accessible to poster, admin, dev
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import AdminDashboard from './AdminDashboard';

export default function DashboardPage() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black"></div>
      </main>
    );
  }

  // Not logged in → login
  if (!user) return <Navigate to="/login" state={{ from: '/dashboard' }} replace />;

  // Plain readers can't access this — send them to become a writer
  if (role === 'user') return <Navigate to="/profile" replace />;
  if (role === 'reader') return <Navigate to="/login" replace />;

  // Render the existing AdminDashboard (handles all roles internally)
  return <AdminDashboard />;
}
