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
const LEVEL_COUNT = 200; // tang so nay de co them map tu dong

// Map thủ công có thể chèn thêm ở đây sau này, ví dụ:
// { afterLevel: 30, level: { name: "Đại chiến", rows: 20, cols: 12, variety: 40, copies: 2, shuffles: 1, hints: 1, timeLimit: 240 } }
const EXTRA_LEVELS = [];

function tierOf(levelNumber, total) {
  const p = levelNumber / total;
  if (p <= 0.15) return "easy";
  if (p <= 0.45) return "medium";
  if (p <= 0.75) return "hard";
  return "expert";
}
const TIER_LABEL = { easy: "Dễ", medium: "Trung bình", hard: "Khó", expert: "Chuyên gia" };

function generateLevels(count) {
  const levels = [];
  for (let i = 1; i <= count; i++) {
    const t = (i - 1) / Math.max(1, count - 1); // 0 -> 1 độ khó tăng dần
    const tier = tierOf(i, count);

    // Kích thước bàn tăng dần: 6x4 (24 ô) -> 22x16 (352 ô)
    let cols = Math.round(6 + t * 16);
    let rows = Math.round(4 + t * 12);
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

    const shuffles = Math.max(1, Math.round(4 - t * 3));      // 4 -> 1 lần xáo (ít hơn = khó hơn)
    const hints = Math.max(1, Math.round(4 - t * 3));         // 4 -> 1 lượt gợi ý
    const timeLimit = tier === "easy" ? 0 : Math.round(400 - t * 280); // dễ: không giới hạn, còn lại 400s -> 120s

    levels.push({
      id: i,
      name: "Map " + i,
      tier,
      rows,   // shape tham khảo (desktop dùng trực tiếp)
      cols,
      cells: rows * cols, // độ khó thật: tổng số ô (mobile tự xoay tỉ lệ theo màn hình)
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
  // Map Chuyên gia: sau mỗi cặp nối, board "rơi" theo trọng lực —
  // 1/3 đầu rơi cố định 1 hướng, 1/3 giữa đảo qua lại, 1/3 cuối ngẫu nhiên.
  const experts = levels.filter(l => l.tier === "expert");
  experts.forEach((l, idx) => {
    const e = idx / Math.max(1, experts.length - 1);
    l.shift = e < 1/3 ? "fixed" : (e < 2/3 ? "alternate" : "random");
  });
  return levels;
}
const SHIFT_LABEL = { fixed: "Rơi ↓", alternate: "Rơi ↕", random: "Rơi ngẫu nhiên" };

const LEVELS = generateLevels(LEVEL_COUNT);

/* =====================================================================
   TIẾN TRÌNH MỞ KHÓA MAP (localStorage)
   - Chơi xong map N mới mở khóa map N+1 (khó hơn).
   - Lưu: số map đã mở khóa + thành tích thời gian tốt nhất mỗi map.
===================================================================== */
const PROGRESS_KEY = "pikachu-progress-v1";
/* Pack: moi pack 10 map, qua it nhat 80% (8/10) map cua pack hien tai
   thi mo pack tiep theo. completed[id] = true nghia la map id da qua. */
const PACK_SIZE = 10;
const PACK_NEED = 8;
function loadProgress() {
  const fresh = () => ({ completed: {}, best: {} });
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return fresh();
    const p = JSON.parse(raw);
    if (!p || typeof p !== "object") return fresh();
    const best = (p.best && typeof p.best === "object") ? p.best : {};
    if (p.completed && typeof p.completed === "object") {
      return { completed: p.completed, best };
    }
    // Migrate tu ban cu (mo khoa tuan tu theo unlocked): map 1..unlocked-1 da qua
    const completed = {};
    if (typeof p.unlocked === "number") {
      const up = Math.max(1, Math.min(LEVELS.length, p.unlocked));
      for (let i = 1; i < up; i++) completed[i] = true;
    }
    Object.keys(best).forEach(k => { completed[k] = true; });
    return { completed, best };
  } catch (e) { /* localStorage không dùng được: chơi như chưa lưu */ }
  return fresh();
}
function packOf(levelId) { return Math.ceil(levelId / PACK_SIZE); }
function packCount() { return Math.ceil(LEVELS.length / PACK_SIZE); }
function packRange(p) {
  return { from: (p - 1) * PACK_SIZE + 1, to: Math.min(p * PACK_SIZE, LEVELS.length) };
}
function packCompleted(p) {
  const { from, to } = packRange(p);
  let n = 0;
  for (let i = from; i <= to; i++) if (progress.completed[i]) n++;
  return n;
}
function totalCompleted() { return Object.keys(progress.completed).length; }
function isPackUnlocked(p) {
  if (p <= 1) return true;
  if (p > packCount()) return false;
  return packCompleted(p - 1) >= PACK_NEED;
}
function isLevelUnlocked(id) { return isPackUnlocked(packOf(id)); }
function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) {}
}
let progress = loadProgress();
/* Cheat mở khóa nhanh cho dev/test: thêm ?pikachu_unlock=N (mở map 1..N)
   hoặc ?pikachu_unlock=all (mở hết) vào URL rồi tải lại trang là xong. */
