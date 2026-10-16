(function(){
"use strict";

// ===== CONFIG =====
const COLS = 20, ROWS = 13, TILE = 32;
const W = COLS * TILE, H = ROWS * TILE;

// Đường đi (waypoints theo ô)
const PATH = [
  [0, 2], [5, 2], [5, 6], [10, 6], [10, 2], [15, 2], [15, 8], [8, 8], [8, 11], [19, 11]
];

const TOWERS = {
  arrow:  { name: "Cung",   cost: 50,  range: 3.2, dmg: 12, rate: 0.5,  color: "#e8913a", proj: "bullet",     desc: "Bắn nhanh, rẻ" },
  cannon: { name: "Pháo",   cost: 100, range: 2.6, dmg: 35, rate: 1.4,  color: "#7a7a8a", proj: "cannonball", splash: 1.2, desc: "Sát thương lan" },
  frost:  { name: "Băng",   cost: 80,  range: 2.8, dmg: 8,  rate: 0.8,  color: "#a8e6f0", proj: "frostball",  slow: 0.5, slowDur: 2, desc: "Làm chậm" },
  tesla:  { name: "Sét",    cost: 150, range: 3.6, dmg: 25, rate: 1.0,  color: "#9b59b6", proj: "zap",        desc: "Tầm xa" },
};

const ENEMIES = {
  slime:   { hp: 60,  speed: 1.6, gold: 8,  sprite: "slime",   name: "Slime" },
  speeder: { hp: 35,  speed: 2.8, gold: 10, sprite: "speeder", name: "Tốc hành" },
  golem:   { hp: 220, speed: 1.0, gold: 20, sprite: "golem",   name: "Golem" },
  boss:    { hp: 1200,speed: 0.8, gold: 150,sprite: "boss",    name: "Quỷ vương" },
};

// ===== STATE =====
let canvas, ctx;
let spriteCache = {};
let towers = [];      // {gx, gy, type, cd, level}
let enemies = [];     // {x, y, hp, maxHp, speed, gold, sprite, wpIdx, slowUntil, slowFactor}
let projectiles = []; // {x, y, tx, ty, target, dmg, type, splash, slow, slowDur}
let particles = [];
let gold = 200, lives = 20, wave = 0;
let selectedTower = null;  // loại tháp đang chọn để đặt
let hoverCell = null;
let gameState = "build";   // build | wave | gameover | victory
let spawnQueue = [], spawnTimer = 0;
let waveInProgress = false;
let selectedPlaced = null; // tháp đã đặt được chọn (để nâng cấp/bán)

const TOTAL_WAVES = 15;

// ===== INIT =====
function init(){
  canvas = document.getElementById("td-canvas");
  ctx = canvas.getContext("2d");
  canvas.width = W; canvas.height = H;

  // Cache sprites
  for (const k in SPRITES) spriteCache[k] = spriteToCanvas(SPRITES[k], 1);
  spriteCache.grass1 = spriteToCanvas(makeGrass(1), 1);
  spriteCache.grass2 = spriteToCanvas(makeGrass(2), 1);
  spriteCache.path = spriteToCanvas(makePath(), 1);

  buildPathSet();
  bindUI();
  requestAnimationFrame(loop);
  updateHUD();
}

// Tập hợp ô đường đi để không cho đặt tháp
let pathSet = new Set();
function buildPathSet(){
  pathSet.clear();
  for (let i = 0; i < PATH.length - 1; i++){
    const [x1, y1] = PATH[i], [x2, y2] = PATH[i + 1];
    const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1);
    let x = x1, y = y1;
    pathSet.add(x + "," + y);
    while (x !== x2 || y !== y2){
      x += dx; y += dy;
      pathSet.add(x + "," + y);
    }
  }
}

function isPath(gx, gy){ return pathSet.has(gx + "," + gy); }

// ===== WAVES =====
function makeWave(n){
  // n từ 1..TOTAL_WAVES
  const q = [];
  const add = (type, count, gap) => { for (let i = 0; i < count; i++) q.push({type, gap}); };
  if (n === 1) add("slime", 8, 0.8);
  else if (n === 2) add("slime", 12, 0.6);
  else if (n === 3){ add("slime", 8, 0.5); add("speeder", 6, 0.5); }
  else if (n === 4) add("speeder", 14, 0.4);
  else if (n === 5){ add("slime", 10, 0.4); add("golem", 3, 1.2); }
  else if (n === 6) add("golem", 8, 0.8);
  else if (n === 7){ add("speeder", 16, 0.3); add("slime", 10, 0.4); }
  else if (n === 8){ add("golem", 6, 0.7); add("speeder", 10, 0.35); }
  else if (n === 9) add("slime", 25, 0.25);
  else if (n === 10) add("boss", 1, 1);
  else {
    const k = n - 10;
    add("slime", 12 + k * 3, 0.3);
    add("speeder", 8 + k * 2, 0.3);
    add("golem", 4 + k, 0.6);
    if (n % 5 === 0) add("boss", Math.floor(n / 5), 2);
  }
  // Scale HP theo wave
  const hpMul = 1 + (n - 1) * 0.22;
  q.forEach(e => e.hpMul = hpMul);
  return q;
}

function startWave(){
  if (waveInProgress || gameState === "gameover" || gameState === "victory") return;
  wave++;
  if (wave > TOTAL_WAVES){ victory(); return; }
  spawnQueue = makeWave(wave);
  spawnTimer = 0;
  waveInProgress = true;
  gameState = "wave";
  updateHUD();
  log(`— Đợt ${wave}/${TOTAL_WAVES} —`);
}

function spawnEnemy(type, hpMul){
  const base = ENEMIES[type];
  const [sx, sy] = PATH[0];
  enemies.push({
    x: sx * TILE + TILE/2, y: sy * TILE + TILE/2,
    hp: base.hp * hpMul, maxHp: base.hp * hpMul,
    speed: base.speed * TILE, // px/giây
    gold: Math.round(base.gold * (1 + wave * 0.05)),
    sprite: base.sprite, name: base.name,
    wpIdx: 1, slowUntil: 0, slowFactor: 1,
  });
}

// ===== UPDATE =====
let lastT = 0;
function loop(t){
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

function update(dt){
  if (gameState === "gameover" || gameState === "victory") return;

  // Spawn
  if (spawnQueue.length){
    spawnTimer -= dt;
    if (spawnTimer <= 0){
      const s = spawnQueue.shift();
      spawnEnemy(s.type, s.hpMul);
      spawnTimer = s.gap;
    }
  }

  // Enemies di chuyển
  for (let i = enemies.length - 1; i >= 0; i--){
    const e = enemies[i];
    if (e.wpIdx >= PATH.length){
      // Tới đích
      lives--;
      enemies.splice(i, 1);
      updateHUD();
      if (lives <= 0){ gameOver(); return; }
      continue;
    }
    const [wx, wy] = PATH[e.wpIdx];
    const tx = wx * TILE + TILE/2, ty = wy * TILE + TILE/2;
    const dx = tx - e.x, dy = ty - e.y;
    const dist = Math.hypot(dx, dy);
    // Slow
    let sp = e.speed;
    if (performance.now() / 1000 < e.slowUntil) sp *= e.slowFactor;
    if (dist < sp * dt){
      e.x = tx; e.y = ty; e.wpIdx++;
    } else {
      e.x += dx / dist * sp * dt;
      e.y += dy / dist * sp * dt;
    }
  }

  // Towers bắn
  for (const tw of towers){
    tw.cd -= dt;
    if (tw.cd > 0) continue;
    const cfg = TOWERS[tw.type];
    const cx = tw.gx * TILE + TILE/2, cy = tw.gy * TILE + TILE/2;
    // Tìm mục tiêu gần đích nhất trong tầm
    let best = null, bestProg = -1;
    for (const e of enemies){
      const d = Math.hypot(e.x - cx, e.y - cy) / TILE;
      if (d <= cfg.range * (1 + tw.level * 0.08)){
        const prog = e.wpIdx * 1000 - Math.hypot(e.x - PATH[e.wpIdx]?.[0]*TILE, e.y - PATH[e.wpIdx]?.[1]*TILE);
        if (prog > bestProg){ bestProg = prog; best = e; }
      }
    }
    if (best){
      const dmg = cfg.dmg * (1 + tw.level * 0.5);
      projectiles.push({
        x: cx, y: cy - 10, target: best,
        dmg, type: tw.type,
        splash: (cfg.splash || 0) * (1 + tw.level * 0.15),
        slow: cfg.slow, slowDur: cfg.slowDur,
        speed: 420,
      });
      tw.cd = cfg.rate;
    }
  }

  // Projectiles
  for (let i = projectiles.length - 1; i >= 0; i--){
    const p = projectiles[i];
    if (!enemies.includes(p.target)){
      projectiles.splice(i, 1);
      continue;
    }
    const dx = p.target.x - p.x, dy = p.target.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 12){
      hitEnemy(p.target, p);
      projectiles.splice(i, 1);
    } else {
      p.x += dx / dist * p.speed * dt;
      p.y += dy / dist * p.speed * dt;
    }
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--){
    const pt = particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    if (pt.life <= 0) particles.splice(i, 1);
  }

  // Hết wave?
  if (waveInProgress && !spawnQueue.length && !enemies.length){
    waveInProgress = false;
    gameState = "build";
    gold += 30 + wave * 5; // thưởng qua đợt
    log(`Xong đợt ${wave}! +${30 + wave * 5} vàng`);
    updateHUD();
    if (wave >= TOTAL_WAVES) victory();
  }
}

function hitEnemy(e, p){
  if (p.splash){
    // Sát thương lan
    for (let i = enemies.length - 1; i >= 0; i--){
      const o = enemies[i];
      if (Math.hypot(o.x - e.x, o.y - e.y) <= p.splash * TILE){
        damageEnemy(o, p.dmg, i);
      }
    }
    boom(e.x, e.y, "#e8913a", 8);
  } else {
    damageEnemy(e, p.dmg, enemies.indexOf(e));
  }
  if (p.slow && enemies.includes(e)){
    e.slowUntil = performance.now() / 1000 + p.slowDur;
    e.slowFactor = p.slow;
    boom(e.x, e.y, "#a8e6f0", 4);
  }
}

function damageEnemy(e, dmg, idx){
  e.hp -= dmg;
  if (e.hp <= 0 && idx >= 0){
    enemies.splice(idx, 1);
    gold += e.gold;
    boom(e.x, e.y, "#ffd93d", 10);
    updateHUD();
  }
}

function boom(x, y, color, n){
  for (let i = 0; i < n; i++){
    const a = Math.random() * Math.PI * 2;
    particles.push({
      x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90,
      life: 0.4, color,
    });
  }
}

// ===== RENDER =====
function render(){
  // Nền cỏ
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      ctx.drawImage(spriteCache[((x + y) % 2) ? "grass1" : "grass2"], x * TILE, y * TILE);
  // Đường
  for (const k of pathSet){
    const [x, y] = k.split(",").map(Number);
    ctx.drawImage(spriteCache.path, x * TILE, y * TILE);
  }

  // Hover + tầm bắn
  if (hoverCell && selectedTower){
    const [gx, gy] = hoverCell;
    if (!isPath(gx, gy) && !towerAt(gx, gy)){
      const cfg = TOWERS[selectedTower];
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(gx * TILE, gy * TILE, TILE, TILE);
      // Vòng tầm bắn
      ctx.beginPath();
      ctx.arc(gx * TILE + 16, gy * TILE + 16, cfg.range * TILE, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(255,60,60,0.3)";
      ctx.fillRect(gx * TILE, gy * TILE, TILE, TILE);
    }
  }

  // Tháp đã chọn: hiện tầm
  if (selectedPlaced){
    const tw = selectedPlaced;
    const cfg = TOWERS[tw.type];
    ctx.beginPath();
    ctx.arc(tw.gx * TILE + 16, tw.gy * TILE + 16, cfg.range * TILE * (1 + tw.level * 0.08), 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    ctx.strokeStyle = "#ffd93d";
    ctx.strokeRect(tw.gx * TILE, tw.gy * TILE, TILE, TILE);
  }

  // Tháp
  for (const tw of towers)
    ctx.drawImage(spriteCache[tw.type], tw.gx * TILE, tw.gy * TILE);

  // Quái (kèm thanh máu)
  for (const e of enemies){
    const spr = spriteCache[e.sprite];
    ctx.drawImage(spr, e.x - 14, e.y - 14);
    // Thanh máu
    const w = 26;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(e.x - w/2, e.y - 20, w, 4);
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? "#2ecc71" : e.hp / e.maxHp > 0.25 ? "#f39c12" : "#e74c3c";
    ctx.fillRect(e.x - w/2, e.y - 20, w * Math.max(e.hp / e.maxHp, 0), 4);
    // Hiệu ứng chậm
    if (performance.now() / 1000 < e.slowUntil){
      ctx.fillStyle = "rgba(168,230,240,0.35)";
      ctx.fillRect(e.x - 14, e.y - 14, 28, 28);
    }
  }

  // Đạn
  for (const p of projectiles){
    const spr = spriteCache[TOWERS[p.type].proj];
    ctx.drawImage(spr, p.x - 3, p.y - 3);
  }

  // Particles
  for (const pt of particles){
    ctx.globalAlpha = Math.max(pt.life / 0.4, 0);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

// ===== INPUT =====
function towerAt(gx, gy){
  return towers.find(t => t.gx === gx && t.gy === gy);
}

function bindUI(){
  canvas.addEventListener("mousemove", e => {
    const r = canvas.getBoundingClientRect();
    const gx = Math.floor((e.clientX - r.left) / r.width * COLS);
    const gy = Math.floor((e.clientY - r.top) / r.height * ROWS);
    hoverCell = (gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS) ? [gx, gy] : null;
  });
  canvas.addEventListener("mouseleave", () => hoverCell = null);
  canvas.addEventListener("click", e => {
    if (gameState === "gameover" || gameState === "victory") return;
    const r = canvas.getBoundingClientRect();
    const gx = Math.floor((e.clientX - r.left) / r.width * COLS);
    const gy = Math.floor((e.clientY - r.top) / r.height * ROWS);
    if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;

    const existing = towerAt(gx, gy);
    if (existing){
      selectedPlaced = (selectedPlaced === existing) ? null : existing;
      selectedTower = null;
      updatePanel();
      return;
    }
    selectedPlaced = null;
    if (selectedTower && !isPath(gx, gy)){
      const cfg = TOWERS[selectedTower];
      if (gold >= cfg.cost){
        gold -= cfg.cost;
        towers.push({gx, gy, type: selectedTower, cd: 0, level: 0});
        log(`Dựng tháp ${cfg.name} (-${cfg.cost})`);
        updateHUD();
      } else log("Không đủ vàng!");
    }
    updatePanel();
  });

  // Nút chọn tháp
  document.querySelectorAll(".td-tower-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = btn.dataset.tower;
      selectedTower = (selectedTower === t) ? null : t;
      selectedPlaced = null;
      document.querySelectorAll(".td-tower-btn").forEach(b =>
        b.classList.toggle("active", b.dataset.tower === selectedTower));
      updatePanel();
    });
  });

  document.getElementById("td-startWave").addEventListener("click", startWave);
  document.getElementById("td-upgrade").addEventListener("click", upgradeTower);
  document.getElementById("td-sell").addEventListener("click", sellTower);
  document.getElementById("td-restart").addEventListener("click", restart);
}

function upgradeTower(){
  if (!selectedPlaced) return;
  const tw = selectedPlaced;
  const cost = Math.round(TOWERS[tw.type].cost * 0.8 * (tw.level + 1));
  if (tw.level >= 3){ log("Đã max level!"); return; }
  if (gold >= cost){
    gold -= cost;
    tw.level++;
    log(`Nâng cấp ${TOWERS[tw.type].name} lên Lv${tw.level + 1} (-${cost})`);
    updateHUD(); updatePanel();
  } else log("Không đủ vàng!");
}

function sellTower(){
  if (!selectedPlaced) return;
  const tw = selectedPlaced;
  const refund = Math.round(TOWERS[tw.type].cost * 0.7 * (1 + tw.level * 0.5));
  gold += refund;
  towers = towers.filter(t => t !== tw);
  log(`Bán tháp +${refund} vàng`);
  selectedPlaced = null;
  updateHUD(); updatePanel();
}

function updatePanel(){
  const p = document.getElementById("td-towerInfo");
  if (selectedPlaced){
    const tw = selectedPlaced, cfg = TOWERS[tw.type];
    const cost = Math.round(cfg.cost * 0.8 * (tw.level + 1));
    p.innerHTML = `<b>${cfg.name} Lv${tw.level + 1}</b><br>
      Dame: ${Math.round(cfg.dmg * (1 + tw.level * 0.5))} | Tầm: ${(cfg.range * (1 + tw.level * 0.08)).toFixed(1)}<br>
      <button class="td-btn sm" id="td-up2">Nâng cấp (${cost})</button>
      <button class="td-btn sm" id="td-sell2">Bán</button>`;
    document.getElementById("td-up2").addEventListener("click", upgradeTower);
    document.getElementById("td-sell2").addEventListener("click", sellTower);
    p.style.display = "block";
  } else if (selectedTower){
    const cfg = TOWERS[selectedTower];
    p.innerHTML = `<b>${cfg.name}</b> — ${cfg.cost} vàng<br>${cfg.desc}<br><i>Bấm vào ô trống để đặt</i>`;
    p.style.display = "block";
  } else {
    p.style.display = "none";
  }
}

function updateHUD(){
  document.getElementById("td-gold").textContent = gold;
  document.getElementById("td-lives").textContent = lives;
  document.getElementById("td-wave").textContent = wave + "/" + TOTAL_WAVES;
  const btn = document.getElementById("td-startWave");
  btn.disabled = waveInProgress;
  btn.textContent = wave === 0 ? "▶ Bắt đầu đợt 1" : `▶ Đợt ${wave + 1}`;
  if (wave >= TOTAL_WAVES) btn.textContent = "Hoàn thành!";
}

function log(msg){
  const el = document.getElementById("td-log");
  const div = document.createElement("div");
  div.textContent = msg;
  el.prepend(div);
  while (el.children.length > 6) el.lastChild.remove();
}

function gameOver(){
  gameState = "gameover";
  showEnd("💀 Thua rồi!", `Sống sót ${wave} đợt`);
}
function victory(){
  gameState = "victory";
  const bonus = lives * 10 + gold;
  showEnd("🏆 Thắng!", `Thưởng: ${bonus} điểm`);
}
function showEnd(title, sub){
  document.getElementById("td-endTitle").textContent = title;
  document.getElementById("td-endSub").textContent = sub;
  document.getElementById("td-endPopup").style.display = "flex";
}
function restart(){
  towers = []; enemies = []; projectiles = []; particles = [];
  gold = 200; lives = 20; wave = 0;
  selectedTower = null; selectedPlaced = null;
  waveInProgress = false; gameState = "build";
  spawnQueue = [];
  document.getElementById("td-endPopup").style.display = "none";
  document.getElementById("td-log").innerHTML = "";
  updateHUD(); updatePanel();
  log("Game mới! Đặt tháp rồi bấm bắt đầu.");
}

document.addEventListener("DOMContentLoaded", () => {
  // init được gọi từ manifest sau khi load script
});
window.TDInit = init;
window.TDRestart = restart;

})();
