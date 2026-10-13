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
const BOARD_W = 14, BOARD_H = 9; // lưới tối đa (archetype "fixed" vẫn dùng 12x8)

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
// Tháp bẫy: offset 1/2 ô — 2 tile lệch có thể CÙNG tầng (zIndex quyết định ai đè ai).
// Bẫy phá pattern vẫn giữ.
function trapStackCells(set, pos, ox, oy, layers, rng, diff) {
  for (let z = 1; z <= layers; z++) {
    // z càng cao càng lệch lên-trái để nhìn rõ là "đang chồng lên trên"
    const off = (z % 2 === 1) ? -0.5 : 0;
    const bx = ox + off, by = oy + off;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      addPosF(set, pos, bx + dx, by + dy, z);
    }
    // BẪY: chèn thêm 1 tile phá pattern
    if (rng() < diff * 0.5) {
      const tx = bx + Math.floor(rng() * 2), ty = by + Math.floor(rng() * 2);
      addPosF(set, pos, tx + 0.5, ty, z);
    }
  }
}

/* ===================== MAP ENGINE v2 =====================
   Mỗi map = (hình dạng mask) + (luật xếp tầng) + (tham số theo độ khó).
   - mask:  ô nào có tile (trái tim, kim cương, xoắn ốc, hoa...)
   - luật:  chiều cao mỗi ô (kim tự tháp, bậc thang, bát, cột, sóng, đồi...)
   - stagger: tầng lẻ lệch -0.5 ô (kiểu mahjong cổ điển, đè lên 4 tile bên dưới)
   Độ giải được luôn được đảm bảo ở assignFacesByConstruction. */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function maskGrid(W, H, fn) {
  const m = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      const nx = (x + 0.5 - W / 2) / (W / 2), ny = (y + 0.5 - H / 2) / (H / 2);
      row.push(fn(nx, ny, x, y) ? 1 : 0);
    }
    m.push(row);
  }
  return m;
}
// Khoảng cách Manhattan từ ô trong mask tới mép gần nhất (ô sát mép = 1)
function distField(m) {
  const H = m.length, W = m[0].length;
  const d = m.map(r => r.map(() => 0));
  const q = [];
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!m[y][x]) continue;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || !m[ny][nx]) { d[y][x] = 1; q.push([x, y]); break; }
    }
  }
  for (let qi = 0; qi < q.length; qi++) {
    const [x, y] = q[qi];
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (m[ny][nx] && d[ny][nx] === 0) { d[ny][nx] = d[y][x] + 1; q.push([nx, ny]); }
    }
  }
  return d;
}
// Luật chiều cao: (d = khoảng cách tới mép, x, y, W, H, L = số tầng tối đa, env)
const HEIGHT_RULES = {
  flat:    () => 1,
  pyramid: (d, x, y, W, H, L) => Math.min(L, d),
  terrace: (d, x, y, W, H, L) => Math.min(L, Math.ceil(d / 2)),
  bowl:    (d, x, y, W, H, L) => Math.max(1, L - d + 1),
  rim:     (d, x, y, W, H, L) => (d === 1 ? L : 1),
  columns: (d, x, y, W, H, L) => (x % 2 === 0 ? Math.min(L, d) : 1),
  checker: (d, x, y, W, H, L) => 1 + (((x + y) & 1) ? 0 : Math.min(L - 1, d - 1)),
  waves:   (d, x, y, W, H, L) => 1 + Math.round(((Math.sin(x * 0.85 + y * 0.55) + 1) / 2) * (L - 1)),
  ramp:    (d, x, y, W, H, L, env) => 1 + Math.min(L - 1, Math.floor((env.flip ? W - 1 - x : x) * L / W)),
  rampY:   (d, x, y, W, H, L, env) => 1 + Math.min(L - 1, Math.floor((env.flip ? H - 1 - y : y) * L / H)),
  rampD:   (d, x, y, W, H, L, env) => 1 + Math.min(L - 1, Math.floor(((env.flip ? W - 1 - x : x) + y) * L / (W + H - 1))),
  hills:   (d, x, y, W, H, L, env) => {
    let best = 1;
    for (const p of env.peaks) {
      const dist = Math.hypot(x - p.x, (y - p.y) * 1.2);
      best = Math.max(best, 1 + Math.round((1 - dist / p.r) * (L - 1)));
    }
    return Math.min(L, best);
  },
};
function emitHeights(set, pos, hts, stagger) {
  for (let y = 0; y < hts.length; y++) for (let x = 0; x < hts[y].length; x++) {
    for (let z = 0; z < hts[y][x]; z++) {
      const sh = (stagger && z % 2 === 1) ? -0.5 : 0;
      addPosF(set, pos, x + sh, y + sh, z);
    }
  }
}
// Tạo archetype từ mask + danh sách luật (luật chọn theo variant để map lặp lại vẫn khác nhau)
function maskArch(id, name, desc, maskFn, rules) {
  return {
    id, name, desc,
    gen(W, H, diff, rng, set, pos, P) {
      const m = maskGrid(W, H, maskFn);
      const d = distField(m);
      // Độ khó cao thì bỏ luật "flat" (nếu còn luật khác) để map không bị phẳng lì
      const usable = diff > 0.35 ? rules.filter(r => r !== "flat") : rules;
      const rule = HEIGHT_RULES[usable[P.variant % usable.length]];
      const env = { flip: (P.variant & 1) === 1, peaks: [] };
      const np = 2 + (P.variant % 2);
      for (let i = 0; i < np; i++) env.peaks.push({ x: W * (0.2 + 0.6 * rng()), y: H * (0.25 + 0.5 * rng()), r: Math.max(W, H) * (0.45 + 0.25 * rng()) });
      const build = (rf) => m.map((row, y) => row.map((v, x) => v ? clamp(Math.round(rf(d[y][x], x, y, W, H, P.L, env)), 1, P.L) : 0));
      let hts = build(rule);
      // Hình mảnh (xoắn ốc, vành, khung...) làm luật theo khoảng cách ra phẳng lì → thử luật không phụ thuộc d
      if (diff > 0.2 && P.L > 1 && Math.max(...hts.map(r => Math.max(...r))) < 2) hts = build(HEIGHT_RULES.waves);
      // Đục vài lỗ nhỏ ở bên trong cho đỡ đơn điệu khi độ khó cao
      const holes = Math.round(diff * 3);
      for (let k = 0; k < holes; k++) {
        const x = Math.floor(rng() * W), y = Math.floor(rng() * H);
        if (m[y][x] && d[y][x] >= 2) hts[y][x] = 0;
      }
      emitHeights(set, pos, hts, P.stagger);
    },
  };
}
const MASKS = {
  heart:     (nx, ny) => { const x = nx * 1.18, y = -ny * 1.15 + 0.12; const a = x * x + y * y - 1; return a * a * a - x * x * y * y * y <= 0; },
  diamond:   (nx, ny) => Math.abs(nx) + Math.abs(ny) <= 1.02,
  ellipse:   (nx, ny) => nx * nx + ny * ny <= 1.02,
  ring:      (nx, ny) => { const r = Math.hypot(nx, ny); return (r <= 1.02 && r >= 0.58) || r <= 0.3; },
  plus:      (nx, ny) => Math.abs(nx) <= 0.3 || Math.abs(ny) <= 0.4,
  xshape:    (nx, ny) => Math.abs(Math.abs(nx) - Math.abs(ny)) <= 0.3,
  butterfly: (nx, ny) => Math.abs(ny) <= 0.2 + 0.85 * Math.abs(nx),
  hourglass: (nx, ny) => Math.abs(nx) <= 0.2 + 0.85 * Math.abs(ny),
  triangle:  (nx, ny) => Math.abs(nx) <= (ny + 1) / 2 + 0.05,
  octagon:   (nx, ny) => Math.abs(nx) + Math.abs(ny) <= 1.5,
  crescent:  (nx, ny) => Math.hypot(nx, ny) <= 1.02 && Math.hypot(nx + 0.45, ny) > 0.78,
  spiral:    (nx, ny) => { const r = Math.hypot(nx, ny); if (r > 1.02) return false; if (r < 0.15) return true;
                           const t = r * 2.6 - Math.atan2(ny, nx) / (2 * Math.PI); return (((t % 1) + 1) % 1) < 0.58; },
  frame:     (nx, ny) => !(Math.abs(nx) < 0.55 && Math.abs(ny) < 0.5) || (Math.abs(nx) < 0.18 && Math.abs(ny) < 0.2),
  flower:    (nx, ny) => Math.hypot(nx, ny) <= 0.5 + 0.5 * (0.5 + 0.5 * Math.cos(5 * Math.atan2(ny, nx))) + 0.02,
  islands:   (nx, ny) => Math.hypot(nx - 0.52, ny) <= 0.5 || Math.hypot(nx + 0.52, ny) <= 0.5,
  squircle:  (nx, ny) => Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4) <= 1.02,
  rect:      () => true,
};

