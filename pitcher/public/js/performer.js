// Performs crowd lines one at a time: speech bubble, optional voice, chatroom message.
// "say" lines are spoken to you; "chat" lines are the claudes talking to each other (text only);
// "heckle" lines cut in only if nobody else is talking, and are spoken only while you are silent.
export function createPerformer({ scene, voices, mic, addChat, settings, speed = 1, isUserTalking = () => false, onIdle = () => {} }) {
  const queue = [];
  let busy = false;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms / speed));

  async function perform(line) {
    const chatKind = line.kind === 'chat';
    const ms = chatKind ? 1600 : Math.max(1800, 500 + line.text.length * 48);
    if (line.to && line.to !== 'you') scene?.look(line.who, line.to); else scene?.look(line.who, 'you');
    scene?.say(line.who, line.text, ms / speed + (chatKind ? 0 : 900), chatKind ? 'chat' : line.kind);
    addChat({ who: line.who, text: line.text, kind: line.kind, to: line.to, question: !!line.question });
    const speak = settings.voices && voices && !chatKind && !(line.kind === 'heckle' && isUserTalking());
    if (speak) {
      const muteMic = mic && !settings.headphones;
      if (muteMic) mic.mute(true);
      try { await Promise.all([voices.speak(line.who, line.text), wait(Math.min(ms, 900))]); } finally { if (muteMic) setTimeout(() => mic.mute(false), 350); }
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
    clear() { queue.length = 0; voices?.cancel(); },
  };
}
