import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import { useArticles } from '../App';
import { LogOut, Plus, Edit2, Trash2, Archive, CheckCircle, Database, X, UploadCloud, Mail, Sparkles, ShieldAlert, ExternalLink, Eye, EyeOff, Inbox, Clock, XCircle, UserCheck, MessageCircle, CreditCard, Search, Phone, MapPin, BarChart3, TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';
import { useAuth } from '../components/AuthProvider';
import DailyGeneratorTab from '../components/DailyGeneratorTab';
import ImageEditorModal from '../components/ImageEditorModal';

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
  const [activeTab, setActiveTab] = useState<'articles' | 'users' | 'ads' | 'daily' | 'sfkeys' | 'inbox' | 'analytics'>('articles');
  const [profiles, setProfiles] = useState<any[]>([]);

  // Inbox state
  const [pendingWriters, setPendingWriters] = useState<any[]>([]);
  const [pendingArticles, setPendingArticles] = useState<any[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState<{type: 'writer' | 'article', id: string} | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [quotaRequests, setQuotaRequests] = useState<any[]>([]);
  const [showQuotaForm, setShowQuotaForm] = useState(false);
  const [quotaFormData, setQuotaFormData] = useState({ amount: 5, message: '', proof_url: '' });
  const [quotaSubmitting, setQuotaSubmitting] = useState(false);
  const [myQuotaRequests, setMyQuotaRequests] = useState<any[]>([]);
  const [investigateUser, setInvestigateUser] = useState<any>(null);
  const [investigateArticles, setInvestigateArticles] = useState<any[]>([]);

  const WHATSAPP_NUMBER = '6281234567890'; // Change to your admin WA number
  const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Halo Admin, saya ingin request quota publikasi. Berikut bukti transfer saya:')}`;

  const fetchInbox = async () => {
    setInboxLoading(true);
    try {
      const [writers, articles, quotaReqs] = await Promise.all([
        supabase.from('profiles').select('*').eq('writer_status', 'pending').order('applied_at', { ascending: false }),
        supabase.from('articles').select('*').eq('status', 'pending_review').order('createdAt', { ascending: false }),
        supabase.from('quota_requests').select('*, profiles!quota_requests_profile_fk(email, full_name, pen_name, role, quota, phone_number, city, bio, profile_photo, writer_status)').eq('status', 'pending').order('created_at', { ascending: false }),
      ]);
      setPendingWriters(writers.data || []);
      setPendingArticles(articles.data || []);
      setQuotaRequests(quotaReqs.data || []);
    } catch (e) {
      console.error('Inbox fetch error:', e);
    } finally {
      setInboxLoading(false);
    }
  };

  const approveWriter = async (profileId: string) => {
    try {
      const { error } = await supabase.from('profiles').update({
        role: 'poster', writer_status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString(), quota: 5,
      }).eq('id', profileId);
      if (error) throw error;
      fetchInbox();
      fetchProfiles();
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const rejectWriter = async (profileId: string, reason: string) => {
    try {
      const { error } = await supabase.from('profiles').update({
        writer_status: 'rejected', rejection_reason: reason || 'Application not approved.', reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
      }).eq('id', profileId);
      if (error) throw error;
      setRejectModal(null); setRejectReason('');
      fetchInbox();
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const approveArticle = async (articleId: string) => {
    try {
      const { error } = await supabase.from('articles').update({
        status: 'published', published_at: new Date().toISOString(),
      }).eq('id', articleId);
      if (error) throw error;
      fetchInbox(); fetchArticles(); refetchGlobalArticles();
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const rejectArticle = async (articleId: string, reason: string) => {
    try {
      const { error } = await supabase.from('articles').update({
        status: 'rejected',
      }).eq('id', articleId);
      if (error) throw error;
      setRejectModal(null); setRejectReason('');
      fetchInbox(); fetchArticles();
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  // Quota request handlers
  const approveQuotaRequest = async (requestId: string, userId: string, amount: number) => {
    try {
      // Update request status
      const { error: reqErr } = await supabase.from('quota_requests').update({
        status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
      }).eq('id', requestId);
      if (reqErr) throw reqErr;
      // Add quota to user profile
      const targetProfile = profiles.find((p: any) => p.id === userId);
      const newQuota = (targetProfile?.quota || 0) + amount;
      const { error: profErr } = await supabase.from('profiles').update({ quota: newQuota }).eq('id', userId);
      if (profErr) throw profErr;
      fetchInbox(); fetchProfiles();
      // Auto-log income for quota purchase
      try {
        await supabase.from('financial_transactions').insert({
          type: 'income', category: 'quota_purchase', amount: amount * 10000,
          description: `Quota purchase: +${amount} articles`, reference_id: requestId, recorded_by: user?.id,
          transaction_date: new Date().toISOString().split('T')[0],
        });
      } catch (e) { console.error('Auto-log failed:', e); }
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const rejectQuotaRequest = async (requestId: string, notes: string) => {
    try {
      const { error } = await supabase.from('quota_requests').update({
        status: 'rejected', admin_notes: notes || 'Request not approved.', reviewed_by: user?.id, reviewed_at: new Date().toISOString(),
      }).eq('id', requestId);
      if (error) throw error;
      setRejectModal(null); setRejectReason('');
      fetchInbox();
    } catch (e: any) { alert('Failed: ' + e.message); }
  };

  const submitQuotaRequest = async () => {
    if (!user) return;
    setQuotaSubmitting(true);
    try {
      const { error } = await supabase.from('quota_requests').insert({
        user_id: user.id, amount: quotaFormData.amount, message: quotaFormData.message || null, proof_url: quotaFormData.proof_url || null,
      });
      if (error) throw error;
      setShowQuotaForm(false);
      setQuotaFormData({ amount: 5, message: '', proof_url: '' });
      // Refetch my requests
      const { data } = await supabase.from('quota_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setMyQuotaRequests(data || []);
      alert('Quota request submitted! Admin will review it shortly.');
    } catch (e: any) { alert('Failed: ' + e.message); }
    finally { setQuotaSubmitting(false); }
  };

  const handleProofUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { alert('Please upload an image'); return; }
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `proofs/${user!.id}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('images').upload(path, file, { cacheControl: '3600', upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('images').getPublicUrl(data.path);
      setQuotaFormData(prev => ({ ...prev, proof_url: urlData.publicUrl }));
    } catch {
      const reader = new FileReader();
      reader.onload = () => setQuotaFormData(prev => ({ ...prev, proof_url: reader.result as string }));
      reader.readAsDataURL(file);
    }
  };

  const investigateUserData = async (userId: string) => {
    try {
      const [profileRes, articlesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('articles').select('id, title, status, category, createdAt, author').eq('author_id', userId).order('createdAt', { ascending: false }).limit(20),
      ]);
      setInvestigateUser(profileRes.data);
      setInvestigateArticles(articlesRes.data || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (user && (role === 'admin' || role === 'dev')) fetchInbox();
    // Fetch my own quota requests for poster
    if (user && role === 'poster') {
      supabase.from('quota_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        .then(({ data }) => setMyQuotaRequests(data || []));
    }
  }, [user, role]);

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

  // Image editor state
  const [editorImageUrl, setEditorImageUrl] = useState<string>('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTarget, setEditorTarget] = useState<'cover' | 'gallery' | null>(null);
  const [editorGalleryIndex, setEditorGalleryIndex] = useState(-1);

  const openEditor = (url: string, target: 'cover' | 'gallery', galleryIdx = -1) => {
    setEditorImageUrl(url);
    setEditorTarget(target);
    setEditorGalleryIndex(galleryIdx);
    setEditorOpen(true);
  };

  const handleEditorSave = async (blob: Blob, _blobUrl: string) => {
    try {
      const file = new File([blob], `edited-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const url = await uploadFileToStorage(file);
      if (editorTarget === 'cover') {
        setEditingArticle((prev: any) => ({ ...prev, imageUrl: url, _imgError: false }));
      } else if (editorTarget === 'gallery' && editorGalleryIndex >= 0) {
        setGalleryImages(prev => {
          const next = [...prev];
          next[editorGalleryIndex] = { ...next[editorGalleryIndex], url };
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to upload edited image:', err);
      alert('Failed to upload edited image');
    } finally {
      setEditorOpen(false);
    }
  };

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
    if (loading) return; // Prevent double submission
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
      // Poster articles go to pending_review — admin/dev publish directly
      if (articleStatus === 'published' && role === 'poster') {
        basePayload.status = 'pending_review';
        basePayload.published_at = null;
      } else if (articleStatus === 'published') {
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
          {role === 'dev' && (
            <button 
              className={`pb-2 px-2 font-bold ${activeTab === 'daily' ? 'border-b-2 border-black text-black' : 'text-gray-400'}`}
              onClick={() => setActiveTab('daily')}
            >
              🗞️ Daily Generator
            </button>
          )}
          {(role === 'admin' || role === 'dev') && (
            <button 
              className={`pb-2 px-2 font-bold ${activeTab === 'sfkeys' ? 'border-b-2 border-black text-black' : 'text-gray-400'}`}
              onClick={() => setActiveTab('sfkeys')}
            >
              🔑 SF Keys
            </button>
          )}
          {(role === 'admin' || role === 'dev') && (
            <button 
              className={`pb-2 px-2 font-bold relative ${activeTab === 'inbox' ? 'border-b-2 border-black text-black' : 'text-gray-400'}`}
              onClick={() => { setActiveTab('inbox'); fetchInbox(); }}
            >
              📬 Inbox
              {(pendingWriters.length + pendingArticles.length + quotaRequests.length) > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingWriters.length + pendingArticles.length + quotaRequests.length}
                </span>
              )}
            </button>
          )}
          {(role === 'admin' || role === 'dev') && (
            <button 
              className={`pb-2 px-2 font-bold ${activeTab === 'analytics' ? 'border-b-2 border-black text-black' : 'text-gray-400'}`}
              onClick={() => setActiveTab('analytics')}
            >
              📊 Analytics
            </button>
          )}
        </div>

        {role === 'poster' && (
          <div className="mb-6 space-y-3">
            <div className="p-4 border rounded-lg flex items-center justify-between" style={{ backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }}>
              <div>
                <h3 className="font-bold text-purple-900">Journalist Upload Quota</h3>
                <p className="text-xs text-purple-750">You can upload up to {quota} more articles. Each new upload consumes 1 quota point.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-2xl font-black text-purple-900">{quota}</span>
                  <span className="block text-[10px] text-purple-500 font-bold uppercase tracking-wider">Remaining</span>
                </div>
                <button onClick={() => setShowQuotaForm(!showQuotaForm)} className="flex items-center gap-1.5 px-3 py-2 bg-purple-700 text-white text-xs font-bold rounded-lg hover:bg-purple-800 transition-colors cursor-pointer border-0">
                  <CreditCard size={14} /> Request Quota
                </button>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors no-underline">
                  <MessageCircle size={14} /> Chat WA
                </a>
              </div>
            </div>

            {/* Quota Request Form */}
            {showQuotaForm && (
              <div className="p-4 bg-white border border-purple-200 rounded-lg space-y-3">
                <h4 className="font-bold text-sm">Request Additional Quota</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Amount</label>
                    <select value={quotaFormData.amount} onChange={e => setQuotaFormData(prev => ({ ...prev, amount: parseInt(e.target.value) }))} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                      {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n} articles</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Transfer Proof</label>
                    <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleProofUpload(f); }} className="w-full text-sm" />
                  </div>
                </div>
                {quotaFormData.proof_url && (
                  <div className="flex items-center gap-2">
                    <img src={quotaFormData.proof_url} alt="Proof" className="w-20 h-20 rounded object-cover border" />
                    <button type="button" onClick={() => setQuotaFormData(prev => ({ ...prev, proof_url: '' }))} className="text-xs text-red-600 hover:underline bg-transparent border-0 cursor-pointer">Remove</button>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Message (optional)</label>
                  <textarea rows={2} value={quotaFormData.message} onChange={e => setQuotaFormData(prev => ({ ...prev, message: e.target.value }))} placeholder="Additional info or payment details..." className="w-full border border-gray-300 rounded px-3 py-2 text-sm resize-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={submitQuotaRequest} disabled={quotaSubmitting} className="px-4 py-2 bg-purple-700 text-white text-xs font-bold rounded hover:bg-purple-800 cursor-pointer border-0 disabled:opacity-50">
                    {quotaSubmitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                  <button onClick={() => setShowQuotaForm(false)} className="px-4 py-2 text-xs font-bold text-gray-500 bg-transparent border-0 cursor-pointer">Cancel</button>
                </div>
              </div>
            )}

            {/* My Request History */}
            {myQuotaRequests.length > 0 && (
              <div className="text-xs space-y-1">
                <div className="font-bold text-gray-500 uppercase tracking-wider">Your Requests</div>
                {myQuotaRequests.slice(0, 5).map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded">
                    <span>{req.amount} articles — <span className={req.status === 'approved' ? 'text-green-600 font-bold' : req.status === 'rejected' ? 'text-red-600 font-bold' : 'text-amber-600 font-bold'}>{req.status.toUpperCase()}</span></span>
                    <span className="text-gray-400">{new Date(req.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
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
                              pending_review: 'bg-amber-100 text-amber-800',
                              rejected: 'bg-red-100 text-red-700',
                            };
                            return (
                              <span className={`px-2 py-1 rounded text-xs font-bold ${badge[s] || badge.draft}`}>
                                {s === 'scheduled' ? `⏰ ${article.scheduled_at ? new Date(article.scheduled_at).toLocaleDateString() : 'SCHEDULED'}` : s === 'pending_review' ? '🔍 PENDING REVIEW' : s === 'rejected' ? '❌ REJECTED' : s.toUpperCase()}
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
        ) : activeTab === 'ads' ? (
          /* Ad Management Tab — dev only */
          <AdManagementTab />
        ) : activeTab === 'daily' ? (
          /* Daily Generator Tab — dev only */
          <DailyGeneratorTab />
        ) : activeTab === 'sfkeys' ? (
          /* StockFinder API Keys Management */
          <StockFinderKeysTab />
        ) : activeTab === 'inbox' ? (
          /* ══════ INBOX TAB ══════ */
          <div className="space-y-8">
            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Pending Writers', value: pendingWriters.length, icon: <Clock size={18} />, color: 'amber' },
                { label: 'Pending Articles', value: pendingArticles.length, icon: <Inbox size={18} />, color: 'blue' },
                { label: 'Active Writers', value: profiles.filter((p: any) => p.role === 'poster').length, icon: <UserCheck size={18} />, color: 'green' },
                { label: 'Total Published', value: articles.filter((a: any) => a.status === 'published').length, icon: <CheckCircle size={18} />, color: 'emerald' },
              ].map((stat, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">{stat.icon}<span className="text-xs font-bold uppercase tracking-wider">{stat.label}</span></div>
                  <div className="text-2xl font-black text-gray-900">{stat.value}</div>
                </div>
              ))}
            </div>

            {inboxLoading ? (
              <div className="text-center py-12 text-gray-400"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-400 mx-auto mb-2" />Loading...</div>
            ) : (
              <>
                {/* ── Writer Applications ── */}
                <div>
                  <h3 className="text-lg font-black mb-3 flex items-center gap-2">
                    <UserCheck size={20} /> Writer Applications
                    {pendingWriters.length > 0 && <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{pendingWriters.length}</span>}
                  </h3>
                  {pendingWriters.length === 0 ? (
                    <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 text-sm">No pending writer applications</div>
                  ) : (
                    <div className="space-y-3">
                      {pendingWriters.map((w: any) => (
                        <div key={w.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
                          <img src={w.profile_photo || `https://api.dicebear.com/7.x/notionists/svg?seed=${w.email}`} alt="" className="w-12 h-12 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900">{w.full_name || w.email?.split('@')[0]}</div>
                            {w.pen_name && <div className="text-xs text-gray-500">Pen name: {w.pen_name}</div>}
                            <div className="text-xs text-gray-400 mt-1">{w.email} · {w.phone_number} · {w.city}</div>
                            {w.bio && <div className="text-sm text-gray-600 mt-2 line-clamp-2">{w.bio}</div>}
                            <div className="text-[10px] text-gray-400 mt-1">Applied {w.applied_at ? new Date(w.applied_at).toLocaleDateString() : '—'}</div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => approveWriter(w.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors cursor-pointer border-0">
                              <CheckCircle size={14} /> Approve
                            </button>
                            <button onClick={() => { setRejectModal({ type: 'writer', id: w.id }); setRejectReason(''); }} className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors cursor-pointer border-0">
                              <XCircle size={14} /> Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── Pending Articles ── */}
                <div>
                  <h3 className="text-lg font-black mb-3 flex items-center gap-2">
                    <Inbox size={20} /> Articles Pending Review
                    {pendingArticles.length > 0 && <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">{pendingArticles.length}</span>}
                  </h3>
                  {pendingArticles.length === 0 ? (
                    <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 text-sm">No articles pending review</div>
                  ) : (
                    <div className="space-y-3">
                      {pendingArticles.map((a: any) => (
                        <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
                          {a.imageUrl && <img src={a.imageUrl} alt="" className="w-16 h-12 rounded object-cover flex-shrink-0 border border-gray-200" />}
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-900">{a.title}</div>
                            <div className="text-xs text-gray-500">by {a.author} · {a.category}</div>
                            {a.excerpt && <div className="text-sm text-gray-600 mt-1 line-clamp-2">{a.excerpt}</div>}
                            <div className="text-[10px] text-gray-400 mt-1">Submitted {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '—'}</div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => openModal(a)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors cursor-pointer border-0">
                              <Eye size={14} /> Preview
                            </button>
                            <button onClick={() => approveArticle(a.id)} className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors cursor-pointer border-0">
                              <CheckCircle size={14} /> Publish
                            </button>
                            <button onClick={() => { setRejectModal({ type: 'article', id: a.id }); setRejectReason(''); }} className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors cursor-pointer border-0">
                              <XCircle size={14} /> Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Reject Reason Modal */}
            {rejectModal && (
              <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center" onClick={() => setRejectModal(null)}>
                <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                  <h3 className="font-black text-lg mb-4">Rejection Reason</h3>
                  <textarea
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none mb-4"
                    placeholder="Explain why this is being rejected (optional)..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                  />
                  <div className="flex gap-3 justify-end">
                    <button onClick={() => setRejectModal(null)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 cursor-pointer bg-transparent border-0">Cancel</button>
                    <button
                      onClick={() => {
                        if (rejectModal.type === 'writer') rejectWriter(rejectModal.id, rejectReason);
                        else if ((rejectModal.type as any) === 'quota') rejectQuotaRequest(rejectModal.id, rejectReason);
                        else rejectArticle(rejectModal.id, rejectReason);
                      }}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 cursor-pointer border-0"
                    >
                      Confirm Reject
                    </button>
                  </div>
                </div>
              </div>
            )}

                {/* ── Quota Requests ── */}
                <div>
                  <h3 className="text-lg font-black mb-3 flex items-center gap-2">
                    <CreditCard size={20} /> Quota Requests
                    {quotaRequests.length > 0 && <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2 py-0.5 rounded-full">{quotaRequests.length}</span>}
                  </h3>
                  {quotaRequests.length === 0 ? (
                    <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 text-sm">No pending quota requests</div>
                  ) : (
                    <div className="space-y-3">
                      {quotaRequests.map((req: any) => {
                        const p = req.profiles;
                        return (
                          <div key={req.id} className="bg-white border border-gray-200 rounded-xl p-4">
                            <div className="flex items-start gap-4">
                              <img src={p?.profile_photo || `https://api.dicebear.com/7.x/notionists/svg?seed=${p?.email}`} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-gray-900">{p?.full_name || p?.email?.split('@')[0]}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded font-bold text-gray-500">{p?.role}</span>
                                  <span className="text-[10px] text-gray-400">Quota: {p?.quota ?? 0}</span>
                                </div>
                                <div className="text-xs text-gray-400">{p?.email} · {p?.phone_number || '—'} · {p?.city || '—'}</div>
                                <div className="flex items-center gap-4 mt-2">
                                  <span className="text-sm font-bold text-purple-700">+{req.amount} articles requested</span>
                                  {req.message && <span className="text-xs text-gray-500 italic">"{req.message}"</span>}
                                </div>
                                {req.proof_url && (
                                  <a href={req.proof_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-2">
                                    <img src={req.proof_url} alt="Transfer proof" className="w-32 h-24 rounded object-cover border border-gray-200 hover:opacity-80 transition-opacity" />
                                  </a>
                                )}
                                <div className="text-[10px] text-gray-400 mt-1">Requested {new Date(req.created_at).toLocaleDateString()}</div>
                              </div>
                              <div className="flex flex-col gap-2 flex-shrink-0">
                                <button onClick={() => investigateUserData(req.user_id)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors cursor-pointer border-0">
                                  <Search size={14} /> Investigate
                                </button>
                                <button onClick={() => approveQuotaRequest(req.id, req.user_id, req.amount)} className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-200 transition-colors cursor-pointer border-0">
                                  <CheckCircle size={14} /> Approve
                                </button>
                                <button onClick={() => { setRejectModal({ type: 'quota' as any, id: req.id }); setRejectReason(''); }} className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-200 transition-colors cursor-pointer border-0">
                                  <XCircle size={14} /> Reject
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

            {/* User Investigation Modal */}
            {investigateUser && (
              <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center" onClick={() => setInvestigateUser(null)}>
                <div className="bg-white rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-black text-lg flex items-center gap-2"><Search size={20} /> User Investigation</h3>
                    <button onClick={() => setInvestigateUser(null)} className="p-1 rounded hover:bg-gray-100 cursor-pointer bg-transparent border-0"><X size={18} /></button>
                  </div>

                  {/* User Profile Card */}
                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-4">
                      <img src={investigateUser.profile_photo || `https://api.dicebear.com/7.x/notionists/svg?seed=${investigateUser.email}`} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-gray-200" />
                      <div className="flex-1">
                        <div className="text-lg font-black">{investigateUser.full_name || investigateUser.email?.split('@')[0]}</div>
                        {investigateUser.pen_name && <div className="text-sm text-gray-500">Pen: {investigateUser.pen_name}</div>}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><Mail size={12} /> {investigateUser.email}</span>
                          {investigateUser.phone_number && <span className="flex items-center gap-1"><Phone size={12} /> {investigateUser.phone_number}</span>}
                          {investigateUser.city && <span className="flex items-center gap-1"><MapPin size={12} /> {investigateUser.city}</span>}
                        </div>
                        {investigateUser.bio && <div className="text-sm text-gray-600 mt-2">{investigateUser.bio}</div>}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mt-4">
                      {[
                        { label: 'Role', value: investigateUser.role?.toUpperCase() },
                        { label: 'Quota', value: investigateUser.quota ?? 0 },
                        { label: 'Writer Status', value: investigateUser.writer_status || 'none' },
                        { label: 'Joined', value: investigateUser.createdAt ? new Date(investigateUser.createdAt).toLocaleDateString() : '—' },
                      ].map((s, i) => (
                        <div key={i} className="bg-white rounded-lg p-2 text-center border border-gray-200">
                          <div className="text-[10px] font-bold text-gray-400 uppercase">{s.label}</div>
                          <div className="text-sm font-black">{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* User's Articles */}
                  <div>
                    <h4 className="font-bold text-sm mb-2">Articles ({investigateArticles.length})</h4>
                    {investigateArticles.length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-4">No articles found</div>
                    ) : (
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {investigateArticles.map((a: any) => (
                          <div key={a.id} className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded text-sm">
                            <div className="flex-1 min-w-0">
                              <div className="font-bold truncate">{a.title}</div>
                              <div className="text-[10px] text-gray-400">{a.category} · {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''}</div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${a.status === 'published' ? 'bg-green-100 text-green-700' : a.status === 'pending_review' ? 'bg-amber-100 text-amber-700' : a.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{a.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'analytics' ? (
          /* ══════ ANALYTICS TAB ══════ */
          <AnalyticsTab />
        ) : null}
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
                  {/* Subtitle — right below title */}
                  <input
                    type="text"
                    placeholder="Add a subtitle…"
                    value={editingArticle.subtitle || ''}
                    onChange={e => setEditingArticle({ ...editingArticle, subtitle: e.target.value })}
                    style={{
                      width: '100%', border: 'none', outline: 'none', fontSize: 16, fontWeight: 400,
                      color: '#6b7280', background: 'transparent', lineHeight: 1.4, marginBottom: 12,
                      fontStyle: 'italic', fontFamily: 'Georgia, serif',
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

                  {/* Formatting toolbar */}
                  <div className="flex items-center gap-1 mb-3 pb-3 border-b flex-wrap" style={{ borderColor: '#e5e7eb' }}>
                    {[
                      { label: 'H2', md: '\n## ', tip: 'Heading 2' },
                      { label: 'H3', md: '\n### ', tip: 'Heading 3' },
                      { label: 'B', md: '**', tip: 'Bold', wrap: true, style: { fontWeight: 700 } },
                      { label: 'I', md: '*', tip: 'Italic', wrap: true, style: { fontStyle: 'italic' } },
                      { label: '❝', md: '\n> ', tip: 'Blockquote' },
                      { label: '—', md: '\n---\n', tip: 'Divider' },
                      { label: '🔗', md: '[link text](url)', tip: 'Link' },
                      { label: '• List', md: '\n- ', tip: 'Bullet list' },
                      { label: '1. List', md: '\n1. ', tip: 'Numbered list' },
                    ].map(btn => (
                      <button
                        key={btn.label}
                        type="button"
                        title={btn.tip}
                        onClick={() => {
                          const current = editingArticle.contentStr || '';
                          if (btn.wrap) {
                            setEditingArticle({ ...editingArticle, contentStr: current + btn.md + 'text' + btn.md });
                          } else {
                            setEditingArticle({ ...editingArticle, contentStr: current + btn.md });
                          }
                        }}
                        className="px-2 py-1 rounded text-xs font-medium hover:bg-gray-100 transition-colors"
                        style={{ border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer', minWidth: 28, ...(btn.style || {}) }}
                      >
                        {btn.label}
                      </button>
                    ))}
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
                        <button type="button" onClick={() => openEditor(editingArticle.imageUrl, 'cover')} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
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
                              onClick={(e) => { e.stopPropagation(); openEditor(img.url, 'gallery', i); }}
                              className="rounded-full p-1 shadow-md transition-colors"
                              style={{ background: '#fff', border: 'none', cursor: 'pointer', color: '#3b82f6' }}
                              title="Edit image"
                            >
                              <Edit2 size={14} />
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
                  {role === 'poster' ? (
                    <div>
                      <div style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, background: '#f3f4f6', color: '#6b7280' }}>
                        {editingArticle.author}
                      </div>
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Author name is set from your profile. Update it in your <a href="/profile" style={{ color: '#1D9E75', textDecoration: 'underline' }}>Profile</a>.</div>
                    </div>
                  ) : (
                    <input required type="text" value={editingArticle.author} onChange={e => setEditingArticle({ ...editingArticle, author: e.target.value })} style={{ width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, outline: 'none', background: '#fff', color: '#374151' }} />
                  )}
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
              </div>
            </div>
          </form>
        </div>
        );
      })()}

      {/* Image Editor Modal */}
      {editorOpen && editorImageUrl && (
        <ImageEditorModal
          imageUrl={editorImageUrl}
          onSave={handleEditorSave}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// StockFinder API Keys Management Tab
// ---------------------------------------------------------------------------
function StockFinderKeysTab() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newLimit, setNewLimit] = useState(20);
  const [generatedKey, setGeneratedKey] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/stockfinder/admin/keys');
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err) {
      console.error('Failed to fetch keys:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeys(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/stockfinder/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newLabel, dailyLimit: newLimit }),
      });
      const data = await res.json();
      if (data.key) {
        setGeneratedKey(data.key);
        setNewLabel('');
        setNewLimit(20);
        fetchKeys();
      }
    } catch (err) {
      console.error('Failed to create key:', err);
    } finally {
      setCreating(false);
    }
  };

  const toggleKey = async (id: string, currentActive: boolean) => {
    try {
      await fetch(`/api/stockfinder/admin/keys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      fetchKeys();
    } catch (err) {
      console.error('Failed to toggle key:', err);
    }
  };

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? Users will lose access immediately.')) return;
    try {
      await fetch(`/api/stockfinder/admin/keys/${id}`, { method: 'DELETE' });
      fetchKeys();
    } catch (err) {
      console.error('Failed to revoke key:', err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">🔑 StockFinder API Keys</h2>
      </div>

      {/* Generate New Key Form */}
      <div className="mb-6 p-4 border rounded-lg bg-gray-50">
        <h3 className="font-bold text-sm mb-3">Generate New API Key</h3>
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">Label / Description</label>
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder="e.g., John Doe - Content Writer"
              className="w-full border rounded p-2 text-sm"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs text-gray-500 mb-1">Daily Limit</label>
            <input
              type="number"
              value={newLimit}
              onChange={e => setNewLimit(parseInt(e.target.value) || 20)}
              min={1}
              max={1000}
              className="w-full border rounded p-2 text-sm"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-black text-white text-sm rounded font-bold hover:bg-gray-800 disabled:opacity-50"
          >
            {creating ? 'Creating...' : '+ Generate Key'}
          </button>
        </div>
      </div>

      {/* Show Generated Key (one-time display) */}
      {generatedKey && (
        <div className="mb-6 p-4 border-2 border-green-400 rounded-lg bg-green-50">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-green-800 text-sm">✅ New API Key Generated</span>
            <button onClick={() => setGeneratedKey('')} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-green-700 mb-2">
            ⚠️ Copy this key now — it will NOT be shown again!
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-green-300 rounded p-2 text-sm font-mono break-all select-all">
              {generatedKey}
            </code>
            <button
              onClick={() => copyToClipboard(generatedKey)}
              className="px-3 py-2 bg-green-600 text-white text-xs rounded font-bold hover:bg-green-700"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Keys Table */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading keys...</div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No API keys yet. Generate one above.</div>
      ) : (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-3 text-left text-xs font-bold text-gray-500">Key Prefix</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">Label</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">Status</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">Daily Limit</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">Total Uses</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">Last Used</th>
                <th className="p-3 text-left text-xs font-bold text-gray-500">Created</th>
                <th className="p-3 text-right text-xs font-bold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k: any) => (
                <tr key={k.id} className={`border-t ${!k.is_active ? 'opacity-50 bg-gray-50' : ''}`}>
                  <td className="p-3 font-mono text-xs">{k.key_prefix}</td>
                  <td className="p-3 text-xs">{k.label || '—'}</td>
                  <td className="p-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${k.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {k.is_active ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td className="p-3 text-xs">{k.daily_limit}/day</td>
                  <td className="p-3 text-xs font-bold">{k.total_uses || 0}</td>
                  <td className="p-3 text-xs text-gray-500">
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="p-3 text-xs text-gray-500">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleKey(k.id, k.is_active)}
                        className={`px-2 py-1 text-xs rounded ${k.is_active ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        title={k.is_active ? 'Disable key' : 'Re-enable key'}
                      >
                        {k.is_active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => revokeKey(k.id)}
                        className="px-2 py-1 text-xs rounded bg-red-100 text-red-600 hover:bg-red-200"
                        title="Permanently revoke"
                      >
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
        <strong>💡 Tip:</strong> Share the generated API key with users who need access to StockFinder AI at <code>/tools/stockfinder</code>. 
        Keys are hashed and stored securely — the full key is only shown once during creation.
      </div>
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

// ═══════════════════════════════════════════════════════════════
// ANALYTICS TAB COMPONENT
// ═══════════════════════════════════════════════════════════════
function AnalyticsTab() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [allArticles, setAllArticles] = useState<any[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [txForm, setTxForm] = useState({
    type: 'income' as 'income' | 'expense',
    category: 'misc_income',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);

  const CATEGORIES = {
    income: [
      { value: 'quota_purchase', label: 'Quota Purchase' },
      { value: 'ad_revenue', label: 'Ad Revenue' },
      { value: 'sponsorship', label: 'Sponsorship' },
      { value: 'misc_income', label: 'Other Income' },
    ],
    expense: [
      { value: 'salary', label: 'Salary' },
      { value: 'hosting', label: 'Hosting' },
      { value: 'operational', label: 'Operational' },
      { value: 'misc_expense', label: 'Other Expense' },
    ],
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [txRes, artRes, profRes] = await Promise.all([
        supabase.from('financial_transactions').select('*').order('transaction_date', { ascending: false }).limit(500),
        supabase.from('articles').select('id, status, author, author_id, createdAt, category'),
        supabase.from('profiles').select('id, email, full_name, role, quota, createdAt'),
      ]);
      setTransactions(txRes.data || []);
      setAllArticles(artRes.data || []);
      setAllProfiles(profRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const addTransaction = async () => {
    if (!txForm.amount || parseFloat(txForm.amount) <= 0) { alert('Enter a valid amount'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('financial_transactions').insert({
        type: txForm.type, category: txForm.category, amount: parseFloat(txForm.amount),
        description: txForm.description || null, recorded_by: user?.id,
        transaction_date: txForm.transaction_date,
      });
      if (error) throw error;
      setShowAddForm(false);
      setTxForm({ type: 'income', category: 'misc_income', amount: '', description: '', transaction_date: new Date().toISOString().split('T')[0] });
      fetchAll();
    } catch (e: any) { alert('Failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = (() => { const d = new Date(now); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();

  const txThisMonth = transactions.filter(t => t.transaction_date?.startsWith(thisMonth));
  const revenueThisMonth = txThisMonth.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expenseThisMonth = txThisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const totalRevenue = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now); d.setMonth(d.getMonth() - (5 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthTx = transactions.filter(t => t.transaction_date?.startsWith(key));
    const income = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    return { key, label: d.toLocaleDateString('id-ID', { month: 'short' }), income, expense };
  });
  const chartMax = Math.max(...monthlyData.map(m => Math.max(m.income, m.expense)), 1);

  const publishedCount = allArticles.filter(a => a.status === 'published').length;
  const pendingCount = allArticles.filter(a => a.status === 'pending_review').length;
  const draftCount = allArticles.filter(a => a.status === 'draft').length;
  const rejectedCount = allArticles.filter(a => a.status === 'rejected').length;
  const articlesThisMonth = allArticles.filter(a => a.createdAt?.startsWith(thisMonth)).length;
  const articlesLastMonth = allArticles.filter(a => a.createdAt?.startsWith(lastMonth)).length;
  const articleGrowth = articlesLastMonth > 0 ? Math.round(((articlesThisMonth - articlesLastMonth) / articlesLastMonth) * 100) : 0;

  const writerStats = allProfiles.filter(p => p.role === 'poster').map(p => ({
    ...p,
    articleCount: allArticles.filter(a => a.author_id === p.id).length,
    publishedCount: allArticles.filter(a => a.author_id === p.id && a.status === 'published').length,
  })).sort((a, b) => b.articleCount - a.articleCount).slice(0, 5);

  const filteredTx = transactions.filter(t => {
    if (filterMonth && !t.transaction_date?.startsWith(filterMonth)) return false;
    if (filterType !== 'all' && t.type !== filterType) return false;
    return true;
  });

  const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);

  if (loading) return <div className="text-center py-12 text-gray-400"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-400 mx-auto mb-2" />Loading analytics...</div>;

  return (
    <div className="space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Revenue (This Month)', value: fmt(revenueThisMonth), icon: <ArrowUpRight size={18} />, bg: 'from-green-500 to-emerald-600' },
          { label: 'Expenses (This Month)', value: fmt(expenseThisMonth), icon: <ArrowDownRight size={18} />, bg: 'from-red-500 to-rose-600' },
          { label: 'Net Profit (This Month)', value: fmt(revenueThisMonth - expenseThisMonth), icon: <TrendingUp size={18} />, bg: revenueThisMonth - expenseThisMonth >= 0 ? 'from-blue-500 to-indigo-600' : 'from-orange-500 to-red-600' },
          { label: 'All-Time Revenue', value: fmt(totalRevenue), icon: <DollarSign size={18} />, bg: 'from-purple-500 to-violet-600' },
        ].map((card, i) => (
          <div key={i} className={`bg-gradient-to-br ${card.bg} rounded-xl p-4 text-white shadow-lg`}>
            <div className="flex items-center gap-2 opacity-80 mb-1">{card.icon}<span className="text-xs font-bold uppercase tracking-wider">{card.label}</span></div>
            <div className="text-xl font-black">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Monthly Revenue Chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-black text-sm mb-4 flex items-center gap-2"><BarChart3 size={18} /> Monthly Revenue vs Expenses (6 Months)</h3>
        <div className="flex items-end gap-3" style={{ height: 180 }}>
          {monthlyData.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-1 items-end" style={{ height: 140 }}>
                <div className="flex-1 bg-green-400 rounded-t transition-all" style={{ height: `${(m.income / chartMax) * 100}%`, minHeight: m.income > 0 ? 4 : 0 }} title={`Income: ${fmt(m.income)}`} />
                <div className="flex-1 bg-red-400 rounded-t transition-all" style={{ height: `${(m.expense / chartMax) * 100}%`, minHeight: m.expense > 0 ? 4 : 0 }} title={`Expense: ${fmt(m.expense)}`} />
              </div>
              <div className="text-[10px] font-bold text-gray-500 uppercase">{m.label}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-green-400 rounded inline-block" /> Income</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 bg-red-400 rounded inline-block" /> Expense</span>
        </div>
      </div>

      {/* Content & Writer Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-black text-sm mb-3">📰 Content Metrics</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Published', value: publishedCount, color: 'text-green-600' },
              { label: 'Pending Review', value: pendingCount, color: 'text-amber-600' },
              { label: 'Draft', value: draftCount, color: 'text-gray-500' },
              { label: 'Rejected', value: rejectedCount, color: 'text-red-600' },
            ].map((s, i) => (
              <div key={i} className="bg-gray-50 rounded-lg p-3">
                <div className="text-[10px] font-bold text-gray-400 uppercase">{s.label}</div>
                <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-gray-400 uppercase">Articles This Month</div>
              <div className="text-lg font-black">{articlesThisMonth}</div>
            </div>
            <div className={`text-sm font-bold ${articleGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {articleGrowth >= 0 ? '↑' : '↓'} {Math.abs(articleGrowth)}% vs last month
            </div>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-black text-sm mb-3">✍️ Top Writers</h3>
          {writerStats.length === 0 ? (
            <div className="text-sm text-gray-400 text-center py-8">No active writers</div>
          ) : (
            <div className="space-y-2">
              {writerStats.map((w, i) => (
                <div key={w.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center text-xs font-black flex-shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{w.full_name || w.email?.split('@')[0]}</div>
                    <div className="text-[10px] text-gray-400">{w.email}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-black">{w.articleCount}</div>
                    <div className="text-[10px] text-gray-400">{w.publishedCount} published</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="text-[10px] font-bold text-gray-400 uppercase">Active Writers</div>
            <div className="text-lg font-black">{allProfiles.filter(p => p.role === 'poster').length}</div>
          </div>
        </div>
      </div>

      {/* Transaction Log */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-sm flex items-center gap-2"><CreditCard size={18} /> Transaction Log</h3>
          <div className="flex items-center gap-2">
            <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-xs" />
            <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className="border border-gray-300 rounded px-2 py-1 text-xs">
              <option value="all">All</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <button onClick={() => setShowAddForm(!showAddForm)} className="flex items-center gap-1 px-3 py-1.5 bg-black text-white text-xs font-bold rounded-lg hover:bg-gray-800 cursor-pointer border-0">
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {showAddForm && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3 border border-gray-200">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Type</label>
                <select value={txForm.type} onChange={e => { const t = e.target.value as 'income' | 'expense'; setTxForm(prev => ({ ...prev, type: t, category: t === 'income' ? 'misc_income' : 'misc_expense' })); }} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Category</label>
                <select value={txForm.category} onChange={e => setTxForm(prev => ({ ...prev, category: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm">
                  {CATEGORIES[txForm.type].map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Amount (IDR)</label>
                <input type="number" value={txForm.amount} onChange={e => setTxForm(prev => ({ ...prev, amount: e.target.value }))} placeholder="50000" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date</label>
                <input type="date" value={txForm.transaction_date} onChange={e => setTxForm(prev => ({ ...prev, transaction_date: e.target.value }))} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Description</label>
              <input type="text" value={txForm.description} onChange={e => setTxForm(prev => ({ ...prev, description: e.target.value }))} placeholder="e.g., Ad placement from Company X" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={addTransaction} disabled={saving} className="px-4 py-1.5 bg-black text-white text-xs font-bold rounded hover:bg-gray-800 cursor-pointer border-0 disabled:opacity-50">{saving ? 'Saving...' : 'Save Transaction'}</button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-1.5 text-xs font-bold text-gray-500 bg-transparent border-0 cursor-pointer">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex gap-4 mb-3 text-xs">
          <span className="font-bold text-green-600">Income: {fmt(filteredTx.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0))}</span>
          <span className="font-bold text-red-600">Expense: {fmt(filteredTx.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0))}</span>
          <span className="font-bold text-gray-600">{filteredTx.length} transactions</span>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="border-b">
                <th className="p-2 text-[10px] font-bold text-gray-500 uppercase">Date</th>
                <th className="p-2 text-[10px] font-bold text-gray-500 uppercase">Type</th>
                <th className="p-2 text-[10px] font-bold text-gray-500 uppercase">Category</th>
                <th className="p-2 text-[10px] font-bold text-gray-500 uppercase">Amount</th>
                <th className="p-2 text-[10px] font-bold text-gray-500 uppercase">Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400 text-sm">No transactions found</td></tr>
              ) : (
                filteredTx.map(tx => (
                  <tr key={tx.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-gray-600">{tx.transaction_date}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tx.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {tx.type === 'income' ? '↑' : '↓'} {tx.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-2 text-gray-600">{tx.category?.replace(/_/g, ' ')}</td>
                    <td className={`p-2 font-bold ${tx.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                    </td>
                    <td className="p-2 text-gray-500 text-xs">{tx.description || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* All-Time Overview */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-black text-sm mb-3">💰 All-Time Financial Overview</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <div className="text-[10px] font-bold text-green-600 uppercase">Total Income</div>
            <div className="text-xl font-black text-green-700">{fmt(totalRevenue)}</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 text-center">
            <div className="text-[10px] font-bold text-red-600 uppercase">Total Expenses</div>
            <div className="text-xl font-black text-red-700">{fmt(totalExpense)}</div>
          </div>
          <div className={`${totalRevenue - totalExpense >= 0 ? 'bg-blue-50' : 'bg-orange-50'} rounded-lg p-4 text-center`}>
            <div className={`text-[10px] font-bold ${totalRevenue - totalExpense >= 0 ? 'text-blue-600' : 'text-orange-600'} uppercase`}>Net Profit/Loss</div>
            <div className={`text-xl font-black ${totalRevenue - totalExpense >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt(totalRevenue - totalExpense)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
