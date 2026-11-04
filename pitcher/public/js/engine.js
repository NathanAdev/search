// The pitch engine: hears what you say, keeps every pitch and its questions, asks the provider what the crowd says next.
import { classify, isAffirmation, isEndCue, isRejection } from './detector.js';
import { autoTitle, changedFields, emptySpec, extractSpec, mergeSpec, reviseSpec, titleFrom } from './extract.js';
import { CATEGORIES, detectCategories, expertId } from './categories.js';
import { getPersona } from './personas.js';
import { hintFor } from './provider-mock.js';
import { chatter, heckle } from './reflex.js';
import { scoreMonetization } from './scoring.js';
import { buildUnderstanding } from './understanding.js';
import { tokens } from './util.js';

let seqId = 0;
const nid = (p) => `${p}${++seqId}`;

export function createEngine({ provider, fallback, settings = {}, clock = () => Date.now(), onEvent = () => {} }) {
  const cfg = { interruptions: true, chatter: true, chatterEveryMs: 12000, nagAfterMs: 20000, ...settings };
  const state = { status: 'idle', startedAt: null, pitches: [], activeId: null, chat: [], transcript: [], focusId: null, providerName: provider.name, providerError: null };
  const reflex = {};
  // Heckles can land before the first pitch exists; their keywords carry over so nobody repeats them.
  const prePitch = { spec: emptySpec(), heckled: [] };
  let chain = Promise.resolve();
  let qSeq = 0;
  let speechSeq = 0;
  let silenceBeatSeq = -1;
  let lastNagAt = 0;
  let lastSpeechAt = 0;
  let lastChatterAt = 0;

  const active = () => state.pitches.find((p) => p.id === state.activeId) || null;
  const emit = (e) => onEvent(e);
  const changed = () => emit({ type: 'state', state });
  const addChat = (m) => { const msg = { id: nid('m'), t: clock(), pitchId: state.activeId, ...m }; state.chat.push(msg); emit({ type: 'chat', msg }); return msg; };

  function snapshot(p) {
    return { id: p.id, n: p.n, title: p.title, category: p.category || null, spec: p.spec, fullText: p.fullText, utterances: p.utterances.length, utterancesText: p.utterances.slice(0, 3).map((u) => u.text),
      questions: p.questions.map(({ id, seq, by, topic, text, status, answer }) => ({ id, seq, by, topic, text, status, answer })),
      versions: p.versions.map(({ v, note }) => ({ v, note })), proposal: p.proposal, proposed: p.proposed, adopted: p.adopted, praisedHook: p.praisedHook };
  }

  function recompute(p) {
    const answered = new Set(p.questions.filter((q) => q.status === 'answered').map((q) => q.topic));
    p.monetizer = scoreMonetization(p.spec, answered);
    const critic = p.questions.filter((q) => q.by === 'critic');
    const openC = critic.filter((q) => q.status === 'open').length;
    // The Critic stays negative while any of his questions is open; only then can he be convinced.
    p.criticMood = openC >= 2 ? 'hostile' : openC === 1 ? 'skeptical' : !critic.length ? 'hostile' : p.criticDone ? 'convinced' : 'skeptical';
  }

  function newPitch(text) {
    const spec = extractSpec(text);
    const named = titleFrom(text);
    const p = { id: nid('p'), n: state.pitches.length + 1, title: named || autoTitle(text, spec.genres), titleSource: named ? 'spoken' : 'auto', startedAt: clock(),
      utterances: [], fullText: '', spec, versions: [{ v: 1, at: clock(), note: 'First version', spec }], questions: [], proposal: null, proposed: false, adopted: [], praisedHook: false,
      heckled: state.pitches.length ? [] : [...prePitch.heckled] };
    recompute(p);
    state.pitches.push(p);
    state.activeId = p.id;
    emit({ type: 'pitch', pitch: p, reason: 'new' });
    return p;
  }

  async function runBeat(p, req) {
    let resp;
    try {
      resp = await provider.beat({ ...req, pitch: snapshot(p), chatTail: state.chat.slice(-12).map(({ who, text }) => ({ who, text })) });
      state.providerError = null;
    } catch (err) {
      if (!fallback) throw err;
      if (state.providerError !== String(err.message)) addChat({ who: 'system', kind: 'system', text: `Real AI failed (${err.message}). The scripted crowd is answering instead.` });
      state.providerError = String(err.message);
      resp = await fallback.beat({ ...req, pitch: snapshot(p), chatTail: [] });
    }
    apply(p, resp, req);
    return resp;
  }

  function apply(p, resp, req) {
    for (const r of resp.resolved || []) {
      const q = p.questions.find((x) => x.id === r.id);
      if (!q || q.status !== 'open' || r.status !== 'answered') continue;
      q.status = 'answered';
      q.answer = req.text || '';
      q.via = r.via || 'answer';
      q.answeredAt = clock();
    }
    if (state.focusId && !p.questions.some((q) => q.id === state.focusId && q.status === 'open')) state.focusId = null;
    if (req.answering && req.kind === 'utterance') {
      const target = p.questions.find((q) => q.id === req.focusId && q.status === 'open') || [...p.questions].filter((q) => q.status === 'open').sort((a, b) => b.seq - a.seq)[0];
      if (target && !(resp.resolved || []).some((r) => r.id === target.id)) target.attempts = (target.attempts || 0) + 1;
    }
    for (const q of resp.questions || []) {
      if (p.questions.some((x) => x.by === q.by && x.topic === q.topic)) continue;
      p.questions.push({ id: nid('q'), seq: ++qSeq, by: q.by, topic: q.topic, text: q.text, status: 'open', askedAt: clock(), attempts: 0 });
    }
    if (resp.proposal) { p.proposal = resp.proposal; p.proposed = true; }
    if (resp.praisedHook) p.praisedHook = true;
    if (typeof resp.criticDone === 'boolean') p.criticDone = resp.criticDone;
    recompute(p);
    const lines = (resp.lines || []).filter((l) => l && l.who && l.text);
    if (lines.length) emit({ type: 'lines', lines, pitchId: p.id });
    changed();
  }

  function awaitingAnswer(p) {
    const last = [...p.questions].filter((q) => q.status === 'open').sort((a, b) => b.seq - a.seq)[0];
    return !!last && clock() - last.askedAt < 90000;
  }

  // "Vex, ..." or "to Mint's question" picks which open question you are answering.
  function focusFromWords(p, text) {
    if (!p) return;
    const head = text.slice(0, 60).toLowerCase();
    const open = p.questions.filter((q) => q.status === 'open');
    for (const q of [...open].sort((a, b) => b.seq - a.seq)) {
      const name = getPersona(q.by)?.name?.toLowerCase();
      if (name && new RegExp(`(?:^|\\b(?:to|for|answering|answer|about)\\s+)${name}\\b|^\\s*${name}\\b`).test(head)) { state.focusId = q.id; return; }
    }
  }

  async function handleFinal(text, { typed = false, source = typed ? 'typed' : 'voice' } = {}) {
    text = String(text).trim();
    if (!text) return;
    speechSeq++;
    lastSpeechAt = clock();
    addChat({ who: 'you', kind: 'say', text });
    let p = active();
    focusFromWords(p, text);
    state.transcript.push({ t: clock(), text, source, pitchId: p?.id || null, focusId: state.focusId });
    if (p && p.proposal && isAffirmation(text)) {
      const twist = p.proposal.text;
      p.adopted.push(twist);
      p.spec = mergeSpec(p.spec, { ...extractSpec(`What if ${twist}.`), hook: [`Twist: ${twist}`] });
      p.versions.push({ v: p.versions.length + 1, at: clock(), note: `Adopted Brawl's twist: ${twist}`, spec: p.spec });
      p.proposal = null;
      p.utterances.push({ t: clock(), text });
      p.lastUserAt = clock();
      emit({ type: 'pitch', pitch: p, reason: 'revised' });
      await runBeat(p, { kind: 'adopt', text, adopted: twist, typed });
      return;
    }
    if (p && p.proposal && isRejection(text)) {
      p.proposal = null;
      p.utterances.push({ t: clock(), text });
      await runBeat(p, { kind: 'reject', text, typed });
      return;
    }
    // "answering" means this is the first thing said since the newest open question was asked.
    const newestOpen = p ? [...p.questions].filter((q) => q.status === 'open').sort((a, b) => b.seq - a.seq)[0] : null;
    const focused = p && p.questions.some((q) => q.id === state.focusId && q.status === 'open');
    const answering = focused || (!!newestOpen && newestOpen.askedAt >= (p.lastUserAt ?? 0));
    const decision = classify(text, { active: p && { genres: p.spec.genres, tokens: new Set(tokens(p.fullText)), segments: p.utterances.length }, awaitingAnswer: p ? awaitingAnswer(p) : false });
    if (decision.action === 'ignore') return;
    let kind = 'utterance';
    let leftOpen = null;
    if (decision.action === 'new') {
      if (p) {
        const open = p.questions.filter((q) => q.status === 'open' && q.by === 'critic').length;
        if (open) leftOpen = { count: open, title: p.title };
      }
      p = newPitch(text);
      kind = 'new-pitch';
      state.focusId = null;
      state.transcript[state.transcript.length - 1].pitchId = p.id;
    } else if (decision.action === 'revise') {
      const before = p.spec;
      p.spec = reviseSpec(p.spec, text);
      const fields = changedFields(before, p.spec);
      p.versions.push({ v: p.versions.length + 1, at: clock(), note: text, fields, spec: p.spec });
      emit({ type: 'pitch', pitch: p, reason: 'revised' });
      kind = 'revision';
    } else {
      p.spec = mergeSpec(p.spec, extractSpec(text));
      const named = titleFrom(text);
      if (named && p.titleSource === 'auto') { p.title = named; p.titleSource = 'spoken'; }
    }
    if (kind === 'new-pitch') p.spec = extractSpec(text);
    p.utterances.push({ t: clock(), text });
    p.lastUserAt = clock();
    p.fullText = `${p.fullText} ${text}`.trim();
    if (p.titleSource === 'auto' && p.utterances.length <= 3) p.title = titleFrom(p.fullText) || autoTitle(p.fullText, p.spec.genres);
    let categoryNew = null;
    const cats = detectCategories(p.fullText);
    if (cats[0] && (!p.category || (kind === 'revision' && detectCategories(text)[0] && detectCategories(text)[0] !== p.category))) {
      p.category = kind === 'revision' ? detectCategories(text)[0] : cats[0];
      categoryNew = p.category;
      emit({ type: 'expert', pitch: p, category: p.category });
    }
    recompute(p);
    await runBeat(p, { kind, text, typed, answering: answering && kind === 'utterance', leftOpen, categoryNew, focusId: state.focusId });
    if (typed || decision.end || isEndCue(text)) {
      silenceBeatSeq = speechSeq;
      if (kind === 'utterance' && !typed) await runBeat(p, { kind: 'silence', silentFor: 0 });
    }
  }

  async function handlePause(silentFor) {
    const p = active();
    if (!p || state.status !== 'live') return;
    const fresh = silenceBeatSeq !== speechSeq;
    const nag = silentFor >= cfg.nagAfterMs && clock() - lastNagAt >= cfg.nagAfterMs;
    if (!fresh && !nag) return;
    silenceBeatSeq = speechSeq;
    if (nag) lastNagAt = clock();
    await runBeat(p, { kind: 'silence', silentFor });
  }

  async function handleEnd() {
    const p = active();
    if (p) await runBeat(p, { kind: 'end' });
    for (const x of state.pitches) {
      let u;
      try { u = await provider.understanding({ pitch: snapshot(x) }); } catch { u = null; }
      x.understanding = u && u.markdown ? u : buildUnderstanding(snapshot(x));
      x.ended = true;
    }
    state.status = 'ended';
    emit({ type: 'understanding', pitches: state.pitches });
    changed();
  }

  const queue = (fn) => (chain = chain.then(fn).catch((err) => { addChat({ who: 'system', kind: 'system', text: `Something broke: ${err.message}` }); }));

  return {
    state,
    start() { state.status = 'live'; state.startedAt = state.startedAt || clock(); changed(); },
    // You pick which open question your next words answer (or null to let the crowd decide).
    focus(id) { state.focusId = id; changed(); },
    defer(id) { const q = active()?.questions.find((x) => x.id === id); if (q) { q.deferred = true; if (state.focusId === id) state.focusId = null; changed(); } },
    hint(id) {
      const p = state.pitches.find((x) => x.questions.some((q) => q.id === id));
      const q = p?.questions.find((x) => x.id === id);
      const text = q && hintFor(q.topic, p.spec.genres[0] || 'game');
      if (text) emit({ type: 'lines', lines: [{ who: 'hype', text, kind: 'say', to: 'you' }], pitchId: p.id });
    },
    categoryOf: (p) => (p?.category ? CATEGORIES[p.category] : null),
    expertOf: (p) => (p?.category ? expertId(p.category) : null),
    hearFinal: (text, opts) => queue(() => handleFinal(text, opts)),
    pause: (silentFor) => queue(() => handlePause(silentFor)),
    end: () => queue(handleEnd),
    hearInterim(text) {
      lastSpeechAt = clock();
      if (!cfg.interruptions || state.status !== 'live') return;
      const line = heckle(text, active() || prePitch, clock(), reflex);
      if (line) emit({ type: 'lines', lines: [line], pitchId: state.activeId });
    },
    // Called about once a second by the app: crowd chatter while you are talking.
    tick() {
      if (!cfg.chatter || state.status !== 'live') return;
      const now = clock();
      if (now - lastSpeechAt > 4000 || now - lastChatterAt < cfg.chatterEveryMs) return;
      const line = chatter(active(), reflex);
      if (line) { lastChatterAt = now; emit({ type: 'lines', lines: [line], pitchId: state.activeId }); }
    },
    configure(next) { Object.assign(cfg, next); },
    setProvider(next) { provider = next; state.providerName = next.name; changed(); },
    idle: () => chain,
    addChat,
  };
}
