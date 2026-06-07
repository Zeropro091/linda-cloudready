import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { useArticles } from '../App';
import { LogOut, Plus, Edit2, Trash2, Archive, CheckCircle, Database, X, UploadCloud, Mail, Sparkles, ShieldAlert } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { useAuth } from '../components/AuthProvider';

const SAMPLE_ARTICLES = [
  {
    title: "Global Markets Rally as Tech Sector Shows Unexpected Resilience",
    subtitle: "Despite early quarter concerns, major technology firms report record-breaking earnings, driving indices to all-time highs and easing recession fears.",
    excerpt: "Despite early quarter concerns, major technology firms report record-breaking earnings.",
    author: "Sarah Jenkins",
    role: "Senior Financial Correspondent",
    date: "April 14, 2026",
    time: "2 hours ago",
    category: "Business",
    imageUrl: "https://picsum.photos/seed/markets/1200/800",
    contentArr: [
      "The global financial markets experienced an unprecedented surge today.",
      "At the heart of this rally are the quarterly earnings reports from the 'Big Tech' conglomerates."
    ],
    status: "published"
  },
  {
    title: "New Climate Accord Reached in Geneva Summit",
    subtitle: "World leaders agree on aggressive new carbon reduction targets for 2035.",
    excerpt: "World leaders agree on aggressive new carbon reduction targets for 2035.",
    author: "David Chen",
    role: "Environmental Editor",
    date: "April 14, 2026",
    time: "4 hours ago",
    category: "World",
    imageUrl: "https://picsum.photos/seed/climate/600/400",
    contentArr: [
      "World leaders gathered today to announce a bold new plan."
    ],
    status: "published"
  }
];

