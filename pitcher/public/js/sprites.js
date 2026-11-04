// Pixel-art claude mascots drawn straight onto a canvas. One cell = one "pixel" of the sprite.
// view: 'front' | 'back' | 'side' (side faces right; flip for left).

const BODY = {
  front: [
    '................',
    '....OOOOOOOO....',
    '...OHHOOOOOOS...',
    '..OHOOOOOOOOOS..',
    '..OOOOOOOOOOOS..',
    '..OOOOOOOOOOOS..',
    '..OOOOOOOOOOOS..',
    '..OOOOOOOOOOOS..',
    '..OOOOOOOOOOOS..',
    '..OOOOOOOOOOSS..',
    '...OOOOOOOOSS...',
    '....SSSSSSSS....',
    '....OO....OO....',
    '....OO....OO....',
    '....SS....SS....',
  ],
  side: [
    '................',
    '.....OOOOOOO....',
    '....OHHOOOOOS...',
    '...OHOOOOOOOOS..',
    '...OOOOOOOOOOS..',
    '...OOOOOOOOOOS..',
    '...OOOOOOOOOOS..',
    '...OOOOOOOOOOS..',
    '...OOOOOOOOOOS..',
    '...OOOOOOOOOSS..',
    '....OOOOOOOSS...',
    '.....SSSSSSS....',
    '.....OO..OO.....',
    '.....OO..OO.....',
    '.....SS..SS.....',
  ],
};
BODY.back = BODY.front.map((r) => r.replace(/H/g, 'O'));
export const SPRITE_W = 16;
export const SPRITE_H = 15;
const INK = '#1d1b22';

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// opts: { color, view, flip, eyes: 'neutral'|'angry'|'happy'|'surprised'|'think', mouth: 'neutral'|'smile'|'frown'|'open',
//         arms: 'down'|'up'|'cross'|'write'|'wave', accessory, look: -1|0|1, blush, legs: boolean, mic }
export function drawMascot(ctx, left, top, s, o) {
  const view = o.view || 'front';
  const map = BODY[view];
  const flip = !!o.flip;
  const main = o.color;
  const pal = { O: main, H: shade(main, 1.25), S: shade(main, 0.72) };
  const px = (gx, gy, color) => {
    const x = flip ? SPRITE_W - 1 - gx : gx;
    ctx.fillStyle = color;
    ctx.fillRect(left + x * s, top + gy * s, s + 0.6, s + 0.6);
  };
  const rows = o.legs === false ? 12 : SPRITE_H;
  for (let y = 0; y < rows; y++) {
    const row = map[y];
    for (let x = 0; x < SPRITE_W; x++) { const c = row[x]; if (c !== '.') px(x, y, pal[c]); }
  }
  // arms
  const armC = pal.S;
  const glove = o.accessory === 'wrestler' ? '#d23b3b' : armC;
  const arm = (cells, color = armC) => cells.forEach(([x, y]) => px(x, y, color));
  if (view === 'side') {
    if (o.arms === 'up' || o.arms === 'wave') arm([[11, 3], [12, 3], [12, 4], [13, 2]], o.accessory === 'wrestler' ? glove : armC);
    else if (o.arms === 'write') arm([[11, 7], [12, 7], [13, 7]]);
    else arm([[8, 6], [8, 7], [8, 8], [9, 8]]);
  } else if (o.arms === 'up') {
    arm([[1, 3], [1, 4], [0, 2], [0, 3], [14, 3], [14, 4], [15, 2], [15, 3]]);
    if (o.accessory === 'wrestler') arm([[0, 2], [15, 2]], glove);
  } else if (o.arms === 'cross' && view === 'front') {
    arm([[3, 7], [4, 7], [5, 7], [6, 7], [7, 8], [8, 8], [9, 7], [10, 7], [11, 7], [12, 7], [6, 8], [9, 8]]);
  } else if (o.arms === 'write' && view === 'front') {
    arm([[1, 6], [1, 7], [14, 6], [14, 7]]);
  } else if (o.arms === 'wave') {
    arm([[1, 6], [1, 7], [1, 8], [14, 3], [14, 4], [15, 2], [15, 3]]);
  } else {
    arm([[1, 6], [1, 7], [1, 8], [14, 6], [14, 7], [14, 8]]);
    if (o.accessory === 'wrestler') arm([[1, 8], [14, 8]], glove);
  }

  if (view !== 'back') {
    const L = o.look || 0;
    const eyes = view === 'side' ? [[10 + Math.max(0, L), 4]] : [[5 + L, 4], [9 + L, 4]];
    for (const [ex, ey] of eyes) {
      if (o.eyes === 'happy') { px(ex, ey + 1, INK); px(ex + 1, ey + 1, INK); px(ex, ey, INK); }
      else if (o.eyes === 'surprised') { for (let dy = -1; dy <= 1; dy++) { px(ex, ey + dy, INK); px(ex + 1, ey + dy, INK); } }
      else if (o.eyes === 'think') { px(ex, ey - 1, INK); px(ex + 1, ey - 1, INK); px(ex, ey, INK); px(ex + 1, ey, INK); }
      else { px(ex, ey, INK); px(ex + 1, ey, INK); px(ex, ey + 1, INK); px(ex + 1, ey + 1, INK); }
    }
    if (o.eyes === 'angry') {
      if (view === 'side') { px(10, 2, INK); px(11, 3, INK); }
      else { px(4 + L, 2, INK); px(5 + L, 2, INK); px(6 + L, 3, INK); px(11 + L, 2, INK); px(10 + L, 2, INK); px(9 + L, 3, INK); }
    }
    if (o.blush) { const c = '#ff8fb1'; if (view === 'side') px(10, 7, c); else { px(4, 7, c); px(11, 7, c); } }
    const m = o.mouth || 'neutral';
    const mx = view === 'side' ? 11 : 7;
    const mouth = { neutral: [[mx, 8], [mx + 1, 8]], smile: view === 'side' ? [[mx, 8], [mx + 1, 7]] : [[6, 7], [7, 8], [8, 8], [9, 7]],
      frown: view === 'side' ? [[mx, 8], [mx + 1, 9]] : [[6, 9], [7, 8], [8, 8], [9, 9]], open: [[mx, 8], [mx + 1, 8], [mx, 9], [mx + 1, 9]] }[m];
    for (const [x, y] of mouth) px(x, y, INK);
  }

  // accessories
  const acc = o.accessory;
  if (acc === 'monetizer') {
    const hat = '#2a2530';
    for (let x = 3; x <= 12; x++) px(x, 0, hat);
    for (let y = -4; y <= -1; y++) for (let x = 5; x <= 10; x++) px(x, y, y === -1 ? '#f7d35c' : hat);
  } else if (acc === 'hype') {
    const bow = '#ff6fa8';
    [[10, 0], [11, 1], [12, 0], [13, 1], [12, 1], [10, 1]].forEach(([x, y]) => px(x, y, bow));
  } else if (acc === 'wrestler') {
    for (let x = 3; x <= 12; x++) px(x, 2, '#f4f1ea');
    if (view !== 'side') { px(13, 2, '#f4f1ea'); px(14, 3, '#f4f1ea'); }
  } else if (acc === 'critic' && view === 'front') {
    px(12, 3, '#ffe08a'); px(13, 4, '#ffe08a'); // monocle glint
  } else if (acc === 'glasses' && view !== 'back') {
    const g = '#3b3944';
    if (view === 'side') { px(9, 4, g); px(12, 4, g); } else { px(4, 4, g); px(7, 4, g); px(8, 4, g); px(11, 4, g); }
  } else if (acc === 'beanie') {
    for (let x = 4; x <= 11; x++) { px(x, 0, '#6e7bd9'); px(x, 1, '#6e7bd9'); }
    px(7, -1, '#f4f1ea'); px(8, -1, '#f4f1ea');
  }
  if (o.mic) {
    const mxx = view === 'side' ? 13 : 13;
    px(mxx, 6, '#3a3a44'); px(mxx, 7, '#3a3a44'); px(mxx + 1, 5, '#8a8a96'); px(mxx, 5, '#8a8a96');
  }
  if (o.arms === 'write') {
    const pad = '#fbf6e9';
    const bx = view === 'side' ? 11 : 5;
    for (let y = 8; y <= 10; y++) for (let x = bx; x <= bx + 5; x++) px(x, y, pad);
    px(bx + 1 + (o.pencil || 0), 9, '#55525f');
  }
}
