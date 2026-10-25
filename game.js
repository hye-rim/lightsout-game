'use strict';
// 오락실 튜토리얼이 '진짜로 일어난 일'을 알아채는 신호 (arcade/public/tutorial.js 가 듣는다. 튜토리얼이 아니면 아무도 안 듣는다)
const tutorialSignal = (type) => window.dispatchEvent(new CustomEvent('arcade:tutorial', { detail: { type } }));

// 라이츠 아웃: 화면·입력·소리. 규칙과 풀이는 logic.js (LOGIC_LIGHTS), 레벨은 levels.js (LEVELS)
(() => {
const L = LOGIC_LIGHTS;
const $ = (id) => document.getElementById(id);
const DONE_KEY = 'lightsoutDone', LAST_KEY = 'lightsoutLast';

// ---------- 저장소 ----------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
};
const loadDone = () => { try { return JSON.parse(store.get(DONE_KEY)) || {}; } catch (_) { return {}; } };
let done = loadDone();                                   // { 단계 번호(0부터): { presses, stars } }
const clearedCount = () => Object.keys(done).length;
let last = Math.min(LEVELS.length - 1, Math.max(0, Number(store.get(LAST_KEY)) || 0));

// ---------- 소리 ----------
let audio = null;
let muted = store.get('lightsoutMuted') === '1';
function tone(freq, dur, type = 'sine', vol = 0.09, slide = 0) {
  if (muted) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + dur);
  } catch (_) {}
}
const seq = (notes, step, type = 'triangle', vol = 0.09) => notes.forEach((f, i) => setTimeout(() => tone(f, step * 0.0009, type, vol), i * step));
const sfx = {
  press: (lit) => tone(lit > 8 ? 380 : lit > 3 ? 480 : 600, 0.07, 'triangle', 0.07),
  undo: () => tone(500, 0.08, 'triangle', 0.07, -150),
  hint: () => tone(880, 0.12, 'sine', 0.07, 260),
  win: () => seq([523, 659, 784, 1047], 100, 'triangle', 0.1),
};
function toggleMute() { muted = !muted; store.set('lightsoutMuted', muted ? '1' : '0'); $('muteBtn').textContent = muted ? '🔇' : '🔊'; }
$('muteBtn').onclick = (e) => { e.currentTarget.blur(); toggleMute(); };
$('muteBtn').textContent = muted ? '🔇' : '🔊';

// ---------- 상태 ----------
let level = 0, st = null, hintCell = -1, hints = 0;
let playing = false, solvedShown = false;
const lampEls = [];
const startCells = (i) => LEVELS[i].cells.split('').map(Number);

// ---------- 그리기 ----------
function buildBoard() {
  const b = $('board');
  b.innerHTML = ''; lampEls.length = 0;
  b.style.gridTemplateColumns = `repeat(${st.n}, 1fr)`;
  b.style.gridTemplateRows = `repeat(${st.n}, 1fr)`;
  for (let i = 0; i < st.n * st.n; i++) {
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'lamp'; el.setAttribute('aria-label', `${(i / st.n | 0) + 1}행 ${i % st.n + 1}열`);
    el.onclick = () => onPress(i);
    b.appendChild(el); lampEls.push(el);
  }
}
function render() {
  for (let i = 0; i < lampEls.length; i++) {
    lampEls[i].classList.toggle('on', !!st.lit[i]);
    lampEls[i].classList.toggle('hint', i === hintCell);
  }
  $('lvl').textContent = `${level + 1} / ${LEVELS.length}`;
  $('pressN').textContent = String(st.presses);
  $('msg').textContent = hintCell >= 0 ? '💡 분홍 테두리 칸을 눌러 보세요!' : `켜진 불 ${L.litCount(st)}개 · 누르기 ${st.presses}번 (최소 ${LEVELS[level].par}번)`;
  $('undoBtn').disabled = !st.history.length;
}

// ---------- 창 ----------
const overlayOpen = () => !$('overlay').classList.contains('hidden');
function showOverlay(html) { $('overlay').innerHTML = html; $('overlay').classList.remove('hidden'); }
function hideOverlay() { $('overlay').classList.add('hidden'); }

