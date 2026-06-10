import type { SiteAdapter } from './interface';
import type { NavNode } from '@/shared/types';
import { createNavNode, normalizeUrl } from './interface';

export const gitbookAdapter: SiteAdapter = {
  name: 'gitbook',

  detect(): boolean {
    return !!(
      document.querySelector('meta[name="generator"][content*="GitBook"]') ||
      document.querySelector('[class*="gitbook"]') ||
      document.querySelector('.book-summary')
    );
  },

  async getNavTree(): Promise<NavNode[]> {
    // Try __NEXT_DATA__ first (modern GitBook)
    const globals = await getGlobals();
    if (globals.__NEXT_DATA__) {
      const nodes = parseNextDataNav(globals.__NEXT_DATA__);
      if (nodes.length > 0) return nodes;
    }

    // Fallback: parse DOM sidebar
    const sidebar =
      document.querySelector('.book-summary') ||
      document.querySelector('[class*="sidebar"]') ||
      document.querySelector('nav');
    if (!sidebar) return [];

    return parseSidebarDom(sidebar);
  },

  getContentSelector(): string {
    return '.book-body section.normal, .book-body .page-wrapper, main[class*="page"], .markdown-section';
  },

  getExpandStrategy(): 'click-toggle' | 'spa-route' | 'none' {
    return 'spa-route';
  },
};

function getGlobals(): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    const handler = (event: Event) => {
      window.removeEventListener('__saveit_globals', handler);
      resolve((event as CustomEvent).detail || {});
    };
    window.addEventListener('__saveit_globals', handler);
    window.dispatchEvent(new CustomEvent('__saveit_request_globals'));
    setTimeout(() => {
      window.removeEventListener('__saveit_globals', handler);
      resolve({});
    }, 500);
  });
}

function parseNextDataNav(nextData: any): NavNode[] {
  try {
    const pages = nextData?.props?.pageProps?.space?.structure?.pages;
    if (!Array.isArray(pages)) return [];
    return parsePages(pages, location.origin, 0);
  } catch {
    return [];
  }
}

function parsePages(pages: any[], baseUrl: string, depth: number): NavNode[] {
  const nodes: NavNode[] = [];
  for (const page of pages) {
    const url = page.path ? new URL(page.path, baseUrl).href : '';
    const children = page.pages ? parsePages(page.pages, baseUrl, depth + 1) : [];
    nodes.push(createNavNode(url, page.title || '', depth, children));
  }
  return nodes;
}

function parseSidebarDom(sidebar: Element): NavNode[] {
  const baseUrl = location.href;
  const origin = new URL(baseUrl).origin;
  const chapters = sidebar.querySelectorAll('li.chapter a[href]');
  const nodes: NavNode[] = [];

  for (const anchor of chapters) {
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('http') && !href.startsWith(origin)) continue;
    if (anchor.getAttribute('target') === 'blank') continue;

    const url = normalizeUrl(href, baseUrl);
    if (!url) continue;

    const title = anchor.textContent?.trim().replace(/^\d+\.\s*/, '') || '';
    if (!title) continue;

    const li = anchor.closest('li.chapter');
    const level = li?.getAttribute('data-level') || '0';
    const depth = level.split('.').length - 1;

    nodes.push(createNavNode(url, title, depth));
  }
  return nodes;
}
