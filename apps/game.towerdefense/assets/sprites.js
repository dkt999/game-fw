// Pixel art sprites - định nghĩa bằng chuỗi, mỗi ký tự = 1 màu
// Kích thước: tile 32x32, tower 32x32, enemy 28x28

const PAL = {
  ".": null,                    // trong suốt
  "G": "#4a8f3c", "g": "#5aa348", "D": "#3d7a32",  // cỏ
  "P": "#c9a86a", "p": "#b8945a", "Q": "#d9bc82",  // đường đất
  "W": "#6b4a2f", "w": "#8a613c", "V": "#54371f",  // gỗ
  "S": "#7a7a8a", "s": "#5a5a6a", "L": "#9a9aac",  // đá/xám
  "B": "#2a2a3a",                                // đen
  "R": "#d94a4a", "r": "#a83232",                // đỏ
  "O": "#e8913a", "o": "#c4762a",                // cam
  "Y": "#f5d142", "y": "#d4af2e",                // vàng
  "U": "#4a90d9", "u": "#2e6bb0",                // xanh dương
  "I": "#a8e6f0", "i": "#7ecfe0",                // băng
  "M": "#9b59b6", "m": "#7d3c98",                // tím
  "N": "#2ecc71", "n": "#27ae60",                // xanh lá (slime)
  "E": "#ffffff",                                // trắng
  "K": "#f5c99b",                                // da
};

// Helper: vẽ sprite từ map chuỗi lên canvas
function drawSprite(ctx, map, x, y, scale = 1) {
  for (let r = 0; r < map.length; r++) {
    const row = map[r];
    for (let c = 0; c < row.length; c++) {
      const color = PAL[row[c]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
    }
  }
}

// Tạo canvas từ sprite map (để cache)
function spriteToCanvas(map, scale = 1) {
  const h = map.length, w = map[0].length;
  const cv = document.createElement("canvas");
  cv.width = w * scale; cv.height = h * scale;
  drawSprite(cv.getContext("2d"), map, 0, 0, scale);
  return cv;
}

// ===== TILES =====
function makeGrass(seed = 1) {
  // Cỏ với noise ngẫu nhiên (dùng seed để 2 variant khác nhau)
  const map = [];
  let s = seed * 7919;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let r = 0; r < 32; r++) {
    let row = "";
    for (let c = 0; c < 32; c++) {
      const v = rnd();
      row += v < 0.08 ? "D" : v < 0.2 ? "g" : "G";
    }
    map.push(row);
  }
  return map;
}

function makePath() {
  const map = [];
  for (let r = 0; r < 32; r++) {
    let row = "";
    for (let c = 0; c < 32; c++) {
      // Viền tối 2px
      if (r < 2 || r > 29 || c < 2 || c > 29) row += "p";
      else row += (r + c) % 7 === 0 ? "Q" : "P";
    }
    map.push(row);
  }
  return map;
}

// ===== TOWERS (32x32) =====
const SPR_ARROW = [
"................................",
"................................",
".............YYYY...............",
"............YWWWWY..............",
".............WWWW...............",
"..........SSSSSSSSSS............",
".........SLLLLLLLLLLS...........",
".........SLLSSSSSSLLLS...........",
".........SLLSWWWWLLS............",
".........SLLSWWWWLLS............",
".........SLLSWWWWLLS............",
"..........SSWWWWSS..............",
"...........WWWWWW...............",
"..........WWWWWWWW..............",
"..........WWWWWWWW..............",
".........WWWWWWWWWWWW...........",
".........WWWWWWWWWWWW...........",
".........WVVVVVVVVVVW...........",
".........WVVVVVVVVVVW...........",
".........WVVVVVVVVVVW...........",
".........WVVVVVVVVVVW...........",
".........WVVVVVVVVVVW...........",
".........WWWWWWWWWWWW...........",
"........WWWWWWWWWWWWWW..........",
"........WWWWWWWWWWWWWW..........",
"........WWWWWWWWWWWWWW..........",
".......WWWWWWWWWWWWWWWW.........",
".......WWWWWWWWWWWWWWWW.........",
"......VVVVVVVVVVVVVVVVVV........",
"......VVVVVVVVVVVVVVVVVV........",
"................................",
"................................",
];

