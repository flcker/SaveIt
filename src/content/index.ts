import type { SaveItMessage } from '@/shared/messages';
import { discoverNavigation } from './nav-discovery';

const api = (typeof browser !== 'undefined' ? browser : chrome) as typeof browser;

// Inject MAIN world script for pushState hooks and globals extraction
injectMainWorldScript();

function injectMainWorldScript() {
  const script = document.createElement('script');
  script.src = api.runtime.getURL('injected.js');
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}

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

async function waitForReady(
  contentSelector: string,
  timeout: number
): Promise<void> {
  const deadline = Date.now() + timeout;

  // Gate 1: Wait for content selector to appear
  await waitForSelector(contentSelector, deadline);

  // Gate 2: Wait for DOM to stabilize (no mutations for 200ms)
  await waitForDomStable(200, deadline);
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