try {
  const __uq = new URLSearchParams(window.location.search).get("pikachu_unlock");
  if (__uq) {
    const __n = __uq === "all" ? LEVELS.length : Math.max(0, parseInt(__uq, 10) || 0);
    for (let i = 1; i <= __n && i <= LEVELS.length; i++) progress.completed[i] = true;
    if (__n > 0) progress.lastPlayed = Math.min(__n + 1, LEVELS.length);
    saveProgress();
  }
} catch (e) {}

/* =====================================================================
   DOM REFS
===================================================================== */
const mainMenu = document.getElementById("pkc-mainMenu");
const gameArea = document.getElementById("pkc-gameArea");
const mapGrid = document.getElementById("pkc-mapGrid");
const packNameEl = document.getElementById("pkc-packName");
const packProgEl = document.getElementById("pkc-packProg");
const packLockNoteEl = document.getElementById("pkc-packLockNote");
const packPrevBtn = document.getElementById("pkc-packPrev");
const packNextBtn = document.getElementById("pkc-packNext");
const rulesModal = document.getElementById("pkc-rulesModal");
const winModal = document.getElementById("pkc-winModal");
const winSub = document.getElementById("pkc-winSub");
const winNote = document.getElementById("pkc-winNote");
const winNext = document.getElementById("pkc-winNext");
const rotateHintEl = document.getElementById("pkc-rotateHint");
let pausedByRotate = false;
/* Man hinh doc khi dang choi: hien nhac xoay + tam dung dem gio */
function updateRotateHint() {
  if (!rotateHintEl) return;
  if (!gameArea.closest(".window")) { rotateHintEl.style.display = "none"; return; } // cua so da dong
  const inGame = gameArea.style.display !== "none";
  const isPortrait = window.innerHeight >= window.innerWidth;
  const show = window.IS_MOBILE === true && inGame && isPortrait;
  rotateHintEl.style.display = show ? "flex" : "none";
  if (show && timer && !pausedByRotate) { stopTimer(); pausedByRotate = true; }
  else if (!show && pausedByRotate && !locked) { pausedByRotate = false; startTimer(); }
}
window.addEventListener("resize", updateRotateHint);
window.addEventListener("orientationchange", () => setTimeout(updateRotateHint, 350));
function hideWinModal() { winModal.style.display = "none"; }
let viewPack = 0; // pack dang xem (0 = tu dong theo map vua choi)
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
function fmtTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s2 = String(sec % 60).padStart(2, "0");
  return m + ":" + s2;
}
function buildMapGrid() {
  refreshMapGrid();
}
function currentViewPack() {
  const np = packCount();
  let p = viewPack;
  if (!p || p < 1 || p > np) {
    p = progress.lastPlayed ? packOf(progress.lastPlayed) : 1;
    if (p < 1) p = 1;
    if (p > np) p = np;
  }
  return p;
}
function refreshMapGrid() {
  const np = packCount();
  const p = currentViewPack();
  viewPack = p;
  const { from, to } = packRange(p);
  const unlocked = isPackUnlocked(p);
  const done = packCompleted(p);
  const size = to - from + 1;
  packNameEl.textContent = "Pack " + p + "/" + np;
  if (unlocked) {
    packProgEl.textContent = done + "/" + size + " đã qua";
    packLockNoteEl.style.display = "none";
  } else {
    packProgEl.textContent = "🔒 " + done + "/" + size;
    packLockNoteEl.style.display = "";
    packLockNoteEl.textContent = "Hoàn thành " + PACK_NEED + "/" + PACK_SIZE + " map của Pack " + (p - 1) + " để mở khóa pack này.";
  }
  packPrevBtn.disabled = (p <= 1);
  packNextBtn.disabled = (p >= np);
  const lastId = progress.lastPlayed || 0;
  let html = "";
  for (let id = from; id <= to; id++) {
    const lv = LEVELS[id - 1];
    const isDone = !!progress.completed[id];
    const best = progress.best[id];
    const tip = unlocked
      ? ("Map " + id + " · " + TIER_LABEL[lv.tier] + " · " + lv.cells + " ô" + (best ? " · Kỷ lục " + fmtTime(best.time) : "") + (lv.shift ? " · " + SHIFT_LABEL[lv.shift] : ""))
      : "Pack chưa mở khóa";
    html += `<button class="map-btn tier-${lv.tier}${unlocked ? "" : " locked"}${isDone ? " done" : ""}${id === lastId ? " last" : ""}" data-level="${id}"${unlocked ? "" : " disabled"} title="${tip}">${unlocked ? id : "🔒"}</button>`;
  }
  mapGrid.innerHTML = html;
}
buildMapGrid();
buildMapGrid();

mapGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".map-btn");
  if (!btn) return;
  const lv = LEVELS.find(l => l.id === Number(btn.dataset.level));
  if (!lv || !isLevelUnlocked(lv.id)) return;
  startLevel(lv);
});

packPrevBtn.addEventListener("click", () => {
  const p = currentViewPack();
  if (p > 1) { viewPack = p - 1; refreshMapGrid(); }
});
packNextBtn.addEventListener("click", () => {
  const p = currentViewPack();
  if (p < packCount()) { viewPack = p + 1; refreshMapGrid(); }
});
document.getElementById("pkc-rulesBtn").addEventListener("click", () => {
  rulesModal.style.display = "flex";
});
document.getElementById("pkc-rulesClose").addEventListener("click", () => {
  rulesModal.style.display = "none";
});
rulesModal.addEventListener("click", (e) => {
  if (e.target === rulesModal) rulesModal.style.display = "none";
});

document.getElementById("pkc-btnMenu").addEventListener("click", backToMenu);
document.getElementById("pkc-btnClose").addEventListener("click", () => {
  // Dong cua so game qua nut X goc (se kich hoat onClose: mo khoa xoay)
  const winEl = boardFrame.closest(".window");
  const closer = winEl ? winEl.querySelector(".btn-icon-close") : null;
  if (closer) closer.click();
});
document.getElementById("pkc-btnNewGame").addEventListener("click", () => { if (level) startLevel(level); });
document.getElementById("pkc-winMenu").addEventListener("click", () => { hideWinModal(); backToMenu(); });
document.getElementById("pkc-winReplay").addEventListener("click", () => { hideWinModal(); if (level) startLevel(level); });
btnShuffle.addEventListener("click", doShuffle);
btnHint.addEventListener("click", useHint);