const SPR_CANNON = [
"................................",
"................................",
"................................",
"..........BBBBBBBBBB............",
".........BBBBBBBBBBBB...........",
".........BBSSSSSSSSBB...........",
"..........SSSSSSSSSS............",
".........SLLLLLLLLLLS...........",
".........SLLSSSSSSLLLS...........",
".........SLLSsSSsSLLS............",
".........SLLSsSSsSLLS............",
".........SLLSsSSsSLLS............",
"..........SSsSSsSS..............",
"...........SSSSSS...............",
"..........SSSSSSSS..............",
"..........SSSSSSSS..............",
".........SSSSSSSSSS.............",
".........SSSSSSSSSS.............",
".........SSVVVVVVSS.............",
".........SSVVVVVVSS.............",
".........SSVVVVVVSS.............",
".........SSVVVVVVSS.............",
".........SSVVVVVVSS.............",
".........SSSSSSSSSS.............",
"........SSSSSSSSSSSS............",
"........SSSSSSSSSSSS............",
"........SSSSSSSSSSSS............",
".......SSSSSSSSSSSSSS...........",
".......SSSSSSSSSSSSSS...........",
"......VVVVVVVVVVVVVVVV..........",
"......VVVVVVVVVVVVVVVV..........",
"................................",
];

const SPR_FROST = [
"................................",
"...............II...............",
"..............IIII..............",
"..............IIII..............",
".............IIIIII.............",
".............IIIIII.............",
"............IIIIIIII............",
"............IIIIIIII............",
"...........IIIIIIIIII...........",
"...........IIIiiIIII............",
"...........IIIiiIIII............",
"..........IIIIiiIIIIII..........",
"..........IIIIiiIIIIII..........",
"..........IIIIIIIIIIII..........",
"...........IIIIIIIIII...........",
"...........IIIIIIIIII...........",
"..........SSSSSSSSSSSS..........",
".........SLLLLLLLLLLLLS.........",
".........SLLSSSSSSLLLS..........",
".........SLLSsSSsSLLS...........",
".........SLLSsSSsSLLS...........",
".........SLLSsSSsSLLS...........",
"..........SSsSSsSS.............",
"...........SSSSSS..............",
"..........SSSSSSSS.............",
".........SSSSSSSSSS............",
".........SSSSSSSSSS............",
"........SSSSSSSSSSSS...........",
"........SSSSSSSSSSSS...........",
".......VVVVVVVVVVVVVV..........",
".......VVVVVVVVVVVVVV..........",
"................................",
];

const SPR_TESLA = [
"................................",
"...............YY...............",
"..............YMMY..............",
"..............YMMY..............",
"...............MM...............",
".............MMMMMM.............",
"..............MMMM..............",
"..............MMMM..............",
".............MMMMMM.............",
"..............MMMM..............",
"..............YYYY..............",
".............YMMMmY.............",
".............YMMMmY.............",
"..............MMmM..............",
"...........SSSSSSSSSS...........",
"..........SLLLLLLLLLLS..........",
"..........SLSSSSSSLS............",
"..........SLSsSSsSLS............",
"..........SLSsSSsSLS............",
"..........SLSsSSsSLS............",
"...........SSsSSsSS.............",
"............SSSSSS..............",
"...........SSSSSSSS.............",
"..........SSSSSSSSSS............",
"..........SSSSSSSSSS............",
".........SSSSSSSSSSSS...........",
".........SSSSSSSSSSSS...........",
"........SSSSSSSSSSSSSS..........",
"........SSSSSSSSSSSSSS..........",
".......VVVVVVVVVVVVVVVV.........",
".......VVVVVVVVVVVVVVVV.........",
"................................",
];

// ===== ENEMIES =====
// Slime (28x28)
const SPR_SLIME = [
"............................",
"............................",
".........NNNNNNNNNN.........",
".......NNNNNNNNNNNNNN.......",
"......NNNNNNNNNNNNNNNN......",
".....NNNNEENNNNNNEENNNN.....",
"....NNNNEEEE NNNNEEEENNNN...",
"....NNNNEBBENNNNEBBENNNN....",
"....NNNNEBBENNNNEBBENNNN....",
"....NNNNEEEENNNNEEEENNNN....",
"....NNNNNNNNNNNNNNNNNNNN....",
"....NNNNNNNNNNNNNNNNNNNN....",
".....NNNNNNNNNNNNNNNNNN.....",
".....NNNNNNRRRRRNNNNNNN.....",
".....NNNNNRRRRRRRNNNNNN.....",
"......NNNNRRRRRRRNNNNN......",
"......NNNNNRRRRRNNNNNN......",
".......NNNNNNNNNNNNNN.......",
".......nnNNNNNNNNNNnn.......",
"........nnNNNNNNNNnn........",
".........nnnnnnnnnn.........",
"............................",
"............................",
"............................",
"............................",
"............................",
"............................",
"............................",
];

