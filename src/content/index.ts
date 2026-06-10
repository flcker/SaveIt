import type { SaveItMessage } from '@/shared/messages';
import { discoverNavigation } from './nav-discovery';

const api = (typeof browser !== 'undefined' ? browser : chrome) as typeof browser;

// Inject MAIN world script for pushState hooks and globals extraction
injectMainWorldScript();

function injectMainWorldScript() {
  try {
    // Try external script first (cleaner, but may be blocked by CSP)
    const script = document.createElement('script');
    script.src = api.runtime.getURL('injected.js');
    script.onload = () => script.remove();
    script.onerror = () => {
      // CSP blocked external script — fall back to inline injection
      script.remove();
      injectInline();
    };
    (document.head || document.documentElement).appendChild(script);
  } catch {
    injectInline();
  }
}

function injectInline() {
  try {
    const script = document.createElement('script');
    script.textContent = INLINE_MAIN_WORLD_CODE;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  } catch {
    // Both methods blocked — MAIN world hooks unavailable (non-critical)
  }
}

const INLINE_MAIN_WORLD_CODE = `(function(){var P='__saveit_';var oP=history.pushState.bind(history),oR=history.replaceState.bind(history);history.pushState=function(s,t,u){oP(s,t,u);f('pushState')};history.replaceState=function(s,t,u){oR(s,t,u);f('replaceState')};window.addEventListener('popstate',function(){f('popstate')});window.addEventListener('hashchange',function(){f('hashchange')});function f(t){window.dispatchEvent(new CustomEvent(P+'navigate',{detail:{navType:t,url:location.href}}))}var n=0,it=null;function oS(){n++;if(it){clearTimeout(it);it=null}}function oE(){n=Math.max(0,n-1);if(n===0){it=setTimeout(function(){window.dispatchEvent(new CustomEvent(P+'network_idle'))},500)}}var oF=window.fetch.bind(window);window.fetch=function(){oS();return oF.apply(this,arguments).finally(oE)};var xO=XMLHttpRequest.prototype.open,xS=XMLHttpRequest.prototype.send;XMLHttpRequest.prototype.open=function(){this.__st=true;return xO.apply(this,arguments)};XMLHttpRequest.prototype.send=function(){if(this.__st){oS();this.addEventListener('loadend',oE,{once:true})}return xS.apply(this,arguments)};function eG(){var g={};if(window.__VP_SITE_DATA__)g.__VP_SITE_DATA__=window.__VP_SITE_DATA__;if(window.__docusaurus)g.__docusaurus=window.__docusaurus;if(window.__NEXT_DATA__)g.__NEXT_DATA__=window.__NEXT_DATA__;if(window.gitbook)g.gitbook=window.gitbook;return g}window.addEventListener(P+'request_globals',function(){window.dispatchEvent(new CustomEvent(P+'globals',{detail:eG()}))});function post(){var g=eG();if(Object.keys(g).length)window.dispatchEvent(new CustomEvent(P+'globals',{detail:g}))}if(document.readyState==='complete')setTimeout(post,100);else window.addEventListener('load',function(){setTimeout(post,100)})})();`;

api.runtime.onMessage.addListener(
  (message: SaveItMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'content.getSnapshot':
        sendResponse({ success: true, data: captureSnapshot() });
        break;

      case 'content.discoverNav':
        discoverNavigation().then(
          (result) => sendResponse({ success: true, data: result }),
          (err) => sendResponse({ success: false, error: String(err) })
        );
        return true; // async response

      case 'content.waitForReady':
        waitForReady(message.contentSelector, message.timeout).then(
          () => sendResponse({ success: true }),
          (err) => sendResponse({ success: false, error: String(err) })
        );
        return true;

      case 'content.getContentSelector':
        sendResponse({
          success: true,
          data: findContentSelector(),
        });
        break;

      default:
        break;
    }
    return true;
  }
);

function captureSnapshot() {
  const doctype = document.doctype
    ? `<!DOCTYPE ${document.doctype.name}${
        document.doctype.publicId ? ` PUBLIC "${document.doctype.publicId}"` : ''
      }${document.doctype.systemId ? ` "${document.doctype.systemId}"` : ''}>`
    : '<!DOCTYPE html>';

  const html = doctype + '\n' + document.documentElement.outerHTML;

  return {
    html,
    url: document.location.href,
    title: document.title,
  };
}

async function findContentSelector(): string {
  const CONTENT_SELECTORS = [
    '[class*="rightWrap"]', '[class*="rightContent"]',
    '[class*="docContent"]', '[class*="markdownContent"]', '[class*="doc-content"]',
    '[class*="page-content"]', '[class*="detail-content"]',
    '.semi-layout-content', '[class*="layout-content"]',
    '.book-body section.normal', '.vp-doc', '.theme-doc-markdown',
    '.md-content__inner', '#main-content',
    'article', 'main',
  ];
  const doc = document;
  for (const sel of CONTENT_SELECTORS) {
    const el = doc.querySelector(sel);
    if (el && el.textContent && el.textContent.trim().length > 50) return sel;
  }
  return 'body';
}

async function waitForReady(
  contentSelector: string,
  timeout: number
): Promise<void> {
  const deadline = Date.now() + timeout;

  // SPA detection: wait for loading mask to disappear first
  const loadingMask = document.querySelector('#loading-mask, [class*="loading-spin"], [class*="spin-wrap"], [class*="spinner"]');
  if (loadingMask) {
    // Wait for loading indicator to be hidden or removed
    await waitForHiddenOrRemoved(loadingMask, deadline);
  }

  // Gate 1: Wait for content selector to have real content
  await waitForContent(contentSelector, deadline);

  // Gate 2: Wait for DOM to stabilize
  await waitForDomStable(200, deadline);
}

function waitForHiddenOrRemoved(el: Element, deadline: number): Promise<void> {
  return new Promise((resolve) => {
    if (!el.isConnected) { resolve(); return; }
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
      resolve();
      return;
    }

    const check = () => {
      if (Date.now() > deadline || !el.isConnected || (el as HTMLElement).offsetParent === null) {
        observer.disconnect();
        resolve();
      }
    };

    const observer = new MutationObserver(check);
    observer.observe(el.parentElement || document.body, { childList: true, attributes: true, subtree: true });
    setTimeout(check, remaining(deadline) || 30000);
  });
}

function remaining(deadline: number): number {
  return Math.max(0, deadline - Date.now());
}

function waitForContent(selector: string, deadline: number): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      const el = document.querySelector(selector);
      if (el && el.textContent && el.textContent.trim().length > 50) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        resolve();
        return;
      }
      setTimeout(check, 200);
    };
    check();
  });
}

function waitForSelector(selector: string, deadline: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) {
      resolve();
      return;
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      observer.disconnect();
      resolve(); // timeout = proceed anyway
      return;
    }

    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, remaining);
  });
}

function waitForDomStable(quietMs: number, deadline: number): Promise<void> {
  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout>;

    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      const remaining = deadline - Date.now();
      if (remaining <= quietMs) {
        observer.disconnect();
        resolve();
        return;
      }
      timer = setTimeout(() => {
        observer.disconnect();
        resolve();
      }, quietMs);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    timer = setTimeout(() => {
      observer.disconnect();
      resolve();
    }, quietMs);

    // Overall timeout
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      observer.disconnect();
      resolve();
    } else {
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, remaining);
    }
  });
}
