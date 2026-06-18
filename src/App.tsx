/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// src/App.tsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { Search, Menu, ChevronRight, Mail, Share2, Twitter, Facebook, Linkedin, Link as LinkIcon, X, CheckCircle2, LogOut, Sparkles, Users, FileText, Activity, ShieldAlert, Award, Moon, Sun, Bookmark, BookmarkCheck } from 'lucide-react';

// Admin and auth pages are client-only — lazy load them so SSR never touches
// their dependencies (MDEditor, etc.) which have ESM circular dep issues.
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const RegisterPage = React.lazy(() => import('./pages/RegisterPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const BecomeWriterPage = React.lazy(() => import('./pages/BecomeWriterPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const AuthorPage = React.lazy(() => import('./pages/AuthorPage'));
const BookmarksPage = React.lazy(() => import('./pages/BookmarksPage'));
const StockFinderPage = React.lazy(() => import('./pages/StockFinderPage'));

import CategoryPage from './pages/CategoryPage';
import NotFoundPage from './pages/NotFoundPage';
import { supabase } from './lib/supabase';
import { getOrigin, getCurrentUrl } from './lib/ssrUtils';
import { AuthProvider, useAuth } from './components/AuthProvider';
import MarkdownRenderer from './components/MarkdownRenderer';

// --- Global Context for Articles ---
export const ArticleContext = React.createContext<{ articles: any[], loading: boolean, refetch: () => Promise<void> }>({
  articles: [],
  loading: true,
  refetch: async () => {}
});

export const useArticles = () => React.useContext(ArticleContext);

// --- Bookmarks Hook ---
const useBookmarks = () => {
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  const fetchBookmarks = useCallback(async () => {
    if (!user) { setBookmarkedIds(new Set()); return; }
    try {
      const { data } = await supabase
        .from('bookmarks')
        .select('article_id')
        .eq('user_id', user.id);
      setBookmarkedIds(new Set((data || []).map((b: any) => b.article_id)));
    } catch { /* silent */ }
  }, [user]);

  useEffect(() => { fetchBookmarks(); }, [fetchBookmarks]);

  const toggleBookmark = useCallback(async (articleId: string) => {
    if (!user) return;
    const isBookmarked = bookmarkedIds.has(articleId);
    // Optimistic update
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      isBookmarked ? next.delete(articleId) : next.add(articleId);
      return next;
    });
    try {
      if (isBookmarked) {
        await supabase.from('bookmarks').delete().eq('user_id', user.id).eq('article_id', articleId);
      } else {
        await supabase.from('bookmarks').insert({ user_id: user.id, article_id: articleId });
      }
    } catch {
      // Revert on error
      fetchBookmarks();
    }
  }, [user, bookmarkedIds, fetchBookmarks]);

  const isBookmarked = useCallback((articleId: string) => bookmarkedIds.has(articleId), [bookmarkedIds]);

  return { bookmarkedIds, toggleBookmark, isBookmarked, refetch: fetchBookmarks };
};

// --- Helpers ---
/** Returns the article URL path, preferring slug over id for SEO */
const articleUrl = (a: any) => `/article/${a.slug || a.id}`;

// --- Mock Data ---
const CATEGORIES = ['World', 'Politics', 'Business', 'Tech', 'Science', 'Health', 'Sports', 'Arts', 'Opinion'];

const generateContent = (title: string) => [
  `${title} marks a significant turning point in recent developments. Experts and analysts have been closely monitoring the situation, noting that the implications could be far-reaching and transformative across multiple sectors.`,
  `"This is unprecedented in many ways," stated a leading researcher familiar with the matter. "We are seeing patterns that challenge our previous models and force us to rethink our long-term strategies." The data collected over the past few months supports this assertion, showing a clear deviation from historical norms.`,
  `Stakeholders are now scrambling to adjust to the new reality. While some view this as a challenge, others see it as a unique opportunity for innovation and growth. The coming weeks will be critical in determining the ultimate trajectory of these events.`,
  `As the situation continues to evolve, one thing is certain: the landscape has changed permanently. Observers advise cautious optimism while preparing for a range of possible outcomes in the near future.`
];

const ARTICLES: any[] = [
  {
    id: 'sample-1',
    title: "Global Markets Rally as Tech Sector Shows Unexpected Resilience",
    subtitle: "Despite early quarter concerns, major technology firms report record-breaking earnings, driving indices to all-time highs and easing recession fears.",
    excerpt: "Despite early quarter concerns, major technology firms report record-breaking earnings.",
    author: "Sarah Jenkins",
    role: "Senior Financial Correspondent",
    date: 'June 15, 2026',
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
    id: 'sample-2',
    title: "New Climate Accord Reached in Geneva Summit",
    subtitle: "World leaders agree on aggressive new carbon reduction targets for 2035.",
    excerpt: "World leaders agree on aggressive new carbon reduction targets for 2035.",
    author: "David Chen",
    role: "Environmental Editor",
    date: 'June 15, 2026',
    time: "4 hours ago",
    category: "World",
    imageUrl: "https://picsum.photos/seed/climate/600/400",
    contentArr: [
      "World leaders gathered today to announce a bold new plan."
    ],
    status: "published"
  }
];

// --- Components ---

// In-memory cache + in-flight promise dedup for AdSlot sponsor queries.
// Multiple AdSlot instances on the same page share one fetch request.
let sponsorsCache: { data: any[]; expiry: number } | null = null;
const CACHE_TTL = 30000; // 30 seconds
let inFlightPromise: Promise<any[]> | null = null;
// Unique counter per AdSlot instance so each slot picks a different sponsor to display.
let nextSlotId = 0;

const fetchActiveSponsors = async (): Promise<any[]> => {
  // Return cached data if still fresh
  if (sponsorsCache && Date.now() < sponsorsCache.expiry) {
    return sponsorsCache.data;
  }
  // Dedup concurrent requests — share the same in-flight promise
  if (inFlightPromise) {
    return inFlightPromise;
  }
  inFlightPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('ad_sponsors')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      const fetched = data || [];
      sponsorsCache = { data: fetched, expiry: Date.now() + CACHE_TTL };
      console.log('[AdSlot] Fetched & cached ' + fetched.length + ' sponsors');
      return fetched;
    } catch (e) {
      console.warn('[AdSlot] Failed to fetch sponsors:', e);
      // Serve stale cache as fallback
      if (sponsorsCache && sponsorsCache.data.length > 0) {
        console.log('[AdSlot] Serving stale cache (' + sponsorsCache.data.length + ' sponsors)');
        return sponsorsCache.data;
      }
      return [];
    } finally {
      inFlightPromise = null;
    }
  })();
  return inFlightPromise;
};

