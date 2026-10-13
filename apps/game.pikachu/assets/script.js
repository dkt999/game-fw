(function(){
"use strict";

/* =====================================================================
   TILE ASSETS
   Toàn bộ hình nằm ở assets/titles/tile001.svg .. tile200.svg
   Muốn thêm hình mới: chỉ cần thêm file tileNNN.svg vào thư mục đó rồi
   tăng TILE_COUNT tương ứng — không cần sửa gì khác.
===================================================================== */
const TILE_COUNT = 200;
const TILE_STAR = 173;   // ⭐ (tạm chưa có effect, để sau)
const TILE_HEART = 186;  // 💚 ăn cặp này -> +60 giây
const TILE_BOMB = 164;   // 💣 ăn cặp này -> loại 1 cặp ngẫu nhiên (không cần hợp lệ)
const TILE_BASE_PATH = "./apps/game.pikachu/assets/titles/";
function tileSrc(n) {
  const v = (typeof window !== "undefined" && window.APP_VERSION) ? window.APP_VERSION : "1";
  return TILE_BASE_PATH + "tile" + String(n).padStart(3, "0") + ".svg?v=" + v;
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

    // Kích thước bàn: tăng dần trong 15 màn đầu (6x4=24 ô -> 22x16=352 ô),
    // từ màn 16 trở đi giữ nguyên FULL. Độ khó sau đó do shift + tỉ lệ trùng tile.
    const tb = Math.min(1, (i - 1) / 14); // 0 -> 1 trong 15 màn đầu
    let cols = Math.round(6 + tb * 16);
    let rows = Math.round(4 + tb * 12);
    if ((rows * cols) % 2 !== 0) cols += 1; // luôn cần số ô chẵn để chia cặp

    // Số bản sao mỗi hình: càng lên cao càng ít bản trùng (khó tìm hơn),
    // là thước đo độ khó chính sau khi board đã full từ màn 16.
    // 1-15: 6->5 bản | 16-200: 5->2 bản (giảm dần đều).
    let copies = Math.round(6 - t * 4);
    if (copies < 2) copies = 2;
    if (copies % 2 !== 0) copies -= 1;

    const totalCells = rows * cols;
    let variety = Math.floor(totalCells / copies);
    if (variety > TILE_COUNT) variety = TILE_COUNT;
    if (variety < 3) variety = 3;

    const shuffles = Math.max(1, Math.round(4 - t * 3));      // 4 -> 1 lần xáo (ít hơn = khó hơn)
    const hints = Math.max(1, Math.round(4 - t * 3));         // 4 -> 1 lượt gợi ý
    const removes = Math.max(1, Math.round(3 - t * 2));       // 3 -> 1 lượt gỡ cặp
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
      removes,
      timeLimit, // giây, 0 = không giới hạn
      timeBonusPerPair: tier === "expert" ? 5 : 0 // expert: mỗi cặp +5s
    });
  }
  EXTRA_LEVELS.forEach(x => {
    const idx = levels.findIndex(l => l.id === x.afterLevel);
    if (idx >= 0) levels.splice(idx + 1, 0, Object.assign({ id: levels.length + 1, tier: "expert" }, x.level));
  });
  // Chia đều hiệu ứng dịch chuyển theo độ khó (dễ -> khó):
  // 1-30 (Dễ): không shift | 31-60: rơi cố định | 61-90: đảo lên/xuống |
  // 91-120: đối xứng ngang | 121-150: đối xứng dọc | 151-200: ngẫu nhiên
  levels.forEach(l => {
    const id = l.id;
    if (id <= 30) l.shift = null;
    else if (id <= 60) l.shift = "fixed";
    else if (id <= 90) l.shift = "alternate";
    else if (id <= 120) l.shift = "symH";
    else if (id <= 150) l.shift = "symV";
    else l.shift = "random";
  });
  return levels;
}
const SHIFT_LABEL = { fixed: "Rơi ↓", alternate: "Rơi ↕", symH: "Đối xứng ↔", symV: "Đối xứng ↕", random: "Rơi ngẫu nhiên" };
const SHIFT_ICON = { fixed: "⬇️", alternate: "🔃", symH: "↔️", symV: "↕️", random: "🔀" };

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
function hideLoseModal() { loseModal.style.display = "none"; }
let viewPack = 0; // pack dang xem (0 = tu dong theo map vua choi)
const boardEl = document.getElementById("pkc-board");
const boardFrame = document.getElementById("pkc-boardFrame");
const linkLayer = document.getElementById("pkc-linkLayer");
let boardPad = 4; // padding động của board = margin cho đường nối đi ngoài
let isShuffling = false; // đang chạy hiệu ứng xáo -> khóa click tile
let isShifting = false; // đang chạy hiệu ứng dịch chuyển -> khóa click tile
const shuffleModal = document.getElementById("pkc-shuffleModal");
const hankoEl = document.getElementById("pkc-hanko");
const loseModal = document.getElementById("pkc-loseModal");
const loseSub = document.getElementById("pkc-loseSub");
const statTime = document.getElementById("pkc-statTime");
const shuffleBadge = document.getElementById("pkc-shuffleBadge");
const statMap = document.getElementById("pkc-statMap");
const hintBadge = document.getElementById("pkc-hintBadge");
const btnHint = document.getElementById("pkc-btnHint");
const btnShuffle = document.getElementById("pkc-btnShuffle");
const btnRemove = document.getElementById("pkc-btnRemove");
const removeBadge = document.getElementById("pkc-removeBadge");

