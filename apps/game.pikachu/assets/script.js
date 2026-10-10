(function(){
"use strict";

/* =====================================================================
   TILE ASSETS
   Toàn bộ hình nằm ở assets/titles/tile001.svg .. tile200.svg
   Muốn thêm hình mới: chỉ cần thêm file tileNNN.svg vào thư mục đó rồi
   tăng TILE_COUNT tương ứng — không cần sửa gì khác.
===================================================================== */
const TILE_COUNT = 200;
const TILE_BASE_PATH = "./apps/game.pikachu/assets/titles/";
function tileSrc(n) {
  return TILE_BASE_PATH + "tile" + String(n).padStart(3, "0") + ".svg";
}

/* =====================================================================
   MAP / LEVEL GENERATOR
   Mỗi "map" chỉ là một BỘ THAM SỐ độ khó (kích thước bàn, số loại hình,
   số bản sao mỗi hình, số lần xáo bài, số gợi ý, có giới hạn thời gian
   hay không). Bàn cờ thật sự được xáo ngẫu nhiên MỖI LẦN chơi map đó,
   nên "vài chục map" ở đây là vài chục cấp độ khó tăng dần chứ không
   phải vài chục layout cố định — chơi lại một map vẫn ra bàn mới.

   MUỐN BỔ SUNG MAP SAU NÀY: chỉ cần tăng LEVEL_COUNT, hoặc thêm object
   vào EXTRA_LEVELS bên dưới để chèn map "đặc chế" xen giữa map sinh tự
   động, không cần đụng vào logic sinh bàn hay logic chơi.
===================================================================== */
const LEVEL_COUNT = 30; // "vài chục map" - tăng số này để có thêm map tự động

// Map thủ công có thể chèn thêm ở đây sau này, ví dụ:
// { afterLevel: 30, level: { name: "Đại chiến", rows: 20, cols: 12, variety: 40, copies: 2, shuffles: 1, hints: 1, timeLimit: 240 } }
const EXTRA_LEVELS = [];

function tierOf(levelNumber, total) {
  const p = levelNumber / total;
  if (p <= 0.33) return "easy";
  if (p <= 0.66) return "medium";
  if (p <= 0.9) return "hard";
  return "expert";
}
const TIER_LABEL = { easy: "Dễ", medium: "Trung bình", hard: "Khó", expert: "Chuyên gia" };

function generateLevels(count) {
  const levels = [];
  for (let i = 1; i <= count; i++) {
    const t = (i - 1) / Math.max(1, count - 1); // 0 -> 1 độ khó tăng dần
    const tier = tierOf(i, count);

    // Kích thước bàn tăng dần: 6x4 (24 ô) -> 18x12 (216 ô)
    let cols = Math.round(6 + t * 12);
    let rows = Math.round(4 + t * 8);
    if ((rows * cols) % 2 !== 0) cols += 1; // luôn cần số ô chẵn để chia cặp

    // Số bản sao mỗi hình: dễ thì nhiều bản sao giống nhau (dễ tìm),
    // khó thì ít bản sao hơn (khó tìm), tối thiểu 2 (phải chẵn).
    let copies = Math.round(6 - t * 4);
    if (copies < 2) copies = 2;
    if (copies % 2 !== 0) copies -= 1;

    const totalCells = rows * cols;
    let variety = Math.floor(totalCells / copies);
    if (variety > TILE_COUNT) variety = TILE_COUNT;
    if (variety < 3) variety = 3;

    const shuffles = Math.max(1, Math.round(5 - t * 4));      // 5 -> 1 lần xáo
    const hints = Math.max(1, Math.round(5 - t * 3));         // 5 -> 2 lượt gợi ý
    const timeLimit = tier === "easy" ? 0 : Math.round(420 - t * 240); // dễ: không giới hạn

    levels.push({
      id: i,
      name: "Map " + i,
      tier,
      rows,
      cols,
      variety,
      copies,
      shuffles,
      hints,
      timeLimit // giây, 0 = không giới hạn
    });
  }
  EXTRA_LEVELS.forEach(x => {
    const idx = levels.findIndex(l => l.id === x.afterLevel);
    if (idx >= 0) levels.splice(idx + 1, 0, Object.assign({ id: levels.length + 1, tier: "expert" }, x.level));
  });
  return levels;
}

const LEVELS = generateLevels(LEVEL_COUNT);

/* =====================================================================
   DOM REFS
===================================================================== */
const mainMenu = document.getElementById("pkc-mainMenu");
const gameArea = document.getElementById("pkc-gameArea");
const diffRow = document.getElementById("pkc-diffRow");
const mapGrid = document.getElementById("pkc-mapGrid");
const mapCountEl = document.getElementById("pkc-mapCount");
const boardEl = document.getElementById("pkc-board");
const boardFrame = document.getElementById("pkc-boardFrame");
const linkLayer = document.getElementById("pkc-linkLayer");
const hankoEl = document.getElementById("pkc-hanko");
const resultBanner = document.getElementById("pkc-resultBanner");
const resultTitle = document.getElementById("pkc-resultTitle");
const resultSub = document.getElementById("pkc-resultSub");
const statTime = document.getElementById("pkc-statTime");
const statPairs = document.getElementById("pkc-statPairs");
const statShuffle = document.getElementById("pkc-statShuffle");
const statMap = document.getElementById("pkc-statMap");
const hintBadge = document.getElementById("pkc-hintBadge");
const btnHint = document.getElementById("pkc-btnHint");
const btnShuffle = document.getElementById("pkc-btnShuffle");

/* =====================================================================
   GAME STATE
===================================================================== */
let level = null;
let grid = [];        // 0 = ô trống đã dọn, >0 = mã hình (1..variety)
let R = 0, C = 0;
let selected = null;   // {r,c}
let hintsLeft = 0;
let shufflesLeft = 0;
let timer = null;
let seconds = 0;
let timeLimit = 0;
let pairsLeft = 0;
let totalPairs = 0;
let locked = false;

/* =====================================================================
   MENU: DIFFICULTY + MAP PICKER
===================================================================== */
function buildMapGrid() {
  mapCountEl.textContent = LEVELS.length;
  let html = "";
  LEVELS.forEach(lv => {
    html += `<button class="map-btn tier-${lv.tier}" data-level="${lv.id}" title="${TIER_LABEL[lv.tier]} · ${lv.cols}x${lv.rows}">${lv.id}</button>`;
  });
  mapGrid.innerHTML = html;
}
buildMapGrid();

mapGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".map-btn");
  if (!btn) return;
  const lv = LEVELS.find(l => l.id === Number(btn.dataset.level));
  if (lv) startLevel(lv);
});

