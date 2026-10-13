(function(){
"use strict";

/* ============ Bài ============ */
// rank: 3..15 (3=3 ... 10=10, 11=J, 12=Q, 13=K, 14=A, 15=2)
// suit: 0=♠ 1=♣ 2=♦ 3=♥
const SUITS = ["♠", "♣", "♦", "♥"];
const SUIT_RED = [false, false, true, true];
const RANK_STR = {3:"3",4:"4",5:"5",6:"6",7:"7",8:"8",9:"9",10:"10",11:"J",12:"Q",13:"K",14:"A",15:"2"};

function cardStr(c){ return RANK_STR[c.rank] + SUITS[c.suit]; }
function cardVal(c){ return c.rank * 4 + c.suit; } // so sánh
function cmpCard(a, b){ return cardVal(a) - cardVal(b); }

function makeDeck(){
  const d = [];
  for (let r = 3; r <= 15; r++)
    for (let s = 0; s < 4; s++)
      d.push({rank: r, suit: s});
  return d;
}
function shuffle(a){
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============ Nhận diện bộ ============ */
// Trả về {type, rank, len} hoặc null
// type: 1=lẻ, 2=đôi, 3=sám, 4=tứ quý, 5=sảnh, 6=sảnh đôi
function detectCombo(cards){
  if (!cards.length) return null;
  const sorted = [...cards].sort(cmpCard);
  const n = sorted.length;
  const ranks = sorted.map(c => c.rank);

  if (n === 1) return {type: 1, rank: ranks[0], len: 1, top: sorted[0]};

  // Đôi / sám / tứ quý
  if (ranks.every(r => r === ranks[0])){
    if (n === 2) return {type: 2, rank: ranks[0], len: 2, top: sorted[1]};
    if (n === 3) return {type: 3, rank: ranks[0], len: 3, top: sorted[2]};
    if (n === 4) return {type: 4, rank: ranks[0], len: 4, top: sorted[3]};
    return null;
  }

  // Sảnh: 3+ lá liên tiếp, không chứa 2
  if (n >= 3 && ranks[ranks.length-1] < 15){
    let ok = true;
    for (let i = 1; i < n; i++) if (ranks[i] !== ranks[i-1] + 1) ok = false;
    // Không trùng rank
    if (ok && new Set(ranks).size === n)
      return {type: 5, rank: ranks[n-1], len: n, top: sorted[n-1]};
  }

  // Sảnh đôi: 3+ đôi liên tiếp (cho phép 2)
  if (n >= 6 && n % 2 === 0){
    const pairs = [];
    let ok = true;
    for (let i = 0; i < n; i += 2){
      if (ranks[i] !== ranks[i+1]){ ok = false; break; }
      pairs.push(ranks[i]);
    }
    if (ok){
      for (let i = 1; i < pairs.length; i++)
        if (pairs[i] !== pairs[i-1] + 1){ ok = false; break; }
      if (ok) return {type: 6, rank: pairs[pairs.length-1], len: pairs.length, top: sorted[n-1]};
    }
  }

  return null;
}

// Bộ a có chặt được bộ b không?
function canBeat(a, b){
  if (!b) return true; // đi đầu vòng
  if (a.type !== b.type) {
    // Chặt đặc biệt
    // Tứ quý chặt 1 con 2
    if (a.type === 4 && b.type === 1 && b.rank === 15) return true;
    // 3 đôi thông+ chặt 1 con 2
    if (a.type === 6 && a.len >= 3 && b.type === 1 && b.rank === 15) return true;
    // 4 đôi thông+ chặt đôi 2
    if (a.type === 6 && a.len >= 4 && b.type === 2 && b.rank === 15) return true;
    // Tứ quý chặt 3 đôi thông
    if (a.type === 4 && b.type === 6 && b.len === 3) return true;
    return false;
  }
  if (a.len !== b.len) return false;
  return cardVal(a.top) > cardVal(b.top);
}

/* ============ Game state ============ */

let hands = [[], [], [], []]; // 0=người chơi (dưới), 1-3=bot
let turn = 0;
let lastPlay = null; // {player, combo, cards}
let passes = 0;
let selected = new Set(); // index lá đã chọn
let gameOver = false;
let firstTurn = true;
let botLevel = "medium"; // mac dinh // easy | medium | hard
let finished = []; // thu tu ve dich (1,2,3), nguoi con lai thua chot
let lastWinner = -1; // nguoi thang van truoc (di truoc van sau)
let passedRound = new Set(); // nguoi da bo qua trong vong nay

const BOT_NAMES = ["Bạn", "Bot 1", "Bot 2", "Bot 3"];

function newGame(){
  const deck = shuffle(makeDeck());
  hands = [[], [], [], []];
  for (let i = 0; i < 52; i++) hands[i % 4].push(deck[i]);
  for (let h = 0; h < 4; h++) hands[h].sort(cmpCard);
  selected = new Set();
  gameOver = false;
  firstTurn = true;
  lastPlay = null;
  passes = 0;
  roundPlays = {};
  finished = [];
  passedRound = new Set();
  // Van dau: nguoi co 3♠ di truoc. Van sau: nguoi thang van truoc di truoc
  const popup = document.getElementById("tl-popup");
  if (popup) popup.style.display = "none";
  turn = 0;
  if (lastWinner >= 0){
    turn = lastWinner;
  } else {
    for (let p = 0; p < 4; p++){
      if (hands[p].some(c => c.rank === 3 && c.suit === 0)) turn = p;
    }
  }
  render();
  setStatus(BOT_NAMES[turn] + (turn === 0 ? " (bạn)" : "") + " đi trước (có 3♠)");
  if (turn !== 0) setTimeout(botPlay, 800);
}

function setStatus(t){
  const el = document.getElementById("tl-status");
  if (el) el.textContent = t;
}

/* ============ Bot AI ============ */

function findAllCombos(hand){
  // Tìm tất cả bộ hợp lệ (đơn giản: lẻ, đôi, sám, sảnh ngắn)
  const combos = [];
  const n = hand.length;
  // Lẻ
  for (let i = 0; i < n; i++) combos.push([hand[i]]);
  // Đôi, sám, tứ quý
  for (let i = 0; i < n; i++){
    for (let j = i + 1; j < n && hand[j].rank === hand[i].rank; j++){
      combos.push(hand.slice(i, j + 1));
    }
  }
  // Sảnh 3-6 lá (không 2)
  for (let len = 3; len <= 6; len++){
    for (let i = 0; i + len <= n; i++){
      const seq = hand.slice(i, i + len);
      if (detectCombo(seq) && detectCombo(seq).type === 5) combos.push(seq);
    }
  }
  return combos;
}

function botChoose(hand){
  const combos = findAllCombos(hand);
  const valid = [];
  for (const c of combos){
    const dc = detectCombo(c);
    if (!dc) continue;
    // Ván đầu phải có 3♠
    if (firstTurn && turn !== 0){
      // Bot đi đầu ván: phải ra 3♠
      if (!c.some(x => x.rank === 3 && x.suit === 0)) continue;
    }
    if (canBeat(dc, lastPlay ? lastPlay.combo : null)) valid.push({cards: c, combo: dc});
  }
  if (!valid.length) return null;
  valid.sort((a, b) => cardVal(a.combo.top) - cardVal(b.combo.top));
  const isLeading = !lastPlay || lastPlay.player === turn;

  if (botLevel === "easy"){
    // De: luon ra bo nho nhat
    return valid[0].cards;
  }
  if (botLevel === "hard"){
    // Kho: giu bai manh, chi chan khi can
    if (!isLeading){
      // Theo: neu bai doi thu sap het (<3 la), chan manh tay
      const oppCounts = hands.map((h, i) => i === turn ? 99 : h.length);
      const minOpp = Math.min(...oppCounts);
      if (minOpp <= 2){
        // Chon bo lon nhat de chan
        return valid[valid.length - 1].cards;
      }
      // Binh thuong: 30% bo qua de giu bai (neu khong phai bo nho nhat)
      if (valid.length > 1 && Math.random() < 0.3) return null;
    } else {
      // Dan: ra sanh dai hoac bo co rank trung binh (giu bai nho de xa sau)
      const straights = valid.filter(v => v.combo.type === 5 || v.combo.type === 6);
      if (straights.length){
        straights.sort((a, b) => b.cards.length - a.cards.length);
        return straights[0].cards;
      }
    }
    return valid[0].cards;
  }
  // Medium (mac dinh)
  if (isLeading){
    const straights = valid.filter(v => v.combo.type === 5 || v.combo.type === 6);
    if (straights.length && Math.random() < 0.6){
      straights.sort((a, b) => b.cards.length - a.cards.length || cardVal(a.combo.top) - cardVal(b.combo.top));
      return straights[0].cards;
    }
  }
  return valid[0].cards;
}

function activePlayers(){
  return [0,1,2,3].filter(p => hands[p].length > 0);
}
function botPlay(){
  if (gameOver || turn === 0) return;
  const hand = hands[turn];
  const cards = botChoose(hand);
  if (cards){
    doPlay(turn, cards);
  } else {
    doPass(turn);
  }
}

function doPlay(player, cards){
  const combo = detectCombo(cards);
  if (!combo) return false;
  // Ván đầu: người chơi phải ra 3♠
  if (firstTurn && player === 0){
    if (!cards.some(c => c.rank === 3 && c.suit === 0)){
      setStatus("Ván đầu phải ra 3♠!");
      return false;
    }
  }
  if (!canBeat(combo, lastPlay ? lastPlay.combo : null)){
    if (player === 0) setStatus("Bài không hợp lệ hoặc không lớn hơn!");
    return false;
  }
  // Loại bài khỏi tay
  const hand = hands[player];
  for (const c of cards){
    const idx = hand.findIndex(h => h.rank === c.rank && h.suit === c.suit);
    if (idx >= 0) hand.splice(idx, 1);
  }
  lastPlay = {player, combo, cards: [...cards]};
  roundPlays[player] = [...cards]; // giu bai da danh toi het vong
  passes = 0;
  // KHONG reset passedRound o day: ai da bo qua phai nghi HET VONG,
  // chi xoa khi co nguoi thang vong va dan bai moi (trong doPass)
  firstTurn = false;
  if (player === 0) selected.clear();

  render();

  // Hết bài -> ghi nhận hạng, còn lại đánh tiếp
  if (hands[player].length === 0 && !finished.includes(player)){
    finished.push(player);
    if (finished.length < 3){
      const rankNames = ["🥇 Nhất", "🥈 Nhì", "🥉 Ba"];
      setStatus(`🎉 ${BOT_NAMES[player]} về ${rankNames[finished.length-1]}! Còn lại đánh tiếp...`);
    } else {
      gameOver = true;
      const loser = [0,1,2,3].find(p => !finished.includes(p));
      lastWinner = finished[0]; // nhat van nay di truoc van sau
      const medals = ["🥇", "🥈", "🥉", "💀"];
      const rows = finished.map((p, i) =>
        `<div class="tl-rank-row"><span>${medals[i]} ${BOT_NAMES[p]}</span><span>Hạng ${i+1}</span></div>`
      ).join("");
      const loserRow = `<div class="tl-rank-row loser"><span>${medals[3]} ${BOT_NAMES[loser]}</span><span>Thua chót</span></div>`;
      const resultEl = document.getElementById("tl-result");
      if (resultEl) resultEl.innerHTML = rows + loserRow;
      const popup = document.getElementById("tl-popup");
      if (popup) popup.style.display = "flex";
      setStatus(`🏁 Xong!`);
      render();
      return true;
    }
  }

  // Thắng vòng ngay: mọi đối thủ còn bài đều đã bỏ qua vòng này -> không ai chặn được
  const _rivals = activePlayers().filter(p => p !== player);
  if (_rivals.length > 0 && _rivals.every(p => passedRound.has(p))){
    lastPlay = null;
    passes = 0;
    roundPlays = {};
    passedRound = new Set();
    turn = player;
    if (hands[turn].length === 0 && typeof window._tlNextActive === "function")
      turn = window._tlNextActive(turn); // người thắng đã hết bài -> người kế tiếp còn bài dẫn
    render();
    setStatus(`${BOT_NAMES[turn]} thắng vòng, ra bài mới`);
    if (turn !== 0) setTimeout(botPlay, 800);
    return true;
  }
  // Lượt tiếp: bỏ qua người đã hết bài HOẶC đã bỏ qua trong vòng này (tự động qua lượt)
  if (typeof window._tlNextActive === "function") turn = window._tlNextActive(player);
  else { let _nx = (player + 1) % 4, _gd = 0;
    while (hands[_nx].length === 0 && _gd++ < 4) _nx = (_nx + 1) % 4;
    turn = _nx; }
  render();
  if (turn === 0){
    setStatus("Tới lượt bạn!");
  } else {
    setStatus(`${BOT_NAMES[turn]} đang nghĩ...`);
    setTimeout(botPlay, 700 + Math.random() * 600);
  }
  return true;
}

function doPass(player){
  // (được định nghĩa lại bên dưới với logic vòng đầy đủ)
  return false;
}



/* ============ UI ============ */

function cardEl(c, selectable, idx, compact){
  const el = document.createElement("div");
  el.className = "tl-card" + (SUIT_RED[c.suit] ? " red" : "");
  const rank = RANK_STR[c.rank], suit = SUITS[c.suit];
  if (compact){
    // Bai nguoi choi: gon, chi goc tren
    el.classList.add("compact");
    el.innerHTML = `<div class="corner tl"><span>${rank}</span><span>${suit}</span></div>`;
  } else {
    // Day du: 2 goc + chat to giua
    el.innerHTML = `<div class="corner tl"><span>${rank}</span><span>${suit}</span></div>` +
      `<div class="pip">${suit}</div>` +
      `<div class="corner br"><span>${rank}</span><span>${suit}</span></div>`;
  }
  if (selectable){
    el.classList.add("selectable");
    if (selected.has(idx)) el.classList.add("selected");
    el.addEventListener("click", () => {
      if (selected.has(idx)) selected.delete(idx);
      else selected.add(idx);
      renderHand();
    });
  }
  return el;
}

function renderHand(){
  const handEl = document.getElementById("tl-hand");
  if (!handEl) return;
  handEl.innerHTML = '<div class="tl-hand-inner"></div>';
  const inner = handEl.querySelector(".tl-hand-inner");
  hands[0].forEach((c, i) => inner.appendChild(cardEl(c, turn === 0 && !gameOver, i, true)));
}

// Map hien thi bot -> hands index: top=1, right=2, left=3
const BOT_MAP = {1: 1, 2: 2, 0: 3};
// Luu bai da danh cua moi ben trong vong (de hien toi het vong)
let roundPlays = {}; // player -> cards

function renderBots(){
  // Ve bai up cho bot (thay vi hien so)
  const drawBacks = (elId, count) => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = "";
    const show = Math.min(count, 13);
    for (let i = 0; i < show; i++){
      const back = document.createElement("div");
      back.className = "tl-card-back";
      el.appendChild(back);
    }
    const label = document.createElement("span");
    label.className = "tl-count-label";
    label.textContent = count;
    el.appendChild(label);
  };
  drawBacks("tl-botCards1", hands[1].length);
  drawBacks("tl-botCards2", hands[2].length);
  drawBacks("tl-botCards0", hands[3].length);
  // Hien bai da danh cua moi bot (giu toi het vong)
  const showPlay = (elId, player) => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = "";
    const cards = roundPlays[player];
    if (cards){
      for (const c of cards) el.appendChild(cardEl(c, false, 0, true));
    }
  };
  showPlay("tl-botPlay1", 1);
  showPlay("tl-botPlay2", 2);
  showPlay("tl-botPlay0", 3);
}

function renderTrick(){
  const el = document.getElementById("tl-trick");
  if (!el) return;
  el.innerHTML = "";
  if (lastPlay){
    const label = document.createElement("div");
    label.className = "tl-trick-label";
    label.textContent = BOT_NAMES[lastPlay.player] + " ra:";
    el.appendChild(label);
    const row = document.createElement("div");
    row.className = "tl-trick-cards";
    for (const c of lastPlay.cards) row.appendChild(cardEl(c, false, 0, true));
    el.appendChild(row);
  } else {
    el.innerHTML = '<div class="tl-trick-empty">Vòng mới — ra bài tự do</div>';
  }
}

function render(){
  renderHand();
  renderBots();
  renderTrick();
  // Nút bỏ qua: chỉ hiện khi không phải người dẫn
  const passBtn = document.getElementById("tl-pass");
  if (passBtn){
    const canPass = lastPlay && lastPlay.player !== 0 && turn === 0 && !gameOver;
    passBtn.disabled = !canPass;
    passBtn.title = !lastPlay ? "Vòng mới: bạn phải ra bài" :
      lastPlay.player === 0 ? "Bạn đang dẫn, phải ra bài" :
      turn !== 0 ? "Chưa tới lượt bạn" : "Bỏ qua vòng này";
  }
  const playBtn = document.getElementById("tl-play");
  if (playBtn) playBtn.disabled = turn !== 0 || gameOver;
}

/* ============ Sự kiện ============ */

document.addEventListener("click", (e) => {
  if (e.target.id === "tl-new"){ lastWinner = -1; newGame(); return; }
  if (e.target.id === "tl-again"){ newGame(); return; }
  if (e.target.id === "tl-sort"){
    hands[0].sort(cmpCard);
    selected.clear();
    renderHand();
    return;
  }
  if (e.target.id === "tl-play"){
    if (turn !== 0 || gameOver) return;
    const cards = [...selected].map(i => hands[0][i]).filter(Boolean);
    if (!cards.length){ setStatus("Chọn bài trước!"); return; }
    doPlay(0, cards);
    return;
  }
  if (e.target.id === "tl-pass"){
    if (turn !== 0 || gameOver) return;
    doPass(0);
    return;
  }
  const lvBtn = e.target.closest("[data-level]");
  if (lvBtn){
    botLevel = lvBtn.dataset.level;
    document.querySelectorAll("[data-level]").forEach(b =>
      b.classList.toggle("active", b.dataset.level === botLevel));
    setStatus("Độ khó: " + lvBtn.textContent);
    return;
  }
});

/* Logic vòng: ai bỏ qua thì nghỉ hết vòng */
(function patchPass(){
  const _doPass = doPass;
  // Hàm tìm người tiếp theo chưa bỏ qua và còn bài
  function nextActive(from){
    let n = (from + 1) % 4, guard = 0;
    while (guard++ < 8){
      if (hands[n].length > 0 && !passedRound.has(n)) return n;
      n = (n + 1) % 4;
    }
    return from;
  }
  doPass = function(player){
    if (!lastPlay || lastPlay.player === player){
      if (player === 0) setStatus("Bạn đang dẫn, không được bỏ qua!");
      return false;
    }
    const winnerBefore = lastPlay.player;
    passedRound.add(player);
    passes++;
    setStatus(`${BOT_NAMES[player]} bỏ qua (nghỉ hết vòng)`);
    // Đếm người còn có thể chơi (chưa bỏ qua, còn bài)
    const remaining = activePlayers().filter(p => !passedRound.has(p) && p !== winnerBefore);
    if (remaining.length === 0){
      // Hết vòng: người ra cuối thắng, ra bài mới
      lastPlay = null;
      passes = 0;
      roundPlays = {};
      passedRound = new Set();
      turn = winnerBefore;
      // Nếu người thắng vòng đã hết bài, tìm người tiếp theo
      if (hands[turn].length === 0) turn = nextActive(turn);
      setStatus(`${BOT_NAMES[turn]} thắng vòng, ra bài mới`);
      render();
      if (turn !== 0) setTimeout(botPlay, 800);
      return true;
    }
    turn = nextActive(player);
    render();
    if (turn === 0) setStatus("Tới lượt bạn!");
    else {
      setStatus(`${BOT_NAMES[turn]} đang nghĩ...`);
      setTimeout(botPlay, 700 + Math.random() * 600);
    }
    return true;
  };
  // Ghi đè nextActive ra ngoài để doPlay dùng
  window._tlNextActive = nextActive;
})();

newGame();

})();
