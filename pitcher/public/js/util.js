// Small helpers shared by the browser app and the Node tests. No DOM access at import time.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STOP = new Set(('a an the and or of for to in on with your my our app game games roblox that this it its is are be by from as at into can who what how per ' +
  'so then than there their they them we you i me he she his her was were will would just really very like have has had do does did not but if when while which where ' +
  'about over also some any all one two more most make made get got going gonna want wants need needs think thought know say said yeah okay um uh').split(' '));

export const wordCount = (text) => (String(text).trim().match(/\S+/g) || []).length;

export function tokens(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, '')).filter((w) => w.length > 2 && !STOP.has(w));
}

export function jaccard(a, b) {
  const A = a instanceof Set ? a : new Set(a);
  const B = b instanceof Set ? b : new Set(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
}

const reCache = new Map();
function wordRe(kw) {
  let re = reCache.get(kw);
  if (!re) {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    re = new RegExp(`(?<![a-z0-9])${esc}(?![a-z0-9])`, 'i');
    reCache.set(kw, re);
  }
  return re;
}
export const hasWord = (text, kw) => wordRe(kw).test(text);
// Distinct keywords from the list that appear in the text.
export const hits = (text, list) => list.filter((kw) => hasWord(text, kw));

export function sentences(text) {
  return String(text).replace(/\s+/g, ' ').split(/(?<=[.!?])\s+|\s+(?=(?:and then|then|also|plus|but)\b)/i).map((s) => s.trim()).filter(Boolean);
}

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const titleCase = (s) => String(s).replace(/\s+/g, ' ').trim().replace(/\b([a-z])([a-z']*)/gi, (_, a, b) => a.toUpperCase() + b.toLowerCase());
export const uniq = (arr) => [...new Set(arr)];
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

let counter = 0;
export const uid = (prefix) => `${prefix}${(++counter).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
export const joinList = (arr) => (arr.length <= 1 ? arr.join('') : arr.length === 2 ? arr.join(' and ') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);
export const cap1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
