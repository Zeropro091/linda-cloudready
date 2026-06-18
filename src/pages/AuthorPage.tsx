/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FileText, ArrowLeft } from 'lucide-react';
import { useArticles } from '../App';

const AuthorPage = () => {
  const { name } = useParams<{ name: string }>();
  const { articles, loading } = useArticles();

  const decodedName = decodeURIComponent(name || '');

  // Find all published articles by this author
  const authorArticles = useMemo(() => {
    return articles.filter(
      a => a.author?.toLowerCase() === decodedName.toLowerCase() && a.status !== 'archived'
    );
  }, [articles, decodedName]);

  // Get author info from first article
  const authorInfo = authorArticles[0] || null;
  const authorRole = authorInfo?.role || 'Contributor';
  const initials = decodedName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Generate avatar URL using DiceBear
  const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(decodedName)}&backgroundColor=1a1a1a&textColor=ffffff`;

  if (loading) {
    return (
      <main className="flex-1 max-w-4xl mx-auto px-4 py-16 w-full">
        <div className="animate-pulse space-y-4">
          <div className="w-24 h-24 rounded-full bg-gray-200 mx-auto" />
          <div className="h-8 bg-gray-200 rounded w-48 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-12 w-full">
      <Helmet>
        <title>{decodedName} | Lensa Insignia</title>
        <meta name="description" content={`Articles by ${decodedName} on Lensa Insignia.`} />
        <meta property="og:title" content={`${decodedName} | Lensa Insignia`} />
        <meta property="og:description" content={`Read articles by ${decodedName}.`} />
        <meta property="og:type" content="profile" />
      </Helmet>

      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-light hover:text-accent transition-colors mb-8">
        <ArrowLeft size={14} /> Back to Home
      </Link>

      {/* Author Header */}
      <div className="text-center mb-12">
        <img
          src={avatarUrl}
          alt={decodedName}
          className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-border shadow-lg"
        />
        <h1 className="text-3xl sm:text-4xl font-bold font-serif mb-2">{decodedName}</h1>
        <p className="text-ink-light text-sm uppercase tracking-wider font-semibold">{authorRole}</p>
        <div className="flex items-center justify-center gap-2 mt-3 text-sm text-ink-light">
          <FileText size={14} />
          <span>{authorArticles.length} article{authorArticles.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="w-16 h-1 bg-accent mx-auto mt-6 rounded" />
      </div>

      {/* Articles List */}
      {authorArticles.length === 0 ? (
        <div className="text-center py-16 text-ink-light">
          <p className="text-lg">No articles found for this author.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {authorArticles.map(article => (
            <Link
              key={article.id}
              to={`/article/${article.id}`}
              className="group flex gap-6 items-start border-b border-border pb-8 hover:bg-gray-50 -mx-4 px-4 py-4 rounded-lg transition-colors"
            >
              {article.imageUrl && (
                <img
                  src={article.imageUrl}
                  alt={article.title}
                  className="w-32 h-24 sm:w-40 sm:h-28 object-cover rounded-sm flex-shrink-0 bg-gray-100"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-accent uppercase tracking-wider mb-1">
                  {article.category}
                </div>
                <h2 className="text-lg sm:text-xl font-bold font-serif group-hover:text-accent transition-colors mb-1 line-clamp-2">
                  {article.title}
                </h2>
                <p className="text-sm text-ink-light line-clamp-2 mb-2">{article.excerpt}</p>
                <div className="text-xs text-gray-500 font-medium">
                  {article.date} {article.time && `· ${article.time}`}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
};

export default AuthorPage;
