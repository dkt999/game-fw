/* Nông Trại Vui Vẻ — game logic (v1) */
(function () {
'use strict';
window.FarmGame = window.FarmGame || {};

/* ============ CẤU HÌNH ============ */
const SAVE_KEY = 'farm_save_v1';
const AUTO_MS = 600000, AUTO_COIN = 100, OFFLINE_CAP = 8 * 3600 * 1000;
const MOIST_DRAIN_MS = 150000;   // 100 -> 0 trong 150s
const WITHER_MS = 90000;         // 0 ẩm quá 90s -> chết
const PEST_PER_SEC = 0.0011;     // tỉ lệ sâu /ô /giây
const PEST_CURE_MS = 90000;      // 90s không chữa -> chết
const FERT_BOOST = 0.40;         // phân bón: +40% tiến độ
const MAX_PLOTS = 24, START_PLOTS = 6;

const CROPS = {
    rau_muong:  { name: 'Rau muống',  lv: 1, vip: false, seed: 10,  grow: 120,  yield: 25,   exp: 6   },
    nam_linhchi:{ name: 'Nấm linh chi', lv: 2, vip: true, seed: 300, grow: 1200, yield: 800,  exp: 60  },
    ca_chua:    { name: 'Cà chua',    lv: 3, vip: false, seed: 30,  grow: 300,  yield: 70,   exp: 14  },
    nhan_sam:   { name: 'Nhân sâm',   lv: 4, vip: true,  seed: 500, grow: 1800, yield: 1500, exp: 120 },
    dua_hau:    { name: 'Dưa hấu',    lv: 5, vip: false, seed: 80,  grow: 720,  yield: 200,  exp: 30  },
};
const CROP_ORDER = ['rau_muong', 'nam_linhchi', 'ca_chua', 'nhan_sam', 'dua_hau'];
const LAND_PRICES = [150,250,400,600,900,1300,1800,2400,3200,4200,5500,7000,9000,11500,14500,18000,22000,27000];
const POND = { fry: 100, feed: 20, grow: 300, sell: 300, name: 'Cá' };
const COOP = { fry: 80,  feed: 15, grow: 240, sell: 0,   name: 'Gà' };
const EGG_PRICE = 60, EGGS_PER_HARVEST = 3;
const ITEMS = {
    thuoc:     { name: 'Thuốc trừ sâu', price: 50,   desc: 'Chữa 1 cây bị sâu (chạm vào con sâu)', icon: '🧪' },
    scarecrow: { name: 'Bù nhìn',       price: 500,  desc: '30 phút không sâu bệnh toàn farm',     icon: '🎃' },
    fence:     { name: 'Hàng rào',      price: 1000, desc: 'Vĩnh viễn giảm 50% sâu bệnh',           icon: '🪵', once: true },
    phan:      { name: 'Phân bón',      price: 120,  desc: 'Cây lớn ngay +40% (tool Bón phân)',    icon: '🌾' },
};

/* ============ SVG ART (nét vẽ đồng nhất) ============ */
const ST = 'stroke="#4a2f16" stroke-width="3" stroke-linecap="round"';
function svgW(inner) { return '<svg viewBox="0 0 64 64">' + inner + '</svg>'; }
function leaf(cx, cy, rx, ry, rot, fill) {
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry +
        '" fill="' + (fill || '#7cc24a') + '" ' + ST + ' transform="rotate(' + rot + ' ' + cx + ' ' + cy + ')"/>';
}
function stem(x1, y1, x2, y2, w) {
    return '<path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" stroke="#3f7a1f" stroke-width="' + (w || 4) + '" stroke-linecap="round"/>';
}
const SEED_SVG = svgW('<ellipse cx="32" cy="46" rx="14" ry="7" fill="#6b4423" ' + ST + '/>' +
    '<circle cx="26" cy="44" r="2.5" fill="#a06a35"/><circle cx="34" cy="47" r="2.5" fill="#a06a35"/><circle cx="39" cy="43" r="2" fill="#c08a4d"/>');
const WITHER_SVG = svgW('<path d="M32 50 C30 40 26 34 18 32" stroke="#7a5a2e" stroke-width="4" fill="none" stroke-linecap="round"/>' +
    leaf(16, 30, 7, 4, -30, '#a8894a') + leaf(28, 36, 6, 4, 20, '#96702f') +
    '<path d="M32 50 C34 42 38 38 44 38" stroke="#7a5a2e" stroke-width="4" fill="none" stroke-linecap="round"/>' + leaf(46, 37, 6, 4, 25, '#a8894a'));

function cropSVG(id, stage) {
    if (stage <= 0) return SEED_SVG;
    let s = '';
    if (id === 'rau_muong') {
        if (stage === 1) s = stem(32, 50, 32, 34) + leaf(25, 38, 7, 4, -25) + leaf(39, 34, 7, 4, 25);
        else if (stage === 2) s = stem(32, 50, 32, 28) + leaf(24, 40, 8, 5, -25) + leaf(40, 40, 8, 5, 25) + leaf(25, 30, 7, 4, -35, '#8fd14f') + leaf(39, 30, 7, 4, 35, '#8fd14f');
        else s = leaf(32, 40, 16, 12, 0) + leaf(22, 34, 9, 6, -30, '#8fd14f') + leaf(42, 34, 9, 6, 30, '#8fd14f') + leaf(32, 28, 9, 6, 0, '#a5e075');
    } else if (id === 'ca_chua') {
        if (stage === 1) s = stem(32, 50, 32, 32) + leaf(25, 38, 7, 4, -25) + leaf(39, 34, 7, 4, 25);
        else {
            s = stem(32, 52, 32, 22) + stem(32, 36, 22, 28, 3) + stem(32, 30, 42, 24, 3) +
                leaf(24, 30, 7, 4, -25) + leaf(40, 26, 7, 4, 25) + leaf(32, 20, 7, 4, 0, '#8fd14f');
            const col = stage === 2 ? '#7cc24a' : '#e53935';
            const fruit = (cx, cy, r) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + col + '" ' + ST + '/><circle cx="' + (cx - 2) + '" cy="' + (cy - 2) + '" r="1.6" fill="#ffffff" opacity=".7"/>';
            s += stage === 2 ? fruit(24, 40, 5) + fruit(40, 38, 5) + fruit(32, 44, 5)
                             : fruit(22, 40, 7) + fruit(42, 38, 7) + fruit(32, 46, 7) + fruit(32, 32, 6);
        }
    } else if (id === 'dua_hau') {
        const melon = (cx, cy, r) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#4caf50" ' + ST + '/>' +
            '<path d="M' + (cx - r * .5) + ' ' + (cy - r * .8) + ' Q' + cx + ' ' + cy + ' ' + (cx - r * .5) + ' ' + (cy + r * .8) + '" stroke="#1b5e20" stroke-width="2.5" fill="none"/>' +
            '<path d="M' + (cx + r * .5) + ' ' + (cy - r * .8) + ' Q' + cx + ' ' + cy + ' ' + (cx + r * .5) + ' ' + (cy + r * .8) + '" stroke="#1b5e20" stroke-width="2.5" fill="none"/>';
        if (stage === 1) s = stem(32, 50, 32, 36) + leaf(25, 40, 7, 4, -25) + leaf(39, 38, 7, 4, 25);
        else if (stage === 2) s = '<path d="M14 46 Q32 38 50 46" stroke="#3f7a1f" stroke-width="4" fill="none" stroke-linecap="round"/>' + leaf(24, 40, 7, 4, -20) + leaf(42, 40, 7, 4, 20) + melon(32, 44, 8);
        else s = '<path d="M10 46 Q32 36 54 46" stroke="#3f7a1f" stroke-width="5" fill="none" stroke-linecap="round"/>' + leaf(20, 38, 8, 5, -20) + leaf(46, 38, 8, 5, 20) + melon(22, 44, 11) + melon(44, 42, 12);
    } else if (id === 'nam_linhchi') {
        const fan = (cx, cy, r, col) => '<path d="M' + (cx - r) + ' ' + cy + ' A' + r + ' ' + r + ' 0 0 1 ' + (cx + r) + ' ' + cy + ' Z" fill="' + col + '" ' + ST + '/>' +
            '<path d="M' + (cx - r * .55) + ' ' + cy + ' A' + (r * .55) + ' ' + (r * .55) + ' 0 0 1 ' + (cx + r * .55) + ' ' + cy + '" stroke="#f5e6c8" stroke-width="2.5" fill="none"/>';
        if (stage === 1) s = '<rect x="28" y="38" width="8" height="12" rx="3" fill="#8a5a33" ' + ST + '/><circle cx="32" cy="36" r="5" fill="#c98a4b" ' + ST + '/>';
        else if (stage === 2) s = '<rect x="29" y="40" width="7" height="12" rx="3" fill="#8a5a33" ' + ST + '/>' + fan(32, 38, 10, '#b5651d') + '<rect x="20" y="44" width="6" height="8" rx="3" fill="#8a5a33" ' + ST + '/>' + fan(23, 42, 7, '#c98a4b');
        else s = '<rect x="29" y="40" width="8" height="12" rx="3" fill="#6b4423" ' + ST + '/>' + fan(33, 38, 14, '#a83232') +
                 '<rect x="16" y="44" width="7" height="9" rx="3" fill="#6b4423" ' + ST + '/>' + fan(20, 42, 9, '#c04444') +
                 '<rect x="44" y="44" width="7" height="9" rx="3" fill="#6b4423" ' + ST + '/>' + fan(48, 42, 9, '#c04444');
    } else if (id === 'nhan_sam') {
        if (stage === 1) s = stem(32, 50, 32, 34) + leaf(25, 40, 6, 4, -25, '#8fd14f') + leaf(39, 38, 6, 4, 25, '#8fd14f');
        else {
            s = stem(32, 52, 32, 24) +
                leaf(32, 22, 8, 5, 0, '#8fd14f') + leaf(22, 30, 8, 5, -40, '#7cc24a') + leaf(42, 30, 8, 5, 40, '#7cc24a') +
                leaf(24, 40, 7, 4, -20, '#a5e075') + leaf(40, 40, 7, 4, 20, '#a5e075');
            if (stage === 3) {
                s += '<circle cx="28" cy="30" r="3.4" fill="#e53935" ' + ST + '/><circle cx="37" cy="29" r="3.4" fill="#e53935" ' + ST + '/><circle cx="32" cy="35" r="3.4" fill="#ff6f60" ' + ST + '/>';
                s += '<path d="M28 52 q4 6 0 8 M36 52 q-4 6 0 8" stroke="#e8c98a" stroke-width="4" fill="none" stroke-linecap="round"/>';
            }
        }
    }
    return svgW(s);
}
const FISH_SVG = svgW('<ellipse cx="30" cy="32" rx="14" ry="9" fill="#ff9d2e" ' + ST + '/>' +
    '<path d="M44 32 L56 24 L56 40 Z" fill="#ff9d2e" ' + ST + '/><circle cx="24" cy="30" r="2.6" fill="#222"/><path d="M30 24 q6 -6 12 -3" stroke="#e07b00" stroke-width="3" fill="none" stroke-linecap="round"/>');
const CHICK_SVG = svgW('<circle cx="32" cy="38" r="13" fill="#fff59d" ' + ST + '/><circle cx="32" cy="22" r="8" fill="#fff59d" ' + ST + '/>' +
    '<path d="M26 16 l2 -6 3 5 3 -5 2 6 Z" fill="#e53935" ' + ST + '/><path d="M40 22 l7 2 -7 3 Z" fill="#ff9d2e" ' + ST + '/><circle cx="30" cy="21" r="1.8" fill="#222"/>');
const HEN_SVG = svgW('<ellipse cx="30" cy="40" rx="14" ry="11" fill="#ffffff" ' + ST + '/><circle cx="42" cy="26" r="8" fill="#ffffff" ' + ST + '/>' +
    '<path d="M36 20 l2 -6 3 5 3 -5 2 6 Z" fill="#e53935" ' + ST + '/><path d="M50 26 l7 2 -7 3 Z" fill="#ff9d2e" ' + ST + '/><circle cx="40" cy="25" r="1.8" fill="#222"/>' +
    '<ellipse cx="16" cy="48" rx="7" ry="9" fill="#fff8e7" ' + ST + '/><ellipse cx="28" cy="50" rx="7" ry="9" fill="#fff8e7" ' + ST + '/>');
const EGG_SVG = svgW('<ellipse cx="32" cy="34" rx="11" ry="14" fill="#fff8e7" ' + ST + '/><ellipse cx="28" cy="30" rx="3" ry="5" fill="#ffffff" opacity=".8"/>');

/* ============ STATE ============ */
let S = null, winId = null, tool = 'seed', selSeed = 'rau_muong', tab = 'vuon';
let toastTimer = null, lastTick = 0, saveTimer = 0;
const plotSig = {}, pondSig = {}, coopSig = {};

function newState() {
    const plots = [];
    for (let i = 0; i < MAX_PLOTS; i++) plots.push({ unlocked: i < START_PLOTS, crop: null });
    return {
        coins: 200, level: 1, exp: 0, plots: plots,
        pond: [{ st: 'empty' }, { st: 'empty' }, { st: 'empty' }],
        coop: [{ st: 'empty' }, { st: 'empty' }, { st: 'empty' }],
        inv: { trung: 0, phan: 0, thuoc: 2 },
        fence: false, scarecrowUntil: 0, autoAcc: 0,
        lastSeen: Date.now(), seenHelp: false,
    };
}
function save() { try { S.lastSeen = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
function load() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (!s || !Array.isArray(s.plots)) return null;
        return Object.assign(newState(), s);
    } catch (e) { return null; }
}

/* ============ ÂM THANH ============ */
let soundOn = true, AC = null;
function beep(f, d, type, when) {
    if (!soundOn) return;
    try {
        AC = AC || new (window.AudioContext || window.webkitAudioContext)();
        const t = AC.currentTime + (when || 0);
        const o = AC.createOscillator(), g = AC.createGain();
        o.type = type || 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
        o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + d);
    } catch (e) {}
}
const sfx = {
    plant: () => beep(330, .12),
    water: () => { beep(520, .1); beep(660, .12, 'sine', .08); },
    harvest: () => { beep(660, .1); beep(880, .14, 'sine', .09); },
    coin: () => beep(1320, .08, 'square'),
    err: () => beep(160, .18, 'sawtooth'),
    level: () => { beep(523, .12); beep(659, .12, 'sine', .1); beep(784, .2, 'sine', .2); },
};

/* ============ TIỆN ÍCH ============ */
function $(sel, root) { return (root || document).querySelector(sel); }
function fmtT(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
}
function expNeed(lv) { return 60 * lv; }
function toast(msg, ms) {
    const el = $('#farm-toast');
    if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms || 2200);
}
function openModal(html) {
    $('#farm-modal-box').innerHTML = html;
    $('#farm-modal').style.display = 'flex';
}
function closeModal() { $('#farm-modal').style.display = 'none'; }
function gainExp(n) {
    S.exp += n;
    while (S.exp >= expNeed(S.level)) {
        S.exp -= expNeed(S.level); S.level++;
        const bonus = 50 * S.level;
        S.coins += bonus; sfx.level();
        toast('🎉 Lên cấp ' + S.level + '! Thưởng ' + bonus + ' xu' + unlockMsg());
    }
}
function unlockMsg() {
    const u = [];
    if (S.level === 2) u.push('mở Ao 🐟 + Nấm linh chi');
    if (S.level === 3) u.push('mở Chuồng 🐔 + Cà chua');
    if (S.level === 4) u.push('mở Nhân sâm');
    if (S.level === 5) u.push('mở Dưa hấu');
    return u.length ? ' — ' + u.join(', ') : '';
}
function cropUnlocked(id) { return S.level >= CROPS[id].lv; }
function aoUnlocked() { return S.level >= 2; }
function chuongUnlocked() { return S.level >= 3; }

