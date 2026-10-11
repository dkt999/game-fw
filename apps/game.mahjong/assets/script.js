/* =====================================================================
   MAHJONG SOLITAIRE — Xếp hình
   Luật: chỉ được chọn tile "tự do" (không bị đè + hở 1 bên trái/phải).
   Ăn 2 tile tự do giống nhau để gỡ. Dọn hết bàn thì thắng.
   Tận dụng tile SVG từ Pikachu: apps/game.pikachu/assets/titles/tileNNN.svg
===================================================================== */
"use strict";

/* ---------- Config ---------- */
const TILE_BASE = "./apps/game.pikachu/assets/titles/";
const TILE_COUNT = 200;
function tileSrc(n) { return TILE_BASE + "tile" + String(n).padStart(3, "0") + ".svg"; }

// Layout: các lớp hình chữ nhật xếp chồng, lớp trên thu nhỏ và căn giữa.
// layers: [{w,h}] — lớp 0 ở đáy.
const LAYOUTS = {
  easy:   { name: "Dễ", layers: [{ w: 10, h: 6 }, { w: 6, h: 4 }] },
  medium: { name: "Vừa", layers: [{ w: 12, h: 7 }, { w: 8, h: 5 }, { w: 4, h: 3 }] },
  hard:   { name: "Khó", layers: [{ w: 14, h: 8 }, { w: 10, h: 6 }, { w: 6, h: 4 }, { w: 2, h: 2 }] },
};
const DIFF_TILE_POOL = { easy: 60, medium: 120, hard: 200 }; // số hình khác nhau tối đa dùng
const DIFF_BOOST = { easy: { shuffles: 4, hints: 4 }, medium: { shuffles: 3, hints: 3 }, hard: { shuffles: 2, hints: 2 } };

/* ---------- State ---------- */
let tiles = [];        // {id,x,y,z,face,removed,free,el}
let selected = null;
let shufflesLeft = 0, hintsLeft = 0;
let pairsLeft = 0;
let timer = null, seconds = 0;
let diff = "medium";
let locked = false;

/* ---------- DOM ---------- */
const $ = s => document.querySelector(s);
const boardEl = $("#mj-board"), boardFrame = $("#mj-boardFrame");
const statTime = $("#mj-statTime"), statLeft = $("#mj-statLeft"), statDiff = $("#mj-statDiff");
const shuffleBadge = $("#mj-shuffleBadge"), hintBadge = $("#mj-hintBadge");

/* ---------- Layout & Deal ---------- */
function buildPositions(layout) {
  const pos = [];
  layout.layers.forEach((L, z) => {
    const below = layout.layers[0];
    const ox = Math.floor((below.w - L.w) / 2), oy = Math.floor((below.h - L.h) / 2);
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      pos.push({ x: x + ox, y: y + oy, z });
    }
  });
  return pos;
}

function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dealTiles() {
  const layout = LAYOUTS[diff];
  const pos = buildPositions(layout);
  if (pos.length % 2 !== 0) pos.pop(); // đảm bảo chẵn
  const pairCount = pos.length / 2;
  const poolSize = Math.min(DIFF_TILE_POOL[diff], TILE_COUNT, pairCount);

  // Thử deal tối đa 60 lần để có ít nhất 1 nước đi lúc mở màn
  for (let attempt = 0; attempt < 60; attempt++) {
    const faces = [];
    const codes = shuffleArr(Array.from({ length: TILE_COUNT }, (_, i) => i + 1)).slice(0, poolSize);
    // Mỗi cặp lấy 1 face; nếu cặp nhiều hơn pool thì dùng lại face (4 lá giống nhau vẫn ăn theo cặp)
    for (let i = 0; i < pairCount; i++) {
      const f = codes[i % poolSize];
      faces.push(f, f);
    }
    shuffleArr(faces);
    tiles = pos.map((p, i) => ({ id: i, x: p.x, y: p.y, z: p.z, face: faces[i], removed: false, free: false, el: null }));
    updateFreeStates();
    if (hasAnyMove()) {
      pairsLeft = pairCount;
      return;
    }
  }
  // Fallback: vẫn chơi được (có nút xáo cứu)
  pairsLeft = pairCount;
}

