import type { SaveItMessage } from '@/shared/messages';
import { saveCurrentPage } from './page-capture';
import { fetchRobotsTxt, isUrlAllowed, getCrawlDelay } from './robots-txt';

const api = (typeof browser !== 'undefined' ? browser : chrome) as typeof browser;
import {
  createTask,
  getNextUrl,
  markPageCompleted,
  markPageFailed,
  isTaskDone,
  getProgress,
  updateTaskStatus,
  pauseTask,
  resumeTask,
  clearTask,
  getCurrentTask,
  loadPersistedTask,
} from './task-scheduler';
import {
  createBackgroundTab,
  navigateTab,
  closeBackgroundTab,
  captureTabContent,
} from './tab-manager';

api.runtime.onMessage.addListener(
  (message: SaveItMessage, _sender, sendResponse) => {
    switch (message.type) {
      case 'popup.savePage':
        handleSavePage().then(
          () => sendResponse({ success: true }),
          (err) => sendResponse({ success: false, error: String(err) })
        );
        return true;

      case 'popup.startCrawl':
        handleStartCrawl(message.selectedUrls).then(
          () => sendResponse({ success: true }),
          (err) => sendResponse({ success: false, error: String(err) })
        );
        return true;

      case 'popup.pauseCrawl':
        pauseTask();
        sendResponse({ success: true });
        break;

      case 'popup.cancelCrawl':
        updateTaskStatus('idle');
        closeBackgroundTab();
        clearTask();
        sendResponse({ success: true });
        break;

      default:
        break;
    }
    return true;
  }
);

// Resume any persisted task on startup
loadPersistedTask().then((task) => {
  if (task && task.status === 'crawling') {
    runCrawlLoop();
  }
});

async function handleSavePage() {
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id) throw new Error('No active tab');

  notifyPopup({ type: 'bg.status', status: 'capturing' });

  try {
    const response = await api.tabs.sendMessage(tab.id, {
      type: 'content.getSnapshot',
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Failed to get page snapshot');
    }

    const { html, url, title } = response.data as {
      html: string;
      url: string;
      title: string;
    };

    const result = await saveCurrentPage(html, url, {
      removeScripts: true,
      compressHTML: true,
    });

    const filename = generateFilename(title, url);
    await downloadHtml(result.content, filename);

    notifyPopup({ type: 'bg.saveComplete', filename });
  } catch (err) {
    notifyPopup({ type: 'bg.error', error: String(err) });
    throw err;
  }
}

async function handleStartCrawl(selectedUrls: string[]) {
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  const rootUrl = tabs[0]?.url || '';

  createTask(rootUrl, selectedUrls);
  runCrawlLoop();
}

async function runCrawlLoop() {
  const task = getCurrentTask();
  if (!task) return;

  try {
    // Create background tab with first URL
    const firstUrl = getNextUrl();
    if (!firstUrl) {
      await finalizeCrawl();
      return;
    }

    await createBackgroundTab(firstUrl);
    let retryBackoff = 1000;

    while (true) {
      const currentTask = getCurrentTask();
      if (!currentTask || currentTask.status !== 'crawling') break;

      const url = getNextUrl();
      if (!url) break;

      // Report progress
      const prog = getProgress();
      notifyPopup({
        type: 'bg.progress',
        completed: prog.completed,
        total: prog.total,
        currentUrl: url,
      });

      // Check robots.txt
      const origin = new URL(url).origin;
      const rules = await fetchRobotsTxt(origin);
      if (!isUrlAllowed(url, rules)) {
        markPageFailed(url, 'Blocked by robots.txt');
        continue;
      }

      try {
        // Navigate to page
        await navigateTab(url);

        // Capture content
        const snapshot = await captureTabContent('body', 10000);

        // Process with page-capture
        const result = await saveCurrentPage(snapshot.html, snapshot.url, {
          removeScripts: true,
          compressHTML: true,
        });

        // Store result
        markPageCompleted(url, {
          url: snapshot.url,
          title: result.title,
          navTitle: result.title,
          html: result.content,
          depth: 0,
          capturedAt: Date.now(),
          sizeBytes: result.content.length,
        });

        retryBackoff = 1000;
      } catch (err) {
        const errStr = String(err);
        // Handle HTTP 429 with exponential backoff
        if (errStr.includes('429') || errStr.includes('Too Many Requests')) {
          retryBackoff = Math.min(retryBackoff * 2, 30000);
          await sleep(retryBackoff);
        }
        markPageFailed(url, errStr);
      }

      // Respect Crawl-delay from robots.txt, or use default random delay
      const crawlDelay = getCrawlDelay(rules);
      const delay = crawlDelay ? crawlDelay * 1000 : 1000 + Math.random() * 2000;
      await sleep(delay);
    }

    if (isTaskDone()) {
      await finalizeCrawl();
    }
  } catch (err) {
    notifyPopup({ type: 'bg.error', error: `Crawl failed: ${err}` });
    updateTaskStatus('error');
  } finally {
    await closeBackgroundTab();
  }
}

async function finalizeCrawl() {
  const task = getCurrentTask();
  if (!task) return;

  updateTaskStatus('assembling');
  notifyPopup({ type: 'bg.status', status: 'assembling' });

  // For now, output individual pages as a merged file
  const pages = Object.values(task.completed);
  if (pages.length === 0) {
    notifyPopup({ type: 'bg.error', error: 'No pages captured' });
    clearTask();
    return;
  }

  try {
    const { assembleMergedHtml } = await import('./output-assembler');
    const mergedHtml = assembleMergedHtml(pages);
    const hostname = new URL(task.rootUrl).hostname;
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${hostname}_${date}.html`;

    await downloadHtml(mergedHtml, filename);

    updateTaskStatus('done');
    notifyPopup({ type: 'bg.saveComplete', filename });
    clearTask();
  } catch (err) {
    notifyPopup({ type: 'bg.error', error: `Assembly failed: ${err}` });
    updateTaskStatus('error');
  }
}

function generateFilename(title: string, url: string): string {
  const sanitized = (title || new URL(url).hostname)
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 100);
  const date = new Date().toISOString().slice(0, 10);
  return `${sanitized}_${date}.html`;
}

async function downloadHtml(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    await api.downloads.download({
      url,
      filename,
      saveAs: true,
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

function notifyPopup(message: SaveItMessage) {
  api.runtime.sendMessage(message).catch(() => {});
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
