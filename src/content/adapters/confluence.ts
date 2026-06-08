import type { SiteAdapter } from './interface';
import type { NavNode } from '@/shared/types';
import { createNavNode } from './interface';

export const confluenceAdapter: SiteAdapter = {
  name: 'confluence',

  detect(): boolean {
    return !!(
      document.querySelector('meta[name="confluence-space-key"]') ||
      location.pathname.includes('/wiki/spaces/') ||
      document.querySelector('#com-atlassian-confluence') ||
      document.querySelector('[data-testid="page-tree"]')
    );
  },

  async getNavTree(): Promise<NavNode[]> {
    // Try to get space key
    const spaceKey = getSpaceKey();
    if (!spaceKey) return parseDomTree();

    // Try Confluence REST API
    try {
      const pages = await fetchPageTree(spaceKey);
      if (pages.length > 0) return pages;
    } catch {
      // API not available, fall back to DOM
    }

    return parseDomTree();
  },

  getContentSelector(): string {
    return '#main-content, [data-testid="page-content"], .wiki-content, #content .page-body';
  },

  getExpandStrategy(): 'click-toggle' | 'spa-route' | 'none' {
    return 'click-toggle';
  },
};

function getSpaceKey(): string | null {
  // From meta tag
  const meta = document.querySelector('meta[name="confluence-space-key"]');
  if (meta) return meta.getAttribute('content');

  // From URL
  const match = location.pathname.match(/\/wiki\/spaces\/([^/]+)/);
  if (match) return match[1];

  return null;
}

async function fetchPageTree(spaceKey: string): Promise<NavNode[]> {
  const baseUrl = location.origin;
  const apiUrl = `${baseUrl}/wiki/rest/api/space/${spaceKey}/content?type=page&expand=ancestors&limit=200`;

  const response = await fetch(apiUrl, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) return [];

  const data = await response.json();
  if (!data.page?.results) return [];

  const pages = data.page.results;
  return pages.map((page: any) => {
    const url = `${baseUrl}/wiki${page._links?.webui || `/spaces/${spaceKey}/pages/${page.id}`}`;
    return createNavNode(url, page.title || '', 0);
  });
}

function parseDomTree(): NavNode[] {
  const baseUrl = location.href;
  const navContainer =
    document.querySelector('[data-testid="page-tree"]') ||
    document.querySelector('.acs-side-bar .page-tree') ||
    document.querySelector('#splitter-sidebar .plugin_pagetree');
  if (!navContainer) return [];

  const links = navContainer.querySelectorAll('a[href]');
  const nodes: NavNode[] = [];

  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href || href === '#') continue;
    try {
      const url = new URL(href, baseUrl).href;
      const title = link.textContent?.trim() || '';
      if (title && url.includes('/wiki/')) {
        nodes.push(createNavNode(url, title, 0));
      }
    } catch {
      continue;
    }
  }

  return nodes;
}