/* ---------- Luật tile tự do ---------- */
// Đơn giản: tự do = không bị tile nào đè lên (kể cả đè 1 phần).
// Kiểm tra bằng vùng hiển thị thực tế (getBoundingClientRect) để khớp với những gì người chơi nhìn thấy.
function rectsOverlap(a, b, minOverlap = 0.001) {
  const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  if (ix <= 0 || iy <= 0) return false;
  const area = (a.right - a.left) * (a.bottom - a.top);
  return (ix * iy) / area >= minOverlap; // đè >0% là tính (1 phần nghìn để tránh sai số)
}
function computeFree(t, list) {
  if (t.removed) return false;
  if (!t.el) {
    // Chưa render: fallback dùng lưới logic
    for (const o of list) {
      if (o.removed || o === t) continue;
      if (o.z === t.z + 1 && o.x === t.x && o.y === t.y) return false;
    }
    return true;
  }
  const tr = t.el.getBoundingClientRect();
  for (const o of list) {
    if (o.removed || o === t || !o.el) continue;
    if (o.z <= t.z) continue; // chỉ lớp trên mới đè được
    const or = o.el.getBoundingClientRect();
    if (rectsOverlap(tr, or)) return false; // bị đè (kể cả 1 phần)
  }
  return true;
}
function updateFreeStates() {
  for (const t of tiles) t.free = computeFree(t, tiles);
}
function hasAnyMove() {
  const seen = {};
  for (const t of tiles) {
    if (t.removed || !t.free) continue;
    if (seen[t.face]) return true;
    seen[t.face] = true;
  }
  return false;
}
function findOneMove() {
  const byFace = {};
  for (const t of tiles) {
    if (t.removed || !t.free) continue;
    if (byFace[t.face]) return [byFace[t.face], t];
    byFace[t.face] = t;
  }
  return null;
}

