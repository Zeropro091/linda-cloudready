// src/pages/ProfilePage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Mail, LogOut, Sparkles, PenLine, Save, Camera, MapPin, Phone, User, FileText, Check } from 'lucide-react';
import { useAuth } from '../components/AuthProvider';
import { supabase } from '../lib/supabase';

interface ProfileData {
  full_name: string;
  pen_name: string;
  bio: string;
  profile_photo: string;
  phone_number: string;
  city: string;
}

export default function ProfilePage() {
  const { user, role, quota, loading, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '', pen_name: '', bio: '', profile_photo: '', phone_number: '', city: '',
  });
  const [originalProfile, setOriginalProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Fetch profile data
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, pen_name, bio, profile_photo, phone_number, city')
          .eq('id', user.id)
          .single();
        if (error) throw error;
        const p: ProfileData = {
          full_name: data?.full_name || '',
          pen_name: data?.pen_name || '',
          bio: data?.bio || '',
          profile_photo: data?.profile_photo || '',
          phone_number: data?.phone_number || '',
          city: data?.city || '',
        };
        setProfile(p);
        setOriginalProfile(p);
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [user]);

  const hasChanges = originalProfile && JSON.stringify(profile) !== JSON.stringify(originalProfile);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name || null,
          pen_name: profile.pen_name || null,
          bio: profile.bio || null,
          profile_photo: profile.profile_photo || null,
          phone_number: profile.phone_number || null,
          city: profile.city || null,
        })
        .eq('id', user.id);
      if (error) throw error;
      setOriginalProfile({ ...profile });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      alert(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Photo must be under 5MB');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `avatars/${user!.id}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('images').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('images').getPublicUrl(data.path);
      try {
        const u = new URL(urlData.publicUrl);
        setProfile(prev => ({ ...prev, profile_photo: u.pathname }));
      } catch {
        setProfile(prev => ({ ...prev, profile_photo: urlData.publicUrl }));
      }
    } catch (err: any) {
      console.error('Photo upload failed:', err);
      // Fallback to base64
      const reader = new FileReader();
      reader.onload = () => setProfile(prev => ({ ...prev, profile_photo: reader.result as string }));
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black"></div>
      </main>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: '/profile' }} replace />;

  const avatarUrl = profile.profile_photo || `https://api.dicebear.com/7.x/notionists/svg?seed=${user.email}`;
  const displayName = profile.full_name || profile.pen_name || user.user_metadata?.full_name || user.email?.split('@')[0];

  return (
    <main className="flex-1 bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

          {/* ── Header Banner ── */}
          <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)', height: 80 }} />

          {/* ── Avatar & Name ── */}
          <div style={{ padding: '0 24px 16px', marginTop: -36 }}>
            <div className="flex items-end gap-4">
              <div
                className="relative group cursor-pointer"
                onClick={() => photoInputRef.current?.click()}
                style={{ flexShrink: 0 }}
              >
                <div className="w-[72px] h-[72px] rounded-full overflow-hidden border-4 border-white shadow-md bg-gray-100">
                  {uploading ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-500" />
                    </div>
                  ) : (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100" style={{ top: 0 }}>
                  <Camera size={16} className="text-white" />
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }} />
              </div>
              <div style={{ paddingBottom: 4 }}>
                <h1 className="text-lg font-black leading-tight">{displayName}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-gray-100 text-gray-600">
                    {role}
                  </span>
                  {profile.city && (
                    <span className="flex items-center gap-0.5 text-[11px] text-gray-400">
                      <MapPin size={10} /> {profile.city}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Editable Fields ── */}
          <div style={{ padding: '0 24px 24px' }}>
            {loadingProfile ? (
              <div className="py-8 text-center text-gray-400 text-sm">Loading profile...</div>
            ) : (
              <div className="space-y-4">

                {/* Display Name */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    <User size={12} /> Display Name
                  </label>
                  <input
                    type="text"
                    value={profile.full_name}
                    onChange={e => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                    placeholder="Your full name"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors bg-white text-gray-900"
                  />
                  <div className="text-[10px] text-gray-400 mt-1">This is the author name shown on your articles.</div>
                </div>

                {/* Pen Name */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    <PenLine size={12} /> Pen Name
                  </label>
                  <input
                    type="text"
                    value={profile.pen_name}
                    onChange={e => setProfile(prev => ({ ...prev, pen_name: e.target.value }))}
                    placeholder="Optional pen name"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors bg-white text-gray-900"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    <FileText size={12} /> Bio
                  </label>
                  <textarea
                    rows={3}
                    value={profile.bio}
                    onChange={e => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                    placeholder="A short bio about yourself..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors resize-none bg-white text-gray-900"
                    maxLength={500}
                  />
                  <div className="text-[10px] text-gray-400 mt-1">{profile.bio.length}/500</div>
                </div>

                {/* City */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    <MapPin size={12} /> City
                  </label>
                  <input
                    type="text"
                    value={profile.city}
                    onChange={e => setProfile(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Your city"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors bg-white text-gray-900"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    <Phone size={12} /> Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profile.phone_number}
                    onChange={e => setProfile(prev => ({ ...prev, phone_number: e.target.value }))}
                    placeholder="+62..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors bg-white text-gray-900"
                  />
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    <Mail size={12} /> Email
                  </label>
                  <div className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-500">
                    {user.email}
                  </div>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: saved ? '#059669' : hasChanges ? '#0f172a' : '#d1d5db',
                    color: saved || hasChanges ? '#fff' : '#9ca3af',
                    border: 'none',
                  }}
                >
                  {saving ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" /> Saving...</>
                  ) : saved ? (
                    <><Check size={16} /> Saved!</>
                  ) : (
                    <><Save size={16} /> Save Changes</>
                  )}
                </button>
              </div>
            )}

            {/* ── Quota ── */}
            {role === 'poster' && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Article Quota
                </span>
                <span className="text-sm font-semibold text-gray-900">{quota} remaining</span>
              </div>
            )}

            {/* ── Become a Writer CTA ── */}
            {role === 'user' && (
              <div className="mt-6 p-5 border border-indigo-200 bg-indigo-50 rounded-xl">
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

            {/* ── Dashboard link ── */}
            {(role === 'poster' || role === 'admin' || role === 'dev') && (
              <div className="mt-6">
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

            {/* ── Sign out ── */}
            <button
              onClick={logout}
              className="w-full mt-6 flex items-center justify-center gap-2 py-2.5 border border-gray-300 rounded text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer bg-white"
            >
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
