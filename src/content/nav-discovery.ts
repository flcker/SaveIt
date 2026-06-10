import type { NavNode } from '@/shared/types';
import type { SiteAdapter } from './adapters/interface';
import { vitepressAdapter } from './adapters/vitepress';
import { docusaurusAdapter } from './adapters/docusaurus';
import { gitbookAdapter } from './adapters/gitbook';
import { mkdocsAdapter } from './adapters/mkdocs';
import { confluenceAdapter } from './adapters/confluence';
import { talcloudAdapter } from './adapters/talcloud';
import { genericAdapter } from './adapters/generic';
import { discoverFromSitemap } from './strategies/sitemap';

const ADAPTERS: SiteAdapter[] = [
  vitepressAdapter,
  docusaurusAdapter,
  gitbookAdapter,
  mkdocsAdapter,
  confluenceAdapter,
  talcloudAdapter,
  genericAdapter,
];

export interface DiscoveryLog {
  adapter: string;
  detected: boolean;
  nodeCount: number;
  error?: string;
}

export async function discoverNavigation(): Promise<{
  nodes: NavNode[];
  source: string;
  logs: DiscoveryLog[];
}> {
  const logs: DiscoveryLog[] = [];

  // Try each adapter in order
  for (const adapter of ADAPTERS) {
    let detected = false;
    try {
      detected = adapter.detect();
    } catch {
      logs.push({ adapter: adapter.name, detected: false, nodeCount: 0, error: 'detect() threw' });
      continue;
    }

    if (!detected) {
      logs.push({ adapter: adapter.name, detected: false, nodeCount: 0 });
      continue;
    }

    try {
      const nodes = await adapter.getNavTree();
      logs.push({ adapter: adapter.name, detected: true, nodeCount: nodes.length });
      if (nodes.length > 0) {
        return { nodes, source: adapter.name, logs };
      }
    } catch (err) {
      logs.push({ adapter: adapter.name, detected: true, nodeCount: 0, error: String(err) });
      continue;
    }
  }

  // Fallback: sitemap
  try {
    const result = await discoverFromSitemap();
    logs.push({ adapter: 'sitemap', detected: true, nodeCount: result.nodes.length });
    if (result.nodes.length >= 3) {
      return { nodes: result.nodes, source: 'sitemap', logs };
    }
  } catch (err) {
    logs.push({ adapter: 'sitemap', detected: false, nodeCount: 0, error: String(err) });
  }

  return { nodes: [], source: 'none', logs };
}
