import type { CrawlTask, CrawlStatus, CapturedPage } from '@/shared/types';

const api = (typeof browser !== 'undefined' ? browser : chrome) as typeof browser;

let currentTask: CrawlTask | null = null;

export function getCurrentTask(): CrawlTask | null {
  return currentTask;
}

export function createTask(rootUrl: string, selectedUrls: string[]): CrawlTask {
  const task: CrawlTask = {
    id: generateId(),
    rootUrl,
    status: 'crawling',
    navTree: [],
    queue: [...selectedUrls],
    completed: {},
    failed: {},
    startedAt: Date.now(),
    options: {
      output: { mode: 'single-merged', filename: '{site}-{date}', maxPages: 500 },
      capture: { removeScripts: true, removeHiddenElements: false, compressHTML: true, lazyLoadTimeout: 5000 },
      navigation: { maxDepth: 10, expandTimeout: 60000, concurrency: 1, pageDelay: 1500 },
    },
  };
  currentTask = task;
  persistTask(task);
  return task;
}

export function updateTaskStatus(status: CrawlStatus) {
  if (!currentTask) return;
  currentTask.status = status;
  persistTask(currentTask);
}

export function markPageCompleted(url: string, page: CapturedPage) {
  if (!currentTask) return;
  currentTask.completed[url] = page;
  // Remove from queue
  const idx = currentTask.queue.indexOf(url);
  if (idx >= 0) currentTask.queue.splice(idx, 1);
  persistTask(currentTask);
}

export function markPageFailed(url: string, error: string) {
  if (!currentTask) return;
  const existing = currentTask.failed[url];
  const attempts = (existing?.attempts || 0) + 1;
  currentTask.failed[url] = { error, attempts };

  if (attempts >= 3) {
    // Remove from queue permanently
    const idx = currentTask.queue.indexOf(url);
    if (idx >= 0) currentTask.queue.splice(idx, 1);
  }
  persistTask(currentTask);
}

export function getNextUrl(): string | null {
  if (!currentTask || currentTask.status !== 'crawling') return null;
  if (currentTask.queue.length === 0) return null;

  // Skip already completed
  while (currentTask.queue.length > 0) {
    const url = currentTask.queue[0];
    if (currentTask.completed[url]) {
      currentTask.queue.shift();
      continue;
    }
    // Skip if failed 3+ times
    if (currentTask.failed[url]?.attempts >= 3) {
      currentTask.queue.shift();
      continue;
    }
    return url;
  }
  return null;
}

export function getProgress() {
  if (!currentTask) return { completed: 0, total: 0, currentUrl: '' };
  const total = Object.keys(currentTask.completed).length + currentTask.queue.length;
  return {
    completed: Object.keys(currentTask.completed).length,
    total,
    currentUrl: currentTask.queue[0] || '',
  };
}

export function isTaskDone(): boolean {
  if (!currentTask) return true;
  return currentTask.queue.length === 0;
}

export function pauseTask() {
  if (currentTask) {
    currentTask.status = 'paused';
    persistTask(currentTask);
  }
}

export function resumeTask() {
  if (currentTask && currentTask.status === 'paused') {
    currentTask.status = 'crawling';
    persistTask(currentTask);
  }
}

export function clearTask() {
  currentTask = null;
  api.storage.local.remove('saveit_task');
}

export async function loadPersistedTask(): Promise<CrawlTask | null> {
  try {
    const result = await api.storage.local.get('saveit_task');
    if (result.saveit_task) {
      currentTask = result.saveit_task;
      return currentTask;
    }
  } catch {
    // storage unavailable
  }
  return null;
}

function persistTask(task: CrawlTask) {
  api.storage.local.set({ saveit_task: task }).catch(() => {
    // ignore persistence errors
  });
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
