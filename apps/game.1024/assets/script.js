(function(){
"use strict";

const SIZE = 4;
const TARGET = 1024;
const BEST_KEY = "game1024_best";

let tiles = []; // [{id, r, c, value, merged}]
let nextId = 1;
let score = 0;
let best = 0;
let history = [];
let won = false;
let over = false;
let keepGoing = false;

const boardEl = () => document.getElementById("g1024-board");
const tilesLayerEl = () => document.getElementById("g1024-tiles");
const scoreEl = () => document.getElementById("g1024-score");
const bestEl = () => document.getElementById("g1024-best");
const overlayEl = () => document.getElementById("g1024-overlay");
const overlayTextEl = () => document.getElementById("g1024-overlayText");

function loadBest(){
  try { best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0; }
  catch(e){ best = 0; }
}
function saveBest(){
  try { localStorage.setItem(BEST_KEY, String(best)); } catch(e){}
}

function gridFromTiles(){
  const g = Array.from({length: SIZE}, () => Array(SIZE).fill(null));
  for (const t of tiles) g[t.r][t.c] = t;
  return g;
}

function newGame(){
  buildGrid();
  tiles = [];
  nextId = 1;
  score = 0;
  history = [];
  won = false;
  over = false;
  keepGoing = false;
  spawnTile();
  spawnTile();
  hideOverlay();
  render(true);
  updateScores();
}

function snapshot(){
  return {
    tiles: tiles.map(t => ({...t})),
    score, nextId,
    won, over
  };
}
function pushHistory(){
  history.push(snapshot());
  if (history.length > 20) history.shift();
}
function undo(){
  if (!history.length || over) return;
  const s = history.pop();
  tiles = s.tiles;
  score = s.score;
  nextId = s.nextId;
  won = s.won;
  hideOverlay();
  render(true);
  updateScores();
}

function emptyCells(){
  const g = gridFromTiles();
  const cells = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!g[r][c]) cells.push([r, c]);
  return cells;
}

function spawnTile(){
  const cells = emptyCells();
  if (!cells.length) return null;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  const t = { id: nextId++, r, c, value: Math.random() < 0.9 ? 2 : 4, isNew: true };
  tiles.push(t);
  return t;
}

function move(dir){
  // dir: 0=trái, 1=lên, 2=phải, 3=xuống
  if (over) return;
  pushHistory();

  // Xóa flag cũ
  for (const t of tiles){ t.isNew = false; t.justMerged = false; }

  // Nhóm tile theo hàng/cột theo hướng di chuyển
  let moved = false;
  let gained = 0;
  const toRemove = new Set();

  // Tạo lưới để xử lý
  const getLines = () => {
    const lines = [];
    if (dir === 0 || dir === 2){
      // Theo hàng ngang
      for (let r = 0; r < SIZE; r++){
        const line = [];
        for (let c = 0; c < SIZE; c++){
          const cc = (dir === 0) ? c : (SIZE - 1 - c);
          line.push({r, c: cc});
        }
        lines.push(line);
      }
    } else {
      // Theo cột dọc
      for (let c = 0; c < SIZE; c++){
        const line = [];
        for (let r = 0; r < SIZE; r++){
          const rr = (dir === 1) ? r : (SIZE - 1 - r);
          line.push({r: rr, c});
        }
        lines.push(line);
      }
    }
    return lines;
  };

  const g = gridFromTiles();
  const lines = getLines();

  for (const line of lines){
    // Lấy tile theo thứ tự
    const lineTiles = [];
    for (const {r, c} of line){
      if (g[r][c]) lineTiles.push(g[r][c]);
    }
    // Trượt và gộp
    let targetIdx = 0;
    for (let i = 0; i < lineTiles.length; i++){
      const t = lineTiles[i];
      const {r: tr, c: tc} = line[targetIdx];
      if (i + 1 < lineTiles.length && lineTiles[i].value === lineTiles[i+1].value){
        // Gộp 2 tile
        const t2 = lineTiles[i+1];
        t.r = tr; t.c = tc;
        t.value *= 2;
        t.justMerged = true;
        gained += t.value;
        if (t.value >= TARGET && !won) won = true;
        toRemove.add(t2.id);
        // Di chuyển t2 đến vị trí gộp để animation trượt
        t2.r = tr; t2.c = tc;
        t2.merging = true;
        i++; // bỏ qua tile đã gộp
        moved = true;
      } else {
        if (t.r !== tr || t.c !== tc) moved = true;
        t.r = tr; t.c = tc;
      }
      targetIdx++;
    }
  }

  if (!moved){
    history.pop();
    return;
  }

  score += gained;
  // Xóa tile đã gộp (sau khi animation)
  tiles = tiles.filter(t => !toRemove.has(t.id));
  spawnTile();
  render(false);
  updateScores();
  // Xóa flag merging sau animation
  setTimeout(() => {
    for (const t of tiles) delete t.merging;
  }, 200);
  checkEnd();
}

function movesAvailable(){
  if (emptyCells().length) return true;
  const g = gridFromTiles();
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++){
      const t = g[r][c];
      if (!t) continue;
      if (c + 1 < SIZE && g[r][c+1] && g[r][c+1].value === t.value) return true;
      if (r + 1 < SIZE && g[r+1][c] && g[r+1][c].value === t.value) return true;
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
  const o = overlayEl();
  if (o) o.classList.remove("show");
}

function updateScores(){
  const sEl = scoreEl();
  if (sEl) sEl.textContent = score;
  if (score > best){ best = score; saveBest(); }
  const bEl = bestEl();
  if (bEl) bEl.textContent = best;
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

// Map id -> element để giữ và animation
const tileEls = new Map();

function buildGrid(){
  const board = boardEl();
  // Xoa luoi cu neu co (giu lai tiles layer)
  const oldCells = board.querySelectorAll(".g1024-cell");
  oldCells.forEach(el => el.remove());
  for (let r = 0; r < SIZE; r++){
    for (let c = 0; c < SIZE; c++){
      const cell = document.createElement("div");
      cell.className = "g1024-cell";
      board.appendChild(cell);
    }
  }
  // Dua tiles layer len tren
  const layer = tilesLayerEl();
  if (layer) board.appendChild(layer);
}

function tilePos(r, c){
  // Vị trí % trong board
  return {
    left: (c / SIZE * 100) + "%",
    top: (r / SIZE * 100) + "%",
    width: (100 / SIZE) + "%",
    height: (100 / SIZE) + "%"
  };
}

function render(instant){
  const layer = tilesLayerEl();
  if (!layer) return;
  const seen = new Set();
  for (const t of tiles){
    seen.add(t.id);
    let el = tileEls.get(t.id);
    const pos = tilePos(t.r, t.c);
    if (!el){
      el = document.createElement("div");
      el.className = "g1024-tile-abs";
      tileEls.set(t.id, el);
      layer.appendChild(el);
      // Tile mới: đặt ngay vị trí, không transition
      el.style.transition = "none";
      el.style.left = pos.left;
      el.style.top = pos.top;
      el.style.width = pos.width;
      el.style.height = pos.height;
      void el.offsetWidth; // reflow
      el.style.transition = "";
      if (t.isNew) el.classList.add("appear");
    } else {
      // Cập nhật vị trí -> CSS transition sẽ trượt
      el.style.left = pos.left;
      el.style.top = pos.top;
    }
    // Cập nhật nội dung
    const [bg, fg] = TILE_COLORS[t.value] || TILE_COLORS[2048];
    el.style.background = bg;
    el.style.color = fg;
    el.textContent = t.value;
    el.classList.toggle("super", t.value >= 1024);
    el.classList.toggle("small", String(t.value).length >= 4);
    el.classList.toggle("merged", !!t.justMerged);
    // Xóa class appear sau animation
    if (t.isNew){
      setTimeout(() => el.classList.remove("appear"), 250);
      t.isNew = false;
    }
    if (t.justMerged){
      setTimeout(() => { el.classList.remove("merged"); t.justMerged = false; }, 320);
    }
  }
  // Xóa element của tile đã mất
  for (const [id, el] of tileEls){
    if (!seen.has(id)){
      el.remove();
      tileEls.delete(id);
    }
  }
}

/* ---- Input ---- */

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
  if (Math.max(adx, ady) < 24) return;
  let dir;
  if (adx > ady) dir = dx > 0 ? 2 : 0;
  else dir = dy > 0 ? 3 : 1;
  move(dir);
});

document.addEventListener("click", (e) => {
  if (e.target.id === "g1024-new") newGame();
  else if (e.target.id === "g1024-undo") undo();
});

loadBest();
newGame();
const bEl = bestEl();
if (bEl) bEl.textContent = best;

})();
