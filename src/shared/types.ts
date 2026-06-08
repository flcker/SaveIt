export interface NavNode {
  url: string;
  title: string;
  depth: number;
  children: NavNode[];
  isExpanded: boolean;
  selected: boolean;
}

export interface CapturedPage {
  url: string;
  title: string;
  navTitle: string;
  html: string;
  depth: number;
  capturedAt: number;
  sizeBytes: number;
}

export type CrawlStatus =
  | 'idle'
  | 'discovering'
  | 'crawling'
  | 'assembling'
  | 'done'
  | 'paused'
  | 'error';

export interface CrawlTask {
  id: string;
  rootUrl: string;
  status: CrawlStatus;
  navTree: NavNode[];
  queue: string[];
  completed: Record<string, CapturedPage>;
  failed: Record<string, { error: string; attempts: number }>;
  startedAt: number;
  options: SaveOptions;
}

export interface SaveOptions {
  output: {
    mode: 'single-merged' | 'zip';
    filename: string;
    maxPages: number;
  };
  capture: {
    removeScripts: boolean;
    removeHiddenElements: boolean;
    compressHTML: boolean;
    lazyLoadTimeout: number;
  };
  navigation: {
    maxDepth: number;
    expandTimeout: number;
    concurrency: number;
    pageDelay: number;
  };
}

export const DEFAULT_SAVE_OPTIONS: SaveOptions = {
  output: {
    mode: 'single-merged',
    filename: '{site}-{date}',
    maxPages: 500,
  },
  capture: {
    removeScripts: true,
    removeHiddenElements: false,
    compressHTML: true,
    lazyLoadTimeout: 5000,
  },
  navigation: {
    maxDepth: 10,
    expandTimeout: 60000,
    concurrency: 1,
    pageDelay: 1500,
  },
};
