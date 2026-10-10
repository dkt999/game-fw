(function(){
  "use strict";

  const DIFFICULTIES = {
    easy:   { min:5,  max:6  },
    medium: { min:7,  max:9  },
    hard:   { min:10, max:12 },
    expert: { min:13, max:16 }
  };

  const PALETTE = [
    { bg:"rgba(47,76,124,0.55)",  border:"#2F4C7C" },
    { bg:"rgba(193,68,45,0.48)",  border:"#B03B26" },
    { bg:"rgba(201,162,39,0.55)", border:"#A4831C" },
    { bg:"rgba(107,127,91,0.55)", border:"#54633F" },
    { bg:"rgba(122,75,107,0.5)",  border:"#623D56" },
    { bg:"rgba(61,112,104,0.5)",  border:"#2C5A53" }
  ];

  const boardEl = document.getElementById("shk-board");
  const boardFrame = document.getElementById("shk-boardFrame");
  const numbersLayer = document.getElementById("shk-numbersLayer");
  const regionsLayer = document.getElementById("shk-regionsLayer");
  const previewEl = document.getElementById("shk-preview");
  const hankoEl = document.getElementById("shk-hanko");
  const resultBanner = document.getElementById("shk-resultBanner");
  const resultSub = document.getElementById("shk-resultSub");
  const statTime = document.getElementById("shk-statTime");
  const statFilled = document.getElementById("shk-statFilled");
  const statRegions = document.getElementById("shk-statRegions");
  const diffRow = document.getElementById("shk-diffRow");
  const customPanel = document.getElementById("shk-customPanel");
  const customW = document.getElementById("shk-customW");
  const customH = document.getElementById("shk-customH");
  const cwVal = document.getElementById("shk-cwVal");
  const chVal = document.getElementById("shk-chVal");

  let state = null;
  let numbersLayerMap = new Map();
  let dragging = false;
  let startCol = 0, startRow = 0;
  let timerId = null;
  let currentDiff = "medium";
  let lastCustomDims = { W: 8, H: 8 };

  function randInt(min, max){ return Math.floor(Math.random() * (max - min + 1)) + min; }
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  /* ---------------- Puzzle generation ---------------- */

  function generateCandidate(W, H){
    const regions = [];
    const MAXLEN = Math.max(4, Math.min(6, Math.ceil(Math.max(W, H) / 2)));
    const MAXAREA = Math.max(6, Math.min(12, Math.ceil((W * H) / 6)));

    function rec(x, y, w, h){
      const area = w * h;
      const canV = w > 1, canH = h > 1;
      if (!canV && !canH){ regions.push({x,y,w,h}); return; }
      const force = w > MAXLEN || h > MAXLEN || area > MAXAREA;
      const splitChance = force ? 1 : Math.min(0.9, 0.2 + (area / (W*H)) * 4);
      if (!force && Math.random() > splitChance){ regions.push({x,y,w,h}); return; }
      let axis;
      if (canV && canH) axis = (w >= h) ? (Math.random() < 0.6 ? "v" : "h") : (Math.random() < 0.6 ? "h" : "v");
      else axis = canV ? "v" : "h";
      if (axis === "v"){
        const cut = 1 + Math.floor(Math.random() * (w - 1));
        rec(x, y, cut, h); rec(x + cut, y, w - cut, h);
      } else {
        const cut = 1 + Math.floor(Math.random() * (h - 1));
        rec(x, y, w, cut); rec(x, y + cut, w, h - cut);
      }
    }
    rec(0, 0, W, H);
    return regions;
  }

  function scoreCandidate(regions){
    let area1 = 0, areaBig = 0;
    for (const r of regions){
      const a = r.w * r.h;
      if (a === 1) area1++;
      if (a > 10) areaBig++;
    }
    return regions.length * 3 - area1 * 4 - areaBig * 3;
  }

  function generatePuzzle(W, H){
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 8; i++){
      const cand = generateCandidate(W, H);
      const s = scoreCandidate(cand);
      if (s > bestScore){ bestScore = s; best = cand; }
    }
    const clues = new Map();
    for (const r of best){
      const cx = r.x + randInt(0, r.w - 1);
      const cy = r.y + randInt(0, r.h - 1);
      clues.set(cx + "," + cy, r.w * r.h);
    }
    return { regions: best, clues };
  }

  /* ---------------- Board sizing ---------------- */

  function sizeBoard(){
    if (!state) return;
    const frameStyleBudget = boardFrame.parentElement ? boardFrame.parentElement.clientWidth : window.innerWidth;
    const maxW = Math.min(frameStyleBudget - 24, window.innerWidth * 0.96, 900);
    const maxH = Math.min(window.innerHeight * 0.72, 900);
    let cell = Math.floor(Math.min(maxW / state.W, maxH / state.H));
    cell = Math.max(22, Math.min(120, cell));
    const w = cell * state.W, h = cell * state.H;
    boardEl.style.width = w + "px";
    boardEl.style.height = h + "px";
    boardEl.style.setProperty("--w", state.W);
    boardEl.style.setProperty("--h", state.H);
    boardEl.style.setProperty("--cellpx", cell + "px");
  }

  window.addEventListener("resize", debounce(sizeBoard, 120));
  window.addEventListener("orientationchange", () => setTimeout(sizeBoard, 200));
  function debounce(fn, ms){
    let t; return function(){ clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ---------------- Rendering ---------------- */

  function setActiveDiffButton(key){
    [...diffRow.children].forEach(b => b.classList.toggle("active", b.dataset.diff === key));
  }
  function gotoMainMenu(){
    $('#shk-mainShikakuMenu').show();
    $('#shk-gameShikakuArea').hide();
  }
  function startNewGame(diffKey){
    $('#shk-mainShikakuMenu').hide();
    $('#shk-gameShikakuArea').show();
    currentDiff = diffKey;
    setActiveDiffButton(diffKey);

    let W, H;
    if (diffKey === "custom"){
      W = lastCustomDims.W;
      H = lastCustomDims.H;
    } else {
      const range = DIFFICULTIES[diffKey];
      W = randInt(range.min, range.max);
      H = randInt(range.min, range.max);
    }
    const { clues } = generatePuzzle(W, H);

    state = {
      W, H, clues,
      lockGrid: Array.from({length: H}, () => Array(W).fill(-1)),
      regions: [],
      regionCounter: 0,
      filled: 0,
      solved: false
    };

    numbersLayerMap = new Map();
    numbersLayer.innerHTML = "";
    regionsLayer.innerHTML = "";
    hidePreview();
    boardEl.classList.remove("solved");
    hankoEl.classList.remove("show");
    resultBanner.classList.remove("show");

    for (const [key, val] of clues.entries()){
      const [x, y] = key.split(",").map(Number);
      const span = document.createElement("div");
      span.className = "clue";
      span.style.left = (x / W * 100) + "%";
      span.style.top = (y / H * 100) + "%";
      span.style.width = (100 / W) + "%";
      span.style.height = (100 / H) + "%";
      span.textContent = val;
      numbersLayer.appendChild(span);
      numbersLayerMap.set(key, span);
    }

    sizeBoard();
    resetTimer();
    startTimer();
    updateStats();
  }

  function clearAllRegions(){
    if (!state) return;
    for (const r of [...state.regions]) removeRegionById(r.id, true);
    updateStats();
  }

  /* ---------------- Timer ---------------- */

  function resetTimer(){
    if (timerId) clearInterval(timerId);
    state.seconds = 0;
    statTime.textContent = "00:00";
  }
  function startTimer(){
    timerId = setInterval(() => {
      state.seconds++;
      const m = String(Math.floor(state.seconds / 60)).padStart(2, "0");
      const s = String(state.seconds % 60).padStart(2, "0");
      statTime.textContent = m + ":" + s;
    }, 1000);
  }
  function stopTimer(){ if (timerId) clearInterval(timerId); }

  /* ---------------- Stats ---------------- */

  function updateStats(){
    statFilled.textContent = state.filled + "/" + (state.W * state.H);
    statRegions.textContent = state.regions.length;
  }

  /* ---------------- Interaction ---------------- */

  function getCellFromEvent(e){
    const rect = boardEl.getBoundingClientRect();
    let relX = (e.clientX - rect.left) / rect.width;
    let relY = (e.clientY - rect.top) / rect.height;
    relX = Math.min(0.9999, Math.max(0, relX));
    relY = Math.min(0.9999, Math.max(0, relY));
    const col = Math.max(0, Math.min(state.W - 1, Math.floor(relX * state.W)));
    const row = Math.max(0, Math.min(state.H - 1, Math.floor(relY * state.H)));
    return { col, row };
  }

  function rectFrom(c1, r1, c2, r2){
    const x = Math.min(c1, c2), y = Math.min(r1, r2);
    const w = Math.abs(c1 - c2) + 1, h = Math.abs(r1 - r2) + 1;
    return { x, y, w, h };
  }

  function evaluateRect(rect){
    let overlap = false;
    for (let y = rect.y; y < rect.y + rect.h; y++){
      for (let x = rect.x; x < rect.x + rect.w; x++){
        if (state.lockGrid[y][x] !== -1) overlap = true;
      }
    }
    if (overlap) return { status: "overlap" };
    let count = 0, val = null, cx = null, cy = null;
    for (let y = rect.y; y < rect.y + rect.h; y++){
      for (let x = rect.x; x < rect.x + rect.w; x++){
        const key = x + "," + y;
        if (state.clues.has(key)){ count++; val = state.clues.get(key); cx = x; cy = y; }
      }
    }
    if (count === 1 && rect.w * rect.h === val) return { status: "valid", clueX: cx, clueY: cy };
    return { status: "invalid" };
  }

  function positionPreview(rect){
    previewEl.style.left = (rect.x / state.W * 100) + "%";
    previewEl.style.top = (rect.y / state.H * 100) + "%";
    previewEl.style.width = (rect.w / state.W * 100) + "%";
    previewEl.style.height = (rect.h / state.H * 100) + "%";
  }

  function updatePreview(c1, r1, c2, r2){
    const rect = rectFrom(c1, r1, c2, r2);
    positionPreview(rect);
    previewEl.classList.add("on");
    previewEl.classList.remove("valid", "invalid", "overlap", "reject");
    const ev = evaluateRect(rect);
    previewEl.classList.add(ev.status === "valid" ? "valid" : ev.status === "overlap" ? "overlap" : "invalid");
  }

  function hidePreview(){
    previewEl.classList.remove("on", "valid", "invalid", "overlap", "reject");
  }

  function finalizeSelection(c1, r1, c2, r2){
    const rect = rectFrom(c1, r1, c2, r2);
    const ev = evaluateRect(rect);
    if (ev.status === "valid"){
      placeRegion(rect, ev.clueX, ev.clueY);
      hidePreview();
    } else {
      previewEl.classList.add("reject");
      setTimeout(hidePreview, 260);
    }
  }

  function placeRegion(rect, clueX, clueY){
    const id = state.regionCounter++;
    const color = PALETTE[id % PALETTE.length];
    for (let y = rect.y; y < rect.y + rect.h; y++){
      for (let x = rect.x; x < rect.x + rect.w; x++){
        state.lockGrid[y][x] = id;
      }
    }
    const el = document.createElement("div");
    el.className = "region-block";
    el.style.left = (rect.x / state.W * 100) + "%";
    el.style.top = (rect.y / state.H * 100) + "%";
    el.style.width = (rect.w / state.W * 100) + "%";
    el.style.height = (rect.h / state.H * 100) + "%";
    el.style.background = color.bg;
    el.style.borderColor = color.border;
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      removeRegionById(id);
    });
    regionsLayer.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));

    state.regions.push({ id, x: rect.x, y: rect.y, w: rect.w, h: rect.h, clueX, clueY, el });

    const numEl = numbersLayerMap.get(clueX + "," + clueY);
    if (numEl) numEl.classList.add("satisfied");

    state.filled += rect.w * rect.h;
    updateStats();

    if (state.filled === state.W * state.H) triggerWin();
  }

  function removeRegionById(id, skipStats){
    const idx = state.regions.findIndex(r => r.id === id);
    if (idx === -1) return;
    const r = state.regions[idx];
    for (let y = r.y; y < r.y + r.h; y++){
      for (let x = r.x; x < r.x + r.w; x++){
        state.lockGrid[y][x] = -1;
      }
    }
    r.el.classList.remove("show");
    r.el.classList.add("hide");
    setTimeout(() => r.el.remove(), 220);
    const numEl = numbersLayerMap.get(r.clueX + "," + r.clueY);
    if (numEl) numEl.classList.remove("satisfied");
    state.filled -= r.w * r.h;
    state.regions.splice(idx, 1);
    if (!skipStats) updateStats();
  }

  function triggerWin(){
    state.solved = true;
    stopTimer();
    boardEl.classList.add("solved");
    hankoEl.classList.add("show");
    spawnInkBurst();
    const m = String(Math.floor(state.seconds / 60)).padStart(2, "0");
    const s = String(state.seconds % 60).padStart(2, "0");
    resultSub.textContent = "Thời gian " + m + ":" + s + " · " + state.regions.length + " vùng chữ nhật";
    resultBanner.classList.add("show");
  }

  function spawnInkBurst(){
    const n = 14;
    for (let i = 0; i < n; i++){
      const d = document.createElement("div");
      d.className = "ink-drop";
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 70;
      d.style.setProperty("--dx", Math.cos(angle) * dist + "px");
      d.style.setProperty("--dy", Math.sin(angle) * dist + "px");
      d.style.left = (44 + Math.random() * 10) + "%";
      d.style.top = "10%";
      hankoEl.appendChild(d);
      setTimeout(() => d.remove(), 750);
    }
  }

  /* ---------------- Pointer events ---------------- */

  boardEl.addEventListener("pointerdown", (e) => {
    if (!state || state.solved) return;
    if (e.target.closest(".region-block")) return;
    boardEl.setPointerCapture(e.pointerId);
    const { col, row } = getCellFromEvent(e);
    if (state.lockGrid[row][col] !== -1) return;
    dragging = true;
    startCol = col; startRow = row;
    updatePreview(col, row, col, row);
  });

  boardEl.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const { col, row } = getCellFromEvent(e);
    updatePreview(startCol, startRow, col, row);
  });

  boardEl.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    const { col, row } = getCellFromEvent(e);
    finalizeSelection(startCol, startRow, col, row);
  });

  boardEl.addEventListener("pointercancel", () => {
    dragging = false;
    hidePreview();
  });

  /* ---------------- UI wiring ---------------- */

  diffRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".diff-btn");
    if (!btn) return;
    const diff = btn.dataset.diff;
    if (diff === "custom"){
      setActiveDiffButton("custom");
      customPanel.style.display = "flex";
      $('#shk-actionRowStartGame').hide();
      return;
    }
    else 
    {
        $('#shk-actionRowStartGame').show();
    }
    customPanel.style.display = "none";
    startNewGame(diff);
  });

  customW.addEventListener("input", () => { cwVal.textContent = customW.value; });
  customH.addEventListener("input", () => { chVal.textContent = customH.value; });

  document.getElementById("shk-btnCustomStart").addEventListener("click", () => {
    lastCustomDims = {
      W: clamp(parseInt(customW.value, 10) || 8, 5, 32),
      H: clamp(parseInt(customH.value, 10) || 8, 5, 32)
    };
    startNewGame("custom");
  });

  document.getElementById("shk-btnNew").addEventListener("click", () => startNewGame(currentDiff));
  document.getElementById("shk-btnMenu").addEventListener("click", () => gotoMainMenu());
  document.getElementById("shk-btnNewGame").addEventListener("click", () => startNewGame(currentDiff));
  document.getElementById("shk-btnClear").addEventListener("click", () => {
    if (state && !state.solved) clearAllRegions();
  });

  /* ---------------- Init ---------------- */

  //startNewGame(currentDiff);
  window.addEventListener("load", () => setTimeout(sizeBoard, 60));
  if (document.fonts && document.fonts.ready){
    document.fonts.ready.then(() => sizeBoard());
  }
})();