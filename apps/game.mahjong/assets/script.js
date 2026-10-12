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

/* ---------- Hệ thống Pack/Map (10 pack x 10 map) ---------- */
// Ý tưởng của fen: board có 2 vùng — vùng CAO TẦNG (nhiều lớp, khó) và vùng HỖ TRỢ (1 lớp, dễ).
// Càng lên pack cao: càng nhiều tháp cao tầng, vùng hỗ trợ càng mỏng, tile càng nhiều loại.
const PACK_COUNT = 10, MAPS_PER_PACK = 10, TOTAL_MAPS = 100;
const BOARD_W = 12, BOARD_H = 8; // lưới cơ sở

// Seeded RNG để mỗi map luôn sinh cùng 1 layout
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Archetype map (mỗi map 1 chiến thuật) ---------- */
// Mỗi archetype là 1 ý đồ thiết kế riêng, không random vô định.
// Helper: thêm pos không trùng (cùng x,y,z)
function addPos(set, pos, x, y, z) {
  const k = x + "," + y + "," + z;
  if (!set.has(k)) { set.add(k); pos.push({ x, y, z }); }
}
function rectCells(set, pos, ox, oy, w, h, z) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) addPos(set, pos, ox + x, oy + y, z);
}
function pyramidCells(set, pos, ox, oy, w, h, layers) {
  for (let z = 0; z < layers; z++) {
    const sh = Math.floor(z / 2), ww = w - sh * 2, hh = h - sh * 2;
    if (ww < 2 || hh < 2) break;
    rectCells(set, pos, ox + sh, oy + sh, ww, hh, z);
  }
}

