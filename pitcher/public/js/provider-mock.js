// Scripted crowd: decides what the four claudes say, ask and accept. Same contract as the real-AI provider.
import { CATEGORIES, expertId, expertQuestionKeywords, isExpert } from './categories.js';
import { GENRES, MECHANISMS, TOPICS } from './roblox.js';
import { revenueSketch, scoreMonetization } from './scoring.js';
import { buildUnderstanding } from './understanding.js';
import { hits, joinList, mulberry32, wordCount } from './util.js';

const HEART = ['heart', 'core', 'main', 'mostly', 'focus', 'cut', 'drop', 'priority', 'center', 'centre', 'really about', 'its about', "it's about", 'the point'];
const SOLO_GENRES = ['roleplay', 'party', 'fighting', 'shooter', 'sports'];

export function evaluateAnswer(topic, text) {
  const words = wordCount(text);
  const list = topic === 'heart' ? HEART : TOPICS[topic] || expertQuestionKeywords(topic)?.keywords || [];
  const kw = hits(text, list);
  const nums = /\d/.test(text);
  const ok = words >= 6 && (kw.length >= 2 || (kw.length >= 1 && (nums || words >= 14)));
  return { ok, strong: ok && kw.length >= 3 && words >= 12, hits: kw };
}

const TOPIC_LABEL = { saturation: 'the twist', loop: 'the core loop', retention: 'retention', onboarding: 'the first 30 seconds', scope: 'scope', exploits: 'exploiters',
  social: 'empty servers', safety: 'safety', monetize: 'monetization', price: 'prices', payers: 'who pays', fairness: 'pay-to-win', fun: 'the fun moment', heart: 'the heart of the game' };
const EXPERT_LABEL = { steal_verb: 'the new steal verb', steal_defense: 'protecting new players', steal_ladder: 'the rarity ladder', plus_stat: 'what the +1 stat unlocks', plus_length: 'game length', plus_idle: 'AFK winners',
  grow_wait: 'the wait', grow_events: 'events and mutations', td_meta: 'the meta', td_odds: 'summon odds', obby_replay: 'replay', tycoon_end: 'the finished base', horror_replay: 'run two', horror_fair: 'readable deaths',
  survival_roles: 'roles', fight_newbie: 'new players', rp_spark: 'story sparks', dress_vote: 'vote trolls', pets_trade: 'trade scams', deduce_clues: 'clues', escape_routes: 'escape routes', party_variety: 'round variety', find_hints: 'hints' };
export const topicLabel = (t) => TOPIC_LABEL[t] || EXPERT_LABEL[t] || String(t).replace(/_/g, ' ');

const genreOf = (spec) => (spec.genres[0] ? GENRES[spec.genres[0]] : null);
const genreLabel = (spec) => (genreOf(spec) ? genreOf(spec).label.split(' /')[0].toLowerCase() : 'game');

function criticGaps(spec) {
  const g = genreOf(spec);
  const gl = genreLabel(spec);
  const out = [];
  if (!spec.genres.length) out.push({ topic: 'loop', text: "I've listened and I still can't tell what kind of game this is. What does a player actually do, minute by minute?" });
  if (g && (g.saturation === 'extreme' || g.saturation === 'high') && !spec.hook.length) out.push({ topic: 'saturation', text: `Roblox already has thousands of ${gl}s, and the big ones have years of updates. Why would anyone pick yours?` });
  if (spec.loop.length < 2) out.push({ topic: 'loop', text: 'What does a player actually DO in the first five minutes, and why is minute six any different?' });
  if (spec.retention.length < 2) out.push({ topic: 'retention', text: `Fine, day one. Why does anybody open it again tomorrow?${g ? ` In a ${gl}, ${g.risk}.` : ''} Name the day-two hook.` });
  out.push({ topic: 'onboarding', text: 'Most players decide in the first minute. What do they see in the first 30 seconds, before they leave?' });
  if (spec.bigScope || !spec.scope.length) out.push({ topic: 'scope', text: "Who builds this, and how long does it take? Because it sounds like a studio's six-month job." });
  if (spec.economy) out.push({ topic: 'exploits', text: "There's currency in this. How do you stop exploiters duplicating it on day one?" });
  if (spec.genres.some((x) => SOLO_GENRES.includes(x)) || spec.social.length) out.push({ topic: 'social', text: 'What happens when a kid joins an empty server at 3am? Is it still fun alone?' });
  if (spec.chat) out.push({ topic: 'safety', text: 'Players can trade or chat here. How do you keep it safe for younger players?' });
  return out;
}

