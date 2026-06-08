import type { NavNode } from '@/shared/types';
import { createNavNode, normalizeUrl, isSameOrigin, isHtmlUrl } from './adapters/interface';

interface ExpandOptions {
  maxDepth?: number;
  maxUrls?: number;
  nodeTimeout?: number;
  totalTimeout?: number;
}

const DEFAULTS: Required<ExpandOptions> = {
  maxDepth: 10,
  maxUrls: 2000,
  nodeTimeout: 3000,
  totalTimeout: 60000,
};

const TOGGLE_SELECTORS = [
  '[aria-expanded="false"]',
  'summary',
  '[class*="toggle"]',
  '[class*="expand"]',
  '[class*="collapse"]',
  '[class*="chevron"]',
  '[class*="arrow"]',
  '[class*="caret"]',
  '[data-state="closed"]',
];

export async function expandNavTree(
  navRoot: Element,
  options: ExpandOptions = {}
): Promise<NavNode[]> {
  const opts = { ...DEFAULTS, ...options };
  const baseUrl = location.href;
  const seenUrls = new Set<string>();
  const startTime = Date.now();

  // Collect initial links
  const initialNodes = collectLinks(navRoot, baseUrl, seenUrls);

  // BFS expansion
  let expandCount = 0;
  let changed = true;

  while (changed && expandCount < opts.maxDepth) {
    if (Date.now() - startTime > opts.totalTimeout) break;
    if (seenUrls.size >= opts.maxUrls) break;

    changed = false;
    const toggles = findCollapsedToggles(navRoot);

    for (const toggle of toggles) {
      if (Date.now() - startTime > opts.totalTimeout) break;
      if (seenUrls.size >= opts.maxUrls) break;

      const beforeCount = seenUrls.size;
      await clickAndWait(toggle, opts.nodeTimeout);
      collectLinks(navRoot, baseUrl, seenUrls);

      if (seenUrls.size > beforeCount) {
        changed = true;
      }
    }

    expandCount++;
  }

  // Build final tree from DOM structure
  return buildTreeFromDom(navRoot, baseUrl);
}

function findCollapsedToggles(container: Element): Element[] {
  const toggles: Element[] = [];

  for (const selector of TOGGLE_SELECTORS) {
    const elements = container.querySelectorAll(selector);
    for (const el of elements) {
      if (isCollapsed(el) && !toggles.includes(el)) {
        toggles.push(el);
      }
    }
  }

  return toggles;
}

function isCollapsed(el: Element): boolean {
  if (el.getAttribute('aria-expanded') === 'false') return true;
  if (el.tagName === 'SUMMARY') {
    const details = el.closest('details');
    if (details && !details.open) return true;
  }
  if (el.getAttribute('data-state') === 'closed') return true;
  return false;
}

async function clickAndWait(el: Element, timeout: number): Promise<void> {
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      // Wait a bit for animations/renders to settle
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 150);
    });

    observer.observe(el.closest('[role="navigation"], nav, aside') || document.body, {
      childList: true,
      subtree: true,
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve();
    }, timeout);

    (el as HTMLElement).click();
  });
}

function collectLinks(container: Element, baseUrl: string, seen: Set<string>): NavNode[] {
  const nodes: NavNode[] = [];
  const anchors = container.querySelectorAll('a[href]');

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
    if (title) {
      nodes.push(createNavNode(url, title, 0));
    }
  }

  return nodes;
}

function buildTreeFromDom(container: Element, baseUrl: string): NavNode[] {
  const topLevelItems = findTopLevelNavItems(container);
  return topLevelItems.map((item) => buildNodeFromElement(item, baseUrl, 0));
}

function findTopLevelNavItems(container: Element): Element[] {
  // Look for direct list items or nav items
  const directList = container.querySelector(':scope > ul, :scope > ol');
  if (directList) {
    return [...directList.querySelectorAll(':scope > li')];
  }

  // Fallback: direct children that contain links
  return [...container.children].filter(
    (child) => child.querySelector('a[href]') !== null
  );
}

function buildNodeFromElement(el: Element, baseUrl: string, depth: number): NavNode {
  const anchor = el.querySelector(':scope > a, :scope > * > a');
  const href = anchor?.getAttribute('href') || '';
  const url = href ? (normalizeUrl(href, baseUrl) || '') : '';
  const title = anchor?.textContent?.trim() || el.textContent?.trim().split('\n')[0] || '';

  // Find child list
  const childList = el.querySelector(':scope > ul, :scope > ol, :scope > [role="group"]');
  const children: NavNode[] = [];

  if (childList && depth < 10) {
    const childItems = childList.querySelectorAll(':scope > li');
    for (const childItem of childItems) {
      children.push(buildNodeFromElement(childItem, baseUrl, depth + 1));
    }
  }

  return createNavNode(url, title, depth, children);
}
