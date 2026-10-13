(function(){
"use strict";

const SIZE = 4;
const TARGET = 1024;
const BEST_KEY = "game1024_best";

let grid = [];
let score = 0;
let best = 0;
let history = [];
let won = false;
let over = false;
let keepGoing = false;

const boardEl = () => document.getElementById("g1024-board");
const scoreEl = () => document.getElementById("g1024-score");
const bestEl = () => document.getElementById("g1024-best");
const overlayEl = () => document.getElementById("g1024-overlay");
const overlayTextEl = () => document.getElementById("g1024-overlayText");

function emptyGrid(){
  return Array.from({length: SIZE}, () => Array(SIZE).fill(0));
}

function loadBest(){
  try { best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; }
  catch(e){ best = 0; }
}
function saveBest(){
  try { localStorage.setItem(BEST_KEY, String(best)); } catch(e){}
}

function newGame(){
  grid = emptyGrid();
  score = 0;
  history = [];
  won = false;
  over = false;
  keepGoing = false;
  spawnTile();
  spawnTile();
  hideOverlay();
  render();
  updateScores();
}

function snapshot(){
  return { grid: grid.map(r => r.slice()), score };
}
function pushHistory(){
  history.push(snapshot());
  if (history.length > 20) history.shift();
}
function undo(){
  if (!history.length || over) return;
  const s = history.pop();
  grid = s.grid;
  score = s.score;
  won = grid.some(r => r.some(v => v >= TARGET));
  hideOverlay();
  render();
  updateScores();
}

function emptyCells(){
  const cells = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] === 0) cells.push([r, c]);
  return cells;
}

function spawnTile(){
  const cells = emptyCells();
  if (!cells.length) return;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function slideRow(row){
  // Trượt sang trái, gộp các cặp giống nhau
  const filtered = row.filter(v => v !== 0);
  const merged = [];
  let gained = 0;
  for (let i = 0; i < filtered.length; i++){
    if (i + 1 < filtered.length && filtered[i] === filtered[i+1]){
      const v = filtered[i] * 2;
      merged.push(v);
      gained += v;
      i++;
      if (v >= TARGET && !won){ won = true; }
    } else {
      merged.push(filtered[i]);
    }
  }
  while (merged.length < SIZE) merged.push(0);
  return { row: merged, gained, moved: merged.some((v,i) => v !== row[i]) };
}

function rotateLeft(g){
  const n = g.length;
  const out = emptyGrid();
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      out[n-1-c][r] = g[r][c];
  return out;
}

function move(dir){
  // dir: 0=trái, 1=lên, 2=phải, 3=xuống
  if (over) return;
  pushHistory();
  let g = grid;
  for (let i = 0; i < dir; i++) g = rotateLeft(g);
  let moved = false, gained = 0;
  const newG = [];
  for (let r = 0; r < SIZE; r++){
    const res = slideRow(g[r]);
    newG.push(res.row);
    if (res.moved) moved = true;
    gained += res.gained;
  }
  // Xoay ngược lại: xoay trái (4-dir)%4 lần
  let finalG = newG;
  for (let i = 0; i < (4 - dir) % 4; i++) finalG = rotateLeft(finalG);
  grid = finalG;
  if (!moved){
    history.pop(); // không di chuyển thì bỏ snapshot
    return;
  }
  score += gained;
  spawnTile();
  render();
  updateScores();
  checkEnd();
}

function movesAvailable(){
  if (emptyCells().length) return true;
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++){
      const v = grid[r][c];
      if (c + 1 < SIZE && grid[r][c+1] === v) return true;
      if (r + 1 < SIZE && grid[r+1][c] === v) return true;
    }
  return false;
}

function checkEnd(){
  if (won && !keepGoing && !overlayEl().classList.contains("show")){
    showOverlay("🎉 Đạt 1024!", true);
  } else if (!movesAvailable()){
    over = true;
    showOverlay("😞 Hết nước đi!", false);
  }
}

function showOverlay(text, canContinue){
  overlayTextEl().textContent = text;
  const againBtn = document.getElementById("g1024-again");
  if (canContinue){
    againBtn.textContent = "Chơi tiếp";
    againBtn.onclick = () => { keepGoing = true; hideOverlay(); };
  } else {
    againBtn.textContent = "Chơi lại";
    againBtn.onclick = () => newGame();
  }
  overlayEl().classList.add("show");
}
function hideOverlay(){
  overlayEl().classList.remove("show");
}

function updateScores(){
  scoreEl().textContent = score;
  if (score > best){ best = score; saveBest(); }
  bestEl().textContent = best;
}

const TILE_COLORS = {
  2:    ["#eee4da", "#776e65"],
  4:    ["#ede0c8", "#776e65"],
  8:    ["#f2b179", "#f9f6f2"],
  16:   ["#f59563", "#f9f6f2"],
  32:   ["#f67c5f", "#f9f6f2"],
  64:   ["#f65e3b", "#f9f6f2"],
  128:  ["#edcf72", "#f9f6f2"],
  256:  ["#edcc61", "#f9f6f2"],
  512:  ["#edc850", "#f9f6f2"],
  1024: ["#edc53f", "#f9f6f2"],
  2048: ["#3c3a32", "#f9f6f2"]
};

function render(){
  const board = boardEl();
  board.innerHTML = "";
  for (let r = 0; r < SIZE; r++){
    for (let c = 0; c < SIZE; c++){
      const cell = document.createElement("div");
      cell.className = "g1024-cell";
      const v = grid[r][c];
      if (v){
        const tile = document.createElement("div");
        tile.className = "g1024-tile";
        const [bg, fg] = TILE_COLORS[v] || TILE_COLORS[2048];
        tile.style.background = bg;
        tile.style.color = fg;
        tile.textContent = v;
        if (v >= 1024) tile.classList.add("super");
        if (String(v).length >= 4) tile.classList.add("small");
        cell.appendChild(tile);
      }
      board.appendChild(cell);
    }
  }
}

/* ---- Input: phím + vuốt ---- */

const KEYMAP = {
  ArrowLeft: 0, a: 0, A: 0,
  ArrowUp: 1, w: 1, W: 1,
  ArrowRight: 2, d: 2, D: 2,
  ArrowDown: 3, s: 3, S: 3
};

document.addEventListener("keydown", (e) => {
  if (!document.querySelector(".game1024-app")) return;
  if (e.key in KEYMAP){
    e.preventDefault();
    move(KEYMAP[e.key]);
  } else if ((e.key === "u" || e.key === "U") && (e.ctrlKey || e.metaKey)){
    e.preventDefault();
    undo();
  }
});

let touchStart = null;
document.addEventListener("pointerdown", (e) => {
  const board = boardEl();
  if (!board || !board.contains(e.target)) return;
  touchStart = { x: e.clientX, y: e.clientY };
});
document.addEventListener("pointerup", (e) => {
  if (!touchStart) return;
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  touchStart = null;
  const adx = Math.abs(dx), ady = Math.abs(dy);
  if (Math.max(adx, ady) < 24) return; // vuốt quá ngắn
  let dir;
  if (adx > ady) dir = dx > 0 ? 2 : 0;
  else dir = dy > 0 ? 3 : 1;
  move(dir);
});

/* ---- Nút bấm ---- */

document.addEventListener("click", (e) => {
  if (e.target.id === "g1024-new") newGame();
  else if (e.target.id === "g1024-undo") undo();
  else if (e.target.id === "g1024-again"){
    // xử lý trong showOverlay
  }
});

/* ---- Khởi tạo ---- */

loadBest();
newGame();
const bEl = bestEl();
if (bEl) bEl.textContent = best;

})();
