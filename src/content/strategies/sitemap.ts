import type { DiscoveryResult } from '../adapters/interface';
import { createNavNode, isSameOrigin, isHtmlUrl } from '../adapters/interface';

export async function discoverFromSitemap(): Promise<DiscoveryResult> {
  const baseUrl = location.origin;

  const urls = await fetchSitemapUrls(baseUrl);
  if (urls.length < 3) {
    return { nodes: [], confidence: 0, source: 'sitemap' };
  }

  const nodes = urls
    .filter((url) => isSameOrigin(url, baseUrl) && isHtmlUrl(url))
    .map((url) => {
      const path = new URL(url).pathname;
      const depth = path.split('/').filter(Boolean).length - 1;
      const title = path.split('/').filter(Boolean).pop() || 'Home';
      return createNavNode(url, decodeURIComponent(title), Math.min(depth, 5));
    });

  return {
    nodes,
    confidence: nodes.length >= 5 ? 0.9 : 0.6,
    source: 'sitemap',
  };
}

async function fetchSitemapUrls(origin: string): Promise<string[]> {
  const urls: string[] = [];

  // Try sitemap index first
  const indexUrls = [
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap.xml`,
  ];

  for (const sitemapUrl of indexUrls) {
    try {
      const response = await fetch(sitemapUrl, { credentials: 'include' });
      if (!response.ok) continue;

      const text = await response.text();
      if (!text.includes('<urlset') && !text.includes('<sitemapindex')) continue;

      // Check if it's a sitemap index
      if (text.includes('<sitemapindex')) {
        const locMatches = text.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g);
        for (const match of locMatches) {
          const childUrls = await fetchSingleSitemap(match[1]);
          urls.push(...childUrls);
        }
      } else {
        // Direct sitemap
        const locMatches = text.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g);
        for (const match of locMatches) {
          urls.push(match[1]);
        }
      }

      if (urls.length > 0) break;
    } catch {
      continue;
    }
  }

  return [...new Set(urls)];
}

async function fetchSingleSitemap(url: string): Promise<string[]> {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return [];
    const text = await response.text();
    const urls: string[] = [];
    const matches = text.matchAll(/<loc>\s*(.*?)\s*<\/loc>/g);
    for (const match of matches) {
      urls.push(match[1]);
    }
    return urls;
  } catch {
    return [];
  }
}