// Speeder - imp cam (28x28)
const SPR_SPEEDER = [
"............................",
"...........OOO..............",
"..........OOOOO.............",
".........OOO O OOO...........",
".........OOO OOO.............",
"..........OOOOO..............",
"...........OOO...............",
"..........OOOOO..............",
".........OOO OOO.............",
"........OOO   OOO............",
"........OO     OO............",
".......OOO     OOO...........",
".......OO       OO...........",
"......OOO       OOO..........",
"......OO         OO..........",
".....OOO         OOO.........",
"............................",
"............................",
"............................",
"............................",
"............................",
"............................",
"............................",
"............................",
"............................",
"............................",
"............................",
"............................",
];

// Golem - tank đá (28x28)
const SPR_GOLEM = [
"............................",
"........SSSSSSSSSS..........",
".......SLLLLLLLLLLS.........",
"......SLLSSSSSSLLLS.........",
"......SLSsSSSSsSLS..........",
"......SLSsSSSSsSLS..........",
"......SLLSSSSSSLLLS.........",
".......SLLLLLLLLS...........",
"........SSSSSSSSS...........",
"......SSSSSSSSSSSSS.........",
".....SSSSL LLSL LSSSS........",
".....SSSSL LLSL LSSSS........",
".....SSSSSSSSSSSSSSS........",
".....SSSSSSSSSSSSSSS........",
"......SSSSSSSSSSSSS.........",
"......SSSSSSSSSSSSS.........",
".....SSSSSS SSSSSSS.........",
".....SSSSS   SSSSS..........",
".....SSSSS   SSSSS..........",
"....SSSSSS   SSSSSS.........",
"....VVVVV     VVVVV.........",
"............................",
"............................",
"............................",
"............................",
"............................",
"............................",
"............................",
];

// Boss - quỷ đỏ (28x28)
const SPR_BOSS = [
"........RR      RR..........",
".........RR    RR...........",
".........RRRRRRRR...........",
"..........RRRRRR............",
".........RRRRRRRR...........",
"........RRRYRRRYRRR.........",
"........RRRYRRRYRRR.........",
".........RRRRRRRR...........",
".........RRRRRRRR...........",
"..........RRRRRR............",
"........RRRRRRRRRRRR........",
".......RRRR RRRR RRRR.......",
".......RRR  RRRR  RRR.......",
".......RRR  RRRR  RRR.......",
"........RRR RRRR RRR........",
"........RRRRRRRRRRRR........",
".........RRRRRRRRR..........",
".........RRR   RRR..........",
"........RRRR   RRRR.........",
"........RRR     RRR.........",
".......VVV       VVV........",
"............................",
"............................",
"............................",
"............................",
"............................",
"............................",
"............................",
];

// Đạn
const SPR_BULLET = [
"....",
".YY.",
"YYYY",
".YY.",
];
const SPR_CANNONBALL = [
"......",
".BBBB.",
"BBBBBB",
"BBBBBB",
".BBBB.",
"......",
];
const SPR_FROSTBALL = [
"......",
".IIII.",
"IIiiII",
"IIiiII",
".IIII.",
"......",
];
const SPR_ZAP = [
"...Y..",
"..YMY.",
".YMMY.",
"..YMY.",
"...Y..",
];

const SPRITES = {
  arrow: SPR_ARROW, cannon: SPR_CANNON, frost: SPR_FROST, tesla: SPR_TESLA,
  slime: SPR_SLIME, speeder: SPR_SPEEDER, golem: SPR_GOLEM, boss: SPR_BOSS,
  bullet: SPR_BULLET, cannonball: SPR_CANNONBALL, frostball: SPR_FROSTBALL, zap: SPR_ZAP,
};
