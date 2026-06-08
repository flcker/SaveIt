import type { SiteAdapter } from './interface';
import type { NavNode } from '@/shared/types';
import { createNavNode, normalizeUrl } from './interface';

export const mkdocsAdapter: SiteAdapter = {
  name: 'mkdocs',

  detect(): boolean {
    return !!(
      document.querySelector('meta[name="generator"][content*="MkDocs"]') ||
      document.querySelector('meta[name="generator"][content*="mkdocs"]') ||
      document.querySelector('.md-sidebar') ||
      document.querySelector('.wy-nav-side')
    );
  },

  async getNavTree(): Promise<NavNode[]> {
    // MkDocs renders the full navigation statically
    const sidebar =
      document.querySelector('.md-sidebar--primary .md-nav') ||
      document.querySelector('.wy-nav-side .wy-menu') ||
      document.querySelector('.md-sidebar nav') ||
      document.querySelector('nav.md-nav--primary');
    if (!sidebar) return [];

    return parseMkDocsSidebar(sidebar, 0);
  },

  getContentSelector(): string {
    return '.md-content, .document [role="main"], article.md-content__inner';
  },

  getExpandStrategy(): 'click-toggle' | 'spa-route' | 'none' {
    // MkDocs uses full page loads, not SPA
    return 'none';
  },
};

function parseMkDocsSidebar(container: Element, depth: number): NavNode[] {
  const baseUrl = location.href;
  const nodes: NavNode[] = [];

  // MkDocs Material uses nested nav > ul > li structure
  const items = container.querySelectorAll(':scope > ul > li, :scope > li');

  for (const item of items) {
    const link = item.querySelector(':scope > a, :scope > label > a, :scope > .md-nav__link');
    const href = link?.getAttribute('href');
    const title = link?.textContent?.trim() || '';

    const url = href ? (normalizeUrl(href, baseUrl) || '') : '';

    // Check for nested nav
    const childNav = item.querySelector(':scope > nav, :scope > ul');
    const children = childNav ? parseMkDocsSidebar(childNav, depth + 1) : [];

    if (title) {
      nodes.push(createNavNode(url, title, depth, children));
    }
  }

  return nodes;
}
