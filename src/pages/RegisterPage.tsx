// src/pages/RegisterPage.tsx
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';

export default function RegisterPage() {
  const { user, signUpWithEmail } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) navigate('/profile', { replace: true });
  }, [user, navigate]);

  const validate = (): string | null => {
    if (!fullName.trim()) return 'Full name is required.';
    if (fullName.trim().length > 120) return 'Full name must be 120 characters or fewer.';
    if (!email) return 'Email is required.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError(null);
    setLoading(true);
    try {
      await signUpWithEmail(email, password, 'user', { full_name: fullName.trim() });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to register.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="flex-1 flex items-center justify-center py-16 px-4 bg-gray-50">
        <div className="w-full max-w-md text-center bg-white p-8 rounded shadow-sm border border-gray-200">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-black mb-2">Account Created!</h2>
          <p className="text-sm text-gray-600 mb-6">
            Check your email to confirm your account, then sign in.
          </p>
          <Link
            to="/login"
            className="inline-block bg-black text-white font-bold text-sm px-6 py-2.5 rounded uppercase tracking-wider hover:bg-gray-800 transition-colors"
          >
            Go to Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex items-center justify-center py-16 px-4 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded shadow-sm border border-gray-200">
          <div className="text-center mb-8">
            <Link to="/" className="text-2xl font-black tracking-tight">Lensa Insignia</Link>
            <p className="text-sm text-gray-500 mt-2">Create your account</p>
          </div>

          {error && (
            <div className="mb-5 p-3 bg-red-50 border border-red-300 text-red-700 text-sm rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                autoComplete="name"
                maxLength={120}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="Your full name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                minLength={6}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="At least 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-2.5 rounded text-sm font-bold uppercase tracking-wider transition-colors ${
                loading
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-black text-white hover:bg-gray-800 cursor-pointer'
              }`}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-sm text-center text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-black hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