function backToMenu() {
  stopTimer();
  pausedByRotate = false;
  hideWinModal();
  if (rotateHintEl) rotateHintEl.style.display = "none";
  gameArea.style.display = "none";
  mainMenu.style.display = "block";
  stopBoardResizeWatch();
  refreshMapGrid();
  const footEl = document.querySelector(".pikachu-app footer");
  if (footEl) footEl.style.display = "";
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
   BOARD SHAPE THEO MÀN HÌNH (mobile)
   Độ khó nằm ở `cells` (tổng số ô) + variety/copies — còn tỉ lệ rows/cols
   thì xoay theo màn hình để tile luôn to nhất: màn ngang -> bàn rộng,
   màn dọc -> bàn cao. Desktop giữ shape cố định như cũ.
===================================================================== */
function computeAdaptiveShape(totalCells) {
  const winEl = (typeof boardFrame !== "undefined" && boardFrame.closest(".window"))
    || (typeof boardFrame !== "undefined" && boardFrame.closest(".window-content"));
  const winW = winEl ? winEl.clientWidth : window.innerWidth;
  const winH = winEl ? winEl.clientHeight : window.innerHeight;
  const areaW = (typeof gameArea !== "undefined" && gameArea.clientWidth) || winW;
  const availW = Math.max(200, areaW - 44); // trừ padding wrap (12*2) + frame/board (20)
  let top = 0;
  try { top = boardFrame.getBoundingClientRect().top || 0; } catch (e) {}
  const availH = Math.max(120, winH - top - 32); // trừ padding dưới wrap (12) + frame/board (20)
  // Muốn tile vuông to nhất: tỉ lệ cols/rows ~ availW/availH
  let cols = Math.round(Math.sqrt(totalCells * availW / availH));
  cols = Math.max(6, Math.min(40, cols));
  let rows = Math.max(4, Math.ceil(totalCells / cols));
  if ((cols * rows) % 2 !== 0) cols += 1; // luôn cần số ô chẵn
  while (cols * rows < totalCells) cols += 2;
  return { rows, cols };
}

/* =====================================================================
   LEVEL START / BOARD GENERATION
===================================================================== */
function startLevel(lv) {
  level = lv;
  progress.lastPlayed = lv.id;
  viewPack = packOf(lv.id);
  saveProgress();
  // Hiện gameArea trước để đo được kích thước thật (cho computeAdaptiveShape)
  hideWinModal();
  mainMenu.style.display = "none";
  gameArea.style.display = "flex";
  // Mobile: xoay tỉ lệ bàn theo màn hình; desktop: giữ shape gốc
  let shape = { rows: lv.rows, cols: lv.cols };
  if (window.IS_MOBILE === true && lv.cells) shape = computeAdaptiveShape(lv.cells);
  updateRotateHint();
  R = shape.rows; C = shape.cols;
  hintsLeft = lv.hints;
  shufflesLeft = lv.shuffles;
  timeLimit = lv.timeLimit;
  seconds = 0;
  selected = null;
  locked = false;
  shiftCount = 0;

  grid = buildSolvedGrid(R, C, lv.variety, lv.copies);
  totalPairs = (R * C) / 2;
  pairsLeft = totalPairs;

  resultBanner.classList.remove("show", "lose");
  hankoEl.classList.remove("show");
  if (window.IS_MOBILE === true) {
    const footEl = document.querySelector(".pikachu-app footer");
    if (footEl) footEl.style.display = "none"; // cho board co them cho
  }

  statMap.textContent = "#" + lv.id + " · " + TIER_LABEL[lv.tier] + (lv.shift ? " · " + SHIFT_LABEL[lv.shift] : "");
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
    // Mobile: do khong gian KHA DUNG THAT thay vi tru hao cung 240px.
    const areaW = (typeof gameArea !== "undefined" && gameArea.clientWidth) || winW;
    const frameW = areaW - 24; // tru padding ngang .wrap (mobile 12px moi ben)
    const fitW = Math.floor((frameW - 20) / C); // tru padding board-frame (6*2) + board (4*2)
    let top = 0;
    try { top = boardFrame.getBoundingClientRect().top || 0; } catch (e) {}
    let belowH = 0;
    const footEl = document.querySelector(".pikachu-app footer");
    if (footEl && footEl.style.display !== "none") belowH += footEl.offsetHeight + 28;
    if (resultBanner.classList.contains("show")) belowH += resultBanner.offsetHeight + 18;
    const availH = winH - top - 12 - belowH - 20; // 12: padding duoi wrap, 20: padding frame+board
    const fitH = Math.floor(availH / R);
    const size = Math.min(fitW, fitH);
    return Math.max(14, Math.min(64, size));
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
    if (pairsLeft <= 0) {
      if (elA) elA.classList.add("cleared");
      if (elB) elB.classList.add("cleared");
      winGame();
      return;
    }
    if (level.shift) {
      // Map khó: board rơi/dịch chuyển sau mỗi cặp nối rồi mới vẽ lại
      doBoardShift();
      renderBoard();
      clearSelectionClasses();
      selected = null;
    } else {
      if (elA) elA.classList.add("cleared");
      if (elB) elB.classList.add("cleared");
    }
    if (!hasAnyMove()) {
      // Bí đường sau khi nối (hoặc sau khi board rơi): thua luôn —
      // người chơi phải chủ động xáo TRƯỚC khi bí, game không tự cứu.
      setTimeout(() => loseGame("Hết đường nối! Nhớ xáo bài trước khi bí."), 400);
    }
  }, 140);
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
  const gap = 0;
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
   BOARD SHIFT (map khó): sau mỗi cặp nối, toàn bộ hình còn lại "rơi"
   theo trọng lực về 1 hướng — fixed: luôn rơi xuống; alternate: đảo
   lên/xuống qua lại; random: hướng ngẫu nhiên mỗi lần.