diffRow.addEventListener("click", (e) => {
  const btn = e.target.closest(".diff-btn");
  if (!btn) return;
  diffRow.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const tier = btn.dataset.diff;
  const pool = LEVELS.filter(l => l.tier === tier);
  const lv = pool[Math.floor(Math.random() * pool.length)];
  startLevel(lv);
});

document.getElementById("pkc-btnMenu").addEventListener("click", backToMenu);
document.getElementById("pkc-btnNewGame").addEventListener("click", () => { if (level) startLevel(level); });
btnShuffle.addEventListener("click", doShuffle);
btnHint.addEventListener("click", useHint);

function backToMenu() {
  stopTimer();
  gameArea.style.display = "none";
  mainMenu.style.display = "block";
  stopBoardResizeWatch();
}

/* =====================================================================
   THEO DÕI RESIZE WINDOW
   Bàn cờ chỉ tính kích thước ô 1 lần lúc renderBoard(); nếu window được
   kéo to/nhỏ sau đó (dù allowResize hay do framework ngoài đổi), ta cần
   tự đo lại và vẽ lại bàn cờ để nó luôn lấp ~80% window thay vì bị kẹt
   ở size cũ (để trống viền quanh bàn).
===================================================================== */
let boardResizeObserver = null;
let boardResizeRaf = null;

function watchBoardResize() {
  stopBoardResizeWatch();
  const winEl = boardFrame.closest(".window") || boardFrame.closest(".window-content");
  if (!winEl || typeof ResizeObserver === "undefined") return;
  boardResizeObserver = new ResizeObserver(() => {
    if (boardResizeRaf) cancelAnimationFrame(boardResizeRaf);
    boardResizeRaf = requestAnimationFrame(() => {
      if (gameArea.style.display !== "none" && grid.length) renderBoard();
    });
  });
  boardResizeObserver.observe(winEl);
}

function stopBoardResizeWatch() {
  if (boardResizeObserver) { boardResizeObserver.disconnect(); boardResizeObserver = null; }
  if (boardResizeRaf) { cancelAnimationFrame(boardResizeRaf); boardResizeRaf = null; }
}

