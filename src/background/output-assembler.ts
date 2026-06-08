import type { CapturedPage } from '@/shared/types';

export function assembleMergedHtml(pages: CapturedPage[]): string {
  const parser = new DOMParser();
  const slugs = new Map<string, string>();
  const processedPages: Array<{
    slug: string;
    title: string;
    styles: string;
    body: string;
  }> = [];

  // Process each page
  for (const page of pages) {
    const slug = urlToSlug(page.url, slugs);
    slugs.set(page.url, slug);

    const doc = parser.parseFromString(page.html, 'text/html');

    // Extract and scope styles
    const styles = extractAndScopeStyles(doc, slug);

    // Extract body content
    const body = extractBodyContent(doc);

    processedPages.push({ slug, title: page.title || page.navTitle, styles, body });
  }

  // Deduplicate data: URIs across all styles
  const { sharedVars, processedStyles } = deduplicateDataUris(
    processedPages.map((p) => p.styles)
  );

  // Build final HTML
  return buildMergedDocument(processedPages, processedStyles, sharedVars);
}

function urlToSlug(url: string, existing: Map<string, string>): string {
  try {
    const path = new URL(url).pathname
      .replace(/^\//, '')
      .replace(/\/$/, '')
      .replace(/\.html?$/, '')
      .replace(/[^a-zA-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 60);
    let slug = path || 'index';
    let counter = 1;
    while ([...existing.values()].includes(slug)) {
      slug = `${path}-${counter++}`;
    }
    return slug;
  } catch {
    return 'page-' + existing.size;
  }
}

function extractAndScopeStyles(doc: Document, slug: string): string {
  const styles: string[] = [];
  const styleElements = doc.querySelectorAll('style');

  for (const style of styleElements) {
    const css = style.textContent?.trim();
    if (!css) continue;
    // Wrap in @scope for CSS isolation
    styles.push(`@scope (.saveit-page-${slug}) {\n${css}\n}`);
  }

  return styles.join('\n\n');
}

function extractBodyContent(doc: Document): string {
  // Try to find main content area
  const main = doc.querySelector('main') || doc.querySelector('article') || doc.body;
  if (!main) return doc.body?.innerHTML || '';

  // Remove navigation elements from body content
  const clone = main.cloneNode(true) as Element;
  clone.querySelectorAll('nav, header, footer, .sidebar, .navigation').forEach(
    (el) => el.remove()
  );

  return clone.innerHTML;
}

function deduplicateDataUris(
  allStyles: string[]
): { sharedVars: string; processedStyles: string[] } {
  // Find data: URIs that appear in multiple pages
  const uriCounts = new Map<string, number>();
  const dataUriPattern = /url\("(data:[^"]{100,})"\)/g;

  for (const css of allStyles) {
    const seen = new Set<string>();
    let match;
    while ((match = dataUriPattern.exec(css)) !== null) {
      const uri = match[1];
      if (!seen.has(uri)) {
        seen.add(uri);
        uriCounts.set(uri, (uriCounts.get(uri) || 0) + 1);
      }
    }
  }

  // Create CSS variables for URIs that appear 2+ times
  const varMap = new Map<string, string>();
  let varIndex = 0;
  const varDeclarations: string[] = [];

  for (const [uri, count] of uriCounts) {
    if (count >= 2) {
      const varName = `--saveit-r${varIndex++}`;
      varMap.set(uri, varName);
      varDeclarations.push(`  ${varName}: url("${uri}");`);
    }
  }

  // Replace duplicated URIs with var() references
  const processedStyles = allStyles.map((css) => {
    let result = css;
    for (const [uri, varName] of varMap) {
      const escaped = uri.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(
        new RegExp(`url\\("${escaped}"\\)`, 'g'),
        `var(${varName})`
      );
    }
    return result;
  });

  const sharedVars =
    varDeclarations.length > 0
      ? `:root {\n${varDeclarations.join('\n')}\n}`
      : '';

  return { sharedVars, processedStyles };
}

function buildMergedDocument(
  pages: Array<{ slug: string; title: string; body: string }>,
  styles: string[],
  sharedVars: string
): string {
  const tocItems = pages
    .map(
      (p) =>
        `      <li><a href="#page-${p.slug}" data-page="${p.slug}">${escapeHtml(p.title)}</a></li>`
    )
    .join('\n');

  const articles = pages
    .map(
      (p, i) =>
        `    <article id="page-${p.slug}" class="saveit-page saveit-page-${p.slug}"${i > 0 ? ' hidden' : ''}>\n      ${p.body}\n    </article>`
    )
    .join('\n\n');

  const pageStyles = styles
    .map((css, i) => `  <style id="saveit-style-${pages[i].slug}">\n${css}\n  </style>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(pages[0]?.title || 'SaveIt Export')}</title>
  <meta name="generator" content="SaveIt">
  <style id="saveit-resources">
${sharedVars}
  </style>
  <style id="saveit-ui">
${SAVEIT_UI_CSS}
  </style>
${pageStyles}
</head>
<body>
  <nav id="saveit-toc">
    <div class="saveit-toc-header">
      <h2>目录</h2>
      <button id="saveit-toc-toggle" aria-label="Toggle TOC">☰</button>
    </div>
    <ul>
${tocItems}
    </ul>
  </nav>

  <main id="saveit-content">
${articles}
  </main>

  <script>
${SAVEIT_NAV_JS}
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SAVEIT_UI_CSS = `
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      min-height: 100vh;
    }
    #saveit-toc {
      width: 280px;
      min-width: 280px;
      height: 100vh;
      position: sticky;
      top: 0;
      overflow-y: auto;
      background: #f8fafc;
      border-right: 1px solid #e2e8f0;
      padding: 16px;
      font-size: 13px;
    }
    .saveit-toc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .saveit-toc-header h2 {
      font-size: 16px;
      margin: 0;
      color: #1e293b;
    }
    #saveit-toc-toggle {
      display: none;
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
    }
    #saveit-toc ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    #saveit-toc li {
      margin: 2px 0;
    }
    #saveit-toc a {
      display: block;
      padding: 6px 10px;
      border-radius: 4px;
      color: #475569;
      text-decoration: none;
      transition: background 0.15s;
    }
    #saveit-toc a:hover {
      background: #e2e8f0;
    }
    #saveit-toc a.active {
      background: #dbeafe;
      color: #1d4ed8;
      font-weight: 500;
    }
    #saveit-content {
      flex: 1;
      padding: 24px 32px;
      max-width: 900px;
      overflow-x: hidden;
    }
    .saveit-page {
      line-height: 1.6;
    }
    .saveit-page img {
      max-width: 100%;
      height: auto;
    }
    .saveit-page pre {
      overflow-x: auto;
      background: #f1f5f9;
      padding: 12px;
      border-radius: 4px;
    }
    @media (max-width: 768px) {
      #saveit-toc {
        position: fixed;
        left: -280px;
        z-index: 1000;
        transition: left 0.3s;
      }
      #saveit-toc.open {
        left: 0;
      }
      #saveit-toc-toggle {
        display: block;
        position: fixed;
        top: 12px;
        left: 12px;
        z-index: 999;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 4px 8px;
      }
      #saveit-content {
        padding: 16px;
      }
    }
    @media (prefers-color-scheme: dark) {
      body { background: #0f172a; color: #e2e8f0; }
      #saveit-toc { background: #1e293b; border-color: #334155; }
      .saveit-toc-header h2 { color: #f1f5f9; }
      #saveit-toc a { color: #94a3b8; }
      #saveit-toc a:hover { background: #334155; }
      #saveit-toc a.active { background: #1e3a5f; color: #93c5fd; }
      .saveit-page pre { background: #1e293b; }
    }
`;

const SAVEIT_NAV_JS = `
(function() {
  var toc = document.getElementById('saveit-toc');
  var toggle = document.getElementById('saveit-toc-toggle');
  var links = toc.querySelectorAll('a[data-page]');
  var articles = document.querySelectorAll('.saveit-page');

  function showPage(slug) {
    articles.forEach(function(a) {
      a.hidden = a.id !== 'page-' + slug;
    });
    links.forEach(function(l) {
      l.classList.toggle('active', l.getAttribute('data-page') === slug);
    });
    document.title = toc.querySelector('a[data-page="' + slug + '"]')?.textContent || document.title;
    window.scrollTo(0, 0);
    if (toc.classList.contains('open')) toc.classList.remove('open');
  }

  links.forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var slug = this.getAttribute('data-page');
      showPage(slug);
      history.replaceState(null, '', '#page-' + slug);
    });
  });

  if (toggle) {
    toggle.addEventListener('click', function() {
      toc.classList.toggle('open');
    });
  }

  // Handle initial hash
  var hash = location.hash.replace('#page-', '');
  if (hash && document.getElementById('page-' + hash)) {
    showPage(hash);
  } else if (links.length > 0) {
    links[0].classList.add('active');
  }
})();
`;
