// What the crowd understood: one document per pitch, each claude writing their own part, plus a shared summary.
import { CATEGORIES, expertId } from './categories.js';
import { getPersona } from './personas.js';
import { GENRES, MECHANISMS, RETENTION } from './roblox.js';
import { revenueSketch, scoreMonetization } from './scoring.js';
import { hits, joinList } from './util.js';

const EXPERT_TOPIC = (t) => String(t).replace(/^[a-z]+_/, '').replace(/_/g, ' ');
const TOPIC = { saturation: 'the twist', loop: 'the core loop', retention: 'retention', onboarding: 'the first 30 seconds', scope: 'scope', exploits: 'exploiters',
  social: 'empty servers', safety: 'safety', monetize: 'monetization', price: 'prices', payers: 'who pays', fairness: 'pay-to-win', fun: 'the fun moment', heart: 'the heart of the game' };
const clip = (s, n = 160) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const firstOr = (arr, fallback) => (arr.length ? clip(arr[0]) : fallback);
const LOOP_VERBS = ['collect', 'earn', 'upgrade', 'unlock', 'fight', 'survive', 'escape', 'build', 'trade', 'race', 'hatch', 'rebirth', 'spend', 'defend', 'craft', 'explore', 'hire', 'buy', 'sell', 'win'];
const LEAD_IN = /^(?:(?:ok(?:ay)?|so|alright|right|um|uh|hi everyone)[,.!]?\s+)*(?:my\s+(?:next|other|second)\s+(?:idea|game|pitch)\s+is\s+|(?:this|my game|the game)\s+is\s+)?/i;
const tidy = (s) => { const t = s.replace(LEAD_IN, ''); return t ? t[0].toUpperCase() + t.slice(1) : s; };
const bestLoop = (arr) => tidy([...arr].sort((a, b) => hits(b, LOOP_VERBS).length - hits(a, LOOP_VERBS).length)[0]);