/* ============ LOGIC Ô ĐẤT ============ */
function cropProgress(c, now) {
    const grown = now - c.t0 - (c.paused || 0);
    return Math.min(1, grown / (CROPS[c.id].grow * 1000));
}
function cropStage(c, now) {
    const p = cropProgress(c, now);
    if (p >= 1) return 3;
    if (p >= 0.55) return 2;
    if (p >= 0.18) return 1;
    return 0;
}
function cropWater(c, now) {
    return Math.max(0, 100 - (now - c.lastWater) / (MOIST_DRAIN_MS / 100));
}
/* cập nhật trạng thái 1 ô (chết/héo/sâu). Trả về true nếu có thay đổi cấu trúc */
function updatePlot(p, now, rep) {
    const c = p.crop;
    if (!c || c.dead) return false;
    let changed = false;
    const w = cropWater(c, now);
    if (w <= 0) {
        if (!c.drySince) { c.drySince = now; changed = true; }
        else if (now - c.drySince > WITHER_MS) {
            c.dead = true; changed = true;
            if (rep) rep.dead++;
        }
    } else if (c.drySince) { c.drySince = null; changed = true; }
    // sâu bệnh ngẫu nhiên (chỉ khi cây đang lớn, chưa chín)
    if (!c.dead && !c.pestStart && cropProgress(c, now) < 1) {
        let ch = PEST_PER_SEC;
        if (S.fence) ch *= 0.5;
        if (now < S.scarecrowUntil) ch = 0;
        if (ch > 0 && Math.random() < ch) { c.pestStart = now; changed = true; }
    }
    if (c.pestStart && now - c.pestStart > PEST_CURE_MS) {
        c.dead = true; c.pestStart = null; changed = true;
        if (rep) rep.dead++;
    }
    return changed;
}
function curePest(p) {
    const c = p.crop;
    if (!c || !c.pestStart) return false;
    if (S.inv.thuoc <= 0) { sfx.err(); toast('Hết thuốc trừ sâu! Mua ở Cửa hàng → Vật phẩm.'); openShop('vatpham'); return false; }
    S.inv.thuoc--;
    c.paused = (c.paused || 0) + (Date.now() - c.pestStart);
    c.pestStart = null;
    sfx.water(); toast('🧪 Đã chữa sâu!');
    return true;
}

