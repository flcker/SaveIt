import type { SiteAdapter } from './interface';
import type { NavNode } from '@/shared/types';
import { discoverFromDom, getNavRoot } from '../strategies/dom';
import { expandNavTree } from '../tree-expander';

export const genericAdapter: SiteAdapter = {
  name: 'generic',

  detect(): boolean {
    // Generic adapter is always available as fallback
    return true;
  },

  async getNavTree(): Promise<NavNode[]> {
    // First try DOM discovery
    const domResult = discoverFromDom();
    if (domResult.nodes.length === 0) return [];

    // Try to expand collapsed items
    const navRoot = getNavRoot();
    if (navRoot) {
      try {
        const expanded = await expandNavTree(navRoot);
        if (expanded.length > 0) return expanded;
      } catch {
        // fallback to DOM result
      }
    }

    return domResult.nodes;
  },

  getContentSelector(): string {
    // Try common selectors in order
    const selectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post-content'];
    for (const sel of selectors) {
      if (document.querySelector(sel)) return sel;
    }
    return 'body';
  },

  getExpandStrategy(): 'click-toggle' | 'spa-route' | 'none' {
    return 'click-toggle';
  },
};
