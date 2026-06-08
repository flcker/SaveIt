import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { resolve } from 'path';
import {
  copyFileSync,
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'fs';

function extensionPlugin() {
  return {
    name: 'extension-plugin',
    writeBundle() {
      const dist = resolve(__dirname, 'dist');

      // Copy manifest
      copyFileSync(
        resolve(__dirname, 'src/manifest.json'),
        resolve(dist, 'manifest.json')
      );

      // Generate background.html
      writeFileSync(
        resolve(dist, 'background.html'),
        '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><script type="module" src="./background.js"></script></head><body></body></html>\n'
      );

      // Copy icons
      const iconsDir = resolve(dist, 'icons');
      if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
      const srcIcons = resolve(__dirname, 'src/icons');
      if (existsSync(srcIcons)) {
        for (const size of ['16', '32', '48', '128']) {
          const file = `icon-${size}.png`;
          const src = resolve(srcIcons, file);
          if (existsSync(src)) copyFileSync(src, resolve(iconsDir, file));
        }
      }

      // Fix popup HTML location and paths
      const popupHtmlSrc = resolve(dist, 'src', 'popup', 'popup.html');
      const popupDestDir = resolve(dist, 'popup');
      if (existsSync(popupHtmlSrc)) {
        if (!existsSync(popupDestDir)) mkdirSync(popupDestDir, { recursive: true });
        let html = readFileSync(popupHtmlSrc, 'utf-8');
        html = html.replace(/src="[^"]*popup\.js"/, 'src="./popup.js"');
        html = html.replace(/ crossorigin/g, '');
        writeFileSync(resolve(popupDestDir, 'popup.html'), html);
      }

      // Clean up dist/src/
      const distSrc = resolve(dist, 'src');
      if (existsSync(distSrc)) {
        rmSync(distSrc, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [solidPlugin(), extensionPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        content: resolve(__dirname, 'src/content/index.ts'),
        injected: resolve(__dirname, 'src/injected/spa-hooks.ts'),
        'popup/popup': resolve(__dirname, 'src/popup/popup.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    target: 'firefox115',
    minify: false,
    sourcemap: true,
  },
});