/* =====================================================================
   GAME STATE
===================================================================== */
let level = null;
let grid = [];        // 0 = ô trống đã dọn, >0 = mã hình (1..variety)
let R = 0, C = 0;
let selected = null;   // {r,c}
let hintsLeft = 0;
let shufflesLeft = 0;
let removesLeft = 0;
let removeMode = false; // booster Gỡ cặp: bấm nút rồi chọn 2 hình giống nhau để xóa
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
      ? ("Map " + id + " · " + TIER_LABEL[lv.tier] + (best ? " · Kỷ lục " + fmtTime(best.time) : "") + (lv.shift ? " · " + SHIFT_LABEL[lv.shift] : ""))
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
document.getElementById("pkc-loseMenu").addEventListener("click", () => { hideLoseModal(); backToMenu(); });
document.getElementById("pkc-loseRetry").addEventListener("click", () => { hideLoseModal(); if (level) startLevel(level); });
btnShuffle.addEventListener("click", doShuffle);
btnHint.addEventListener("click", useHint);
btnRemove.addEventListener("click", () => {
  if (locked || isShuffling || isShifting || removesLeft <= 0) return;
  removeMode = !removeMode;
  btnRemove.classList.toggle("active", removeMode);
  if (removeMode) { clearSelectionClasses(); selected = null; }
});