const AdSlot = ({ width, height, format = "auto", className = "" }: { width?: string, height?: string, format?: string, className?: string }) => {
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const cycleRef = useRef<NodeJS.Timeout | null>(null);
  const slotIdRef = useRef(nextSlotId++); // unique per instance — drives index distribution

  // Determine which ad_format matches this slot's dimensions
  const slotFormat = (() => {
    const w = parseInt(width || '0');
    const h = parseInt(height || '0');
    if (w >= 600 && h <= 100) return 'horizontal';   // 728x90 leaderboard
    if (w === 320 && h === 50) return 'anchor';       // 320x50 mobile anchor
    if (w === 250 && h === 200) return 'native';      // 250x200 in-feed card
    if (w <= 400 && h >= 200) return 'vertical';      // 300x250 medium rectangle
    if (format === 'fluid') return 'fluid';           // fluid full-width
    return null; // unknown — show any
  })();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fetched = await fetchActiveSponsors();
      if (cancelled) return;
      // Filter by ad_format if this slot has a known format
      let filtered = fetched;
      if (slotFormat) {
        const matching = fetched.filter((s: any) => s.ad_format === slotFormat);
        if (matching.length > 0) filtered = matching;
        // else fall back to all sponsors
      }
      setSponsors(filtered);
      // Distribute starting positions so slots don't all show the same sponsor
      if (filtered.length > 0) {
        const startIndex = slotIdRef.current % filtered.length;
        setCurrentIndex(startIndex);
        // Use this specific sponsor's frequency for the visibility gate
        const sponsor = filtered[startIndex];
        setShouldShow(Math.random() < (1 / (sponsor.frequency ?? 1)));
      } else {
        setShouldShow(false);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Rotation timer: cycle through sponsors every `duration_seconds`
  useEffect(() => {
    if (sponsors.length <= 1) return;
    const duration = (sponsors[currentIndex]?.duration_seconds ?? 10) * 1000;
    cycleRef.current = setTimeout(() => {
      const nextIndex = (currentIndex + 1) % sponsors.length;
      setCurrentIndex(nextIndex);
      // Re-evaluate frequency gate for the next sponsor in the rotation
      const nextSponsor = sponsors[nextIndex];
      setShouldShow(Math.random() < (1 / (nextSponsor.frequency ?? 1)));
    }, duration);
    return () => {
      if (cycleRef.current) clearTimeout(cycleRef.current);
    };
  }, [sponsors, currentIndex]);

  const currentSponsor = sponsors.length > 0 ? sponsors[currentIndex % sponsors.length] : null;

  // Show placeholder while loading, if no sponsors, or if frequency gate says no
  if (loading || sponsors.length === 0 || !shouldShow) {
    return (
      <div 
        className={`ad-placeholder ${className}`} 
        style={{ width: width || '100%', height: height || '250px' }}
        aria-label="Advertisement"
      >
        <span className="mb-1 font-semibold">Advertisement</span>
        <span className="text-[10px] opacity-70">
          {width && height ? `${width} x ${height}` : format}
        </span>
      </div>
    );
  }

  // Render active sponsor ad
  const container = (
    <div
      className={`relative overflow-hidden bg-white ${className}`}
      style={{ width: width || '100%', height: height || '250px' }}
      aria-label={`Advertisement: ${currentSponsor.name}`}
    >
      {currentSponsor.image_url ? (
        <img
          src={currentSponsor.image_url}
          alt={currentSponsor.name}
          className="w-full h-full object-contain p-1"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-bold text-gray-700 text-sm text-center px-2">
            {currentSponsor.name}
          </span>
        </div>
      )}
      {/* Sponsor label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1">
        <span className="text-[10px] text-white/80 font-semibold">
          Sponsored by {currentSponsor.name}
        </span>
      </div>
    </div>
  );

  // Wrap in link if target_url exists
  if (currentSponsor.target_url) {
    return (
      <a
        href={currentSponsor.target_url}
        target="_blank"
        rel="noopener noreferrer"
        className="block no-underline"
      >
        {container}
      </a>
    );
  }

  return container;
};

// SEO Component
const SEO = ({ title, description, url, imageUrl, type = 'website', author, datePublished, schemaMarkup }: { title: string, description: string, url?: string, imageUrl?: string, type?: string, author?: string, datePublished?: string, schemaMarkup?: object }) => {
  const siteTitle = 'Lensa Insignia';
  const fullTitle = title === siteTitle ? title : `${title} | ${siteTitle}`;
  const { pathname } = useLocation();

  // Strip query strings from canonical URL to avoid duplicate content signals
  // Prefer explicitly passed url, otherwise build from current pathname
  const canonicalUrl = url
    ? (() => { try { const u = new URL(url); return u.origin + u.pathname; } catch { return url; } })()
    : getCurrentUrl(pathname);
  
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph */}
      <meta property="og:site_name" content="Lensa Insignia" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      {imageUrl && <meta property="og:image" content={imageUrl} />}
      
      {type === 'article' && author && <meta property="article:author" content={author} />}
      {type === 'article' && datePublished && <meta property="article:published_time" content={datePublished} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {imageUrl && <meta name="twitter:image" content={imageUrl} />}

      {schemaMarkup && (
        <script type="application/ld+json">
          {JSON.stringify(schemaMarkup)}
        </script>
      )}
    </Helmet>
  );
};

// Scroll to top on route change — client-only, no-op on SSR
const ScrollToTop = () => {
  const location = useLocation();
  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, [location.pathname, location.search]);
  return null;
};

const Header = () => {
  const { user, role, logout } = useAuth();
  // Compute the date string lazily on the client only to avoid SSR/client mismatch.
  // On the first render (which matches the SSR output) we use an empty string;
  // after mount we update to the real formatted date string.
  const [date, setDate] = useState('');
  useEffect(() => {
    setDate(new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }));
  }, []);
  const [isVisible, setIsVisible] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentCategory = searchParams.get('category');

  useEffect(() => {
    let lastScrollY = window.scrollY;
    
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
        setIsMenuOpen(false); 
        setIsSearchOpen(false);
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = searchQuery.trim();
    if (queryStr) {
      navigate(`/?q=${encodeURIComponent(queryStr)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };
  
  // Dark mode
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);
  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <>
      <header className={`w-full bg-paper border-b border-border sticky top-0 z-50 transition-transform duration-500 ease-in-out ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between text-xs font-medium text-ink-light uppercase tracking-wider">
          <div className="flex items-center space-x-4">
            <span>{date}</span>
            <span className="hidden sm:inline-block">Edition: U.S.</span>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <span className="hidden sm:inline-block">Hi, {user.email?.split('@')[0]}</span>
                {(role === 'admin' || role === 'dev' || role === 'poster') && (
                  <Link to="/dashboard" className="text-accent font-bold hover:underline">
                    Dashboard
                  </Link>
                )}
                <Link to="/profile" className="text-accent font-bold hover:underline">
                    My Profile
                  </Link>
                <button 
                  onClick={logout} 
                  className="hover:text-ink transition-colors font-bold lowercase flex items-center gap-1"
                >
                  <LogOut size={12} /> Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link to="/login" className="hover:text-ink transition-colors">Sign In</Link>
                <Link to="/register" className="hover:text-ink transition-colors font-bold bg-ink text-paper px-3 py-1 text-xs uppercase tracking-wider hover:bg-ink-light">Register</Link>
              </div>
            )}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            {user && (
              <Link to="/saved" className="p-1.5 rounded-full hover:bg-gray-100 transition-colors" aria-label="Saved articles">
                <Bookmark size={14} />
              </Link>
            )}
            <Link to="/newsletters" className="hover:text-ink transition-colors">Newsletters</Link>
          </div>
        </div>
        
        <div className="editorial-divider"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between relative">
          <div className="flex items-center space-x-6">
            <button 
              onClick={() => { setIsMenuOpen(!isMenuOpen); setIsSearchOpen(false); }}
              className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors" 
              aria-label="Menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <button 
              onClick={() => { setIsSearchOpen(!isSearchOpen); setIsMenuOpen(false); }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors hidden sm:block" 
              aria-label="Search"
            >
              {isSearchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
          
          <div className="flex-1 flex justify-center">
            <Link to="/" onClick={() => { setIsMenuOpen(false); setIsSearchOpen(false); }}>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-center cursor-pointer">
                Lensa Insignia
              </h1>
            </Link>
          </div>
          
          <div className="flex items-center space-x-4 w-10 sm:w-20">
          </div>

          {isSearchOpen && (
            <div className="absolute top-full left-0 w-full bg-paper border-b border-border p-4 shadow-lg z-50">
              <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex items-center">
                <Search className="w-5 h-5 text-ink-light mr-3" />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Search articles, topics, or authors..." 
                  className="flex-1 bg-transparent text-lg focus:outline-none placeholder-gray-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="bg-ink text-paper px-4 py-2 text-sm font-bold uppercase tracking-wider hover:bg-ink-light transition-colors">
                  Search
                </button>
              </form>
            </div>
          )}
        </div>
        
        <div className="editorial-divider-double"></div>
        
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-center space-x-6 sm:space-x-8 overflow-x-auto whitespace-nowrap text-sm font-semibold">
          <Link 
            to="/" 
            className={`hover:text-accent transition-colors ${!currentCategory && !searchParams.get('q') ? 'text-accent border-b-2 border-accent' : ''}`}
          >
            Top Stories
          </Link>
          {CATEGORIES.map((item) => (
            <Link 
              key={item} 
              to={`/category/${item.toLowerCase()}`} 
              className={`hover:text-accent transition-colors ${currentCategory === item.toLowerCase() ? 'text-accent border-b-2 border-accent' : ''}`}
            >
              {item}
            </Link>
          ))}
        </nav>
        <div className="editorial-divider"></div>
      </header>

      {isMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setIsMenuOpen(false)}>
          <div 
            className="absolute top-0 left-0 w-64 h-full bg-paper shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-border flex justify-between items-center">
              <span className="font-serif font-bold text-xl">Menu</span>
              <button onClick={() => setIsMenuOpen(false)}><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 border-b border-border">
              <form onSubmit={handleSearch} className="flex items-center bg-gray-100 p-2 rounded-sm">
                <Search className="w-4 h-4 text-ink-light mr-2" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="bg-transparent flex-1 focus:outline-none text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              <Link to="/" onClick={() => setIsMenuOpen(false)} className="font-bold hover:text-accent">Top Stories</Link>
              {CATEGORIES.map(cat => (
                <Link 
                  key={cat} 
                  to={`/category/${cat.toLowerCase()}`} 
                  onClick={() => setIsMenuOpen(false)}
                  className="font-bold hover:text-accent"
                >
                  {cat}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Footer = () => {
  return (
    <footer className="bg-ink text-paper py-12 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-1">
            <h2 className="text-2xl font-bold mb-4">Lensa Insignia</h2>
            <p className="text-sm text-gray-400 mb-4">
              Delivering accurate, unbiased, and comprehensive news to our readers worldwide since 1924.
            </p>
          </div>
          
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-gray-300">Sections</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/category/world" className="hover:text-white transition-colors">World News</Link></li>
              <li><Link to="/category/politics" className="hover:text-white transition-colors">Politics</Link></li>
              <li><Link to="/category/business" className="hover:text-white transition-colors">Business & Tech</Link></li>
              <li><Link to="/category/science" className="hover:text-white transition-colors">Science & Health</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-gray-300">About Us</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/about" className="hover:text-white transition-colors">Our Story</Link></li>
              <li><Link to="/careers" className="hover:text-white transition-colors">Careers</Link></li>
              <li><Link to="/ethics" className="hover:text-white transition-colors">Journalistic Ethics</Link></li>
              <li><Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4 text-gray-300">Legal</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link></li>
              <li><Link to="/accessibility" className="hover:text-white transition-colors">Accessibility</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500">
          <p>&copy; {new Date().getFullYear()} Lensa Insignia Media Group. All rights reserved.</p>
          <div className="mt-4 md:mt-0 flex space-x-4">
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
            <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
            <a href="#" className="hover:text-white transition-colors">Facebook</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

const Sidebar = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [email, setEmail] = useState('');
  const { articles } = useArticles();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsSubscribed(true);
      setEmail('');
      setTimeout(() => setIsSubscribed(false), 5000);
    }
  };

  return (
    <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-8">
      {/* Top sidebar ad */}
      <div className="flex flex-col items-center">
        <span className="text-[9px] uppercase tracking-widest text-gray-400 mb-1">Advertisement</span>
        <AdSlot width="300px" height="250px" />
      </div>
      
      <div className="bg-gray-50 p-6 border border-border">
        <h3 className="text-lg font-bold uppercase tracking-wider mb-4 flex items-center">
          <span className="w-2 h-2 bg-accent rounded-full mr-2"></span>
          Trending Now
        </h3>
        <div className="editorial-divider mb-4"></div>
        <ul className="space-y-4">
          {articles.slice(0, 5).map((article, index) => (
            <li key={article.id} className="group cursor-pointer">
              <Link to={articleUrl(article)} className="flex items-start">
                <span className="text-2xl font-serif font-bold text-gray-300 mr-4 leading-none">
                  {index + 1}
                </span>
                <h4 className="text-sm font-semibold group-hover:text-accent transition-colors leading-snug">
                  {article.title}
                </h4>
              </Link>
              {index < 4 && (
                <div className="editorial-divider mt-4"></div>
              )}
            </li>
          ))}
        </ul>
      </div>
      
      <div className="bg-ink text-paper p-6 text-center transition-all duration-300">
        {isSubscribed ? (
          <div className="py-8 flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <CheckCircle2 className="w-12 h-12 text-green-400 mb-4" />
            <h3 className="text-xl font-serif font-bold mb-2">You're Subscribed!</h3>
            <p className="text-sm text-gray-400">Thank you for joining The Morning Briefing.</p>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            <Mail className="w-8 h-8 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-serif font-bold mb-2">The Morning Briefing</h3>
            <p className="text-sm text-gray-400 mb-6">Start your day with the stories you need to know.</p>
            <form className="flex flex-col gap-3" onSubmit={handleSubscribe}>
              <input 
                type="email" 
                placeholder="Your email address" 
                className="px-4 py-2 text-sm text-ink bg-white focus:outline-none focus:ring-2 focus:ring-accent"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button 
                type="submit"
                className="bg-accent hover:bg-red-800 text-white font-bold py-2 px-4 text-sm uppercase tracking-wider transition-colors"
              >
                Sign Up
              </button>
            </form>
          </div>
        )}
      </div>
      
      {/* Sticky sidebar ad — stays visible while scrolling */}
      <div className="sticky top-28 flex flex-col items-center">
        <span className="text-[9px] uppercase tracking-widest text-gray-400 mb-1">Advertisement</span>
        <AdSlot width="300px" height="250px" />
      </div>
    </aside>
  );
};

const HomePage = () => {
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category');
  const query = searchParams.get('q');
  const { articles } = useArticles();
  const { user } = useAuth();
  const { toggleBookmark, isBookmarked } = useBookmarks();

  const filteredArticles = useMemo(() => {
    let result = articles;
    
    if (category) {
      result = result.filter(a => a.category === category);
    }
    
    if (query) {
      const q = query.toLowerCase().trim();
      const keywords = q.split(/\s+/).filter(Boolean);
      
      const scoredResults = result.map(a => {
        let score = 0;
        const titleCat = `${a.title} ${a.category} ${a.author}`.toLowerCase();
        const contentFallback = a.contentStr || (a.contentArr ? a.contentArr.join(' ') : (a.content ? a.content.join(' ') : ''));
        const fullText = `${a.title} ${a.subtitle} ${a.excerpt} ${a.category} ${a.author} ${contentFallback}`.toLowerCase();
        
        // Exact full phrase match (highest priority)
        if (titleCat.includes(q)) score += 50;
        if (fullText.includes(q)) score += 20;

        // Score based on individual keyword matches
        keywords.forEach(kw => {
          if (titleCat.includes(kw)) score += 10;
          else if (fullText.includes(kw)) score += 2;
        });

        return { article: a, score };
      });

      // Return articles with a score > 0, ordered by highest score first
      result = scoredResults
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.article);
    }
    
    return result;
  }, [articles, category, query]);

  // If filtering, we just show a grid of results. Otherwise, show the complex layout.
  const isFiltering = category || query;

  let seoTitle = 'Lensa Insignia';
  if (query) seoTitle = `Search Results for "${query}"`;
  else if (category) seoTitle = `${category} News`;

  let seoDescription = 'Delivering accurate, unbiased, and comprehensive news to our readers worldwide since 1924.';
  if (category) seoDescription = `Read the latest and breaking news from our ${category} section.`;

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "name": "Lensa Insignia",
    "url": getOrigin(),
    "logo": {
      "@type": "ImageObject",
      "url": `${getOrigin()}/favicon.svg`,
      "width": 64,
      "height": 64
    },
    "description": seoDescription,
    "foundingDate": "1924",
    "sameAs": []
  };

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <SEO title={seoTitle} description={seoDescription} schemaMarkup={!isFiltering ? organizationSchema : undefined} />
      
      {isFiltering && (
        <div className="mb-8">
          <h2 className="text-3xl font-serif font-bold mb-2">
            {query ? `Search Results for "${query}"` : `${category} News`}
          </h2>
          <p className="text-ink-light">Found {filteredArticles.length} articles</p>
          <div className="editorial-divider-thick mt-4"></div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-8">
          
          {filteredArticles.length === 0 ? (
            <div className="py-12 text-center">
              <h3 className="text-2xl font-serif font-bold mb-2">No articles found</h3>
              <p className="text-ink-light">Try adjusting your search or category filter.</p>
              <Link to="/" className="inline-block mt-6 px-6 py-2 bg-ink text-paper font-bold uppercase tracking-wider text-sm hover:bg-ink-light transition-colors">
                Return to Top Stories
              </Link>
            </div>
          ) : isFiltering ? (
            // Filtered Grid View
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {filteredArticles.map((article) => (
                <Link key={article.id} to={articleUrl(article)} className="group cursor-pointer block">
                  <article className="flex flex-col h-full">
                    <div className="overflow-hidden mb-3 rounded-sm">
                      {article.imageUrl ? (
                        <img 
                          src={article.imageUrl} 
                          alt={article.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-[200px] object-cover transform group-hover:scale-105 transition-transform duration-500 bg-gray-100"
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                    </div>
                    <div className="text-xs font-bold text-accent uppercase tracking-wider mb-2">
                      {article.category}
                    </div>
                    <h3 className="text-xl font-bold mb-2 group-hover:text-accent transition-colors leading-snug">
                      {article.title}
                    </h3>
                    <p className="text-sm text-ink-light mb-4 line-clamp-2">{article.excerpt}</p>
                    <div className="mt-auto flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2 border-t border-border">
                      <span>{article.time}</span>
                      {user && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(article.id); }}
                          className={`p-1 rounded transition-colors ${isBookmarked(article.id) ? 'text-accent' : 'text-gray-400 hover:text-gray-600'}`}
                          aria-label="Bookmark"
                        >
                          {isBookmarked(article.id) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                        </button>
                      )}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          ) : (
            // Default Complex Layout
            <>
              {filteredArticles.length > 0 && (() => {
                const hero = filteredArticles[0];
                return (
                  <Link to={articleUrl(hero)} className="group cursor-pointer block mb-8">
                    <article className="relative overflow-hidden rounded-sm">
                      {hero.imageUrl ? (
                        <img
                          src={hero.imageUrl}
                          alt={hero.title}
                          loading="eager"
                          decoding="async"
                          width="1200"
                          height="600"
                          className="w-full h-[320px] sm:h-[420px] object-cover transform group-hover:scale-105 transition-transform duration-700 bg-gray-100"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-[320px] sm:h-[420px]" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)' }} />
                      )}
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                        <div className="text-xs font-bold uppercase tracking-wider mb-3 px-2 py-1 bg-accent text-white inline-block">
                          {hero.category}
                        </div>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-3 leading-tight group-hover:text-accent transition-colors" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                          {hero.title}
                        </h2>
                        <p className="text-white/80 text-sm sm:text-base mb-3 line-clamp-2 max-w-2xl">
                          {hero.excerpt}
                        </p>
                        <div className="flex items-center text-xs font-semibold text-white/60 uppercase tracking-wider">
                          <span className="text-white/90">{hero.author}</span>
                          <span className="mx-2">•</span>
                          <span>{hero.time}</span>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })()}

              {/* 2-column feature row */}
              {filteredArticles.length > 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 pb-6 border-b-2 border-ink">
                  {filteredArticles.slice(1, 3).map((article) => {
                    return (
                      <Link key={article.id} to={articleUrl(article)} className="group cursor-pointer block">
                        <article className="flex flex-col h-full">
                          <div className="overflow-hidden mb-3 rounded-sm relative">
                            {article.imageUrl ? (
                              <img
                                src={article.imageUrl}
                                alt={article.title}
                                loading="lazy"
                                decoding="async"
                                width="600"
                                height="400"
                                className="w-full h-[200px] object-cover transform group-hover:scale-105 transition-transform duration-500 bg-gray-100"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-[200px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)' }}>
                                <span className="text-4xl" style={{ color: 'rgba(255,255,255,0.08)' }}>{article.category}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-xs font-bold text-accent uppercase tracking-wider mb-2">
                            {article.category}
                          </div>
                          <h3 className="text-xl font-bold mb-2 group-hover:text-accent transition-colors leading-snug">
                            {article.title}
                          </h3>
                          <p className="text-sm text-ink-light line-clamp-2 mb-2">{article.excerpt}</p>
                          <div className="mt-auto text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2">
                            {article.author} · {article.time}
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* 3-column grid for remaining articles */}
              {filteredArticles.length > 3 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {filteredArticles.slice(3, 9).map((article) => {
                    return (
                      <Link key={article.id} to={articleUrl(article)} className="group cursor-pointer block">
                        <article className="flex flex-col h-full">
                          <div className="overflow-hidden mb-3 rounded-sm">
                            {article.imageUrl ? (
                              <img
                                src={article.imageUrl}
                                alt={article.title}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-[160px] object-cover transform group-hover:scale-105 transition-transform duration-500 bg-gray-100"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-full h-[160px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)' }}>
                                <span className="text-3xl font-serif" style={{ color: 'rgba(255,255,255,0.08)' }}>{article.category}</span>
                              </div>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-accent uppercase tracking-wider mb-1">
                            {article.category}
                          </div>
                          <h3 className="text-base font-bold mb-1 group-hover:text-accent transition-colors leading-snug line-clamp-3">
                            {article.title}
                          </h3>
                          <div className="mt-auto text-[11px] font-semibold text-gray-400 uppercase tracking-wider pt-2">
                            {article.author} · {article.time}
                          </div>
                        </article>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
          
          {/* Removed all ad slots for cleaner look */}
        </div>
        
        <Sidebar />
      </div>

      {/* Bottom anchor ad — mobile only, fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden flex-col items-center bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] py-2 px-4">
        <div className="flex items-center justify-between w-full max-w-sm">
          <span className="text-[8px] uppercase tracking-widest text-gray-400">Ad</span>
        </div>
        <AdSlot width="320px" height="50px" className="mt-1" />
      </div>
    </main>
  );
};

const ArticlePage = () => {
  const { id } = useParams();
  const [copied, setCopied] = useState(false);
  const { articles, loading } = useArticles();
  const { user } = useAuth();
  const { toggleBookmark, isBookmarked } = useBookmarks();
  
  const article = articles.find(a => a.slug === id || a.id === id);

  const relatedArticles = useMemo(() => {
    if (!article) return [];
    
    // First, find articles in the same category
    let related = articles.filter(a => a.id !== article.id && a.category === article.category);
    
    // If we have fewer than 2 related articles, fill in with the most recent articles
    if (related.length < 2) {
      const otherArticles = articles.filter(a => a.id !== article.id && a.category !== article.category);
      related = [...related, ...otherArticles].slice(0, 2);
    } else {
      related = related.slice(0, 2);
    }
    
    return related;
  }, [article, articles]);

  if (loading) {
    return (
      <main className="flex-1 max-w-7xl mx-auto px-4 py-20 text-center w-full flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent mb-4"></div>
        <p className="text-ink-light">Loading article...</p>
      </main>
    );
  }

  if (!article) {
    return (
      <main className="flex-1 max-w-7xl mx-auto px-4 py-20 text-center w-full">
        <SEO title="Article Not Found" description="The requested article does not exist or has been removed." />
        <h1 className="text-4xl font-serif font-bold mb-4">Article Not Found</h1>
        <p className="text-ink-light mb-8">The article you are looking for does not exist or has been removed.</p>
        <Link to="/" className="px-6 py-3 bg-ink text-paper font-bold uppercase tracking-wider text-sm hover:bg-ink-light transition-colors">
          Return Home
        </Link>
      </main>
    );
  }

  const handleShare = (platform: string) => {
    const currentUrl = typeof window !== 'undefined' ? window.location.href : getCurrentUrl(article ? articleUrl(article) : '');
    const url = encodeURIComponent(currentUrl);
    const title = encodeURIComponent(article.title);
    const excerpt = encodeURIComponent(article.excerpt);
    
    let shareUrl = '';
    
    if (platform === 'twitter') {
      shareUrl = `https://twitter.com/intent/tweet?url=${url}&text=${title}&via=lensainsignia`;
    } else if (platform === 'facebook') {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    } else if (platform === 'linkedin') {
      shareUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}&summary=${excerpt}&source=LensaInsignia`;
    } else if (platform === 'copy') {
      if (typeof navigator !== 'undefined') {
        navigator.clipboard.writeText(currentUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    
    if (shareUrl) {
      window.open(shareUrl, 'share-dialog', 'width=600,height=400,menubar=no,toolbar=no,resizable=yes,scrollbars=yes');
    }
  };

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <SEO 
        title={article.title} 
        description={article.excerpt} 
        type="article"
        imageUrl={`${getOrigin()}/og/${article.id}.png`}
        author={article.author}
        datePublished={article.createdAt ? new Date(article.createdAt).toISOString() : undefined}
        schemaMarkup={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          "headline": article.title,
          "image": article.imageUrl ? [article.imageUrl] : [],
          "datePublished": article.createdAt ? new Date(article.createdAt).toISOString() : '',
          "dateModified": article.updatedAt ? new Date(article.updatedAt).toISOString() : (article.createdAt ? new Date(article.createdAt).toISOString() : ''),
          "author": [{
            "@type": "Person",
            "name": article.author,
            "jobTitle": article.role
          }],
          "publisher": {
            "@type": "NewsMediaOrganization",
            "name": "Lensa Insignia",
            "url": getOrigin(),
            "logo": {
              "@type": "ImageObject",
              "url": `${getOrigin()}/favicon.svg`,
              "width": 64,
              "height": 64
            }
          },
          "description": article.excerpt,
          "articleSection": article.category,
          "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `${getOrigin()}/article/${article.id}`
          }
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col">
          
          <header className="mb-6 sm:mb-8">
            <Link to={`/?category=${article.category}`} className="text-accent font-bold uppercase tracking-wider text-xs sm:text-sm mb-3 sm:mb-4 inline-block hover:underline">
              {article.category}
            </Link>
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-3 sm:mb-6 leading-tight">
              {article.title}
            </h1>
            {article.subtitle && (
              <p className="text-base sm:text-xl text-ink-light mb-4 sm:mb-6 font-serif italic">
                {article.subtitle}
              </p>
            )}
            
            <div className="py-3 sm:py-4 border-y border-border space-y-3 sm:space-y-0">
              {/* Author row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                    <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${article.author}`} alt={article.author} loading="lazy" decoding="async" width="48" height="48" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <Link to={`/author/${encodeURIComponent(article.author)}`} className="font-bold text-sm sm:text-base text-ink hover:text-accent transition-colors">{article.author}</Link>
                    <div className="text-[10px] sm:text-xs text-ink-light">{article.role}</div>
                  </div>
                </div>
                <div className="text-xs sm:text-sm font-semibold text-ink-light uppercase tracking-wider">
                  {article.date}
                </div>
              </div>
              {/* Share row */}
              <div className="flex items-center justify-between sm:justify-end space-x-2">
                <div className="flex space-x-1.5 sm:space-x-2 relative text-ink">
                  <button onClick={() => handleShare('twitter')} className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100 hover:bg-[#1DA1F2] hover:text-white transition-colors" aria-label="Share on Twitter"><Twitter className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                  <button onClick={() => handleShare('facebook')} className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100 hover:bg-[#4267B2] hover:text-white transition-colors" aria-label="Share on Facebook"><Facebook className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                  <button onClick={() => handleShare('linkedin')} className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-100 hover:bg-[#0077B5] hover:text-white transition-colors" aria-label="Share on LinkedIn"><Linkedin className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></button>
                  <button onClick={() => handleShare('copy')} className="flex items-center space-x-1.5 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors relative" aria-label="Copy Link">
                    <LinkIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm font-semibold hidden sm:inline-block">Copy Link</span>
                    {copied && (
                      <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-ink text-paper text-xs px-3 py-1.5 rounded-sm whitespace-nowrap">
                        Link Copied!
                      </span>
                    )}
                  </button>
                  {user && (
                    <button
                      onClick={() => toggleBookmark(article.id)}
                      className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full transition-colors ${isBookmarked(article.id) ? 'bg-accent text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
                      aria-label={isBookmarked(article.id) ? 'Remove bookmark' : 'Bookmark article'}
                    >
                      {isBookmarked(article.id) ? <BookmarkCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </header>

          <figure className="mb-10">
            {article.imageUrl ? (
              <img 
                src={article.imageUrl} 
                alt={article.title} 
                loading="eager" 
                decoding="async"
                className="w-full h-[300px] sm:h-[500px] object-cover rounded-sm mb-3 bg-gray-100" 
              />
            ) : null}
            <figcaption className="text-xs text-ink-light text-right">
              Photography by Lensa Insignia / AP
            </figcaption>
          </figure>

          <div className="prose prose-lg max-w-none font-serif text-ink leading-relaxed" data-color-mode="light">
            {/* Inline float ad — positioned in the content flow */}
            <div className="my-10 hidden md:flex flex-col items-center float-right ml-8 mb-4">
              <span className="text-[9px] uppercase tracking-widest text-gray-400 mb-1 not-prose">Advertisement</span>
              <AdSlot width="300px" height="250px" />
            </div>

            {article.contentStr ? (
              <MarkdownRenderer source={article.contentStr} />
            ) : (
              // Fallback for old contentArr or mock data
              (() => {
                const paragraphs = article.contentArr || article.content || [];
                return (
                  <>
                    <p className="text-xl leading-relaxed mb-6">
                      {paragraphs[0] && (
                        <>
                          <span className="float-left text-7xl font-black leading-none pr-3 pt-2 text-ink">{paragraphs[0].charAt(0)}</span>
                          {paragraphs[0].substring(1)}
                        </>
                      )}
                    </p>
                    
                    {paragraphs.slice(1).map((paragraph: string, idx: number) => (
                      <p key={idx} className="mb-6">{paragraph}</p>
                    ))}
                  </>
                );
              })()
            )}
          </div>



          {relatedArticles.length > 0 && (
            <div className="mt-8 pt-8 border-t-4 border-ink">
              <h3 className="text-2xl font-black font-serif uppercase tracking-wider mb-8 text-ink">Related Articles</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {relatedArticles.map((related) => (
                  <Link key={related.id} to={articleUrl(related)} className="group block h-full flex flex-col">
                    <div className="overflow-hidden mb-4 rounded-sm border border-border">
                      {related.imageUrl ? (
                        <img 
                          src={related.imageUrl} 
                          alt={related.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-[220px] object-cover transform group-hover:scale-105 transition-transform duration-500 bg-gray-100"
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                    </div>
                    <div className="text-xs font-bold text-accent uppercase tracking-wider mb-2">
                      {related.category}
                    </div>
                    <h4 className="text-xl font-bold group-hover:text-accent transition-colors leading-snug mb-3">
                      {related.title}
                    </h4>
                    <p className="text-sm text-ink-light line-clamp-2">
                      {related.excerpt}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <Sidebar />
      </div>
    </main>
  );
};

const StaticPage = ({ title }: { title: string }) => {
  const content: Record<string, { description: string; body: React.ReactNode }> = {
    "Our Story": {
      description: "Learn about Lensa Insignia — our history, mission, and commitment to unbiased journalism since 1924.",
      body: (
        <>
          <p className="text-xl leading-relaxed mb-6">
            <span className="float-left text-7xl font-black leading-none pr-3 pt-2 text-ink">F</span>ounded in 1924, Lensa Insignia began as a small regional newspaper with a single conviction: that informed citizens make better decisions. Nearly a century later, that conviction remains the core of everything we do.
          </p>
          <p className="mb-6">We are an independent news organization committed to factual, unbiased reporting. Our editorial decisions are made free from commercial or political influence. We hold ourselves to the highest standards of journalistic integrity, and we correct our mistakes publicly and promptly.</p>
          <blockquote className="border-l-4 border-accent pl-6 py-2 my-8 text-2xl italic font-serif text-ink-light">
            "The mission of journalism is to inform citizens, challenge power, and illuminate the truth — no matter how inconvenient."
          </blockquote>
          <p className="mb-6">Today, Lensa Insignia reaches readers across the globe covering World affairs, Politics, Business, Technology, Science, Health, Sports, Arts, and Opinion. Our newsroom is staffed by award-winning journalists, editors, and photojournalists who work tirelessly to bring you stories that matter.</p>
          <p className="mb-6">We are funded through a combination of advertising, subscriptions, and grants from journalistic foundations. We do not accept funding from political parties, governments, or corporations with interests in our coverage areas.</p>
        </>
      )
    },
    "Careers": {
      description: "Join the Lensa Insignia team. Explore open positions in journalism, technology, product, and operations.",
      body: (
        <>
          <p className="text-xl leading-relaxed mb-6">
            <span className="float-left text-7xl font-black leading-none pr-3 pt-2 text-ink">W</span>e are always looking for talented, curious, and driven people to join the Lensa Insignia team. Whether you are a seasoned journalist, a developer, or a product designer, we want to hear from you.
          </p>
          <p className="mb-6">At Lensa Insignia, you will work alongside some of the best minds in modern journalism and technology. We offer a collaborative, diverse, and remote-friendly work environment.</p>
          <h2 className="text-2xl font-black mt-8 mb-4">Open Roles</h2>
          <ul className="space-y-3 mb-6 list-disc pl-6">
            <li>Senior Political Correspondent</li>
            <li>Data Journalist</li>
            <li>Full-Stack Engineer (React / Node.js)</li>
            <li>UX Designer</li>
            <li>Social Media Editor</li>
          </ul>
          <p className="mb-6">To apply, send your CV and a cover letter to <strong>careers@lensainsignia.com</strong>. Include the role title in your subject line.</p>
        </>
      )
    },
    "Journalistic Ethics": {
      description: "Read the Lensa Insignia editorial standards, ethics policy, and commitment to accuracy, fairness, and transparency.",
      body: (
        <>
          <p className="text-xl leading-relaxed mb-6">
            <span className="float-left text-7xl font-black leading-none pr-3 pt-2 text-ink">E</span>thics are not optional in journalism — they are the foundation. At Lensa Insignia, every reporter, editor, and contributor is bound by the following principles.
          </p>
          <h2 className="text-2xl font-black mt-8 mb-3">Accuracy</h2>
          <p className="mb-6">We verify facts before publishing. When we make mistakes, we correct them clearly and promptly with a correction notice appended to the original article.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Independence</h2>
          <p className="mb-6">Our editorial decisions are made independently of advertisers, sponsors, and outside interests. We do not accept gifts, free travel, or any benefit from sources we cover.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Fairness</h2>
          <p className="mb-6">We represent all sides of a story fairly. Subjects of criticism are given the opportunity to respond before publication.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Transparency</h2>
          <p className="mb-6">We disclose conflicts of interest. We identify anonymous sources only when necessary for public interest reporting and after careful editorial review.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Corrections Policy</h2>
          <p className="mb-6">Corrections are published at the top of the affected article and logged in our corrections archive. We do not silently alter published content.</p>
          <p className="mb-6">To report an error or raise an ethics concern, contact <strong>ethics@lensainsignia.com</strong>.</p>
        </>
      )
    },
    "Contact Us": {
      description: "Get in touch with the Lensa Insignia newsroom. Contact us for tips, press inquiries, corrections, or general questions.",
      body: (
        <>
          <p className="text-xl leading-relaxed mb-6">
            <span className="float-left text-7xl font-black leading-none pr-3 pt-2 text-ink">W</span>e welcome tips, story ideas, corrections, and feedback from our readers. Use the contacts below to reach the right team.
          </p>
          <h2 className="text-2xl font-black mt-8 mb-3">News Tips</h2>
          <p className="mb-6">Have a story we should investigate? Email us at <strong>tips@lensainsignia.com</strong>. For sensitive tips, consider using a secure channel such as Signal.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Press & Media Inquiries</h2>
          <p className="mb-6">For interview requests and media inquiries, contact our communications team at <strong>press@lensainsignia.com</strong>.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Corrections</h2>
          <p className="mb-6">To report a factual error, email <strong>corrections@lensainsignia.com</strong> with the article URL and the specific inaccuracy.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">General Enquiries</h2>
          <p className="mb-6">For all other questions, reach us at <strong>hello@lensainsignia.com</strong>.</p>
        </>
      )
    },
    "Terms of Service": {
      description: "Read the Lensa Insignia Terms of Service governing use of our website, content, and services.",
      body: (
        <>
          <p className="text-sm text-ink-light mb-8">Last updated: January 1, 2025</p>
          <p className="text-xl leading-relaxed mb-6">
            <span className="float-left text-7xl font-black leading-none pr-3 pt-2 text-ink">B</span>y accessing or using the Lensa Insignia website and services, you agree to be bound by these Terms of Service. Please read them carefully.
          </p>
          <h2 className="text-2xl font-black mt-8 mb-3">Use of Content</h2>
          <p className="mb-6">All content published on Lensa Insignia — including articles, photographs, graphics, and data — is the intellectual property of Lensa Insignia Media Group or its contributors. You may not reproduce, redistribute, or commercially exploit any content without prior written permission.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">User Accounts</h2>
          <p className="mb-6">You are responsible for maintaining the security of your account credentials. Lensa Insignia is not liable for any loss or damage arising from unauthorized account access.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Prohibited Conduct</h2>
          <p className="mb-6">You may not use our services to post illegal, harassing, defamatory, or misleading content. We reserve the right to terminate accounts that violate these terms.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Limitation of Liability</h2>
          <p className="mb-6">Lensa Insignia is provided "as is" without warranties of any kind. We are not liable for any direct or indirect damages arising from your use of the site.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Changes to Terms</h2>
          <p className="mb-6">We may update these Terms at any time. Continued use of the site after changes constitutes acceptance of the revised Terms.</p>
          <p className="mb-6">Questions? Contact us at <strong>legal@lensainsignia.com</strong>.</p>
        </>
      )
    },
    "Privacy Policy": {
      description: "Read the Lensa Insignia Privacy Policy. Learn how we collect, use, and protect your personal data.",
      body: (
        <>
          <p className="text-sm text-ink-light mb-8">Last updated: January 1, 2025</p>
          <p className="text-xl leading-relaxed mb-6">
            <span className="float-left text-7xl font-black leading-none pr-3 pt-2 text-ink">Y</span>our privacy matters to us. This policy explains what personal data Lensa Insignia collects, why we collect it, and how we use and protect it.
          </p>
          <h2 className="text-2xl font-black mt-8 mb-3">Data We Collect</h2>
          <p className="mb-6">We collect information you provide directly (such as your email address when you register or subscribe), as well as usage data collected automatically (such as pages visited and browser type) via analytics tools.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">How We Use Your Data</h2>
          <p className="mb-6">We use your data to provide and improve our services, send newsletters you have opted into, and comply with legal obligations. We do not sell your personal data to third parties.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Cookies</h2>
          <p className="mb-6">We use cookies for authentication, analytics, and advertising. You can manage cookie preferences in your browser settings. See our <Link to="/cookies" className="text-accent hover:underline">Cookie Policy</Link> for details.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Your Rights</h2>
          <p className="mb-6">Depending on your location, you may have the right to access, correct, delete, or export your personal data. To exercise these rights, contact <strong>privacy@lensainsignia.com</strong>.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Data Retention</h2>
          <p className="mb-6">We retain personal data for as long as your account is active or as required by law. You may request deletion of your account and associated data at any time.</p>
        </>
      )
    },
    "Cookie Policy": {
      description: "Learn how Lensa Insignia uses cookies and similar technologies on our website.",
      body: (
        <>
          <p className="text-sm text-ink-light mb-8">Last updated: January 1, 2025</p>
          <p className="text-xl leading-relaxed mb-6">
            <span className="float-left text-7xl font-black leading-none pr-3 pt-2 text-ink">C</span>ookies are small text files stored on your device when you visit a website. This policy explains how Lensa Insignia uses cookies and your choices regarding them.
          </p>
          <h2 className="text-2xl font-black mt-8 mb-3">Essential Cookies</h2>
          <p className="mb-6">These cookies are required for the site to function — for example, to keep you logged in. You cannot opt out of essential cookies.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Analytics Cookies</h2>
          <p className="mb-6">We use analytics tools to understand how readers use our site. This helps us improve content and user experience. Analytics data is aggregated and anonymized.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Advertising Cookies</h2>
          <p className="mb-6">We display advertising on our site. Ad partners may set cookies to serve relevant ads based on your interests. You can opt out of interest-based advertising via your browser settings or through industry opt-out tools.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Managing Cookies</h2>
          <p className="mb-6">You can control and delete cookies through your browser settings. Note that disabling cookies may affect the functionality of certain parts of the site.</p>
        </>
      )
    },
    "Accessibility": {
      description: "Lensa Insignia's commitment to digital accessibility and how to report accessibility issues.",
      body: (
        <>
          <p className="text-xl leading-relaxed mb-6">
            <span className="float-left text-7xl font-black leading-none pr-3 pt-2 text-ink">L</span>ensa Insignia is committed to making our website accessible to all users, including those with disabilities. We work to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.
          </p>
          <h2 className="text-2xl font-black mt-8 mb-3">Our Commitment</h2>
          <p className="mb-6">We continuously review our site for accessibility barriers and work to resolve them. This includes providing text alternatives for images, ensuring keyboard navigability, and maintaining sufficient color contrast.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Known Limitations</h2>
          <p className="mb-6">Some third-party content embedded on our site (such as advertising or social media widgets) may not fully conform to accessibility standards. We work with our partners to improve this.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Reporting Issues</h2>
          <p className="mb-6">If you experience an accessibility barrier on our site, please contact us at <strong>accessibility@lensainsignia.com</strong>. Include the URL of the page and a description of the issue. We aim to respond within 5 business days.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Alternative Formats</h2>
          <p className="mb-6">If you require content in an alternative format, please contact us and we will do our best to accommodate your request.</p>
        </>
      )
    },
    "Newsletters": {
      description: "Subscribe to Lensa Insignia newsletters. Get the top headlines and breaking news delivered to your inbox.",
      body: (
        <>
          <p className="text-xl leading-relaxed mb-6">
            <span className="float-left text-7xl font-black leading-none pr-3 pt-2 text-ink">S</span>tay informed with Lensa Insignia newsletters. Choose the digest that fits your interests and have the most important stories delivered directly to your inbox.
          </p>
          <h2 className="text-2xl font-black mt-8 mb-3">The Morning Briefing</h2>
          <p className="mb-6">Our flagship daily newsletter. The top 5 stories you need to know before 9am, curated by our editors. Sent every weekday morning.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Weekend Edition</h2>
          <p className="mb-6">A longer read for your weekend. In-depth features, analysis, and the week's most important investigations — delivered every Saturday.</p>
          <h2 className="text-2xl font-black mt-8 mb-3">Tech & Science Digest</h2>
          <p className="mb-6">The latest developments in technology, science, and health. Sent every Tuesday and Thursday.</p>
          <p className="mb-6">To subscribe, register for a free account and manage your newsletter preferences in your profile.</p>
        </>
      )
    },
  };

  const page = content[title] ?? {
    description: `Learn more about ${title} at Lensa Insignia.`,
    body: <p className="text-xl text-ink-light">Content coming soon.</p>
  };

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <SEO title={title} description={page.description} />
      <div className="w-full flex justify-center mb-8">
        <AdSlot width="728px" height="90px" className="hidden md:flex" />
        <AdSlot width="300px" height="250px" className="flex md:hidden" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col">
          <header className="mb-8">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
              {title}
            </h1>
            <div className="editorial-divider-thick"></div>
          </header>

          <div className="prose prose-lg max-w-none font-serif text-ink leading-relaxed">
            {page.body}
          </div>

          <div className="w-full py-8 mt-8 border-t border-border flex justify-center">
             <AdSlot width="100%" height="150px" format="fluid" />
          </div>
        </div>

        <Sidebar />
      </div>
    </main>
  );
};

function AppContent({ initialArticles }: { initialArticles?: any[] }) {
  const { user, role, logout } = useAuth();
  const [articles, setArticles] = useState<any[]>(initialArticles ?? ARTICLES);
  const [loading, setLoading] = useState(initialArticles ? false : true);
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  // SSR hydration guard: defer client-only UI (e.g. admin floating button)
  // until after mount so server and client first-render match exactly.
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const fetchArticles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .limit(50);
      if (error) throw error;
      const fetched = data || [];
      
      // Sort on client side to avoid excluding documents without createdAt
      fetched.sort((a: any, b: any) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });

      if (fetched.length > 0) {
        // Only show published articles to users
        const publishedArticles = fetched.filter((a: any) => a.status === 'published');
        setArticles(publishedArticles.length > 0 ? publishedArticles : fetched);
      } else {
        setArticles(ARTICLES);
      }
    } catch (e) {
      console.error("Error fetching articles:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If the server already provided initialArticles (SSR hydration), skip the
    // initial fetch to avoid a data-change immediately after mount that would
    // cause content differences between server HTML and the first client render.
    // The refetch() function on ArticleContext can still be called explicitly.
    if (initialArticles && initialArticles.length > 0) return;
    fetchArticles();
  }, [fetchArticles, initialArticles]);

  return (
    <ArticleContext.Provider value={{ articles, loading, refetch: fetchArticles }}>
      <>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col relative">
          <Header />
          <React.Suspense fallback={
            <main className="flex-1 flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black"></div>
            </main>
          }>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/article/:id" element={<ArticlePage />} />

            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* User */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/become-a-writer" element={<BecomeWriterPage />} />

            {/* Staff dashboards */}
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/admin" element={<DashboardPage />} />

            {/* Legacy redirect — /admin still works */}
            <Route path="/admin" element={<DashboardPage />} />

            {/* Category pages */}
            <Route path="/author/:name" element={<AuthorPage />} />
            <Route path="/saved" element={<BookmarksPage />} />
            <Route path="/category/:slug" element={<CategoryPage />} />

            {/* Tools */}
            <Route path="/tools/stockfinder" element={<StockFinderPage />} />

            {/* Static pages */}
            <Route path="/newsletters" element={<StaticPage title="Newsletters" />} />
            <Route path="/about" element={<StaticPage title="Our Story" />} />
            <Route path="/careers" element={<StaticPage title="Careers" />} />
            <Route path="/ethics" element={<StaticPage title="Journalistic Ethics" />} />
            <Route path="/contact" element={<StaticPage title="Contact Us" />} />
            <Route path="/terms" element={<StaticPage title="Terms of Service" />} />
            <Route path="/privacy" element={<StaticPage title="Privacy Policy" />} />
            <Route path="/cookies" element={<StaticPage title="Cookie Policy" />} />
            <Route path="/accessibility" element={<StaticPage title="Accessibility" />} />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </React.Suspense>
          <Footer />

          {/* Floating Spark Button & Board Panel for Admin / Dev */}
          {isClient && user && (role === 'admin' || role === 'dev') && (
            <>
              {/* Spark Button in bottom corner */}
              <button 
                onClick={() => setIsBoardOpen(true)}
                className="fixed bottom-6 right-6 z-50 p-4 rounded-full text-white shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center group cursor-pointer border-0"
                style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #EF4444 100%)', boxShadow: '0 10px 25px -5px rgba(139, 92, 246, 0.4)' }}
                title="Admin / Dev Panel"
                id="spark-button"
              >
                <Sparkles className="w-6 h-6 text-white" />
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-in-out whitespace-nowrap text-xs font-bold ml-0 group-hover:ml-2 text-white">
                  Access Board
                </span>
              </button>

              {/* Special Board Panel Overlay */}
              {isBoardOpen && (
                <div 
                  className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end transition-opacity duration-300"
                  onClick={() => setIsBoardOpen(false)}
                >
                  <div 
                    className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col transition-transform duration-300"
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Header */}
                    <div className="p-6 flex justify-between items-center text-white animate-fade-in" style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #1E1B4B 100%)' }}>
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-6 h-6 text-yellow-300" />
                        <div>
                          <h2 className="font-serif font-black text-xl tracking-tight text-white">Control Hub</h2>
                          <p className="text-xs text-purple-200">System Mode: {role.toUpperCase()}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setIsBoardOpen(false)}
                        className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer border-0 bg-transparent"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* Active User profile card */}
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Authenticated User</span>
                        <div className="flex items-center space-x-3">
                          <div className="p-2.5 bg-purple-100 rounded-full text-purple-700">
                            <ShieldAlert className="w-6 h-6" />
                          </div>
                          <div className="overflow-hidden">
                            <div className="font-bold text-gray-900 text-sm truncate max-w-[280px]">{user.email}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 font-bold">
                              <span className="inline-block w-2.5 h-2.5 bg-green-500 rounded-full"></span> Role: <span className="font-semibold text-purple-700 capitalize">{role}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Navigation list */}
                      <div>
                        <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">System Navigation</span>
                        <div className="grid grid-cols-2 gap-3">
                          <Link 
                            to="/admin" 
                            onClick={() => setIsBoardOpen(false)}
                            className="p-4 bg-purple-50 border border-purple-100 rounded-lg hover:bg-purple-100 hover:border-purple-200 transition-all text-center flex flex-col items-center justify-center gap-2 group cursor-pointer text-decoration-none"
                          >
                            <Activity className="w-6 h-6 text-purple-750 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold text-purple-900">Articles Panel</span>
                          </Link>
                          <Link 
                            to="/admin" 
                            state={{ tab: 'users' }}
                            onClick={() => setIsBoardOpen(false)}
                            className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 hover:border-indigo-200 transition-all text-center flex flex-col items-center justify-center gap-2 group cursor-pointer text-decoration-none"
                          >
                            <Users className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold text-indigo-900">User Manager</span>
                          </Link>
                        </div>
                      </div>

                      {/* Developer specific promo board */}
                      {role === 'dev' && (
                        <div className="border border-red-200 bg-red-50/50 p-4 rounded-lg space-y-3">
                          <div className="flex items-center space-x-2 text-red-700">
                            <Award className="w-5 h-5 font-bold" />
                            <span className="text-sm font-bold">Developer Promotion Tools</span>
                          </div>
                          <p className="text-xs text-gray-600 leading-normal">
                            You have Developer credentials. You can view all users, modify roles, and promote any user directly to **Admin** or **Dev** status.
                          </p>
                          <Link 
                            to="/admin"
                            state={{ tab: 'users' }}
                            onClick={() => setIsBoardOpen(false)}
                            className="w-full block text-center bg-red-650 hover:bg-red-750 text-white py-2 rounded text-xs font-bold transition-all shadow-sm text-decoration-none"
                          >
                            Promote Users to Admin
                          </Link>
                        </div>
                      )}

                      {/* Live System Stats */}
                      <div>
                        <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Live Statistics</span>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg divide-y divide-gray-200">
                          <div className="p-3.5 flex justify-between items-center text-sm">
                            <span className="text-gray-600 flex items-center gap-1.5"><FileText className="w-4 h-4 text-gray-400" /> Active Articles</span>
                            <span className="font-bold text-gray-900">{articles.length}</span>
                          </div>
                          <div className="p-3.5 flex justify-between items-center text-sm">
                            <span className="text-gray-600 flex items-center gap-1.5"><ShieldAlert className="w-4 h-4 text-gray-400" /> Clearance Level</span>
                            <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-bold uppercase">{role}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-150 bg-gray-50 text-center">
                      <button 
                        onClick={async () => { await logout(); setIsBoardOpen(false); }}
                        className="text-red-650 hover:text-red-800 font-bold text-sm flex items-center justify-center gap-1.5 w-full py-2.5 border border-red-200 hover:bg-red-50 rounded transition-colors cursor-pointer bg-transparent"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out from System
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </>
    </ArticleContext.Provider>
  );
}

export default function App({ initialArticles }: { initialArticles?: any[] } = {}) {
  return (
    <HelmetProvider>
      <AuthProvider>
        <Router>
          <AppContent initialArticles={initialArticles} />
        </Router>
      </AuthProvider>
    </HelmetProvider>
  );
}

/**
 * AppSSR — used by the server entry (entry-server.tsx).
 * StaticRouter, HelmetProvider, and AuthProvider are provided externally,
 * so this just renders the article context + content routes.
 */
export function AppSSR({ initialArticles }: { initialArticles?: any[] }) {
  return <AppContent initialArticles={initialArticles} />;
}