/* =====================================================================
   LEVEL START / BOARD GENERATION
===================================================================== */
function startLevel(lv) {
  level = lv;
  R = lv.rows; C = lv.cols;
  hintsLeft = lv.hints;
  shufflesLeft = lv.shuffles;
  timeLimit = lv.timeLimit;
  seconds = 0;
  selected = null;
  locked = false;

  grid = buildSolvedGrid(R, C, lv.variety, lv.copies);
  totalPairs = (R * C) / 2;
  pairsLeft = totalPairs;

  mainMenu.style.display = "none";
  gameArea.style.display = "flex";
  resultBanner.classList.remove("show", "lose");
  hankoEl.classList.remove("show");

  statMap.textContent = "#" + lv.id + " · " + TIER_LABEL[lv.tier];
  hintBadge.textContent = hintsLeft;
  statShuffle.textContent = shufflesLeft;
  updatePairsStat();
  renderBoard();
  startTimer();
  watchBoardResize();
}

// Tạo bàn cờ: chọn `variety` mã hình ngẫu nhiên trong 200 hình, lặp mỗi
// mã `copies` lần (bù thêm ngẫu nhiên cho đủ số ô chẵn), rồi xáo vị trí.
function buildSolvedGrid(rows, cols, variety, copies) {
  const totalCells = rows * cols;
  const codes = [];
  for (let i = 1; i <= TILE_COUNT; i++) codes.push(i);
  shuffleArray(codes);
  const chosen = codes.slice(0, variety);

  const pool = [];
  let idx = 0;
  while (pool.length < totalCells) {
    const code = chosen[idx % chosen.length];
    for (let c = 0; c < copies && pool.length < totalCells; c++) pool.push(code);
    idx++;
  }
  shuffleArray(pool);

  const g = [];
  let p = 0;
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(pool[p++]);
    g.push(row);
  }
  return g;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* =====================================================================
   RENDER
===================================================================== */
function renderBoard() {
  boardEl.style.gridTemplateColumns = `repeat(${C}, minmax(0,1fr))`;
  boardEl.style.gridTemplateRows = `repeat(${R}, minmax(0,1fr))`;
  const cellPx = boardCellSize();
  boardEl.style.width = (cellPx * C) + "px";
  boardEl.style.height = (cellPx * R) + "px";

  let html = "";
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const code = grid[r][c];
      if (code === 0) {
        html += `<div class="tile cleared" data-r="${r}" data-c="${c}"></div>`;
      } else {
        html += `<div class="tile" data-r="${r}" data-c="${c}"><img src="${tileSrc(code)}" draggable="false" alt=""></div>`;
      }
    }
  }
  boardEl.innerHTML = html;
}

function boardCellSize() {
  // Lấy kích thước của .window (class cha chứa cả app) thay vì hằng số cố định.
  const winEl = boardFrame.closest(".window") || boardFrame.closest(".window-content") || boardFrame.parentElement;
  const winW = winEl ? winEl.clientWidth : window.innerWidth;
  const winH = winEl ? winEl.clientHeight : window.innerHeight;

  if (window.IS_MOBILE === true) {
    // Mobile: do truc tiep khung board-frame (da tru padding san) thay vi doan so,
    // tranh board bi tran nhe qua phai nhu truoc day.
    const frameW = (boardFrame.clientWidth || (winW - 76));
    const fitW = Math.floor((frameW - 2) / C);
    // Trừ hao chiều cao: titlebar 48 + padding + stats-row + footer ~ 240px.
    const fitH = Math.floor((winH - 240) / R);
    const size = Math.min(fitW, fitH);
    return Math.max(14, Math.min(56, size));
  }

  // Desktop: cho bàn cờ chiếm tới 80% chiều rộng/cao của window.
  const availW = (winW * 0.8) - 40; // trừ hao padding/border của board-frame
  const availH = (winH * 0.8) - 40;

  const size = Math.floor(Math.min(availW / C, availH / R));
  return Math.max(22, size); // bỏ trần 52px để ô hình lớn theo window
}

boardEl.addEventListener("click", (e) => {
  const tileEl = e.target.closest(".tile");
  if (!tileEl || locked) return;
  const r = Number(tileEl.dataset.r), c = Number(tileEl.dataset.c);
  if (grid[r][c] === 0) return;
  onTileClick(r, c, tileEl);
});

