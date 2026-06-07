/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// src/App.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import { Search, Menu, ChevronRight, Mail, Share2, Twitter, Facebook, Linkedin, Link as LinkIcon, X, CheckCircle2, LogOut, Sparkles, Users, FileText, Activity, ShieldAlert, Award } from 'lucide-react';
import AdminDashboard from './pages/AdminDashboard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import BecomeWriterPage from './pages/BecomeWriterPage';
import DashboardPage from './pages/DashboardPage';
import CategoryPage from './pages/CategoryPage';
import NotFoundPage from './pages/NotFoundPage';
import { supabase } from './lib/supabase';
import MDEditor from '@uiw/react-md-editor';
import { AuthProvider, useAuth } from './components/AuthProvider';

// --- Global Context for Articles ---
export const ArticleContext = React.createContext<{ articles: any[], loading: boolean, refetch: () => Promise<void> }>({
  articles: [],
  loading: true,
  refetch: async () => {}
});

export const useArticles = () => React.useContext(ArticleContext);

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
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
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
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
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

const AdSlot = ({ width, height, format = "auto", className = "" }: { width?: string, height?: string, format?: string, className?: string }) => {
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
};

// SEO Component
const SEO = ({ title, description, url, imageUrl, type = 'website', author, datePublished, schemaMarkup }: { title: string, description: string, url?: string, imageUrl?: string, type?: string, author?: string, datePublished?: string, schemaMarkup?: object }) => {
  const siteTitle = 'Lensa Insignia';
  const fullTitle = title === siteTitle ? title : `${title} | ${siteTitle}`;
  
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      {url && <link rel="canonical" href={url} />}
      
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      {url && <meta property="og:url" content={url} />}
      {imageUrl && <meta property="og:image" content={imageUrl} />}
      
      {type === 'article' && author && <meta property="article:author" content={author} />}
      {type === 'article' && datePublished && <meta property="article:published_time" content={datePublished} />}

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

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname, search } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);
  return null;
};

const Header = () => {
  const { user, role, logout } = useAuth();
  const date = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
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
    if (queryStr === 'admin123123') {
      navigate('/admin');
      setIsSearchOpen(false);
      setSearchQuery('');
      return;
    }
    if (queryStr) {
      navigate(`/?q=${encodeURIComponent(queryStr)}`);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
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
                {role === 'user' && (
                  <Link to="/profile" className="text-accent font-bold hover:underline">
                    My Profile
                  </Link>
                )}
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
              <li><Link to="/?category=World" className="hover:text-white transition-colors">World News</Link></li>
              <li><Link to="/?category=Politics" className="hover:text-white transition-colors">Politics</Link></li>
              <li><Link to="/?category=Business" className="hover:text-white transition-colors">Business & Tech</Link></li>
              <li><Link to="/?category=Science" className="hover:text-white transition-colors">Science & Health</Link></li>
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
      <div className="flex justify-center">
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
              <Link to={`/article/${article.id}`} className="flex items-start">
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
      
      <div className="sticky top-32 flex justify-center mt-4">
        <AdSlot width="300px" height="600px" />
      </div>
    </aside>
  );
};

