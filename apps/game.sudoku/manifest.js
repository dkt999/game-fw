registerApp({
    "id": "2",
    "name": "Sudoku",
    "icon": "./assets/icons/defaultGameIcon2.svg",
    "execScript": "openSudokuGame()"
});
let sudokuWindowId = null;
function openSudokuGame() {
    const $existingApp = $('.sudoku-app');
    if ($existingApp.length > 0) {
        const existingWindowId = $existingApp.closest('.window').attr('id');
        $(`#${existingWindowId}`).attr('index', zIndexCounter + 1);
        $(`#${existingWindowId}`).css('display', 'block');
        return; 
    }
    loadAppStylesheet("./apps/game.sudoku/assets/style.css");
    const parentHeight = $('.icon-item').parent().height();
    const parentWidth = $('.icon-item').parent().width();
    sudokuWindowId = createWindow({
        title: 'Sudoku',
        iconUrl: "assets/icons/defaultGameIcon2.svg",
        additionClass: "sudoku-app",
        allowResize: false,
        fullScreenApp: true
    });
    InitSudokuGame();
    loadAppScript("./apps/game.sudoku/assets/script.js", function() {})
}
function InitSudokuGame() {
    $('#' + sudokuWindowId).find('.window-content').html(`
    <div class="wrap">
        <header>
            <div class="eyebrow">数独 · SUDOKU</div>
            <h1>Su<em>doku</em></h1>
            <svg class="brush-underline" viewBox="0 0 340 14" preserveAspectRatio="none">
            <path d="M4 8 C 60 2, 120 12, 170 6 S 280 2, 336 9"/>
            </svg>
            <div class="subtitle">Fill the grid so every row, column and box contains each symbol exactly once.</div>
        </header>

        <details class="rules">
            <summary>How to play</summary>
            <ul>
            <li><b>Classic</b> is a 9×9 grid split into nine 3×3 boxes, using digits <b>1–9</b>. <b>Hex</b> is a 16×16 grid split into sixteen 4×4 boxes, using hexadecimal symbols <b>0–9, A–F</b>.</li>
            <li>Tap a cell, then tap a symbol — every row, column and box must end up with each symbol exactly once.</li>
            <li>Toggle <b>Notes</b> to jot down candidate symbols in a cell instead of a final answer.</li>
            <li>Stuck? Use <b>Hint</b> to reveal the correct symbol for the selected (or next open) cell — hints are limited per game.</li>
            <li>Three wrong entries end the round, so place a symbol only when you're fairly sure.</li>
            </ul>
        </details>

        <div class="controls">
            <div class="action-row" id="sdk-continueRow" style="display:none;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                <button class="btn primary" id="sdk-btnContinue">Continue previous game</button>
                <span id="sdk-continueMeta" style="font-size:11.5px; color:#b9ac86;"></span>
            </div>
            </div>
            <div class="size-row" id="sdk-sizeRow">
            <button class="size-btn active" data-mode="classic">Classic<small>9×9 · 1–9</small></button>
            <button class="size-btn" data-mode="hex">Hex<small>16×16 · 0–F</small></button>
            </div>
            <div class="diff-row" id="sdk-diffRow">
            <button class="diff-btn" data-diff="easy">Easy</button>
            <button class="diff-btn" data-diff="medium">Medium</button>
            <button class="diff-btn" data-diff="hard">Hard</button>
            <button class="diff-btn" data-diff="expert">Expert</button>
            </div>
        </div>

        <div id="sdk-gameSudokuArea" style="display:none;">
            <div class="stats-row">
            <div class="stats-container">
                <div class="btn-square" id="sdk-btnMenu" title="Back to menu">
                <svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>
                </div>
                <div class="btn-square" id="sdk-btnNewGame" title="New puzzle">
                <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
                </div>
            </div>
            <div class="stats-container">
                <div class="stat"><span class="val" id="sdk-statTime">00:00</span><span class="lbl">Time</span></div>
                <div class="stat"><span class="val" id="sdk-statMistakes">0/3</span><span class="lbl">Mistakes</span></div>
                <div class="stat"><span class="val" id="sdk-statHints">3</span><span class="lbl">Hints left</span></div>
                <div class="stat"><span class="badge-mode" id="sdk-statMode">9×9</span><span class="lbl">Grid</span></div>
            </div>
            </div>

            <div class="board-frame">
            <div class="board" id="sdk-board"></div>
            <div class="hanko" id="sdk-hanko"><span>完</span></div>
            <div class="gen-overlay" id="sdk-genOverlay">Drawing the grid…</div>
            </div>

            <div class="numpad-row" id="sdk-numpad"></div>

            <div class="tool-row">
            <button class="tool-btn" id="sdk-btnErase" title="Erase">
                <svg viewBox="0 0 24 24"><path d="M20 20H8l-6-6a2 2 0 0 1 0-2.8L13.2 2 22 10.8 12 20"/></svg>
                Erase
            </button>
            <button class="tool-btn" id="sdk-btnNotes" title="Toggle notes mode">
                <svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                Notes
            </button>
            <button class="tool-btn" id="sdk-btnHint" title="Reveal a correct symbol">
                <svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z"/></svg>
                <span>Hint <span class="badge" id="sdk-hintBadge">3</span></span>
            </button>
            </div>

            <div class="result-banner" id="sdk-resultBanner">
            <div class="title" id="sdk-resultTitle">Completed!</div>
            <div class="sub" id="sdk-resultSub"></div>
            </div>
        </div>

        <footer>Sudoku · a quiet game of numbers and logic</footer>
</div>`);
}