const ARCHETYPES = [
  // ---- 2 kiểu nhập môn (map 1-5) ----
  { id: "flat", name: "Mặt phẳng", fixed: true,
    desc: "Chỉ 1 lớp phẳng — làm quen cách ăn cặp",
    gen(W, H, diff, rng, set, pos) {
      const w = 8 + Math.round(diff * 4), h = 5 + Math.round(diff * 2);
      rectCells(set, pos, Math.floor((W - w) / 2), Math.floor((H - h) / 2), w, h, 0);
    } },
  { id: "flat-tower", name: "Tháp đơn", fixed: true,
    desc: "Mặt phẳng + 1-2 tháp thấp — học cách gỡ lớp trên",
    gen(W, H, diff, rng, set, pos) {
      rectCells(set, pos, 0, 0, W, H, 0);
      const n = 1 + (diff > 0.05 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const tw = 3, th = 3;
        const ox = 2 + i * (W - 4 - tw), oy = Math.floor((H - th) / 2);
        pyramidCells(set, pos, ox, oy, tw, th, 2);
      }
    } },
  // ---- Hình thù (mask + luật tầng) ----
  maskArch("heart", "Trái tim", "Trái tim nhiều tầng", MASKS.heart, ["pyramid", "terrace", "bowl", "checker"]),
  maskArch("diamond", "Kim cương", "Hình thoi, bậc thang vào tâm", MASKS.diamond, ["pyramid", "rim", "terrace", "checker"]),
  maskArch("lake", "Hồ tròn", "Bầu dục, tầng cao dồn ở mép hoặc ở tâm", MASKS.ellipse, ["bowl", "pyramid", "rim", "terrace"]),
  maskArch("ring", "Vòng vây", "Vành ngoài + đảo nhỏ ở giữa", MASKS.ring, ["pyramid", "rim", "terrace", "flat"]),
  maskArch("plus", "Chữ thập", "Hai cánh giao nhau", MASKS.plus, ["pyramid", "columns", "terrace", "checker"]),
  maskArch("xshape", "Chữ X", "Hai đường chéo giao nhau", MASKS.xshape, ["pyramid", "flat", "checker", "columns"]),
  maskArch("butterfly", "Con bướm", "Hai cánh tam giác", MASKS.butterfly, ["pyramid", "columns", "terrace", "waves"]),
  maskArch("hourglass", "Đồng hồ cát", "Hai tam giác úp vào nhau", MASKS.hourglass, ["pyramid", "terrace", "checker"]),
  maskArch("triangle", "Tam giác", "Đỉnh nhọn hướng lên", MASKS.triangle, ["pyramid", "terrace", "rampD", "waves"]),
  maskArch("octagon", "Bát giác", "Hình tám cạnh", MASKS.octagon, ["pyramid", "bowl", "checker", "terrace"]),
  maskArch("crescent", "Trăng khuyết", "Lưỡi liềm cong", MASKS.crescent, ["pyramid", "flat", "waves", "terrace"]),
  maskArch("spiral", "Xoắn ốc", "Rãnh xoắn từ ngoài vào tâm", MASKS.spiral, ["flat", "columns", "waves", "checker"]),
  maskArch("frame", "Khung cửa", "Khung viền, ô cửa trống ở giữa", MASKS.frame, ["pyramid", "rim", "terrace", "checker"]),
  maskArch("flower", "Bông hoa", "5 cánh hoa quanh nhụy", MASKS.flower, ["pyramid", "terrace", "bowl", "flat"]),
  maskArch("islands", "Hai đảo", "Hai hòn đảo tách rời", MASKS.islands, ["pyramid", "bowl", "terrace", "rim"]),
  maskArch("mountains", "Núi non", "Vài đỉnh núi nhô lên từ nền", MASKS.squircle, ["hills", "waves", "hills", "pyramid"]),
  maskArch("stairs", "Cầu thang", "Bậc thang dốc dần", MASKS.rect, ["ramp", "rampY", "rampD", "ramp"]),
  maskArch("checkerboard", "Bàn cờ", "Ô cao ô thấp xen kẽ", MASKS.rect, ["checker", "waves", "checker", "columns"]),
  maskArch("big-pyramid", "Kim tự tháp", "Kim tự tháp lớn", MASKS.rect, ["pyramid", "terrace", "bowl", "rim"]),
  { id: "bricks", name: "Tường gạch",
    desc: "Gạch xếp so le từng hàng, tầng trên đè lên mạch nối",
    gen(W, H, diff, rng, set, pos, P) {
      const layers = Math.min(P.L, 4);
      for (let z = 0; z < layers; z++) {
        for (let y = z; y < H - z; y++) {
          const shift = ((y + z) % 2) * 0.5;
          for (let x = z; x < W - z - (shift ? 1 : 0); x++) addPosF(set, pos, x + shift, y, z);
        }
      }
    } },
  // ---- Kiểu cổ điển giữ lại (lưới cố định 12x8) ----
  { id: "fortress", name: "Pháo đài", fixed: true,
    desc: "Tháp đa tầng ở giữa, 4 cánh hỗ trợ",
    gen(W, H, diff, rng, set, pos) {
      const cx = Math.floor(W / 2), cy = Math.floor(H / 2);
      rectCells(set, pos, cx - 2, 0, 4, 2, 0);
      rectCells(set, pos, cx - 2, H - 2, 4, 2, 0);
      rectCells(set, pos, 0, cy - 2, 2, 4, 0);
      rectCells(set, pos, W - 2, cy - 2, 2, 4, 0);
      pyramidCells(set, pos, cx - 2, cy - 2, 4, 4, 3 + Math.round(diff * 2));
    } },
  { id: "twin", name: "Song tháp", fixed: true,
    desc: "2 tháp 2 bên, cầu nối ở giữa",
    gen(W, H, diff, rng, set, pos) {
      const cy = Math.floor(H / 2), layers = 3 + Math.round(diff * 2);
      pyramidCells(set, pos, 1, cy - 2, 4, 4, layers);
      pyramidCells(set, pos, W - 5, cy - 2, 4, 4, layers);
      rectCells(set, pos, 5, cy - 1, W - 10, 2, 0);
    } },
  { id: "scatter", name: "Rải rác", fixed: true,
    desc: "Nhiều tháp nhỏ rải khắp board",
    gen(W, H, diff, rng, set, pos) {
      const n = 4 + Math.round(diff * 3);
      for (let i = 0; i < n; i++) {
        const tw = 3 + Math.floor(rng() * 2), th = 3 + Math.floor(rng() * 2);
        const ox = Math.floor(rng() * (W - tw + 1)), oy = Math.floor(rng() * (H - th + 1));
        pyramidCells(set, pos, ox, oy, tw, th, 2 + Math.round(rng() * diff * 2));
      }
      for (let k = 0; k < 20; k++) addPos(set, pos, Math.floor(rng() * W), Math.floor(rng() * H), 0);
    } },
  { id: "trap", name: "Bẫy chồng lệch", fixed: true,
    desc: "Tile chồng lệch 1/2 là thế cờ thật — coi chừng bẫy phá pattern",
    gen(W, H, diff, rng, set, pos) {
      rectCells(set, pos, 0, 0, W, H, 0);
      const n = 7 + Math.round(diff * 4);
      const layers = 3 + Math.round(diff * 3);
      for (let i = 0; i < n; i++) {
        const ox = Math.floor(rng() * (W - 2)), oy = Math.floor(rng() * (H - 2));
        trapStackCells(set, pos, ox, oy, layers, rng, diff);
      }
    } },
];
const ARCHETYPES_MAIN = ARCHETYPES.filter(a => a.id !== "flat" && a.id !== "flat-tower");
// Map 1-2: phẳng, 3-5: tháp đơn. Từ map 6: đi vòng qua toàn bộ archetype với bước nhảy
// nguyên tố cùng nhau với N → mỗi N map không trùng kiểu, 2 map liền kề luôn khác hình.
function mapStride(N) {
  for (const s of [7, 5, 11, 3, 13, 2]) { let a = s, b = N; while (b) { [a, b] = [b, a % b]; } if (a === 1) return s; }
  return 1;
}
function mapArchetype(mapNum) {
  if (mapNum <= 2) return ARCHETYPES[0];
  if (mapNum <= 5) return ARCHETYPES[1];
  const k = mapNum - 6, N = ARCHETYPES_MAIN.length;
  return ARCHETYPES_MAIN[(k * mapStride(N) + Math.floor(k / N)) % N];
}