// ---------- 행동 ----------
function loadLevel(i) {
  level = Math.max(0, Math.min(LEVELS.length - 1, i));
  last = level; store.set(LAST_KEY, String(level));
  st = L.newGame(LEVELS[level].n, startCells(level));
  hintCell = -1; hints = 0; playing = true; solvedShown = false;
  hideOverlay(); buildBoard(); render();
}
function onPress(i) {
  if (!playing || solvedShown) return;
  if (!L.press(st, i)) return;
  hintCell = -1;
  sfx.press(L.litCount(st)); tutorialSignal('press');
  render();
  if (L.isWon(st)) { solvedShown = true; setTimeout(onClear, 350); }      // 다 껐으면 바로 잠가서, 클리어 창이 뜨기 전에 더 눌러 판이 바뀌지 않게
}
function undo() {
  if (!playing || solvedShown || !L.undo(st)) return;
  hintCell = -1; sfx.undo(); tutorialSignal('undo'); render();
}
function restart() {
  if (!playing || solvedShown) return;
  loadLevel(level); tutorialSignal('restart');
}
function hint() {
  if (!playing || solvedShown) return;
  const h = L.hint(st);
  if (h < 0) return;
  hintCell = h; hints++; sfx.hint(); tutorialSignal('hint'); render();
}
function starsFor(presses, par) {
  const base = presses <= par ? 3 : presses <= Math.ceil(par * 1.5) + 1 ? 2 : 1;
  return hints > 0 ? Math.min(base, 2) : base;           // 힌트를 쓰면 별은 최대 두 개
}
function onClear() {
  if (!L.isWon(st)) return;
  solvedShown = true; sfx.win(); tutorialSignal('clear');
  const par = LEVELS[level].par, stars = starsFor(st.presses, par);
  const prev = done[level];
  const best = !prev || stars > prev.stars || (stars === prev.stars && st.presses < prev.presses);
  if (best) { done[level] = { presses: st.presses, stars }; store.set(DONE_KEY, JSON.stringify(done)); }
  store.set('lightsoutCleared', String(clearedCount()));
  const lastLevel = level === LEVELS.length - 1;
  showOverlay(`
    <h2>모두 껐어요! 💡</h2>
    <div class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
    <p>누르기 <b>${st.presses}</b>번 (최소 ${par}번)${hints ? ` · 힌트 ${hints}번` : ''}${best && prev ? '<br>🏆 내 최고 기록!' : ''}</p>
    ${stars === 3 ? '<p style="font-size:12.5px">최소 횟수로 풀었어요! 대단해요</p>' : hints ? '<p style="font-size:12.5px">힌트 없이 최소 횟수로 풀면 ⭐ 세 개예요</p>' : '<p style="font-size:12.5px">최소 횟수로 풀면 ⭐ 세 개예요</p>'}
    <div class="col">${lastLevel ? '<p>모든 단계를 깼어요! 🏆</p>' : '<button id="nextBtn">다음 단계 ▶</button>'}<button id="againBtn" class="sub">다시 하기</button><button id="listBtn" class="sub">단계 선택</button></div>`);
  $('nextBtn') && ($('nextBtn').onclick = () => loadLevel(level + 1));
  $('againBtn').onclick = () => loadLevel(level);
  $('listBtn').onclick = showLevels;
}
function showLevels() {
  playing = false; solvedShown = false;
  showOverlay(`
    <h2>단계 선택</h2>
    <p>깬 단계 <b>${clearedCount()}</b> / ${LEVELS.length}</p>
    <div class="scroll"><div class="levels">${LEVELS.map((lv, i) => `<button data-i="${i}" class="${done[i] ? 'done' : ''}${i === last ? ' cur' : ''}">${i + 1}<small>${done[i] ? '⭐'.repeat(done[i].stars) : `${lv.n}×${lv.n}`}</small></button>`).join('')}</div></div>
    <button id="backBtn" class="sub">닫기</button>`);
  document.querySelectorAll('#overlay .levels button').forEach((b) => { b.onclick = () => loadLevel(Number(b.dataset.i)); });
  $('backBtn').onclick = () => { if (st) { playing = true; hideOverlay(); } };
}
function showTitle() {
  playing = false;
  const next = Math.min(LEVELS.length - 1, last);
  showOverlay(`
    <h1>라이츠 아웃</h1>
    <p>칸을 눌러 <b>모든 불을 끄세요!</b></p>
    <div class="card2" style="font-size:13px">💡 칸을 누르면 그 칸과 <b>위·아래·왼쪽·오른쪽</b> 칸의 불이 켜졌다 꺼졌다 바뀌어요<br>🔁 같은 칸을 두 번 누르면 원래대로예요<br>⭐ 최소 횟수로, 힌트 없이 풀면 별 세 개!</div>
    <div class="col"><button id="startBtn">${clearedCount() ? '이어서 하기' : '시작하기'}<small>${next + 1}단계 · 깬 단계 ${clearedCount()}/${LEVELS.length}</small></button><button id="listBtn" class="sub">단계 선택</button></div>`);
  $('startBtn').onclick = () => loadLevel(next);
  $('listBtn').onclick = showLevels;
}

// ---------- 입력 ----------
addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === 'z' || e.key === 'Z') undo();
  else if (e.key === 'r' || e.key === 'R') restart();
  else if (e.key === 'h' || e.key === 'H') hint();
  else if (e.key === 'm' || e.key === 'M') toggleMute();
});
$('undoBtn').onclick = (e) => { e.currentTarget.blur(); undo(); };
$('restartBtn').onclick = (e) => { e.currentTarget.blur(); restart(); };
$('hintBtn').onclick = (e) => { e.currentTarget.blur(); hint(); };
$('menuBtn').onclick = (e) => { e.currentTarget.blur(); if (!overlayOpen()) showLevels(); };

st = L.newGame(LEVELS[last].n, startCells(last)); level = last;
buildBoard(); render();
showTitle();

/* @test-hooks:start */
window.__lo = { get st() { return st; }, get level() { return level; }, get playing() { return playing; }, get done() { return done; }, get hintCell() { return hintCell; }, LEVELS, loadLevel, press: onPress, undo, restart, hint };
/* @test-hooks:end */
})();
