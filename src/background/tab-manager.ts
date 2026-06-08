let backgroundTabId: number | null = null;

export async function createBackgroundTab(url: string): Promise<number> {
  const tab = await browser.tabs.create({ url, active: false });
  backgroundTabId = tab.id!;
  await waitForTabLoad(backgroundTabId);
  return backgroundTabId;
}

export async function navigateTab(url: string): Promise<void> {
  if (!backgroundTabId) {
    await createBackgroundTab(url);
    return;
  }

  await browser.tabs.update(backgroundTabId, { url });
  await waitForTabLoad(backgroundTabId);
}

export async function closeBackgroundTab(): Promise<void> {
  if (backgroundTabId) {
    try {
      await browser.tabs.remove(backgroundTabId);
    } catch {
      // tab might already be closed
    }
    backgroundTabId = null;
  }
}

export function getBackgroundTabId(): number | null {
  return backgroundTabId;
}

export async function captureTabContent(
  contentSelector: string = 'body',
  timeout: number = 10000
): Promise<{ html: string; url: string; title: string }> {
  if (!backgroundTabId) throw new Error('No background tab');

  // Wait for content readiness
  await browser.tabs.sendMessage(backgroundTabId, {
    type: 'content.waitForReady',
    contentSelector,
    timeout,
  });

  // Get DOM snapshot
  const response = await browser.tabs.sendMessage(backgroundTabId, {
    type: 'content.getSnapshot',
  });

  if (!response?.success) {
    throw new Error(response?.error || 'Snapshot failed');
  }

  return response.data as { html: string; url: string; title: string };
}

function waitForTabLoad(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      browser.tabs.onUpdated.removeListener(listener);
      resolve(); // timeout = proceed anyway
    }, 30000);

    function listener(
      updatedTabId: number,
      changeInfo: browser.tabs._OnUpdatedChangeInfo
    ) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        browser.tabs.onUpdated.removeListener(listener);
        // Give a small delay for scripts to initialize
        setTimeout(resolve, 500);
      }
    }

    browser.tabs.onUpdated.addListener(listener);
  });
}
