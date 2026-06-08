export interface CaptureOptions {
  removeScripts?: boolean;
  removeHiddenElements?: boolean;
  compressHTML?: boolean;
}

export interface CaptureResult {
  content: string;
  title: string;
  url: string;
  stats: {
    resources: number;
    originalSize: number;
    finalSize: number;
  };
}

export async function saveCurrentPage(
  html: string,
  pageUrl: string,
  options: CaptureOptions = {}
): Promise<CaptureResult> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const baseUrl = new URL(pageUrl);

  if (options.removeScripts) {
    doc.querySelectorAll('script').forEach((el) => el.remove());
    doc.querySelectorAll('[onload],[onerror],[onclick],[onmouseover]').forEach(
      (el) => {
        for (const attr of [...el.attributes]) {
          if (attr.name.startsWith('on')) {
            el.removeAttribute(attr.name);
          }
        }
      }
    );
  }

  let resourceCount = 0;

  // Inline stylesheets
  const links = doc.querySelectorAll('link[rel="stylesheet"]');
  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href) continue;
    try {
      const cssUrl = new URL(href, baseUrl).href;
      const cssText = await fetchText(cssUrl);
      if (cssText) {
        const processedCss = await inlineCssResources(cssText, cssUrl);
        const style = doc.createElement('style');
        style.textContent = processedCss;
        link.replaceWith(style);
        resourceCount++;
      }
    } catch {
      // keep original link if fetch fails
    }
  }

  // Inline images
  const images = doc.querySelectorAll('img[src]');
  for (const img of images) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) continue;
    try {
      const imgUrl = new URL(src, baseUrl).href;
      const dataUri = await fetchAsDataUri(imgUrl);
      if (dataUri) {
        img.setAttribute('src', dataUri);
        resourceCount++;
      }
    } catch {
      // keep original src
    }
  }

  // Inline srcset images
  const srcsetElements = doc.querySelectorAll('[srcset]');
  for (const el of srcsetElements) {
    const srcset = el.getAttribute('srcset');
    if (!srcset) continue;
    try {
      const processed = await processSrcset(srcset, baseUrl.href);
      el.setAttribute('srcset', processed);
    } catch {
      // keep original
    }
  }

  // Inline background images in style attributes
  const styledElements = doc.querySelectorAll('[style]');
  for (const el of styledElements) {
    const style = el.getAttribute('style');
    if (!style || !style.includes('url(')) continue;
    try {
      const processed = await inlineCssResources(style, pageUrl);
      el.setAttribute('style', processed);
    } catch {
      // keep original
    }
  }

  // Inline <style> tag resources
  const styleTags = doc.querySelectorAll('style');
  for (const style of styleTags) {
    if (!style.textContent || !style.textContent.includes('url(')) continue;
    try {
      style.textContent = await inlineCssResources(style.textContent, pageUrl);
    } catch {
      // keep original
    }
  }

  // Inline favicon
  const favicons = doc.querySelectorAll(
    'link[rel="icon"], link[rel="shortcut icon"]'
  );
  for (const link of favicons) {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('data:')) continue;
    try {
      const iconUrl = new URL(href, baseUrl).href;
      const dataUri = await fetchAsDataUri(iconUrl);
      if (dataUri) {
        link.setAttribute('href', dataUri);
        resourceCount++;
      }
    } catch {
      // keep original
    }
  }

  // Add meta charset if missing
  if (!doc.querySelector('meta[charset]')) {
    const meta = doc.createElement('meta');
    meta.setAttribute('charset', 'utf-8');
    doc.head.prepend(meta);
  }

  // Add saved-by comment
  const comment = doc.createComment(
    ` Saved by SaveIt on ${new Date().toISOString()} from ${pageUrl} `
  );
  doc.documentElement.prepend(comment);

  const content =
    '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;

  return {
    content,
    title: doc.title,
    url: pageUrl,
    stats: {
      resources: resourceCount,
      originalSize: html.length,
      finalSize: content.length,
    },
  };
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blobToDataUri(blob);
  } catch {
    return null;
  }
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function inlineCssResources(
  css: string,
  baseUrl: string
): Promise<string> {
  const urlPattern = /url\(\s*(['"]?)((?!data:)[^'")]+)\1\s*\)/g;
  const replacements: Array<{ match: string; replacement: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(css)) !== null) {
    const resourceUrl = match[2];
    try {
      const absoluteUrl = new URL(resourceUrl, baseUrl).href;
      const dataUri = await fetchAsDataUri(absoluteUrl);
      if (dataUri) {
        replacements.push({
          match: match[0],
          replacement: `url("${dataUri}")`,
        });
      }
    } catch {
      // keep original
    }
  }

  let result = css;
  for (const { match: original, replacement } of replacements) {
    result = result.replace(original, replacement);
  }
  return result;
}

async function processSrcset(srcset: string, baseUrl: string): Promise<string> {
  const entries = srcset.split(',').map((s) => s.trim());
  const results: string[] = [];

  for (const entry of entries) {
    const parts = entry.split(/\s+/);
    const url = parts[0];
    const descriptor = parts.slice(1).join(' ');

    if (url.startsWith('data:')) {
      results.push(entry);
      continue;
    }

    try {
      const absoluteUrl = new URL(url, baseUrl).href;
      const dataUri = await fetchAsDataUri(absoluteUrl);
      if (dataUri) {
        results.push(descriptor ? `${dataUri} ${descriptor}` : dataUri);
      } else {
        results.push(entry);
      }
    } catch {
      results.push(entry);
    }
  }

  return results.join(', ');
}
