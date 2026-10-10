(function(){
"use strict";

/* Do kich thuoc board LIVE moi khi can (tao van moi / xoay man hinh),
   khong tinh 1 lan luc load script nua - tranh truong hop do sai thoi diem
   khien board bi teo tren dien thoai. */
function computeSudokuBoardPx() {
  var $win = $(`#${sudokuWindowId}`);
  var w = $win.width() || window.innerWidth;
  var h = $win.height() || window.innerHeight;
  var landscape = w > h;
  if (typeof window !== "undefined" && window.IS_MOBILE === true) {
    if (landscape) {
      // Xoay ngang: board cao toi da (tru titlebar 48 + padding wrap/frame ~65)
      return Math.max(200, h - 115);
    }
    // Man hinh doc: do truc tiep khung board-frame (da tru padding san),
    // khoi phai doan padding cua cac lop .wrap/.window-content
    var frameW = (typeof boardFrame !== "undefined" && boardFrame.clientWidth) || (w - 72);
    return Math.max(220, Math.min(frameW - 4, h - 380));
  }
  return Math.min(w, h) - 350;
}
const MODES = {
  classic: {
    B: 3, N: 9,
    symbols: "123456789".split(""),
    clues:  { easy: 42, medium: 34, hard: 28, expert: 24 },
    hints:  { easy: 5,  medium: 4,  hard: 3,  expert: 2 },
    maxStepsPerCheck: 60000,
    label: "9×9"
  },
  hex: {
    B: 4, N: 16,
    symbols: "0123456789ABCDEF".split(""),
    clues:  { easy: 190, medium: 160, hard: 140, expert: 118 },
    hints:  { easy: 7,   medium: 6,   hard: 5,   expert: 4 },
    maxStepsPerCheck: 120000,
    label: "16×16"
  }
};

const MAX_MISTAKES = 3;

const boardEl = document.getElementById("sdk-board");
const hankoEl = document.getElementById("sdk-hanko");
const genOverlay = document.getElementById("sdk-genOverlay");
const numpadEl = document.getElementById("sdk-numpad");
const sizeRow = document.getElementById("sdk-sizeRow");
const diffRow = document.getElementById("sdk-diffRow");
const resultBanner = document.getElementById("sdk-resultBanner");
const resultTitle = document.getElementById("sdk-resultTitle");
const resultSub = document.getElementById("sdk-resultSub");
const statTime = document.getElementById("sdk-statTime");
const statMistakes = document.getElementById("sdk-statMistakes");
const statHints = document.getElementById("sdk-statHints");
const statMode = document.getElementById("sdk-statMode");
const hintBadge = document.getElementById("sdk-hintBadge");
const btnHint = document.getElementById("sdk-btnHint");
const btnNotes = document.getElementById("sdk-btnNotes");

let state = null;
let selectedMode = "classic";
let currentDiff = "medium";
let timerId = null;
let cellEls = [];
let keyToValue = {};

/* ---------------- Sudoku generation (mode-agnostic) ---------------- */

function shuffled(arr){
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function range(n){ return [...Array(n).keys()]; }

function makeSolvedBoard(N, B){
  function pattern(r,c){ return (B*(r%B) + Math.floor(r/B) + c) % N; }
  let rows = [];
  const bandOrder = shuffled(range(B));
  for (const band of bandOrder){
    const within = shuffled(range(B));
    for (const w of within) rows.push(band*B + w);
  }
  let cols = [];
  const stackOrder = shuffled(range(B));
  for (const stack of stackOrder){
    const within = shuffled(range(B));
    for (const w of within) cols.push(stack*B + w);
  }
  const nums = shuffled(range(N).map(x => x+1));
  const board = new Array(N*N);
  for (let ri=0; ri<N; ri++){
    for (let ci=0; ci<N; ci++){
      const r = rows[ri], c = cols[ci];
      board[ri*N+ci] = nums[pattern(r,c)];
    }
  }
  if (Math.random() < 0.5){
    const t = new Array(N*N);
    for (let r=0;r<N;r++) for (let c=0;c<N;c++) t[r*N+c] = board[c*N+r];
    return t;
  }
  return board;
}

function boxOfFor(N,B){ return function(r,c){ return Math.floor(r/B)*B + Math.floor(c/B); }; }

function countSolutions(board, N, B, limit, maxSteps){
  const boxOf = boxOfFor(N,B);
  const rows = new Array(N).fill(0), cols = new Array(N).fill(0), boxes = new Array(N).fill(0);
  for (let r=0;r<N;r++) for (let c=0;c<N;c++){
    const v = board[r*N+c];
    if (v){ const b=boxOf(r,c); rows[r]|=(1<<v); cols[c]|=(1<<v); boxes[b]|=(1<<v); }
  }
  let count = 0, steps = 0, aborted = false;
  function findBestEmpty(){
    let best=-1, bestCount=N+1, bestCands=null;
    for (let p=0;p<N*N;p++){
      if (board[p]!==0) continue;
      const r=Math.floor(p/N), c=p%N, b=boxOf(r,c);
      const used = rows[r]|cols[c]|boxes[b];
      const cands=[];
      for (let n=1;n<=N;n++) if (!(used&(1<<n))) cands.push(n);
      if (cands.length<bestCount){
        bestCount=cands.length; best=p; bestCands=cands;
        if (bestCount===0) return { pos:best, cands:bestCands };
      }
    }
    return best===-1 ? null : { pos:best, cands:bestCands };
  }
  function solve(){
    if (count>=limit || aborted) return;
    steps++;
    if (steps>maxSteps){ aborted = true; return; }
    const next = findBestEmpty();
    if (!next){ count++; return; }
    const { pos, cands } = next;
    if (cands.length===0) return;
    const r=Math.floor(pos/N), c=pos%N, b=boxOf(r,c);
    for (const n of cands){
      board[pos]=n;
      rows[r]|=(1<<n); cols[c]|=(1<<n); boxes[b]|=(1<<n);
      solve();
      rows[r]&=~(1<<n); cols[c]&=~(1<<n); boxes[b]&=~(1<<n);
      board[pos]=0;
      if (count>=limit || aborted) break;
    }
  }
  solve();
  return { count, aborted };
}

function generatePuzzle(N, B, clueTarget, maxStepsPerCheck){
  const solved = makeSolvedBoard(N,B);
  const puzzle = solved.slice();
  const positions = shuffled(range(N*N));
  let clues = N*N;
  for (const p of positions){
    if (clues<=clueTarget) break;
    const backup = puzzle[p];
    if (backup===0) continue;
    puzzle[p]=0;
    const test = puzzle.slice();
    const res = countSolutions(test, N, B, 2, maxStepsPerCheck);
    if (res.count===1 && !res.aborted){
      clues--;
    } else {
      puzzle[p]=backup;
    }
  }
  return { puzzle, solution: solved };
}

/* ---------------- Board build/render ---------------- */

function buildBoardSkeleton(){
  const N = state.N, B = state.B;
  boardEl.innerHTML = "";
  boardEl.style.gridTemplateColumns = "repeat(" + N + ", 1fr)";
  boardEl.style.gridTemplateRows = "repeat(" + N + ", 1fr)";
  const boardPx = state.boardMax;
  boardEl.style.width = "min(96vw, " + boardPx + "px)";
  boardEl.style.height = "min(96vw, " + boardPx + "px)";
  const cellPx = boardPx / N;
  const cellFont = Math.max(9, Math.min(32, cellPx * 0.52));
  cellEls = [];
  for (let r = 0; r < N; r++){
    for (let c = 0; c < N; c++){
      const div = document.createElement("div");
      div.className = "cell";
      div.style.fontSize = "clamp(9px, calc(min(96vw," + boardPx + "px) / " + N + " * 0.52), " + cellFont + "px)";
      if ((c+1) % B === 0 && c !== N-1) div.classList.add("thick-r");
      if (c === N-1) div.classList.add("no-r");
      if ((r+1) % B === 0 && r !== N-1) div.classList.add("thick-b");
      if (r === N-1) div.classList.add("no-b");
      const notesWrap = document.createElement("div");
      notesWrap.className = "notes";
      const numSpan = document.createElement("span");
      numSpan.className = "num";
      div.appendChild(notesWrap);
      div.appendChild(numSpan);
      div.addEventListener("click", () => selectCell(r, c));
      boardEl.appendChild(div);
      cellEls.push(div);
    }
  }
}

/* Renders a cell's pencil-marks in a grid sized to how many are actually
   set, so 1-2 notes show large and a full set of N notes packs down small. */
function renderNotesForCell(notesWrap, notesSet, N, boardPx){
  const values = [...notesSet].sort((a,b) => a - b);
  const count = values.length;
  if (count === 0){
    notesWrap.style.display = "none";
    notesWrap.innerHTML = "";
    return;
  }
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.max(1, Math.ceil(count / columns));
  notesWrap.style.display = "grid";
  notesWrap.style.gridTemplateColumns = "repeat(" + columns + ", 1fr)";
  notesWrap.style.gridTemplateRows = "repeat(" + rows + ", 1fr)";
  notesWrap.innerHTML = "";
  const maxNotePx = Math.max(9, Math.min(24, (boardPx / N) * (0.78 / columns) + 4));
  const fontExpr = "clamp(6.5px, calc(min(96vw," + boardPx + "px) / " + N + " / " + columns + " * 0.68), " + maxNotePx + "px)";
  for (const v of values){
    const sp = document.createElement("span");
    sp.textContent = state.symbols[v-1];
    sp.style.fontSize = fontExpr;
    notesWrap.appendChild(sp);
  }
}

function buildNumpad(){
  numpadEl.innerHTML = "";
  keyToValue = {};
  for (let n = 1; n <= state.N; n++){
    const label = state.symbols[n-1];
    keyToValue[label.toLowerCase()] = n;
    const btn = document.createElement("button");
    btn.className = "num-btn";
    btn.dataset.num = n;
    btn.innerHTML = label + '<span class="rem" id="rem-' + n + '"></span>';
    btn.addEventListener("click", () => inputNumber(n));
    numpadEl.appendChild(btn);
  }
}

/* ---------------- Refit board khi xoay / doi kich thuoc man hinh ----------------
   Chi chinh lai kich thuoc + font chu, KHONG tao lai ban co (giu nguyen van choi). */
function refitSudokuBoard() {
  if (!state || !boardEl || !boardEl.children.length || !cellEls.length) return;
  if (document.getElementById("sdk-gameSudokuArea").style.display === "none") return;
  var boardPx = computeSudokuBoardPx();
  state.boardMax = boardPx;
  var N = state.N;
  boardEl.style.width = "min(96vw, " + boardPx + "px)";
  boardEl.style.height = "min(96vw, " + boardPx + "px)";
  var cellPx = boardPx / N;
  var cellFont = Math.max(9, Math.min(32, cellPx * 0.52));
  for (var i = 0; i < cellEls.length; i++) {
    cellEls[i].style.fontSize = "clamp(9px, calc(min(96vw," + boardPx + "px) / " + N + " * 0.52), " + cellFont + "px)";
  }
  if (typeof renderAll === "function") renderAll(); // ve lai notes cho khop font moi
}
function debounceSdk(fn, ms) {
  var t;
  return function () { clearTimeout(t); t = setTimeout(fn, ms); };
}
/* Gan/go class sdk-landscape theo huong man hinh that te (khong phu thuoc media query).
   Layout ngang dung INLINE STYLE de ap dung duoc ngay ca khi file CSS bi cache cu. */
function updateSudokuOrientationClass() {
  var area = document.getElementById("sdk-gameSudokuArea");
  if (!area) return;
  var visible = area.style.display !== "none";
  var isLandscape = visible && window.innerWidth > window.innerHeight && window.IS_MOBILE === true;
  area.classList.toggle("sdk-landscape", isLandscape);

  var wrap = area.closest(".wrap");
  var statsRow = area.querySelector(".stats-row");
  var boxes = statsRow ? statsRow.querySelectorAll(".stats-container") : [];
  var navBox = boxes[0] || null;
  var statBox = boxes[1] || null;
  var numpadRow = document.getElementById("sdk-numpad");
  var toolRow = area.querySelector(".tool-row");

  if (isLandscape) {
    area.style.display = "grid";
    area.style.gridTemplateColumns = "auto 1fr";
    area.style.gridTemplateAreas = "'board nav' 'board stats' 'board numpad' 'board tools'";
    area.style.gap = "8px 16px";
    area.style.alignItems = "start";
    area.style.justifyItems = "start";
    area.style.width = "100%";
    if (wrap) wrap.style.padding = "12px 10px 24px";
    if (statsRow) statsRow.style.display = "contents";
    if (navBox) navBox.style.gridArea = "nav";
    if (statBox) statBox.style.gridArea = "stats";
    if (typeof boardFrame !== "undefined" && boardFrame) boardFrame.style.gridArea = "board";
    if (numpadRow) {
      numpadRow.style.gridArea = "numpad";
      numpadRow.style.marginTop = "0";
      numpadRow.style.maxWidth = "380px";
      numpadRow.style.justifyContent = "flex-start";
    }
    if (toolRow) {
      toolRow.style.gridArea = "tools";
      toolRow.style.marginTop = "0";
      toolRow.style.justifyContent = "flex-start";
    }
  } else {
    area.style.display = visible ? "" : "none";
    area.style.gridTemplateColumns = "";
    area.style.gridTemplateAreas = "";
    area.style.gap = "";
    area.style.alignItems = "";
    area.style.justifyItems = "";
    area.style.width = "";
    if (wrap) wrap.style.padding = "";
    if (statsRow) statsRow.style.display = "";
    if (navBox) navBox.style.gridArea = "";
    if (statBox) statBox.style.gridArea = "";
    if (typeof boardFrame !== "undefined" && boardFrame) boardFrame.style.gridArea = "";
    if (numpadRow) {
      numpadRow.style.gridArea = "";
      numpadRow.style.marginTop = "";
      numpadRow.style.maxWidth = "";
      numpadRow.style.justifyContent = "";
    }
    if (toolRow) {
      toolRow.style.gridArea = "";
      toolRow.style.marginTop = "";
      toolRow.style.justifyContent = "";
    }
  }
}
function onSudokuViewportChange() {
  updateSudokuOrientationClass();
  refitSudokuBoard();
}
window.addEventListener("resize", debounceSdk(onSudokuViewportChange, 150));
window.addEventListener("orientationchange", function () { setTimeout(onSudokuViewportChange, 300); });

function startNewGame(diffKey){
  const mode = MODES[selectedMode];
  $(`#${sudokuWindowId} header`).css('display', 'none');
  document.querySelector('.controls').style.display = "none";
  document.querySelector('details.rules').style.display = "none";
  document.getElementById("sdk-gameSudokuArea").style.display = "flex";
  updateSudokuOrientationClass();
  currentDiff = diffKey;
  setActiveDiffButton(diffKey);

  genOverlay.classList.add("show");

  setTimeout(() => {
    const { puzzle, solution } = generatePuzzle(mode.N, mode.B, mode.clues[diffKey], mode.maxStepsPerCheck);

    state = {
      N: mode.N, B: mode.B, symbols: mode.symbols, boardMax: computeSudokuBoardPx(),
      puzzle, solution,
      grid: puzzle.slice(),
      given: puzzle.map(v => v !== 0),
      notes: Array.from({length: mode.N*mode.N}, () => new Set()),
      hinted: new Array(mode.N*mode.N).fill(false),
      selected: -1,
      notesMode: false,
      mistakes: 0,
      hintsLeft: mode.hints[diffKey],
      seconds: 0,
      solved: false,
      lost: false
    };

    buildBoardSkeleton();
    buildNumpad();
    hankoEl.classList.remove("show");
    boardEl.classList.remove("solved", "locked");
    resultBanner.classList.remove("show", "lose");
    btnNotes.classList.remove("active");
    statMistakes.classList.remove("warn");
    statMode.textContent = mode.label;

    renderAll();
    resetTimer();
    startTimer();
    saveGame();
    genOverlay.classList.remove("show");
  }, 30);
}

function backToMenu(){
  stopTimer();
  $(`#${sudokuWindowId} header`).css('display', 'block');
  document.querySelector('.controls').style.display = "flex";
  document.querySelector('details.rules').style.display = "block";
  document.getElementById("sdk-gameSudokuArea").style.display = "none";
  refreshContinueUI();
}

function setActiveDiffButton(key){
  [...diffRow.children].forEach(b => b.classList.toggle("active", b.dataset.diff === key));
}
function setActiveSizeButton(key){
  [...sizeRow.children].forEach(b => b.classList.toggle("active", b.dataset.mode === key));
}

/* ---------------- Timer ---------------- */

function resetTimer(){
  if (timerId) clearInterval(timerId);
  state.seconds = 0;
  updateTimeDisplay();
}
function updateTimeDisplay(){
  const m = String(Math.floor(state.seconds/60)).padStart(2,"0");
  const s = String(state.seconds%60).padStart(2,"0");
  statTime.textContent = m + ":" + s;
}
function startTimer(){
  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    state.seconds++;
    updateTimeDisplay();
    if (state.seconds % 5 === 0) saveGame();
  }, 1000);
}
function stopTimer(){ if (timerId) clearInterval(timerId); }

/* ---------------- Selection / rendering ---------------- */

function selectCell(r, c){
  if (!state || state.solved || state.lost) return;
  state.selected = r * state.N + c;
  renderAll();
  saveGame();
}

function isConflict(pos, val){
  if (!val) return false;
  const N = state.N, B = state.B;
  const r = Math.floor(pos/N), c = pos%N;
  for (let i = 0; i < N; i++){
    if (i !== c && state.grid[r*N+i] === val) return true;
    if (i !== r && state.grid[i*N+c] === val) return true;
  }
  const br = Math.floor(r/B)*B, bc = Math.floor(c/B)*B;
  for (let rr = br; rr < br+B; rr++) for (let cc = bc; cc < bc+B; cc++){
    const p2 = rr*N+cc;
    if (p2 !== pos && state.grid[p2] === val) return true;
  }
  return false;
}

function renderAll(){
  if (!state) return;
  const N = state.N, B = state.B;
  const sel = state.selected;
  const selR = sel >= 0 ? Math.floor(sel/N) : -1;
  const selC = sel >= 0 ? sel%N : -1;
  const selVal = sel >= 0 ? state.grid[sel] : 0;

  for (let p = 0; p < N*N; p++){
    const r = Math.floor(p/N), c = p%N;
    const el = cellEls[p];
    const val = state.grid[p];
    const numSpan = el.querySelector(".num");
    const notesWrap = el.querySelector(".notes");

    el.classList.remove("peer","same-num","selected","conflict","given","entered","hinted","wrong");

    if (sel >= 0){
      const sameBox = (Math.floor(r/B)*B + Math.floor(c/B)) === (Math.floor(selR/B)*B + Math.floor(selC/B));
      if (r === selR || c === selC || sameBox) el.classList.add("peer");
      if (selVal && val === selVal) el.classList.add("same-num");
    }
    if (p === sel) el.classList.add("selected");

    if (val){
      numSpan.textContent = state.symbols[val-1];
      notesWrap.style.display = "none";
      if (state.given[p]) el.classList.add("given");
      else if (state.hinted[p]) el.classList.add("hinted");
      else el.classList.add("entered");
      if (val !== state.solution[p]) el.classList.add("wrong");
      if (isConflict(p, val)) el.classList.add("conflict");
    } else {
      numSpan.textContent = "";
      renderNotesForCell(notesWrap, state.notes[p], N, state.boardMax);
    }
  }

  updateNumpadCounts();
  statMistakes.textContent = state.mistakes + "/" + MAX_MISTAKES;
  statMistakes.classList.toggle("warn", state.mistakes > 0);
  statHints.textContent = state.hintsLeft;
  hintBadge.textContent = state.hintsLeft;
  btnHint.disabled = state.hintsLeft <= 0 || state.solved || state.lost;
}

function updateNumpadCounts(){
  const N = state.N;
  for (let n = 1; n <= N; n++){
    let count = 0;
    for (let p = 0; p < N*N; p++) if (state.grid[p] === n && state.grid[p] === state.solution[p]) count++;
    const remEl = document.getElementById("rem-" + n);
    const btn = numpadEl.querySelector('.num-btn[data-num="'+n+'"]');
    const left = N - count;
    if (remEl) remEl.textContent = left > 0 ? left : "";
    if (btn) btn.classList.toggle("depleted", left <= 0);
  }
}

/* ---------------- Input ---------------- */

function inputNumber(n){
  if (!state || state.solved || state.lost) return;
  const p = state.selected;
  if (p < 0 || state.given[p]) return;

  if (state.notesMode){
    if (state.grid[p]) return;
    const notes = state.notes[p];
    if (notes.has(n)) notes.delete(n); else notes.add(n);
    renderAll();
    saveGame();
    return;
  }

  state.grid[p] = n;
  state.notes[p].clear();
  state.hinted[p] = false;
  cellEls[p].classList.add("just-placed");
  setTimeout(() => cellEls[p] && cellEls[p].classList.remove("just-placed"), 200);

  if (n !== state.solution[p]){
    state.mistakes++;
    if (state.mistakes >= MAX_MISTAKES){
      renderAll();
      triggerLose();
      return;
    }
  }

  renderAll();
  saveGame();
  checkWin();
}

function eraseSelected(){
  if (!state || state.solved || state.lost) return;
  const p = state.selected;
  if (p < 0 || state.given[p]) return;
  state.grid[p] = 0;
  state.notes[p].clear();
  state.hinted[p] = false;
  renderAll();
  saveGame();
}

function toggleNotes(){
  if (!state) return;
  state.notesMode = !state.notesMode;
  btnNotes.classList.toggle("active", state.notesMode);
  saveGame();
}

function findAutoHintCell(){
  if (state.selected >= 0){
    const p = state.selected;
    if (!state.given[p] && state.grid[p] !== state.solution[p]) return p;
  }
  for (let p = 0; p < state.N*state.N; p++){
    if (!state.given[p] && state.grid[p] !== state.solution[p]) return p;
  }
  return -1;
}

function useHint(){
  if (!state || state.solved || state.lost || state.hintsLeft <= 0) return;
  const p = findAutoHintCell();
  if (p === -1) return;
  state.grid[p] = state.solution[p];
  state.notes[p].clear();
  state.hintsLeft--;
  state.selected = p;
  state.hinted[p] = true;
  cellEls[p].classList.add("just-placed");
  setTimeout(() => cellEls[p] && cellEls[p].classList.remove("just-placed"), 200);
  renderAll();
  saveGame();
  checkWin();
}

function checkWin(){
  for (let p = 0; p < state.N*state.N; p++){
    if (state.grid[p] !== state.solution[p]) return;
  }
  triggerWin();
}

function triggerWin(){
  state.solved = true;
  stopTimer();
  clearSavedGame();
  boardEl.classList.add("solved");
  hankoEl.classList.add("show");
  spawnInkBurst();
  const m = String(Math.floor(state.seconds/60)).padStart(2,"0");
  const s = String(state.seconds%60).padStart(2,"0");
  const mode = MODES[selectedMode];
  const hintsUsed = mode.hints[currentDiff] - state.hintsLeft;
  resultTitle.textContent = "Completed!";
  resultSub.textContent = "Time " + m + ":" + s + " · " + state.mistakes + " mistake" + (state.mistakes===1?"":"s") + " · " + hintsUsed + " hint" + (hintsUsed===1?"":"s") + " used";
  resultBanner.classList.remove("lose");
  resultBanner.classList.add("show");
}

function triggerLose(){
  state.lost = true;
  stopTimer();
  clearSavedGame();
  boardEl.classList.add("locked");
  resultTitle.textContent = "Out of chances";
  resultSub.textContent = "Three mistakes stopped this round — start a new puzzle to try again.";
  resultBanner.classList.add("show", "lose");
}

function spawnInkBurst(){
  const n = 14;
  for (let i = 0; i < n; i++){
    const d = document.createElement("div");
    d.className = "ink-drop";
    const angle = Math.random() * Math.PI * 2;
    const dist = 34 + Math.random() * 56;
    d.style.setProperty("--dx", Math.cos(angle)*dist + "px");
    d.style.setProperty("--dy", Math.sin(angle)*dist + "px");
    d.style.left = (44 + Math.random()*10) + "%";
    d.style.top = "10%";
    hankoEl.appendChild(d);
    setTimeout(() => d.remove(), 750);
  }
}

/* ---------------- Save / continue (localStorage) ---------------- */

const STORAGE_KEY = "sudoku_ink_save_v1";

function saveGame(){
  if (!state || state.solved || state.lost) return;
  try{
    const payload = {
      v: 1,
      modeKey: selectedMode,
      diffKey: currentDiff,
      N: state.N, B: state.B, symbols: state.symbols, boardMax: state.boardMax,
      puzzle: state.puzzle,
      solution: state.solution,
      grid: state.grid,
      given: state.given,
      notes: state.notes.map(s => [...s]),
      hinted: state.hinted,
      selected: state.selected,
      notesMode: state.notesMode,
      mistakes: state.mistakes,
      hintsLeft: state.hintsLeft,
      seconds: state.seconds,
      savedAt: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch(e){ /* storage unavailable/full — fail silently, game still playable */ }
}

function loadRawSave(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || !MODES[data.modeKey]) return null;
    return data;
  } catch(e){ return null; }
}

function clearSavedGame(){
  try{ localStorage.removeItem(STORAGE_KEY); } catch(e){}
}

function restoreGame(data){
  selectedMode = data.modeKey;
  currentDiff = data.diffKey;
  setActiveSizeButton(selectedMode);
  setActiveDiffButton(currentDiff);

  document.querySelector('.controls').style.display = "none";
  document.querySelector('details.rules').style.display = "none";
  document.getElementById("sdk-gameSudokuArea").style.display = "flex";
  updateSudokuOrientationClass();

  const N = data.N;
  state = {
    N: data.N, B: data.B, symbols: data.symbols, boardMax: computeSudokuBoardPx(),
    puzzle: data.puzzle,
    solution: data.solution,
    grid: data.grid,
    given: data.given,
    notes: data.notes.map(arr => new Set(arr)),
    hinted: data.hinted || new Array(N*N).fill(false),
    selected: typeof data.selected === "number" ? data.selected : -1,
    notesMode: !!data.notesMode,
    mistakes: data.mistakes || 0,
    hintsLeft: data.hintsLeft,
    seconds: data.seconds || 0,
    solved: false,
    lost: false
  };

  buildBoardSkeleton();
  buildNumpad();
  hankoEl.classList.remove("show");
  boardEl.classList.remove("solved", "locked");
  resultBanner.classList.remove("show", "lose");
  btnNotes.classList.toggle("active", state.notesMode);
  statMistakes.classList.toggle("warn", state.mistakes > 0);
  statMode.textContent = MODES[selectedMode].label;

  renderAll();
  updateTimeDisplay();
  startTimer();
}

function refreshContinueUI(){
  const saved = loadRawSave();
  const row = document.getElementById("sdk-continueRow");
  const meta = document.getElementById("sdk-continueMeta");
  if (saved){
    row.style.display = "flex";
    const modeLabel = MODES[saved.modeKey].label;
    const diffLabel = saved.diffKey ? (saved.diffKey.charAt(0).toUpperCase() + saved.diffKey.slice(1)) : "";
    const mm = String(Math.floor((saved.seconds||0)/60)).padStart(2,"0");
    const ss = String((saved.seconds||0)%60).padStart(2,"0");
    meta.textContent = modeLabel + " · " + diffLabel + " · " + mm + ":" + ss + " elapsed";
  } else {
    row.style.display = "none";
  }
}

/* ---------------- UI wiring ---------------- */

document.getElementById("sdk-btnContinue").addEventListener("click", () => {
  $(`#${sudokuWindowId} header`).css('display', 'none');
  const saved = loadRawSave();
  if (saved) restoreGame(saved);
});

sizeRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".size-btn");
  if (!btn) return;
  selectedMode = btn.dataset.mode;
  setActiveSizeButton(selectedMode);
});

diffRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".diff-btn");
  if (!btn) return;
  const diff = btn.dataset.diff;
  setActiveDiffButton(diff);
  startNewGame(diff);
});

document.getElementById("sdk-btnMenu").addEventListener("click", backToMenu);
document.getElementById("sdk-btnNewGame").addEventListener("click", () => startNewGame(currentDiff));
document.getElementById("sdk-btnErase").addEventListener("click", eraseSelected);
document.getElementById("sdk-btnNotes").addEventListener("click", toggleNotes);
document.getElementById("sdk-btnHint").addEventListener("click", useHint);

document.addEventListener("keydown", (e) => {
  if (!state || document.getElementById("sdk-gameSudokuArea").style.display === "none") return;
  const key = e.key.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(keyToValue, key)){
    inputNumber(keyToValue[key]);
    return;
  }
  if (e.key === "Backspace" || e.key === "Delete"){ eraseSelected(); return; }
  if (key === "n"){ toggleNotes(); return; }
  if (state.selected >= 0){
    let r = Math.floor(state.selected/state.N), c = state.selected%state.N;
    if (e.key === "ArrowUp") r = Math.max(0, r-1);
    else if (e.key === "ArrowDown") r = Math.min(state.N-1, r+1);
    else if (e.key === "ArrowLeft") c = Math.max(0, c-1);
    else if (e.key === "ArrowRight") c = Math.min(state.N-1, c+1);
    else return;
    e.preventDefault();
    selectCell(r,c);
  }
});

window.addEventListener("beforeunload", () => { saveGame(); });

refreshContinueUI();

})();