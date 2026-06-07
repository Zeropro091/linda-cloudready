// src/pages/BecomeWriterPage.tsx
import React, { useState, useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../lib/supabase';
import { UploadCloud, CheckCircle } from 'lucide-react';

const PHONE_REGEX = /^(\+62|08)[0-9]{8,11}$/;

export default function BecomeWriterPage() {
  const { user, role, loading, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [penName, setPenName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black"></div>
      </main>
    );
  }

  // Must be logged in
  if (!user) return <Navigate to="/login" state={{ from: '/become-a-writer' }} replace />;
  // Already a writer
  if (role !== 'user') return <Navigate to="/profile" replace />;

  const handlePhoto = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please upload an image file.'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = e => { setPhotoUrl(e.target?.result as string); setUploading(false); };
    reader.onerror = () => { setError('Failed to read image.'); setUploading(false); };
    reader.readAsDataURL(file);
  };

  const validate = (): string | null => {
    if (!fullName.trim()) return 'Full name is required.';
    if (fullName.trim().length > 120) return 'Full name must be 120 characters or fewer.';
    if (penName.length > 120) return 'Pen name must be 120 characters or fewer.';
    if (bio.length > 500) return 'Bio must be 500 characters or fewer.';
    if (!phone.trim()) return 'Phone number is required.';
    if (!PHONE_REGEX.test(phone.trim())) return 'Enter a valid phone number (e.g. +62812... or 08xx...).';
    if (!city.trim()) return 'City / location is required.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    setError(null);
    setSubmitting(true);
    try {
      const { error: dbError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          pen_name: penName.trim() || null,
          bio: bio.trim() || null,
          phone_number: phone.trim(),
          city: city.trim(),
          profile_photo: photoUrl || null,
          role: 'poster',
        })
        .eq('id', user.id);

      if (dbError) throw dbError;

      await refetchProfile();
      setDone(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main className="flex-1 flex items-center justify-center py-20 px-4 bg-gray-50">
        <div className="text-center bg-white p-10 rounded-xl border border-gray-200 shadow-sm max-w-md w-full">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black mb-2">Welcome, Writer!</h2>
          <p className="text-sm text-gray-500">Your writer profile is set up. Redirecting to your dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight">Become a Writer</h1>
          <p className="text-sm text-gray-500 mt-1">
            Complete your writer profile to start publishing on Lensa Insignia.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-300 text-red-700 text-sm rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Section 1: Identitas Dasar */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-3">
              Identitas Dasar
            </h2>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                maxLength={120}
                required
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                readOnly
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                value={user.email || ''}
              />
            </div>
          </div>

          {/* Section 2: Profil Publik */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-3">
              Profil Publik
              <span className="ml-2 font-normal text-gray-400 normal-case">(ditampilkan di byline artikel)</span>
            </h2>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Display Name / Pen Name
                <span className="ml-1 text-gray-400 font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                maxLength={120}
                placeholder="Your public byline — leave blank to use full name"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={penName}
                onChange={e => setPenName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Profile Photo
                <span className="ml-1 text-gray-400 font-normal normal-case">(optional)</span>
              </label>
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-5 text-center transition-colors ${
                  isDragging ? 'border-black bg-gray-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handlePhoto(file);
                }}
              >
                {photoUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <img src={photoUrl} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
                    <button
                      type="button"
                      onClick={() => setPhotoUrl('')}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : uploading ? (
                  <p className="text-sm text-gray-500">Uploading...</p>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <UploadCloud className="w-8 h-8 text-gray-400" />
                    <p className="text-sm text-gray-500">
                      Drag & drop or{' '}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-black font-semibold hover:underline"
                      >
                        browse
                      </button>
                    </p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }}
                />
              </div>
              {/* URL fallback */}
              <input
                type="url"
                placeholder="Or paste an image URL..."
                className="mt-2 w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={photoUrl.startsWith('data:') ? '' : photoUrl}
                onChange={e => setPhotoUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Short Bio
                <span className="ml-1 text-gray-400 font-normal normal-case">(optional, 2–3 sentences)</span>
              </label>
              <textarea
                rows={3}
                maxLength={500}
                placeholder="Tell readers a bit about yourself and your areas of expertise..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
                value={bio}
                onChange={e => setBio(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1 text-right">{bio.length}/500</p>
            </div>
          </div>

          {/* Section 3: Kontak & Verifikasi */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-xs font-black uppercase tracking-wider text-gray-500 border-b border-gray-100 pb-3">
              Kontak & Verifikasi
            </h2>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="+62812... or 08xx..."
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">Used for editor communication only, not public.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                City / Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Jakarta, Bali, Surabaya"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={city}
                onChange={e => setCity(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 rounded text-sm font-black uppercase tracking-wider transition-colors ${
              submitting
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-black text-white hover:bg-gray-800 cursor-pointer'
            }`}
          >
            {submitting ? 'Submitting...' : 'Submit Writer Application'}
          </button>
        </form>
      </div>
    </main>
  );
}
