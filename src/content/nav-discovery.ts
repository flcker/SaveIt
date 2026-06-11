import type { NavNode } from '@/shared/types';
import type { SiteAdapter } from './adapters/interface';
import { vitepressAdapter } from './adapters/vitepress';
import { docusaurusAdapter } from './adapters/docusaurus';
import { gitbookAdapter } from './adapters/gitbook';
import { mkdocsAdapter } from './adapters/mkdocs';
import { confluenceAdapter } from './adapters/confluence';
import { semiDesignAdapter } from './adapters/talcloud';
import { genericAdapter } from './adapters/generic';
import { discoverFromSitemap } from './strategies/sitemap';
import { getProbeScript, type ProbeResult } from './probe';
import { createNavNode } from './adapters/interface';

const ADAPTERS: SiteAdapter[] = [
  vitepressAdapter,
  docusaurusAdapter,
  gitbookAdapter,
  mkdocsAdapter,
  confluenceAdapter,
  semiDesignAdapter,
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
      console.log(`[SaveIt] ${adapter.name}: ${nodes.length} nodes, depths:`, [...new Set(nodes.map(n => n.depth))].sort());
      if (nodes.length > 0) {
        console.log(`[SaveIt] Using ${adapter.name}, returning ${nodes.length} nodes`);
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

  // Last resort: inject probe script into page to analyze DOM structure
  try {
    const probeResult = await runProbe();
    logs.push({ adapter: 'probe', detected: true, nodeCount: probeResult.links.length });
    if (probeResult.links.length > 0) {
      const nodes = probeResult.links.map((l) =>
        createNavNode(l.url, l.title, l.depth)
      );
      return { nodes, source: `probe(${probeResult.strategy})`, logs };
    }
  } catch (err) {
    logs.push({ adapter: 'probe', detected: false, nodeCount: 0, error: String(err) });
  }

  return { nodes: [], source: 'none', logs };
}

async function runProbe(): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    const id = '__saveit_probe_' + Date.now();

    // Listen for probe result
    const handler = (event: Event) => {
      const ce = event as CustomEvent;
      if (ce.detail?.id === id) {
        window.removeEventListener('__saveit_probe_result', handler);
        try {
          resolve(JSON.parse(ce.detail.data));
        } catch {
          reject(new Error('probe parse error'));
        }
      }
    };
    window.addEventListener('__saveit_probe_result', handler);

    // Inject probe script
    const script = document.createElement('script');
    script.textContent = `(function(){
      var result = ${getProbeScript()}
      window.dispatchEvent(new CustomEvent('__saveit_probe_result', {
        detail: { id: '${id}', data: result }
      }));
    })();`;
    (document.head || document.documentElement).appendChild(script);
    script.remove();

    // Timeout
    setTimeout(() => {
      window.removeEventListener('__saveit_probe_result', handler);
      reject(new Error('probe timeout'));
    }, 10000);
  });
}
