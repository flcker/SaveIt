import type { NavNode, CapturedPage, CrawlTask, SaveOptions } from './types';

export type SaveItMessage =
  | { type: 'popup.savePage' }
  | { type: 'popup.startDiscover' }
  | { type: 'popup.startCrawl'; selectedUrls: string[] }
  | { type: 'popup.pauseCrawl' }
  | { type: 'popup.cancelCrawl' }
  | { type: 'content.getSnapshot' }
  | { type: 'content.snapshotReady'; html: string; url: string; title: string }
  | { type: 'content.discoverNav' }
  | { type: 'content.navDiscovered'; nodes: NavNode[] }
  | { type: 'content.waitForReady'; contentSelector: string; timeout: number }
  | { type: 'content.ready' }
  | { type: 'bg.progress'; completed: number; total: number; currentUrl: string }
  | { type: 'bg.saveComplete'; filename: string }
  | { type: 'bg.error'; error: string }
  | { type: 'bg.status'; status: string };

export type MessageResponse =
  | { success: true; data?: unknown }
  | { success: false; error: string };