/* =====================================================================
   SELECTION + MATCH LOGIC
===================================================================== */
function onTileClick(r, c, tileEl) {
  if (!selected) {
    selected = { r, c };
    tileEl.classList.add("selected");
    return;
  }
  if (selected.r === r && selected.c === c) {
    tileEl.classList.remove("selected");
    selected = null;
    return;
  }
  const a = selected;
  const b = { r, c };
  if (grid[a.r][a.c] !== grid[b.r][b.c]) {
    // Khác hình: chuyển lựa chọn sang ô mới
    clearSelectionClasses();
    selected = { r, c };
    tileEl.classList.add("selected");
    return;
  }
  const path = findConnectPath(a, b);
  clearSelectionClasses();
  selected = null;
  if (path) {
    resolveMatch(a, b, path);
  } else {
    flashWrong(a, b);
  }
}

function clearSelectionClasses() {
  boardEl.querySelectorAll(".tile.selected").forEach(el => el.classList.remove("selected"));
}

function flashWrong(a, b) {
  [a, b].forEach(p => {
    const el = boardEl.querySelector(`.tile[data-r="${p.r}"][data-c="${p.c}"]`);
    if (el) {
      el.classList.add("wrong");
      setTimeout(() => el.classList.remove("wrong"), 350);
    }
  });
}

function resolveMatch(a, b, path) {
  drawLinkPath(path);
  const elA = boardEl.querySelector(`.tile[data-r="${a.r}"][data-c="${a.c}"]`);
  const elB = boardEl.querySelector(`.tile[data-r="${b.r}"][data-c="${b.c}"]`);
  [elA, elB].forEach(el => el && el.classList.add("pop"));
  grid[a.r][a.c] = 0;
  grid[b.r][b.c] = 0;
  pairsLeft--;
  updatePairsStat();
  setTimeout(() => {
    if (elA) elA.classList.add("cleared");
    if (elB) elB.classList.add("cleared");
  }, 260);

  if (pairsLeft <= 0) {
    winGame();
  } else if (!hasAnyMove()) {
    // Bí đường ngay sau khi nối: tự xáo nếu còn lượt, không thì báo thua
    if (shufflesLeft > 0) {
      setTimeout(() => doShuffle(true), 400);
    } else {
      setTimeout(loseGame, 400);
    }
  }
}

function updatePairsStat() {
  statPairs.textContent = pairsLeft + "/" + totalPairs;
}

/* =====================================================================
   CONNECT-PATH ALGORITHM (giống cơ chế Onet/Pikachu cổ điển)
   - Bàn được mở rộng thêm viền 1 ô trống mỗi phía để đường nối có thể
     "vòng ra ngoài" bàn cờ.
   - check(A,B,turnsAllowed) đệ quy: 0 lần rẽ = đường thẳng; nếu không
     được thì thử mọi điểm P thấy được theo đường thẳng từ A, rồi kiểm
     tra tiếp P->B với số lần rẽ còn lại ít hơn 1.
===================================================================== */
function isPassable(r, c, a, b) {
  if (r < -1 || r > R || c < -1 || c > C) return false;
  if (r === -1 || r === R || c === -1 || c === C) return true; // viền ngoài luôn trống
  if ((r === a.r && c === a.c) || (r === b.r && c === b.c)) return true; // 2 điểm đầu/cuối
  return grid[r][c] === 0;
}

function straightClear(p1, p2, a, b) {
  if (p1.r !== p2.r && p1.c !== p2.c) return false;
  if (p1.r === p2.r) {
    const step = p2.c > p1.c ? 1 : -1;
    for (let c = p1.c + step; c !== p2.c; c += step) {
      if (!isPassable(p1.r, c, a, b)) return false;
    }
  } else {
    const step = p2.r > p1.r ? 1 : -1;
    for (let r = p1.r + step; r !== p2.r; r += step) {
      if (!isPassable(r, p1.c, a, b)) return false;
    }
  }
  return isPassable(p2.r, p2.c, a, b);
}

function straightReachablePoints(from, a, b) {
  const pts = [];
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  dirs.forEach(([dr, dc]) => {
    let r = from.r + dr, c = from.c + dc;
    while (r >= -1 && r <= R && c >= -1 && c <= C && isPassable(r, c, a, b)) {
      pts.push({ r, c });
      r += dr; c += dc;
    }
  });
  return pts;
}

function findConnectPath(a, b) {
  return checkConnect(a, b, 2, a, b);
}

