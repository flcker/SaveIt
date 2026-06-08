/**
 * MAIN world script — injected into the page's JS context.
 * Hooks pushState/replaceState, tracks network requests, extracts JS globals.
 */

(function () {
  const PREFIX = '__saveit_';

  // --- pushState / replaceState hooks ---
  const origPushState = history.pushState.bind(history);
  const origReplaceState = history.replaceState.bind(history);

  history.pushState = function (state, title, url) {
    origPushState(state, title, url);
    dispatchNav('pushState', location.href);
  };

  history.replaceState = function (state, title, url) {
    origReplaceState(state, title, url);
    dispatchNav('replaceState', location.href);
  };

  window.addEventListener('popstate', () => {
    dispatchNav('popstate', location.href);
  });

  window.addEventListener('hashchange', () => {
    dispatchNav('hashchange', location.href);
  });

  function dispatchNav(navType: string, url: string) {
    window.dispatchEvent(
      new CustomEvent(PREFIX + 'navigate', {
        detail: { navType, url },
      })
    );
  }

  // --- Network request tracking ---
  let inFlight = 0;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  function onRequestStart() {
    inFlight++;
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function onRequestEnd() {
    inFlight = Math.max(0, inFlight - 1);
    if (inFlight === 0) {
      idleTimer = setTimeout(() => {
        window.dispatchEvent(new CustomEvent(PREFIX + 'network_idle'));
      }, 500);
    }
  }

  // Wrap fetch
  const origFetch = window.fetch.bind(window);
  (window as any).fetch = function (...args: Parameters<typeof fetch>) {
    onRequestStart();
    return origFetch(...args).finally(onRequestEnd);
  };

  // Wrap XMLHttpRequest
  const origXHROpen = XMLHttpRequest.prototype.open;
  const origXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (...args: any[]) {
    (this as any).__saveit_tracked = true;
    return origXHROpen.apply(this, args as any);
  };

  XMLHttpRequest.prototype.send = function (...args: any[]) {
    if ((this as any).__saveit_tracked) {
      onRequestStart();
      this.addEventListener('loadend', onRequestEnd, { once: true });
    }
    return origXHRSend.apply(this, args as any);
  };

  // --- JS globals extraction ---
  function extractGlobals() {
    const globals: Record<string, unknown> = {};

    // VitePress
    if ((window as any).__VP_SITE_DATA__) {
      globals.__VP_SITE_DATA__ = (window as any).__VP_SITE_DATA__;
    }

    // Docusaurus
    if ((window as any).__docusaurus) {
      globals.__docusaurus = (window as any).__docusaurus;
    }

    // Next.js / GitBook
    if ((window as any).__NEXT_DATA__) {
      globals.__NEXT_DATA__ = (window as any).__NEXT_DATA__;
    }

    // Older GitBook
    if ((window as any).gitbook) {
      globals.gitbook = (window as any).gitbook;
    }

    return globals;
  }

  // Listen for globals request from content script (ISOLATED world)
  window.addEventListener(PREFIX + 'request_globals', () => {
    const globals = extractGlobals();
    window.dispatchEvent(
      new CustomEvent(PREFIX + 'globals', {
        detail: globals,
      })
    );
  });

  // Auto-post globals after page loads
  if (document.readyState === 'complete') {
    setTimeout(() => postGlobals(), 100);
  } else {
    window.addEventListener('load', () => setTimeout(() => postGlobals(), 100));
  }

  function postGlobals() {
    const globals = extractGlobals();
    if (Object.keys(globals).length > 0) {
      window.dispatchEvent(
        new CustomEvent(PREFIX + 'globals', { detail: globals })
      );
    }
  }
})();
