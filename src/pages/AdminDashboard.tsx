import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { useArticles } from '../App';
import { LogOut, Plus, Edit2, Trash2, Archive, CheckCircle, Database, X, UploadCloud, Mail, Sparkles, ShieldAlert, ExternalLink, Eye, EyeOff } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { useAuth } from '../components/AuthProvider';

// --- Category name → UUID mapping (matches seed.sql fixed UUIDs) ---
const CATEGORY_UUID_MAP: Record<string, string> = {
  'Business':  'aaaaaaaa-0000-0000-0000-000000000001',
  'World':     'aaaaaaaa-0000-0000-0000-000000000002',
  'Tech':      'aaaaaaaa-0000-0000-0000-000000000003',
  'Science':   'aaaaaaaa-0000-0000-0000-000000000004',
  'Politics':  'aaaaaaaa-0000-0000-0000-000000000005',
  'Health':    'aaaaaaaa-0000-0000-0000-000000000006',
  'Sports':    'aaaaaaaa-0000-0000-0000-000000000007',
  'Arts':      'aaaaaaaa-0000-0000-0000-000000000008',
  'Opinion':   'aaaaaaaa-0000-0000-0000-000000000009',
};

/** Generate a URL-safe slug from a title string, with a short unique suffix. */
function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // remove non-word chars
    .replace(/[\s_]+/g, '-')     // spaces/underscores → hyphens
    .replace(/-+/g, '-')         // collapse multiple hyphens
    .replace(/^-+|-+$/g, '');    // trim leading/trailing hyphens
  // Append a short suffix to guarantee uniqueness within the same category
  const suffix = Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 4);
  return `${base}-${suffix}`;
}

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
    status: "draft"
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
    status: "draft"
  }
];

const PAGE_SIZE = 20;

