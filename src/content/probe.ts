/**
 * 页面结构探测脚本。
 * 通过注入到页面中执行，分析 DOM 结构找到导航区域和所有链接。
 * 返回结构化的探测结果。
 */

export interface ProbeResult {
  links: Array<{ url: string; title: string; depth: number }>;
  container: { tag: string; className: string; selector: string };
  expandable: number;
  strategy: string;
}

export function getProbeScript(): string {
  return PROBE_CODE;
}

const PROBE_CODE = `(function() {
  var result = { links: [], container: null, expandable: 0, strategy: 'none' };

  // Step 1: Find the best navigation container
  var container = findNavContainer();
  if (!container) return JSON.stringify(result);

  result.container = {
    tag: container.tagName,
    className: container.className.substring(0, 200),
    selector: buildSelector(container)
  };

  // Step 2: Try expanding collapsed items
  var expanded = expandAll(container);
  result.expandable = expanded;
  if (expanded > 0) result.strategy = 'expand';

  // Step 3: Collect all links
  result.links = collectLinks(container);
  if (result.links.length > 0 && result.strategy === 'none') result.strategy = 'links';

  return JSON.stringify(result);

  function findNavContainer() {
    // Score each candidate by how "navigation-like" it looks
    var candidates = [];
    var all = document.querySelectorAll('aside, nav, [role="navigation"], [class*="sidebar"], [class*="menu"], [class*="toc"], [class*="aside"], [class*="nav-"], [class*="catalog"], [class*="directory"], [class*="tree"]');

    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.width > window.innerWidth * 0.6) continue;

      var score = 0;
      var links = el.querySelectorAll('a[href]').length;
      var items = el.querySelectorAll('li, [class*="item"], [class*="node"], [role="treeitem"]').length;
      var expandable = el.querySelectorAll('[aria-expanded], [class*="expand"], [class*="collapse"], [class*="switcher"], [class*="toggle"], [class*="arrow"], details, summary').length;

      score += Math.min(links, 50) * 2;
      score += Math.min(items, 50);
      score += expandable * 3;

      // Bonus: positioned on left side
      if (rect.left < window.innerWidth * 0.3) score += 10;
      // Bonus: tall and narrow (sidebar shape)
      if (rect.height > 300 && rect.width < 400) score += 15;
      // Penalty: too small
      if (rect.height < 100) score -= 20;

      if (score > 0) candidates.push({ el: el, score: score });
    }

    candidates.sort(function(a, b) { return b.score - a.score; });
    return candidates.length > 0 ? candidates[0].el : null;
  }

  function expandAll(container) {
    var count = 0;
    var maxRounds = 8;
    for (var round = 0; round < maxRounds; round++) {
      var toggles = findToggles(container);
      if (toggles.length === 0) break;
      for (var i = 0; i < toggles.length; i++) {
        try { toggles[i].click(); count++; } catch(e) {}
      }
      // Sync wait — probe runs once, no async needed
      var start = Date.now();
      while (Date.now() - start < 200) {} // busy wait for DOM to update
    }
    return count;
  }

  function findToggles(container) {
    var toggles = [];
    var selectors = [
      '[aria-expanded="false"]',
      'summary',
      '[class*="switcher"]:not([class*="open"]):not([class*="expanded"])',
      '[class*="expand-icon"]:not([class*="expanded"])',
      '[class*="tree-switcher_close"]',
      '[class*="chevron_right"]',
      '[class*="arrow-right"]',
      '[class*="caret-right"]',
      '[class*="collapsed"] > [class*="icon"]',
      '[class*="closed"] > [class*="icon"]'
    ];
    for (var s = 0; s < selectors.length; s++) {
      try {
        var els = container.querySelectorAll(selectors[s]);
        for (var i = 0; i < els.length; i++) {
          if (toggles.indexOf(els[i]) === -1) toggles.push(els[i]);
        }
      } catch(e) {}
    }
    return toggles;
  }

  function collectLinks(container) {
    var links = [];
    var seen = {};
    var origin = location.origin;
    var anchors = container.querySelectorAll('a[href]');

    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var href = a.getAttribute('href');
      if (!href || href === '#' || href.indexOf('javascript:') === 0) continue;

      var url;
      try { url = new URL(href, location.href).href; } catch(e) { continue; }
      if (url.indexOf(origin) !== 0) continue;
      if (seen[url]) continue;
      seen[url] = true;

      var title = a.textContent.trim();
      if (!title || title.length > 200) continue;

      var depth = getDepth(a, container);
      links.push({ url: url, title: title, depth: depth });
    }
    return links;
  }

  function getDepth(el, root) {
    var d = 0;
    var cur = el;
    while (cur && cur !== root) {
      var tag = cur.tagName;
      var cls = cur.className || '';
      if (tag === 'UL' || tag === 'OL' || cls.indexOf('children') !== -1 || cls.indexOf('sub') !== -1 || cls.indexOf('nested') !== -1 || cls.indexOf('group') !== -1) d++;
      cur = cur.parentElement;
    }
    return Math.max(0, d - 1);
  }

  function buildSelector(el) {
    if (el.id) return '#' + el.id;
    var tag = el.tagName.toLowerCase();
    var cls = el.className.split(' ').filter(function(c) { return c && !c.match(/__|--/) && c.length < 30; }).slice(0, 2).join('.');
    return cls ? tag + '.' + cls : tag;
  }
})();`;
