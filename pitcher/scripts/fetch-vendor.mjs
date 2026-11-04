// Downloads the open-source speech runtimes Pitcher uses into public/vendor/, verified against pinned hashes.
// Runs once at install time. Pure Node, nothing installed globally, no node_modules.
//   kokoro-js 1.2.1 (Apache-2.0): Kokoro text-to-speech for the crowd's voices
//   @huggingface/transformers 3.5.1 (Apache-2.0): runs Whisper speech recognition, plus the ONNX runtime both use
// The speech models themselves are downloaded by the browser from Hugging Face on first use and cached there.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'vendor');
export const PACKAGES = [
  { name: 'kokoro-js', version: '1.2.1', integrity: 'sha512-oq0HZJWis3t8lERkMJh84WLU86dpYD0EuBPtqYnLlQzyFP1OkyBRDcweAqCfhNOpltyN9j/azp1H6uuC47gShw==',
    files: { 'package/dist/kokoro.web.js': 'kokoro.web.js', 'package/LICENSE': 'LICENSE-kokoro-js' } },
  { name: '@huggingface/transformers', version: '3.5.1', integrity: 'sha512-qWsPoJMBPYcrGuzRMVL//3dwcLXED9r+j+Hzw+hZpBfrMPdyq57ehNs7lew0D34Paj0DO0E0kZQjOZcIVN17hQ==',
    files: { 'package/dist/transformers.min.js': 'transformers.min.js', 'package/dist/ort-wasm-simd-threaded.jsep.wasm': 'ort-wasm-simd-threaded.jsep.wasm',
      'package/dist/ort-wasm-simd-threaded.jsep.mjs': 'ort-wasm-simd-threaded.jsep.mjs', 'package/LICENSE': 'LICENSE-transformers' } },
];

// Minimal tar reader: 512-byte headers, ustar names, regular files only.
export function untar(buf) {
  const files = new Map();
  let off = 0;
  let longName = null;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every((b) => b === 0)) break;
    const str = (a, b) => h.subarray(a, b).toString('utf8').replace(/\0.*$/s, '');
    let name = str(0, 100);
    const prefix = str(345, 500);
    if (prefix) name = `${prefix}/${name}`;
    const size = parseInt(str(124, 136).trim() || '0', 8);
    const type = String.fromCharCode(h[156] || 48);
    const body = buf.subarray(off + 512, off + 512 + size);
    if (type === 'L') longName = body.toString('utf8').replace(/\0.*$/s, '');
    else {
      if (longName) { name = longName; longName = null; }
      if (type === '0' || type === '\0') files.set(name, Buffer.from(body));
    }
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

const tarballUrl = (p) => `https://registry.npmjs.org/${p.name}/-/${p.name.split('/').pop()}-${p.version}.tgz`;

export async function fetchVendor({ out = OUT, log = console.log, fetchImpl = fetch } = {}) {
  mkdirSync(out, { recursive: true });
  const manifestFile = join(out, 'manifest.json');
  const have = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};
  for (const p of PACKAGES) {
    const key = `${p.name}@${p.version}`;
    if (have[key] && Object.values(p.files).every((f) => existsSync(join(out, f)))) { log(`ok      ${key} (already here)`); continue; }
    log(`fetch   ${key}`);
    const res = await fetchImpl(tarballUrl(p));
    if (!res.ok) throw new Error(`${key}: registry answered ${res.status}`);
    const tgz = Buffer.from(await res.arrayBuffer());
    const [algo, want] = p.integrity.split('-');
    const got = createHash(algo).update(tgz).digest('base64');
    if (got !== want) throw new Error(`${key}: integrity check failed, refusing to use it`);
    const files = untar(gunzipSync(tgz));
    for (const [from, to] of Object.entries(p.files)) {
      const body = files.get(from);
      if (!body) throw new Error(`${key}: ${from} missing from the package`);
      writeFileSync(join(out, to), body);
    }
    have[key] = { integrity: p.integrity, at: new Date().toISOString() };
    log(`ok      ${key} (verified)`);
  }
  writeFileSync(manifestFile, JSON.stringify(have, null, 1));
  return have;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  fetchVendor().then(() => console.log(`Speech runtimes ready in ${OUT}`)).catch((e) => { console.error(`Could not fetch speech runtimes: ${e.message}`); process.exit(1); });
}
