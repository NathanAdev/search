// The Monetizer's rubric: transparent points, so the verdict can be argued with.
import { CREATOR_SHARE, DEVEX_USD_PER_ROBUX, GENRES, MECHANISMS } from './roblox.js';
import { clamp } from './util.js';

export const VERDICTS = { greenlit: 'GREENLIT', maybe: 'MAYBE', pass: 'PASS' };

export function scoreMonetization(spec, answered = new Set()) {
  const r = [];
  const add = (d, text) => r.push({ d, text });
  const m = spec.monetization;
  let score = 30;
  if (!m.mechanisms.length) add(-15, 'no way to make Robux named yet');
  else add(Math.min(18, m.mechanisms.length * 6), `named ${m.mechanisms.map((x) => MECHANISMS[x].label.toLowerCase()).join(', ')}`);
  if (m.prices.length) add(6, `price points given (${m.prices.join(', ')} R$)`);
  if (m.conversion || answered.has('payers')) add(6, 'thought about who actually pays');
  if (spec.audience.length || answered.has('audience')) add(5, 'clear audience');
  if (spec.loop.length >= 2 || answered.has('loop')) add(6, 'core loop is concrete');
  if (spec.retention.length) add(Math.min(10, spec.retention.length * 3), `retention levers: ${spec.retention.length}`);
  else add(-6, 'no reason to come back tomorrow');
  if (spec.social.length) add(5, 'social or viral hooks');
  if (spec.hook.length || answered.has('saturation')) add(6, 'has a differentiator');
  const sat = spec.genres.map((g) => GENRES[g]?.saturation);
  if ((sat.includes('extreme') || sat.includes('high')) && !spec.hook.length && !answered.has('saturation')) add(-6, 'crowded genre with no twist');
  if (m.p2w && !answered.has('fairness')) add(-8, 'pay-to-win risk');
  if (m.free) add(-10, 'says it is free with nothing to sell');
  if (spec.bigScope && !answered.has('scope')) add(-8, 'scope looks bigger than a small team');
  if (spec.sessionMinutes) add(3, `session length thought through (~${spec.sessionMinutes} min)`);
  score = clamp(score + r.reduce((s, x) => s + x.d, 0), 0, 100);
  return { score, verdict: score >= 72 ? VERDICTS.greenlit : score >= 50 ? VERDICTS.maybe : VERDICTS.pass, reasons: r };
}

// Back-of-envelope daily revenue. Every input is an assumption the pitcher can change by saying a number.
export function revenueSketch(spec, { dau = 1000, payRate = 0.02 } = {}) {
  const prices = spec.monetization.prices;
  const price = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 99;
  const grossRobux = Math.round(dau * payRate * price);
  const netRobux = Math.round(grossRobux * CREATOR_SHARE);
  const usd = Math.round(netRobux * DEVEX_USD_PER_ROBUX * 100) / 100;
  const fmt = (n) => n.toLocaleString('en-US');
  return { dau, payRate, price, grossRobux, netRobux, usd,
    text: `At ${fmt(dau)} daily players with ${Math.round(payRate * 100)}% paying ${price} R$, that is about ${fmt(grossRobux)} R$ a day, ${fmt(netRobux)} after Roblox's cut, roughly ${usd.toFixed(2)} USD a day at DevEx. All of those are assumptions.` };
}
