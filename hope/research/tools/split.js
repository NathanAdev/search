// Split merged.json into niche-ordered scoring batches + a compact global index. Usage: node split.js <scratchpad> <batchSize>
'use strict';
const fs = require('fs');
const path = require('path');
const [S, SIZE_ARG] = process.argv.slice(2);
const SIZE = +SIZE_ARG || 30;
const merged = JSON.parse(fs.readFileSync(path.join(S, 'merged.json'), 'utf8'));
const dir = path.join(S, 'scoreinput');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const sorted = [...merged].sort((a, b) => a.niche.localeCompare(b.niche) || a.name.localeCompare(b.name));
const nb = Math.ceil(sorted.length / SIZE);
const per = Math.ceil(sorted.length / nb);
for (let b = 0; b < nb; b++) {
  const slice = sorted.slice(b * per, (b + 1) * per);
  fs.writeFileSync(path.join(dir, `batch${String(b + 1).padStart(2, '0')}.json`), JSON.stringify(slice, null, 1));
}
fs.writeFileSync(path.join(S, 'index.json'), JSON.stringify(sorted.map((i) => ({ id: i.id, name: i.name, niche: i.niche, idea: i.idea })), null, 0));
console.log(JSON.stringify({ ideas: sorted.length, batches: nb, perBatch: per }));
