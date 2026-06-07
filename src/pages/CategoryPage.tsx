// src/pages/CategoryPage.tsx
import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useArticles } from '../App';

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { articles, loading } = useArticles();

  const category = slug
    ? slug.charAt(0).toUpperCase() + slug.slice(1).toLowerCase()
    : '';

  const filtered = useMemo(
    () => articles.filter(a => a.category?.toLowerCase() === slug?.toLowerCase()),
    [articles, slug]
  );

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black"></div>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      <div className="mb-8 border-b border-gray-200 pb-6">
        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Section</span>
        <h1 className="text-4xl font-black tracking-tight mt-1">{category}</h1>
        <p className="text-sm text-gray-500 mt-1">{filtered.length} articles</p>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-400 text-lg">No articles in this category yet.</p>
          <Link to="/" className="mt-6 inline-block text-sm font-bold underline hover:no-underline">
            Back to Top Stories
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filtered.map(article => (
            <Link
              key={article.id}
              to={`/article/${article.id}`}
              className="group block"
            >
              <article className="flex flex-col h-full">
                {article.imageUrl && (
                  <div className="overflow-hidden rounded-sm mb-3">
                    <img
                      src={article.imageUrl}
                      alt={article.title}
                      loading="lazy"
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500 bg-gray-100"
                    />
                  </div>
                )}
                <div className="text-xs font-bold text-red-700 uppercase tracking-wider mb-1">
                  {article.category}
                </div>
                <h2 className="text-lg font-bold leading-snug group-hover:text-red-700 transition-colors mb-2">
                  {article.title}
                </h2>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{article.excerpt}</p>
                <div className="mt-auto text-xs text-gray-400 font-semibold uppercase tracking-wider">
                  {article.author} · {article.time}
                </div>
              </article>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