===================================================================== */
let shiftCount = 0; // đếm số lần đã shift trong ván hiện tại (cho alternate)
function applyGravity(dir) {
  if (dir === "down" || dir === "up") {
    for (let c = 0; c < C; c++) {
      const col = [];
      for (let r = 0; r < R; r++) if (grid[r][c] !== 0) col.push(grid[r][c]);
      for (let r = 0; r < R; r++) {
        if (dir === "down") grid[r][c] = (r < R - col.length) ? 0 : col[r - (R - col.length)];
        else grid[r][c] = (r < col.length) ? col[r] : 0;
      }
    }
  } else {
    for (let r = 0; r < R; r++) {
      const row = grid[r].filter(v => v !== 0);
      for (let c = 0; c < C; c++) {
        if (dir === "right") grid[r][c] = (c < C - row.length) ? 0 : row[c - (C - row.length)];
        else grid[r][c] = (c < row.length) ? row[c] : 0;
      }
    }
  }
}
function doBoardShift() {
  const mode = level.shift;
  let dir;
  if (mode === "fixed") dir = "down";
  else if (mode === "alternate") dir = (shiftCount % 2 === 0) ? "down" : "up";
  else dir = ["up", "down", "left", "right"][Math.floor(Math.random() * 4)];
  shiftCount++;
  applyGravity(dir);
  return dir;
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
  resultBanner.classList.remove("show", "lose");
  // Đánh dấu map đã qua; nếu đủ 80% pack thì mở pack tiếp theo
  const curPack = packOf(level.id);
  const nextPack = curPack + 1;
  const wasNextUnlocked = nextPack > packCount() || isPackUnlocked(nextPack);
  progress.completed[level.id] = true;
  // Lưu kỷ lục thời gian của map này
  const prevBest = progress.best[level.id];
  const isRecord = !prevBest || seconds < prevBest.time;
  if (isRecord) {
    progress.best[level.id] = { time: seconds };
  }
  saveProgress();
  const nowNextUnlocked = nextPack > packCount() || isPackUnlocked(nextPack);
  refreshMapGrid();
  // Popup chúc mừng giữa màn hình
  winSub.textContent = "Map " + level.id + " · " + TIER_LABEL[level.tier] + " · " + fmtTime(seconds);
  let note = "";
  if (isRecord) note += "🏆 Kỷ lục mới! ";
  if (!wasNextUnlocked && nowNextUnlocked) note += "🔓 Đã mở khóa Pack " + nextPack + "!";
  winNote.textContent = note;
  winNote.style.display = note ? "" : "none";
  const next = LEVELS.find(l => l.id > level.id && isLevelUnlocked(l.id));
  if (next) {
    winNext.textContent = "Map " + next.id + " →";
    winNext.style.display = "";
    winNext.onclick = () => { hideWinModal(); startLevel(next); };
  } else {
    winNext.style.display = "none";
  }
  winModal.style.display = "flex";
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