const HomePage = () => {
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category');
  const query = searchParams.get('q');
  const { articles } = useArticles();

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
        const titleCat = `${a.title} ${a.category}`.toLowerCase();
        const contentFallback = a.contentStr || (a.contentArr ? a.contentArr.join(' ') : (a.content ? a.content.join(' ') : ''));
        const fullText = `${a.title} ${a.subtitle} ${a.excerpt} ${a.category} ${contentFallback}`.toLowerCase();
        
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
  }, [category, query]);

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
    "url": window.location.origin,
    "logo": {
      "@type": "ImageObject",
      "url": `${window.location.origin}/logo.png`
    },
    "description": seoDescription
  };

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <SEO title={seoTitle} description={seoDescription} url={window.location.href} schemaMarkup={!isFiltering ? organizationSchema : undefined} />
      <div className="w-full flex justify-center mb-8">
        <AdSlot width="728px" height="90px" className="hidden md:flex" />
        <AdSlot width="320px" height="50px" className="flex md:hidden" />
      </div>
      
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
                <Link key={article.id} to={`/article/${article.id}`} className="group cursor-pointer block">
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
                    <div className="mt-auto text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2 border-t border-border">
                      {article.time}
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          ) : (
            // Default Complex Layout
            <>
              {filteredArticles.length > 0 && (
                <Link to={`/article/${filteredArticles[0].id}`} className="group cursor-pointer block">
                  <article>
                    <div className="relative overflow-hidden mb-4 rounded-sm">
                      {filteredArticles[0].imageUrl ? (
                        <img 
                          src={filteredArticles[0].imageUrl} 
                          alt={filteredArticles[0].title}
                          loading="eager"
                          decoding="async"
                          width="1200"
                          height="800"
                          className="w-full h-[400px] object-cover transform group-hover:scale-105 transition-transform duration-700 bg-gray-100"
                          referrerPolicy="no-referrer"
                        />
                      ) : null}
                      <div className="absolute top-4 left-4 bg-accent text-white text-xs font-bold uppercase tracking-wider px-2 py-1">
                        {filteredArticles[0].category}
                      </div>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-bold mb-3 group-hover:text-accent transition-colors leading-tight">
                      {filteredArticles[0].title}
                    </h2>
                    <p className="text-ink-light text-lg mb-4 leading-relaxed">
                      {filteredArticles[0].excerpt}
                    </p>
                    <div className="flex items-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <span className="text-ink">{filteredArticles[0].author}</span>
                      <span className="mx-2">•</span>
                      <span>{filteredArticles[0].time}</span>
                    </div>
                  </article>
                </Link>
              )}
              
              <div className="editorial-divider-thick"></div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filteredArticles.slice(1, 5).map((article) => (
                  <Link key={article.id} to={`/article/${article.id}`} className="group cursor-pointer block">
                    <article className="flex flex-col h-full">
                      <div className="overflow-hidden mb-3 rounded-sm">
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
                        ) : null}
                      </div>
                      <div className="text-xs font-bold text-accent uppercase tracking-wider mb-2">
                        {article.category}
                      </div>
                      <h3 className="text-xl font-bold mb-2 group-hover:text-accent transition-colors leading-snug">
                        {article.title}
                      </h3>
                      <div className="mt-auto text-xs font-semibold text-gray-500 uppercase tracking-wider pt-2">
                        {article.time}
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </>
          )}
          
          <div className="w-full py-6 border-y border-border my-4 flex justify-center">
             <AdSlot width="100%" height="150px" format="fluid" />
          </div>
        </div>
        
        <Sidebar />
      </div>
    </main>
  );
};