export default function AdminDashboard() {
  const { user, role, quota, loading: authLoading, logout, signInWithEmail, signUpWithEmail, refetchProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [articles, setArticles] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { refetch: refetchGlobalArticles } = useArticles();
  const location = useLocation();

  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerRole, setRegisterRole] = useState<'user' | 'poster'>('user');
  const [activeTab, setActiveTab] = useState<'articles' | 'users' | 'ads'>('articles');
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
  const contentImgRef = useRef<HTMLInputElement>(null);

  const fetchGallery = async () => {
    try {
      const { data, error } = await supabase
        .from('gallery')
        .select('*')
        .limit(100);
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

  /**
   * Upload a file to Supabase Storage (images bucket) and return the public URL.
   * Falls back to a base64 data URL if Storage is unavailable (e.g., bucket not yet migrated).
   */
  const uploadFileToStorage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    // Try Supabase Storage first
    try {
      const { data, error } = await supabase.storage.from('images').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('images').getPublicUrl(data.path);
      // Return relative URL so it works through the Express reverse proxy
      try {
        const u = new URL(urlData.publicUrl);
        return u.pathname; // e.g. /storage/v1/object/public/images/xxx.jpg
      } catch {
        return urlData.publicUrl;
      }
    } catch (storageError) {
      console.warn('[Image Upload] Storage unavailable, falling back to base64:', storageError);
      // Fallback: read the file as a base64 data URL
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image file as base64'));
        reader.readAsDataURL(file);
      });
    }
  };

  /**
   * Insert an image markdown into the MDEditor content at cursor position.
   * If the MDEditor textarea can't be found, appends at the end.
   */
  const insertImageIntoContent = (imgUrl: string, imgName: string) => {
    const markdown = `\n\n![${imgName}](${imgUrl})\n\n`;
    // Try to insert at cursor in the MDEditor's textarea
    const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement | null;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const before = text.substring(0, start);
      const after = text.substring(end);

      setEditingArticle(prev => ({
        ...prev,
        contentStr: before + markdown + after
      }));

      // Restore focus and cursor position after the inserted markdown
      setTimeout(() => {
        textarea.focus();
        const newPos = start + markdown.length;
        textarea.setSelectionRange(newPos, newPos);
      }, 50);
    } else {
      // Fallback: append at the end
      setEditingArticle(prev => ({
        ...prev,
        contentStr: (prev.contentStr || '') + markdown
      }));
    }
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
        const url = await uploadFileToStorage(file);
        
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
          const url = await uploadFileToStorage(file);
          
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

  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, WebP, GIF, AVIF, or SVG).');
      return;
    }
    // Validate file size (max 10MB)
    if (file.size > MAX_IMAGE_SIZE) {
      alert(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed is 10MB.`);
      return;
    }
    try {
      setIsUploadingImage(true);
      const url = await uploadFileToStorage(file);
      setEditingArticle(prev => ({ ...prev, imageUrl: url, _imgError: false }));
    } catch (e: any) {
      console.error('Error uploading image', e);
      alert(`Failed to upload image: ${e.message}`);
    } finally {
      setIsUploadingImage(false);
      setIsDraggingImage(false);
    }
  };    useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab as 'articles' | 'users' | 'ads');
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

  /** Fetch initial page of articles (page 0). */
  const fetchArticles = async () => {
    try {
      setLoading(true);
      setPage(0);
      const from = 0;
      const to = PAGE_SIZE - 1;
      let query = supabase
        .from('articles')
        .select('*')
        .order('createdAt', { ascending: false, nullsFirst: false })
        .range(from, to);
      if (role === 'poster') {
        query = query.eq('author_id', user?.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      setArticles(data || []);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (e) {
      handleSupabaseError(e, OperationType.LIST, 'articles');
    } finally {
      setLoading(false);
    }
  };

  /** Load the next page of articles and append to the existing list. */
  const loadMoreArticles = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const from = nextPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from('articles')
        .select('*')
        .order('createdAt', { ascending: false, nullsFirst: false })
        .range(from, to);
      if (role === 'poster') {
        query = query.eq('author_id', user?.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      setArticles(prev => [...prev, ...(data || [])]);
      setPage(nextPage);
      setHasMore((data?.length || 0) === PAGE_SIZE);
    } catch (e: any) {
      console.error('Error loading more articles', e);
      alert(`Failed to load more articles: ${e.message}`);
    } finally {
      setLoadingMore(false);
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
      const updatePayload: Record<string, any> = { status: newStatus };

      // When re-publishing, ensure all required fields are set
      if (newStatus === 'published') {
        // Fetch current article to fill in any missing required fields
        const { data: article } = await supabase
          .from('articles')
          .select('title, slug, category, category_id, author_id, published_at')
          .eq('id', id)
          .single();

        if (article) {
          if (!article.slug && article.title) {
            updatePayload.slug = slugify(article.title);
          }
          if (!article.category_id && article.category) {
            updatePayload.category_id = CATEGORY_UUID_MAP[article.category] || null;
          }
          if (!article.author_id && user) {
            updatePayload.author_id = user.id;
          }
          if (!article.published_at) {
            updatePayload.published_at = new Date().toISOString();
          }
        }
      }

      const { error } = await supabase
        .from('articles')
        .update(updatePayload)
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
        status: "draft"
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
      // Split by one or more blank lines (double-newline) to preserve paragraph boundaries.
      // Using \n{2,} handles markdown where paragraphs are separated by blank lines.
      const contentArr = contentStr
        ? contentStr.split(/\n{2,}/).filter((p: string) => p.trim() !== '')
        : src.contentArr || [];

      const articleStatus = src.status || 'draft';

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
        status:     articleStatus,
      };

      // Auto-generate slug from title
      if (src.title) {
        basePayload.slug = slugify(src.title);
      }

      // Map category name → category_id FK
      if (src.category && CATEGORY_UUID_MAP[src.category]) {
        basePayload.category_id = CATEGORY_UUID_MAP[src.category];
      }

      // Set published_at when publishing
      if (articleStatus === 'published') {
        basePayload.published_at = src.published_at || new Date().toISOString();
      }

      // Set scheduled_at when scheduling
      if (articleStatus === 'scheduled' && src.scheduled_at) {
        basePayload.scheduled_at = new Date(src.scheduled_at).toISOString();
      } else {
        basePayload.scheduled_at = null;
      }

      const now = new Date().toISOString();

      if (src.id) {
        // Set author_id if missing (FK references profiles.id = auth user UUID)
        if (!src.author_id && user) {
          basePayload.author_id = user.id;
        }
        const { error } = await supabase
          .from('articles')
          .update({ ...basePayload, updatedAt: now })
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
            createdAt: now,
            updatedAt: now,
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
          {role === 'dev' && (
            <button 
              className={`pb-2 px-2 font-bold ${activeTab === 'ads' ? 'border-b-2 border-black text-black' : 'text-gray-400'}`}
              onClick={() => setActiveTab('ads')}
            >
              Ad Management
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
                          {(() => {
                            const s = article.status || 'published';
                            const badge: Record<string, string> = {
                              published: 'bg-green-100 text-green-800',
                              draft: 'bg-gray-100 text-gray-600',
                              scheduled: 'bg-indigo-100 text-indigo-700',
                              archived: 'bg-yellow-100 text-yellow-800',
                            };
                            return (
                              <span className={`px-2 py-1 rounded text-xs font-bold ${badge[s] || badge.draft}`}>
                                {s === 'scheduled' ? `⏰ ${article.scheduled_at ? new Date(article.scheduled_at).toLocaleDateString() : 'SCHEDULED'}` : s.toUpperCase()}
                              </span>
                            );
                          })()}
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
              {/* Load More button */}
              {hasMore && articles.length > 0 && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={loadMoreArticles}
                    disabled={loadingMore}
                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-sm rounded-lg transition-colors border border-gray-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        Load More Articles
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'users' ? (
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
        ) : (
          /* Ad Management Tab — dev only */
          <AdManagementTab />
        )}
      </div>
      
      {isModalOpen && editingArticle && (() => {
        const contentText = editingArticle.contentStr || (editingArticle.contentArr ? editingArticle.contentArr.join('\n\n') : '');
        const wordCount = contentText.trim() ? contentText.trim().split(/\s+/).length : 0;
        const charCount = contentText.length;
        const metaDesc = editingArticle.excerpt || '';
        const metaLen = metaDesc.length;
        const tags: string[] = editingArticle.tags || [];
        const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            const val = (e.target as HTMLInputElement).value.trim();
            if (val && !tags.includes(val)) {
              setEditingArticle({ ...editingArticle, tags: [...tags, val] });
            }
            (e.target as HTMLInputElement).value = '';
          }
        };
        const handleRemoveTag = (tag: string) => {
          setEditingArticle({ ...editingArticle, tags: tags.filter(t => t !== tag) });
        };
        const publishAndSave = (e: React.MouseEvent) => {
          e.preventDefault();
          setEditingArticle((prev: any) => {
            const updated = { ...prev, status: 'published' };
            // Trigger save on next tick after state update
            setTimeout(() => {
              const form = document.getElementById('sema-editor-form') as HTMLFormElement;
              if (form) form.requestSubmit();
            }, 0);
            return updated;
          });
        };

        return (
        <div className="fixed inset-0 z-50" style={{ background: '#fff' }}>
          <form id="sema-editor-form" onSubmit={handleSave} className="h-full flex flex-col">
            {/* ──── Full-screen 2-column layout ──── */}
            <div className="flex-1 min-h-0" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 0 }}>
              {/* ════════ LEFT: Editor Column ════════ */}
              <div className="flex flex-col border-r" style={{ borderColor: '#e5e7eb' }}>
                {/* Top bar */}
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#e5e7eb', background: '#f9fafb' }}>
                  <div className="flex items-center gap-2.5">
                    <button type="button" onClick={closeModal} className="p-1.5 rounded hover:bg-gray-200 transition-colors" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                      <X size={18} className="text-gray-500" />
                    </button>
                    <div className="w-2 h-2 rounded-full" style={{ background: editingArticle.status === 'published' ? '#1D9E75' : editingArticle.status === 'scheduled' ? '#6366f1' : editingArticle.status === 'archived' ? '#eab308' : '#f59e0b' }} />
                    <span style={{ fontSize: 12, color: '#6b7280' }}>
                      {editingArticle.id ? 'Editing' : 'New'} — {editingArticle.status === 'scheduled' ? `⏰ Scheduled` : (editingArticle.status || 'draft')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                      style={{ border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: loading ? 'not-allowed' : 'pointer' }}
                    >
                      {loading ? 'Saving...' : 'Save Draft'}
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={publishAndSave}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                      style={{ border: '1px solid #1D9E75', background: '#1D9E75', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer' }}
                    >
                      Publish ↗
                    </button>
                  </div>
                </div>

                {/* Editor body */}
                <div className="flex-1 overflow-y-auto" style={{ padding: '28px 36px' }}>
                  <textarea
                    required
                    rows={2}
                    placeholder="Article title..."
                    value={editingArticle.title}
                    onChange={e => setEditingArticle({ ...editingArticle, title: e.target.value })}
                    style={{
                      width: '100%', border: 'none', outline: 'none', fontSize: 28, fontWeight: 600,
                      color: '#111827', background: 'transparent', lineHeight: 1.3, marginBottom: 6,
                      resize: 'none', fontFamily: 'inherit',
                    }}
                  />

                  {/* Meta chips */}
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b" style={{ borderColor: '#e5e7eb' }}>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                      ✎ {editingArticle.author || 'Author'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                      📅 {editingArticle.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ fontSize: 12, color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
                      📁 {editingArticle.category || 'Category'}
                    </span>
                  </div>

                  {/* Image toolbar */}
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b" style={{ borderColor: '#e5e7eb' }}>
                    <button
                      type="button"
                      onClick={() => contentImgRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-gray-100"
                      style={{ border: '1px solid #d1d5db', background: '#fff', color: '#374151', cursor: 'pointer' }}
                    >
                      <UploadCloud size={14} /> Insert Image
                    </button>
                    <input
                      type="file"
                      ref={contentImgRef}
                      className="hidden"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const url = await uploadFileToStorage(file);
                          insertImageIntoContent(url, file.name);
                          setGalleryImages(prev => [...prev, { url, name: file.name }]);
                        } catch (err: any) {
                          alert('Failed to upload: ' + err.message);
                        }
                        e.target.value = '';
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>or drag & drop images into the editor</span>
                  </div>

                  {/* MDEditor */}
                  <div data-color-mode="light">
                    <MDEditor
                      value={contentText}
                      onChange={(val) => setEditingArticle({ ...editingArticle, contentStr: val || '' })}
                      onDrop={handleTextareaDrop}
                      height={500}
                      style={{ border: 'none', boxShadow: 'none' }}
                    />
                  </div>
                </div>

                {/* Word count */}
                <div style={{ fontSize: 12, color: '#9ca3af', padding: '8px 36px 12px', textAlign: 'right', borderTop: '1px solid #e5e7eb' }}>
                  {wordCount} words · {charCount} characters
                </div>
              </div>

              {/* ════════ RIGHT: Sidebar ════════ */}
              <div className="flex flex-col overflow-y-auto" style={{ background: '#f9fafb' }}>
                {/* Cover image */}
                <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Cover Image</div>
                  {editingArticle.imageUrl && !isUploadingImage ? (
                    <div className="relative group rounded-lg overflow-hidden" style={{ border: '1px solid #e5e7eb' }}>
                      <img src={editingArticle.imageUrl} alt="Cover" style={{ width: '100%', height: 120, objectFit: 'cover' }} onError={() => setEditingArticle((prev: any) => ({ ...prev, _imgError: true }))} />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <button type="button" onClick={() => fileInputRef.current?.click()} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#fff', color: '#374151', cursor: 'pointer', fontWeight: 600 }}>Change</button>
                        <button type="button" onClick={() => setEditingArticle((prev: any) => ({ ...prev, imageUrl: '', _imgError: false }))} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingImage(true); }}
                      onDragLeave={() => setIsDraggingImage(false)}
                      onDrop={(e) => { e.preventDefault(); setIsDraggingImage(false); const f = e.dataTransfer.files?.[0]; if (f && f.type.startsWith('image/')) handleImageUpload(f); }}
                      className="flex flex-col items-center justify-center gap-1.5 rounded-lg"
                      style={{ height: 110, border: `1.5px dashed ${isDraggingImage ? '#1D9E75' : '#d1d5db'}`, background: isDraggingImage ? '#E1F5EE' : '#fff', cursor: 'pointer', color: '#9ca3af', fontSize: 12, transition: 'all 0.15s' }}
                    >
                      {isUploadingImage ? <><UploadCloud size={20} className="animate-bounce" /> Uploading...</> : <><UploadCloud size={20} /><span>Upload image</span></>}
                    </div>
                  )}
                  <input type="url" placeholder="or paste URL..." value={editingArticle.imageUrl || ''} onChange={e => setEditingArticle({ ...editingArticle, imageUrl: e.target.value })} style={{ width: '100%', marginTop: 6, padding: '5px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12, outline: 'none', background: '#fff', color: '#374151' }} />
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                  <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" multiple onChange={(e: React.ChangeEvent<HTMLInputElement>) => { const files = Array.from(e.target.files || []) as File[]; if (files.length > 0) handleBatchGalleryUpload(files); }} />
                </div>

                {/* ── Image Gallery (insert into content) ── */}
                <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Image Gallery</div>
                    <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex items-center gap-1" style={{ fontSize: 11, fontWeight: 600, color: '#1D9E75', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      <UploadCloud size={12} /> Upload
                    </button>
                  </div>
                  {/* Drop zone */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingGallery(true); }}
                    onDragLeave={() => setIsDraggingGallery(false)}
                    onDrop={(e) => {
                      e.preventDefault(); setIsDraggingGallery(false);
                      const files = Array.from(e.dataTransfer.files || []).filter((f: File) => f.type.startsWith('image/')) as File[];
                      if (files.length > 0) handleBatchGalleryUpload(files);
                    }}
                    className="rounded-lg mb-2 flex items-center justify-center gap-1.5"
                    style={{ padding: '6px 0', border: `1.5px dashed ${isDraggingGallery ? '#1D9E75' : '#d1d5db'}`, background: isDraggingGallery ? '#E1F5EE' : '#fff', fontSize: 11, color: '#9ca3af', transition: 'all 0.15s' }}
                  >
                    {isUploadingGallery ? <><UploadCloud size={12} className="animate-bounce" /> Uploading...</> : <><UploadCloud size={12} /> Drop images here</>}
                  </div>
                  {/* Gallery grid */}
                  <div className="grid grid-cols-3 gap-1.5" style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {galleryImages.length === 0 ? (
                      <div className="col-span-3 text-center py-4" style={{ fontSize: 11, color: '#9ca3af' }}>No images yet</div>
                    ) : (
                      galleryImages.map((img, i) => (
                        <div
                          key={i}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('application/x-gallery-image', JSON.stringify(img));
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          className="relative rounded overflow-hidden cursor-grab active:cursor-grabbing group"
                          style={{ aspectRatio: '1', border: '1px solid #e5e7eb' }}
                        >
                          <img src={img.url} className="w-full h-full object-cover" draggable={false} />
                          {/* Hover overlay with actions */}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); insertImageIntoContent(img.url, img.name); }}
                              className="rounded-full p-1 shadow-md transition-colors"
                              style={{ background: '#fff', border: 'none', cursor: 'pointer', color: '#1D9E75' }}
                              title="Insert into article"
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEditingArticle({ ...editingArticle, imageUrl: img.url }); }}
                              className="rounded-full p-1 shadow-md transition-colors"
                              style={{ background: '#fff', border: 'none', cursor: 'pointer', color: '#374151' }}
                              title="Set as cover image"
                            >
                              <CheckCircle size={14} />
                            </button>
                          </div>
                          {/* Cover indicator */}
                          {editingArticle.imageUrl === img.url && (
                            <div className="absolute top-0.5 right-0.5 rounded-full p-0.5 shadow" style={{ background: '#1D9E75', color: '#fff' }}>
                              <CheckCircle size={10} />
                            </div>
                          )}
                          {/* Drag hint */}
                          <div className="absolute bottom-0 left-0 right-0 text-center py-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9 }}>
                            Drag to insert
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Author */}
                <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Author</div>
                  <input required type="text" value={editingArticle.author} onChange={e => setEditingArticle({ ...editingArticle, author: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', background: '#fff', color: '#374151' }} />
                </div>

                {/* Category */}
                <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Category</div>
                  <select required value={editingArticle.category} onChange={e => setEditingArticle({ ...editingArticle, category: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', background: '#fff', color: '#374151' }}>
                    <option value="World">World</option>
                    <option value="Politics">Politics</option>
                    <option value="Business">Business</option>
                    <option value="Tech">Tech</option>
                    <option value="Science">Science</option>
                    <option value="Health">Health</option>
                    <option value="Sports">Sports</option>
                    <option value="Arts">Arts</option>
                    <option value="Opinion">Opinion</option>
                  </select>
                </div>

                {/* Tags */}
                <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Tags</div>
                  <input placeholder="Add tag, press Enter..." onKeyDown={handleAddTag} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', background: '#fff', color: '#374151' }} />
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {tags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full" style={{ fontSize: 12, background: '#E1F5EE', color: '#0F6E56', padding: '3px 9px' }}>
                          {tag}
                          <span onClick={() => handleRemoveTag(tag)} style={{ cursor: 'pointer', opacity: 0.7, fontSize: 11 }}>✕</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Status</div>
                  <select value={editingArticle.status || 'draft'} onChange={e => {
                    const newStatus = e.target.value;
                    const update: any = { ...editingArticle, status: newStatus };
                    if (newStatus === 'scheduled' && !update.scheduled_at) {
                      // Default to 1 hour from now
                      const d = new Date(Date.now() + 3600000);
                      update.scheduled_at = d.toISOString().slice(0, 16);
                    }
                    if (newStatus !== 'scheduled') {
                      update.scheduled_at = null;
                    }
                    setEditingArticle(update);
                  }} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', background: '#fff', color: '#374151' }}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="scheduled">⏰ Scheduled</option>
                    <option value="archived">Archived</option>
                  </select>
                  {editingArticle.status === 'scheduled' && (
                    <div style={{ marginTop: 8 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', display: 'block', marginBottom: 4 }}>Publish At</label>
                      <input
                        type="datetime-local"
                        value={editingArticle.scheduled_at || ''}
                        onChange={e => setEditingArticle({ ...editingArticle, scheduled_at: e.target.value })}
                        min={new Date().toISOString().slice(0, 16)}
                        style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #6366f1', fontSize: 13, outline: 'none', background: '#eef2ff', color: '#374151' }}
                      />
                      {editingArticle.scheduled_at && (
                        <div style={{ fontSize: 11, color: '#6366f1', marginTop: 4 }}>
                          Will auto-publish {new Date(editingArticle.scheduled_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Excerpt / SEO */}
                <div style={{ padding: 16, borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Excerpt / Meta Description</div>
                  <textarea rows={3} placeholder="Article summary for SEO and previews..." value={editingArticle.excerpt || ''} onChange={e => setEditingArticle({ ...editingArticle, excerpt: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', resize: 'none', background: '#fff', color: '#374151' }} />
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{metaLen}/160 characters {metaLen >= 120 && metaLen <= 160 ? '✓' : ''}</div>
                  <div style={{ height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden', marginTop: 4 }}>
                    <div style={{ height: '100%', borderRadius: 2, background: metaLen >= 120 && metaLen <= 160 ? '#1D9E75' : metaLen > 160 ? '#ef4444' : '#f59e0b', width: `${Math.min((metaLen / 160) * 100, 100)}%`, transition: 'width 0.2s' }} />
                  </div>
                </div>

                {/* Subtitle */}
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Subtitle</div>
                  <input type="text" placeholder="Optional subtitle..." value={editingArticle.subtitle || ''} onChange={e => setEditingArticle({ ...editingArticle, subtitle: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', background: '#fff', color: '#374151' }} />
                </div>
              </div>
            </div>
          </form>
        </div>
        );
      })()}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ad Management Tab — dev only
// ---------------------------------------------------------------------------
function AdManagementTab() {
  const { user, role } = useAuth();
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    image_url: '',
    target_url: '',
    duration_seconds: 10,
    frequency: 1,
    is_active: false,
    ad_format: 'horizontal' as string,
  });

  const AD_FORMATS = [
    { value: 'horizontal', label: 'Leaderboard', size: '728 × 90 px', w: 728, h: 90, shape: 'wide' },
    { value: 'vertical', label: 'Medium Rectangle', size: '300 × 250 px', w: 300, h: 250, shape: 'box' },
    { value: 'native', label: 'In-Feed Native Card', size: '250 × 200 px', w: 250, h: 200, shape: 'box' },
    { value: 'anchor', label: 'Mobile Anchor Banner', size: '320 × 50 px', w: 320, h: 50, shape: 'wide' },
    { value: 'fluid', label: 'Fluid Full-Width', size: '100% × 150 px', w: 970, h: 150, shape: 'wide' },
  ] as const;
  const [isUploadingSponsorImage, setIsUploadingSponsorImage] = useState(false);
  const [isDraggingSponsorImage, setIsDraggingSponsorImage] = useState(false);
  const sponsorImageInputRef = useRef<HTMLInputElement>(null);

  const fetchSponsors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ad_sponsors')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSponsors(data || []);
    } catch (e: any) {
      console.error('Error fetching ad sponsors', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role === 'dev') fetchSponsors();
  }, [role]);

  const resetForm = () => {
    setForm({ name: '', image_url: '', target_url: '', duration_seconds: 10, frequency: 1, is_active: false, ad_format: 'horizontal' });
    setEditingId(null);
    setShowForm(false);
  };

  const openEdit = (sp: any) => {
    setForm({
      name: sp.name || '',
      image_url: sp.image_url || '',
      target_url: sp.target_url || '',
      duration_seconds: sp.duration_seconds ?? 10,
      frequency: sp.frequency ?? 1,
      is_active: sp.is_active ?? false,
      ad_format: sp.ad_format || 'horizontal',
    });
    setEditingId(sp.id);
    setShowForm(true);
  };

  const handleSaveSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('Sponsor name is required.');
      return;
    }
    try {
      setLoading(true);
      const payload = {
        name: form.name.trim(),
        image_url: form.image_url || '',
        target_url: form.target_url || '',
        duration_seconds: form.duration_seconds,
        frequency: form.frequency,
        is_active: form.is_active,
        ad_format: form.ad_format,
        created_by: user?.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from('ad_sponsors')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ad_sponsors')
          .insert(payload);
        if (error) throw error;
      }

      resetForm();
      fetchSponsors();
    } catch (e: any) {
      console.error('Error saving sponsor', e);
      alert(`Failed to save sponsor: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (sp: any) => {
    try {
      const { error } = await supabase
        .from('ad_sponsors')
        .update({ is_active: !sp.is_active, updated_at: new Date().toISOString() })
        .eq('id', sp.id);
      if (error) throw error;
      fetchSponsors();
    } catch (e: any) {
      console.error('Error toggling sponsor', e);
    }
  };

  /** Upload a sponsor image to storage and return the public URL */
  const uploadSponsorImage = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `sponsors/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    try {
      const { data, error } = await supabase.storage.from('images').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('images').getPublicUrl(data.path);
      try {
        const u = new URL(urlData.publicUrl);
        return u.pathname;
      } catch {
        return urlData.publicUrl;
      }
    } catch (storageError) {
      console.warn('[Sponsor Image] Storage unavailable, falling back to base64:', storageError);
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read image file as base64'));
        reader.readAsDataURL(file);
      });
    }
  };

  const handleSponsorImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (JPEG, PNG, WebP, GIF, AVIF, or SVG).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed is 10MB.`);
      return;
    }
    try {
      setIsUploadingSponsorImage(true);
      const url = await uploadSponsorImage(file);
      setForm(prev => ({ ...prev, image_url: url }));
    } catch (e: any) {
      console.error('Error uploading sponsor image', e);
      alert(`Failed to upload image: ${e.message}`);
    } finally {
      setIsUploadingSponsorImage(false);
      setIsDraggingSponsorImage(false);
    }
  };

  const handleDeleteSponsor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this sponsor? This cannot be undone.')) return;
    try {
      const { error } = await supabase
        .from('ad_sponsors')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchSponsors();
    } catch (e: any) {
      console.error('Error deleting sponsor', e);
      alert(`Failed to delete sponsor: ${e.message}`);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">Ad Sponsor Management</h2>
          <p className="text-xs text-gray-500 mt-1">
            Manage approved sponsors. Only active sponsors with is_active ✓ will appear on the public site.
            Set duration (seconds) and frequency (every Nth page load) per sponsor.
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center space-x-2 bg-black text-white hover:bg-gray-800 px-4 py-2 rounded text-sm transition cursor-pointer border-0"
        >
          <Plus size={16} />
          <span>Add Sponsor</span>
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-gray-50">
          <h3 className="font-bold text-sm mb-3">{editingId ? 'Edit Sponsor' : 'New Sponsor'}</h3>
          <form onSubmit={handleSaveSponsor} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Sponsor Name *</label>
              <input
                required
                type="text"
                className="w-full border p-2 rounded text-sm"
                placeholder="ACME Corp"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>

            {/* Ad Format Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Ad Format *</label>
              <div className="flex flex-col gap-2">
                {AD_FORMATS.map(fmt => (
                  <label
                    key={fmt.value}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border-2 cursor-pointer transition-all ${
                      form.ad_format === fmt.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="ad_format"
                      value={fmt.value}
                      checked={form.ad_format === fmt.value}
                      onChange={() => setForm({ ...form, ad_format: fmt.value as any })}
                      className="w-3.5 h-3.5"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-gray-800">{fmt.label}</div>
                      <div className="text-[10px] text-gray-500">{fmt.size}</div>
                    </div>
                    {/* Mini preview shape */}
                    <div
                      className="rounded border border-gray-300 bg-gray-100 flex items-center justify-center"
                      style={{
                        width: fmt.shape === 'wide' ? 64 : 36,
                        height: fmt.shape === 'wide' ? (fmt.value === 'anchor' ? 6 : fmt.value === 'fluid' ? 12 : 8) : 30,
                        fontSize: 7,
                        color: '#9ca3af',
                      }}
                    >
                      {fmt.shape === 'wide' ? '━━━' : '▮'}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Sponsor Image
                <span className="text-[10px] font-normal text-gray-400 ml-1">
                  ({AD_FORMATS.find(f => f.value === form.ad_format)?.size})
                </span>
              </label>
              
              {/* Upload drop zone */}
              {(() => {
                const fmt = AD_FORMATS.find(f => f.value === form.ad_format);
                const previewH = fmt ? Math.min(Math.round(fmt.h * 0.6), 180) : 100;
                const previewMaxW = fmt && fmt.shape === 'box' ? 220 : '100%';
                return form.image_url && !isUploadingSponsorImage ? (
                <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-white group" style={{ height: previewH, maxWidth: previewMaxW }}>
                  <img
                    src={form.image_url}
                    alt="Sponsor banner preview"
                    className="w-full h-full object-contain bg-gray-50"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => sponsorImageInputRef.current?.click()}
                      className="bg-white text-gray-800 px-2.5 py-1 rounded text-[10px] font-bold shadow-md hover:bg-gray-100 transition-colors border-0 cursor-pointer"
                    >
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, image_url: '' }))}
                      className="bg-red-500 text-white px-2.5 py-1 rounded text-[10px] font-bold shadow-md hover:bg-red-600 transition-colors border-0 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center transition-colors cursor-pointer ${
                    isDraggingSponsorImage
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-300 hover:border-gray-400 bg-white'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingSponsorImage(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDraggingSponsorImage(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingSponsorImage(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleSponsorImageFile(file);
                  }}
                  onClick={() => sponsorImageInputRef.current?.click()}
                  style={{ height: previewH, maxWidth: previewMaxW }}
                >
                  <input
                    type="file"
                    ref={sponsorImageInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSponsorImageFile(file);
                    }}
                  />
                  {isUploadingSponsorImage ? (
                    <div className="flex items-center gap-1.5 text-green-600 text-xs font-semibold">
                      <UploadCloud size={16} className="animate-bounce" />
                      Uploading...
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 px-2">
                      <UploadCloud size={20} className="text-gray-400" />
                      <span className="text-[10px] text-gray-500 leading-tight">
                        Drop image or <span className="text-blue-600 font-semibold">browse</span>
                      </span>
                      {form.image_url && (
                        <span className="text-[9px] text-green-600 font-medium">URL set ✓</span>
                      )}
                    </div>
                  )}
                </div>
              );
              })()}
              {/* Show the URL value underneath for reference */}
              {form.image_url && (
                <input
                  type="url"
                  className="w-full border p-1.5 rounded text-[10px] mt-1 text-gray-500"
                  placeholder="https://..."
                  value={form.image_url}
                  onChange={e => setForm({ ...form, image_url: e.target.value })}
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Target URL (click-through)</label>
              <input
                type="url"
                className="w-full border p-2 rounded text-sm"
                placeholder="https://example.com"
                value={form.target_url}
                onChange={e => setForm({ ...form, target_url: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Duration (seconds)</label>
              <input
                type="number"
                min={3}
                max={120}
                className="w-full border p-2 rounded text-sm"
                value={form.duration_seconds}
                onChange={e => setForm({ ...form, duration_seconds: parseInt(e.target.value) || 10 })}
              />
              <span className="text-[10px] text-gray-400">How long this ad shows before rotating (3–120s)</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Frequency (every N page loads)</label>
              <input
                type="number"
                min={1}
                max={100}
                className="w-full border p-2 rounded text-sm"
                value={form.frequency}
                onChange={e => setForm({ ...form, frequency: parseInt(e.target.value) || 1 })}
              />
              <span className="text-[10px] text-gray-400">1 = show on every page load, 5 = show every 5th load</span>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-xs font-semibold text-gray-600">Active (approved)</span>
              </label>
            </div>
            <div className="flex items-end gap-2 md:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 transition disabled:bg-blue-300 border-0 cursor-pointer"
              >
                {loading ? 'Saving...' : editingId ? 'Update Sponsor' : 'Create Sponsor'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border rounded text-sm hover:bg-gray-100 transition cursor-pointer bg-white"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sponsor list */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-3 text-sm font-semibold">Sponsor</th>
              <th className="p-3 text-sm font-semibold">Format</th>
              <th className="p-3 text-sm font-semibold">Status</th>
              <th className="p-3 text-sm font-semibold">Duration</th>
              <th className="p-3 text-sm font-semibold">Frequency</th>
              <th className="p-3 text-sm font-semibold">Target URL</th>
              <th className="p-3 text-sm font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sponsors.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500 font-medium">
                  No sponsors yet. Click "Add Sponsor" to create one.
                </td>
              </tr>
            ) : (
              sponsors.map(sp => (
                <tr key={sp.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      {sp.image_url ? (
                        <img
                          src={sp.image_url}
                          alt={sp.name}
                          className="w-10 h-10 object-contain rounded border bg-white"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-400 font-bold">
                          {sp.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="font-bold text-sm">{sp.name}</div>
                    </div>
                  </td>
                  <td className="p-3">
                    {(() => {
                      const badges: Record<string, { cls: string; label: string }> = {
                        horizontal: { cls: 'bg-sky-100 text-sky-700', label: '━ 728×90' },
                        vertical: { cls: 'bg-purple-100 text-purple-700', label: '▮ 300×250' },
                        native: { cls: 'bg-amber-100 text-amber-700', label: '◧ 250×200' },
                        anchor: { cls: 'bg-emerald-100 text-emerald-700', label: '▬ 320×50' },
                        fluid: { cls: 'bg-rose-100 text-rose-700', label: '▭ Fluid' },
                      };
                      const b = badges[sp.ad_format] || badges.horizontal;
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${b.cls}`}>
                          {b.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleToggleActive(sp)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold transition border-0 cursor-pointer ${
                        sp.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {sp.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                      {sp.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="p-3 text-sm">
                    <span className="font-mono font-bold">{sp.duration_seconds ?? 10}s</span>
                    <span className="text-xs text-gray-400 ml-1">per ad</span>
                  </td>
                  <td className="p-3 text-sm">
                    <span className="font-mono font-bold">1:{sp.frequency ?? 1}</span>
                    <span className="text-xs text-gray-400 ml-1">pages</span>
                  </td>
                  <td className="p-3 text-sm max-w-[200px] truncate">
                    {sp.target_url ? (
                      <a
                        href={sp.target_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 text-xs"
                      >
                        {sp.target_url}
                        <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => openEdit(sp)}
                        className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 cursor-pointer border-0"
                        title="Edit sponsor"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteSponsor(sp.id)}
                        className="p-1.5 bg-red-100 text-red-650 rounded hover:bg-red-200 cursor-pointer border-0"
                        title="Delete sponsor"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
