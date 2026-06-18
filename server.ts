/**
 * SSR Express server for Lensa Insignia.
 *
 * Development:   npm run dev:ssr
 * Production:    npm run build:ssr && npm run serve
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import http from 'node:http';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 3000;

async function createServer() {
  const app = express();

  // ── Supabase Reverse Proxy ──
  // Proxies /rest/v1, /auth/v1, /storage/v1 to the local Supabase instance
  // so external users (via Cloudflare Tunnel) can reach it.
  const SUPABASE_LOCAL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54821';
  const supabaseProxy: express.RequestHandler = (req, res) => {
    const targetUrl = new URL(req.originalUrl, SUPABASE_LOCAL);
    const options: http.RequestOptions = {
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: { ...req.headers, host: targetUrl.host },
    };
    const proxyReq = http.request(options, (proxyRes) => {
      // Forward CORS headers for browser requests
      res.writeHead(proxyRes.statusCode || 500, {
        ...proxyRes.headers,
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': '*',
      });
      proxyRes.pipe(res, { end: true });
    });
    proxyReq.on('error', (err) => {
      console.error('[Supabase Proxy] Error:', err.message);
      if (!res.headersSent) res.status(502).json({ error: 'Supabase proxy error' });
    });
    req.pipe(proxyReq, { end: true });
  };
  // Handle CORS preflight
  app.options(['/rest/v1/*', '/auth/v1/*', '/storage/v1/*', '/realtime/v1/*'], (req, res) => {
    res.set({
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
    }).sendStatus(204);
  });
  app.use(['/rest/v1', '/auth/v1', '/storage/v1', '/realtime/v1'], supabaseProxy);

  // ── Scheduled Article Auto-Publisher ──
  // Every 60 seconds, publish articles whose scheduled_at has passed
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  const publishScheduled = async () => {
    try {
      const now = new Date().toISOString();
      const url = `${SUPABASE_LOCAL}/rest/v1/articles?status=eq.scheduled&scheduled_at=lte.${now}&select=id,title`;
      const listRes = await fetch(url, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
      });
      if (!listRes.ok) return;
      const due: any[] = await listRes.json();
      if (due.length === 0) return;

      // Bulk update to published
      const patchUrl = `${SUPABASE_LOCAL}/rest/v1/articles?status=eq.scheduled&scheduled_at=lte.${now}`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          status: 'published',
          published_at: now,
        }),
      });
      if (patchRes.ok) {
        console.log(`[Scheduler] Auto-published ${due.length} article(s): ${due.map(a => a.title).join(', ')}`);
      }
    } catch (e: any) {
      // Silent fail — scheduler runs in background
      console.warn('[Scheduler] Error:', e.message);
    }
  };
  // Run every 60 seconds
  setInterval(publishScheduled, 60_000);
  // Also run once on startup after a short delay
  setTimeout(publishScheduled, 5_000);

  let vite: any;

  if (!isProduction) {
    // Development: use Vite's dev server as middleware
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve pre-built static files
    const compression = (await import('compression')).default;
    const sirv = (await import('sirv')).default;
    app.use(compression());
    app.use('/assets', sirv(path.resolve(__dirname, 'dist/client/assets'), { extensions: [] }));
    app.use(sirv(path.resolve(__dirname, 'dist/client'), { extensions: [] }));
  }

  /** Robust XML escaping for sitemaps — strips control chars, newlines, tabs */
  function xmlEscape(str: string): string {
    return str
      .replace(/[\x00-\x1F\x7F]/g, ' ')  // strip control chars (newlines, tabs, etc.)
      .replace(/\s+/g, ' ')               // collapse whitespace
      .trim()
      .replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;'
      }[m] || m));
  }

  /** Build a minimal sitemap with static pages only (fallback when DB is unavailable). */
  function buildStaticSitemap(): string {
    const siteUrl = process.env.SITE_URL || 'http://localhost:3000';
    const CATEGORIES = ['World','Politics','Business','Tech','Science','Health','Sports','Arts','Opinion'];
    const staticPages = ['about','careers','ethics','contact','terms','privacy','cookies','accessibility','newsletters'];
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url><loc>${siteUrl}/</loc><priority>1.0</priority><changefreq>hourly</changefreq></url>\n`;
    for (const cat of CATEGORIES) xml += `  <url><loc>${siteUrl}/category/${cat.toLowerCase()}</loc><priority>0.8</priority><changefreq>daily</changefreq></url>\n`;
    for (const page of staticPages) xml += `  <url><loc>${siteUrl}/${page}</loc><priority>0.5</priority><changefreq>monthly</changefreq></url>\n`;
    xml += `</urlset>`;
    return xml;
  }

  // --- OG Image Generator ---
  // Generate social share card images for articles: GET /og/:articleId.png
  const ogCache = new Map<string, { buffer: Buffer; ts: number }>();
  const OG_CACHE_TTL = 3600_000; // 1 hour
  const OG_MAX_CACHE = 100;

  app.get('/og/:articleId.png', async (req, res) => {
    try {
      const { articleId } = req.params;

      // Check cache
      const cached = ogCache.get(articleId);
      if (cached && Date.now() - cached.ts < OG_CACHE_TTL) {
        res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
        return res.send(cached.buffer);
      }

      // Fetch article from Supabase
      const supabaseUrl = process.env.VITE_SUPABASE_URL || SUPABASE_LOCAL;
      const articleRes = await fetch(
        `${supabaseUrl}/rest/v1/articles?id=eq.${articleId}&select=title,category,author,date,excerpt`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
          },
        }
      );

      if (!articleRes.ok) return res.status(404).send('Not found');
      const articles: any[] = await articleRes.json();
      if (articles.length === 0) return res.status(404).send('Not found');

      const article = articles[0];
      const title = (article.title || 'Untitled').slice(0, 100);
      const category = (article.category || '').toUpperCase();
      const author = article.author || '';
      const date = article.date || '';

      // Word-wrap title into lines
      const maxCharsPerLine = 32;
      const words = title.split(' ');
      const lines: string[] = [];
      let currentLine = '';
      for (const word of words) {
        if ((currentLine + ' ' + word).trim().length > maxCharsPerLine && currentLine) {
          lines.push(currentLine.trim());
          currentLine = word;
        } else {
          currentLine = currentLine ? currentLine + ' ' + word : word;
        }
      }
      if (currentLine.trim()) lines.push(currentLine.trim());
      const titleLines = lines.slice(0, 3); // Max 3 lines

      // XML-escape for SVG
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      const titleSvg = titleLines.map((line, i) =>
        `<text x="80" y="${260 + i * 70}" font-family="Georgia, serif" font-size="56" font-weight="bold" fill="white">${esc(line)}</text>`
      ).join('\n');

      const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f0f0f"/>
      <stop offset="50%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#b91c1c"/>
      <stop offset="100%" style="stop-color:#ef4444"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <!-- Accent bar top -->
  <rect x="0" y="0" width="1200" height="6" fill="url(#accent)"/>
  <!-- Category badge -->
  ${category ? `<rect x="80" y="80" width="${category.length * 14 + 32}" height="34" rx="4" fill="#b91c1c"/>
  <text x="96" y="103" font-family="Inter, sans-serif" font-size="14" font-weight="700" fill="white" letter-spacing="2">${esc(category)}</text>` : ''}
  <!-- Title -->
  ${titleSvg}
  <!-- Divider -->
  <rect x="80" y="${280 + titleLines.length * 70}" width="60" height="3" rx="1.5" fill="#b91c1c"/>
  <!-- Author & Date -->
  <text x="80" y="${330 + titleLines.length * 70}" font-family="Inter, sans-serif" font-size="22" fill="#a0a0a0">${esc(author)}${date ? ` · ${esc(date)}` : ''}</text>
  <!-- Branding -->
  <text x="80" y="580" font-family="Georgia, serif" font-size="28" font-weight="bold" fill="#555">Lensa Insignia</text>
  <text x="1120" y="580" font-family="Inter, sans-serif" font-size="14" fill="#444" text-anchor="end">lensainsignia.com</text>
  <!-- Bottom accent bar -->
  <rect x="0" y="624" width="1200" height="6" fill="url(#accent)"/>
</svg>`;

      // Convert SVG to PNG using sharp
      const sharpMod = await import('sharp');
      const sharpFn = sharpMod.default || sharpMod;
      const pngBuffer = await sharpFn(Buffer.from(svg))
        .png({ quality: 90 })
        .toBuffer();

      // Cache (LRU eviction)
      if (ogCache.size >= OG_MAX_CACHE) {
        const oldestKey = ogCache.keys().next().value;
        if (oldestKey) ogCache.delete(oldestKey);
      }
      ogCache.set(articleId, { buffer: pngBuffer, ts: Date.now() });

      res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
      res.send(pngBuffer);
    } catch (err: any) {
      console.error('[OG Image] Error:', err.message);
      res.status(500).send('OG image generation failed');
    }
  });

  // --- DEV ONLY: Google News RSS scraper for Daily Generator ---
  app.get('/api/scrape-news', async (req, res) => {
    const category = (req.query.category as string) || 'world';
    const hl = (req.query.hl as string) || 'en';
    const gl = (req.query.gl as string) || 'US';
    const ceid = (req.query.ceid as string) || 'US:en';

    // Localized search queries per language
    const searchMaps: Record<string, Record<string, string>> = {
      'id': {
        'World': 'berita dunia hari ini',
        'Politics': 'berita politik indonesia',
        'Business': 'berita bisnis ekonomi indonesia',
        'Tech': 'berita teknologi terbaru',
        'Science': 'berita sains penemuan',
        'Health': 'berita kesehatan indonesia',
        'Sports': 'berita olahraga indonesia',
        'Arts': 'berita seni budaya indonesia',
      },
      'ja': {
        'World': '世界ニュース 今日',
        'Politics': '政治ニュース',
        'Business': 'ビジネス 経済ニュース',
        'Tech': 'テクノロジーニュース',
        'Science': '科学ニュース',
        'Health': '健康 医療ニュース',
        'Sports': 'スポーツニュース',
        'Arts': '文化 芸術ニュース',
      },
      'ko': {
        'World': '세계 뉴스 오늘',
        'Politics': '정치 뉴스',
        'Business': '경제 비즈니스 뉴스',
        'Tech': '기술 뉴스',
        'Science': '과학 뉴스',
        'Health': '건강 의료 뉴스',
        'Sports': '스포츠 뉴스',
        'Arts': '문화 예술 뉴스',
      },
      'en': {
        'World': 'world news today',
        'Politics': 'politics news today',
        'Business': 'business economy finance news',
        'Tech': 'technology news today',
        'Science': 'science discovery news',
        'Health': 'health medical news today',
        'Sports': 'sports news today',
        'Arts': 'arts culture entertainment news',
      },
    };
    const categoryMap = searchMaps[hl] || searchMaps['en'];
    const query = categoryMap[category] || category + ' news';
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(rssUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LensaBot/1.0)' }
      });
      clearTimeout(timeout);
      const xml = await response.text();

      // Parse RSS items with regex
      const items: any[] = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
        const block = match[1];
        const getTag = (tag: string) => {
          const m = block.match(new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?\\s*</${tag}>`, 's'));
          return m ? m[1].trim() : '';
        };
        let title = getTag('title');
        // Google News titles often end with " - Source Name"
        const sourceSep = title.lastIndexOf(' - ');
        const source = sourceSep > 0 ? title.slice(sourceSep + 3) : '';
        if (sourceSep > 0) title = title.slice(0, sourceSep);

        const link = getTag('link');
        const pubDate = getTag('pubDate');
        const description = getTag('description')
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
          .replace(/<[^>]+>/g, '').trim();

        if (title) items.push({ title, source, link, pubDate, description });
      }

      res.json({ category, items });
    } catch (err: any) {
      console.error('[Scrape] Failed:', err.message);
      res.json({ category, items: [], error: err.message });
    }
  });

  // --- DEV ONLY: Fetch og:image from a URL ---
  app.get('/api/fetch-og-image', async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.json({ image: null });
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const r = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LensaBot/1.0)' },
        redirect: 'follow',
      });
      clearTimeout(timeout);
      const html = await r.text();
      const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
        || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
      res.json({ image: ogMatch ? ogMatch[1] : null });
    } catch {
      res.json({ image: null });
    }
  });

  // --- News Sitemap endpoint (Google News) — articles from last 48 hours only ---
  app.get('/news-sitemap.xml', async (_req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        res.header('Content-Type', 'application/xml').status(200).send(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n</urlset>`
        );
        return;
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Only articles from the last 48 hours, max 1000
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const { data: articles } = await supabase
        .from('articles')
        .select('id, slug, title, "createdAt"')
        .eq('status', 'published')
        .gte('createdAt', fortyEightHoursAgo)
        .order('createdAt', { ascending: false })
        .limit(1000);

      const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n`;

      if (articles && articles.length > 0) {
        for (const article of articles) {
          const pubDate = article.createdAt ? new Date(article.createdAt).toISOString() : new Date().toISOString();
          const escapedTitle = xmlEscape(article.title || '');

          xml += `  <url>\n`;
          xml += `    <loc>${siteUrl}/article/${article.slug || article.id}</loc>\n`;
          xml += `    <news:news>\n`;
          xml += `      <news:publication>\n`;
          xml += `        <news:name>Lensa Insignia</news:name>\n`;
          xml += `        <news:language>en</news:language>\n`;
          xml += `      </news:publication>\n`;
          xml += `      <news:publication_date>${pubDate}</news:publication_date>\n`;
          xml += `      <news:title>${escapedTitle}</news:title>\n`;
          xml += `    </news:news>\n`;
          xml += `  </url>\n`;
        }
      }

      xml += `</urlset>`;
      res.header('Content-Type', 'application/xml').send(xml);
    } catch (e) {
      console.error('[News Sitemap] Failed to generate:', e);
      res.status(500).header('Content-Type', 'application/xml').send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n</urlset>`
      );
    }
  });

  // --- Sitemap endpoint (SEO) ---
  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        res.header('Content-Type', 'application/xml').send(buildStaticSitemap());
        return;
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: articles } = await supabase
        .from('articles')
        .select('id, slug, title, "createdAt"')
        .eq('status', 'published')
        .order('createdAt', { ascending: false });

      const siteUrl = process.env.SITE_URL || 'http://localhost:3000';

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      xml += `  <url><loc>${siteUrl}/</loc><priority>1.0</priority><changefreq>hourly</changefreq></url>\n`;

      const CATEGORIES = ['World','Politics','Business','Tech','Science','Health','Sports','Arts','Opinion'];
      for (const cat of CATEGORIES) {
        xml += `  <url><loc>${siteUrl}/category/${cat.toLowerCase()}</loc><priority>0.8</priority><changefreq>daily</changefreq></url>\n`;
      }

      const staticPages = ['about','careers','ethics','contact','terms','privacy','cookies','accessibility','newsletters'];
      for (const page of staticPages) {
        xml += `  <url><loc>${siteUrl}/${page}</loc><priority>0.5</priority><changefreq>monthly</changefreq></url>\n`;
      }

      if (articles && articles.length > 0) {
        for (const article of articles) {
          const lastmod = article.createdAt ? new Date(article.createdAt).toISOString().split('T')[0] : '';
          xml += `  <url>\n    <loc>${siteUrl}/article/${article.slug || article.id}</loc>\n    <priority>0.9</priority>\n    <changefreq>weekly</changefreq>\n`;
          if (lastmod) xml += `    <lastmod>${lastmod}</lastmod>\n`;
          xml += `  </url>\n`;
        }
      }

      xml += `</urlset>`;
      res.header('Content-Type', 'application/xml').send(xml);
    } catch (e) {
      console.error('[Sitemap] Failed to generate:', e);
      res.status(500).header('Content-Type', 'application/xml').send(buildStaticSitemap());
    }
  });

  // ═══════════════════════════════════════════════════════════
  // StockFinder AI — API Endpoints
  // ═══════════════════════════════════════════════════════════

  /** SHA-256 hash helper for API key comparison */
  const hashKey = async (key: string): Promise<string> => {
    const { createHash } = await import('node:crypto');
    return createHash('sha256').update(key).digest('hex');
  };

  /** Validate an API key and return its record + daily usage */
  const validateStockfinderKey = async (apiKey: string) => {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.VITE_SUPABASE_URL || SUPABASE_LOCAL;
    const supabase = createClient(supabaseUrl, SUPABASE_KEY);

    const keyHash = await hashKey(apiKey);
    const { data: keyRow } = await supabase
      .from('stockfinder_api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (!keyRow) return null;

    // Check expiry
    if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) return null;

    // Count today's usage
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('stockfinder_usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('key_id', keyRow.id)
      .gte('created_at', todayStart.toISOString());

    const usedToday = count || 0;
    return { ...keyRow, usedToday, remainingToday: Math.max(0, keyRow.daily_limit - usedToday) };
  };

  // --- POST /api/stockfinder/validate-key ---
  app.post('/api/stockfinder/validate-key', express.json(), async (req, res) => {
    try {
      const { apiKey } = req.body;
      if (!apiKey) return res.json({ valid: false });

      const keyData = await validateStockfinderKey(apiKey);
      if (!keyData) return res.json({ valid: false });

      res.json({
        valid: true,
        label: keyData.label || '',
        remainingToday: keyData.remainingToday,
        dailyLimit: keyData.daily_limit,
      });
    } catch (err: any) {
      console.error('[StockFinder] validate-key error:', err.message);
      res.status(500).json({ valid: false, error: 'Validation failed' });
    }
  });

  // --- POST /api/stockfinder/analyze ---
  app.post('/api/stockfinder/analyze', express.json(), async (req, res) => {
    const startTime = Date.now();
    try {
      const { url: articleUrl, apiKey } = req.body;
      if (!articleUrl || !apiKey) {
        return res.status(400).json({ error: 'Missing url or apiKey' });
      }

      // 1. Validate API key
      const keyData = await validateStockfinderKey(apiKey);
      if (!keyData) {
        return res.status(401).json({ error: 'Invalid or expired API key' });
      }
      if (keyData.remainingToday <= 0) {
        return res.status(429).json({ error: `Daily limit reached (${keyData.daily_limit}/day). Try again tomorrow.` });
      }

      // 2. Check Gemini API key
      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey) {
        return res.status(500).json({ error: 'Gemini API key not configured on server' });
      }

      // 3. Scrape article content
      console.log(`[StockFinder] Scraping: ${articleUrl}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const fetchRes = await fetch(articleUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StockFinderAI/1.0)' },
        redirect: 'follow',
      });
      clearTimeout(timeout);

      if (!fetchRes.ok) {
        return res.status(400).json({ error: `Could not fetch article (HTTP ${fetchRes.status})` });
      }

      const html = await fetchRes.text();
      const cheerio = await import('cheerio');
      const $ = cheerio.load(html);

      // Remove non-content elements
      $('script, style, nav, header, footer, aside, iframe, form, .ad, .sidebar, .menu, .nav, .advertisement, .social-share, [role="navigation"], [role="banner"], [role="contentinfo"]').remove();

      // Extract title
      const articleTitle = $('h1').first().text().trim()
        || $('meta[property="og:title"]').attr('content')
        || $('title').text().trim()
        || 'Untitled';

      // Extract main text
      let articleText = '';
      $('article, [role="main"], .post-content, .article-body, .entry-content, .content, main').each((_, el) => {
        articleText += $(el).text() + '\n';
      });
      if (!articleText.trim()) {
        // Fallback: grab all <p> text
        $('p').each((_, el) => {
          articleText += $(el).text() + '\n';
        });
      }

      articleText = articleText.replace(/\s+/g, ' ').trim();
      if (articleText.length < 50) {
        return res.status(400).json({ error: 'Could not extract enough content from the article. The page might be JavaScript-rendered or blocked.' });
      }

      // Truncate to ~4000 chars for Gemini input
      const truncatedText = articleText.slice(0, 4000);

      // 4. Call Gemini AI
      console.log(`[StockFinder] Calling Gemini (text length: ${truncatedText.length})`);
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });

      const prompt = `You are a professional Photo Editor for a major publication. Analyze this article and suggest stock photos.

Article Title: ${articleTitle}
Article Text: ${truncatedText}

Provide your response as valid JSON with this exact structure (no markdown, no code fences):
{
  "summary": "A 2-3 sentence summary capturing the core topic and mood",
  "concepts": [
    {
      "idea": "Specific visual concept (e.g., 'A lone entrepreneur working at a laptop in a dimly lit coffee shop at night')",
      "whyItWorks": "Editorial/psychological reasoning for why this image strengthens the article",
      "searchQuery": "2-4 specific English keywords optimized for stock photo search engines"
    }
  ]
}

Rules:
- Generate 3-6 concepts, from most to least relevant
- Each "idea" must be vivid, specific, and cinematic — never generic
- Each "searchQuery" must be 2-4 English words that would return the best results on Unsplash/Pexels
- Each "whyItWorks" should explain the visual-editorial connection
- Respond ONLY with the JSON object, nothing else`;

      const geminiRes = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      // Parse Gemini response
      let responseText = geminiRes.text || '';
      // Strip code fences if present
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch {
        console.error('[StockFinder] Failed to parse Gemini response:', responseText.slice(0, 500));
        return res.status(500).json({ error: 'AI returned an invalid response. Please try again.' });
      }

      // 5. Log usage
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.VITE_SUPABASE_URL || SUPABASE_LOCAL;
      const supabase = createClient(supabaseUrl, SUPABASE_KEY);

      await supabase.from('stockfinder_usage_logs').insert({
        key_id: keyData.id,
        url_analyzed: articleUrl,
        article_title: articleTitle.slice(0, 255),
        concepts_count: parsed.concepts?.length || 0,
        processing_time_ms: Date.now() - startTime,
      });

      // Update total_uses and last_used_at
      await supabase.from('stockfinder_api_keys').update({
        total_uses: (keyData.total_uses || 0) + 1,
        last_used_at: new Date().toISOString(),
      }).eq('id', keyData.id);

      console.log(`[StockFinder] Analysis complete in ${Date.now() - startTime}ms — ${parsed.concepts?.length || 0} concepts`);

      res.json({
        summary: parsed.summary || '',
        concepts: parsed.concepts || [],
        articleTitle,
      });
    } catch (err: any) {
      console.error('[StockFinder] analyze error:', err.message);
      if (err.name === 'AbortError') {
        return res.status(408).json({ error: 'Article fetch timed out (15s). The site may be too slow or blocking scrapers.' });
      }
      res.status(500).json({ error: err.message || 'Analysis failed' });
    }
  });

  // --- StockFinder Admin: API Key Management ---
  // GET: list all keys | POST: create key | DELETE: revoke key
  app.get('/api/stockfinder/admin/keys', async (req, res) => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.VITE_SUPABASE_URL || SUPABASE_LOCAL;
      const supabase = createClient(supabaseUrl, SUPABASE_KEY);

      const { data: keys, error } = await supabase
        .from('stockfinder_api_keys')
        .select('id, key_prefix, label, is_active, daily_limit, total_uses, created_at, expires_at, last_used_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      res.json({ keys: keys || [] });
    } catch (err: any) {
      console.error('[StockFinder Admin] list keys error:', err.message);
      res.status(500).json({ error: 'Failed to list keys' });
    }
  });

  app.post('/api/stockfinder/admin/keys', express.json(), async (req, res) => {
    try {
      const { label, dailyLimit = 20, expiresAt } = req.body;
      const { randomBytes, createHash } = await import('node:crypto');

      // Generate a secure API key: sf_live_<32 random hex chars>
      const rawKey = `sf_live_${randomBytes(16).toString('hex')}`;
      const keyHash = createHash('sha256').update(rawKey).digest('hex');
      const keyPrefix = rawKey.slice(0, 12) + '...';

      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.VITE_SUPABASE_URL || SUPABASE_LOCAL;
      const supabase = createClient(supabaseUrl, SUPABASE_KEY);

      const { data, error } = await supabase.from('stockfinder_api_keys').insert({
        key_hash: keyHash,
        key_prefix: keyPrefix,
        label: label || '',
        daily_limit: dailyLimit,
        expires_at: expiresAt || null,
      }).select().single();

      if (error) throw error;

      // Return the full key ONLY this one time
      res.json({ key: rawKey, keyPrefix, id: data.id });
    } catch (err: any) {
      console.error('[StockFinder Admin] create key error:', err.message);
      res.status(500).json({ error: 'Failed to create key' });
    }
  });

  app.delete('/api/stockfinder/admin/keys/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.VITE_SUPABASE_URL || SUPABASE_LOCAL;
      const supabase = createClient(supabaseUrl, SUPABASE_KEY);

      const { error } = await supabase
        .from('stockfinder_api_keys')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error('[StockFinder Admin] revoke key error:', err.message);
      res.status(500).json({ error: 'Failed to revoke key' });
    }
  });

  app.patch('/api/stockfinder/admin/keys/:id', express.json(), async (req, res) => {
    try {
      const { id } = req.params;
      const { is_active, daily_limit, label } = req.body;
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.VITE_SUPABASE_URL || SUPABASE_LOCAL;
      const supabase = createClient(supabaseUrl, SUPABASE_KEY);

      const updates: any = {};
      if (typeof is_active === 'boolean') updates.is_active = is_active;
      if (typeof daily_limit === 'number') updates.daily_limit = daily_limit;
      if (typeof label === 'string') updates.label = label;

      const { error } = await supabase
        .from('stockfinder_api_keys')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (err: any) {
      console.error('[StockFinder Admin] update key error:', err.message);
      res.status(500).json({ error: 'Failed to update key' });
    }
  });

  // Catch-all: SSR render for every HTML request
  app.use('*', async (req, res) => {
    const url = req.originalUrl;
    const start = Date.now();
    console.log(`[SSR] Starting render for: ${url}`);

    // --- Simple 404 Detection Logic ---
    const CATEGORIES = ['world','politics','business','tech','science','health','sports','arts','opinion'];
    const staticPages = ['about','careers','ethics','contact','terms','privacy','cookies','accessibility','newsletters'];
    const authPages = ['login','register','profile','become-writer','dashboard','admin','saved'];
    
    const isRoot = url === '/';
    const isCategory = url.startsWith('/category/') && CATEGORIES.includes(url.split('/')[2]);
    const isArticle = url.startsWith('/article/'); // Dynamic, assume valid pattern for now
    const isAuthor = url.startsWith('/author/');   // Author profile pages
    const isStatic = staticPages.includes(url.slice(1));
    const isAuth = authPages.includes(url.slice(1));

    const isTools = url.startsWith('/tools/');
    const isValidRoute = isRoot || isCategory || isArticle || isAuthor || isStatic || isAuth || isTools;

    try {
      let template: string;
      let render: (url: string) => Promise<{ html: string; helmetContext: any; initialData: string }>;

      if (!isProduction) {
        template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        render = (await vite.ssrLoadModule('/src/entry-server.tsx')).render;
      } else {
        template = fs.readFileSync(path.resolve(__dirname, 'dist/client/index.html'), 'utf-8');
        render = (await import(pathToFileURL(path.resolve(__dirname, 'dist/server/entry-server.js')).href)).render;
      }

      console.log(`[SSR] Template & Render module ready: ${Date.now() - start}ms`);
      const { html: appHtml, helmetContext, initialData } = await render(url);
      console.log(`[SSR] RenderToString complete: ${Date.now() - start}ms`);

      // Build the inline script that seeds client-side state with SSR data
      const initialDataScript = `<script>window.__INITIAL_ARTICLES__ = ${initialData};</script>`;

      // Inject Helmet tags into <head>, replacing the static title placeholder
      let finalHtml = template;
      if (helmetContext) {
        const { title, meta, link, script } = helmetContext;
        const helmetTags = [
          title?.toString() ?? '',
          meta?.toString() ?? '',
          link?.toString() ?? '',
          script?.toString() ?? '',
        ].join('\n    ');

        finalHtml = finalHtml
          .replace('<title>Lensa Insignia</title>', helmetTags)
          .replace('<!--app-html-->', appHtml)
          .replace('</head>', `  ${initialDataScript}\n  </head>`);
      } else {
        finalHtml = finalHtml
          .replace('<!--app-html-->', appHtml)
          .replace('</head>', `  ${initialDataScript}\n  </head>`);
      }

      const duration = Date.now() - start;
      console.log(`[SSR] Total render time: ${duration}ms`);
      // Return 404 status if the route is invalid
      res.status(isValidRoute ? 200 : 404).set({ 'Content-Type': 'text/html' }).end(finalHtml);
    } catch (e: any) {
      if (!isProduction) vite?.ssrFixStacktrace(e);
      console.error(e.stack);
      res.status(500).end(e.stack);
    }
  });

  app.listen(port, () => {
    console.log(`\n🚀 Lensa Insignia SSR running at http://localhost:${port}`);
    console.log(`   Mode: ${isProduction ? 'production' : 'development'}\n`);
  });
}

createServer();
