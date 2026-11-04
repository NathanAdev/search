// Crowd sounds made on the fly with the Web Audio API: applause, cheers, gasps, laughs, boos, murmurs and stingers.
// No audio files, so nothing to download; everything is a few oscillators and filtered noise.
export function createSfx(win = globalThis) {
  const AC = win.AudioContext || win.webkitAudioContext;
  if (!AC) return null;
  let ctx = null;
  let master = null;
  let volume = 0.6;
  const ensure = () => {
    if (!ctx) { ctx = new AC(); master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  let noiseBuf = null;
  const noise = () => {
    if (noiseBuf) return noiseBuf;
    const c = ensure();
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  };
  function burst(t, { freq = 1800, q = 1.2, dur = 0.05, gain = 0.4, type = 'bandpass' } = {}) {
    const c = ensure();
    const s = c.createBufferSource(); s.buffer = noise(); s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  function tone(t, { freq, to, dur = 0.3, gain = 0.15, type = 'sine' }) {
    const c = ensure();
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  // A "voice" in the crowd: a buzzy tone through a vowel-ish filter, for woos and oohs.
  function vox(t, { freq, to, dur, gain = 0.05, formant = 900 }) {
    const c = ensure();
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = formant; f.Q.value = 4;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  const play = {
    applause(strength = 1, secs = 2.2) {
      const c = ensure(); const t0 = c.currentTime;
      const n = Math.round(60 * strength * secs);
      for (let i = 0; i < n; i++) { const t = t0 + Math.random() * secs * (0.6 + 0.4 * Math.random()); burst(t, { freq: 1200 + Math.random() * 2200, q: 0.9, dur: 0.035 + Math.random() * 0.03, gain: 0.25 * (1 - (t - t0) / (secs * 1.3)) }); }
    },
    cheer() {
      const c = ensure(); const t = c.currentTime;
      play.applause(1.3, 2.8);
      for (let i = 0; i < 7; i++) { const f = 200 + Math.random() * 260; vox(t + Math.random() * 0.5, { freq: f, to: f * (1.6 + Math.random() * 0.5), dur: 0.7 + Math.random() * 0.6, gain: 0.035, formant: 700 + Math.random() * 600 }); }
    },
    gasp() { const c = ensure(); const t = c.currentTime; for (let i = 0; i < 5; i++) vox(t + Math.random() * 0.12, { freq: 300 + Math.random() * 120, to: 420 + Math.random() * 160, dur: 0.45, gain: 0.03, formant: 1200 }); burst(t, { freq: 3000, q: 0.5, dur: 0.35, gain: 0.08, type: 'highpass' }); },
    laugh() { const c = ensure(); const t = c.currentTime; for (let k = 0; k < 4; k++) for (let i = 0; i < 5; i++) vox(t + k * 0.09 + i * 0.16 + Math.random() * 0.04, { freq: 240 + k * 50, to: 200 + k * 40, dur: 0.12, gain: 0.03, formant: 800 + k * 150 }); },
    boo() { const c = ensure(); const t = c.currentTime; for (let i = 0; i < 6; i++) vox(t + Math.random() * 0.3, { freq: 120 + Math.random() * 40, to: 90 + Math.random() * 20, dur: 1.2, gain: 0.04, formant: 450 }); },
    murmur() { const c = ensure(); const t = c.currentTime; for (let i = 0; i < 14; i++) burst(t + Math.random() * 1.4, { freq: 500 + Math.random() * 500, q: 3, dur: 0.18, gain: 0.05 }); },
    ding() { const c = ensure(); const t = c.currentTime; tone(t, { freq: 880, dur: 0.25, gain: 0.12 }); tone(t + 0.09, { freq: 1320, dur: 0.4, gain: 0.1 }); },
    sting() { const c = ensure(); const t = c.currentTime; [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.07, { freq: f, dur: 0.5, gain: 0.08, type: 'triangle' })); },
    drumroll(secs = 1.6) { const c = ensure(); const t = c.currentTime; for (let i = 0; i < secs * 28; i++) burst(t + i / 28, { freq: 220, q: 0.7, dur: 0.06, gain: 0.12 + (i / (secs * 28)) * 0.2, type: 'lowpass' }); tone(t + secs, { freq: 110, to: 55, dur: 0.6, gain: 0.25, type: 'sine' }); },
  };
  return {
    play: (name, ...args) => { try { play[name]?.(...args); } catch { /* audio blocked until a click */ } },
    setVolume(v) { volume = v; if (master) master.gain.value = v; },
    unlock() { ensure(); },
  };
}