/* ---------- Render ---------- */
const BASE_TW = 54, BASE_TH = 70, GAP = 6, DEPTH = 16; // DEPTH: độ lệch mỗi lớp tạo chiều sâu (to để nhìn rõ)
function renderBoard() {
  boardEl.innerHTML = "";
  // Kích thước thiết kế
  let maxX = 0, maxY = 0, maxZ = 0;
  for (const t of tiles) {
    maxX = Math.max(maxX, t.x); maxY = Math.max(maxY, t.y); maxZ = Math.max(maxZ, t.z);
  }
  const needW = (maxX + 1) * (BASE_TW + GAP) + maxZ * DEPTH + GAP;
  const needH = (maxY + 1) * (BASE_TH + GAP) + maxZ * DEPTH + GAP;
  const availW = Math.max(200, boardFrame.clientWidth - 24);
  const availH = Math.max(200, boardFrame.clientHeight - 24);
  const scale = Math.min(availW / needW, availH / needH, 1.15);
  boardEl.style.width = needW + "px";
  boardEl.style.height = needH + "px";
  boardEl.style.transform = `scale(${scale})`;
  boardEl.style.transformOrigin = "center center";

  // Vẽ lớp dưới trước (z-index theo z)
  const sorted = [...tiles].sort((a, b) => (a.z - b.z) || (a.y - b.y) || (a.x - b.x));
  for (const t of sorted) {
    if (t.removed) continue;
    const el = document.createElement("div");
    el.className = "mj-tile" + (t.free ? " free" : " blocked");
    el.style.width = BASE_TW + "px";
    el.style.height = BASE_TH + "px";
    el.style.left = (t.x * (BASE_TW + GAP) + t.z * DEPTH) + "px";
    el.style.top = (t.y * (BASE_TH + GAP) + (maxZ - t.z) * DEPTH) + "px";
    el.style.zIndex = t.z * 100 + t.y * 10 + t.x;
    // Lớp càng cao càng sáng viền + bóng đổ đậm để thấy rõ đang đè lên lớp dưới
    el.style.boxShadow = `${2 + t.z * 2}px ${3 + t.z * 3}px 0 rgba(0,0,0,${0.35 + t.z * 0.12})`;
    el.style.borderColor = ["#b9a86a", "#d4b84a", "#e8c832", "#ffe066"][Math.min(t.z, 3)];
    const img = document.createElement("img");
    img.src = tileSrc(t.face);
    img.alt = "";
    el.appendChild(img);
    el.addEventListener("click", () => onTileClick(t));
    boardEl.appendChild(el);
    t.el = el;
  }
  if (selected) {
    const s = tiles.find(t => t.id === selected.id && !t.removed);
    if (s && s.el) s.el.classList.add("selected");
  }
  // Kiểm tra lại bằng vùng hiển thị thực tế (t.el đã có)
  updateFreeStates();
  refreshTileClasses();
  updateStats();
}
function refreshTileClasses() {
  for (const t of tiles) {
    if (!t.el || t.removed) continue;
    t.el.classList.toggle("free", t.free);
    t.el.classList.toggle("blocked", !t.free);
  }
}
function updateStats() {
  statTime.textContent = "⏱ " + fmtTime(seconds);
  statLeft.textContent = "🀄 " + tiles.filter(t => !t.removed).length;
  statDiff.textContent = LAYOUTS[diff].name;
  shuffleBadge.textContent = shufflesLeft;
  hintBadge.textContent = hintsLeft;
}
function fmtTime(s) {
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

/* ---------- Tương tác ---------- */
function onTileClick(t) {
  if (locked || t.removed || !t.free) return;
  if (!selected) {
    selected = t;
    t.el.classList.add("selected");
    return;
  }
  if (selected.id === t.id) {
    t.el.classList.remove("selected");
    selected = null;
    return;
  }
  if (selected.face === t.face) {
    const a = selected;
    selected = null;
    removePair(a, t);
  } else {
    if (selected.el) selected.el.classList.remove("selected");
    selected = t;
    t.el.classList.add("selected");
  }
}
function removePair(a, b) {
  locked = true;
  [a, b].forEach(t => t.el && t.el.classList.add("pop"));
  setTimeout(() => {
    a.removed = true; b.removed = true;
    if (a.el) a.el.remove(); if (b.el) b.el.remove();
    pairsLeft--;
    updateFreeStates();
    refreshTileClasses();
    locked = false;
    updateStats();
    if (pairsLeft <= 0) { winGame(); return; }
    if (!hasAnyMove()) {
      // Bí đường: báo để người chơi chủ động xáo (hoặc tự xáo nếu hết lượt? không — để họ quyết)
      setTimeout(() => {
        if (!hasAnyMove() && pairsLeft > 0) {
          if (shufflesLeft > 0) { doShuffle(true); }
          else loseGame("Bí đường và hết lượt xáo!");
        }
      }, 400);
    }
  }, 200);
}

/* ---------- Booster ---------- */
function doShuffle(auto) {
  if (locked || shufflesLeft <= 0) return;
  if (!auto && !confirm("Xáo trộn các hình còn lại?")) return;
  shufflesLeft--;
  const alive = tiles.filter(t => !t.removed);
  const faces = shuffleArr(alive.map(t => t.face));
  // Đảm bảo sau xáo có nước đi (thử tối đa 40 lần)
  for (let k = 0; k < 40; k++) {
    shuffleArr(faces);
    alive.forEach((t, i) => t.face = faces[i]);
    updateFreeStates();
    if (hasAnyMove()) break;
  }
  selected = null;
  renderBoard();
}
function useHint() {
  if (locked || hintsLeft <= 0) return;
  const mv = findOneMove();
  if (!mv) return;
  hintsLeft--;
  mv.forEach(t => {
    if (t.el) {
      t.el.classList.add("hint");
      setTimeout(() => t.el && t.el.classList.remove("hint"), 2000);
    }
  });
  updateStats();
}

/* ---------- Timer / Thắng thua ---------- */
function startTimer() {
  stopTimer();
  seconds = 0; updateStats();
  timer = setInterval(() => { seconds++; statTime.textContent = "⏱ " + fmtTime(seconds); }, 1000);
}
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
function winGame() {
  stopTimer();
  $("#mj-endEmoji").textContent = "🎉";
  $("#mj-endTitle").textContent = "Thắng rồi!";
  $("#mj-endSub").textContent = `${LAYOUTS[diff].name} · ${fmtTime(seconds)}`;
  $("#mj-endModal").style.display = "flex";
}
function loseGame(msg) {
  stopTimer();
  $("#mj-endEmoji").textContent = "😞";
  $("#mj-endTitle").textContent = "Thua rồi!";
  $("#mj-endSub").textContent = msg || "";
  $("#mj-endModal").style.display = "flex";
}

/* ---------- Ván mới / Menu ---------- */
function newGame() {
  $("#mj-endModal").style.display = "none";
  selected = null; locked = false;
  const b = DIFF_BOOST[diff];
  shufflesLeft = b.shuffles; hintsLeft = b.hints;
  dealTiles();
  renderBoard();
  startTimer();
}

/* ---------- Wire UI ---------- */
document.getElementById("mj-rulesBtn").addEventListener("click", () => $("#mj-rulesModal").style.display = "flex");
document.getElementById("mj-rulesClose").addEventListener("click", () => $("#mj-rulesModal").style.display = "none");
document.querySelectorAll(".diff-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".diff-btn").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    diff = btn.dataset.diff;
  });
});
document.getElementById("mj-startBtn").addEventListener("click", () => {
  $("#mj-mainMenu").style.display = "none";
  $("#mj-game").style.display = "flex";
  newGame();
});
document.getElementById("mj-btnClose").addEventListener("click", () => {
  stopTimer();
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
  const w = document.querySelector(".mahjong-app").closest(".window");
  if (w) w.style.display = "none";
});
document.getElementById("mj-btnHome").addEventListener("click", () => {
  stopTimer();
  $("#mj-endModal").style.display = "none";
  $("#mj-game").style.display = "none";
  $("#mj-mainMenu").style.display = "flex";
});
document.getElementById("mj-btnShuffle").addEventListener("click", () => doShuffle(false));
document.getElementById("mj-btnHint").addEventListener("click", useHint);
document.getElementById("mj-btnNew").addEventListener("click", () => { if (!locked) newGame(); });
document.getElementById("mj-againBtn").addEventListener("click", newGame);
document.getElementById("mj-menuBtn").addEventListener("click", () => {
  $("#mj-endModal").style.display = "none";
  $("#mj-game").style.display = "none";
  $("#mj-mainMenu").style.display = "flex";
});
window.addEventListener("resize", () => {
  if ($("#mj-game").style.display !== "none" && tiles.length) renderBoard();
});
