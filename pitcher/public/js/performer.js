// Performs crowd lines one at a time: speech bubble, optional voice, chatroom message.
// "say" lines are spoken to you; "chat" lines are the claudes talking to each other (text only);
// "heckle" lines cut in only if nobody else is talking, and are spoken only while you are silent.
export function createPerformer({ scene, getVoices = () => null, getMic = () => null, addChat, settings, speed = 1, isUserTalking = () => false, onIdle = () => {}, onLine = () => {} }) {
  const queue = [];
  let busy = false;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms / speed));

  async function perform(line) {
    const chatKind = line.kind === 'chat';
    const ms = chatKind ? 1600 : Math.max(1800, 500 + line.text.length * 48);
    if (line.to && line.to !== 'you') scene?.look(line.who, line.to); else scene?.look(line.who, 'you');
    scene?.say(line.who, line.text, ms / speed + (chatKind ? 0 : 900), chatKind ? 'chat' : line.kind);
    addChat({ who: line.who, text: line.text, kind: line.kind, to: line.to, question: !!line.question });
    onLine(line);
    const voices = getVoices();
    const mic = getMic();
    const speak = settings.tts !== 'off' && voices && !chatKind && !(line.kind === 'heckle' && isUserTalking());
    if (speak) {
      const muteMic = mic && !settings.headphones;
      if (muteMic) mic.mute(true);
      try { await Promise.all([voices.speak(line.who, line.text).catch(() => {}), wait(Math.min(ms, 900))]); } finally { if (muteMic) setTimeout(() => mic.mute(false), 350); }
    } else {
      await wait(chatKind ? 700 : Math.min(ms, 1400));
    }
    await wait(220);
  }

  async function drain() {
    if (busy) return;
    busy = true;
    try { while (queue.length) await perform(queue.shift()); } finally { busy = false; onIdle(); }
  }

  return {
    push(lines) {
      for (const l of lines) {
        if (l.kind === 'heckle' && (busy || queue.length)) continue; // a heckle only lands in silence
        queue.push(l);
      }
      drain();
    },
    get busy() { return busy || queue.length > 0; },
    // Background crowd members: a quick bubble and a chatroom line, never queued behind the main cast.
    crowd(actorId, name, text) { scene?.say(actorId, text, 2600 / speed, 'crowd'); addChat({ who: 'crowd', name, text, kind: 'crowd' }); },
    clear() { queue.length = 0; getVoices()?.cancel(); },
  };
}
