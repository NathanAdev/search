// Builds dist/Pitcher-<version>.zip: just what Pitcher needs to run, plus the installers. No tests, no saved data.
// Includes the verified speech runtimes (fetched first if missing) so the installed app works offline from day one.
// Usage: node scripts/package.mjs [--no-vendor]
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { fetchVendor } from './fetch-vendor.mjs';
import { ideasMarkdown } from '../public/js/ideas.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INCLUDE = ['server.js', 'package.json', 'README.md', 'IDEAS.md', 'lib', 'public', 'scripts/fetch-vendor.mjs', 'install'];
const SKIP = (rel) => /(^|\/)\.gitignore$/.test(rel) || rel.startsWith('public/vendor/') && !withVendor;
const withVendor = !process.argv.includes('--no-vendor');

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

function walk(p, out) {
  const st = statSync(p);
  if (st.isDirectory()) for (const f of readdirSync(p).sort()) walk(join(p, f), out);
  else out.push(p);
  return out;
}

export function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const dosTime = 0, dosDate = (2026 - 1980) << 9 | 1 << 5 | 1; // fixed timestamp: reproducible zips
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflated = deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(useDeflate ? 8 : 0, 8);
    lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(useDeflate ? 8 : 0, 10);
    ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += lh.length + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(join(ROOT, 'IDEAS.md'), ideasMarkdown());
  if (withVendor) await fetchVendor({ log: () => {} });
  const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
  const files = INCLUDE.flatMap((p) => walk(join(ROOT, p), [])).map((abs) => ({ abs, rel: relative(ROOT, abs).split(sep).join('/') })).filter((f) => !SKIP(f.rel));
  const entries = files.map((f) => ({ name: `Pitcher/${f.rel}`, data: readFileSync(f.abs) }));
  entries.push({ name: 'Pitcher/data/.keep', data: Buffer.alloc(0) });
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  const out = join(ROOT, 'dist', `Pitcher-${version}.zip`);
  const buf = zip(entries);
  writeFileSync(out, buf);
  console.log(`${out}  (${(buf.length / 1048576).toFixed(1)} MB, ${entries.length} files${withVendor ? ', speech runtimes included' : ''})`);
}
