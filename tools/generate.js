'use strict';
// 레벨 만들기: node tools/generate.js [씨앗]
// 누를 칸들을 무작위로 골라 꺼진 판에 눌러서 판을 만든다(그래서 반드시 풀 수 있다). 그 판을 풀이(GF(2))로 풀어
// '가장 적게 누르는 횟수(par)'를 재고, 원하는 par 인 판만 levels.js 에 쓴다.
const fs = require('fs'), path = require('path');
const L = require('../logic.js');

function rng(seed) {                                   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = rng(Number(process.argv[2]) || 20261026);

// [판 크기, 원하는 par] 를 쉬운 것부터. 3x3 다섯 개, 4x4 열 개(4x4 는 최대 7), 5x5 열다섯 개(5x5 는 최대 15)
const specs = [
  ...[1, 2, 3, 4, 5].map((p) => [3, p]),
  ...[2, 3, 4, 4, 5, 5, 5, 6, 6, 7].map((p) => [4, p]),
  ...[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 14, 15, 15, 15].map((p) => [5, p]),
];
const seen = new Set(), levels = [];
for (const [n, want] of specs) {
  let got = null;
  for (let tries = 0; tries < 200000 && !got; tries++) {
    const m = n * n;
    const density = 0.15 + rand() * 0.6;
    const presses = Array.from({ length: m }, (_, i) => i).filter(() => rand() < density);
    const lit = L.fromPresses(n, presses);
    const key = n + ':' + lit.join('');
    if (seen.has(key) || lit.every((c) => !c)) continue;
    const s = L.solve(n, lit);
    if (s.solvable && s.presses.length === want) { got = { n, lit, par: want }; seen.add(key); }
  }
  if (!got) { console.error(`par ${want} (${n}x${n}) 를 못 찾았어요`); process.exit(1); }
  levels.push(got);
}
const body = `'use strict';
// 라이츠 아웃 레벨 ${levels.length}개: tools/generate.js 가 만들고 풀이(GF(2))로 가장 적게 누르는 횟수(par)를 쟀다
// n: 판 한 변의 칸 수, cells: 켜진 칸 1 / 꺼진 칸 0 (왼쪽 위부터 줄 순서), par: 최소 누르기 횟수
const LEVELS = [
${levels.map((l) => `  { n: ${l.n}, par: ${l.par}, cells: '${l.lit.join('')}' },`).join('\n')}
];
if (typeof module !== 'undefined') module.exports = LEVELS;
`;
fs.writeFileSync(path.join(__dirname, '..', 'levels.js'), body);
console.error('levels.js 에 쓴 레벨:', levels.map((l) => `${l.n}x${l.n}/${l.par}`).join(' '));
