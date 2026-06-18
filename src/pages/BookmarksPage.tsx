/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Bookmark, ArrowLeft, Trash2 } from 'lucide-react';
import { useArticles } from '../App';
import { useAuth, supabase } from '../lib/auth';

const BookmarksPage = () => {
  const { articles, loading: articlesLoading } = useArticles();
  const { user } = useAuth();
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookmarks = useCallback(async () => {
    if (!user) { setBookmarkedIds([]); setLoading(false); return; }
    try {
      const { data } = await supabase
        .from('bookmarks')
        .select('article_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setBookmarkedIds((data || []).map((b: any) => b.article_id));
    } catch { /* silent */ }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchBookmarks(); }, [fetchBookmarks]);

  const removeBookmark = async (articleId: string) => {
    if (!user) return;
    setBookmarkedIds(prev => prev.filter(id => id !== articleId));
    await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('article_id', articleId);
  };

  const savedArticles = bookmarkedIds
    .map(id => articles.find(a => a.id === id))
    .filter(Boolean);

  if (!user) {
    return (
      <main className="flex-1 max-w-3xl mx-auto px-4 py-16 w-full text-center">
        <Bookmark size={48} className="mx-auto mb-4 text-gray-300" />
        <h1 className="text-2xl font-bold mb-2">Saved Articles</h1>
        <p className="text-ink-light mb-6">Sign in to save and access your bookmarked articles.</p>
        <Link to="/login" className="inline-block bg-ink text-paper px-6 py-2 text-sm font-bold uppercase tracking-wider hover:bg-ink-light transition-colors">
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-12 w-full">
      <Helmet>
        <title>Saved Articles | Lensa Insignia</title>
        <meta name="description" content="Your saved articles on Lensa Insignia." />
      </Helmet>

      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-light hover:text-accent transition-colors mb-8">
        <ArrowLeft size={14} /> Back to Home
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <Bookmark size={24} className="text-accent" />
        <h1 className="text-2xl sm:text-3xl font-bold">Saved Articles</h1>
        <span className="text-sm text-ink-light">({savedArticles.length})</span>
      </div>

      {loading || articlesLoading ? (
        <div className="space-y-6">
          {[1,2,3].map(i => (
            <div key={i} className="animate-pulse flex gap-4">
              <div className="w-32 h-24 bg-gray-200 rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : savedArticles.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Bookmark size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-lg text-ink-light mb-1">No saved articles yet</p>
          <p className="text-sm text-gray-400">Click the bookmark icon on any article to save it here.</p>
        </div>
      ) : (
        <div className="space-y-0 divide-y divide-border">
          {savedArticles.map((article: any) => (
            <div key={article.id} className="flex gap-4 sm:gap-6 py-5 group">
              <Link to={`/article/${article.slug || article.id}`} className="flex-shrink-0">
                {article.imageUrl ? (
                  <img
                    src={article.imageUrl}
                    alt={article.title}
                    className="w-24 h-20 sm:w-36 sm:h-24 object-cover rounded-sm bg-gray-100"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-24 h-20 sm:w-36 sm:h-24 bg-gray-100 rounded-sm flex items-center justify-center">
                    <Bookmark size={20} className="text-gray-300" />
                  </div>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-accent uppercase tracking-wider mb-1">
                  {article.category}
                </div>
                <Link
                  to={`/article/${article.slug || article.id}`}
                  className="text-base sm:text-lg font-bold font-serif hover:text-accent transition-colors line-clamp-2 block"
                >
                  {article.title}
                </Link>
                <p className="text-xs sm:text-sm text-ink-light line-clamp-1 mt-1">{article.excerpt}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">{article.author} · {article.date}</span>
                  <button
                    onClick={() => removeBookmark(article.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
                    title="Remove bookmark"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default BookmarksPage;
