// Turns spoken pitch text into a structured spec. Pure functions; heuristics only, no AI.
import { GENRES, MECHANISMS, RETENTION } from './roblox.js';
import { hasWord, hits, sentences, tokens, titleCase, uniq, wordCount } from './util.js';

const BUCKETS = {
  loop: ['collect', 'earn', 'upgrade', 'unlock', 'fight', 'survive', 'escape', 'build', 'trade', 'race', 'hatch', 'rebirth', 'grind', 'defend', 'jump', 'solve', 'craft', 'mine', 'farm', 'level up', 'complete', 'explore', 'hide', 'chase', 'steal', 'run'],
  hook: ['unique', 'different', 'twist', 'unlike', 'but with', 'what if', 'nobody', 'no one', 'never seen', 'new take', 'imagine', 'combines', 'mix', 'mashup', 'the catch', 'except', 'instead of'],
  audience: ['kids', 'teens', 'players who', 'fans of', 'audience', 'years old', 'younger', 'older', 'casual', 'hardcore', 'people who', 'girls', 'boys', 'for anyone'],
  session: ['minute', 'minutes', 'round', 'rounds', 'session', 'match', 'matches'],
  social: ['friends', 'multiplayer', 'co-op', 'coop', 'party', 'trade', 'trading', 'clan', 'together', 'invite', 'teams', 'squad'],
  scope: ['solo', 'by myself', 'alone', 'team', 'weeks', 'months', 'mvp', 'prototype', 'scripter', 'builder', 'modeller', 'modeler', 'artist', 'first version'],
};
const BIG_SCOPE = ['mmo', 'open world', 'huge map', 'massive', 'hundreds of', 'aaa', 'every genre', 'whole universe', 'infinite'];
const P2W = ['pay to win', 'pay-to-win', 'buy power', 'stronger if you pay', 'paid weapons', 'buy the best', 'op weapons'];
const FREE = ['free', 'no robux', 'no microtransactions', 'no monetization'];
const CONVERSION = ['percent', '%', 'dau', 'ccu', 'conversion', 'payers', 'per player', 'per day', 'a day'];
const GENERIC = new Set(['game', 'games', 'roblox', 'new', 'cool', 'fun', 'simple', 'little', 'big', 'kind', 'sort', 'type', 'basically', 'called', 'named', 'pitch', 'idea']);

export function emptySpec() {
  return { genres: [], loop: [], hook: [], audience: [], retention: [], retentionText: [], monetization: { mechanisms: [], prices: [], text: [], free: false, p2w: false, conversion: false },
    session: [], sessionMinutes: null, social: [], scope: [], bigScope: false, economy: false, chat: false, words: 0 };
}

export function detectGenres(text) {
  const t = text.toLowerCase();
  return Object.entries(GENRES).filter(([, g]) => g.words.some((w) => hasWord(t, w))).map(([id]) => id);
}

export function extractSpec(text) {
  const spec = emptySpec();
  const t = String(text);
  const lower = t.toLowerCase();
  spec.words = wordCount(t);
  spec.genres = detectGenres(t);
  for (const s of sentences(t)) {
    for (const [bucket, words] of Object.entries(BUCKETS)) if (hits(s, words).length) spec[bucket].push(s);
    if (Object.values(MECHANISMS).some((m) => hits(s, m.words).length) || /robux|monetiz|monetis/i.test(s)) spec.monetization.text.push(s);
    if (Object.values(RETENTION).some((r) => hits(s, r.words).length)) spec.retentionText.push(s);
  }
  spec.retention = Object.entries(RETENTION).filter(([, r]) => hits(lower, r.words).length).map(([id]) => id);
  const m = spec.monetization;
  m.mechanisms = Object.entries(MECHANISMS).filter(([, x]) => hits(lower, x.words).length).map(([id]) => id);
  m.prices = [...lower.matchAll(/(\d{1,5})\s*(?:robux|r\$)/g)].map((x) => +x[1]);
  m.free = hits(lower, FREE).length > 0 && !m.mechanisms.length;
  m.p2w = hits(lower, P2W).length > 0;
  m.conversion = hits(lower, CONVERSION).length > 0;
  const mins = lower.match(/(\d{1,3})\s*(?:-|to)?\s*(?:\d{1,3}\s*)?minutes?/);
  spec.sessionMinutes = mins ? +mins[1] : null;
  spec.bigScope = hits(lower, BIG_SCOPE).length > 0;
  spec.economy = /\b(coins|cash|gems|currency|money|trade|trading|shop|market)\b/.test(lower);
  spec.chat = /\b(chat|voice chat|trade|trading|ugc|messages?)\b/.test(lower);
  return spec;
}

