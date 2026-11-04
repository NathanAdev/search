// Renders the app icons (PNG and Windows .ico) from the mascot pixel sprite. Pure Node: a tiny PNG encoder on zlib.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SPRITE = [
  '................',
  '................',
  '....OOOOOOOO....',
  '...OHHOOOOOOS...',
  '..OHOOOOOOOOOS..',
  '..OOOKKOOKKOOS..',
  '.SOOOKKOOKKOOSS.',
  '.SOOOOOOOOOOOSS.',
  '..OOOOOKKOOOOS..',
  '..OOOOOOOOOOSS..',
  '...OOOOOOOOSS...',
  '....SSSSSSSS....',
  '....OO....OO....',
  '....OO....OO....',
  '....SS....SS....',
  '................',
];
const PAL = { O: [217, 119, 87], H: [236, 150, 118], S: [166, 85, 58], K: [29, 27, 34] };
const BG = [26, 20, 34];

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function iconPng(size) {
  const cell = size / 16;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const r = size * 0.22; // rounded tile corners
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const ch = SPRITE[Math.floor(y / cell)][Math.floor(x / cell)];
      const dx = Math.max(0, r - x, x - (size - 1 - r)), dy = Math.max(0, r - y, y - (size - 1 - r));
      const inside = dx * dx + dy * dy <= r * r;
      const c = ch === '.' ? BG : PAL[ch];
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = inside ? 255 : 0;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// .ico that wraps PNG images (supported since Windows Vista).
export function iconIco(sizes) {
  const pngs = sizes.map(iconPng);
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach((p, i) => {
    const e = 6 + 16 * i; const s = sizes[i] >= 256 ? 0 : sizes[i];
    head[e] = s; head[e + 1] = s; head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(p.length, e + 8); head.writeUInt32LE(off, e + 12);
    off += p.length;
  });
  return Buffer.concat([head, ...pngs]);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = join(ROOT, 'public', 'icons');
  mkdirSync(dir, { recursive: true });
  for (const s of [192, 512]) writeFileSync(join(dir, `icon-${s}.png`), iconPng(s));
  writeFileSync(join(ROOT, 'install', 'pitcher.ico'), iconIco([16, 32, 48, 256]));
  console.log('icons written');
}
