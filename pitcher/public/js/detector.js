// Decides what a finished speech segment means: a new pitch, a change to the current one, the end, or more of the same.
import { detectGenres } from './extract.js';
import { jaccard, tokens, wordCount } from './util.js';

const NEW_CUES = [
  /\b(?:next|another|second|third|fourth|new|different|other)\s+(?:pitch|idea|game|concept)\b/i,
  /\bmy\s+(?:next|other|second|last)\s+(?:one|idea|pitch|game)\b/i,
  /\b(?:pitch|idea|game)\s+(?:number|no\.?|#)\s*(?:two|three|four|\d)\b/i,
  /\b(?:moving on|switching gears|on to the next|okay next|alright next|now for something (?:completely )?different)\b/i,
  /\blet me pitch (?:you )?(?:another|something else|a second)\b/i,
];
const REVISE_CUES = [
  /\b(?:actually|instead|scrap that|scratch that|forget that|on second thought)\b/i,
  /\b(?:let me|let's|i'?ll|i will|i want to|we could|we can)\s+(?:change|switch|rework|redo|swap|make it|make the)\b/i,
  /\b(?:change|changing|switch|switching)\s+(?:it|the game|the pitch|the idea|that)\s+(?:to|so|into)\b/i,
  /\brather than\b/i,
  /\bnew version\b/i,
];
const END_CUES = /\b(?:that'?s (?:it|my pitch|the pitch|all|everything)|that concludes|any questions|thank you(?: all| everyone)?[.!]?$|i'?m done|end of (?:my )?pitch)\b/i;
const INTRO = /\b(?:it'?s a|its a|the game is|imagine|what if|a game (?:where|about)|game called|it'?s called|picture this|so basically)\b/i;
const AFFIRM = /^(?:\s*(?:yes|yeah|yep|sure|ok(?:ay)?|deal|fine|love it|i like (?:that|it)|let'?s do (?:that|it)|do it|good idea|great idea|that works|sounds good|take it|i'?ll take (?:that|it))\b)/i;
const REJECT = /^(?:\s*(?:no|nah|nope|not really|i don'?t (?:like|think)|that'?s not it|keep it))\b/i;

export const isEndCue = (text) => END_CUES.test(text.trim());
export const isAffirmation = (text) => AFFIRM.test(text) && !REJECT.test(text);
export const isRejection = (text) => REJECT.test(text);

// ctx: { active: null | { genres: string[], tokens: Set<string>, segments: number }, awaitingAnswer: boolean }
export function classify(text, ctx = {}) {
  const n = wordCount(text);
  const active = ctx.active;
  if (!active) {
    if (n >= 6 || detectGenres(text).length) return { action: 'new', confidence: 0.9, reason: 'first pitch' };
    return { action: 'ignore', confidence: 0.6, reason: 'too short to be a pitch' };
  }
  if (NEW_CUES.some((re) => re.test(text))) return { action: 'new', confidence: 0.95, reason: 'said it is a new pitch' };
  if (REVISE_CUES.some((re) => re.test(text))) return { action: 'revise', confidence: 0.85, reason: 'changed the pitch' };
  const segGenres = detectGenres(text);
  const intro = INTRO.test(text);
  if (!ctx.awaitingAnswer && intro && segGenres.length && active.genres.length && !segGenres.some((g) => active.genres.includes(g)) && active.segments >= 2) {
    return { action: 'new', confidence: 0.7, reason: 'introduced a different genre' };
  }
  if (!ctx.awaitingAnswer && intro && n >= 14 && active.segments >= 3 && jaccard(tokens(text), active.tokens) < 0.04) {
    return { action: 'new', confidence: 0.6, reason: 'new topic with an introduction' };
  }
  return { action: 'continue', confidence: 0.8, reason: ctx.awaitingAnswer ? 'answering' : 'more detail', end: isEndCue(text) };
}
