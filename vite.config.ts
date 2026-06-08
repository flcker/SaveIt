import { defineConfig, UserConfig } from 'vite';
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

const isChrome = process.env.TARGET === 'chrome';

function extensionPlugin() {
  return {
    name: 'extension-plugin',
    writeBundle() {
      const dist = resolve(__dirname, isChrome ? 'dist-chrome' : 'dist');

      // Copy manifest (Chrome vs Firefox)
      const manifestSrc = isChrome ? 'src/manifest.chrome.json' : 'src/manifest.json';
      copyFileSync(
        resolve(__dirname, manifestSrc),
        resolve(dist, 'manifest.json')
      );

      // Generate background.html (Firefox only — Chrome uses service_worker)
      if (!isChrome) {
        writeFileSync(
          resolve(dist, 'background.html'),
          '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><script type="module" src="./background.js"></script></head><body></body></html>\n'
        );
      }

      // Generate offscreen.html for Chrome
      if (isChrome) {
        const offscreenDir = resolve(dist, 'offscreen');
        if (!existsSync(offscreenDir)) mkdirSync(offscreenDir, { recursive: true });
        writeFileSync(
          resolve(offscreenDir, 'offscreen.html'),
          '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><script type="module" src="./offscreen.js"></script></head><body></body></html>\n'
        );
      }

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

      // Fix HTML entry locations and script paths
      const htmlEntries = [
        { srcDir: 'popup', name: 'popup' },
        { srcDir: 'options', name: 'options' },
      ];
      for (const entry of htmlEntries) {
        const htmlSrc = resolve(dist, 'src', entry.srcDir, `${entry.name}.html`);
        const destDir = resolve(dist, entry.srcDir);
        if (existsSync(htmlSrc)) {
          if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
          let html = readFileSync(htmlSrc, 'utf-8');
          html = html.replace(/src="[^"]*?(\w+)\.js"/, `src="./${entry.name}.js"`);
          html = html.replace(/ crossorigin/g, '');
          writeFileSync(resolve(destDir, `${entry.name}.html`), html);
        }
      }

      // Clean up dist/src/
      const distSrc = resolve(dist, 'src');
      if (existsSync(distSrc)) {
        rmSync(distSrc, { recursive: true, force: true });
      }
    },
  };
}

const baseInput: Record<string, string> = {
  background: resolve(__dirname, 'src/background/index.ts'),
  content: resolve(__dirname, 'src/content/index.ts'),
  injected: resolve(__dirname, 'src/injected/spa-hooks.ts'),
  'options/options': resolve(__dirname, 'src/options/options.html'),
  'popup/popup': resolve(__dirname, 'src/popup/popup.html'),
};

if (isChrome) {
  baseInput['offscreen/offscreen'] = resolve(__dirname, 'src/offscreen/offscreen.ts');
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
    outDir: isChrome ? 'dist-chrome' : 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: baseInput,
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    target: isChrome ? 'chrome118' : 'firefox115',
    minify: false,
    sourcemap: true,
  },
} as UserConfig);
