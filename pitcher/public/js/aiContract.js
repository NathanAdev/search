// The contract between Pitcher and a real model: how prompts are built and how replies are checked.
// Used by the Node server (which runs the Claude Code CLI) and by the tests. Nothing here calls a model.
import { CATEGORIES, expertId } from './categories.js';
import { PERSONAS, getPersona } from './personas.js';
import { BRIEFS, SHARED, expertBrief } from './prompts.js';
import { buildUnderstanding } from './understanding.js';

const MAIN = ['critic', 'monetizer', 'hype', 'wrestler'];
const CORE_TOPICS = ['saturation', 'loop', 'retention', 'onboarding', 'scope', 'exploits', 'social', 'safety', 'monetize', 'price', 'payers', 'fairness', 'fun', 'heart'];
const whoFor = (pitch) => (pitch?.category && CATEGORIES[pitch.category] ? [...MAIN, expertId(pitch.category)] : MAIN);
const topicsFor = (pitch) => (pitch?.category && CATEGORIES[pitch.category] ? [...CORE_TOPICS, ...CATEGORIES[pitch.category].questions.map((q) => q.topic)] : CORE_TOPICS);

function castFor(pitch) {
  const parts = MAIN.map((id) => `### ${id} (${PERSONAS[id].name})\n${BRIEFS[id]}`);
  if (pitch?.category && CATEGORIES[pitch.category]) {
    const c = CATEGORIES[pitch.category];
    parts.push(`### ${expertId(pitch.category)} (${c.expert.name})\n${expertBrief(pitch.category)}\nQuestions you might ask (topic: question): ${c.questions.map((q) => `${q.topic}: ${q.text}`).join(' | ')}`);
  }
  return `${SHARED}\n\n${parts.join('\n\n')}`;
}

const RULES = `Rules:
- You are the four claudes in the audience of a live pitch for a Roblox game. Stay in character; short, spoken sentences (max 2 per line).
- critic is ALWAYS negative until every question he asked is answered. He may only sound convinced when none of his questions is open and he has nothing left to ask; then set "criticDone": true once.
- monetizer cares how it makes Robux (game passes, developer products, private servers, Premium payouts, cosmetics, battle pass) and whether the game is good enough to back.
- hype is genuinely positive, names the strongest part, and coaches the pitcher on how to answer the critic.
- wrestler wrestles the idea: proposes one concrete twist at a time (as "proposal"), or forces the pitcher to choose the heart of the game.
- Ask at most ONE new question per reply, and only when the event is "silence", "new-pitch", "revision", "adopt" or a typed turn. Never repeat a topic already in the question list.
- Mark a question resolved only if the pitcher's latest words really answer it. If they tried and failed, the asker pushes back with what is missing.
- If the pitcher chose a question to answer ("focus"), judge their words against THAT question first; if it fails, its asker pushes back and hype gives a one-line tip.
- An expert (id starting "expert:") only speaks about their own format.
- Use "chat" lines for the claudes talking to each other (set "to"), "say" lines for talking to the pitcher. 1 to 4 lines total.
- Do not use any tools. Reply with ONE JSON object and nothing else.`;

const beatShape = (pitch) => `{"resolved":[{"id":"<question id>","status":"answered"}],
 "questions":[{"by":"${whoFor(pitch).join('|')}","topic":"${topicsFor(pitch).join('|')}","text":"..."}],
 "lines":[{"who":"${whoFor(pitch).join('|')}","kind":"say|chat","to":"<optional speaker id or you>","text":"..."}],
 "proposal":null | {"by":"wrestler","text":"<the twist, no leading 'what if'>"},
 "criticDone":true|false}`;

export function buildBeatPrompt(req) {
  const p = req.pitch;
  const pitch = { title: p.title, category: p.category ? CATEGORIES[p.category]?.label : null, version: p.versions.length, transcript: p.fullText.slice(-4000), questions: p.questions, pendingTwist: p.proposal?.text || null, adoptedTwists: p.adopted };
  const focus = p.questions.find((q) => q.id === req.focusId);
  return [`Cast:\n${castFor(p)}`, RULES, `Current pitch (JSON):\n${JSON.stringify(pitch)}`,
    `Recent chatroom:\n${(req.chatTail || []).map((m) => `${m.who}: ${m.text}`).join('\n') || '(empty)'}`,
    `Event: ${req.kind}${req.typed ? ' (typed turn)' : ''}${req.answering ? ' (the pitcher is replying to the newest open question)' : ''}`,
    focus ? `The pitcher chose to answer this question (focus): ${focus.id} from ${focus.by}: "${focus.text}"` : 'No question chosen; judge against the newest open question.',
    req.categoryNew ? `The pitch was just recognised as a ${CATEGORIES[req.categoryNew]?.label} game; its expert should introduce themselves in one line.` : '',
    req.text ? `The pitcher just said: "${req.text}"` : 'The pitcher is silent.',
    `Reply with JSON of exactly this shape:\n${beatShape(p)}`].filter(Boolean).join('\n\n');
}

