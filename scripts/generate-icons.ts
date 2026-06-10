/**
 * Generate extension icons from source PNG.
 * Usage: npx tsx scripts/generate-icons.ts [source-image]
 * Default source: scripts/icon-source.png or first .png in project root
 */

import sharp from 'sharp';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '../src/icons');
const SIZES = [16, 32, 48, 128];

// Find source image
const args = process.argv.slice(2);
const sourcePaths = [
  args[0],
  resolve(__dirname, 'icon-source.png'),
  resolve(__dirname, '../icon-source.png'),
  'D:\\Users\\Downloads\\SaveIt浏览器插件图标生成.png',
].filter(Boolean) as string[];

let sourceFile: string | null = null;
for (const p of sourcePaths) {
  if (existsSync(p)) {
    sourceFile = p;
    break;
  }
}

if (!sourceFile) {
  console.error('No source image found. Pass path as argument:');
  console.error('  npx tsx scripts/generate-icons.ts path/to/icon.png');
  process.exit(1);
}

if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });

console.log(`Source: ${sourceFile}`);

for (const size of SIZES) {
  const output = resolve(iconsDir, `icon-${size}.png`);
  await sharp(sourceFile)
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(output);
  console.log(`Generated: icon-${size}.png (${size}x${size})`);
}

console.log('Done!');