function backToMenu() {
  stopTimer();
  pausedByRotate = false;
  hideWinModal();
  hideLoseModal();
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
const TARGET_TILE_PX = 48; // tile mong muốn trên mobile
const MIN_TILE_PX = Math.floor(TARGET_TILE_PX * 0.8); // 38: tile tối thiểu khi fill đầy khung
function computeAdaptiveShape(totalCells) {
  // ĐƠN GIẢN: dùng kích thước window (ổn định), trừ margin cố định.
  // Không đo element vì layout lúc mới mở chưa ổn định (toolbar/CSS chưa áp xong).
  const winW = window.innerWidth, winH = window.innerHeight;
  const availW = Math.max(200, winW - 130); // trừ toolbar dọc + padding/gap
  const availH = Math.max(120, winH - 20); // trừ titlebar + padding app
  // Board có margin 0.6 ô mỗi bên cho đường nối vòng ngoài -> kích thước thật
  // là (cols+1.2)*cell x (rows+1.2)*cell. Tính shape theo cell HIỆU DỤNG này.
  const MG = 1.2;
  const effCell = (r, c) => Math.min(availW / (c + MG), availH / (r + MG));
  // Fill đầy khung: làm tròn LÊN số hàng/cột, miễn tile không nhỏ hơn 80% target
  let rows = Math.ceil(availH / (TARGET_TILE_PX * 1.15));
  if (effCell(rows, 12) < MIN_TILE_PX) rows = Math.floor(availH / (TARGET_TILE_PX * 1.15));
  let cols = Math.ceil(availW / (TARGET_TILE_PX * 1.15));
  if (effCell(8, cols) < MIN_TILE_PX) cols = Math.floor(availW / (TARGET_TILE_PX * 1.15));
  rows = Math.max(4, rows);
  cols = Math.max(6, Math.min(40, cols));
  // Không dùng quá số ô của level: giảm chiều nào còn giữ tile to hơn
  let guard = 0;
  while (rows * cols > totalCells && (rows > 4 || cols > 6) && guard++ < 200) {
    const tRow = rows > 4 ? effCell(rows - 1, cols) : -1;
    const tCol = cols > 6 ? effCell(rows, cols - 1) : -1;
    if (tRow >= tCol && rows > 4) rows--;
    else if (cols > 6) cols--;
    else break;
  }
  // Tham lam mở rộng chiều đang trống nhiều hơn (tile vẫn >= 80% target, không vượt số ô level)
  for (let gi = 0; gi < 4; gi++) {
    const cell = effCell(rows, cols);
    const fillW = ((cols + MG) * cell) / availW, fillH = ((rows + MG) * cell) / availH;
    let grew = false;
    const tryGrow = (nr, nc) => {
      if (nr * nc > totalCells) return false;
      const ncell = effCell(nr, nc);
      if (ncell < MIN_TILE_PX) return false;
      const nfill = (((nc + MG) * ncell) * ((nr + MG) * ncell)) / (availW * availH);
      const ofill = (((cols + MG) * cell) * ((rows + MG) * cell)) / (availW * availH);
      if (nfill > ofill + 0.01) { rows = nr; cols = nc; return true; }
      return false;
    };
    if (fillW <= fillH) grew = tryGrow(rows, cols + 1) || tryGrow(rows + 1, cols);
    else grew = tryGrow(rows + 1, cols) || tryGrow(rows, cols + 1);
    if (!grew) break;
  }
  if ((rows * cols) % 2 !== 0) { if (cols < 40) cols++; else rows++; } // số ô chẵn
  return { rows, cols };
}

/* =====================================================================
   LEVEL START / BOARD GENERATION
===================================================================== */
const PKC_DEBUG = (function(){ try { return /[?&]pikachu_debug=1/.test(location.search); } catch(e){ return false; } })();
const PIKACHU_ROCKET_TEST = (function(){ try { return /[?&]pikachu_rocket=1/.test(location.search); } catch(e){ return false; } })();
let pkcDebugLog = [];
function pkcDebug(tag, info) {
  if (tag === "pre-shape" && !pkcDebug._v) {
    pkcDebug._v = true;
    try { pkcDebugLog.push("VER=" + (window.APP_VERSION || "?")); } catch(e){}
  }
  const line = new Date().toISOString().substr(11, 12) + " [" + tag + "] " + info;
  pkcDebugLog.push(line);
  if (pkcDebugLog.length > 30) pkcDebugLog.shift();
  try { console.log("[PKC-DBG]", line); } catch(e){}
  if (!PKC_DEBUG) return;
  const el = document.getElementById("pkc-debugPanel");
  if (el) { el.style.display = "block"; el.textContent = pkcDebugLog.join("\n"); }
}
let lastBoardWinW = 0, lastBoardWinH = 0; // kích thước window lúc dựng bàn
function startLevel(lv) {
  level = lv;
  progress.lastPlayed = lv.id;
  viewPack = packOf(lv.id);
  saveProgress();
  hideWinModal();
  hideLoseModal();
  mainMenu.style.display = "none";
  gameArea.style.display = "flex";
  updateRotateHint();
  buildLevelBoard(lv); // tính theo window (ổn định), không cần đợi layout
}
function buildLevelBoard(lv) {
  // Ẩn footer TRƯỚC khi đo để boardcol có chiều cao ổn định
  // (nếu đo lúc footer còn hiện, boardcol lùn hơn ~12px -> tính thiếu hàng)
  if (window.IS_MOBILE === true) {
    const footEl0 = document.querySelector(".pikachu-app footer");
    if (footEl0) footEl0.style.display = "none";
  }
  // Mobile: xoay tỉ lệ bàn theo màn hình; desktop: giữ shape gốc
  let shape = { rows: lv.rows, cols: lv.cols };
  pkcDebug("pre-shape", "lv#" + lv.id + " cells=" + lv.cells + " win=" + window.innerWidth + "x" + window.innerHeight);  if (window.IS_MOBILE === true && lv.cells) shape = computeAdaptiveShape(lv.cells);
  pkcDebug("post-shape", "R=" + shape.rows + " C=" + shape.cols + " cellPx=" + boardCellSize());
  R = shape.rows; C = shape.cols;
  hintsLeft = lv.hints;
  shufflesLeft = lv.shuffles;
  removesLeft = lv.removes || 0;
  removeMode = false;
  timeLimit = lv.timeLimit;
  seconds = 0;
  selected = null;
  locked = false;
  shiftCount = 0;

  grid = buildSolvedGrid(R, C, lv.variety, lv.copies, lv.tier);
  totalPairs = (R * C) / 2;
  pairsLeft = totalPairs;
  // Ván mới luôn có nước đi (xáo miễn phí đến khi có, không trừ lượt)
  for (let i = 0; i < 50 && !hasAnyMove(); i++) shuffleGrid();

  hankoEl.classList.remove("show");

  statMap.textContent = "#" + lv.id;
  document.getElementById("pkc-statTier").textContent = TIER_LABEL[lv.tier] + (lv.shift ? " " + SHIFT_ICON[lv.shift] : "");
  hintBadge.textContent = hintsLeft;
  shuffleBadge.textContent = shufflesLeft;
  removeBadge.textContent = removesLeft;
  renderBoard();
  startTimer();
  watchBoardResize();
  // Cheat test rocket: nhấp nháy vị trí tile164 trong 4s để dễ tìm
  if (PIKACHU_ROCKET_TEST) {
    setTimeout(() => {
      document.querySelectorAll(".tile").forEach(el => {
        const r = +el.dataset.r, c = +el.dataset.c;
        if (grid[r] && grid[r][c] === TILE_BOMB) {
          el.classList.add("hint");
          setTimeout(() => el.classList.remove("hint"), 4000);
        }
      });
    }, 300);
  }
}

// Tạo bàn cờ: chọn `variety` mã hình ngẫu nhiên trong 200 hình, lặp mỗi
// mã `copies` lần (bù thêm ngẫu nhiên cho đủ số ô chẵn), rồi xáo vị trí.
function buildSolvedGrid(rows, cols, variety, copies, tier) {
  const totalCells = rows * cols;
  const codes = [];
  for (let i = 1; i <= TILE_COUNT; i++) codes.push(i);
  shuffleArray(codes);
  const chosen = codes.slice(0, variety);
  // Map Chuyên gia: luôn có tile đặc biệt (sao 173, tim 186, bom 164).
  // Pool lấy tile từ đầu mảng chosen -> đưa đặc biệt lên đầu cho chắc chắn có mặt.
  // Cheat ?pikachu_rocket=1: ép bom 164 vào mọi màn để test tên lửa.
  if (tier === "expert" || PIKACHU_ROCKET_TEST) {
    [TILE_STAR, TILE_HEART, TILE_BOMB].forEach(sp => {
      const at = chosen.indexOf(sp);
      if (at >= 0) chosen.splice(at, 1);
      chosen.unshift(sp);
    });
  }

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
  const cellPx = boardCellSize();
  boardPad = Math.ceil(cellPx * 0.6); // margin cho đường nối vòng ngoài board
  boardEl.style.gridTemplateColumns = `repeat(${C}, minmax(0,1fr))`;
  boardEl.style.gridTemplateRows = `repeat(${R}, minmax(0,1fr))`;
  boardEl.style.padding = boardPad + "px";
  boardEl.style.width = (cellPx * C + boardPad * 2) + "px";
  boardEl.style.height = (cellPx * R + boardPad * 2) + "px";

  let html = "";
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const code = grid[r][c];
      if (code === 0) {
        html += `<div class="tile cleared" data-r="${r}" data-c="${c}"></div>`;
      } else {
        const sp = (code === TILE_STAR || code === TILE_HEART || code === TILE_BOMB) ? " special" : "";
        html += `<div class="tile${sp}" data-r="${r}" data-c="${c}"><img src="${tileSrc(code)}" draggable="false" alt=""></div>`;
      }
    }
  }
  boardEl.innerHTML = html;
  boardEl.appendChild(linkLayer); // innerHTML xoá mất link-layer -> gắn lại
}

