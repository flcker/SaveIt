import type { DiscoveryResult } from '../adapters/interface';
import {
  createNavNode,
  normalizeUrl,
  isSameOrigin,
  isHtmlUrl,
} from '../adapters/interface';
import type { NavNode } from '@/shared/types';

const NAV_SELECTORS = [
  '[role="navigation"]',
  'nav',
  'aside',
  '.sidebar',
  '.nav-sidebar',
  '.navigation',
  '.toc',
  '.table-of-contents',
  '[class*="sidebar"]',
  '[class*="side-nav"]',
  '[class*="menu-tree"]',
  '[class*="doc-nav"]',
  '[class*="tree-view"]',
  '[class*="catalog"]',
  '[aria-label*="navigation" i]',
  '[aria-label*="sidebar" i]',
  '[aria-label*="menu" i]',
  '[aria-label*="目录" i]',
  '[aria-label*="导航" i]',
];

export function discoverFromDom(): DiscoveryResult {
  const baseUrl = location.href;
  let bestResult: DiscoveryResult = { nodes: [], confidence: 0, source: 'dom' };

  for (const selector of NAV_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const links = extractLinksFromElement(el, baseUrl);
      if (links.length > bestResult.nodes.length) {
        const confidence = calculateConfidence(links, el);
        if (confidence > bestResult.confidence) {
          bestResult = { nodes: links, confidence, source: 'dom' };
        }
      }
    }
  }

  return bestResult;
}

function extractLinksFromElement(container: Element, baseUrl: string): NavNode[] {
  const anchors = container.querySelectorAll('a[href]');
  const seen = new Set<string>();
  const nodes: NavNode[] = [];

  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript:')) continue;

    const url = normalizeUrl(href, baseUrl);
    if (!url) continue;
    if (!isSameOrigin(url, baseUrl)) continue;
    if (!isHtmlUrl(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    const title = anchor.textContent?.trim() || '';
    if (!title) continue;

    const depth = getVisualDepth(anchor, container);
    nodes.push(createNavNode(url, title, depth));
  }

  return nodes;
}

function getVisualDepth(element: Element, container: Element): number {
  let depth = 0;
  let current: Element | null = element;
  while (current && current !== container) {
    if (
      current.tagName === 'UL' ||
      current.tagName === 'OL' ||
      current.matches('[role="group"], [role="tree"], .nav-group, .sidebar-group')
    ) {
      depth++;
    }
    current = current.parentElement;
  }
  return Math.max(0, depth - 1);
}

function calculateConfidence(nodes: NavNode[], container: Element): number {
  let confidence = 0;

  // More links = higher confidence
  if (nodes.length >= 20) confidence = 0.8;
  else if (nodes.length >= 10) confidence = 0.7;
  else if (nodes.length >= 5) confidence = 0.6;
  else confidence = 0.4;

  // Multiple depth levels = higher confidence
  const depths = new Set(nodes.map((n) => n.depth));
  if (depths.size >= 3) confidence += 0.1;
  else if (depths.size >= 2) confidence += 0.05;

  // Is it in a typical sidebar position? (left side, narrow width)
  const rect = container.getBoundingClientRect();
  if (rect.width < window.innerWidth * 0.4 && rect.left < window.innerWidth * 0.3) {
    confidence += 0.05;
  }

  return Math.min(confidence, 1.0);
}

export function getNavRoot(): Element | null {
  for (const selector of NAV_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      // Count links OR expandable items (collapsed tree may have few visible <a>)
      const linkCount = el.querySelectorAll('a[href]').length;
      if (linkCount >= 3) return el;

      const expandableCount = el.querySelectorAll(
        '[aria-expanded], details, [class*="expand"], [class*="collapse"], ' +
        '[class*="toggle"], [class*="arrow"], [class*="tree-node"], [class*="menu-item"]'
      ).length;
      if (expandableCount >= 2) return el;
    }
  }

  // Last resort: find the narrower left-side container with multiple text items
  const candidates = document.querySelectorAll(
    '[class*="aside"], [class*="sidebar"], [class*="left"], [class*="catalog"], [class*="directory"]'
  );
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.width < window.innerWidth * 0.4) {
      const items = el.querySelectorAll('a[href], [class*="item"], [class*="link"], [role="treeitem"]');
      if (items.length >= 2) return el;
    }
  }

  return null;
}
