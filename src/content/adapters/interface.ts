import type { NavNode } from '@/shared/types';

export interface SiteAdapter {
  readonly name: string;
  detect(): boolean;
  getNavTree(): Promise<NavNode[]>;
  getContentSelector(): string;
  getExpandStrategy(): 'click-toggle' | 'spa-route' | 'none';
}

export interface DiscoveryResult {
  nodes: NavNode[];
  confidence: number;
  source: string;
}

export function createNavNode(
  url: string,
  title: string,
  depth: number = 0,
  children: NavNode[] = []
): NavNode {
  return {
    url,
    title,
    depth,
    children,
    isExpanded: false,
    selected: true,
  };
}

export function normalizeUrl(url: string, baseUrl: string): string | null {
  try {
    const parsed = new URL(url, baseUrl);
    // Remove hash
    parsed.hash = '';
    // Remove trailing slash for consistency
    let href = parsed.href;
    if (href.endsWith('/') && href !== parsed.origin + '/') {
      href = href.slice(0, -1);
    }
    return href;
  } catch {
    return null;
  }
}

export function isSameOrigin(url: string, baseUrl: string): boolean {
  try {
    return new URL(url, baseUrl).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}

const NON_HTML_EXTENSIONS = [
  '.pdf', '.zip', '.tar', '.gz', '.rar',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp',
  '.mp3', '.mp4', '.avi', '.mov',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
];

export function isHtmlUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return !NON_HTML_EXTENSIONS.some((ext) => pathname.endsWith(ext));
  } catch {
    return false;
  }
}