export function mergeSpec(a, b) {
  const out = emptySpec();
  for (const k of ['genres', 'loop', 'hook', 'audience', 'retention', 'retentionText', 'session', 'social', 'scope']) out[k] = uniq([...(a[k] || []), ...(b[k] || [])]);
  out.monetization = {
    mechanisms: uniq([...a.monetization.mechanisms, ...b.monetization.mechanisms]),
    prices: uniq([...a.monetization.prices, ...b.monetization.prices]),
    text: uniq([...a.monetization.text, ...b.monetization.text]),
    free: (a.monetization.free || b.monetization.free) && !(a.monetization.mechanisms.length || b.monetization.mechanisms.length),
    p2w: a.monetization.p2w || b.monetization.p2w,
    conversion: a.monetization.conversion || b.monetization.conversion,
  };
  out.sessionMinutes = b.sessionMinutes ?? a.sessionMinutes;
  out.bigScope = a.bigScope || b.bigScope;
  out.economy = a.economy || b.economy;
  out.chat = a.chat || b.chat;
  out.words = (a.words || 0) + (b.words || 0);
  return out;
}

// A revision replaces the genre if a new one is named, and keeps everything else additive.
export function reviseSpec(prev, text) {
  const next = extractSpec(text);
  const merged = mergeSpec(prev, next);
  if (next.genres.length) merged.genres = next.genres;
  if (next.hook.length) merged.hook = uniq([...next.hook, ...prev.hook]);
  return merged;
}

export function changedFields(a, b) {
  const f = [];
  const diff = (x, y) => JSON.stringify(x) !== JSON.stringify(y);
  if (diff(a.genres, b.genres)) f.push('genre');
  for (const k of ['loop', 'hook', 'audience', 'retention', 'scope', 'social']) if (diff(a[k], b[k])) f.push(k);
  if (diff(a.monetization.mechanisms, b.monetization.mechanisms) || diff(a.monetization.prices, b.monetization.prices)) f.push('monetization');
  return f;
}

export function titleFrom(text) {
  const m = String(text).match(/\b(?:it'?s|is|game is|i'?m calling it|we call it)?\s*(?:called|named|titled)\s+["“']?([a-z0-9][\w' -]{1,48}?)["”']?(?=[.,!?;:]|\s+(?:and|where|which|it|its|it's|you|that|about|is|in|a)\b|$)/i);
  if (!m) return null;
  const words = m[1].trim().split(/\s+/).slice(0, 5).join(' ');
  return titleCase(words);
}

export function autoTitle(text, genres) {
  const g = genres[0] && GENRES[genres[0]];
  const lower = String(text).toLowerCase();
  if (g) {
    for (const w of g.words) {
      const idx = lower.search(new RegExp(`(?<![a-z])${w.replace(/\s+/g, '\\s+')}(?![a-z])`));
      if (idx < 0) continue;
      const before = tokens(lower.slice(Math.max(0, idx - 40), idx)).filter((x) => !GENERIC.has(x)).slice(-2);
      return titleCase([...before, g.label.split(' /')[0]].join(' '));
    }
    return `Untitled ${g.label.split(' /')[0]}`;
  }
  const content = tokens(lower).filter((x) => !GENERIC.has(x)).slice(0, 2);
  return content.length ? titleCase(content.join(' ')) + ' Game' : 'Untitled Pitch';
}
