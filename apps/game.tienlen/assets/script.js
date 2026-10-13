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
  // Người có 3♠ đi trước
  turn = 0;
  for (let p = 0; p < 4; p++){
    if (hands[p].some(c => c.rank === 3 && c.suit === 0)) turn = p;
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
  // Chọn bộ nhỏ nhất
  valid.sort((a, b) => cardVal(a.combo.top) - cardVal(b.combo.top));
  // Ưu tiên xả: nếu đang dẫn (không ai chặn), ra bộ dài nhất trong các bộ nhỏ
  if (!lastPlay || lastPlay.player === turn){
    // Dẫn: chọn sảnh dài hoặc bộ nhỏ nhất
    const straights = valid.filter(v => v.combo.type === 5 || v.combo.type === 6);
    if (straights.length && Math.random() < 0.6){
      straights.sort((a, b) => b.cards.length - a.cards.length || cardVal(a.combo.top) - cardVal(b.combo.top));
      return straights[0].cards;
    }
  }
  return valid[0].cards;
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
  passes = 0;
  firstTurn = false;
  if (player === 0) selected.clear();

  render();

  // Thắng?
  if (hands[player].length === 0){
    gameOver = true;
    const order = [];
    for (let i = 0; i < 4; i++){
      const p = (player + i) % 4;
      order.push({p, count: hands[p].length});
    }
    order.sort((a, b) => a.count - b.count);
    const names = order.map((o, i) => `${i+1}. ${BOT_NAMES[o.p]} (${o.count} lá)`).join(" · ");
    setStatus(`🏆 ${BOT_NAMES[player]} thắng! Xếp hạng: ${names}`);
    return true;
  }

  // Lượt tiếp
  turn = (player + 1) % 4;
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

function cardEl(c, selectable, idx){
  const el = document.createElement("div");
  el.className = "tl-card" + (SUIT_RED[c.suit] ? " red" : "");
  el.textContent = cardStr(c);
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
  handEl.innerHTML = "";
  hands[0].forEach((c, i) => handEl.appendChild(cardEl(c, turn === 0 && !gameOver, i)));
}

function renderBots(){
  for (let b = 1; b <= 3; b++){
    const countEl = document.getElementById("tl-botCards" + b);
    // Bot index trong hands: bot1=hands[1], bot2=hands[2], bot3=hands[3]
    // Hiển thị: top=bot1, right=bot2, left=bot3 (hands[3])
    const map = {1: 1, 2: 2, 0: 3};
    const h = hands[map[b] !== undefined ? map[b] : b];
    if (countEl) countEl.textContent = h.length + " lá";
    const playEl = document.getElementById("tl-botPlay" + b);
    if (playEl){
      playEl.innerHTML = "";
      if (lastPlay && lastPlay.player === (map[b] !== undefined ? map[b] : b)){
        for (const c of lastPlay.cards) playEl.appendChild(cardEl(c, false));
      }
    }
  }
  // Bot 0 (left) là hands[3]
  const c0 = document.getElementById("tl-botCards0");
  if (c0) c0.textContent = hands[3].length + " lá";
  const p0 = document.getElementById("tl-botPlay0");
  if (p0){
    p0.innerHTML = "";
    if (lastPlay && lastPlay.player === 3){
      for (const c of lastPlay.cards) p0.appendChild(cardEl(c, false));
    }
  }
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
    for (const c of lastPlay.cards) row.appendChild(cardEl(c, false));
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
  if (passBtn) passBtn.disabled = !lastPlay || lastPlay.player === 0 || turn !== 0;
  const playBtn = document.getElementById("tl-play");
  if (playBtn) playBtn.disabled = turn !== 0 || gameOver;
}

/* ============ Sự kiện ============ */

document.addEventListener("click", (e) => {
  if (e.target.id === "tl-new"){ newGame(); return; }
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
});

/* Sửa logic vòng: khi 3 người liên tiếp bỏ qua, người ra bài cuối được ra tiếp */
(function patchPass(){
  const _doPass = doPass;
  doPass = function(player){
    if (!lastPlay || lastPlay.player === player){
      if (player === 0) setStatus("Bạn đang dẫn, không được bỏ qua!");
      return false;
    }
    const winnerBefore = lastPlay.player;
    passes++;
    setStatus(`${BOT_NAMES[player]} bỏ qua`);
    if (passes >= 3){
      lastPlay = null;
      passes = 0;
      turn = winnerBefore;
      setStatus(`${BOT_NAMES[turn]} thắng vòng, ra bài mới`);
      render();
      if (turn === 0){
        // người chơi đi
      } else {
        setTimeout(botPlay, 800);
      }
      return true;
    }
    turn = (player + 1) % 4;
    render();
    if (turn === 0) setStatus("Tới lượt bạn!");
    else {
      setStatus(`${BOT_NAMES[turn]} đang nghĩ...`);
      setTimeout(botPlay, 700 + Math.random() * 600);
    }
    return true;
  };
})();

newGame();

})();
