/**
 * Generate placeholder PNG icons for the extension.
 * Run with: npx tsx scripts/generate-icons.ts
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '../src/icons');

if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });

const SIZES = [16, 32, 48, 128];

function createPng(size: number): Buffer {
  const ihdr = createChunk('IHDR', createIHDRData(size, size));
  const idat = createChunk('IDAT', createIDATData(size, size));
  const iend = createChunk('IEND', Buffer.alloc(0));
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createIHDRData(w: number, h: number): Buffer {
  const buf = Buffer.alloc(13);
  buf.writeUInt32BE(w, 0);
  buf.writeUInt32BE(h, 4);
  buf[8] = 8;  // bit depth
  buf[9] = 2;  // RGB
  buf[10] = 0; // compression
  buf[11] = 0; // filter
  buf[12] = 0; // interlace
  return buf;
}

function createIDATData(w: number, h: number): Buffer {
  // Create raw pixel data: each row has filter byte (0) + RGB pixels
  const rowSize = 1 + w * 3;
  const raw = Buffer.alloc(rowSize * h);
  for (let y = 0; y < h; y++) {
    const offset = y * rowSize;
    raw[offset] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const px = offset + 1 + x * 3;
      // Blue color #2563eb
      raw[px] = 0x25;
      raw[px + 1] = 0x63;
      raw[px + 2] = 0xeb;
    }
  }
  return deflateSync(raw);
}

function createChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBytes = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBytes, data]);
  const crc = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, body, crcBuf]);
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

for (const size of SIZES) {
  const png = createPng(size);
  const path = resolve(iconsDir, `icon-${size}.png`);
  writeFileSync(path, png);
  console.log(`Generated: icon-${size}.png (${png.length} bytes)`);
}

console.log('Done!');