export function buildUnderstanding(pitch) {
  const spec = pitch.spec;
  const answered = pitch.questions.filter((q) => q.status === 'answered');
  const open = pitch.questions.filter((q) => q.status === 'open');
  const money = scoreMonetization(spec, new Set(answered.map((q) => q.topic)));
  const genres = spec.genres.map((g) => GENRES[g].label);
  const mechs = spec.monetization.mechanisms.map((m) => MECHANISMS[m].label);
  const levers = spec.retention.map((r) => RETENTION[r].label);
  const answerOf = (topic) => answered.find((q) => q.topic === topic)?.answer;
  const criticOpen = open.filter((q) => q.by === 'critic');
  const criticAsked = pitch.questions.filter((q) => q.by === 'critic');

  const facts = {
    oneLiner: firstOr(pitch.utterancesText || [], pitch.title),
    genre: genres.length ? joinList(genres) : 'not clear yet',
    loop: answerOf('loop') || (spec.loop.length ? clip(bestLoop(spec.loop)) : 'not described yet'),
    hook: answerOf('saturation') || firstOr(spec.hook, 'no twist named yet'),
    audience: answerOf('audience') || firstOr(spec.audience, 'not said'),
    retention: levers.length ? joinList(levers) : (answerOf('retention') || 'nothing yet'),
    money: mechs.length ? joinList(mechs) : 'nothing named',
    session: spec.sessionMinutes ? `about ${spec.sessionMinutes} minutes` : 'not said',
  };

  const perPersona = {
    critic: criticAsked.length === 0
      ? 'I never got to my questions, so I am still against it.'
      : criticOpen.length
        ? `What I understood: a ${facts.genre.toLowerCase()} pitch, and the loop as I heard it is "${facts.loop}" I am still negative: ${joinList(criticOpen.map((q) => TOPIC[q.topic] || EXPERT_TOPIC(q.topic)))} ${criticOpen.length > 1 ? 'are' : 'is'} unanswered. Answer those or change the pitch.`
        : `What I understood: a ${facts.genre.toLowerCase()} pitch, and the loop as I heard it is "${facts.loop}" All ${criticAsked.length} of my questions were answered, so, grudgingly, I am convinced.`,
    monetizer: `It makes money through ${facts.money.toLowerCase()}. Score ${money.score}/100, verdict ${money.verdict}. ${spec.monetization.prices.length ? revenueSketch(spec).text : 'Without prices I cannot size it; give me Robux numbers.'}`,
    hype: `The strongest thing here is ${facts.hook === 'no twist named yet' ? 'the core idea' : `the hook: "${facts.hook}"`}. ${levers.length ? `Players come back for ${facts.retention}.` : 'Add a reason to come back and it gets much better.'}`,
    wrestler: pitch.adopted?.length
      ? `We wrestled it into: ${pitch.adopted.join('; ')}. Keep that as the heart.`
      : pitch.proposal ? `I offered "${pitch.proposal.text}" and it was not taken. Fine, but pick one heart for the game.` : 'Nobody let me wrestle it. Pick one heart and cut the rest.',
  };

  const cat = pitch.category && CATEGORIES[pitch.category];
  if (cat) {
    const ex = expertId(pitch.category);
    const exQs = pitch.questions.filter((q) => q.by === ex);
    const exOpen = exQs.filter((q) => q.status === 'open');
    const verbs = cat.conventions.slice(0, 3).join(', ');
    perPersona[ex] = exQs.length
      ? `As a ${cat.label} game it has to nail ${verbs}. ${exOpen.length ? `Still open for me: ${joinList(exOpen.map((q) => EXPERT_TOPIC(q.topic)))}.` : 'Everything I asked about the format was answered.'} Watch out for ${cat.pitfalls[0]}.`
      : `As a ${cat.label} game it has to nail ${verbs}. The classic trap is ${cat.pitfalls[0]}.`;
  }
  const sections = [
    { id: 'game', title: 'The game', items: [...(cat ? [`Category: ${cat.label} (expert: ${cat.expert.name})`] : []), `Genre: ${facts.genre}`, `Core loop: ${facts.loop}`, `Hook: ${facts.hook}`, `Players: ${facts.audience}`, `Session: ${facts.session}`, `Retention: ${facts.retention}`] },
    { id: 'money', title: 'Money', items: [`Mechanisms: ${facts.money}`, `Prices: ${spec.monetization.prices.length ? spec.monetization.prices.map((p) => `${p} R$`).join(', ') : 'none given'}`, `Verdict: ${money.verdict} (${money.score}/100)`, ...money.reasons.map((r) => `${r.d > 0 ? '+' : ''}${r.d} ${r.text}`)] },
    { id: 'qa', title: 'Questions', items: pitch.questions.map((q) => `${q.status === 'answered' ? 'Answered' : 'Open'} (${getPersona(q.by)?.name || q.by}): ${q.text}${q.answer ? ` Answer: "${clip(q.answer, 140)}"` : ''}`) },
    { id: 'changes', title: 'How the pitch changed', items: pitch.versions.length > 1 ? pitch.versions.slice(1).map((v) => `v${v.v}: ${clip(v.note, 140)}`) : ['No changes during the pitch.'] },
    { id: 'next', title: "What's next", items: [...open.map((q) => `Answer ${getPersona(q.by)?.name || q.by} on ${TOPIC[q.topic] || EXPERT_TOPIC(q.topic)}`), ...money.reasons.filter((r) => r.d < 0).map((r) => `Fix: ${r.text}`)].slice(0, 8) },
  ];
  if (!sections[2].items.length) sections[2].items.push('No questions were asked.');
  if (!sections[4].items.length) sections[4].items.push('Build a prototype of the core loop.');

  const shared = `${pitch.title} is a ${facts.genre.toLowerCase()} pitch. ${facts.loop === 'not described yet' ? 'The core loop is still unclear.' : `Core loop: "${facts.loop}"`} ${mechs.length ? `It makes money through ${facts.money.toLowerCase()}.` : 'No way to make Robux was named yet.'} The Critic is ${criticOpen.length || !criticAsked.length ? 'still negative' : 'convinced'} and the Monetizer says ${money.verdict}.`;
  const md = [`# ${pitch.title}: what the crowd understood`, '', shared, '',
    ...sections.flatMap((s) => [`## ${s.title}`, ...s.items.map((i) => `- ${i}`), '']),
    '## In their own words', ...Object.entries(perPersona).map(([id, t]) => `- **${getPersona(id)?.name} (${getPersona(id)?.role}):** ${t}`), ''].join('\n');
  return { title: pitch.title, shared, sections, perPersona, verdict: { critic: criticOpen.length || !criticAsked.length ? 'negative' : 'convinced', monetizer: money.verdict, score: money.score }, markdown: md };
}