const ARCHETYPES = [
  { id: "flat", name: "Mặt phẳng",
    desc: "Chỉ 1 lớp phẳng — làm quen cách ăn cặp",
    gen(W, H, diff, rng, set, pos) {
      // Map 1-2: hình chữ nhật phẳng, to dần
      const w = 8 + Math.round(diff * 4), h = 5 + Math.round(diff * 2);
      rectCells(set, pos, Math.floor((W - w) / 2), Math.floor((H - h) / 2), w, h, 0);
    } },
  { id: "flat-tower", name: "Tháp đơn",
    desc: "Mặt phẳng + 1-2 tháp thấp — học cách gỡ lớp trên",
    gen(W, H, diff, rng, set, pos) {
      rectCells(set, pos, 0, 0, W, H, 0); // đáy phẳng
      const n = 1 + (diff > 0.05 ? 1 : 0); // map 3: 1 tháp, map 4-5: 2 tháp
      for (let i = 0; i < n; i++) {
        const tw = 3, th = 3;
        const ox = 2 + i * (W - 4 - tw), oy = Math.floor((H - th) / 2);
        pyramidCells(set, pos, ox, oy, tw, th, 2); // chỉ 2 lớp
      }
    } },
  { id: "fortress", name: "Pháo đài",
    desc: "Tháp đa tầng ở giữa, 4 cánh hỗ trợ đánh vào",
    gen(W, H, diff, rng, set, pos) {
      const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
      // 4 cánh hỗ trợ (1 lớp) — Bắc/Nam/Đông/Tây
      rectCells(set, pos, cx - 2, 0, 4, 2, 0);       // Bắc
      rectCells(set, pos, cx - 2, H - 2, 4, 2, 0);   // Nam
      rectCells(set, pos, 0, cy - 2, 2, 4, 0);       // Tây
      rectCells(set, pos, W - 2, cy - 2, 2, 4, 0);   // Đông
      // Tháp trung tâm đa tầng
      pyramidCells(set, pos, cx - 2, cy - 2, 4, 4, 3 + Math.round(diff * 2));
    } },
  { id: "twin", name: "Song tháp",
    desc: "2 tháp 2 bên, cầu nối ở giữa",
    gen(W, H, diff, rng, set, pos) {
      const cy = Math.floor(H / 2), layers = 3 + Math.round(diff * 2);
      pyramidCells(set, pos, 1, cy - 2, 4, 4, layers);          // tháp trái
      pyramidCells(set, pos, W - 5, cy - 2, 4, 4, layers);      // tháp phải
      rectCells(set, pos, 5, cy - 1, W - 10, 2, 0);             // cầu nối
    } },
  { id: "pyramid", name: "Kim tự tháp",
    desc: "1 kim tự tháp lớn ở giữa",
    gen(W, H, diff, rng, set, pos) {
      const w = 8, h = 6, layers = 4 + Math.round(diff * 2);
      pyramidCells(set, pos, Math.floor((W - w) / 2), Math.floor((H - h) / 2), w, h, layers);
    } },
  { id: "scatter", name: "Rải rác",
    desc: "Nhiều tháp nhỏ rải khắp board",
    gen(W, H, diff, rng, set, pos) {
      const n = 4 + Math.round(diff * 3); // 4-7 tháp
      for (let i = 0; i < n; i++) {
        const tw = 3 + Math.floor(rng() * 2), th = 3 + Math.floor(rng() * 2);
        const ox = Math.floor(rng() * (W - tw + 1)), oy = Math.floor(rng() * (H - th + 1));
        pyramidCells(set, pos, ox, oy, tw, th, 2 + Math.round(rng() * diff * 2));
      }
      // Lớp đáy mỏng hỗ trợ
      for (let k = 0; k < 20; k++) {
        const x = Math.floor(rng() * W), y = Math.floor(rng() * H);
        addPos(set, pos, x, y, 0);
      }
    } },
  { id: "ring", name: "Vòng vây",
    desc: "Vành ngoài hỗ trợ, tháp trong bị vây",
    gen(W, H, diff, rng, set, pos) {
      // Vành ngoài (1 lớp, có lỗ giữa)
      const x1 = 0, x2 = W - 1, y1 = 0, y2 = H - 1;
      const hx1 = 3, hx2 = W - 4, hy1 = 2, hy2 = H - 3;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (x >= hx1 && x <= hx2 && y >= hy1 && y <= hy2) continue;
        addPos(set, pos, x, y, 0);
      }
      // Tháp trong
      const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
      pyramidCells(set, pos, cx - 2, cy - 2, 4, 4, 3 + Math.round(diff * 2));
    } },
  { id: "cross", name: "Chữ thập",
    desc: "Chữ thập + tháp trung tâm",
    gen(W, H, diff, rng, set, pos) {
      const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
      rectCells(set, pos, 0, cy - 1, W, 2, 0); // ngang
      rectCells(set, pos, cx - 1, 0, 2, H, 0); // dọc
      pyramidCells(set, pos, cx - 2, cy - 2, 4, 4, 3 + Math.round(diff * 2)); // tháp giữa
    } },
];
// 6 archetype chính (từ map 6 trở đi)
const ARCHETYPES_MAIN = ARCHETYPES.filter(a => a.id !== "flat" && a.id !== "flat-tower");
// Mỗi map 1 kiểu: 5 map đầu học thế cơ bản, từ map 6 xoay vòng 6 archetype chính
function mapArchetype(mapNum) {
  if (mapNum <= 2) return ARCHETYPES[0]; // flat
  if (mapNum <= 5) return ARCHETYPES[1]; // flat-tower
  return ARCHETYPES_MAIN[(mapNum - 6) % ARCHETYPES_MAIN.length];
}

// Sinh layout cho map: trả về mảng {x,y,z} — mỗi map 1 archetype (xoay vòng)
function generateMapLayout(pack, mapIdx) {
  const mapNum = (pack - 1) * MAPS_PER_PACK + mapIdx;
  const t = (pack - 1) / (PACK_COUNT - 1);
  const tm = (mapIdx - 1) / (MAPS_PER_PACK - 1);
  const diff = Math.min(1, t * 0.85 + tm * 0.15);
  const rng = mulberry32(mapNum * 7919 + 13);
  const arch = mapArchetype(mapNum);
  const set = new Set(), pos = [];
  arch.gen(BOARD_W, BOARD_H, diff, rng, set, pos);
  if (pos.length % 2 !== 0) pos.pop();
  return pos;
}
// Tên kiểu map hiện tại (hiển thị)
function curShapeName() {
  const mapNum = (curPack - 1) * MAPS_PER_PACK + curMapIdx;
  return mapArchetype(mapNum).name;
}

