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
function tileSrc(n) {
  const v = (typeof window !== "undefined" && window.APP_VERSION) ? window.APP_VERSION : "1";
  return TILE_BASE + "tile" + String(n).padStart(3, "0") + ".svg?v=" + v;
}

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
// key ho tro so thap phan (0.5) cho chong lech 1/2
function addPosF(set, pos, x, y, z) {
  const k = x + "," + y + "," + z;
  if (!set.has(k)) { set.add(k); pos.push({ x, y, z }); }
}
function pyramidCells(set, pos, ox, oy, w, h, layers) {
  for (let z = 0; z < layers; z++) {
    const sh = Math.floor(z / 2), ww = w - sh * 2, hh = h - sh * 2;
    if (ww < 2 || hh < 2) break;
    rectCells(set, pos, ox + sh, oy + sh, ww, hh, z);
  }
}
// Tháp bẫy: dùng lưới NGUYÊN để logic đè chính xác tuyệt đối.
// Bẫy: phá pattern tầng — thay vì đều đặn 2-1-2-1, ngẫu nhiên chèn thêm tile
// bất ngờ (thành 2-1-3-1). Hiệu ứng 3D (DEPTH) vẫn cho thấy lớp trên/dưới.
// Bắt đầu từ z=1 (trên lớp đáy).
function trapStackCells(set, pos, ox, oy, layers, rng, diff) {
  for (let z = 1; z <= layers; z++) {
    // Thu nhỏ dần như kim tự tháp (lớp trên nhỏ hơn để lộ viền lớp dưới)
    const sh = Math.floor(z / 2);
    const bx = ox + sh, by = oy + sh;
    const w = Math.max(1, 2 - sh), h = Math.max(1, 2 - sh);
    for (let dy = 0; dy < h + 1; dy++) for (let dx = 0; dx < w + 1; dx++) {
      addPos(set, pos, bx + dx, by + dy, z);
    }
    // BẪY: với xác suất theo diff, chèn thêm 1 tile phá pattern
    if (rng() < diff * 0.5) {
      const tx = bx + Math.floor(rng() * (w + 1)), ty = by + Math.floor(rng() * (h + 1));
      addPos(set, pos, tx + 1, ty, z); // đặt thò ra ngoài 1 ô gây bất ngờ
    }
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
  { id: "trap", name: "Bẫy phá tầng",
    desc: "Tháp nhiều tầng với bẫy phá pattern — đoán tầng trên, coi chừng tile bất ngờ",
    gen(W, H, diff, rng, set, pos) {
      // 1 lớp đáy phẳng (z=0); tháp bẫy xếp từ z=1 trở lên
      rectCells(set, pos, 0, 0, W, H, 0);
      // Rải nhiều tháp bẫy khắp board (hướng tới 200 cặp = 400 tile)
      const n = 8 + Math.round(diff * 6); // 8-14 tháp bẫy
      const layers = 4 + Math.round(diff * 4); // 4-8 tầng
      for (let i = 0; i < n; i++) {
        const ox = Math.floor(rng() * (W - 2)), oy = Math.floor(rng() * (H - 2));
        trapStackCells(set, pos, ox, oy, layers, rng, diff);
      }
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
    tilePool: Math.round(40 + t * 160),              // 40 -> 200 loại hình
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
window.MJ_DEBUG = (typeof location !== "undefined" && location.search.indexOf("mahjong_debug=1") >= 0);
let tiles = [];        // {id,x,y,z,face,removed,free,el}
let selected = null;
let shufflesLeft = 0, hintsLeft = 0;
let pairsLeft = 0;
let timer = null, seconds = 0;
let curPack = 1, curMapIdx = 1, curMapNum = 1;
let locked = false;

/* ---------- DOM ---------- */
const mj$ = s => document.querySelector(s);
const boardEl = mj$("#mj-board"), boardFrame = mj$("#mj-boardFrame");
const statTime = mj$("#mj-statTime"), statLeft = mj$("#mj-statLeft"), statDiff = mj$("#mj-statDiff");
const shuffleBadge = mj$("#mj-shuffleBadge"), hintBadge = mj$("#mj-hintBadge");

/* ---------- Layout & Deal ---------- */
function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Solver kiểm tra tính khả thi: thử gỡ tham lam với thứ tự ngẫu nhiên.
   Trả về true nếu gỡ hết được (có ít nhất 1 cách giải). */
function isSolvableState(tileList) {
  const n = tileList.length;
  const removed = new Array(n).fill(false);
  const isCovered = (i) => {
    const t = tileList[i];
    for (let j = 0; j < n; j++) {
      if (j === i || removed[j]) continue;
      const o = tileList[j];
      if (o.z <= t.z) continue;
      if (gridOverlap(t, o)) return true;
    }
    return false;
  };
  for (let iter = 0; iter < 2000; iter++) {
    // Tìm tất cả cặp free
    const freeIdx = [];
    for (let i = 0; i < n; i++) {
      if (!removed[i] && !isCovered(i)) freeIdx.push(i);
    }
    if (freeIdx.length === 0) break;
    const byFace = {};
    let found = false;
    // Xáo thứ tự để thử hướng khác nhau
    for (let k = freeIdx.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      [freeIdx[k], freeIdx[r]] = [freeIdx[r], freeIdx[k]];
    }
    for (const i of freeIdx) {
      const f = tileList[i].face;
      if (byFace[f] !== undefined) {
        removed[i] = true; removed[byFace[f]] = true;
        found = true;
        break;
      }
      byFace[f] = i;
    }
    if (!found) break; // có tile free nhưng không ghép được cặp
  }
  return removed.every(Boolean);
}
function dealTiles() {
  const pos = generateMapLayout(curPack, curMapIdx);
  const pairCount = pos.length / 2;
  tiles = pos.map((p, i) => ({ id: i, x: p.x, y: p.y, z: p.z, face: 0, removed: false, free: false, el: null, _rect: null }));
  pairsLeft = pairCount;
  // Chia hình đảm bảo giải được (by construction). Rớt về chia random nếu lỗi lạ.
  if (!assignFacesByConstruction(tiles)) {
    const params = packParams(curPack);
    const poolSize = Math.min(params.tilePool, TILE_COUNT, pairCount);
    const faces = [];
    const codes = shuffleArr(Array.from({ length: TILE_COUNT }, (_, i) => i + 1)).slice(0, poolSize);
    for (let i = 0; i < pairCount; i++) {
      const f = codes[i % poolSize];
      faces.push(f, f);
    }
    shuffleArr(faces);
    tiles.forEach((t, i) => { t.face = faces[i]; });
  }
}

/* Chia hình đảm bảo giải được (by construction).
   - Dựng quan hệ "đè" từ hình học render (công thức y hệt renderBoard, không phụ thuộc scale).
   - Mô phỏng 1 thứ tự gỡ đơn hợp lệ: mỗi vòng lấy hết tile "khả dụng"
     (mọi tile đè lên nó đã được xếp trước đó).
   - Ghép cặp 2 tile LIÊN TIẾP trong thứ tự đó; nếu 1 tile đè trực tiếp lên tile kia
     thì bỏ ván chia này, thử seed khác (tối đa 60 lần).
   Vì mỗi cặp đều "sạch" (không đè nhau) nên thứ tự cặp chính là 1 đáp án đúng:
   tới lượt cặp nào thì cả 2 tile đều tự do. Không bao giờ tạo blocking-pair
   (cặp mà 1 tile đè lên tile kia — nguyên nhân gây bí thế vĩnh viễn). */
function assignFacesByConstruction(list) {
  const n = list.length;
  if (!n) return false;
  // Quan hệ đè theo tọa độ lưới (gridOverlap) — khớp với computeFree
  const blockers = list.map((t, i) => {
    const s = [];
    for (let j = 0; j < n; j++) {
      if (i === j || list[j].z <= t.z) continue;
      if (gridOverlap(t, list[j])) s.push(j);
    }
    return s;
  });
  const pairCount = Math.floor(n / 2);
  const poolSize = Math.min(packParams(curPack).tilePool, TILE_COUNT, pairCount);
  if (poolSize < 1) return false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const codes = shuffleArr(Array.from({ length: TILE_COUNT }, (_, i) => i + 1)).slice(0, poolSize);
    const placed = new Array(n).fill(false);
    const order = [];
    while (order.length < n) {
      const av = [];
      for (let i = 0; i < n; i++) {
        if (placed[i]) continue;
        let ok = true;
        for (const b of blockers[i]) if (!placed[b]) { ok = false; break; }
        if (ok) av.push(i);
      }
      if (!av.length) break; // không xảy ra vì quan hệ đè là DAG theo z
      shuffleArr(av);
      for (const i of av) { placed[i] = true; order.push(i); }
    }
    if (order.length < n) continue;
    const faces = new Array(n).fill(0);
    let ci = 0, bad = false;
    for (let k = 0; k < n; k += 2) {
      const a = order[k], b = order[k + 1];
      if (blockers[a].indexOf(b) >= 0 || blockers[b].indexOf(a) >= 0) { bad = true; break; }
      const f = codes[(ci++) % poolSize];
      faces[a] = f; faces[b] = f;
    }
    if (bad) continue;
    list.forEach((t, i) => { t.face = faces[i]; });
    return true;
  }
  return false;
}

/* ---------- Luật tile tự do ---------- */
// Đơn giản: tự do = không bị tile nào đè lên (kể cả đè 1 phần).
// Dùng vùng hiển thị thực tế; DEPTH nhỏ nên khớp với logic.
// Đè theo tọa độ lưới (không phụ thuộc DEPTH visual).
// Mỗi tile chiếm [x,x+1]x[y,y+1]; đè lấn >=20% diện tích thì tính.
// Offset 0.5 cho overlap 25% -> tính; chạm góc nhẹ <20% -> không tính.
function gridOverlap(t, o) {
  const ix = Math.max(0, Math.min(t.x + 1, o.x + 1) - Math.max(t.x, o.x));
  const iy = Math.max(0, Math.min(t.y + 1, o.y + 1) - Math.max(t.y, o.y));
  return ix * iy >= 0.2;
}
function computeFree(t, list) {
  if (t.removed) return false;
  for (const o of list) {
    if (o.removed || o === t) continue;
    if (o.z <= t.z) continue; // chỉ lớp trên mới đè được
    if (gridOverlap(t, o)) return false; // bị đè (kể cả 1 phần đáng kể)
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
const BASE_TW = 54, BASE_TH = 70, GAP = 6, DEPTH = 6; // Lệch nhẹ 6px mỗi tầng để nhìn rõ lớp (logic đè tính theo lưới, không phụ thuộc DEPTH)
// Sáng/tối: tile tự do luôn sáng; chỉ tile bị chặn (không chọn được) mới tối
function setTileBrightness(t) {
  if (!t.el) return;
  t.el.style.filter = t.free ? "brightness(1)" : "brightness(0.52)";
}
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
  // Dùng kích thước đã scale trực tiếp (không dùng transform) để flex canh giữa chuẩn
  const TW = BASE_TW * scale, TH = BASE_TH * scale, GP = GAP * scale, DP = DEPTH * scale;
  boardEl.style.width = (needW * scale) + "px";
  boardEl.style.height = (needH * scale) + "px";
  boardEl.style.transform = "none";

  // Vẽ lớp dưới trước (z-index theo z)
  const sorted = [...tiles].sort((a, b) => (a.z - b.z) || (a.y - b.y) || (a.x - b.x));
  for (const t of sorted) {
    if (t.removed) continue;
    const el = document.createElement("div");
    el.className = "mj-tile" + (t.free ? " free" : " blocked");
    el.style.width = TW + "px";
    el.style.height = TH + "px";
    el.style.left = (t.x * (TW + GP) + t.z * DP) + "px";
    el.style.top = (t.y * (TH + GP) + (maxZ - t.z) * DP) + "px";
    el.style.zIndex = t.z * 100 + t.y * 10 + t.x;
    const img = document.createElement("img");
    img.src = tileSrc(t.face);
    img.alt = "";
    el.appendChild(img);
    if (window.MJ_DEBUG) {
      const dbg = document.createElement("div");
      dbg.textContent = t.x + "," + t.y + ",z" + t.z;
      dbg.style.cssText = "position:absolute;top:0;left:0;font-size:8px;color:red;background:rgba(255,255,255,0.7);pointer-events:none;z-index:9999;";
      el.appendChild(dbg);
    }
    el.addEventListener("click", () => onTileClick(t));
    boardEl.appendChild(el);
    t.el = el;
    t._rect = el.getBoundingClientRect();
    setTileBrightness(t);
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
    setTileBrightness(t);
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
/* Cảnh báo khi thế hiện tại không giải được (dùng solver kiểm tra) */
function updateMoveWarning() {
  const w = document.getElementById("mj-warnBar");
  if (!w) return;
  w.style.display = "none";
  // Chỉ kiểm tra khi còn ít tile (cuối ván) để không lag; không nước thì đã tự xáo
  const remaining = tiles.filter(t => !t.removed);
  if (pairsLeft <= 0 || !hasAnyMove() || remaining.length > 40) return;
  // Chạy solver 2 lần (random khác nhau); cả 2 đều thất bại mới báo
  let solvable = false;
  for (let k = 0; k < 2 && !solvable; k++) {
    if (isSolvableState(remaining)) solvable = true;
  }
  if (!solvable) {
    w.style.display = "flex";
    w.innerHTML = `⚠️ Thế bí! Có tile không thể gỡ được — dùng <b>&nbsp;Xáo&nbsp;</b> để cứu ván!`;
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
  // Xáo bằng construction: ván sau xáo luôn giải được (thử tối đa 20 seed,
  // mỗi lần render để có rect rồi kiểm tra lại bằng solver cho chắc)
  for (let k = 0; k < 20; k++) {
    if (!assignFacesByConstruction(alive)) {
      const faces = shuffleArr(alive.map(t => t.face));
      alive.forEach((t, i) => t.face = faces[i]);
    }
    selected = null;
    renderBoard();
    if (isSolvableState(tiles)) break;
  }
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
  mj$("#mj-endEmoji").textContent = "🎉";
  mj$("#mj-endTitle").textContent = "Thắng rồi!";
  mj$("#mj-endSub").textContent = `Pack ${curPack} · Map ${curMapIdx} · ${fmtTime(seconds)}`;
  mj$("#mj-endModal").style.display = "flex";
}
function loseGame(msg) {
  stopTimer();
  mj$("#mj-endEmoji").textContent = "😞";
  mj$("#mj-endTitle").textContent = "Thua rồi!";
  mj$("#mj-endSub").textContent = msg || "";
  mj$("#mj-endModal").style.display = "flex";
}

/* ---------- Ván mới / Menu ---------- */
function newGame() {
  mj$("#mj-endModal").style.display = "none";
  selected = null; locked = false;
  const prm = packParams(curPack);
  shufflesLeft = prm.shuffles; hintsLeft = prm.hints;
  // Kiểm tra tính khả thi TRƯỚC khi cho chơi: deal lại nếu thế bí (tối đa 15 lần)
  for (let attempt = 0; attempt < 15; attempt++) {
    dealTiles();
    renderBoard();
    if (isSolvableState(tiles)) break;
  }
  startTimer();
}
function startMap(pack, idx) {
  curPack = pack; curMapIdx = idx;
  curMapNum = (pack - 1) * MAPS_PER_PACK + idx;
  mj$("#mj-mainMenu").style.display = "none";
  mj$("#mj-game").style.display = "flex";
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
document.getElementById("mj-rulesBtn").addEventListener("click", () => mj$("#mj-rulesModal").style.display = "flex");
document.getElementById("mj-rulesClose").addEventListener("click", () => mj$("#mj-rulesModal").style.display = "none");
document.getElementById("mj-packPrev").addEventListener("click", () => {
  if (menuPack > 1) { menuPack--; renderPackMenu(); }
});
document.getElementById("mj-packNext").addEventListener("click", () => {
  if (menuPack < PACK_COUNT) { menuPack++; renderPackMenu(); }
});
/* Cheat: ?mahjong_unlock=all hoặc ?mahjong_unlock=N (mở khóa map để xem thử) */
(function(){
  try {
    const m = location.search.match(/[?&]mahjong_unlock=(all|\d+)/);
    if (m) {
      const v = m[1] === "all" ? TOTAL_MAPS : parseInt(m[1], 10);
      setProgress(Math.max(1, Math.min(TOTAL_MAPS, v)));
    }
  } catch(e){}
})();
renderPackMenu();
document.getElementById("mj-btnClose").addEventListener("click", () => {
  stopTimer();
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
  const w = document.querySelector(".mahjong-app").closest(".window");
  if (w) w.style.display = "none";
});
document.getElementById("mj-btnHome").addEventListener("click", () => {
  stopTimer();
  mj$("#mj-endModal").style.display = "none";
  mj$("#mj-game").style.display = "none";
  mj$("#mj-mainMenu").style.display = "flex";
});
document.getElementById("mj-btnShuffle").addEventListener("click", () => doShuffle(false));
document.getElementById("mj-btnHint").addEventListener("click", useHint);
document.getElementById("mj-btnNew").addEventListener("click", () => { if (!locked) newGame(); });
document.getElementById("mj-againBtn").addEventListener("click", newGame);
document.getElementById("mj-menuBtn").addEventListener("click", () => {
  mj$("#mj-endModal").style.display = "none";
  mj$("#mj-game").style.display = "none";
  mj$("#mj-mainMenu").style.display = "flex";
});
window.addEventListener("resize", () => {
  if (mj$("#mj-game").style.display !== "none" && tiles.length) renderBoard();
});