export function extractJson(text) {
  const s = String(text).replace(/```(?:json)?/gi, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('reply had no JSON object');
  return JSON.parse(s.slice(start, end + 1));
}

const str = (x, n = 400) => (typeof x === 'string' ? x.trim().slice(0, n) : '');

export function validateBeat(obj, req) {
  if (!obj || typeof obj !== 'object') throw new Error('reply was not an object');
  const known = new Map(req.pitch.questions.map((q) => [q.id, q]));
  const resolved = (Array.isArray(obj.resolved) ? obj.resolved : []).filter((r) => r && known.has(r.id) && known.get(r.id).status === 'open' && r.status === 'answered').map((r) => ({ id: r.id, status: 'answered', via: req.kind === 'utterance' ? 'answer' : 'change' }));
  const WHO = whoFor(req.pitch);
  const TOPICS = topicsFor(req.pitch);
  const lines = (Array.isArray(obj.lines) ? obj.lines : []).filter((l) => l && WHO.includes(l.who) && str(l.text)).slice(0, 4)
    .map((l) => ({ who: l.who, text: str(l.text, 300), kind: l.kind === 'chat' ? 'chat' : 'say', ...(WHO.includes(l.to) || l.to === 'you' ? { to: l.to } : {}) }));
  const asked = new Set(req.pitch.questions.map((q) => `${q.by}:${q.topic}`));
  const questions = (Array.isArray(obj.questions) ? obj.questions : []).filter((q) => q && WHO.includes(q.by) && TOPICS.includes(q.topic) && str(q.text) && !asked.has(`${q.by}:${q.topic}`)).slice(0, 1)
    .map((q) => ({ by: q.by, topic: q.topic, text: str(q.text, 300) }));
  for (const q of questions) if (!lines.some((l) => l.text === q.text)) lines.push({ who: q.by, text: q.text, kind: 'say', question: true });
  const proposal = obj.proposal && str(obj.proposal.text) ? { by: 'wrestler', text: str(obj.proposal.text, 200).replace(/^what if\s+/i, '') } : null;
  const resolvedIds = new Set(resolved.map((r) => r.id));
  const criticOpen = req.pitch.questions.some((q) => q.by === 'critic' && q.status === 'open' && !resolvedIds.has(q.id)) || questions.some((q) => q.by === 'critic');
  // The invariant is enforced here, whatever the model says.
  const criticDone = !criticOpen && obj.criticDone === true;
  return { resolved, questions, lines, proposal, criticDone };
}

export function buildUnderstandingPrompt(pitch) {
  return [`Cast:\n${castFor(pitch)}`,
    'The pitch is over. As the four claudes, write down what you understood of the pitcher\'s Roblox game. Be concrete, use their words, and do not invent features they did not mention. Do not use any tools.',
    `Pitch (JSON):\n${JSON.stringify({ title: pitch.title, transcript: pitch.fullText.slice(-6000), questions: pitch.questions, versions: pitch.versions, adoptedTwists: pitch.adopted })}`,
    `Reply with ONE JSON object: {"shared":"3-4 sentence shared understanding","sections":[{"title":"The game|Money|Questions|How the pitch changed|What's next","items":["..."]}],"perPersona":{${whoFor(pitch).map((id) => `"${id}":"..."`).join(',')}}}`].join('\n\n');
}

export function validateUnderstanding(obj, pitch) {
  const base = buildUnderstanding(pitch);
  if (!obj || typeof obj !== 'object' || !str(obj.shared)) throw new Error('understanding reply missing "shared"');
  const sections = (Array.isArray(obj.sections) ? obj.sections : []).filter((s) => s && str(s.title) && Array.isArray(s.items))
    .map((s) => ({ id: str(s.title, 40).toLowerCase().replace(/\W+/g, '-'), title: str(s.title, 60), items: s.items.map((i) => str(i, 400)).filter(Boolean).slice(0, 12) }));
  const per = obj.perPersona || {};
  const ids = Object.keys(base.perPersona);
  const perPersona = Object.fromEntries(ids.map((id) => [id, str(per[id], 800) || base.perPersona[id]]));
  const out = { ...base, shared: str(obj.shared, 1200), sections: sections.length ? sections : base.sections, perPersona, source: 'ai' };
  out.markdown = [`# ${pitch.title}: what the crowd understood`, '', out.shared, '', ...out.sections.flatMap((s) => [`## ${s.title}`, ...s.items.map((i) => `- ${i}`), '']),
    '## In their own words', ...ids.map((id) => `- **${getPersona(id).name} (${getPersona(id).role}):** ${perPersona[id]}`), ''].join('\n');
  return out;
}
