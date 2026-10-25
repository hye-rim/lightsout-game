'use strict';
const test = require('node:test');
const assert = require('node:assert');
const L = require('../logic.js');
const LEVELS = require('../levels.js');

test('there are thirty levels with a valid size and board', () => {
  assert.strictEqual(LEVELS.length, 30);
  LEVELS.forEach((lv, i) => {
    assert.ok([3, 4, 5].includes(lv.n), 'level ' + (i + 1));
    assert.ok(new RegExp(`^[01]{${lv.n * lv.n}}$`).test(lv.cells), 'level ' + (i + 1) + ' cells');
  });
});

test('every level starts with lights on and no two levels are the same board', () => {
  LEVELS.forEach((lv, i) => assert.ok(lv.cells.includes('1'), 'level ' + (i + 1)));
  assert.strictEqual(new Set(LEVELS.map((l) => l.n + l.cells)).size, LEVELS.length);
});

test('every level is solvable and its par is the fewest presses', () => {
  LEVELS.forEach((lv, i) => {
    const lit = lv.cells.split('').map(Number);
    const s = L.solve(lv.n, lit);
    assert.ok(s.solvable, 'level ' + (i + 1));
    assert.strictEqual(s.presses.length, lv.par, 'level ' + (i + 1) + ' par');
    const st = L.newGame(lv.n, lit);
    for (const p of s.presses) L.press(st, p);
    assert.ok(L.isWon(st), 'level ' + (i + 1) + ' is cleared by the solution');
  });
});

test('levels get harder: sizes grow and par rises within each size', () => {
  const sizes = LEVELS.map((l) => l.n);
  assert.deepStrictEqual(sizes, [...sizes].sort((a, b) => a - b), 'sizes never shrink');
  for (const n of [3, 4, 5]) {
    const pars = LEVELS.filter((l) => l.n === n).map((l) => l.par);
    assert.deepStrictEqual(pars, [...pars].sort((a, b) => a - b), 'pars of ' + n + 'x' + n);
  }
  assert.ok(LEVELS[0].par === 1, 'the first level takes one press');
  assert.ok(LEVELS[LEVELS.length - 1].par >= 14, 'the last levels need many presses');
});