// Sinh layout cho map: trả về mảng {x,y,z} — mỗi map 1 archetype (xoay vòng)
/* Test map: ?mahjong_test=p01 (3 ô chéo) hoặc ?mahjong_test=p02 (5 ô chữ thập)
   Dựng đúng 2 thế cờ trong hình mẫu để kiểm tra render + logic, chưa chèn bẫy. */
function getTestLayout() {
  try {
    const m = location.search.match(/[?&]mahjong_test=(p01|p02)/);
    if (!m) return null;
    const set = new Set(), pos = [];
    let faces = null;
    if (m[1] === "p01") {
      // P0-1: Tháp 4 tầng (z0-z3) để test logic tầng
      // z3 (đỉnh): A3(5,3), C3(6,4) — cùng sáng
      // z2: B2(5.5,3.5) — mờ (bị z3 đè)
      // z1: A1(5,3), C1(6,4) — mờ (bị z2 đè)
      // z0 (đáy): B0(5.5,3.5) — mờ (bị z1 đè)
      // Gán face: A3=C3=1; B2=D=2; A1=C1=3; B0=E=4
      addPosF(set, pos, 5.5, 3.5, 0); // B0 (đáy)
      addPosF(set, pos, 5, 3, 1);     // A1
      addPosF(set, pos, 6, 4, 1);     // C1
      addPosF(set, pos, 5.5, 3.5, 2); // B2
      addPosF(set, pos, 5, 3, 3);     // A3 (đỉnh)
      addPosF(set, pos, 6, 4, 3);     // C3 (đỉnh)
      // 2 ô phẳng để đủ cặp
      addPos(set, pos, 1, 1, 0); // D
      addPos(set, pos, 10, 1, 0); // E
      faces = [4, 3, 3, 2, 1, 1, 2, 4]; // B0=4,A1=3,C1=3,B2=2,A3=1,C3=1,D=2,E=4
    } else {
      // P0-2: 5 ô chữ thập — 4 ô z0 xếp 2x2, 1 ô z1 nằm giữa che 25% mỗi ô
      // Thứ tự gỡ: ô giữa (z1) trước, rồi 4 ô dưới
      // Gán: giữa=1 paired với (1,1)=1; 4 ô dưới thành 2 cặp
      const cx = 5, cy = 3;
      addPos(set, pos, cx, cy, 0);       // A
      addPos(set, pos, cx + 1, cy, 0);   // B
      addPos(set, pos, cx, cy + 1, 0);   // C
      addPos(set, pos, cx + 1, cy + 1, 0); // D
      addPosF(set, pos, cx + 0.5, cy + 0.5, 1); // E (lệch 1/2, giữa)
      addPos(set, pos, 1, 1, 0); // F
      faces = [2, 2, 3, 3, 1, 1]; // A=2,B=2,C=3,D=3,E=1,F=1
    }
    if (pos.length % 2 !== 0) { pos.pop(); faces.pop(); }
    return { pos, faces };
  } catch(e){ return null; }
}
function generateMapLayout(pack, mapIdx) {
  const mapNum = (pack - 1) * MAPS_PER_PACK + mapIdx;
  const t = (pack - 1) / (PACK_COUNT - 1);
  const tm = (mapIdx - 1) / (MAPS_PER_PACK - 1);
  const diff = Math.min(1, t * 0.85 + tm * 0.15);
  const rng = mulberry32(mapNum * 7919 + 13);
  const arch = mapArchetype(mapNum);
  const variant = mapNum <= 5 ? 0 : Math.floor((mapNum - 6) / ARCHETYPES_MAIN.length);

  // Archetype "fixed" dùng lưới 12x8 như cũ; archetype hình thù tự co giãn theo độ khó.
  let W = arch.fixed ? 12 : clamp(Math.round(lerp(8, 14, diff)), 8, BOARD_W);
  let H = arch.fixed ? 8 : clamp(Math.round(lerp(6, 9, diff)), 6, BOARD_H);
  let L = 2 + Math.round(diff * 3);
  const minT = Math.round(lerp(36, 130, diff)), maxT = Math.round(lerp(90, 320, diff));
  const stagger = mapNum > 8 && diff > 0.2 && rng() < 0.45;

  let best = null, bestScore = Infinity;
  for (let attempt = 0; attempt < 10; attempt++) {
    const set = new Set(), pos = [];
    arch.gen(W, H, diff, mulberry32(mapNum * 131 + 7), set, pos, { L, variant, stagger });
    const n = pos.length;
    const score = n < minT ? minT - n : n > maxT ? n - maxT : 0;
    if (score < bestScore) { best = pos; bestScore = score; }
    if (arch.fixed || score === 0) break;
    if (n < minT) { if (W < BOARD_W || H < BOARD_H) { W = Math.min(BOARD_W, W + 1); H = Math.min(BOARD_H, H + (attempt % 2)); } else L++; }
    else if (L > 1) L--;
    else { W = Math.max(6, W - 1); H = Math.max(5, H - 1); }
  }
  const pos = best;
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
window.MJ_SCANLOG = (typeof location !== "undefined" && location.search.indexOf("mahjong_debug=2") >= 0);
if (window.MJ_SCANLOG) window.MJ_DEBUG = true;
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

/* o có đè lên t không? Khác tầng: z cao hơn đè. CÙNG tầng (tile bẫy lệch 0.5):
   tile nào được VẼ SAU (sort theo z, y, x trong renderBoard) thì nằm trên và đè tile kia. */
function covers(o, t) {
  if (o === t || o.removed) return false;
  if (!gridOverlap(t, o)) return false;
  if (o.z !== t.z) return o.z > t.z;
  return ((o.y - t.y) || (o.x - t.x)) > 0;
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
      if (covers(tileList[j], t)) return true;
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
  const testLayout = getTestLayout();
  const pos = testLayout ? testLayout.pos : generateMapLayout(curPack, curMapIdx);
  const pairCount = pos.length / 2;
  tiles = pos.map((p, i) => ({ id: i, x: p.x, y: p.y, z: p.z, face: 0, removed: false, free: false, el: null, _rect: null }));
  pairsLeft = pairCount;
  if (testLayout && testLayout.faces) {
    // Map test: dùng faces gán tay (đã đảm bảo không blocking pair)
    tiles.forEach((t, i) => { t.face = testLayout.faces[i] || 1; });
    return;
  }
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
      if (i !== j && covers(list[j], t)) s.push(j);
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
// QUAN TRỌNG: dùng đúng thứ tự VẼ (zIndex = z*100 + y*10 + x) để biết tile nào
// nằm TRÊN tile nào — z đơn thuần không quyết định, vì 2 tile cùng z vẫn có
// thể vẽ chồng nhau (tile nào zIndex cao hơn thì che tile kia).
function gridOverlap(t, o) {
  const ix = Math.max(0, Math.min(t.x + 1, o.x + 1) - Math.max(t.x, o.x));
  const iy = Math.max(0, Math.min(t.y + 1, o.y + 1) - Math.max(t.y, o.y));
  return ix > 0 && iy > 0; // chồng lấn dù 1 chút cũng tính là đè
}
function computeFree(t, list) {
  if (t.removed) return false;
  const dbg = window.MJ_SCANLOG;
  if (dbg) console.log(`[SCAN] Tile (${t.x},${t.y},z${t.z}):`);
  for (const o of list) {
    if (o === t) continue;
    const ov = covers(o, t);
    if (dbg) console.log(`  vs (${o.x},${o.y},z${o.z}) -> ${ov ? "ĐÈ" : "không"}`);
    if (ov) return false;
  }
  return true;
}
function updateFreeStates() {
  for (const t of tiles) t.free = computeFree(t, tiles);
  if (window.MJ_DEBUG) {
    console.log("[MJ_DEBUG] Tiles:", tiles.map(t => `(${t.x},${t.y},z${t.z}) free=${t.free} face=${t.face}`).join(" | "));
  }
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
const BASE_TW = 54, BASE_TH = 70, GAP = 6, DEPTH = 0; // DEPTH=0: offset 0.5 tự nhiên đã rõ, không cần DEPTH
// Sáng/tối: tile tự do luôn sáng; chỉ tile bị chặn (không chọn được) mới tối
function setTileBrightness(t) {
  if (!t.el) return;
  t.el.style.filter = t.free ? "brightness(1)" : "brightness(0.52)";
}
function renderBoard() {
  boardEl.innerHTML = "";
  // Kích thước thiết kế
  // Tính cả min vì tile bẫy có tọa độ âm (vd -0.5) → trước đây bị tràn ra ngoài board
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = 0;
  for (const t of tiles) {
    minX = Math.min(minX, t.x); minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x); maxY = Math.max(maxY, t.y); maxZ = Math.max(maxZ, t.z);
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }
  const PAD = 16; // margin quanh board (đơn vị thiết kế, sẽ nhân theo scale)
  const needW = (maxX - minX + 1) * (BASE_TW + GAP) + maxZ * DEPTH + GAP + PAD * 2;
  const needH = (maxY - minY + 1) * (BASE_TH + GAP) + maxZ * DEPTH + GAP + PAD * 2;
  const availW = Math.max(200, boardFrame.clientWidth - 24);
  const availH = Math.max(200, boardFrame.clientHeight - 24);
  const scale = Math.min(availW / needW, availH / needH, 1.15);
  // Dùng kích thước đã scale trực tiếp (không dùng transform) để flex canh giữa chuẩn
  const TW = BASE_TW * scale, TH = BASE_TH * scale, GP = GAP * scale, DP = DEPTH * scale, PD = PAD * scale;
  boardEl.style.width = (needW * scale) + "px";
  boardEl.style.height = (needH * scale) + "px";
  boardEl.style.transform = "none";

  // PHASE 1: Render TẤT CẢ ở trạng thái mờ (blocked) trước
  // (loại trừ nguyên nhân từ thứ tự render/timing)
  for (const t of tiles) t.free = false;
  // Vẽ lớp dưới trước (z-index theo z)
  const sorted = [...tiles].sort((a, b) => (a.z - b.z) || (a.y - b.y) || (a.x - b.x));
  sorted.forEach((t, idx) => {
    if (t.removed) return;
    const el = document.createElement("div");
    el.className = "mj-tile blocked";
    el.style.width = TW + "px";
    el.style.height = TH + "px";
    el.style.left = (PD + (t.x - minX) * (TW + GP) + t.z * DP) + "px";
    el.style.top = (PD + (t.y - minY) * (TH + GP) + (maxZ - t.z) * DP) + "px";
    el.style.zIndex = String(idx + 1); // số nguyên, tăng theo thứ tự vẽ
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
  });
  if (selected) {
    const s = tiles.find(t => t.id === selected.id && !t.removed);
    if (s && s.el) s.el.classList.add("selected");
  }
  // PHASE 2: Quét 1 lượt — tile nào không bị đè thì chuyển sang sáng (free)
  updateFreeStates();
  refreshTileClasses();
  updateStats();
  if (window.MJ_DEBUG) {
    const free = tiles.filter(t => !t.removed && t.free).length;
    const blocked = tiles.filter(t => !t.removed && !t.free).length;
    console.log(`[MJ_DEBUG] Sau quét: ${free} sáng, ${blocked} mờ`);
  }
}
/* ---------- Hiệu ứng "độ dày" của chồng tile ----------
   Hiển thị các cạnh tile còn nằm bên dưới, tối đa DEPTH_MAX_VISIBLE lớp.
   Chồng 5 tile → chỉ vẽ 3 lớp; khi gỡ dần thì mỏng đi 3 → 2 → 1 → phẳng. */
const DEPTH_MAX_VISIBLE = 3;
const DEPTH_COLORS = ["#d9cd9f", "#b5a673", "#8a7d52"]; // lớp gần → xa (đậm dần)
// Sai số tọa độ (top-left) để coi 2 tile là "cùng vị trí". 0 = phải trùng khít x,y.
// Map có tầng lẻ lệch -0.5 (stagger) sẽ không có hiệu ứng dày; muốn có thì đặt 0.5.
const DEPTH_SAME_POS_TOL = 0;
// Đếm số tile nằm ngay dưới t CÙNG vị trí, liên tục từ trên xuống.
// Gặp 1 tầng có tile đè lên t mà lệch vị trí → dừng (chiều sâu thực tế bị ngắt).
//   A(4,6) / B(4,6) / C(2,3) → A có 1 tile cùng chỗ bên dưới (tính cả A = chồng 2)
//   A(4,6) / B(2,3) / C(4,6) → A không có gì cùng chỗ liên tục → 0 (chồng 1)
function countUnder(t) {
  const levels = new Map(); // z -> có tile cùng vị trí ở tầng đó không
  for (const o of tiles) {
    if (o.removed || o.z >= t.z) continue;
    if (!gridOverlap(t, o)) continue;
    const same = Math.abs(o.x - t.x) <= DEPTH_SAME_POS_TOL && Math.abs(o.y - t.y) <= DEPTH_SAME_POS_TOL;
    levels.set(o.z, (levels.get(o.z) || false) || same);
  }
  const zs = [...levels.keys()].sort((p, q) => q - p); // từ sát t xuống đáy
  let n = 0;
  for (const z of zs) { if (levels.get(z)) n++; else break; }
  return n;
}
function setTileDepth(t) {
  if (!t.el) return;
  const n = Math.min(DEPTH_MAX_VISIBLE, countUnder(t));
  t.el.style.transition = "filter .15s, transform .15s, box-shadow .3s";
  if (!n) { t.el.style.boxShadow = "0 1px 2px rgba(0,0,0,.35)"; return; }
  const scale = (parseFloat(t.el.style.width) || BASE_TW) / BASE_TW;
  const step = Math.max(1.5, 3 * scale);
  const layers = [];
  for (let k = 1; k <= n; k++) layers.push(`${(k * step).toFixed(1)}px ${(k * step).toFixed(1)}px 0 0 ${DEPTH_COLORS[k - 1]}`);
  layers.push(`${((n + 1) * step).toFixed(1)}px ${((n + 1) * step).toFixed(1)}px ${(5 * scale).toFixed(1)}px rgba(0,0,0,.4)`);
  t.el.style.boxShadow = layers.join(", ");
}
function refreshTileClasses() {
  for (const t of tiles) {
    if (!t.el || t.removed) continue;
    t.el.classList.toggle("free", t.free);
    t.el.classList.toggle("blocked", !t.free);
    setTileBrightness(t);
    setTileDepth(t);
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
