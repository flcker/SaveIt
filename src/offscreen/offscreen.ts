/**
 * Offscreen Document for Chrome MV3.
 * Provides DOMParser and page processing capabilities that
 * Service Workers lack.
 */

import { saveCurrentPage } from '../background/page-capture';
import { assembleMergedHtml } from '../background/output-assembler';
import type { CapturedPage } from '@/shared/types';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case 'offscreen.capturePage':
      handleCapturePage(message).then(
        (result) => sendResponse({ success: true, data: result }),
        (err) => sendResponse({ success: false, error: String(err) })
      );
      return true;

    case 'offscreen.assembleSite':
      handleAssemble(message).then(
        (result) => sendResponse({ success: true, data: result }),
        (err) => sendResponse({ success: false, error: String(err) })
      );
      return true;
  }
});

async function handleCapturePage(message: {
  html: string;
  url: string;
  options: { removeScripts?: boolean; compressHTML?: boolean };
}) {
  const result = await saveCurrentPage(message.html, message.url, message.options);
  return {
    url: result.url,
    title: result.title,
    html: result.content,
    sizeBytes: result.content.length,
  };
}

async function handleAssemble(message: { pages: CapturedPage[] }) {
  const html = assembleMergedHtml(message.pages);
  return { html, sizeBytes: html.length };
}