function monetizerGaps(spec) {
  const m = spec.monetization;
  const out = [];
  if (!m.mechanisms.length) out.push({ topic: 'monetize', text: 'Nice vibe. How does it make Robux? Game passes, developer products, private servers... pick something.' });
  else if (!m.prices.length) out.push({ topic: 'price', text: `What does it cost? Give me Robux numbers for your ${MECHANISMS[m.mechanisms[0]].label.toLowerCase()}.` });
  if (m.mechanisms.length && !m.conversion) out.push({ topic: 'payers', text: 'Who actually pays: kids on allowance, Premium players, a few big spenders? What share of players buy anything?' });
  if (m.p2w) out.push({ topic: 'fairness', text: 'If paying makes you stronger, free players quit and the game dies. How is it not pay-to-win?' });
  return out;
}

const PUSHBACK = {
  saturation: "That's a theme, not a twist. What can a player do in yours that they can't do in the top three {genre}s?",
  loop: 'Vague. Give me verbs: they spawn, they do X, they earn Y, they spend it on Z.',
  retention: "'It's fun' is not a reason to come back. Daily streak? Weekly event? Something unfinished? Make it concrete.",
  onboarding: 'Too slow. In 30 seconds I want them doing the fun thing, not reading a tutorial.',
  scope: "No names, no weeks, no cuts. What's the smallest version you could ship in a month?",
  exploits: 'Hope is not anti-cheat. Does the server check every reward and purchase or not?',
  social: "So it's dead when the server is empty. Bots? Small servers? A solo mode?",
  safety: "That's not a plan. Filtered text, a report button, what's off for new accounts?",
  monetize: "That's still not a way to make Robux. Name a game pass or a product.",
  price: 'I need numbers. 49 R$? 199? 799?',
  payers: 'Give me a guess: what percent of players pay, and for what?',
  fairness: 'Still sounds like you can buy power. Cosmetics only, caps, or earnable by grinding?',
  fun: "That's a feature, not a moment! What makes someone yell 'NO WAY'?",
  heart: 'You listed them all again. Pick ONE.',
};
const HINTS = {
  saturation: "Psst! Tell Vex the one thing only YOUR {genre} lets you do. One sentence, start with 'Unlike...'.",
  loop: 'Say it like a recipe: spawn, do the thing, earn, spend, repeat. Vex loves verbs.',
  retention: 'Give Vex two hooks, like a daily streak chest and a weekly event!',
  onboarding: 'Tell him what happens in second one: they spawn right next to the action, no tutorial wall.',
  scope: "Say who builds it and the smallest first version. Like 'solo, six weeks, one map'.",
  exploits: 'Tell him the server checks every reward and purchase. Magic word: server-side!',
  social: 'Mention a solo mode or bots for empty servers.',
  safety: "Say you'll use Roblox's text filter, a report button, and no trading for brand-new accounts.",
};
const T = {
  hypeNew: ['Ooh, a {genre}! I\'m listening!', 'New pitch! I\'m excited already.', 'Yes! Tell us everything about {title}!'],
  hypeHook: ['That twist is the best part. Lead with it!', 'Okay that twist is actually fresh.'],
  criticNewChat: ['Here we go.', 'I give it five minutes.', 'Let me guess. Pets.'],
  criticAnswered: ['Fine, {topic} is answered. Doesn\'t make the rest less bad.', 'Okay, that one I\'ll give you. Still not impressed.', 'Hm. Answered. Barely. Next problem.'],
  criticConvinced: ["...Fine. Every question answered. I hate saying it, but I'd play this.", "All my questions are answered and I'm annoyed I have nothing left. It's good."],
  criticRevision: ["Changing it doesn't answer me. What about {topic}?", 'New coat of paint, same holes. {topic}?'],
  criticNag: ['Hello? Still waiting on {topic}.', 'I asked about {topic}. Silence is not an answer.'],
  hypeAtCritic: ['Vex, let them breathe!', 'Vex, you said that about every hit game.', 'Ignore him, this has potential!'],
  wrestlerAtCritic: ["He's not wrong though. Prove him wrong.", 'Vex has a point, and I have a fix for it.'],
  criticAtMint: ["Money won't save a boring game, Mint.", 'Mint, there is nothing to sell yet.'],
  hypeAtMint: ["Mint, it's not all about Robux!", 'Mint, let them get to the fun part first.'],
  criticAtWrestler: ['Great, now it\'s two ideas and neither is finished.', 'Brawl, stop redesigning their game.'],
  hypeAtWrestler: ['Ooh, I love that twist!', 'Brawl, that is so good.'],
  hypeAtConvinced: ['VEX SMILED!', 'Did you just... agree with something?'],
  criticAfterConvinced: ["Don't get used to it."],
  mintAnswered: ['Now we\'re talking. {mechs}. I can work with that.', 'Okay, that is a real plan for Robux.'],
  wrestlerAdopt: ['Ha! Now it\'s a game nobody else has.', 'See? Wrestled into shape.'],
  expertOk: ['Now THAT is how the best ones in this format do it.', "Good. That's the bit most of these get wrong.", 'Okay, that holds up. Next.'],
  wrestlerReject: ['Fine, keep yours. Then make it sharper.', 'Your call. Mine was better.'],
};

