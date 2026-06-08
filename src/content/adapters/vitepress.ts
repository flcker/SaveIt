import type { SiteAdapter } from './interface';
import type { NavNode } from '@/shared/types';
import { discoverFromConfig } from '../strategies/config';

export const vitepressAdapter: SiteAdapter = {
  name: 'vitepress',

  detect(): boolean {
    return !!(
      document.querySelector('.VPDoc') ||
      document.querySelector('.vp-doc') ||
      document.getElementById('VPContent') ||
      document.querySelector('[class*="VPSidebar"]')
    );
  },

  async getNavTree(): Promise<NavNode[]> {
    // VitePress exposes sidebar config in __VP_SITE_DATA__
    const globals = await getVitePressGlobals();
    if (globals.__VP_SITE_DATA__) {
      const result = await discoverFromConfig(globals);
      if (result.nodes.length > 0) return result.nodes;
    }

    // Fallback: parse DOM sidebar
    const sidebar = document.querySelector('.VPSidebar, [class*="VPSidebar"]');
    if (!sidebar) return [];

    return parseSidebarDom(sidebar);
  },

  getContentSelector(): string {
    return '.VPDoc .vp-doc, .VPContent, #VPContent';
  },

  getExpandStrategy(): 'click-toggle' | 'spa-route' | 'none' {
    return 'spa-route';
  },
};

function getVitePressGlobals(): Promise<Record<string, any>> {
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

function parseSidebarDom(sidebar: Element): NavNode[] {
  const items = sidebar.querySelectorAll('.VPSidebarItem, [class*="sidebar-item"]');
  const nodes: NavNode[] = [];
  const baseUrl = location.href;

  for (const item of items) {
    const link = item.querySelector('a[href]');
    if (!link) continue;
    const href = link.getAttribute('href');
    if (!href) continue;

    try {
      const url = new URL(href, baseUrl).href;
      const title = link.textContent?.trim() || '';
      nodes.push({ url, title, depth: 0, children: [], isExpanded: false, selected: true });
    } catch {
      continue;
    }
  }

  return nodes;
}
