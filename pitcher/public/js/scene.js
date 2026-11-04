// The live theatre: a small 3D world projected onto a 2D canvas, so one scene renders from three camera angles.
// World units: x to the right of the stage, y up, z from the stage (negative) out into the audience (positive).
import { isExpert } from './categories.js';
import { PERSONAS, YOU, getPersona } from './personas.js';
import { SPRITE_H, SPRITE_W, drawMascot } from './sprites.js';
import { mulberry32 } from './util.js';

const W = 960;
const H = 540;
export const CAMERAS = {
  first: { label: 'You', x: 0, y: 2.25, z: -2.9, yaw: 0, pitch: 0.17, f: 590 },
  // Tilted side view from the front-right corner of the hall, so the rows fan out instead of lining up.
  side: { label: 'Side', x: 7.6, y: 4.8, z: 8.6, yaw: Math.atan2(-7.6, -8.0), pitch: 0.34, f: 600 },
  back: { label: 'Back', x: 0.5, y: 4.3, z: 11.5, yaw: Math.PI, pitch: 0.27, f: 700 },
};
const ROWS = 4;
const COLS = 6;
const rowZ = (r) => 2.6 + r * 1.75;
const rowY = (r) => r * 0.34;
const colX = (c) => (c - (COLS - 1) / 2) * 1.12 + (c >= COLS / 2 ? 0.35 : -0.35);
const MAIN_SEATS = { critic: [0, 1], monetizer: [0, 2], hype: [0, 3], wrestler: [0, 4] };
const EXPERT_SEAT = [0, 5];
const CONFETTI = ['#ffcf6b', '#e5484d', '#43b87c', '#4c8df6', '#f2b53a', '#ff6fa8', '#b49cf0'];
const CROWD_COLORS = ['#b49cf0', '#8fd3c7', '#f3a683', '#9fb4d9', '#f5a3c7', '#c9b38f', '#a7d389', '#e8c56b', '#88b8e8', '#d6a6e0'];
const ACCESSORY = { critic: 'critic', monetizer: 'monetizer', hype: 'hype', wrestler: 'wrestler' };

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpAngle(a, b, t) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createScene(canvas, { seed = 11 } = {}) {
  const ctx = canvas.getContext('2d');
  const rng = mulberry32(seed);
  let cam = { ...CAMERAS.first };
  let camKey = 'first';
  let from = null;
  let transition = null;
  let sign = 'PITCH MODE';
  let youTalking = false;
  let raf = 0;
  let writing = false;
  const bubbles = new Map();
  const actors = [];

  for (const [id, [r, c]] of Object.entries(MAIN_SEATS)) {
    actors.push({ id, main: true, color: PERSONAS[id].color, x: colX(c), z: rowZ(r), y: rowY(r) + 0.42, face: -1, mood: 'neutral', talking: 0, anim: 'idle', animUntil: 0, look: 0, phase: rng() * 6, accessory: ACCESSORY[id] });
  }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (r === 0 && c >= 1 && c <= 5) continue;
    if (rng() < 0.28) continue;
    const a = rng();
    actors.push({ id: `crowd-${r}-${c}`, main: false, color: CROWD_COLORS[Math.floor(rng() * CROWD_COLORS.length)], x: colX(c), z: rowZ(r), y: rowY(r) + 0.42, face: -1,
      mood: 'neutral', talking: 0, anim: 'idle', animUntil: 0, look: 0, phase: rng() * 6, accessory: a < 0.15 ? 'glasses' : a < 0.27 ? 'beanie' : null });
  }
  const expert = { id: 'expert', main: true, hidden: true, color: '#9db0c4', x: colX(EXPERT_SEAT[1]), z: rowZ(EXPERT_SEAT[0]), y: rowY(EXPERT_SEAT[0]) + 0.42, face: -1, mood: 'neutral', talking: 0, anim: 'idle', animUntil: 0, look: 0, phase: 1.3, accessory: 'expert', personaId: null };
  actors.push(expert);
  let energy = 0.2;
  const particles = [];
  const you = { id: 'you', color: YOU.color, x: 0, z: -1.5, y: 0.6, face: 1, mood: 'neutral', talking: 0, anim: 'idle', animUntil: 0, look: 0, phase: 0, mic: true };
  const seats = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) seats.push({ x: colX(c), z: rowZ(r), y: rowY(r) });

  // ---------- projection ----------
  // World -> camera space (x right, y up, z forward).
  function toCam(p) {
    const dx = p.x - cam.x, dy = p.y - cam.y, dz = p.z - cam.z;
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    const rx = dx * cy - dz * sy;
    const fz = dx * sy + dz * cy;
    const sp = Math.sin(cam.pitch), cp = Math.cos(cam.pitch);
    return { x: rx, y: dy * cp + fz * sp, z: fz * cp - dy * sp };
  }
  const toScreen = (c) => ({ x: W / 2 + (c.x * cam.f) / c.z, y: H / 2 - (c.y * cam.f) / c.z, z: c.z });
  function project(p) { return toScreen(toCam(p)); }
  const NEAR = 0.15;
  // Clip a camera-space polygon against the near plane, so big floors and walls behind the camera still draw.
  function clipNear(poly) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const ain = a.z >= NEAR, bin = b.z >= NEAR;
      if (ain) out.push(a);
      if (ain !== bin) {
        const t = (NEAR - a.z) / (b.z - a.z);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR });
      }
    }
    return out;
  }
  const camPos = () => ({ x: cam.x, y: cam.y, z: cam.z });
  const fwd = () => ({ x: Math.sin(cam.yaw), z: Math.cos(cam.yaw) });
  const right = () => ({ x: Math.cos(cam.yaw), z: -Math.sin(cam.yaw) });

  function quad(pts, fill, stroke) {
    const clipped = clipNear(pts.map(toCam));
    if (clipped.length < 3) return;
    const P = clipped.map(toScreen);
    ctx.beginPath();
    P.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  // Axis-aligned box, visible faces only, far faces first.
  function box(x0, x1, y0, y1, z0, z1, col) {
    const c = camPos();
    const faces = [
      { n: [0, 0, -1], pts: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], f: col.front, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, cz: z0 },
      { n: [0, 0, 1], pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], f: col.front, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, cz: z1 },
      { n: [-1, 0, 0], pts: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], f: col.side, cx: x0, cy: (y0 + y1) / 2, cz: (z0 + z1) / 2 },
      { n: [1, 0, 0], pts: [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], f: col.side, cx: x1, cy: (y0 + y1) / 2, cz: (z0 + z1) / 2 },
      { n: [0, 1, 0], pts: [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], f: col.top, cx: (x0 + x1) / 2, cy: y1, cz: (z0 + z1) / 2 },
    ];
    faces.filter((fc) => fc.n[0] * (c.x - fc.cx) + fc.n[1] * (c.y - fc.cy) + fc.n[2] * (c.z - fc.cz) > 0)
      .sort((a, b) => Math.hypot(c.x - b.cx, c.y - b.cy, c.z - b.cz) - Math.hypot(c.x - a.cx, c.y - a.cy, c.z - a.cz))
      .forEach((fc) => quad(fc.pts.map(([x, y, z]) => ({ x, y, z })), fc.f));
  }
  const depthOf = (p) => project(p).z;

  // ---------- characters ----------
  function viewFor(a) {
    const c = camPos();
    const vx = c.x - a.x, vz = c.z - a.z;
    const len = Math.hypot(vx, vz) || 1;
    const d = (a.face * vz) / len;
    if (d > 0.55) return { view: 'front', flip: false };
    if (d < -0.55) return { view: 'back', flip: false };
    const s = a.face * right().z;
    return { view: 'side', flip: s < 0 };
  }

  function expression(a, t) {
    const talking = a.talking > t && Math.floor(t / 130) % 2 === 0;
    const anim = a.animUntil > t ? a.anim : 'idle';
    let eyes = 'neutral', mouth = 'neutral', arms = 'down';
    if (a.id === 'critic') { eyes = a.mood === 'convinced' ? 'neutral' : 'angry'; mouth = a.mood === 'convinced' ? 'smile' : a.mood === 'hostile' ? 'frown' : 'neutral'; arms = 'cross'; }
    if (a.id === 'monetizer') { mouth = a.mood === 'happy' ? 'smile' : a.mood === 'sad' ? 'frown' : 'neutral'; eyes = a.mood === 'happy' ? 'happy' : 'neutral'; }
    if (a.id === 'hype') { eyes = 'happy'; mouth = 'smile'; }
    if (a.id === 'wrestler') { eyes = 'angry'; mouth = 'smile'; }
    if (a.id === 'expert') { eyes = a.mood === 'happy' ? 'happy' : 'neutral'; mouth = a.mood === 'annoyed' ? 'frown' : 'smile'; }
    if (!a.main && a.id !== 'you') { mouth = a.mood === 'happy' ? 'smile' : 'neutral'; }
    if (anim === 'clap' || anim === 'cheer') { arms = Math.floor(t / 180) % 2 ? 'up' : 'down'; if (!a.main) { eyes = 'happy'; mouth = 'smile'; } }
    if (anim === 'gasp') { eyes = 'surprised'; mouth = 'open'; }
    if (anim === 'think') eyes = 'think';
    if (anim === 'wave') arms = 'wave';
    if (writing && a.main) arms = 'write';
    if (talking) mouth = 'open';
    return { eyes, mouth, arms };
  }

  function drawActor(a, t, seated = true) {
    if (a.hidden) return null;
    const bob = Math.sin(t / (420 - energy * 180) + a.phase) * (0.012 + energy * 0.03) + (a.animUntil > t && (a.anim === 'cheer' || a.anim === 'clap') ? Math.abs(Math.sin(t / 150)) * 0.05 : 0);
    const heightW = 0.95;
    const base = project({ x: a.x, y: a.y + bob, z: a.z });
    const topP = project({ x: a.x, y: a.y + bob + heightW, z: a.z });
    if (base.z <= 0.2) return null;
    const hpx = base.y - topP.y;
    const s = hpx / (seated ? 12 : SPRITE_H);
    const { view, flip } = viewFor(a);
    const ex = expression(a, t);
    const lean = a.lean && a.talking > t ? a.lean * s * 0.8 : 0;
    drawMascot(ctx, base.x - (SPRITE_W * s) / 2 + lean, base.y - hpx, s, { color: a.color, view, flip, ...ex, look: a.look, accessory: a.accessory, accent: a.accent, blush: a.id === 'hype', legs: !seated, mic: a.mic, pencil: Math.floor(t / 200) % 3 });
    return { x: base.x, y: base.y - hpx - (a.accessory === 'monetizer' ? 4 * s : 0), s, view };
  }

  function drawChairPart(seat, part) {
    const red = { front: '#7d1f2b', side: '#5e1620', top: '#99303d' };
    if (part === 'seat') box(seat.x - 0.42, seat.x + 0.42, seat.y + 0.18, seat.y + 0.42, seat.z - 0.3, seat.z + 0.3, red);
    else box(seat.x - 0.45, seat.x + 0.45, seat.y + 0.18, seat.y + 1.0, seat.z + 0.3, seat.z + 0.44, red);
  }

  // ---------- room ----------
  function drawRoom(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#191424');
    g.addColorStop(1, '#0d0b12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    quad([{ x: -7, y: 0, z: -5 }, { x: 7, y: 0, z: -5 }, { x: 7, y: 0, z: 12 }, { x: -7, y: 0, z: 12 }], '#2a2233');
    quad([{ x: -0.35, y: 0.01, z: 0 }, { x: 0.35, y: 0.01, z: 0 }, { x: 0.35, y: 0.01, z: 12 }, { x: -0.35, y: 0.01, z: 12 }], '#55232e');
    for (let r = 1; r < ROWS; r++) box(-4.4, 4.4, 0, rowY(r), rowZ(r) - 0.85, rowZ(r) + 0.85, { front: '#3a3045', side: '#30283a', top: '#3f3449' });
    // walls
    quad([{ x: -7, y: 0, z: 12 }, { x: 7, y: 0, z: 12 }, { x: 7, y: 6, z: 12 }, { x: -7, y: 6, z: 12 }], '#231c2d');
    quad([{ x: -7, y: 0, z: -5 }, { x: -7, y: 0, z: 12 }, { x: -7, y: 6, z: 12 }, { x: -7, y: 6, z: -5 }], '#1f1928');
    quad([{ x: 7, y: 0, z: -5 }, { x: 7, y: 0, z: 12 }, { x: 7, y: 6, z: 12 }, { x: 7, y: 6, z: -5 }], '#1f1928');
    quad([{ x: -7, y: 0, z: -5 }, { x: 7, y: 0, z: -5 }, { x: 7, y: 6, z: -5 }, { x: -7, y: 6, z: -5 }], '#170f1c');
    // curtains behind the stage
    for (let i = 0; i < 14; i++) {
      const x0 = -7 + i;
      const wave = Math.sin(t / 1600 + i) * 0.04;
      quad([{ x: x0, y: 0.6, z: -4.9 + wave }, { x: x0 + 1, y: 0.6, z: -4.9 - wave }, { x: x0 + 1, y: 6, z: -4.9 - wave }, { x: x0, y: 6, z: -4.9 + wave }], i % 2 ? '#8e1d2c' : '#a3263a');
    }
    // stage
    box(-5.2, 5.2, 0, 0.6, -5, -0.25, { front: '#6b4a2f', side: '#563b25', top: '#8a6240' });
    for (let i = -5; i <= 5; i++) quad([{ x: i, y: 0.605, z: -5 }, { x: i + 0.03, y: 0.605, z: -5 }, { x: i + 0.03, y: 0.605, z: -0.25 }, { x: i, y: 0.605, z: -0.25 }], '#734f33');
    drawSigns(t);
  }

  function signAt(z, flipText) {
    const tl = project({ x: flipText ? 3.2 : -3.2, y: 5.4, z });
    const br = project({ x: flipText ? -3.2 : 3.2, y: 4.3, z });
    if (tl.z <= 0.1 || br.z <= 0.1) return;
    const x = Math.min(tl.x, br.x), y = Math.min(tl.y, br.y), w = Math.abs(br.x - tl.x), h = Math.abs(br.y - tl.y);
    if (w < 20) return;
    ctx.fillStyle = '#0e0a14';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ffcf6b';
    ctx.lineWidth = Math.max(1, h / 22);
    ctx.strokeRect(x, y, w, h);
    ctx.save();
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = h / 3;
    ctx.fillStyle = '#ffe3a1';
    ctx.font = `700 ${Math.round(h * 0.26)}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NOW PITCHING', x + w / 2, y + h * 0.3, w * 0.9);
    ctx.font = `700 ${Math.round(h * 0.34)}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.fillText(sign.toUpperCase(), x + w / 2, y + h * 0.68, w * 0.92);
    ctx.restore();
  }
  function drawSigns() { signAt(-4.85, false); signAt(11.9, true); }

  function drawSpotlight() {
    const src = project({ x: 0, y: 6, z: 1.5 });
    const ring = [];
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; ring.push(project({ x: you.x + Math.cos(a) * 1.1, y: 0.61, z: you.z + Math.sin(a) * 0.8 })); }
    if (src.z <= 0.1 || ring.some((p) => p.z <= 0.1)) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255, 226, 160, 0.07)';
    const xs = ring.map((p) => p.x);
    const left = ring[xs.indexOf(Math.min(...xs))];
    const rightP = ring[xs.indexOf(Math.max(...xs))];
    ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(left.x, left.y); ctx.lineTo(rightP.x, rightP.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255, 226, 160, 0.16)';
    ctx.beginPath(); ring.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------- bubbles ----------
  function wrap(text, maxW) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines.length > 4 ? [...lines.slice(0, 3), `${lines[3].slice(0, 28)}…`] : lines;
  }
  let placed = [];
  function drawBubble(anchor, b, color, t) {
    const age = t - b.at;
    const alpha = Math.min(1, age / 160, (b.until - t) / 300);
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = b.kind === 'chat' ? '600 12px system-ui, sans-serif' : b.kind === 'crowd' ? '600 12px system-ui, sans-serif' : '600 14px system-ui, sans-serif';
    const text = b.kind === 'chat' ? '…' : b.text;
    const lines = wrap(text, b.kind === 'crowd' ? 170 : 230);
    const lh = b.kind === 'chat' || b.kind === 'crowd' ? 14 : 17;
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 18;
    const h = lines.length * lh + 12;
    const x = Math.max(6, Math.min(W - w - 6, anchor.x - w / 2));
    let y = Math.max(6, anchor.y - h - 12);
    // Stack bubbles that would overlap, newest on top, so several speakers stay readable.
    for (let guard = 0; guard < 6; guard++) {
      const hit = placed.find((r) => x < r.x + r.w + 4 && x + w + 4 > r.x && y < r.y + r.h + 4 && y + h + 13 > r.y);
      if (!hit) break;
      y = hit.y - h - 14;
    }
    if (y < 4) y = 4;
    placed.push({ x, y, w, h });
    ctx.fillStyle = b.kind === 'heckle' ? '#fff3f3' : '#fbf8f1';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 9);
    ctx.fill(); ctx.stroke();
    const tx = Math.max(x + 10, Math.min(x + w - 10, anchor.x));
    ctx.beginPath(); ctx.moveTo(tx - 7, y + h); ctx.lineTo(tx, y + h + 9); ctx.lineTo(tx + 7, y + h); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(tx - 7, y + h); ctx.lineTo(tx, y + h + 9); ctx.lineTo(tx + 7, y + h); ctx.stroke();
    ctx.fillStyle = '#211d27';
    ctx.textBaseline = 'top';
    lines.forEach((l, i) => ctx.fillText(l, x + 9, y + 6 + i * lh));
    ctx.restore();
  }
  function drawSweep(t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [i, col] of [[0, 'rgba(255,120,190,0.10)'], [1, 'rgba(120,170,255,0.10)']]) {
      const ang = Math.sin(t / 900 + i * 2.1) * 0.5;
      const sx = i ? W * 0.9 : W * 0.1;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(sx, -10);
      ctx.lineTo(sx + Math.sin(ang - 0.12) * H * 1.3, H); ctx.lineTo(sx + Math.sin(ang + 0.12) * H * 1.3, H); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  function drawConfetti() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.99; p.r += p.vr; p.life--;
      if (p.life <= 0 || p.y > H + 20) { particles.splice(i, 1); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-4, -2.5, 8, 5); ctx.restore();
    }
  }
  function drawTag(anchor, a) {
    const p = a.id === 'expert' ? getPersona(a.personaId) : PERSONAS[a.id];
    if (!p) return;
    ctx.save();
    ctx.font = '700 11px system-ui, sans-serif';
    const w = ctx.measureText(p.name).width + 10;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = 0.92;
    ctx.beginPath(); ctx.roundRect(anchor.x - w / 2, anchor.y - 18, w, 15, 7); ctx.fill();
    ctx.fillStyle = '#16131b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.name, anchor.x, anchor.y - 10.5);
    if (a.id === 'expert') { ctx.font = '600 9px system-ui, sans-serif'; ctx.fillStyle = p.color; ctx.fillText('EXPERT', anchor.x, anchor.y - 25); }
    ctx.restore();
  }

  function drawFirstPersonHud(t) {
    const s = 8;
    const talk = youTalking ? Math.sin(t / 90) * 3 : 0;
    // your own two stubby claude arms, pixel style, reaching in from the bottom corners
    const arm = (x0, dir, bob) => {
      const cells = [[0, 3], [1, 2], [1, 3], [2, 1], [2, 2], [2, 3], [3, 1], [3, 2], [3, 3], [4, 0], [4, 1], [4, 2], [5, 0], [5, 1]];
      for (const [cx, cy] of cells) {
        const x = dir > 0 ? x0 + cx * s : x0 - (cx + 1) * s;
        ctx.fillStyle = cy === 0 || cx === 5 ? '#e89273' : cy === 3 ? '#a6553a' : YOU.color;
        ctx.fillRect(x, H - 4 * s * 1.1 + cy * s + bob, s + 0.6, s + 0.6);
      }
      ctx.fillStyle = YOU.color;
      ctx.fillRect(dir > 0 ? x0 - 6 * s : x0, H - s + bob, 6 * s, s * 2);
    };
    arm(W * 0.17, 1, talk);
    arm(W * 0.83, -1, -talk);
    ctx.fillStyle = '#2f2e38';
    ctx.fillRect(W / 2 - 7, H - 120, 14, 130);
    ctx.fillStyle = '#7b7b88';
    ctx.beginPath(); ctx.roundRect(W / 2 - 18, H - 150, 36, 44, 14); ctx.fill();
    if (youTalking) {
      ctx.strokeStyle = 'rgba(255, 207, 107, 0.7)';
      ctx.lineWidth = 3;
      for (let i = 1; i <= 3; i++) { const r = 26 + i * 12 + (t / 40) % 12; ctx.beginPath(); ctx.arc(W / 2, H - 128, r, -2.4, -0.74); ctx.stroke(); }
    }
  }

  // ---------- frame ----------
  function frame(t) {
    if (transition) {
      const k = Math.min(1, (t - transition.start) / 700);
      const e = ease(k);
      const to = CAMERAS[camKey];
      for (const key of ['x', 'y', 'z', 'pitch', 'f']) cam[key] = lerp(from[key], to[key], e);
      cam.yaw = lerpAngle(from.yaw, to.yaw, e);
      if (k >= 1) transition = null;
    }
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    drawRoom(t);
    drawSpotlight();
    const ents = [];
    for (const seat of seats) {
      ents.push({ d: depthOf({ x: seat.x, y: seat.y + 0.3, z: seat.z }) + 0.02, draw: () => drawChairPart(seat, 'seat') });
      ents.push({ d: depthOf({ x: seat.x, y: seat.y + 0.6, z: seat.z + 0.37 }), draw: () => drawChairPart(seat, 'back') });
    }
    const anchors = new Map();
    for (const a of actors) ents.push({ d: depthOf({ x: a.x, y: a.y + 0.45, z: a.z }), draw: () => { const r = drawActor(a, t, true); if (r) anchors.set(a.id, r); } });
    if (camKey !== 'first' || transition) ents.push({ d: depthOf({ x: you.x, y: you.y + 0.5, z: you.z }), draw: () => { const r = drawActor(you, t, false); if (r) anchors.set('you', r); } });
    ents.sort((a, b) => b.d - a.d).forEach((e) => e.draw());
    if (energy > 0.55) drawSweep(t);
    drawConfetti();
    for (const a of actors) if (a.main && !a.hidden && anchors.has(a.id) && !bubbles.has(a.id) && !bubbles.has(a.personaId)) drawTag(anchors.get(a.id), a);
    if (camKey === 'first' && !transition) drawFirstPersonHud(t);
    let lift = 0;
    placed = [];
    for (const [id, b] of [...bubbles.entries()].sort((x, y) => x[1].at - y[1].at)) {
      if (b.until < t) { bubbles.delete(id); continue; }
      const actorId = isExpert(id) ? 'expert' : id;
      const anchor = anchors.get(actorId) || (id === 'you' ? { x: W / 2, y: H - 160 } : null);
      if (!anchor) continue;
      const crowdActor = actors.find((a) => a.id === id && !a.main);
      drawBubble(anchor, { ...b, lift, text: crowdActor?.name && b.kind === 'crowd' ? `${crowdActor.name}: ${b.text}` : b.text }, id === 'you' ? YOU.color : getPersona(id)?.color || crowdActor?.color || '#ccc', t);
      lift = 0;
    }
  }

  const find = (id) => (id === 'you' ? you : isExpert(id) ? expert : actors.find((a) => a.id === id));
  const now = () => performance.now();
  return {
    W, H, actors, you,
    setCamera(key) {
      if (!CAMERAS[key] || key === camKey) return;
      from = { ...cam };
      camKey = key;
      transition = { start: now() };
    },
    get camera() { return camKey; },
    setSign(text) { sign = String(text || 'PITCH MODE').slice(0, 34); },
    say(id, text, ms, kind = 'say') { const t = now(); bubbles.set(id, { text, kind, at: t, until: t + ms }); const a = find(id); if (a && kind !== 'chat') a.talking = t + Math.min(ms, 400 + text.length * 55); },
    setMood(id, mood) { const a = find(id); if (a) a.mood = mood; },
    look(id, targetId) {
      const a = find(id), b = find(targetId);
      if (!a || !b) return;
      a.look = b.x > a.x + 0.2 ? 1 : b.x < a.x - 0.2 ? -1 : 0;
      a.lean = a.look;
    },
    animate(id, anim, ms = 1500) { const a = find(id); if (a) { a.anim = anim; a.animUntil = now() + ms; } },
    crowd(anim, share = 0.6, ms = 1600) { for (const a of actors) if (!a.main && rng() < share) { a.anim = anim; a.animUntil = now() + ms * (0.7 + rng() * 0.6); if (anim === 'cheer') a.mood = 'happy'; } },
    setYouTalking(on) { youTalking = on; you.talking = on ? now() + 400 : 0; },
    setWriting(on) { writing = on; },
    // The category expert takes the expert seat (null empties it).
    setExpert(personaId) {
      const p = personaId && getPersona(personaId);
      if (!p) { expert.hidden = true; expert.personaId = null; return; }
      const fresh = expert.personaId !== personaId;
      Object.assign(expert, { hidden: false, personaId, color: p.color });
      if (fresh) { expert.anim = 'cheer'; expert.animUntil = performance.now() + 1600; }
    },
    nameCrowd(names) {
      const crowdActors = actors.filter((a) => !a.main);
      names.forEach((n, i) => { const a = crowdActors[(i * 7 + 3) % crowdActors.length]; if (a && !a.name) a.name = n; });
      return actors.filter((a) => a.name).map((a) => ({ id: a.id, name: a.name }));
    },
    confetti(n = 150) { for (let i = 0; i < n; i++) particles.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2 + 1, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: CONFETTI[i % CONFETTI.length], life: 260 + Math.random() * 120 }); },
    setEnergy(v) { energy = Math.max(0, Math.min(1, v)); },
    get energy() { return energy; },
    frame,
    start() { const loop = (t) => { frame(t); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); },
    stop() { cancelAnimationFrame(raf); },
  };
}