export function hintFor(topic, genre = 'game') {
  if (HINTS[topic]) return HINTS[topic].replace('{genre}', genre);
  const ex = expertQuestionKeywords(topic);
  if (ex?.hint) return `Psst! ${ex.hint}`;
  if (topic === 'monetize') return 'Name one game pass and one developer product. Mint just wants something concrete.';
  if (topic === 'price') return 'Give Mint actual Robux numbers, like 99 for VIP and 199 for 2x.';
  if (topic === 'payers') return "Guess a percentage, like 'about 2 percent buy something, mostly the 2x pass'.";
  if (topic === 'fairness') return 'Say paid stuff is cosmetic or capped, and everything strong is earnable.';
  if (topic === 'fun') return 'Describe one moment, like a clip: what happens, and what do they yell?';
  if (topic === 'heart') return "Pick one verb and say 'the game is about X, I'm cutting Y'.";
  return null;
}

export function createMockProvider({ seed = 7 } = {}) {
  const rng = mulberry32(seed);
  const used = new Map();
  const fill = (s, ctx) => s.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] ?? ''));
  const pickT = (key, ctx = {}) => {
    const list = T[key];
    const seen = used.get(key) || new Set();
    let opts = list.map((_, i) => i).filter((i) => !seen.has(i));
    if (!opts.length) { seen.clear(); opts = list.map((_, i) => i); }
    const i = opts[Math.floor(rng() * opts.length) % opts.length];
    seen.add(i); used.set(key, seen);
    return fill(list[i], ctx);
  };

  function nextQuestion(p, spec, resolvedIds, kind) {
    const asked = new Set(p.questions.map((q) => `${q.by}:${q.topic}`));
    const openNow = p.questions.filter((q) => q.status === 'open' && !resolvedIds.has(q.id));
    // At most two open questions from the main cast; the expert may add a third.
    if (openNow.length >= 3) return null;
    const mainFull = openNow.filter((q) => !isExpert(q.by)).length >= 2;
    const covered = (topic) => evaluateAnswer(topic, p.fullText).ok;
    const by = (who) => openNow.some((q) => q.by === who);
    const count = (who) => p.questions.filter((q) => q.by === who).length;
    if (!mainFull && !by('critic') && count('critic') < 5) {
      const g = criticGaps(spec).find((x) => !asked.has(`critic:${x.topic}`) && !covered(x.topic));
      if (g) return { by: 'critic', ...g };
    }
    if (!mainFull && !by('monetizer') && count('monetizer') < 3 && (p.utterances >= 2 || kind === 'end' || spec.words > 60)) {
      const skipIfSaid = (topic) => (topic === 'price' || topic === 'payers') && covered(topic);
      const g = monetizerGaps(spec).find((x) => !asked.has(`monetizer:${x.topic}`) && !skipIfSaid(x.topic));
      if (g) return { by: 'monetizer', ...g };
    }
    const cat = p.category && CATEGORIES[p.category];
    const ex = cat && expertId(p.category);
    if (cat && !by(ex) && count(ex) < 2 && count('critic') >= 1) {
      const g = cat.questions.find((x) => !asked.has(`${ex}:${x.topic}`) && !covered(x.topic));
      if (g) return { by: ex, topic: g.topic, text: g.text };
    }
    if (mainFull) return null;
    if (!by('wrestler') && !asked.has('wrestler:heart') && spec.loop.length >= 3 && p.utterances >= 3) {
      const verbs = [...new Set(spec.loop.flatMap((s) => hits(s, ['collect', 'fight', 'build', 'trade', 'race', 'explore', 'survive', 'hatch', 'craft', 'escape', 'defend'])))].slice(0, 4);
      if (verbs.length >= 3) return { by: 'wrestler', topic: 'heart', text: `You said ${joinList(verbs)}. That's too many hearts. Which one IS the game, and what do you cut?` };
    }
    if (!by('hype') && !asked.has('hype:fun') && p.utterances >= 3 && !covered('fun')) {
      return { by: 'hype', topic: 'fun', text: "I'm already in! Tell me the one moment a player screams or laughs. What's the clip they'd share?" };
    }
    return null;
  }

  async function beat(req) {
    const p = req.pitch;
    const spec = p.spec;
    const ctx = { genre: genreLabel(spec), title: p.title };
    const out = { resolved: [], questions: [], lines: [], proposal: null };
    const say = (who, text, extra = {}) => out.lines.push({ who, text, kind: 'say', ...extra });
    const chat = (who, text, to) => out.lines.push({ who, text, kind: 'chat', to });
    const open = p.questions.filter((q) => q.status === 'open');
    const kind = req.kind;

    if (kind === 'new-pitch') {
      say('hype', pickT('hypeNew', ctx));
      chat('critic', pickT('criticNewChat', ctx), 'hype');
      if (req.leftOpen) chat('critic', `We're moving on? I still had ${req.leftOpen.count} question${req.leftOpen.count > 1 ? 's' : ''} on ${req.leftOpen.title}.`);
    }

    if (req.categoryNew && CATEGORIES[req.categoryNew]) {
      const c = CATEGORIES[req.categoryNew];
      say(expertId(req.categoryNew), `A ${c.label} game? That's my format. I'm ${c.expert.name}, and I'll be checking the bits that make or break these.`, { emotion: 'happy' });
      chat('critic', 'Great, an expert. Someone else to be disappointed with me.', expertId(req.categoryNew));
    }
    if (kind === 'adopt' && req.adopted) {
      say('wrestler', pickT('wrestlerAdopt', ctx));
      chat('hype', pickT('hypeAtWrestler', ctx), 'wrestler');
    }
    if (kind === 'reject') say('wrestler', pickT('wrestlerReject', ctx));

    if (req.text && ['utterance', 'revision', 'adopt'].includes(kind)) {
      // Any open question the utterance really addresses is resolved; if it addressed none and was a reply, the latest asker pushes back.
      for (const q of open) {
        const ev = evaluateAnswer(q.topic, req.text);
        if (ev.ok) out.resolved.push({ id: q.id, status: 'answered', via: kind === 'utterance' ? 'answer' : 'change', why: `mentioned ${ev.hits.slice(0, 3).join(', ')}` });
      }
      const focus = open.find((q) => q.id === req.focusId);
      const pushed = !out.resolved.length && req.answering && kind === 'utterance' ? focus || [...open].sort((a, b) => b.seq - a.seq)[0] : null;
      const resolved = new Set(out.resolved.map((r) => r.id));
      const criticResolved = open.filter((q) => q.by === 'critic' && resolved.has(q.id));
      const criticLeft = open.filter((q) => q.by === 'critic' && !resolved.has(q.id));
      // He is only convinced when nothing is open AND he has no question left that the pitch has not already covered.
      const fullNow = `${p.fullText} ${req.text}`;
      const askedTopics = new Set(p.questions.filter((q) => q.by === 'critic').map((q) => q.topic));
      const moreToAsk = p.questions.filter((q) => q.by === 'critic').length < 5 && criticGaps(spec).some((g) => !askedTopics.has(g.topic) && !evaluateAnswer(g.topic, fullNow).ok);
      out.criticDone = !criticLeft.length && !moreToAsk;
      if (criticResolved.length) {
        if (criticLeft.length || moreToAsk) say('critic', pickT('criticAnswered', { ...ctx, topic: topicLabel(criticResolved[0].topic) }));
        else {
          say('critic', pickT('criticConvinced', ctx), { emotion: 'convinced' });
          chat('hype', pickT('hypeAtConvinced', ctx), 'critic');
          chat('critic', pickT('criticAfterConvinced', ctx), 'hype');
        }
      }
      const mintResolved = open.filter((q) => q.by === 'monetizer' && resolved.has(q.id));
      if (mintResolved.length) {
        say('monetizer', pickT('mintAnswered', { mechs: joinList(spec.monetization.mechanisms.map((m) => MECHANISMS[m].label)) || 'A plan' }));
        if (spec.monetization.prices.length) chat('monetizer', revenueSketch(spec).text);
      }
      for (const q of open.filter((x) => isExpert(x.by))) if (resolved.has(q.id)) say(q.by, pickT('expertOk', ctx));
      for (const q of open.filter((x) => x.by === 'hype' || x.by === 'wrestler')) if (resolved.has(q.id)) say(q.by, q.by === 'hype' ? 'YES. That is the trailer right there.' : 'Good. Now cut the rest and build that.');
      if (pushed) {
        const exq = expertQuestionKeywords(pushed.topic);
        say(pushed.by, (PUSHBACK[pushed.topic] || exq?.pushback || 'Not quite. Try again, more concrete.').replace('{genre}', ctx.genre), { emotion: 'annoyed' });
        const hint = hintFor(pushed.topic, ctx.genre);
        if ((pushed.by === 'critic' || isExpert(pushed.by)) && hint) say('hype', hint, { to: 'you' });
      }
      if (kind === 'revision' && criticLeft.length && !criticResolved.length) say('critic', pickT('criticRevision', { ...ctx, topic: topicLabel(criticLeft[0].topic) }));
      if (kind === 'revision' && spec.hook.length && !p.praisedHook) { say('hype', pickT('hypeHook', ctx)); out.praisedHook = true; }
    }

    if (['silence', 'end', 'new-pitch', 'revision', 'adopt'].includes(kind) || (kind === 'utterance' && req.typed)) {
      const resolvedIds = new Set(out.resolved.map((r) => r.id));
      const q = kind === 'end' ? null : nextQuestion(p, spec, resolvedIds, kind);
      if (q) {
        if (q.by === 'critic') out.criticDone = false;
        out.questions.push(q);
        say(q.by, q.text, { question: true });
        const r = rng();
        if (q.by === 'critic') chat(r < 0.5 ? 'hype' : 'wrestler', pickT(r < 0.5 ? 'hypeAtCritic' : 'wrestlerAtCritic', ctx), 'critic');
        else if (q.by === 'monetizer') chat(r < 0.5 ? 'critic' : 'hype', pickT(r < 0.5 ? 'criticAtMint' : 'hypeAtMint', ctx), 'monetizer');
      } else if (kind === 'silence' && !p.proposal && !p.proposed && p.utterances >= 2) {
        const g = genreOf(spec);
        const twist = g ? g.twists[Math.floor(rng() * g.twists.length)] : 'the players are the obstacles for each other';
        out.proposal = { by: 'wrestler', text: twist };
        say('wrestler', `Let me wrestle this a bit. What if ${twist}? Say yes and I'll write it into the pitch.`, { question: true });
        const r2 = rng();
        chat(r2 < 0.5 ? 'critic' : 'hype', pickT(r2 < 0.5 ? 'criticAtWrestler' : 'hypeAtWrestler', ctx), 'wrestler');
      } else if (kind === 'silence' && req.silentFor >= 20000) {
        const waiting = open.find((x) => x.by === 'critic');
        if (waiting) say('critic', pickT('criticNag', { ...ctx, topic: topicLabel(waiting.topic) }));
      }
    }

    if (kind === 'end') {
      const resolvedIds = new Set(out.resolved.map((r) => r.id));
      const criticOpen = open.filter((q) => q.by === 'critic' && !resolvedIds.has(q.id));
      const money = scoreMonetization(spec, new Set(p.questions.filter((q) => q.status === 'answered').map((q) => q.topic)));
      say('critic', criticOpen.length ? `My verdict: no. You still owe me answers on ${joinList(criticOpen.map((q) => topicLabel(q.topic)))}.` : 'My verdict: a grudging yes. Every question answered.', { emotion: criticOpen.length ? 'annoyed' : 'convinced' });
      const fix = money.reasons.filter((x) => x.d < 0).sort((a, b) => a.d - b.d)[0];
      say('monetizer', `Verdict: ${money.verdict}, ${money.score} out of 100.${fix ? ` Biggest fix: ${fix.text}.` : ' I would back it.'}`);
      say('hype', `Best part for me: ${spec.hook[0] ? `"${spec.hook[0].slice(0, 90)}"` : `the ${ctx.genre} itself, now give it a twist`}. Writing up what we understood now!`);
      say('wrestler', p.adopted?.length ? `My bet: lead with the twist you took, ${p.adopted[p.adopted.length - 1]}.` : 'My bet: pick one heart for this game and cut everything else from version one.');
    }
    return out;
  }

  return { name: 'mock', beat, understanding: async (req) => buildUnderstanding(req.pitch) };
}
