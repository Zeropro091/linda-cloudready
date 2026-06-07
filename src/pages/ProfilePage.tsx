// src/pages/ProfilePage.tsx
import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Mail, LogOut, Sparkles, PenLine } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';

export default function ProfilePage() {
  const { user, role, quota, loading, logout } = useAuth();

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black"></div>
      </main>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: '/profile' }} replace />;

  return (
    <main className="flex-1 bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          {/* Header */}
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100">
              <img
                src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user.email}`}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-xl font-black leading-tight">
                {user.user_metadata?.full_name || user.email?.split('@')[0]}
              </h1>
              <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-gray-100 text-gray-600">
                {role}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4 mb-8">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</span>
              <span className="text-sm font-semibold text-gray-900">{user.email}</span>
            </div>

            {role === 'poster' && (
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Article Quota
                </span>
                <span className="text-sm font-semibold text-gray-900">{quota} remaining</span>
              </div>
            )}
          </div>

          {/* Become a Writer CTA — only for plain readers */}
          {role === 'user' && (
            <div className="mb-8 p-5 border border-indigo-200 bg-indigo-50 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <PenLine className="w-5 h-5 text-indigo-700" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-indigo-900 text-sm mb-1">Become a Writer</h3>
                  <p className="text-xs text-indigo-700 leading-relaxed mb-3">
                    Want to publish articles on Lensa Insignia? Fill out your writer profile and
                    start contributing today.
                  </p>
                  <Link
                    to="/become-a-writer"
                    className="inline-block bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded uppercase tracking-wider hover:bg-indigo-800 transition-colors"
                  >
                    Apply as Writer
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Dashboard link for staff */}
          {(role === 'poster' || role === 'admin' || role === 'dev') && (
            <div className="mb-8">
              <Link
                to={role === 'poster' ? '/dashboard' : '/dashboard/admin'}
                className="flex items-center justify-between w-full p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-bold text-gray-800">
                  {role === 'poster' ? 'Journalist Dashboard' : 'Admin Dashboard'}
                </span>
                <Sparkles className="w-4 h-4 text-gray-500" />
              </Link>
            </div>
          )}

          {/* Daily notifications promo */}
          <div className="mb-8 p-5 border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-purple-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-600" /> Daily News Notifications
              </span>
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded uppercase tracking-wider">
                Upcoming
              </span>
            </div>
            <p className="text-xs text-purple-800 leading-relaxed">
              Curated top headlines sent to your inbox every morning.
            </p>
          </div>

          {/* Sign out */}
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer bg-white"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    </main>
  );
}