function checkConnect(p1, p2, turnsAllowed, a, b) {
  if (straightClear(p1, p2, a, b)) return [p1, p2];
  if (turnsAllowed <= 0) return null;
  const candidates = straightReachablePoints(p1, a, b);
  for (const mid of candidates) {
    if (mid.r === p1.r && mid.c === p1.c) continue;
    const rest = checkConnect(mid, p2, turnsAllowed - 1, a, b);
    if (rest) return [p1, ...rest];
  }
  return null;
}

function hasAnyMove() {
  const cells = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (grid[r][c] !== 0) cells.push({ r, c });
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (grid[cells[i].r][cells[i].c] === grid[cells[j].r][cells[j].c]) {
        if (findConnectPath(cells[i], cells[j])) return true;
      }
    }
  }
  return false;
}

function findOneMove() {
  const cells = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (grid[r][c] !== 0) cells.push({ r, c });
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (grid[cells[i].r][cells[i].c] === grid[cells[j].r][cells[j].c]) {
        const path = findConnectPath(cells[i], cells[j]);
        if (path) return { a: cells[i], b: cells[j] };
      }
    }
  }
  return null;
}

/* =====================================================================
   LINK LINE DRAWING
===================================================================== */
function drawLinkPath(path) {
  const cellPx = boardCellSize();
  const gap = 3;
  const toXY = (p) => ({
    x: (p.c + 0.5) * (cellPx + gap) - gap / 2,
    y: (p.r + 0.5) * (cellPx + gap) - gap / 2
  });
  const pts = path.map(toXY);
  const d = "M " + pts.map(p => `${p.x},${p.y}`).join(" L ");
  linkLayer.innerHTML = `<svg viewBox="0 0 ${C * (cellPx + gap)} ${R * (cellPx + gap)}" preserveAspectRatio="none"><path class="link-path" d="${d}"/></svg>`;
  setTimeout(() => { linkLayer.innerHTML = ""; }, 420);
}

/* =====================================================================
   SHUFFLE / HINT
===================================================================== */
function doShuffle(silent) {
  if (locked) return;
  if (shufflesLeft <= 0 && !silent) return;
  if (!silent) shufflesLeft--;
  statShuffle.textContent = shufflesLeft;

  const remaining = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (grid[r][c] !== 0) remaining.push(grid[r][c]);
  shuffleArray(remaining);
  let k = 0;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (grid[r][c] !== 0) grid[r][c] = remaining[k++];

  renderBoard();
  clearSelectionClasses();
  selected = null;

  if (!hasAnyMove()) {
    if (shufflesLeft > 0) {
      doShuffle(true);
    } else {
      loseGame();
    }
  }
}

function useHint() {
  if (locked || hintsLeft <= 0) return;
  const move = findOneMove();
  if (!move) return;
  hintsLeft--;
  hintBadge.textContent = hintsLeft;
  [move.a, move.b].forEach(p => {
    const el = boardEl.querySelector(`.tile[data-r="${p.r}"][data-c="${p.c}"]`);
    if (el) {
      el.classList.add("hint");
      setTimeout(() => el.classList.remove("hint"), 1800);
    }
  });
}

/* =====================================================================
   TIMER / WIN / LOSE
===================================================================== */
function startTimer() {
  stopTimer();
  updateTimeDisplay();
  timer = setInterval(() => {
    seconds++;
    updateTimeDisplay();
    if (timeLimit > 0 && seconds >= timeLimit) {
      loseGame("Hết giờ!");
    }
  }, 1000);
}
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
function updateTimeDisplay() {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  let label = m + ":" + s;
  if (timeLimit > 0) {
    const remain = Math.max(0, timeLimit - seconds);
    const rm = String(Math.floor(remain / 60)).padStart(2, "0");
    const rs = String(remain % 60).padStart(2, "0");
    label = rm + ":" + rs;
  }
  statTime.textContent = label;
}

function winGame() {
  locked = true;
  stopTimer();
  resultTitle.textContent = "Hoàn thành!";
  resultSub.textContent = "Bạn đã dọn sạch " + totalPairs + " cặp trong " + statTime.textContent + " · " + statMap.textContent;
  resultBanner.classList.remove("lose");
  resultBanner.classList.add("show");
  hankoEl.classList.add("show");
}
function loseGame(reason) {
  locked = true;
  stopTimer();
  resultTitle.textContent = "Chưa xong ván này";
  resultSub.textContent = (reason || "Hết cách nối và hết lượt xáo bài.") + " Còn lại " + pairsLeft + " cặp.";
  resultBanner.classList.add("show", "lose");
}

})();