const ArticlePage = () => {
  const { id } = useParams();
  const [copied, setCopied] = useState(false);
  const { articles, loading } = useArticles();
  
  const article = articles.find(a => a.id === id);

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
    const url = encodeURIComponent(window.location.href);
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
      navigator.clipboard.writeText(window.location.href);
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
        url={window.location.href}
        imageUrl={article.imageUrl}
        author={article.author}
        datePublished={article.date}
        schemaMarkup={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          "headline": article.title,
          "image": [article.imageUrl],
          "datePublished": new Date(article.date).toISOString(),
          "dateModified": new Date(article.date).toISOString(),
          "author": [{
              "@type": "Person",
              "name": article.author,
              "jobTitle": article.role
          }],
          "publisher": {
              "@type": "Organization",
              "name": "Lensa Insignia",
              "logo": {
                  "@type": "ImageObject",
                  "url": `${window.location.origin}/logo.png`
              }
          },
          "description": article.excerpt
        }}
      />
      <div className="w-full flex justify-center mb-8">
        <AdSlot width="728px" height="90px" className="hidden md:flex" />
        <AdSlot width="320px" height="50px" className="flex md:hidden" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col">
          
          <header className="mb-8">
            <Link to={`/?category=${article.category}`} className="text-accent font-bold uppercase tracking-wider text-sm mb-4 inline-block hover:underline">
              {article.category}
            </Link>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-6 leading-tight">
              {article.title}
            </h1>
            <p className="text-xl text-ink-light mb-6 font-serif italic">
              {article.subtitle}
            </p>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 border-y border-border gap-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${article.author}`} alt={article.author} loading="lazy" decoding="async" width="48" height="48" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="font-bold text-ink">{article.author}</div>
                  <div className="text-xs text-ink-light">{article.role}</div>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end space-x-6">
                <div className="text-sm font-semibold text-ink-light uppercase tracking-wider">
                  {article.date}
                </div>
                <div className="flex space-x-2 sm:space-x-3 relative text-ink">
                  <button onClick={() => handleShare('twitter')} className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-[#1DA1F2] hover:text-white transition-colors" aria-label="Share on Twitter"><Twitter className="w-4 h-4" /></button>
                  <button onClick={() => handleShare('facebook')} className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-[#4267B2] hover:text-white transition-colors" aria-label="Share on Facebook"><Facebook className="w-4 h-4" /></button>
                  <button onClick={() => handleShare('linkedin')} className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-[#0077B5] hover:text-white transition-colors" aria-label="Share on LinkedIn"><Linkedin className="w-4 h-4" /></button>
                  <button onClick={() => handleShare('copy')} className="flex items-center space-x-2 px-4 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors relative" aria-label="Copy Link">
                    <LinkIcon className="w-4 h-4" />
                    <span className="text-sm font-semibold hidden sm:inline-block">Copy Link</span>
                    {copied && (
                      <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-ink text-paper text-xs px-3 py-1.5 rounded-sm whitespace-nowrap animate-in fade-in slide-in-from-bottom-2">
                        Link Copied!
                      </span>
                    )}
                  </button>
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
            <div className="my-10 flex justify-center float-right ml-8 mb-4">
              <AdSlot width="300px" height="250px" />
            </div>

            {article.contentStr ? (
              <MDEditor.Markdown source={article.contentStr} />
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

          <div className="w-full py-8 mt-8 border-t border-border flex justify-center">
             <AdSlot width="100%" height="150px" format="fluid" />
          </div>

          {relatedArticles.length > 0 && (
            <div className="mt-8 pt-8 border-t-4 border-ink">
              <h3 className="text-2xl font-black font-serif uppercase tracking-wider mb-8 text-ink">Related Articles</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                {relatedArticles.map((related) => (
                  <Link key={related.id} to={`/article/${related.id}`} className="group block h-full flex flex-col">
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
  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <SEO title={title} description={`Learn more about ${title} at Lensa Insignia.`} url={window.location.href} />
      <div className="w-full flex justify-center mb-8">
        <AdSlot width="728px" height="90px" className="hidden md:flex" />
        <AdSlot width="320px" height="50px" className="flex md:hidden" />
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
            <p className="text-xl leading-relaxed mb-6">
              <span className="float-left text-7xl font-black leading-none pr-3 pt-2 text-ink">L</span>orem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
            </p>
            
            <div className="my-10 flex justify-center float-right ml-8 mb-4">
              <AdSlot width="300px" height="250px" />
            </div>

            <p className="mb-6">
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
            </p>

            <blockquote className="border-l-4 border-accent pl-6 py-2 my-8 text-2xl italic font-serif text-ink-light">
              "Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem."
            </blockquote>

            <p className="mb-6">
              Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
            </p>
            <p className="mb-6">
              Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?
            </p>
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

function AppContent() {
  const { user, role, logout } = useAuth();
  const [articles, setArticles] = useState<any[]>(ARTICLES);
  const [loading, setLoading] = useState(true);
  const [isBoardOpen, setIsBoardOpen] = useState(false);

  const fetchArticles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*');
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
        const publishedArticles = fetched.filter((a: any) => a.status !== 'archived');
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
    fetchArticles();
  }, [fetchArticles]);

  return (
    <ArticleContext.Provider value={{ articles, loading, refetch: fetchArticles }}>
      <Router>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col relative">
          <Header />
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
            <Route path="/category/:slug" element={<CategoryPage />} />

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
          <Footer />

          {/* Floating Spark Button & Board Panel for Admin / Dev */}
          {user && (role === 'admin' || role === 'dev') && (
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
      </Router>
    </ArticleContext.Provider>
  );
}

export default function App() {
  return (
    <HelmetProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </HelmetProvider>
  );
}