// Thông số theo pack
function packParams(pack) {
  const t = (pack - 1) / (PACK_COUNT - 1);
  return {
    name: "Pack " + pack,
    tilePool: Math.round(40 + t * 110),              // 40 -> 150 loại hình
    shuffles: Math.max(2, Math.round(4 - t * 2)),    // 4 -> 2
    hints: Math.max(2, Math.round(4 - t * 2)),       // 4 -> 2
  };
}

// Tiến trình: map cao nhất đã mở (1-100)
const PROG_KEY = "mahjong-progress-v1";
function getProgress() {
  try { return Math.max(1, Math.min(TOTAL_MAPS, parseInt(localStorage.getItem(PROG_KEY) || "1", 10))); }
  catch (e) { return 1; }
}
function setProgress(n) {
  try { localStorage.setItem(PROG_KEY, String(Math.max(1, Math.min(TOTAL_MAPS, n)))); } catch (e) {}
}
function mapToPack(m) { return { pack: Math.ceil(m / MAPS_PER_PACK), idx: ((m - 1) % MAPS_PER_PACK) + 1 }; }

/* ---------- State ---------- */
let tiles = [];        // {id,x,y,z,face,removed,free,el}
let selected = null;
let shufflesLeft = 0, hintsLeft = 0;
let pairsLeft = 0;
let timer = null, seconds = 0;
let curPack = 1, curMapIdx = 1, curMapNum = 1;
let locked = false;

/* ---------- DOM ---------- */
const $ = s => document.querySelector(s);
const boardEl = $("#mj-board"), boardFrame = $("#mj-boardFrame");
const statTime = $("#mj-statTime"), statLeft = $("#mj-statLeft"), statDiff = $("#mj-statDiff");
const shuffleBadge = $("#mj-shuffleBadge"), hintBadge = $("#mj-hintBadge");

/* ---------- Layout & Deal ---------- */
function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dealTiles() {
  const pos = generateMapLayout(curPack, curMapIdx);
  const pairCount = pos.length / 2;
  const params = packParams(curPack);
  const poolSize = Math.min(params.tilePool, TILE_COUNT, pairCount);

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
  statDiff.textContent = "P" + curPack + "-" + curMapIdx + " · " + curShapeName();
  shuffleBadge.textContent = shufflesLeft;
  hintBadge.textContent = hintsLeft;
  updateMoveWarning();
}
/* Đếm số cặp có thể gỡ (mỗi face có N tile tự do -> floor(N/2) nước) */
function countAvailableMoves() {
  const cnt = {};
  for (const t of tiles) {
    if (t.removed || !t.free) continue;
    cnt[t.face] = (cnt[t.face] || 0) + 1;
  }
  let moves = 0;
  for (const k in cnt) moves += Math.floor(cnt[k] / 2);
  return moves;
}
/* Kiểm tra 1 tile có bị tile khác đè không (dùng visual) */
function isCoveredBy(t, o) {
  if (!t.el || !o.el || o.removed || o.z <= t.z) return false;
  return rectsOverlap(t.el.getBoundingClientRect(), o.el.getBoundingClientRect());
}
/* Phát hiện BÍ THẬT: có face không thể gỡ hết được.
   Ví dụ: 2 tile giống nhau đè lên nhau — không bao giờ chọn được cả 2.
   Tổng quát: nếu 1 face còn tile mà tất cả đường gỡ đều bị chặn bởi chính face đó. */
