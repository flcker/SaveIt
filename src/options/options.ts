interface SaveItOptions {
  capture: {
    removeScripts: boolean;
    removeHidden: boolean;
    compressHTML: boolean;
  };
  crawl: {
    pageDelay: number;
    maxPages: number;
    maxDepth: number;
    respectRobots: boolean;
  };
  output: {
    mode: 'single-merged' | 'zip';
    filenameTemplate: string;
  };
}

const api = (typeof browser !== 'undefined' ? browser : chrome) as typeof browser;

const DEFAULTS: SaveItOptions = {
  capture: { removeScripts: true, removeHidden: false, compressHTML: true },
  crawl: { pageDelay: 1500, maxPages: 500, maxDepth: 10, respectRobots: true },
  output: { mode: 'single-merged', filenameTemplate: '{site}-{date}' },
};

async function loadOptions(): Promise<SaveItOptions> {
  const result = await api.storage.local.get('saveit_options');
  return { ...DEFAULTS, ...result.saveit_options };
}

async function saveOptions(opts: SaveItOptions) {
  await api.storage.local.set({ saveit_options: opts });
}

function getEl<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

async function init() {
  const opts = await loadOptions();

  // Populate form
  getEl<HTMLInputElement>('removeScripts').checked = opts.capture.removeScripts;
  getEl<HTMLInputElement>('removeHidden').checked = opts.capture.removeHidden;
  getEl<HTMLInputElement>('compressHTML').checked = opts.capture.compressHTML;
  getEl<HTMLInputElement>('pageDelay').value = String(opts.crawl.pageDelay);
  getEl<HTMLInputElement>('maxPages').value = String(opts.crawl.maxPages);
  getEl<HTMLInputElement>('maxDepth').value = String(opts.crawl.maxDepth);
  getEl<HTMLInputElement>('respectRobots').checked = opts.crawl.respectRobots;
  getEl<HTMLSelectElement>('outputMode').value = opts.output.mode;
  getEl<HTMLInputElement>('filenameTemplate').value = opts.output.filenameTemplate;

  // Save handler
  getEl('save').addEventListener('click', async () => {
    const newOpts: SaveItOptions = {
      capture: {
        removeScripts: getEl<HTMLInputElement>('removeScripts').checked,
        removeHidden: getEl<HTMLInputElement>('removeHidden').checked,
        compressHTML: getEl<HTMLInputElement>('compressHTML').checked,
      },
      crawl: {
        pageDelay: parseInt(getEl<HTMLInputElement>('pageDelay').value) || 1500,
        maxPages: parseInt(getEl<HTMLInputElement>('maxPages').value) || 500,
        maxDepth: parseInt(getEl<HTMLInputElement>('maxDepth').value) || 10,
        respectRobots: getEl<HTMLInputElement>('respectRobots').checked,
      },
      output: {
        mode: getEl<HTMLSelectElement>('outputMode').value as 'single-merged' | 'zip',
        filenameTemplate: getEl<HTMLInputElement>('filenameTemplate').value || '{site}-{date}',
      },
    };

    await saveOptions(newOpts);

    const msg = getEl('savedMsg');
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 2000);
  });
}

init();
