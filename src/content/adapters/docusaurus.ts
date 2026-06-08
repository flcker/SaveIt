import type { SiteAdapter } from './interface';
import type { NavNode } from '@/shared/types';
import { createNavNode, normalizeUrl } from './interface';

export const docusaurusAdapter: SiteAdapter = {
  name: 'docusaurus',

  detect(): boolean {
    return !!(
      document.getElementById('__docusaurus') ||
      document.querySelector('meta[name="generator"][content*="Docusaurus"]')
    );
  },

  async getNavTree(): Promise<NavNode[]> {
    // Try to read from sidebar DOM — Docusaurus renders the full sidebar
    const sidebar = document.querySelector(
      '.theme-doc-sidebar-menu, [class*="sidebarViewport"] ul, .menu__list'
    );
    if (sidebar) {
      return parseSidebarList(sidebar);
    }
    return [];
  },

  getContentSelector(): string {
    return '.theme-doc-markdown, [class*="docMainContainer"] article, main article';
  },

  getExpandStrategy(): 'click-toggle' | 'spa-route' | 'none' {
    return 'click-toggle';
  },
};

function parseSidebarList(container: Element, depth: number = 0): NavNode[] {
  const baseUrl = location.href;
  const items = container.querySelectorAll(':scope > li');
  const nodes: NavNode[] = [];

  for (const item of items) {
    const link = item.querySelector(':scope > a, :scope > div > a');
    const href = link?.getAttribute('href');
    const title = link?.textContent?.trim() || item.querySelector(':scope > .menu__link, :scope > div')?.textContent?.trim() || '';

    const url = href ? (normalizeUrl(href, baseUrl) || '') : '';

    // Check for sub-items
    const subList = item.querySelector(':scope > ul, :scope > .menu__list');
    const children = subList ? parseSidebarList(subList, depth + 1) : [];

    if (title) {
      nodes.push(createNavNode(url, title, depth, children));
    }
  }

  return nodes;
}
