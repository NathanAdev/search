// Instant reactions that never wait for the AI: mid-pitch heckles and crowd chatter while you talk.
import { GENRES } from './roblox.js';

const HECKLES = [
  { key: 'tycoon', re: /\btycoon\b/i, who: 'critic', text: 'Another tycoon. Bold.' },
  { key: 'simulator', re: /\bsimulator\b/i, who: 'critic', text: 'A simulator. Groundbreaking.' },
  { key: 'obby', re: /\bobby\b/i, who: 'critic', text: 'An obby? In this economy?' },
  { key: 'free', re: /\b(?:for )?free\b/i, who: 'monetizer', text: 'Free? How do we eat?', unless: (p) => p.spec.monetization.mechanisms.length > 0 },
  { key: 'p2w', re: /pay[ -]to[ -]win/i, who: 'monetizer', text: 'Pay-to-win... careful.' },
  { key: 'scope', re: /\bmmo\b|open world|massive map/i, who: 'critic', text: 'With what team?' },
  { key: 'bpass', re: /battle pass|season pass/i, who: 'monetizer', text: "Battle pass. Now I'm listening." },
  { key: 'gpass', re: /game ?pass/i, who: 'monetizer', text: 'Game pass. Go on.' },
  { key: 'pets', re: /\bpets?\b/i, who: 'hype', text: 'PETS!' },
  { key: 'trade', re: /\btrad(?:e|ing)\b/i, who: 'critic', text: 'Exploiters love trading.' },
  { key: 'spooky', re: /\b(?:horror|scary|haunted|ghosts?)\b/i, who: 'hype', text: 'Ooh, spooky!' },
  { key: 'ai', re: /\b(?:a\.?i\.?|chatgpt|llm)\b/i, who: 'critic', text: "Please don't say AI." },
  { key: 'twist', re: /\b(?:twist|unlike|what if)\b/i, who: 'wrestler', text: 'Oh, a twist. Let me hear it.' },
];

export function heckle(text, pitch, now, state, minGapMs = 9000) {
  if (!pitch || now - (state.lastHeckleAt || 0) < minGapMs) return null;
  pitch.heckled = pitch.heckled || [];
  for (const h of HECKLES) {
    if (pitch.heckled.includes(h.key) || !h.re.test(text) || (h.unless && h.unless(pitch))) continue;
    pitch.heckled.push(h.key);
    state.lastHeckleAt = now;
    return { who: h.who, text: h.text, kind: 'heckle' };
  }
  return null;
}

const ORDER = ['wrestler', 'monetizer', 'critic', 'hype'];
export function chatter(pitch, state) {
  if (!pitch) return null;
  const spec = pitch.spec;
  const genre = spec.genres[0] ? GENRES[spec.genres[0]].label.split(' /')[0].toLowerCase() : 'thing';
  const options = {
    monetizer: spec.monetization.mechanisms.length ? [`${spec.monetization.mechanisms.length} way${spec.monetization.mechanisms.length > 1 ? 's' : ''} to make Robux so far. Noted.`] : ["No price yet. I'm counting.", 'Still waiting to hear about Robux.'],
    critic: [spec.retention.length < 2 ? 'Still no reason to come back tomorrow.' : 'Okay, there are hooks. Do they work?', spec.hook.length ? 'The twist had better hold up.' : 'Nothing new so far.'],
    wrestler: [`I'd flip this ${genre}. Hold on, I'm thinking.`, 'There are two games in here fighting each other.'],
    hype: ['I like where this is going!', `A ${genre}! I can already see the thumbnail.`],
  };
  const i = (state.chatterIdx = ((state.chatterIdx ?? -1) + 1) % ORDER.length);
  const who = ORDER[i];
  const list = options[who];
  const text = list[(state.chatterRound = (state.chatterRound || 0) + 1) % list.length];
  const to = ORDER[(i + 1) % ORDER.length];
  return { who, to, text, kind: 'chat' };
}
