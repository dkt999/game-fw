(function(){
"use strict";

let score = 0;
let streak = 0;
let bestStreak = 0;
let kanaType = "hira";
let currentQ = null;
let timer = null;
let timeLeft = 10;
let answered = false;

const $ = id => document.getElementById(id);

function getPool(){
  if (kanaType === "hira") return HIRAGANA;
  if (kanaType === "kata") return KATAKANA;
  return [...HIRAGANA, ...KATAKANA];
}

function shuffle(a){
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newQuestion(){
  const pool = getPool();
  const correct = pool[Math.floor(Math.random() * pool.length)];
  // 3 đáp án sai
  const wrong = shuffle(pool.filter(k => k[1] !== correct[1])).slice(0, 3);
  const options = shuffle([correct, ...wrong]);
  currentQ = {kana: correct[0], romaji: correct[1], options};
  answered = false;

  $("nh-kana").textContent = correct[0];
  const ansEl = $("nh-answers");
  ansEl.innerHTML = "";
  options.forEach(([k, r]) => {
    const btn = document.createElement("button");
    btn.className = "nh-answer";
    btn.textContent = r;
    btn.onclick = () => answer(r, btn);
    ansEl.appendChild(btn);
  });
  $("nh-feedback").textContent = "";
  $("nh-feedback").className = "nh-feedback";

  // Timer
  timeLeft = 10;
  $("nh-time").textContent = timeLeft;
  clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--;
    $("nh-time").textContent = timeLeft;
    if (timeLeft <= 0){
      clearInterval(timer);
      if (!answered) answer(null, null);
    }
  }, 1000);
}

function answer(romaji, btn){
  if (answered) return;
  answered = true;
  clearInterval(timer);

  const correct = romaji === currentQ.romaji;
  const fb = $("nh-feedback");

  // Highlight
  document.querySelectorAll(".nh-answer").forEach(b => {
    if (b.textContent === currentQ.romaji) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
    b.disabled = true;
  });

  if (correct){
    streak++;
    bestStreak = Math.max(bestStreak, streak);
    const pts = 10 + Math.min(streak * 2, 20) + timeLeft;
    score += pts;
    fb.textContent = `⭕ Đúng! +${pts}`;
    fb.className = "nh-feedback good";
  } else {
    streak = 0;
    fb.textContent = romaji === null ?
      `⏰ Hết giờ! Đáp án: ${currentQ.romaji}` :
      `❌ Sai! Đáp án: ${currentQ.romaji}`;
    fb.className = "nh-feedback bad";
  }

  $("nh-score").textContent = score;
  $("nh-streak").textContent = streak;

  // Lưu kỷ lục
  const best = parseInt(localStorage.getItem("nhongo_best") || "0");
  if (score > best) localStorage.setItem("nhongo_best", score);

  setTimeout(newQuestion, 1200);
}

function startGame(){
  score = 0;
  streak = 0;
  $("nh-score").textContent = "0";
  $("nh-streak").textContent = "0";
  $("nh-menu").style.display = "none";
  $("nh-game").style.display = "flex";
  newQuestion();
}

function backToMenu(){
  clearInterval(timer);
  $("nh-game").style.display = "none";
  $("nh-menu").style.display = "flex";
}

// Events
document.addEventListener("click", e => {
  if (e.target.closest('[data-mode="kana"]')){ startGame(); return; }
  if (e.target.id === "nh-back"){ backToMenu(); return; }
  const kt = e.target.closest("[data-kana]");
  if (kt){
    kanaType = kt.dataset.kana;
    document.querySelectorAll("[data-kana]").forEach(b =>
      b.classList.toggle("active", b.dataset.kana === kanaType));
    newQuestion();
    return;
  }
});

// Hiện kỷ lục ở menu
const best = localStorage.getItem("nhongo_best");
if (best){
  const sub = document.querySelector(".nh-sub");
  if (sub) sub.textContent += ` · Kỷ lục: ${best}`;
}

})();
