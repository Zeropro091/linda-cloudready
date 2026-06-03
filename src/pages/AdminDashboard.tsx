import React, { useState, useEffect, useRef } from 'react';
import { supabase, handleSupabaseError, OperationType } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { useArticles } from '../App';
import { LogOut, Plus, Edit2, Trash2, Archive, CheckCircle, Database, X, UploadCloud } from 'lucide-react';
import MDEditor from '@uiw/react-md-editor';

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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<any[]>([]);
  const { refetch: refetchGlobalArticles } = useArticles();

  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
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
    // Auth bypass: mock login for POC/testing
    setUser({ email: 'admin@lensainsignia.com', displayName: 'Lensa Editor' } as any);
    setLoading(false);
    fetchArticles();
    fetchGallery();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser({
          email: session.user.email,
          displayName: session.user.user_metadata?.full_name || session.user.email?.split('@')[0]
        } as any);
      } else {
        if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchArticles = async () => {
    try {
      setAuthError(null);
      const { data, error } = await supabase
        .from('articles')
        .select('*');
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
    }
  };

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Auth error:", error);
      setAuthError(error.message || "Failed to authenticate.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
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
      setEditingArticle({
        title: "",
        subtitle: "",
        excerpt: "",
        author: user?.displayName || user?.email?.split('@')[0] || "Admin",
        role: "Editor",
        date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        time: "Just now",
        category: "World",
        imageUrl: "",
        contentStr: "", // Assuming single field for inputting text
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
      const articleData = { ...editingArticle };
      
      // Parse content string into array for simplistic rendering
      if (articleData.contentStr) {
        articleData.contentArr = articleData.contentStr.split('\n').filter((p: string) => p.trim() !== "");
      }

      if (articleData.id) {
        const id = articleData.id;
        delete articleData.id; // Don't save id in document
        articleData.updatedAt = new Date().toISOString();
        const { error } = await supabase
          .from('articles')
          .update(articleData)
          .eq('id', id);
        if (error) throw error;
      } else {
        articleData.createdAt = new Date().toISOString();
        articleData.date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        articleData.time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const { error } = await supabase
          .from('articles')
          .insert(articleData);
        if (error) throw error;
      }
      closeModal();
      fetchArticles();
      refetchGlobalArticles();
    } catch (e) {
      console.error(e);
      alert("Failed to save article");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded shadow-lg max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold mb-6">Admin Login</h1>
          {authError && (
             <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 text-sm rounded text-left">
               {authError}
             </div>
          )}
          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className={`w-full text-white font-bold py-3 rounded transition ${isLoggingIn ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isLoggingIn ? 'Opening popup...' : 'Sign In with Google'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto bg-white p-8 rounded shadow">
        <div className="flex justify-between items-center mb-8 pb-4 border-b">
          <h1 className="text-3xl font-black">Lensa Insignia - Admin</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-semibold">{user.email}</span>
            <button onClick={handleLogout} className="flex items-center space-x-1 text-red-600 hover:text-red-800">
              <LogOut size={16} /> <span>Logout</span>
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Articles Management</h2>
          <div className="flex space-x-2">
            <button 
              onClick={seedDatabase}
              className="flex items-center space-x-2 bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">
              <Database size={16} />
              <span>Seed Mock Articles</span>
            </button>
            <button 
              onClick={() => openModal()}
              className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded text-sm hover:bg-gray-800">
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
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    No articles found in Firestore. You can seed the database later.
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
                    <td className="p-3 flex justify-end space-x-2">
                       <button onClick={() => openModal(article)} className="p-1.5 bg-blue-100 text-blue-600 rounded hover:bg-blue-200" title="Edit"><Edit2 size={16} /></button>
                       <button onClick={() => handleArchiveState(article.id, article.status)} className={`p-1.5 rounded ${article.status === 'archived' ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'}`} title={article.status === 'archived' ? 'Publish' : 'Archive'}>
                         {article.status === 'archived' ? <CheckCircle size={16} /> : <Archive size={16} />}
                       </button>
                       <button onClick={() => handleDelete(article.id)} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200" title="Delete"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                {editingArticle.imageUrl && (
                  <div className="mt-2 text-sm text-green-600 flex items-center space-x-1">
                    <CheckCircle size={14} /> <span className="truncate max-w-sm" title={editingArticle.imageUrl}>Image Set</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Excerpt</label>
                <textarea className="w-full border p-2 rounded" rows={2} value={editingArticle.excerpt || ''} onChange={e => setEditingArticle({...editingArticle, excerpt: e.target.value})}></textarea>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold mb-2">Media Gallery (for use in content)</label>
                <div 
                  className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors flex flex-col items-center ${isDraggingGallery ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDraggingGallery(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDraggingGallery(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDraggingGallery(false);
                    const files = (Array.from(e.dataTransfer.files) as File[]).filter(file => file.type.startsWith('image/'));
                    if (files.length > 0) {
                      handleBatchGalleryUpload(files);
                    }
                  }}
                >
                  <input 
                    type="file" 
                    ref={galleryInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        const files = (Array.from(e.target.files) as File[]).filter(file => file.type.startsWith('image/'));
                        if (files.length > 0) {
                          handleBatchGalleryUpload(files);
                        }
                      }
                    }} 
                  />
                  
                  {galleryImages.length > 0 && (
                    <div className="flex flex-wrap gap-4 mb-4 justify-center w-full">
                      {galleryImages.map((img, i) => (
                        <div 
                          key={i} 
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', `![${img.name}](${img.url})`);
                            e.dataTransfer.setData('application/x-gallery-image', JSON.stringify(img));
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          className="relative group border rounded p-1 w-24 h-24 flex items-center justify-center bg-gray-50 overflow-hidden cursor-grab active:cursor-grabbing"
                        >
                          <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <button 
                              type="button" 
                              className="text-white text-xs font-bold mb-1 hover:text-blue-300"
                              onClick={(e) => {
                                  e.preventDefault(); 
                                  const markdownImg = `\n![${img.name}](${img.url})\n`;
                                  const textarea = document.querySelector('textarea.w-md-editor-text-input') as HTMLTextAreaElement;
                                  
                                  setEditingArticle(prev => {
                                    const currentContent = prev.contentStr || '';
                                    if (textarea) {
                                      const start = textarea.selectionStart;
                                      const end = textarea.selectionEnd;
                                      const newContent = currentContent.substring(0, start) + markdownImg + currentContent.substring(end);
                                      
                                      setTimeout(() => {
                                        textarea.focus();
                                        textarea.setSelectionRange(start + markdownImg.length, start + markdownImg.length);
                                      }, 10);
                                      
                                      return { ...prev, contentStr: newContent };
                                    } else {
                                      return { ...prev, contentStr: currentContent + `\n\n${markdownImg}\n\n` };
                                    }
                                  });
                              }}
                            >
                              Insert
                            </button>
                            <button
                                type="button"
                                className="text-blue-300 text-xs font-semibold hover:text-white mb-1"
                                onClick={(e) => {
                                    e.preventDefault();
                                    setEditingArticle(prev => ({ ...prev, imageUrl: img.url }));
                                }}
                            >
                                Set as Main
                            </button>
                            <button
                                type="button"
                                className="text-gray-300 text-xs hover:text-white"
                                onClick={(e) => {
                                    e.preventDefault();
                                    copyToClipboard(`![${img.name}](${img.url})`);
                                }}
                            >
                                Copy
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-col items-center space-y-1">
                    {isUploadingGallery ? (
                      <div className="text-blue-500 font-semibold flex items-center space-x-2">
                        <UploadCloud className="animate-bounce" size={20} /> <span>Uploading...</span>
                      </div>
                    ) : (
                      <UploadCloud className="text-gray-400" size={28} />
                    )}
                    <p className="text-sm text-gray-600 mt-2">
                      Drag & drop images here, or <button type="button" onClick={() => galleryInputRef.current?.click()} className="text-blue-600 hover:underline">browse</button>.
                    </p>
                    <span className="text-xs text-gray-400">Place your cursor in the content editor below, then hover over an image and click <strong>Insert</strong> to add it, or simply **drag and drop** it directly onto the editor.</span>
                  </div>
                </div>
              </div>

              <div data-color-mode="light">
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-semibold">Content (Markdown format)</label>
                  <label className="cursor-pointer text-sm bg-gray-100 px-2 py-1 rounded border hover:bg-gray-200">
                    <input type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const { parseDocument } = await import('../lib/fileParser');
                          const content = await parseDocument(file);
                          setEditingArticle(prev => ({...prev, contentStr: prev.contentStr ? prev.contentStr + '\n\n' + content : content}));
                        } catch (error) {
                          alert('Error parsing document: ' + (error as Error).message);
                        }
                      }
                      e.target.value = '';
                    }} />
                    <span>Upload Document (.pdf, .docx)</span>
                  </label>
                </div>
                <div className="border rounded overflow-hidden">
                  <MDEditor
                    value={editingArticle.contentStr || (editingArticle.contentArr ? editingArticle.contentArr.join('\n\n') : '')}
                    onChange={(val) => setEditingArticle({...editingArticle, contentStr: val || ''})}
                    height={400}
                    textareaProps={{
                      onDrop: (e) => {
                        handleTextareaDrop(e as unknown as React.DragEvent<HTMLTextAreaElement>);
                      },
                      onDragOver: (e) => {
                        e.preventDefault();
                      }
                    }}
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