export default function AdminDashboard() {
  const { user, role, quota, loading: authLoading, logout, signInWithEmail, signUpWithEmail, refetchProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<any[]>([]);
  const { refetch: refetchGlobalArticles } = useArticles();
  const location = useLocation();

  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerRole, setRegisterRole] = useState<'user' | 'poster'>('user');
  const [activeTab, setActiveTab] = useState<'articles' | 'users'>('articles');
  const [profiles, setProfiles] = useState<any[]>([]);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');
      if (error) throw error;
      setProfiles(data || []);
    } catch (e) {
      console.error('Error fetching profiles', e);
    }
  };

  const updateProfile = async (id: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
      fetchProfiles();
    } catch (e: any) {
      alert(`Update failed: ${e.message}`);
    }
  };

  const [editingArticle, setEditingArticle] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  
  const [galleryImages, setGalleryImages] = useState<{url: string, name: string}[]>([]);
  const [isDraggingGallery, setIsDraggingGallery] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchGallery = async () => {
    try {
      const { data, error } = await supabase
        .from('gallery')
        .select('*');
      if (error) throw error;
      const fetched = (data || []).map(item => ({
        url: item.url,
        name: item.name
      }));
      setGalleryImages(fetched);
    } catch (e) {
      console.error('Error fetching gallery', e);
    }
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        alert('Markdown copied to clipboard!');
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Markdown copied to clipboard!');
      }
    } catch (err) {
      console.warn('Failed to copy automatically, showing alert:', err);
      alert(`Could not copy automatically. Here is the markdown:\n\n${text}`);
    }
  };

  const handleBatchGalleryUpload = async (files: File[]) => {
    if (files.length === 0) return;
    try {
      setIsUploadingGallery(true);
      const uploadPromises = files.map(async (file) => {
        const url = await readFileAsDataURL(file);
        
        const { error } = await supabase
          .from('gallery')
          .insert({
            name: file.name,
            url: url,
            uploadedAt: new Date().toISOString()
          });
        if (error) throw error;
        
        return { url, name: file.name };
      });

      const uploadedImages = await Promise.all(uploadPromises);
      setGalleryImages(prev => [...prev, ...uploadedImages]);
    } catch (e: any) {
      console.error('Error uploading batch to gallery', e);
      alert(`Failed to upload images: ${e.message}`);
    } finally {
      setIsUploadingGallery(false);
      setIsDraggingGallery(false);
    }
  };

  const handleTextareaDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    const files = (Array.from(e.dataTransfer.files) as File[]).filter(file => file.type.startsWith('image/'));
    if (files.length > 0) {
      e.preventDefault();
      try {
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        
        const uploadPlaceholder = `\n\n![Uploading images...]()\n\n`;
        const text = textarea.value;
        const before = text.substring(0, start);
        const after = text.substring(end);
        
        setEditingArticle(prev => ({ ...prev, contentStr: before + uploadPlaceholder + after }));
        
        const uploadPromises = files.map(async (file) => {
          const url = await readFileAsDataURL(file);
          
          const { error } = await supabase
            .from('gallery')
            .insert({
              name: file.name,
              url: url,
              uploadedAt: new Date().toISOString()
            });
          if (error) throw error;
          
          return { url, name: file.name };
        });
        
        const uploaded = await Promise.all(uploadPromises);
        setGalleryImages(prev => [...prev, ...uploaded]);
        
        const markdown = uploaded.map(img => `\n\n![${img.name}](${img.url})`).join('') + '\n\n';
        
        setEditingArticle(prev => {
          const currentContent = prev.contentStr || '';
          const updatedContent = currentContent.replace(uploadPlaceholder, markdown);
          return { ...prev, contentStr: updatedContent };
        });
      } catch (err: any) {
        console.error('Error handling file drop', err);
        alert(`Failed to upload dropped files: ${err.message}`);
      }
      return;
    }

    const galleryData = e.dataTransfer.getData('application/x-gallery-image');
    if (galleryData) {
      e.preventDefault();
      const img = JSON.parse(galleryData);
      const markdown = `\n\n![${img.name}](${img.url})\n\n`;
      
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end);
      
      setEditingArticle(prev => ({
        ...prev,
        contentStr: before + markdown + after
      }));
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + markdown.length, start + markdown.length);
      }, 50);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    try {
      setIsUploadingImage(true);
      const url = await readFileAsDataURL(file);
      setEditingArticle(prev => ({ ...prev, imageUrl: url }));
    } catch (e: any) {
      console.error('Error reading image', e);
      alert(`Failed to handle image: ${e.message}`);
    } finally {
      setIsUploadingImage(false);
      setIsDraggingImage(false);
    }
  };

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab as 'articles' | 'users');
    }
  }, [location]);

  useEffect(() => {
    if (user && (role === 'admin' || role === 'dev' || role === 'poster')) {
      fetchArticles();
      fetchGallery();
      if (role === 'admin' || role === 'dev') {
        fetchProfiles();
      }
    }
  }, [user, role]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      let query = supabase.from('articles').select('*');
      if (role === 'poster') {
        query = query.eq('author_id', user?.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      const fetched = data || [];

      fetched.sort((a: any, b: any) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      setArticles(fetched);
    } catch (e) {
      handleSupabaseError(e, OperationType.LIST, 'articles');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (isLoggingIn) return;
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      if (!email || !password) throw new Error("Email and password are required.");
      if (password.length < 6) throw new Error("Password must be at least 6 characters.");
      await signUpWithEmail(email, password, registerRole);
      alert("Registration successful! You can now log in.");
      setIsRegistering(false);
    } catch (error: any) {
      console.error("Registration error:", error);
      setAuthError(error.message || "Failed to register.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      if (!email || !password) throw new Error("Email and password are required.");
      await signInWithEmail(email, password);
    } catch (error: any) {
      console.error("Auth error:", error);
      setAuthError(error.message || "Failed to authenticate.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const seedDatabase = async () => {
    try {
      setLoading(true);
      for (const article of SAMPLE_ARTICLES) {
        const articleWithDate = {
          ...article,
          createdAt: new Date().toISOString(),
        };
        const { error } = await supabase
          .from('articles')
          .insert(articleWithDate);
        if (error) throw error;
      }
      await fetchArticles();
      await refetchGlobalArticles();
    } catch (error) {
      console.error("Error seeding database:", error);
      alert("Failed to seed database: " + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this article?")) {
      try {
        const { error } = await supabase
          .from('articles')
          .delete()
          .eq('id', id);
        if (error) throw error;
        fetchArticles();
        refetchGlobalArticles();
      } catch (e) {
        handleSupabaseError(e, OperationType.DELETE, `articles/${id}`);
      }
    }
  };

  const handleArchiveState = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'archived' : 'published';
    try {
      const { error } = await supabase
        .from('articles')
        .update({ status: newStatus })
        .eq('id', id);
      if (error) throw error;
      fetchArticles();
      refetchGlobalArticles();
    } catch (e) {
      handleSupabaseError(e, OperationType.UPDATE, `articles/${id}`);
    }
  };

  const openModal = (article: any = null) => {
    if (article) {
      setEditingArticle({ ...article });
    } else {
      if (role === 'poster' && quota <= 0) {
        alert("Insufficient article quota. Please contact an administrator to get more quota.");
        return;
      }
      setEditingArticle({
        title: "",
        subtitle: "",
        excerpt: "",
        author: user?.user_metadata?.full_name || user?.email?.split('@')[0] || (role === 'poster' ? 'Journalist' : 'Admin'),
        role: role === 'poster' ? 'Journalist' : 'Editor',
        date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        time: "Just now",
        category: "World",
        imageUrl: "",
        contentStr: "",
        status: "published"
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingArticle(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const src = { ...editingArticle };

      // Build a clean payload with only known DB columns
      const contentStr = src.contentStr || (src.contentArr ? src.contentArr.join('\n\n') : '');
      const contentArr = contentStr
        ? contentStr.split('\n').filter((p: string) => p.trim() !== '')
        : src.contentArr || [];

      const basePayload: Record<string, any> = {
        title:      src.title,
        subtitle:   src.subtitle || null,
        excerpt:    src.excerpt || null,
        author:     src.author,
        role:       src.role || null,       // author job title
        date:       src.date,
        time:       src.time || null,
        category:   src.category || null,
        imageUrl:   src.imageUrl || null,
        contentArr,
        contentStr: contentStr || null,
        status:     src.status || 'published',
      };

      if (src.id) {
        // UPDATE
        const { error } = await supabase
          .from('articles')
          .update({ ...basePayload, updatedAt: new Date().toISOString() })
          .eq('id', src.id);
        if (error) throw error;
      } else {
        // INSERT
        if (role === 'poster' && quota <= 0) {
          alert("Insufficient article quota. Please contact an administrator.");
          return;
        }
        const { error } = await supabase
          .from('articles')
          .insert({
            ...basePayload,
            author_id: user?.id,
            createdAt: new Date().toISOString(),
            date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          });
        if (error) throw error;
      }

      closeModal();
      fetchArticles();
      refetchGlobalArticles();
      await refetchProfile();
    } catch (e: any) {
      console.error('Save error:', e);
      alert("Failed to save article: " + (e?.message || JSON.stringify(e)));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 animate-fade-in">
        <div className="bg-white p-8 rounded shadow-lg max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold mb-6">Lensa Insignia - Portal</h1>
          {authError && (
             <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 text-sm rounded text-left">
               {authError}
             </div>
          )}

          <div className="space-y-4">
            <div className="text-left">
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Email Address</label>
              <input
                type="email"
                className="w-full border p-2 rounded"
                placeholder="email@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !isRegistering && handleLogin()}
              />
            </div>
            <div className="text-left">
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Password</label>
              <input
                type="password"
                className="w-full border p-2 rounded"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !isRegistering && handleLogin()}
              />
            </div>

            {isRegistering && (
              <div className="text-left">
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase">Account Type</label>
                <select
                  className="w-full border p-2 rounded text-sm"
                  value={registerRole}
                  onChange={e => setRegisterRole(e.target.value as 'user' | 'poster')}
                >
                  <option value="user">Reader</option>
                  <option value="poster">Journalist / Poster</option>
                </select>
              </div>
            )}

            <button
              onClick={isRegistering ? handleRegister : handleLogin}
              disabled={isLoggingIn}
              className={`w-full text-white font-bold py-3 rounded transition cursor-pointer ${isLoggingIn ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {isLoggingIn
                ? (isRegistering ? 'Registering...' : 'Logging in...')
                : (isRegistering ? 'Register Account' : 'Sign In')}
            </button>
            <p className="mt-4 text-sm text-gray-600">
              {isRegistering ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => { setIsRegistering(!isRegistering); setAuthError(null); }}
                className="text-blue-600 hover:underline font-semibold bg-transparent border-0 cursor-pointer"
              >
                {isRegistering ? 'Sign In' : 'Register Now'}
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (role === 'user' || role === 'reader') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 flex justify-center items-start">
        <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm max-w-lg w-full">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-3 bg-red-100 rounded-full text-red-650">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-black text-gray-900 leading-tight">My Profile</h1>
              <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Standard User</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email Address</span>
              <span className="font-semibold text-gray-900 text-sm">{user.email}</span>
            </div>

            {/* Daily Notifications Feature Card */}
            <div className="p-5 border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50/50 rounded-lg space-y-3 animate-pulse-slow">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-purple-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-650" /> Daily News Notifications
                </span>
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-bold rounded uppercase tracking-wider">
                  Upcoming
                </span>
              </div>
              <p className="text-xs text-purple-800 leading-relaxed">
                Stay informed with a curated digest of top headlines, global markets, and investigative reports sent directly to your email every morning.
              </p>
              
              <div className="pt-2 flex items-center justify-between border-t border-purple-100">
                <span className="text-xs text-purple-700 font-medium">Notification Delivery Status</span>
                <button 
                  disabled
                  className="px-4 py-1.5 bg-purple-200 text-purple-800 rounded text-xs font-bold cursor-not-allowed border-0"
                >
                  Coming Soon
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button 
                onClick={handleLogout}
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white font-bold py-2.5 rounded text-sm transition-colors shadow-sm cursor-pointer border-0"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto bg-white p-8 rounded shadow">
        <div className="flex justify-between items-center mb-8 pb-4 border-b">
          <h1 className="text-3xl font-black">
            {role === 'poster' ? 'Lensa Insignia - Journalist' : role === 'dev' ? 'Lensa Insignia - Developer' : 'Lensa Insignia - Admin'}
          </h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-semibold">{user.email}</span>
            <button onClick={handleLogout} className="flex items-center space-x-1 text-red-650 hover:text-red-850 bg-transparent border-0 cursor-pointer">
              <LogOut size={16} /> <span>Logout</span>
            </button>
          </div>
        </div>

        <div className="flex space-x-4 mb-6 border-b">
          <button 
            className={`pb-2 px-2 font-bold ${activeTab === 'articles' ? 'border-b-2 border-black text-black' : 'text-gray-400'}`}
            onClick={() => setActiveTab('articles')}
          >
            Articles
          </button>
          {(role === 'admin' || role === 'dev') && (
            <button 
              className={`pb-2 px-2 font-bold ${activeTab === 'users' ? 'border-b-2 border-black text-black' : 'text-gray-400'}`}
              onClick={() => setActiveTab('users')}
            >
              User Management
            </button>
          )}
        </div>

        {role === 'poster' && (
          <div className="mb-6 p-4 bg-purple-550 border border-purple-200 rounded-lg flex items-center justify-between animate-fade-in" style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}>
            <div>
              <h3 className="font-bold text-purple-900">Journalist Upload Quota</h3>
              <p className="text-xs text-purple-750">You can upload up to {quota} more articles. Each new upload consumes 1 quota point.</p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-purple-900">{quota}</span>
              <span className="block text-[10px] text-purple-500 font-bold uppercase tracking-wider">Remaining</span>
            </div>
          </div>
        )}

        {activeTab === 'articles' ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Articles Management</h2>
              <div className="flex space-x-2">
                {(role === 'admin' || role === 'dev') && (
                  <button 
                    onClick={seedDatabase}
                    className="flex items-center space-x-2 bg-indigo-650 hover:bg-indigo-700 text-white px-4 py-2 rounded text-sm cursor-pointer border-0">
                    <Database size={16} />
                    <span>Seed Mock Articles</span>
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (role === 'poster' && quota <= 0) {
                      alert("Insufficient article quota. Please request more quota from an administrator.");
                    } else {
                      openModal();
                    }
                  }}
                  disabled={role === 'poster' && quota <= 0}
                  className={`flex items-center space-x-2 px-4 py-2 rounded text-sm transition ${role === 'poster' && quota <= 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed border-0' : 'bg-black text-white hover:bg-gray-800 cursor-pointer border-0'}`}
                >
                  <Plus size={16} />
                  <span>Add New Article</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-3 text-sm font-semibold">Title</th>
                    <th className="p-3 text-sm font-semibold">Category</th>
                    <th className="p-3 text-sm font-semibold">Date</th>
                    <th className="p-3 text-sm font-semibold">Status</th>
                    <th className="p-3 text-sm font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500 font-medium">
                        No articles found. Use the seed button or add manually.
                      </td>
                    </tr>
                  ) : (
                    articles.map(article => (
                      <tr key={article.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-bold">{article.title}</div>
                          <div className="text-xs text-gray-500">{article.author}</div>
                        </td>
                        <td className="p-3 text-sm">{article.category}</td>
                        <td className="p-3 text-sm">{article.date}</td>
                        <td className="p-3 text-sm">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${article.status === 'archived' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                            {article.status ? article.status.toUpperCase() : 'PUBLISHED'}
                          </span>
                        </td>
                        <td className="p-3 flex justify-end space-x-2 text-right">
                           <button onClick={() => openModal(article)} className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 cursor-pointer border-0" title="Edit"><Edit2 size={16} /></button>
                           <button onClick={() => handleArchiveState(article.id, article.status)} className="p-1.5 bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 cursor-pointer border-0" title={article.status === 'archived' ? 'Unarchive' : 'Archive'}>
                             {article.status === 'archived' ? <CheckCircle size={16} /> : <Archive size={16} />}
                           </button>
                           <button onClick={() => handleDelete(article.id)} className="p-1.5 bg-red-100 text-red-650 rounded hover:bg-red-200 cursor-pointer border-0" title="Delete"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-3 text-sm font-semibold">User Email</th>
                  <th className="p-3 text-sm font-semibold">Role</th>
                  <th className="p-3 text-sm font-semibold">Quota</th>
                  <th className="p-3 text-sm font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(profile => (
                  <tr key={profile.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm">{profile.email}</td>
                    <td className="p-3 text-sm">
                      <select 
                        value={profile.role} 
                        disabled={role === 'admin' && (profile.role === 'admin' || profile.role === 'dev')}
                        onChange={(e) => updateProfile(profile.id, { role: e.target.value })}
                        className="border rounded p-1 text-xs bg-white"
                      >
                        <option value="user">User</option>
                        <option value="poster">Poster</option>
                        {(role === 'dev' || profile.role === 'admin') && <option value="admin">Admin</option>}
                        {(role === 'dev' || profile.role === 'dev') && <option value="dev">Dev</option>}
                      </select>
                    </td>
                    <td className="p-3 text-sm">
                      <input 
                        type="number" 
                        value={profile.quota || 0} 
                        disabled={role === 'admin' && profile.role === 'dev'}
                        onChange={(e) => updateProfile(profile.id, { quota: parseInt(e.target.value) || 0 })}
                        className="w-20 border rounded p-1 text-xs"
                      />
                    </td>
                    <td className="p-3 text-right">
                       {/* Optional delete user if needed */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {isModalOpen && editingArticle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white">
              <h2 className="text-2xl font-bold">{editingArticle.id ? 'Edit Article' : 'New Article'}</h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Title</label>
                <input required type="text" className="w-full border p-2 rounded" value={editingArticle.title} onChange={e => setEditingArticle({...editingArticle, title: e.target.value})} />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Author</label>
                  <input required type="text" className="w-full border p-2 rounded" value={editingArticle.author} onChange={e => setEditingArticle({...editingArticle, author: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Category</label>
                  <select required className="w-full border p-2 rounded" value={editingArticle.category} onChange={e => setEditingArticle({...editingArticle, category: e.target.value})}>
                    <option value="World">World</option>
                    <option value="Politics">Politics</option>
                    <option value="Business">Business</option>
                    <option value="Tech">Tech</option>
                    <option value="Science">Science</option>
                    <option value="Health">Health</option>
                    <option value="Sports">Sports</option>
                    <option value="Arts">Arts</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Image URL or Upload</label>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-8 flex flex-col justify-between">
                    <div 
                      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors flex-1 flex flex-col justify-center ${isDraggingImage ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true); }}
                      onDragLeave={(e) => { e.preventDefault(); setIsDraggingImage(false); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingImage(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.type.startsWith('image/')) {
                          handleImageUpload(file);
                        }
                      }}
                    >
                      {isUploadingImage ? (
                        <div className="text-blue-500 font-semibold flex items-center justify-center space-x-2">
                           <UploadCloud className="animate-bounce" /> <span>Uploading...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center space-y-2">
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(file);
                            }} 
                          />
                          <UploadCloud className="text-gray-400" size={32} />
                          <p className="text-sm text-gray-600">
                            Drag and drop an image here, or{' '}
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:underline">browse</button>
                          </p>
                          <span className="text-xs text-gray-400">or paste a URL below</span>
                        </div>
                      )}
                    </div>
                    <input type="url" placeholder="https://..." className="w-full border p-2 rounded mt-2" value={editingArticle.imageUrl || ''} onChange={e => setEditingArticle({...editingArticle, imageUrl: e.target.value})} />
                  </div>
                  
                  <div className="md:col-span-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 border-gray-200 flex flex-col max-h-[200px]">
                    <span className="block text-xs font-semibold mb-2 text-gray-500 uppercase tracking-wider">Pick from Gallery</span>
                    <div className="overflow-y-auto grid grid-cols-2 gap-2 flex-1 pr-1" style={{ contentVisibility: 'auto' }}>
                      {galleryImages.length === 0 ? (
                        <div className="col-span-2 text-center text-xs text-gray-400 py-8">
                          No images uploaded yet.
                        </div>
                      ) : (
                        galleryImages.map((img, i) => (
                          <div 
                            key={i} 
                            onClick={() => setEditingArticle({...editingArticle, imageUrl: img.url})}
                            className={`relative border rounded cursor-pointer aspect-square overflow-hidden hover:border-blue-500 transition-colors group ${editingArticle.imageUrl === img.url ? 'border-blue-600 ring-2 ring-blue-100' : 'border-gray-200'}`}
                            title={img.name}
                          >
                            <img src={img.url} className="h-full w-full object-cover" />
                            {editingArticle.imageUrl === img.url && (
                              <div className="absolute inset-0 bg-blue-600 bg-opacity-20 flex items-center justify-center">
                                <span className="bg-blue-600 text-white rounded-full p-0.5"><CheckCircle size={14} /></span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Excerpt</label>
                <textarea className="w-full border p-2 rounded" rows={2} value={editingArticle.excerpt || ''} onChange={e => setEditingArticle({...editingArticle, excerpt: e.target.value})}></textarea>
              </div>

              <div data-color-mode="light">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-semibold">Content (Markdown format)</label>
                </div>
                <div className="border rounded overflow-hidden">
                  <MDEditor
                    value={editingArticle.contentStr || (editingArticle.contentArr ? editingArticle.contentArr.join('\n\n') : '')}
                    onChange={(val) => setEditingArticle({...editingArticle, contentStr: val || ''})}
                    height={400}
                  />
                </div>
              </div>
              
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Article</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
