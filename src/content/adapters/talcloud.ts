import type { SiteAdapter } from './interface';
import type { NavNode } from '@/shared/types';
import { createNavNode, normalizeUrl, isSameOrigin } from './interface';

export const talcloudAdapter: SiteAdapter = {
  name: 'talcloud',

  detect(): boolean {
    return !!(
      document.querySelector('aside.semi-layout-sider') &&
      document.querySelector('[class*="tocs_wrap"]')
    ) || location.pathname.includes('/new-docs/app/org/');
  },

  async getNavTree(): Promise<NavNode[]> {
    const sidebar = document.querySelector('[class*="tocs_wrap"]') ||
      document.querySelector('aside.semi-layout-sider');
    if (!sidebar) return [];

    // Expand all collapsed tree items
    await expandAllItems(sidebar);

    // Collect all links
    return collectLinks(sidebar);
  },

  getContentSelector(): string {
    return '[class*="docContent"], [class*="markdownContent"], [class*="page-content"], main, article';
  },

  getExpandStrategy(): 'click-toggle' | 'spa-route' | 'none' {
    return 'spa-route';
  },
};

async function expandAllItems(container: Element): Promise<void> {
  const MAX_ROUNDS = 10;
  const ROUND_DELAY = 300;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    // Find all collapsed expand toggles
    const toggles = findCollapsedToggles(container);
    if (toggles.length === 0) break;

    for (const toggle of toggles) {
      (toggle as HTMLElement).click();
      await sleep(150);
    }

    await sleep(ROUND_DELAY);
  }
}

function findCollapsedToggles(container: Element): Element[] {
  const toggles: Element[] = [];

  // Semi Design tree expand icons
  const semiExpanders = container.querySelectorAll(
    '[class*="expand"][class*="icon"]:not([class*="expanded"]), ' +
    '[class*="switcher"]:not([class*="open"]):not([class*="expanded"]), ' +
    '[class*="arrow"][class*="right"], ' +
    '[class*="chevron_right"], ' +
    '[class*="caret-right"]'
  );
  toggles.push(...semiExpanders);

  // Generic: any element with aria-expanded="false" inside nav items
  const ariaToggles = container.querySelectorAll('[aria-expanded="false"]');
  toggles.push(...ariaToggles);

  // Look for clickable list items that have child indicators but no visible children
  const items = container.querySelectorAll(
    '[class*="treeNode"][class*="collapsed"], ' +
    '[class*="tree-node"][class*="close"], ' +
    '[class*="menuItem"][class*="has-children"]:not([class*="open"]), ' +
    'li[class*="closed"], li[class*="collapsed"]'
  );
  toggles.push(...items);

  // Semi Design specific: find tree option items with expand icon that is rotated 0deg (collapsed)
  const semiTreeOptions = container.querySelectorAll('[class*="treeOption"], [class*="tree_option"]');
  for (const opt of semiTreeOptions) {
    const expandIcon = opt.querySelector('[class*="expand"], [class*="switcher"]');
    if (expandIcon) {
      const nextSibling = opt.nextElementSibling;
      const isExpanded = nextSibling && nextSibling.matches('[class*="children"], [class*="sub"], ul, [role="group"]');
      if (!isExpanded && !toggles.includes(expandIcon)) {
        toggles.push(expandIcon);
      }
    }
  }

  return toggles;
}

function collectLinks(container: Element): NavNode[] {
  const baseUrl = location.href;
  const nodes: NavNode[] = [];
  const seen = new Set<string>();

  const anchors = container.querySelectorAll('a[href]');
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href');
    if (!href || href === '#' || href.startsWith('javascript:')) continue;

    const url = normalizeUrl(href, baseUrl);
    if (!url) continue;
    if (!isSameOrigin(url, baseUrl)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    const title = anchor.textContent?.trim() || '';
    if (!title || title.length > 200) continue;

    // Determine depth by nesting level
    const depth = getDepth(anchor, container);
    nodes.push(createNavNode(url, title, depth));
  }

  return nodes;
}

function getDepth(el: Element, root: Element): number {
  let depth = 0;
  let current: Element | null = el;
  while (current && current !== root) {
    const cls = current.className || '';
    if (
      current.tagName === 'UL' || current.tagName === 'OL' ||
      cls.includes('children') || cls.includes('sub-menu') ||
      cls.includes('group') || cls.includes('nested') ||
      current.matches('[role="group"]')
    ) {
      depth++;
    }
    current = current.parentElement;
  }
  return Math.max(0, depth - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