/* ============ RENDER ============ */
function plotHTML(i) {
    const p = S.plots[i];
    if (!p.unlocked) {
        const price = LAND_PRICES[S.plots.filter(x => x.unlocked).length - START_PLOTS] || 0;
        return '<div class="soil"></div><div style="font-size:26px">🌱</div><div class="price">🪙 ' + price + '</div><div style="font-size:11px">Mở đất</div>';
    }
    const c = p.crop;
    if (!c) return '<div class="soil"></div>';
    const now = Date.now();
    const st = cropStage(c, now), w = cropWater(c, now);
    const mature = cropProgress(c, now) >= 1 && !c.dead;
    let h = '<div class="soil"></div>';
    h += '<div class="farm-plant">' + (c.dead ? WITHER_SVG : cropSVG(c.id, st)) + '</div>';
    h += '<div class="farm-moist' + (w < 30 ? ' low' : '') + '"><i style="width:' + Math.round(w) + '%"></i></div>';
    if (c.pestStart && !c.dead) h += '<div class="farm-pest" data-pest="' + i + '">🐛</div>';
    if (c.dead) h += '<div class="farm-badge">💀</div>';
    else if (mature) h += '<div class="farm-badge">🧺</div>';
    else if (w <= 0) h += '<div class="farm-badge">🥵</div>';
    else {
        const left = CROPS[c.id].grow * 1000 - (now - c.t0 - (c.paused || 0));
        if (left > 0) h += '<div class="farm-timer">' + fmtT(left) + '</div>';
    }
    return h;
}
function plotSignature(i) {
    const p = S.plots[i];
    if (!p.unlocked) return 'L';
    const c = p.crop;
    if (!c) return 'E';
    const now = Date.now();
    return (c.dead ? 'D' : 'G' + cropStage(c, now)) + (c.pestStart ? 'P' : '') + (cropWater(c, now) <= 0 ? 'W' : '');
}
function renderGrid(force) {
    const g = $('#farm-grid');
    if (!g) return;
    if (!g.children.length || force) {
        g.innerHTML = S.plots.map((_, i) =>
            '<div class="farm-plot" data-i="' + i + '" id="farm-plot-' + i + '">' + plotHTML(i) + '</div>').join('');
        S.plots.forEach((_, i) => plotSig[i] = plotSignature(i));
        S.plots.forEach((_, i) => { if (!S.plots[i].unlocked) $('#farm-plot-' + i).classList.add('locked'); });
        return;
    }
    S.plots.forEach((_, i) => {
        const sig = plotSignature(i);
        if (sig !== plotSig[i]) {
            plotSig[i] = sig;
            const el = $('#farm-plot-' + i);
            el.innerHTML = plotHTML(i);
            el.classList.toggle('locked', !S.plots[i].unlocked);
        }
    });
    // cập nhật thanh ẩm + đồng hồ mỗi tick (rẻ)
    const now = Date.now();
    S.plots.forEach((p, i) => {
        if (!p.unlocked || !p.crop || p.crop.dead) return;
        const el = $('#farm-plot-' + i);
        const bar = el.querySelector('.farm-moist i');
        if (bar) {
            const w = cropWater(p.crop, now);
            bar.style.width = Math.round(w) + '%';
            bar.parentElement.classList.toggle('low', w < 30);
        }
        const t = el.querySelector('.farm-timer');
        if (t) {
            const left = CROPS[p.crop.id].grow * 1000 - (now - p.crop.t0 - (p.crop.paused || 0));
            t.textContent = fmtT(left);
        }
    });
}
function slotHTML(kind, i) {
    const arr = kind === 'pond' ? S.pond : S.coop;
    const cfg = kind === 'pond' ? POND : COOP;
    const s = arr[i];
    if (s.st === 'empty') return '<div class="plus">＋</div><div style="font-size:11px;color:#fff">Mua ' + cfg.name.toLowerCase() + ' giống 🪙' + cfg.fry + '</div>';
    if (s.st === 'grow') {
        const feeds = s.feeds, need = 2;
        let h = '<div class="swim">' + (kind === 'pond' ? FISH_SVG : CHICK_SVG) + '</div>';
        if (feeds < need) h += '<div class="farm-badge">🍽️</div><div style="font-size:11px;color:#fff">Cho ăn (' + feeds + '/' + need + ') 🪙' + cfg.feed + '</div>';
        else {
            const left = s.tReady - Date.now();
            h += left > 0 ? '<div class="farm-timer">' + fmtT(left) + '</div>' : '<div class="farm-badge">✨</div>';
        }
        return h;
    }
    return '<div class="swim">' + (kind === 'pond' ? FISH_SVG : HEN_SVG) + '</div><div class="farm-badge">🧺</div><div style="font-size:11px;color:#fff">Thu hoạch!</div>';
}
function slotSig(kind, i) {
    const arr = kind === 'pond' ? S.pond : S.coop;
    const s = arr[i];
    return s.st + '|' + (s.feeds || 0) + '|' + (s.st === 'ready' ? 'R' : (s.st === 'grow' && s.feeds >= 2 && Date.now() >= s.tReady ? 'R2' : ''));
}
function renderSlots(kind, force) {
    const el = kind === 'pond' ? $('#farm-pond') : $('#farm-coop');
    if (!el) return;
    const sigs = kind === 'pond' ? pondSig : coopSig;
    const arr = kind === 'pond' ? S.pond : S.coop;
    if (!el.children.length || force) {
        el.innerHTML = arr.map((_, i) =>
            '<div class="farm-slot" data-kind="' + kind + '" data-i="' + i + '" id="farm-' + kind + '-' + i + '">' + slotHTML(kind, i) + '</div>').join('');
        arr.forEach((_, i) => sigs[i] = slotSig(kind, i));
        return;
    }
    arr.forEach((_, i) => {
        const sig = slotSig(kind, i);
        if (sig !== sigs[i]) { sigs[i] = sig; $('#farm-' + kind + '-' + i).innerHTML = slotHTML(kind, i); }
    });
}
function renderHUD() {
    $('#farm-coins b').textContent = S.coins.toLocaleString('vi-VN');
    $('#farm-level').textContent = S.level;
    $('#farm-expfill').style.width = Math.min(100, S.exp / expNeed(S.level) * 100) + '%';
    const left = AUTO_MS - (S.autoAcc % AUTO_MS);
    $('#farm-autotime').textContent = fmtT(left);
    $('#farm-tab-ao').classList.toggle('locked', !aoUnlocked());
    $('#farm-tab-ao').querySelector('.farm-lock').style.display = aoUnlocked() ? 'none' : '';
    $('#farm-tab-chuong').classList.toggle('locked', !chuongUnlocked());
    $('#farm-tab-chuong').querySelector('.farm-lock').style.display = chuongUnlocked() ? 'none' : '';
    let sc = '';
    if (Date.now() < S.scarecrowUntil) sc = ' 🎃' + fmtT(S.scarecrowUntil - Date.now());
    if (S.fence) sc += ' 🪵';
    $('#farm-autocoin').title = 'Xu tự động: +100 mỗi 10 phút' + sc;
}
function renderSeedbar() {
    const bar = $('#farm-seedbar');
    if (tool !== 'seed') { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    bar.innerHTML = CROP_ORDER.map(id => {
        const c = CROPS[id], un = cropUnlocked(id);
        return '<div class="farm-seed' + (id === selSeed ? ' sel' : '') + (c.vip ? ' vip' : '') + '" data-seed="' + id + '"' +
            (un ? '' : ' style="opacity:.45"') + '>' +
            '<div style="font-size:24px">' + (c.vip ? '💎' : '🌱') + '</div>' +
            '<div class="p">' + c.name + (c.vip ? '<span class="vip-tag" style="background:#b5179e;color:#fff;font-size:10px;border-radius:6px;padding:1px 6px">VIP</span>' : '') + '</div>' +
            '<div class="c">🪙' + c.seed + ' · ' + (un ? 'Lv' + c.lv : '🔒Lv' + c.lv) + '</div></div>';
    }).join('');
}
function renderAll(force) { renderGrid(force); renderSlots('pond', force); renderSlots('coop', force); renderHUD(); }

/* ============ TƯƠNG TÁC ============ */
function root() { return document.getElementById(winId); }
function setTool(t) {
    tool = t;
    root().querySelectorAll('.farm-tool').forEach(b => b.classList.toggle('sel', b.dataset.tool === t));
    renderSeedbar();
}
function buyLand(i) {
    const unlocked = S.plots.filter(x => x.unlocked).length;
    const price = LAND_PRICES[unlocked - START_PLOTS];
    if (price == null) { toast('Đã mở hết đất!'); return; }
    if (S.coins < price) { sfx.err(); toast('Không đủ xu! Cần 🪙' + price); return; }
    S.coins -= price; S.plots[i].unlocked = true;
    sfx.coin(); toast('🌱 Đã mở thêm 1 ô đất!');
    gainExp(5); renderGrid(true); save();
}
function onPlotClick(e, i) {
    const p = S.plots[i];
    if (!p.unlocked) { buyLand(i); return; }
    if (e.target.closest('[data-pest]')) { if (curePest(p)) { renderGrid(true); save(); } return; }
    const c = p.crop, now = Date.now();
    if (tool === 'seed') {
        if (c) { toast('Ô này đã có cây rồi!'); return; }
        const cp = CROPS[selSeed];
        if (!cropUnlocked(selSeed)) { sfx.err(); toast('Cần cấp ' + cp.lv + ' để trồng ' + cp.name); return; }
        if (S.coins < cp.seed) { sfx.err(); toast('Không đủ xu mua giống!'); return; }
        S.coins -= cp.seed;
        p.crop = { id: selSeed, t0: now, paused: 0, pestStart: null, lastWater: now, drySince: null, dead: false };
        gainExp(2); sfx.plant(); renderGrid(true); save();
    } else if (tool === 'water') {
        if (!c) { toast('Ô trống, gieo hạt trước đã!'); return; }
        if (c.dead) { sfx.err(); toast('Cây đã chết — dùng tool Dọn 🧹'); return; }
        c.lastWater = now; c.drySince = null;
        sfx.water(); renderGrid(false); save();
    } else if (tool === 'harvest') {
        if (!c || c.dead || cropProgress(c, now) < 1) { toast('Chưa có gì để thu hoạch!'); return; }
        const cp = CROPS[c.id];
        S.coins += cp.yield; gainExp(cp.exp); p.crop = null;
        sfx.harvest(); setTimeout(() => sfx.coin(), 120);
        toast('🧺 Thu hoạch ' + cp.name + ' +' + cp.yield + ' xu!');
        renderGrid(true); save();
    } else if (tool === 'fertilize') {
        if (!c || c.dead || cropProgress(c, now) >= 1) { toast('Chỉ bón cho cây đang lớn!'); return; }
        if (S.inv.phan <= 0) { sfx.err(); toast('Hết phân bón! Nuôi cá/gà để nhận thêm.'); return; }
        S.inv.phan--; c.t0 -= FERT_BOOST * CROPS[c.id].grow * 1000;
        sfx.water(); toast('🌾 Cây lớn vọt +40%!');
        renderGrid(true); save();
    } else if (tool === 'clear') {
        if (!c) { toast('Ô đã trống.'); return; }
        if (!c.dead) { sfx.err(); toast('Cây đang sống — chỉ dọn được cây chết 💀'); return; }
        p.crop = null; toast('🧹 Đã dọn ô đất.');
        renderGrid(true); save();
    }
}
function onSlotClick(kind, i) {
    if (kind === 'pond' && !aoUnlocked()) { sfx.err(); toast('Lên cấp 2 để mở Ao 🐟'); return; }
    if (kind === 'coop' && !chuongUnlocked()) { sfx.err(); toast('Lên cấp 3 để mở Chuồng 🐔'); return; }
    const arr = kind === 'pond' ? S.pond : S.coop;
    const cfg = kind === 'pond' ? POND : COOP;
    const s = arr[i], now = Date.now();
    if (s.st === 'empty') {
        if (S.coins < cfg.fry) { sfx.err(); toast('Không đủ xu! Cần 🪙' + cfg.fry); return; }
        S.coins -= cfg.fry; s.st = 'grow'; s.feeds = 0; s.tReady = 0;
        gainExp(3); sfx.plant(); renderSlots(kind, true); save();
    } else if (s.st === 'grow') {
        if (s.feeds < 2) {
            if (S.coins < cfg.feed) { sfx.err(); toast('Không đủ xu mua thức ăn!'); return; }
            S.coins -= cfg.feed; s.feeds++;
            if (s.feeds >= 2) s.tReady = now + cfg.grow * 1000;
            sfx.water(); toast('🍽️ Cho ăn (' + s.feeds + '/2)');
            renderSlots(kind, true); save();
        } else toast('Đang lớn, chờ ' + fmtT(s.tReady - now) + ' nữa...');
    } else {
        if (kind === 'pond') {
            S.coins += cfg.sell; S.inv.phan++; gainExp(10);
            toast('🐟 Thu hoạch cá +' + cfg.sell + ' xu, +1 phân bón!');
        } else {
            S.inv.trung += EGGS_PER_HARVEST; S.inv.phan++; gainExp(10);
            toast('🥚 Thu ' + EGGS_PER_HARVEST + ' trứng gà, +1 phân bón!');
        }
        s.st = 'empty'; s.feeds = 0;
        sfx.harvest(); setTimeout(() => sfx.coin(), 120);
        renderSlots(kind, true); save();
    }
}

/* ============ SHOP / KHO / HELP ============ */
let shopTab = 'hatgiong';
function openShop(tab) {
    shopTab = tab || shopTab;
    const tabs = [['hatgiong', '🌱 Hạt giống'], ['ca_ga', '🐟 Cá & Gà'], ['vatpham', '🛡️ Vật phẩm'], ['modat', '🌍 Mở đất']];
    let body = '<h3>🛒 Cửa hàng <small style="font-size:13px">(🪙' + S.coins.toLocaleString('vi-VN') + ')</small></h3>';
    body += '<div class="farm-shop-tabs">' + tabs.map(t =>
        '<button class="farm-shop-tab' + (shopTab === t[0] ? ' active' : '') + '" data-stab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>';
    if (shopTab === 'hatgiong') {
        body += CROP_ORDER.map(id => {
            const c = CROPS[id], un = cropUnlocked(id), afford = S.coins >= c.seed;
            return '<div class="farm-item"><div class="ic">' + (c.vip ? '💎' : '🌱') + '</div><div class="inf"><b>' + c.name +
                (c.vip ? '<span class="vip-tag">VIP</span>' : '') + '</b><small>Cấp ' + c.lv + ' · ' + Math.floor(c.grow / 60) + ' phút · thu 🪙' + c.yield + ' · +' + c.exp + ' exp</small></div>' +
                (un ? '<button class="farm-buy" data-buyseed="' + id + '" ' + (afford ? '' : 'disabled') + '>🪙' + c.seed + '</button>'
                    : '<button class="farm-buy" disabled>🔒 Lv' + c.lv + '</button>') + '</div>';
        }).join('');
    } else if (shopTab === 'ca_ga') {
        body += '<div class="farm-item"><div class="ic">🐟</div><div class="inf"><b>Cá giống</b><small>🪙' + POND.fry + ' · cho ăn 2 lần (🪙' + POND.feed + '/lần) · ' + Math.floor(POND.grow / 60) + ' phút → bán 🪙' + POND.sell + ' + 1 phân bón' + (aoUnlocked() ? '' : ' · 🔒cấp 2') + '</small></div>' +
            '<button class="farm-buy" data-buyfish="1">Mua</button></div>';
        body += '<div class="farm-item"><div class="ic">🐔</div><div class="inf"><b>Gà giống</b><small>🪙' + COOP.fry + ' · cho ăn 2 lần (🪙' + COOP.feed + '/lần) · ' + Math.floor(COOP.grow / 60) + ' phút → ' + EGGS_PER_HARVEST + ' trứng + 1 phân bón' + (chuongUnlocked() ? '' : ' · 🔒cấp 3') + '</small></div>' +
            '<button class="farm-buy" data-buychick="1">Mua</button></div>';
    } else if (shopTab === 'vatpham') {
        body += Object.keys(ITEMS).map(k => {
            const it = ITEMS[k];
            const owned = k === 'fence' && S.fence;
            const cnt = k === 'thuoc' ? ' (đang có ' + S.inv.thuoc + ')' : k === 'phan' ? ' (đang có ' + S.inv.phan + ')' : '';
            return '<div class="farm-item"><div class="ic">' + it.icon + '</div><div class="inf"><b>' + it.name + cnt + '</b><small>' + it.desc + '</small></div>' +
                (owned ? '<button class="farm-buy" disabled>Đã có</button>'
                       : '<button class="farm-buy" data-buyitem="' + k + '" ' + (S.coins >= it.price ? '' : 'disabled') + '>🪙' + it.price + '</button>') + '</div>';
        }).join('');
        if (Date.now() < S.scarecrowUntil) body += '<p class="farm-note">🎃 Bù nhìn còn tác dụng ' + fmtT(S.scarecrowUntil - Date.now()) + '</p>';
    } else {
        const unlocked = S.plots.filter(x => x.unlocked).length;
        const price = LAND_PRICES[unlocked - START_PLOTS];
        body += '<div class="farm-item"><div class="ic">🌍</div><div class="inf"><b>Mở thêm ô đất</b><small>Đang có ' + unlocked + '/' + MAX_PLOTS + ' ô' + (price != null ? ' · ô tiếp theo 🪙' + price : ' · đã mở hết!') + '</small></div>' +
            (price != null ? '<button class="farm-buy" data-buyland="1" ' + (S.coins >= price ? '' : 'disabled') + '>🪙' + price + '</button>' : '') + '</div>';
        body += '<p class="farm-note">Mẹo: bấm trực tiếp vào ô đất 🔒 trên vườn để mua nhanh.</p>';
    }
    body += '<button class="farm-close" id="farm-mclose">Đóng</button>';
    openModal(body);
}
function buyToSlot(kind) {
    const arr = kind === 'pond' ? S.pond : S.coop;
    const cfg = kind === 'pond' ? POND : COOP;
    if (kind === 'pond' && !aoUnlocked()) { sfx.err(); toast('Lên cấp 2 để mở Ao 🐟'); return; }
    if (kind === 'coop' && !chuongUnlocked()) { sfx.err(); toast('Lên cấp 3 để mở Chuồng 🐔'); return; }
    const i = arr.findIndex(s => s.st === 'empty');
    if (i < 0) { sfx.err(); toast('Hết ô trống!'); return; }
    if (S.coins < cfg.fry) { sfx.err(); toast('Không đủ xu!'); return; }
    S.coins -= cfg.fry; arr[i] = { st: 'grow', feeds: 0, tReady: 0 };
    gainExp(3); sfx.plant(); toast('Đã thả ' + cfg.name.toLowerCase() + ' giống! Qua tab ' + (kind === 'pond' ? 'Ao 🐟' : 'Chuồng 🐔') + ' để cho ăn.');
    openShop(shopTab); renderSlots(kind, true); save();
}
function openKho() {
    let body = '<h3>🎒 Kho của bạn</h3>';
    body += '<div class="farm-kho-row"><span>🥚 Trứng gà × <b>' + S.inv.trung + '</b></span><span><button class="farm-buy" data-sell="trung1">Bán 1 (🪙' + EGG_PRICE + ')</button> <button class="farm-buy" data-sell="trungall">Bán hết</button></span></div>';
    body += '<div class="farm-kho-row"><span>🌾 Phân bón × <b>' + S.inv.phan + '</b></span><span style="font-size:12px;color:#7c5a2e">Dùng tool Bón phân</span></div>';
    body += '<div class="farm-kho-row"><span>🧪 Thuốc trừ sâu × <b>' + S.inv.thuoc + '</b></span><span style="font-size:12px;color:#7c5a2e">Chạm vào 🐛 để chữa</span></div>';
    body += '<button class="farm-close" id="farm-mclose">Đóng</button>';
    openModal(body);
}
function openHelp(first) {
    openModal('<div class="farm-help"><h3>❓ Cách chơi</h3>' +
        '<p>🌱 <b>Gieo:</b> chọn hạt giống rồi chạm ô đất trống. Mỗi cây cần <b>tưới nước</b> — thanh xanh cạn quá 90 giây là cây <b>chết</b> 💀.</p>' +
        '<p>💧 <b>Tưới:</b> chạm tool Tưới rồi chạm cây để làm đầy thanh ẩm.</p>' +
        '<p>🧺 <b>Thu hoạch</b> khi cây chín (hiện icon 🧺), bán lấy xu + điểm exp lên cấp mở cây mới.</p>' +
        '<p>🐛 <b>Sâu bệnh</b> ngẫu nhiên cắn cây — chạm con sâu để chữa (tốn 1 🧪). Quá 90 giây không chữa cây chết. Mua <b>Bù nhìn 🎃 / Hàng rào 🪵</b> để phòng.</p>' +
        '<p>🎁 <b>Xu tự động:</b> cứ 10 phút +100 xu, kể cả khi offline (tối đa 8 giờ).</p>' +
        '<p>🐟🐔 <b>Vườn–Ao–Chuồng:</b> cấp 2 mở Ao, cấp 3 mở Chuồng. Nuôi cá/gà → thu hoạch được <b>phân bón 🌾</b> giúp cây lớn vọt +40%.</p>' +
        '<p>💎 Cây <b>VIP</b> (Nấm linh chi, Nhân sâm) đắt nhưng lãi to.</p>' +
        '<button class="farm-close" id="farm-mclose">' + (first ? 'Bắt đầu chơi!' : 'Đóng') + '</button></div>');
}
function openReport(rep, dtMs) {
    const mins = Math.round(dtMs / 60000);
    const dur = mins >= 60 ? Math.floor(mins / 60) + ' giờ ' + (mins % 60) + ' phút' : mins + ' phút';
    openModal('<h3>⏰ Trong lúc bạn vắng mặt (' + dur + ')</h3>' +
        '<p class="farm-note" style="font-size:15px">🎁 Xu tự động: <b>+' + rep.coins + '</b><br>' +
        (rep.dead > 0 ? '💀 Có <b>' + rep.dead + '</b> cây bị héo/chết vì thiếu nước hoặc sâu bệnh.<br>' : '🌱 Mọi cây vẫn khỏe mạnh!<br>') +
        '</p><button class="farm-close" id="farm-mclose">Vào farm</button>');
}

/* ============ VÒNG LẶP GAME ============ */
function tick() {
    if (!winId || !document.getElementById(winId)) return; // window đã đóng -> nghỉ
    const now = Date.now(), dt = now - lastTick;
    lastTick = now;
    S.autoAcc += dt;
    let got = 0;
    while (S.autoAcc >= AUTO_MS) { S.autoAcc -= AUTO_MS; S.coins += AUTO_COIN; got += AUTO_COIN; }
    if (got > 0) { sfx.coin(); toast('🎁 +' + got + ' xu tự động!'); }
    S.plots.forEach(p => { if (p.unlocked && p.crop) updatePlot(p, now, null); });
    ['pond', 'coop'].forEach(k => {
        (k === 'pond' ? S.pond : S.coop).forEach(s => {
            if (s.st === 'grow' && s.feeds >= 2 && now >= s.tReady) { s.st = 'ready'; toast(k === 'pond' ? '🐟 Cá đã lớn, thu hoạch thôi!' : '🐔 Gà đã đẻ trứng!'); }
        });
    });
    renderGrid(false); renderSlots('pond', false); renderSlots('coop', false); renderHUD();
    saveTimer += dt;
    if (saveTimer > 5000) { saveTimer = 0; save(); }
}
function simulateOffline(dtMs, now) {
    const rep = { coins: 0, dead: 0 };
    const n = Math.floor(dtMs / AUTO_MS);
    S.coins += n * AUTO_COIN; rep.coins = n * AUTO_COIN;
    S.autoAcc = dtMs % AUTO_MS;
    const step = 10000, steps = Math.min(Math.ceil(dtMs / step), OFFLINE_CAP / step);
    let t = now - dtMs;
    for (let k = 0; k < steps; k++) {
        t += step;
        S.plots.forEach(p => { if (p.unlocked && p.crop) updatePlot(p, t, rep); });
        ['pond', 'coop'].forEach(kk => {
            (kk === 'pond' ? S.pond : S.coop).forEach(s => {
                if (s.st === 'grow' && s.feeds >= 2 && t >= s.tReady) s.st = 'ready';
            });
        });
    }
    return rep;
}

/* ============ INIT ============ */
function bindEvents() {
    const r = root();
    r.querySelector('#farm-grid').addEventListener('click', e => {
        const el = e.target.closest('.farm-plot');
        if (el) onPlotClick(e, +el.dataset.i);
    });
    ['pond', 'coop'].forEach(k => {
        r.querySelector('#farm-' + k).addEventListener('click', e => {
            const el = e.target.closest('.farm-slot');
            if (el) onSlotClick(el.dataset.kind, +el.dataset.i);
        });
    });
    r.querySelector('#farm-toolbar').addEventListener('click', e => {
        const b = e.target.closest('.farm-tool');
        if (b) { setTool(b.dataset.tool); beep(440, .06); }
    });
    r.querySelector('#farm-seedbar').addEventListener('click', e => {
        const s = e.target.closest('[data-seed]');
        if (s && cropUnlocked(s.dataset.seed)) { selSeed = s.dataset.seed; renderSeedbar(); beep(520, .07); }
        else if (s) { sfx.err(); toast('Cần cấp ' + CROPS[s.dataset.seed].lv + ' để mở ' + CROPS[s.dataset.seed].name); }
    });
    r.querySelector('.farm-tabs').addEventListener('click', e => {
        const b = e.target.closest('.farm-tab');
        if (!b) return;
        const t = b.dataset.tab;
        if (t === 'ao' && !aoUnlocked()) { sfx.err(); toast('Lên cấp 2 để mở Ao 🐟'); return; }
        if (t === 'chuong' && !chuongUnlocked()) { sfx.err(); toast('Lên cấp 3 để mở Chuồng 🐔'); return; }
        tab = t;
        r.querySelectorAll('.farm-tab').forEach(x => x.classList.toggle('active', x === b));
        r.querySelectorAll('.farm-pane').forEach(x => x.classList.toggle('active', x.id === 'farm-pane-' + t));
    });
    r.querySelector('#farm-btn-shop').addEventListener('click', () => openShop('hatgiong'));
    r.querySelector('#farm-btn-kho').addEventListener('click', openKho);
    r.querySelector('#farm-btn-help').addEventListener('click', () => openHelp(false));
    r.querySelector('#farm-btn-sound').addEventListener('click', function () {
        soundOn = !soundOn; this.textContent = soundOn ? '🔊' : '🔇';
    });
    r.querySelector('#farm-modal').addEventListener('click', e => {
        if (e.target.id === 'farm-modal') closeModal();
        const mc = e.target.closest('#farm-mclose');
        if (mc) closeModal();
        const st = e.target.closest('[data-stab]');
        if (st) openShop(st.dataset.stab);
        const bs = e.target.closest('[data-buyseed]');
        if (bs) { selSeed = bs.dataset.buyseed; setTool('seed'); closeModal(); toast('Đã chọn giống ' + CROPS[selSeed].name + ' — chạm ô đất để gieo!'); }
        if (e.target.closest('[data-buyfish]')) buyToSlot('pond');
        if (e.target.closest('[data-buychick]')) buyToSlot('coop');
        const bi = e.target.closest('[data-buyitem]');
        if (bi) {
            const k = bi.dataset.buyitem, it = ITEMS[k];
            if (S.coins < it.price) { sfx.err(); return; }
            S.coins -= it.price;
            if (k === 'thuoc') S.inv.thuoc++;
            else if (k === 'phan') S.inv.phan++;
            else if (k === 'scarecrow') S.scarecrowUntil = Date.now() + 30 * 60000;
            else if (k === 'fence') S.fence = true;
            sfx.coin(); toast('Đã mua ' + it.name + '!');
            openShop(shopTab); renderHUD(); save();
        }
        if (e.target.closest('[data-buyland]')) {
            const idx = S.plots.findIndex(x => !x.unlocked);
            if (idx >= 0) { buyLand(idx); openShop(shopTab); }
        }
        const sl = e.target.closest('[data-sell]');
        if (sl) {
            const how = sl.dataset.sell;
            if (S.inv.trung <= 0) { sfx.err(); toast('Không có trứng để bán!'); return; }
            const n = how === 'trungall' ? S.inv.trung : 1;
            S.inv.trung -= n; S.coins += n * EGG_PRICE; gainExp(n);
            sfx.coin(); toast('🥚 Bán ' + n + ' trứng +' + (n * EGG_PRICE) + ' xu!');
            openKho(); renderHUD(); save();
        }
    });
    // listener toàn cục chỉ gắn 1 lần
    if (!window.FarmGame._docBound) {
        window.FarmGame._docBound = true;
        document.addEventListener('visibilitychange', () => { if (document.hidden && S) save(); });
        window.addEventListener('beforeunload', () => { if (S) save(); });
    }
}

window.FarmGame.init = function (id) {
    if (window.FarmGame._timer) clearInterval(window.FarmGame._timer);
    winId = id;
    S = S || load() || newState();
    const now = Date.now(), dt = now - (S.lastSeen || now);
    let rep = null;
    if (dt > 5000) rep = simulateOffline(Math.min(dt, OFFLINE_CAP), now);
    save();
    renderAll(true); setTool('seed'); bindEvents();
    lastTick = Date.now();
    window.FarmGame._timer = setInterval(tick, 1000);
    if (!S.seenHelp) { S.seenHelp = true; save(); openHelp(true); }
    else if (rep && dt > 120000 && (rep.coins > 0 || rep.dead > 0)) openReport(rep, Math.min(dt, OFFLINE_CAP));
};
/* hook cho test/debug console */
window.FarmGame._debug = {
    get S() { return S; },
    CROPS: CROPS, LAND_PRICES: LAND_PRICES, POND: POND, COOP: COOP, ITEMS: ITEMS,
    tick: tick, updatePlot: updatePlot, cropStage: cropStage, cropWater: cropWater,
    renderAll: renderAll, openShop: openShop,
};
})();