function boardCellSize() {
  // Lấy kích thước của .window (class cha chứa cả app) thay vì hằng số cố định.
  const winEl = boardFrame.closest(".window") || boardFrame.closest(".window-content") || boardFrame.parentElement;
  const winW = winEl ? winEl.clientWidth : window.innerWidth;
  const winH = winEl ? winEl.clientHeight : window.innerHeight;

  if (window.IS_MOBILE === true) {
    // Đơn giản: dùng window trừ margin cố định (ổn định, không phụ thuộc layout)
    const availW = window.innerWidth - 130;
    const availH = window.innerHeight - 20;
    const fitW = Math.floor(availW / (C + 1.2)); // +1.2 ô margin đường nối
    const fitH = Math.floor(availH / (R + 1.2));
    const size = Math.min(fitW, fitH);
    return Math.max(14, Math.min(64, size));
  }

  // Desktop: cho bàn cờ chiếm tới 80% chiều rộng/cao của window.
  const availW = (winW * 0.8) - 40; // trừ hao padding/border của board-frame
  const availH = (winH * 0.8) - 40;

  const size = Math.floor(Math.min(availW / (C + 1.2), availH / (R + 1.2))); // +1.2 o margin duong noi
  return Math.max(22, size); // bỏ trần 52px để ô hình lớn theo window
}

