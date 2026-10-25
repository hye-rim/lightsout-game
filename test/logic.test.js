'use strict';
const test = require('node:test');
const assert = require('node:assert');
const L = require('../logic.js');

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const off = (n) => new Array(n * n).fill(0);

test('around lists the cell and its up down left right neighbours without leaving the board', () => {
  assert.deepStrictEqual(L.around(3, 4).sort((a, b) => a - b), [1, 3, 4, 5, 7]);
  assert.deepStrictEqual(L.around(3, 0).sort((a, b) => a - b), [0, 1, 3]);
  assert.deepStrictEqual(L.around(3, 8).sort((a, b) => a - b), [5, 7, 8]);
  assert.deepStrictEqual(L.around(3, 2).sort((a, b) => a - b), [1, 2, 5], 'the right edge does not wrap to the next row');
  assert.deepStrictEqual(L.around(3, 3).sort((a, b) => a - b), [0, 3, 4, 6], 'the left edge does not wrap to the previous row');
  assert.strictEqual(L.around(5, 12).length, 5);
});

test('pressing flips the cell and its neighbours', () => {
  const st = L.newGame(3, off(3));
  assert.ok(L.press(st, 4));
  assert.deepStrictEqual(st.lit, [0, 1, 0, 1, 1, 1, 0, 1, 0]);
  assert.strictEqual(st.presses, 1);
  L.press(st, 0);
  assert.deepStrictEqual(st.lit, [1, 0, 0, 0, 1, 1, 0, 1, 0]);
});

test('pressing the same cell twice changes nothing and presses are counted', () => {
  const st = L.newGame(5, fromRandom(5, 1));
  const before = st.lit.slice();
  L.press(st, 7); L.press(st, 7);
  assert.deepStrictEqual(st.lit, before);
  assert.strictEqual(st.presses, 2);
});
function fromRandom(n, seed) { const r = rng(seed); return Array.from({ length: n * n }, () => (r() < 0.5 ? 1 : 0)); }

test('bad cell numbers are refused', () => {
  const st = L.newGame(3, off(3));
  for (const bad of [-1, 9, 1.5, '3', null, undefined, NaN]) assert.strictEqual(L.press(st, bad), null, String(bad));
  assert.strictEqual(st.presses, 0);
  assert.deepStrictEqual(st.lit, off(3));
});

test('undo restores the board exactly and is unlimited', () => {
  const st = L.newGame(5, fromRandom(5, 3));
  const start = st.lit.slice();
  for (let i = 0; i < 60; i++) L.press(st, (i * 7) % 25);
  for (let i = 0; i < 60; i++) assert.ok(L.undo(st));
  assert.deepStrictEqual(st.lit, start);
  assert.strictEqual(st.presses, 0);
  assert.strictEqual(L.undo(st), false);
});

test('a board is won when every light is out', () => {
  const st = L.newGame(3, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.ok(L.isWon(st));
  L.press(st, 4);
  assert.ok(!L.isWon(st));
  assert.strictEqual(L.litCount(st), 5);
  L.press(st, 4);
  assert.ok(L.isWon(st));
});

test('fromPresses builds a board that those presses solve', () => {
  for (const n of [3, 4, 5]) {
    for (let seed = 1; seed <= 30; seed++) {
      const r = rng(seed * 31 + n);
      const presses = Array.from({ length: n * n }, (_, i) => i).filter(() => r() < 0.5);
      const st = L.newGame(n, L.fromPresses(n, presses));
      for (const i of presses) L.press(st, i);
      assert.ok(L.isWon(st));
    }
  }
});

test('solve finds a real solution that clears the board', () => {
  for (const n of [3, 4, 5]) {
    for (let seed = 1; seed <= 60; seed++) {
      const lit = L.fromPresses(n, Array.from({ length: n * n }, (_, i) => i).filter((i) => rng(seed * 97 + i + n)() < 0.5));
      const s = L.solve(n, lit);
      assert.ok(s.solvable, `n=${n} seed=${seed}`);
      const st = L.newGame(n, lit);
      for (const i of s.presses) L.press(st, i);
      assert.ok(L.isWon(st), `n=${n} seed=${seed}`);
    }
  }
});

test('solve returns the fewest presses (checked against brute force on 3x3 and 4x4)', () => {
  for (const n of [3, 4]) {
    const m = n * n;
    for (let seed = 1; seed <= 12; seed++) {
      const lit = L.fromPresses(n, Array.from({ length: m }, (_, i) => i).filter((i) => rng(seed * 53 + i + n)() < 0.5));
      let best = Infinity;
      for (let mask = 0; mask < (1 << m); mask++) {
        const st = L.newGame(n, lit);
        let w = 0;
        for (let i = 0; i < m; i++) if ((mask >> i) & 1) { L.press(st, i); w++; }
        if (L.isWon(st) && w < best) best = w;
      }
      assert.strictEqual(L.solve(n, lit).presses.length, best, `n=${n} seed=${seed}`);
    }
  }
});

test('only a quarter of the 5x5 boards can be solved, and solve says so', () => {
  let ok = 0, tot = 400;
  for (let seed = 1; seed <= tot; seed++) { if (L.solve(5, fromRandom(5, seed)).solvable) ok++; }
  assert.ok(ok > tot * 0.17 && ok < tot * 0.33, 'solvable share ' + ok / tot);
  const bad = fromRandom(5, 1);
  const flipped = L.solve(5, bad).solvable;
  assert.strictEqual(typeof flipped, 'boolean');
  // 풀 수 없는 판은 풀이가 없다
  for (let seed = 1; seed <= 80; seed++) { const s = L.solve(5, fromRandom(5, seed)); if (!s.solvable) { assert.strictEqual(s.presses, null); break; } }
});

test('3x3 boards are always solvable and 5x5 has up to four solutions', () => {
  for (let seed = 1; seed <= 100; seed++) assert.ok(L.solve(3, fromRandom(3, seed)).solvable);
  const counts = new Set();
  for (let seed = 1; seed <= 100; seed++) { const s = L.solve(5, L.fromPresses(5, Array.from({ length: 25 }, (_, i) => i).filter((i) => rng(seed * 11 + i)() < 0.5))); counts.add(s.count); }
  assert.deepStrictEqual([...counts], [4]);
});

test('hint points at a cell of the best solution and never at a useless press', () => {
  const lit = L.fromPresses(5, [2, 7, 12, 13, 24]);
  const st = L.newGame(5, lit);
  let guard = 0;
  while (!L.isWon(st)) {
    const h = L.hint(st);
    assert.ok(h >= 0 && h < 25);
    L.press(st, h);
    assert.ok(++guard <= 25, 'following hints always ends');
  }
  assert.strictEqual(L.hint(st), -1, 'no hint on a solved board');
  assert.strictEqual(guard, L.solve(5, lit).presses.length, 'following the hints uses the fewest presses');
});
