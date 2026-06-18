/**
 * StockFinder AI — Visual Stock Photo Recommendation Tool
 *
 * Paste an article URL → AI reads the content → suggests 3-6 stock photo
 * concepts with direct search links to Unsplash, Pexels, and Pixabay.
 *
 * Access is gated by API keys managed from the Admin Dashboard.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  Sparkles, Search, ExternalLink, AlertCircle, CheckCircle2,
  KeyRound, ArrowLeft, Loader2, Image, X, Copy, Check, Shield
} from 'lucide-react';
import styles from './StockFinderPage.module.css';

// ── Types ──
interface PhotoConcept {
  idea: string;
  whyItWorks: string;
  searchQuery: string;
  previewUrl: string;
}

interface AnalysisResult {
  summary: string;
  concepts: PhotoConcept[];
  articleTitle: string;
}

interface KeyValidation {
  valid: boolean;
  label: string;
  remainingToday: number;
  dailyLimit: number;
}

// ── Provider Helpers ──
const buildUnsplashUrl = (q: string) =>
  `https://unsplash.com/s/photos/${encodeURIComponent(q)}`;
const buildPexelsUrl = (q: string) =>
  `https://www.pexels.com/search/${encodeURIComponent(q)}/`;
const buildPixabayUrl = (q: string) =>
  `https://pixabay.com/images/search/${encodeURIComponent(q.replace(/\s+/g, '+'))}/`;
const buildPreviewUrl = (q: string) =>
  `https://loremflickr.com/640/400/${encodeURIComponent(q.replace(/\s+/g, ','))}?random=${Math.floor(Math.random() * 1000)}`;

// ── Component ──
const StockFinderPage: React.FC = () => {
  // API key state
  const [apiKey, setApiKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [keyValidation, setKeyValidation] = useState<KeyValidation | null>(null);
  const [validatingKey, setValidatingKey] = useState(false);
  const [keyError, setKeyError] = useState('');

  // Analyzer state
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');

  // UI state
  const [copiedQuery, setCopiedQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Restore saved key from localStorage on mount ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('sf_api_key');
    if (saved) {
      setApiKey(saved);
      validateKey(saved);
    }
  }, []);

  // ── Validate API Key ──
  const validateKey = useCallback(async (key: string) => {
    if (!key.trim()) return;
    setValidatingKey(true);
    setKeyError('');
    try {
      const res = await fetch('/api/stockfinder/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key.trim() }),
      });
      const data: KeyValidation = await res.json();
      if (data.valid) {
        setApiKey(key.trim());
        setKeyValidation(data);
        if (typeof window !== 'undefined') {
          localStorage.setItem('sf_api_key', key.trim());
        }
      } else {
        setKeyError('Invalid or expired API key');
        setKeyValidation(null);
      }
    } catch {
      setKeyError('Connection error. Please try again.');
    } finally {
      setValidatingKey(false);
    }
  }, []);

  const handleKeySubmit = () => {
    validateKey(keyInput);
  };

  const handleKeyLogout = () => {
    setApiKey('');
    setKeyInput('');
    setKeyValidation(null);
    setResult(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sf_api_key');
    }
  };

  // ── Analyze URL ──
  const handleAnalyze = useCallback(async () => {
    if (!url.trim() || !apiKey) return;

    // Basic URL validation
    try {
      new URL(url.trim());
    } catch {
      setError('Please enter a valid URL (e.g., https://example.com/article)');
      return;
    }

    setAnalyzing(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/stockfinder/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), apiKey }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(errData.error || `Server error (${res.status})`);
      }

      const data = await res.json();

      // Attach preview URLs to each concept
      const enriched: AnalysisResult = {
        ...data,
        concepts: (data.concepts || []).map((c: PhotoConcept) => ({
          ...c,
          previewUrl: buildPreviewUrl(c.searchQuery),
        })),
      };

      setResult(enriched);

      // Refresh remaining quota
      if (keyValidation) {
        setKeyValidation(prev => prev ? {
          ...prev,
          remainingToday: Math.max(0, prev.remainingToday - 1),
        } : null);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setAnalyzing(false);
    }
  }, [url, apiKey, keyValidation]);

  // Copy search query to clipboard
  const copyQuery = (query: string) => {
    navigator.clipboard.writeText(query);
    setCopiedQuery(query);
    setTimeout(() => setCopiedQuery(null), 2000);
  };

  const isAuthenticated = !!apiKey && !!keyValidation?.valid;

  return (
    <div className={styles.stockfinderRoot}>
      <Helmet>
        <title>StockFinder AI — Smart Stock Photo Discovery | Lensa Insignia</title>
        <meta name="description" content="Paste any article URL and let AI suggest the perfect stock photos. Get targeted search queries for Unsplash, Pexels, and Pixabay instantly." />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Helmet>

      {/* Animated Background */}
      <div className={styles.bgGlow} />
      <div className={styles.particles}>
        {[...Array(8)].map((_, i) => (
          <div key={i} className={styles.particle} />
        ))}
      </div>

      <div className={styles.container}>
        {/* ── Header ── */}
        <header className={styles.header}>
          <div className={styles.logo}>
            <div className={styles.logoIcon}>
              <Image size={22} color="white" />
            </div>
            <div>
              <div className={styles.logoText}>StockFinder AI</div>
              <div className={styles.logoSub}>by Lensa Insignia</div>
            </div>
          </div>
          <Link to="/" className={styles.backLink}>
            <ArrowLeft size={16} /> Back to Lensa
          </Link>
        </header>

        {/* ── Hero ── */}
        <section className={styles.hero}>
          <div className={styles.heroBadge}>
            <Sparkles size={14} />
            Powered by Gemini AI
          </div>
          <h1 className={styles.heroTitle}>
            Find the Perfect Stock Photo<br />in Seconds
          </h1>
          <p className={styles.heroDesc}>
            Paste any article URL and let AI analyze the content, mood, and context.
            Get 3-6 targeted photo concepts with direct search links to free stock photo providers.
          </p>
        </section>

        {/* ── API Key Gate ── */}
        <div className={styles.keyGate}>
          {!isAuthenticated ? (
            <>
              <div className={styles.keyInputWrap}>
                <input
                  type="password"
                  className={styles.keyInput}
                  placeholder="Enter your API key..."
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleKeySubmit()}
                  disabled={validatingKey}
                />
                <button
                  className={styles.keyBtn}
                  onClick={handleKeySubmit}
                  disabled={!keyInput.trim() || validatingKey}
                >
                  {validatingKey ? <Loader2 size={16} className={styles.spinner} style={{ border: 'none', width: 16, height: 16, margin: 0 }} /> : <KeyRound size={16} />}
                  {validatingKey ? 'Verifying...' : 'Activate'}
                </button>
              </div>
              {keyError && (
                <div className={`${styles.keyStatus} ${styles.keyInvalid}`}>
                  <AlertCircle size={14} /> {keyError}
                </div>
              )}
            </>
          ) : (
            <>
              <div className={`${styles.keyStatus} ${styles.keyValid}`}>
                <CheckCircle2 size={14} />
                Connected as <strong>{keyValidation.label || 'Authorized User'}</strong>
              </div>
              <div className={styles.keyInfo}>
                <span>{keyValidation.remainingToday} / {keyValidation.dailyLimit} analyses remaining today</span>
                <button className={styles.keyLogout} onClick={handleKeyLogout}>
                  Disconnect
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── URL Analyzer (only if authenticated) ── */}
        {isAuthenticated ? (
          <section className={styles.analyzerSection}>
            <div className={styles.analyzerCard}>
              <div className={styles.analyzerLabel}>Article URL</div>
              <div className={styles.analyzerInputRow}>
                <input
                  ref={inputRef}
                  type="url"
                  className={styles.analyzerInput}
                  placeholder="https://example.com/your-article-to-analyze"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
                  disabled={analyzing}
                />
                <button
                  className={styles.analyzeBtn}
                  onClick={handleAnalyze}
                  disabled={!url.trim() || analyzing || (keyValidation?.remainingToday ?? 0) <= 0}
                >
                  {analyzing ? (
                    <>
                      <Loader2 size={18} />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Search size={18} />
                      Analyze
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className={styles.errorCard}>
                <AlertCircle size={18} className={styles.errorIcon} />
                <div>{error}</div>
              </div>
            )}

            {/* Loading State */}
            {analyzing && (
              <div className={styles.loadingOverlay}>
                <div className={styles.spinner} />
                <div className={styles.loadingText}>AI is reading and analyzing the article...</div>
                <div className={styles.loadingSubtext}>This usually takes 5-15 seconds</div>
              </div>
            )}

            {/* Loading Skeleton */}
            {analyzing && (
              <div className={styles.skeletonGrid}>
                {[1, 2, 3].map(i => (
                  <div key={i} className={styles.skeletonCard}>
                    <div className={styles.skeletonImage} />
                    <div className={styles.skeletonBody}>
                      <div className={styles.skeletonLine} />
                      <div className={styles.skeletonLine} />
                      <div className={styles.skeletonLine} />
                      <div className={styles.skeletonLine} />
                      <div className={styles.skeletonLine} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            {result && !analyzing && (
              <>
                {/* Summary */}
                <div className={styles.summaryCard}>
                  <div className={styles.summaryLabel}>
                    📄 Article Summary — {result.articleTitle || 'Untitled'}
                  </div>
                  <p className={styles.summaryText}>{result.summary}</p>
                </div>

                {/* Concept Cards */}
                <h2 className={styles.resultsTitle}>
                  🎯 Photo Concepts ({result.concepts.length})
                </h2>
                <p className={styles.resultsSubtitle}>
                  Click any provider button to search directly for the suggested photo.
                </p>

                <div className={styles.cardsGrid}>
                  {result.concepts.map((concept, idx) => (
                    <div key={idx} className={styles.conceptCard}>
                      <img
                        className={styles.conceptImage}
                        src={concept.previewUrl}
                        alt={concept.idea}
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            `https://placehold.co/640x400/1a1a2e/7c3aed?text=${encodeURIComponent(concept.searchQuery)}`;
                        }}
                      />
                      <div className={styles.conceptBody}>
                        <div className={styles.conceptNumber}>Concept {idx + 1}</div>
                        <h3 className={styles.conceptIdea}>{concept.idea}</h3>
                        <p className={styles.conceptWhy}>{concept.whyItWorks}</p>

                        <button
                          className={styles.conceptQuery}
                          onClick={() => copyQuery(concept.searchQuery)}
                          title="Click to copy search query"
                        >
                          <Search size={12} />
                          {concept.searchQuery}
                          {copiedQuery === concept.searchQuery ? (
                            <Check size={12} />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>

                        <div className={styles.providerButtons}>
                          <a
                            href={buildUnsplashUrl(concept.searchQuery)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.providerBtn} ${styles.providerUnsplash}`}
                          >
                            Unsplash <ExternalLink size={12} />
                          </a>
                          <a
                            href={buildPexelsUrl(concept.searchQuery)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.providerBtn} ${styles.providerPexels}`}
                          >
                            Pexels <ExternalLink size={12} />
                          </a>
                          <a
                            href={buildPixabayUrl(concept.searchQuery)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.providerBtn} ${styles.providerPixabay}`}
                          >
                            Pixabay <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        ) : !validatingKey && !apiKey && (
          /* ── No Access State ── */
          <div className={styles.noAccessCard}>
            <div className={styles.noAccessIcon}>
              <Shield size={32} />
            </div>
            <h2 className={styles.noAccessTitle}>API Key Required</h2>
            <p className={styles.noAccessDesc}>
              StockFinder AI requires a valid API key to operate.
              Enter your key above, or contact the administrator to request access.
            </p>
            <Link to="/contact" className={styles.contactBtn}>
              <KeyRound size={16} />
              Request Access
            </Link>
          </div>
        )}

        {/* ── Footer ── */}
        <footer className={styles.footer}>
          <p>
            StockFinder AI — Part of{' '}
            <Link to="/" className={styles.footerLink}>
              Lensa Insignia
            </Link>
            {' '}toolkit
          </p>
        </footer>
      </div>
    </div>
  );
};

export default StockFinderPage;