boardEl.addEventListener("click", (e) => {
  const tileEl = e.target.closest(".tile");
  if (!tileEl || locked || isShuffling || isShifting) return;
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
  // Booster Gỡ cặp: 2 hình giống nhau -> xóa luôn, không cần nối được
  if (removeMode) {
    removesLeft--;
    removeBadge.textContent = removesLeft;
    removeMode = false;
    btnRemove.classList.remove("active");
    clearSelectionClasses();
    selected = null;
    const code = grid[a.r][a.c];
    const elA = boardEl.querySelector(`.tile[data-r="${a.r}"][data-c="${a.c}"]`);
    const elB = boardEl.querySelector(`.tile[data-r="${b.r}"][data-c="${b.c}"]`);
    [elA, elB].forEach(el => el && el.classList.add("pop"));
    setTimeout(() => {
      grid[a.r][a.c] = 0; grid[b.r][b.c] = 0;
      pairsLeft--;
      // Kích hoạt effect tile đặc biệt nếu gỡ trúng (bom/tim)
      if (code === TILE_BOMB) {
        const bonus = findRandomPair();
        if (bonus && pairsLeft > 0) {
          grid[bonus.p1.r][bonus.p1.c] = 0; grid[bonus.p2.r][bonus.p2.c] = 0;
          pairsLeft--;
        }
      }
      if (code === TILE_HEART && timeLimit > 0) { seconds = Math.max(0, seconds - 60); }
      if (level.shift) {
        const oldCenters = captureTileCenters();
        doBoardShift();
        renderBoard();
        isShifting = true;
        animateShiftTiles(oldCenters, () => { isShifting = false; });
      } else {
        renderBoard();
      }
      if (pairsLeft <= 0) winGame();
      else if (!hasAnyMove()) {
        setTimeout(() => {
          if (hasAnyMove()) return;
          if (!autoRescueShuffle()) loseGame("Bí đường hoàn toàn, xáo mãi không ra nước đi!");
        }, 450);
      }
    }, 140);
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

/* Chữ +Ns bay lên khi được cộng giờ */
function showTimeBonus(text) {
  const el = document.createElement("div");
  el.className = "time-bonus";
  el.textContent = text;
  boardFrame.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}
/* Tìm 1 cặp ngẫu nhiên còn trên bàn (cho hiệu ứng sao) */
function findRandomPair() {
  const byCode = {};
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const code = grid[r][c];
    if (code !== 0) (byCode[code] = byCode[code] || []).push({ r, c });
  }
  const codes = Object.keys(byCode).filter(k => byCode[k].length >= 2);
  if (!codes.length) return null;
  const arr = byCode[codes[Math.floor(Math.random() * codes.length)]];
  const i = Math.floor(Math.random() * arr.length);
  let j = Math.floor(Math.random() * (arr.length - 1));
  if (j >= i) j++;
  return { p1: arr[i], p2: arr[j] };
}
/* Tên lửa tile164: tách khỏi tile, xoay hướng rồi bay tới cặp bị loại */
function launchRocket(from, to, onArrive) {
  const DUR = 650;
  const el = document.createElement("div");
  el.className = "rocket-projectile";
  el.textContent = "🚀";
  const dx = to.x - from.x, dy = to.y - from.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const rot = angle + 45; // emoji 🚀 chỉ hướng đông-bắc (-45°)
  const SZ = 38;
  el.style.transform = `translate(${from.x - SZ/2}px, ${from.y - SZ/2}px) rotate(${rot}deg)`;
  boardEl.appendChild(el);
  el.offsetHeight; // ép reflow
  el.style.transition = `transform ${DUR}ms cubic-bezier(.3,.7,.4,1)`;
  el.style.transform = `translate(${to.x - SZ/2}px, ${to.y - SZ/2}px) rotate(${rot}deg)`;
  setTimeout(() => { el.remove(); if (onArrive) onArrive(); }, DUR + 40);
}
function tileCenter(r, c) {
  const el = boardEl.querySelector(`.tile[data-r="${r}"][data-c="${c}"]`);
  if (!el) return null;
  const br = boardEl.getBoundingClientRect(), rc = el.getBoundingClientRect();
  return { x: rc.left - br.left + rc.width / 2, y: rc.top - br.top + rc.height / 2 };
}
function resolveMatch(a, b, path) {
  drawLinkPath(path);
  const code = grid[a.r][a.c];
  // Map Expert: mỗi cặp +5s
  if (timeLimit > 0 && level.timeBonusPerPair) {
    timeLimit += level.timeBonusPerPair;
    updateTimeDisplay();
    showTimeBonus("+" + level.timeBonusPerPair + "s");
  }
  // Tile tim: +60s
  if (code === TILE_HEART && timeLimit > 0) {
    timeLimit += 60;
    updateTimeDisplay();
    showTimeBonus("+1:00");
  }
  const elA = boardEl.querySelector(`.tile[data-r="${a.r}"][data-c="${a.c}"]`);
  const elB = boardEl.querySelector(`.tile[data-r="${b.r}"][data-c="${b.c}"]`);
  [elA, elB].forEach(el => el && el.classList.add("pop"));
  grid[a.r][a.c] = 0;
  grid[b.r][b.c] = 0;
  pairsLeft--;
  // (Tile sao 173: tạm bỏ effect xóa cặp để không trùng với bom 164)
  // Tile bom (164): chẻ 2 tên lửa, mỗi cái bay tới 1 tile của cặp ngẫu nhiên rồi nổ
  if (code === TILE_BOMB && pairsLeft > 0) {
    const rb = findRandomPair();
    if (rb) {
      const from = tileCenter(a.r, a.c) || tileCenter(b.r, b.c);
      const t1 = tileCenter(rb.p1.r, rb.p1.c), t2 = tileCenter(rb.p2.r, rb.p2.c);
      if (from && t1 && t2) {
        isShifting = true; // khóa click trong lúc tên lửa bay
        let arrived = 0;
        const onOneArrive = () => {
          if (++arrived < 2) return;
          const be1 = boardEl.querySelector(`.tile[data-r="${rb.p1.r}"][data-c="${rb.p1.c}"]`);
          const be2 = boardEl.querySelector(`.tile[data-r="${rb.p2.r}"][data-c="${rb.p2.c}"]`);
          [be1, be2].forEach(el => el && el.classList.add("pop"));
          grid[rb.p1.r][rb.p1.c] = 0;
          grid[rb.p2.r][rb.p2.c] = 0;
          pairsLeft--;
          isShifting = false;
          setTimeout(() => afterMatch([elA, elB, be1, be2]), 140);
        };
        launchRocket(from, t1, onOneArrive);
        setTimeout(() => launchRocket(from, t2, onOneArrive), 130); // lệch pha cho đẹp
        return; // đợi 2 tên lửa tới rồi mới chạy afterMatch
      }
    }
  }
  const clearEls = [elA, elB];
  setTimeout(() => afterMatch(clearEls), 140);
}
/* Sau khi ăn cặp (và bom nổ xong nếu có): thắng / rơi board / kiểm tra bí */
function afterMatch(clearEls) {
  if (pairsLeft <= 0) {
    clearEls.forEach(el => el && el.classList.add("cleared"));
    winGame();
    return;
  }
  if (level.shift) {
    // Map khó: board rơi/dịch chuyển sau mỗi cặp nối, tile trượt tới vị trí mới
    const oldCenters = captureTileCenters();
    doBoardShift();
    renderBoard();
    clearSelectionClasses();
    selected = null;
    isShifting = true;
    animateShiftTiles(oldCenters, () => { isShifting = false; });
  } else {
    clearEls.forEach(el => el && el.classList.add("cleared"));
  }
  if (!hasAnyMove()) {
    // Bí đường sau khi nối (hoặc sau khi board rơi): tự động xáo miễn phí cứu ván
    setTimeout(() => {
      if (hasAnyMove()) return; // đã có nước (tự xáo tay trong lúc chờ)
      if (!autoRescueShuffle()) loseGame("Bí đường hoàn toàn, xáo mãi không ra nước đi!");
    }, 450);
  }
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
  const toXY = (p) => ({
    x: boardPad + (p.c + 0.5) * cellPx,
    y: boardPad + (p.r + 0.5) * cellPx
  });
  const pts = path.map(toXY);
  const d = "M " + pts.map(p => `${p.x},${p.y}`).join(" L ");
  const W = C * cellPx + boardPad * 2, H = R * cellPx + boardPad * 2;
  linkLayer.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><path class="link-path" d="${d}"/></svg>`;
  setTimeout(() => { linkLayer.innerHTML = ""; }, 420);
}

/* =====================================================================
   BOARD SHIFT (map khó): sau mỗi cặp nối, toàn bộ hình còn lại "rơi"
   theo trọng lực về 1 hướng — fixed: luôn rơi xuống; alternate: đảo
   lên/xuống qua lại; random: hướng ngẫu nhiên mỗi lần.
===================================================================== */
let shiftCount = 0; // đếm số lần đã shift trong ván hiện tại (cho alternate)
/* Dịch chuyển đối xứng ngang: nửa trái dồn ra trái, nửa phải dồn ra phải */
function applySymH() {
  const midL = Math.floor(C / 2);
  for (let r = 0; r < R; r++) {
    const left = [];
    for (let c = 0; c < midL; c++) if (grid[r][c] !== 0) left.push(grid[r][c]);
    for (let c = 0; c < midL; c++) grid[r][c] = (c < left.length) ? left[c] : 0;
    const right = [];
    for (let c = midL; c < C; c++) if (grid[r][c] !== 0) right.push(grid[r][c]);
    for (let c = midL; c < C; c++) {
      const idx = c - (C - right.length);
      grid[r][c] = (idx >= 0) ? right[idx] : 0;
    }
  }
}
/* Dịch chuyển đối xứng dọc: nửa trên dồn lên trên, nửa dưới dồn xuống dưới */
function applySymV() {
  const midT = Math.floor(R / 2);
  for (let c = 0; c < C; c++) {
    const top = [];
    for (let r = 0; r < midT; r++) if (grid[r][c] !== 0) top.push(grid[r][c]);
    for (let r = 0; r < midT; r++) grid[r][c] = (r < top.length) ? top[r] : 0;
    const bot = [];
    for (let r = midT; r < R; r++) if (grid[r][c] !== 0) bot.push(grid[r][c]);
    for (let r = midT; r < R; r++) {
      const idx = r - (R - bot.length);
      grid[r][c] = (idx >= 0) ? bot[idx] : 0;
    }
  }
}
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
/* Chụp tâm các tile hiện tại (để làm hiệu ứng bay) */
function captureTileCenters() {
  const br = boardEl.getBoundingClientRect();
  return [...boardEl.querySelectorAll(".tile:not(.cleared)")].map(el => {
    const r = el.getBoundingClientRect();
    return { x: r.left - br.left + r.width / 2, y: r.top - br.top + r.height / 2 };
  });
}
/* Hiệu ứng tile trượt từ vị trí cũ (gần nhất) tới vị trí mới sau khi dịch chuyển */
function animateShiftTiles(oldCenters, onDone) {
  const DUR = 450;
  const newTiles = [...boardEl.querySelectorAll(".tile:not(.cleared)")];
  const nr = boardEl.getBoundingClientRect();
  const used = new Set();
  newTiles.forEach(el => {
    const r = el.getBoundingClientRect();
    const nx = r.left - nr.left + r.width / 2, ny = r.top - nr.top + r.height / 2;
    let bi = -1, bd = Infinity;
    for (let i = 0; i < oldCenters.length; i++) {
      if (used.has(i)) continue;
      const oc = oldCenters[i], d = (oc.x - nx) * (oc.x - nx) + (oc.y - ny) * (oc.y - ny);
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi >= 0) used.add(bi);
    const from = bi >= 0 ? oldCenters[bi] : { x: nx, y: ny };
    el.style.transition = "none";
    el.style.transform = `translate(${from.x - nx}px,${from.y - ny}px)`;
  });
  boardEl.offsetHeight; // ép reflow
  newTiles.forEach(el => {
    el.style.transition = `transform ${DUR}ms cubic-bezier(.25,.8,.3,1)`;
    el.style.transform = "translate(0,0)";
  });
  setTimeout(() => {
    newTiles.forEach(el => { el.style.transition = ""; el.style.transform = ""; });
    if (onDone) onDone();
  }, DUR + 60);
}
function doBoardShift() {
  const mode = level.shift;
  shiftCount++;
  if (mode === "symH") { applySymH(); return "symH"; }
  if (mode === "symV") { applySymV(); return "symV"; }
  let dir;
  if (mode === "fixed") dir = "down";
  else if (mode === "alternate") dir = (shiftCount % 2 === 0) ? "down" : "up";
  else dir = ["up", "down", "left", "right"][Math.floor(Math.random() * 4)];
  applyGravity(dir);
  return dir;
}

/* =====================================================================
   SHUFFLE / HINT
===================================================================== */
function shuffleGrid() {
  const remaining = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (grid[r][c] !== 0) remaining.push(grid[r][c]);
  shuffleArray(remaining);
  let k = 0;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (grid[r][c] !== 0) grid[r][c] = remaining[k++];
}
function showShuffleModal() { if (shuffleModal) shuffleModal.style.display = "flex"; }
function hideShuffleModal() { if (shuffleModal) shuffleModal.style.display = "none"; }
/* Hiệu ứng xáo: modal "Đang xáo..." + tile bay từ vị trí cũ sang mới trong ~1s.
   fn() thực hiện xáo grid + renderBoard (đồng bộ) ở giữa. */
function performShuffleVisualThen(fn, onDone) {
  const DUR = 900;
  isShuffling = true;
  showShuffleModal();
  // Chụp vị trí cũ
  const boardRect = boardEl.getBoundingClientRect();
  const oldTiles = [...boardEl.querySelectorAll('.tile:not(.cleared)')];
  const oldCenters = oldTiles.map(el => {
    const r = el.getBoundingClientRect();
    return { x: r.left - boardRect.left + r.width / 2, y: r.top - boardRect.top + r.height / 2 };
  });
  const order = oldCenters.map((_, i) => i);
  shuffleArray(order);
  // Xáo thật + vẽ lại
  fn();
  // Bay từ vị trí cũ ngẫu nhiên tới vị trí mới
  const newTiles = [...boardEl.querySelectorAll('.tile:not(.cleared)')];
  const nr = boardEl.getBoundingClientRect();
  newTiles.forEach((el, i) => {
    const from = oldCenters[order[i % order.length]];
    const r = el.getBoundingClientRect();
    const dx = from.x - (r.left - nr.left + r.width / 2);
    const dy = from.y - (r.top - nr.top + r.height / 2);
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px,${dy}px) scale(.55)`;
    el.style.opacity = ".35";
  });
  boardEl.offsetHeight; // ép reflow
  newTiles.forEach(el => {
    el.style.transition = `transform ${DUR}ms cubic-bezier(.2,.8,.25,1), opacity ${DUR}ms`;
    el.style.transform = "translate(0,0) scale(1)";
    el.style.opacity = "1";
  });
  setTimeout(() => {
    newTiles.forEach(el => { el.style.transition = ""; el.style.transform = ""; el.style.opacity = ""; });
    hideShuffleModal();
    isShuffling = false;
    if (onDone) onDone();
  }, DUR + 80);
}
function doShuffle() {
  if (locked || isShuffling || shufflesLeft <= 0) return;
  shufflesLeft--;
  shuffleBadge.textContent = shufflesLeft;
  performShuffleVisualThen(() => {
    shuffleGrid();
    renderBoard();
    clearSelectionClasses();
    selected = null;
  }, () => {
    if (!hasAnyMove() && !autoRescueShuffle()) loseGame();
  });
}
/* Bí đường sau khi nối: tự động xáo MIỄN PHÍ đến khi có nước đi (không trừ lượt xáo) */
function autoRescueShuffle() {
  if (locked || isShuffling) return true; // đang xáo/busy -> bỏ qua, coi như đã cứu
  let found = false;
  for (let i = 0; i < 50; i++) {
    shuffleGrid();
    if (hasAnyMove()) { found = true; break; }
  }
  if (!found) return false; // xáo 50 lần vẫn bí -> thực sự hết cứu
  performShuffleVisualThen(() => {
    renderBoard();
    clearSelectionClasses();
    selected = null;
  });
  return true;
}

function useHint() {
  if (locked || hintsLeft <= 0) return;
  const move = findOneMove();
  if (!move) {
    // Bí mà auto-xáo không kịp chạy: bấm Gợi ý thì xáo cứu luôn (không trừ lượt hint)
    autoRescueShuffle();
    return;
  }
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
  loseSub.textContent = (reason || "Hết cách nối và hết lượt xáo bài.")
    + " · Map " + level.id + " · Còn lại " + pairsLeft + " cặp.";
  loseModal.style.display = "flex";
}

})();