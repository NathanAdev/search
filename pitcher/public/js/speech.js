// Microphone (browser speech recognition) and crowd voices (speech synthesis).
// Both take injectable constructors so tests can run without a real microphone or voices.

export function speechSupport(win = globalThis) {
  return { recognition: !!(win.SpeechRecognition || win.webkitSpeechRecognition), synthesis: !!win.speechSynthesis };
}

// Calls onInterim(text) while you talk, onFinal(text) per finished phrase, onPause(ms) once you stop for pauseMs.
export function createMic({ win = globalThis, lang = 'en-US', pauseMs = 1800, onInterim, onFinal, onPause, onState, onError } = {}) {
  const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!SR) return null;
  let rec = null;
  let wanted = false;
  let muted = false;
  let lastHeard = 0;
  let pauseFired = true;
  let timer = 0;

  function make() {
    const r = new SR();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      if (muted) return;
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0].transcript.trim();
        if (!text) continue;
        if (res.isFinal) onFinal?.(text); else interim += `${text} `;
      }
      lastHeard = Date.now();
      pauseFired = false;
      if (interim.trim()) onInterim?.(interim.trim());
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') wanted = false;
      onError?.(e.error === 'not-allowed' ? 'Microphone permission was denied. Allow it in the address bar, or type instead.' : `Speech recognition error: ${e.error}`);
    };
    // Chrome ends continuous recognition every so often; restart while pitch mode wants the mic.
    r.onend = () => { if (wanted && !muted) { try { r.start(); } catch { /* already started */ } } else onState?.(muted ? 'muted' : 'off'); };
    r.onstart = () => onState?.('listening');
    return r;
  }

  const tick = () => {
    if (!pauseFired && lastHeard && Date.now() - lastHeard >= pauseMs) { pauseFired = true; onPause?.(Date.now() - lastHeard); }
  };
  return {
    start() { wanted = true; muted = false; rec = rec || make(); try { rec.start(); } catch { /* already started */ } clearInterval(timer); timer = setInterval(tick, 250); },
    stop() { wanted = false; clearInterval(timer); try { rec?.stop(); } catch { /* not started */ } onState?.('off'); },
    // While the crowd speaks out loud, stop listening so the mic does not transcribe them.
    mute(on) {
      if (on === muted) return;
      muted = on;
      if (!wanted) return;
      if (on) { try { rec?.abort ? rec.abort() : rec?.stop(); } catch { /* ignore */ } onState?.('muted'); } else { try { rec.start(); } catch { /* ignore */ } }
    },
    get listening() { return wanted && !muted; },
    silentFor: () => (lastHeard ? Date.now() - lastHeard : 0),
  };
}

// Each persona gets a different voice where the browser has several, plus its own pitch and rate.
export function createVoices({ win = globalThis, personas } = {}) {
  const synth = win.speechSynthesis;
  if (!synth) return null;
  let voices = [];
  const load = () => { voices = synth.getVoices().filter((v) => /^en/i.test(v.lang)); };
  load();
  if ('onvoiceschanged' in synth) synth.onvoiceschanged = load;
  const ids = Object.keys(personas);
  return {
    speak(id, text) {
      return new Promise((resolve) => {
        const Utter = win.SpeechSynthesisUtterance;
        if (!Utter) return resolve();
        const u = new Utter(text);
        const p = personas[id]?.voice || { pitch: 1, rate: 1 };
        u.pitch = p.pitch;
        u.rate = p.rate;
        if (voices.length) u.voice = voices[ids.indexOf(id) % voices.length];
        const done = () => { clearTimeout(guard); resolve(); };
        const guard = setTimeout(done, 2500 + text.length * 90); // some browsers never fire onend
        u.onend = done;
        u.onerror = done;
        synth.speak(u);
      });
    },
    cancel() { synth.cancel(); },
  };
}
