import type { NavNode } from '@/shared/types';
import type { SiteAdapter } from './adapters/interface';
import { vitepressAdapter } from './adapters/vitepress';
import { docusaurusAdapter } from './adapters/docusaurus';
import { gitbookAdapter } from './adapters/gitbook';
import { mkdocsAdapter } from './adapters/mkdocs';
import { confluenceAdapter } from './adapters/confluence';
import { genericAdapter } from './adapters/generic';
import { discoverFromSitemap } from './strategies/sitemap';

const ADAPTERS: SiteAdapter[] = [
  vitepressAdapter,
  docusaurusAdapter,
  gitbookAdapter,
  mkdocsAdapter,
  confluenceAdapter,
  genericAdapter,
];

export async function discoverNavigation(): Promise<{
  nodes: NavNode[];
  source: string;
}> {
  // Detect which adapter applies
  for (const adapter of ADAPTERS) {
    if (!adapter.detect()) continue;

    try {
      const nodes = await adapter.getNavTree();
      if (nodes.length > 0) {
        return { nodes, source: adapter.name };
      }
    } catch {
      continue;
    }
  }

  // Fallback: try sitemap
  try {
    const result = await discoverFromSitemap();
    if (result.nodes.length >= 3) {
      return { nodes: result.nodes, source: 'sitemap' };
    }
  } catch {
    // no sitemap
  }

  return { nodes: [], source: 'none' };
}
