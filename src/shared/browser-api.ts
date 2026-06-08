/**
 * Browser API compatibility layer.
 * Firefox uses `browser.*` (Promise-based), Chrome uses `chrome.*` (callback-based).
 * This module exports a unified API that works in both.
 */

type BrowserAPI = typeof browser;

function getApi(): BrowserAPI {
  if (typeof browser !== 'undefined') {
    return browser;
  }
  // Chrome: chrome.* APIs with callbacks — wrap as needed
  // For MV3 Chrome, most APIs are already Promise-based
  return (globalThis as any).chrome as unknown as BrowserAPI;
}

export const api = getApi();
