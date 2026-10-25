'use strict';

// 라이츠 아웃: 규칙만 모아 둔 파일 (그리기·입력 없음). 브라우저와 테스트(Node)가 같이 쓴다.
//
// - n x n 칸에 불이 켜진 칸과 꺼진 칸이 있다. 칸을 누르면 그 칸과 위·아래·왼쪽·오른쪽 칸의 불이 모두 반대로 바뀐다
// - 불을 모두 끄면 클리어. 같은 칸을 두 번 누르면 원래대로 돌아오므로, 풀이는 '어느 칸들을 한 번씩 누를까' 하는 문제다
// - 풀이는 GF(2)(0과 1만 쓰는 덧셈) 연립방정식으로 구한다. 풀이가 여러 개면 가장 적게 누르는 것(par)을 쓴다
const LOGIC_LIGHTS = (() => {
// 칸 i 를 눌렀을 때 바뀌는 칸들
function around(n, i) {
  const x = i % n, y = (i / n) | 0, out = [i];
  if (x > 0) out.push(i - 1);
  if (x < n - 1) out.push(i + 1);
  if (y > 0) out.push(i - n);
  if (y < n - 1) out.push(i + n);
  return out;
}

// cells: 길이 n*n 의 0/1 (1 이 켜짐)
function newGame(n, cells) {
  return { n, lit: cells.map((c) => (c ? 1 : 0)), presses: 0, history: [] };
}

function press(st, i) {
  if (!Number.isInteger(i) || i < 0 || i >= st.n * st.n) return null;
  for (const c of around(st.n, i)) st.lit[c] ^= 1;
  st.history.push(i);
  st.presses++;
  return true;
}
function undo(st) {
  const i = st.history.pop();
  if (i === undefined) return false;
  for (const c of around(st.n, i)) st.lit[c] ^= 1;
  st.presses--;
  return true;
}
const isWon = (st) => st.lit.every((c) => !c);
const litCount = (st) => st.lit.reduce((s, c) => s + c, 0);

// 눌러서 만든 판: presses(칸 번호 목록)를 모두 꺼진 판에 누른 결과. 이렇게 만든 판은 반드시 풀 수 있다
function fromPresses(n, presses) {
  const st = newGame(n, new Array(n * n).fill(0));
  for (const i of presses) press(st, i);
  return st.lit.slice();
}

// ---------- GF(2) 풀이 ----------
// 행렬 A 의 j 번째 열은 칸 j 를 눌렀을 때 바뀌는 칸들. A x = b (b = 지금 켜진 칸) 를 푼다.
// 돌려주는 값: { solvable, presses: 가장 적게 누르는 풀이의 칸 번호 목록, count: 풀이 가짓수 }
function solve(n, lit) {
  const m = n * n;
  // 행 r = 칸 r 이 바뀌는 조건: sum_j A[r][j] x_j = b[r]. 비트 마스크(BigInt 대신 배열)로 쓴다
  const rows = [];
  for (let r = 0; r < m; r++) {
    const row = new Array(m + 1).fill(0);
    for (const j of around(n, r)) row[j] = 1;            // 대칭이라 칸 r 을 바꾸는 칸 = r 주변
    row[m] = lit[r] ? 1 : 0;
    rows.push(row);
  }
  const pivotCol = [];
  let rank = 0;
  for (let c = 0; c < m && rank < m; c++) {
    let p = -1;
    for (let r = rank; r < m; r++) if (rows[r][c]) { p = r; break; }
    if (p < 0) continue;
    [rows[rank], rows[p]] = [rows[p], rows[rank]];
    for (let r = 0; r < m; r++) if (r !== rank && rows[r][c]) for (let k = c; k <= m; k++) rows[r][k] ^= rows[rank][k];
    pivotCol.push(c);
    rank++;
  }
  for (let r = rank; r < m; r++) if (rows[r][m]) return { solvable: false, presses: null, count: 0 };   // 0 = 1 꼴의 모순
  const isPivot = new Set(pivotCol);
  const free = [];
  for (let c = 0; c < m; c++) if (!isPivot.has(c)) free.push(c);
  let best = null, bestW = Infinity;
  // 자유 변수에 0/1 을 모두 넣어 보며 (많아야 2^k, 5x5 는 k=2·4x4 는 k=4) 가장 적게 누르는 풀이를 찾는다
  for (let mask = 0; mask < (1 << free.length); mask++) {
    const x = new Array(m).fill(0);
    free.forEach((f, idx) => { x[f] = (mask >> idx) & 1; });
    for (let r = rank - 1; r >= 0; r--) {
      const c = pivotCol[r];
      let v = rows[r][m];
      for (let k = c + 1; k < m; k++) if (rows[r][k] && x[k]) v ^= 1;
      x[c] = v;
    }
    const w = x.reduce((s, v) => s + v, 0);
    if (w < bestW) { bestW = w; best = x; }
  }
  return { solvable: true, presses: best.map((v, i) => (v ? i : -1)).filter((i) => i >= 0), count: 1 << free.length };
}

// 지금 판에서 다음에 누를 칸 하나 (가장 적게 누르는 풀이 중). 이미 꺼졌거나 못 풀면 -1
function hint(st) {
  if (isWon(st)) return -1;
  const s = solve(st.n, st.lit);
  return s.solvable && s.presses.length ? s.presses[0] : -1;
}

return { around, newGame, press, undo, isWon, litCount, fromPresses, solve, hint };
})();
if (typeof module !== 'undefined') module.exports = LOGIC_LIGHTS;