function isDeadlocked() {
  const byFace = {};
  for (const t of tiles) {
    if (t.removed) continue;
    (byFace[t.face] = byFace[t.face] || []).push(t);
  }
  for (const face in byFace) {
    const group = byFace[face];
    if (group.length === 0) continue;
    // Thử mô phỏng: gỡ tham lam các cặp free. Nếu còn tile mà không gỡ được nữa -> bí.
    const remaining = new Set(group);
    let progress = true;
    while (progress && remaining.size > 0) {
      progress = false;
      // 1 tile free trong mô phỏng nếu không bị tile nào "còn trên board" đè.
      // "Còn trên board" = chưa removed thật, và (nếu cùng face) chưa gỡ trong mô phỏng.
      const isFreeSim = (t) => {
        for (const o of tiles) {
          if (o.removed || o === t) continue;
          const oPresent = (o.face === t.face) ? remaining.has(o) : true;
          if (!oPresent) continue;
          if (isCoveredBy(t, o)) return false;
        }
        return true;
      };
      const freeTiles = [...remaining].filter(isFreeSim);
      if (freeTiles.length >= 2) {
        remaining.delete(freeTiles[0]);
        remaining.delete(freeTiles[1]);
        progress = true;
      }
    }
    if (remaining.size > 0) return true; // face này không gỡ hết được -> bí
  }
  return false;
}
/* Cảnh báo CHỈ khi bí thật (không thể giải), để người chơi dùng Xáo */
function updateMoveWarning() {
  const w = document.getElementById("mj-warnBar");
  if (!w) return;
  if (pairsLeft > 0 && hasAnyMove() && isDeadlocked()) {
    w.style.display = "flex";
    w.innerHTML = `⚠️ Thế bí! Có tile không thể gỡ được — dùng <b>&nbsp;Xáo&nbsp;</b> để cứu ván!`;
  } else {
    w.style.display = "none";
  }
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
  if (curMapNum >= getProgress() && curMapNum < TOTAL_MAPS) setProgress(curMapNum + 1);
  renderPackMenu(); // cap nhat tien trinh menu
  $("#mj-endEmoji").textContent = "🎉";
  $("#mj-endTitle").textContent = "Thắng rồi!";
  $("#mj-endSub").textContent = `Pack ${curPack} · Map ${curMapIdx} · ${fmtTime(seconds)}`;
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
  const prm = packParams(curPack);
  shufflesLeft = prm.shuffles; hintsLeft = prm.hints;
  dealTiles();
  renderBoard();
  startTimer();
}
function startMap(pack, idx) {
  curPack = pack; curMapIdx = idx;
  curMapNum = (pack - 1) * MAPS_PER_PACK + idx;
  $("#mj-mainMenu").style.display = "none";
  $("#mj-game").style.display = "flex";
  newGame();
}

/* ---------- Menu Pack/Map ---------- */
let menuPack = 1;
function renderPackMenu() {
  const prog = getProgress();
  menuPack = Math.max(1, Math.min(PACK_COUNT, menuPack));
  document.getElementById("mj-packName").textContent = "Pack " + menuPack;
  const grid = document.getElementById("mj-mapGrid");
  grid.innerHTML = "";
  for (let i = 1; i <= MAPS_PER_PACK; i++) {
    const mNum = (menuPack - 1) * MAPS_PER_PACK + i;
    const b = document.createElement("button");
    b.className = "map-cell" + (mNum <= prog ? "" : " locked");
    b.textContent = i;
    if (mNum < prog) b.classList.add("done");
    if (mNum <= prog) {
      b.addEventListener("click", () => startMap(menuPack, i));
    }
    grid.appendChild(b);
  }
  const progInPack = Math.max(0, Math.min(MAPS_PER_PACK, prog - (menuPack - 1) * MAPS_PER_PACK));
  document.getElementById("mj-packProg").textContent = progInPack + "/" + MAPS_PER_PACK;
  const note = document.getElementById("mj-packLockNote");
  if (progInPack <= 0 && menuPack > 1) {
    note.style.display = "block";
    note.textContent = "Hoàn thành Pack " + (menuPack - 1) + " để mở pack này.";
  } else note.style.display = "none";
}

/* ---------- Wire UI ---------- */
document.getElementById("mj-rulesBtn").addEventListener("click", () => $("#mj-rulesModal").style.display = "flex");
document.getElementById("mj-rulesClose").addEventListener("click", () => $("#mj-rulesModal").style.display = "none");
document.getElementById("mj-packPrev").addEventListener("click", () => {
  if (menuPack > 1) { menuPack--; renderPackMenu(); }
});
document.getElementById("mj-packNext").addEventListener("click", () => {
  if (menuPack < PACK_COUNT) { menuPack++; renderPackMenu(); }
});
renderPackMenu();
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
