import type { NavNode } from '@/shared/types';
import type { DiscoveryResult } from '../adapters/interface';
import { createNavNode } from '../adapters/interface';

interface PageGlobals {
  __VP_SITE_DATA__?: any;
  __docusaurus?: any;
  __NEXT_DATA__?: any;
  gitbook?: any;
}

export async function discoverFromConfig(
  globals: PageGlobals
): Promise<DiscoveryResult> {
  // VitePress
  if (globals.__VP_SITE_DATA__) {
    const nodes = parseVitePressSidebar(globals.__VP_SITE_DATA__);
    if (nodes.length > 0) {
      return { nodes, confidence: 0.95, source: 'vitepress-config' };
    }
  }

  // Docusaurus
  if (globals.__docusaurus) {
    const nodes = parseDocusaurusData(globals.__docusaurus);
    if (nodes.length > 0) {
      return { nodes, confidence: 0.9, source: 'docusaurus-config' };
    }
  }

  // Next.js / GitBook
  if (globals.__NEXT_DATA__) {
    const nodes = parseNextData(globals.__NEXT_DATA__);
    if (nodes.length > 0) {
      return { nodes, confidence: 0.85, source: 'nextdata-config' };
    }
  }

  return { nodes: [], confidence: 0, source: 'config' };
}

function parseVitePressSidebar(siteData: any): NavNode[] {
  try {
    const data = siteData?.value || siteData;
    const sidebar = data?.themeConfig?.sidebar;
    if (!sidebar) return [];

    const baseUrl = location.origin;

    if (Array.isArray(sidebar)) {
      return parseSidebarItems(sidebar, baseUrl, 0);
    }

    // Object form: { '/guide/': [...], '/api/': [...] }
    const nodes: NavNode[] = [];
    for (const [prefix, items] of Object.entries(sidebar)) {
      if (Array.isArray(items)) {
        nodes.push(...parseSidebarItems(items, baseUrl, 0));
      } else if (typeof items === 'object' && items !== null) {
        const group = items as any;
        if (group.items) {
          const groupNode = createNavNode(
            '',
            group.text || prefix,
            0,
            parseSidebarItems(group.items, baseUrl, 1)
          );
          nodes.push(groupNode);
        }
      }
    }
    return nodes;
  } catch {
    return [];
  }
}

function parseSidebarItems(items: any[], baseUrl: string, depth: number): NavNode[] {
  const nodes: NavNode[] = [];
  for (const item of items) {
    if (typeof item === 'string') {
      const url = new URL(item, baseUrl).href;
      nodes.push(createNavNode(url, item, depth));
    } else if (item && typeof item === 'object') {
      const title = item.text || item.title || '';
      const link = item.link;
      const children = item.items || item.children || [];

      const childNodes = children.length > 0
        ? parseSidebarItems(children, baseUrl, depth + 1)
        : [];

      const url = link ? new URL(link, baseUrl).href : '';
      nodes.push(createNavNode(url, title, depth, childNodes));
    }
  }
  return nodes;
}

function parseDocusaurusData(docData: any): NavNode[] {
  try {
    // Docusaurus stores sidebar in various ways
    // Try to find it in the page props or global data
    const allDocs = docData?.globalData?.['docusaurus-plugin-content-docs']?.default?.allDocs;
    if (Array.isArray(allDocs)) {
      const baseUrl = location.origin;
      return allDocs.map((doc: any) => {
        const url = new URL(doc.path || doc.permalink || '', baseUrl).href;
        return createNavNode(url, doc.title || doc.id || '', 0);
      });
    }
    return [];
  } catch {
    return [];
  }
}

function parseNextData(nextData: any): NavNode[] {
  try {
    // GitBook uses Next.js — structure is in pageProps
    const pageProps = nextData?.props?.pageProps;
    if (!pageProps) return [];

    const space = pageProps.space;
    if (space?.structure) {
      return parseGitBookStructure(space.structure, location.origin);
    }

    return [];
  } catch {
    return [];
  }
}

function parseGitBookStructure(structure: any, baseUrl: string): NavNode[] {
  if (!structure?.pages) return [];

  const nodes: NavNode[] = [];
  for (const page of structure.pages) {
    const url = page.path ? new URL(page.path, baseUrl).href : '';
    const children = page.pages
      ? parseGitBookStructure({ pages: page.pages }, baseUrl)
      : [];
    nodes.push(createNavNode(url, page.title || '', 0, children));
  }
  return nodes;
}
