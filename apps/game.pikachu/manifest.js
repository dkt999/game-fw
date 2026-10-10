registerApp({
    "id": "3",
    "name": "Pikachu",
    "icon": "./assets/icons/defaultGameIcon2.svg",
    "execScript": "openPikachuGame()"
});
let pikachuWindowId = null;
function openPikachuGame() {
    const $existingApp = $('.pikachu-app');
    if ($existingApp.length > 0) {
        const existingWindowId = $existingApp.closest('.window').attr('id');
        $(`#${existingWindowId}`).attr('index', zIndexCounter + 1);
        $(`#${existingWindowId}`).css('display', 'block');
        return;
    }
    loadAppStylesheet("./apps/game.pikachu/assets/style.css");
    // Game luôn mở fullscreen (giống Sudoku); chế độ cửa sổ để dành cho app sau này.
    // Co gang khoa man hinh ngang (chi duoc tren PWA/fullscreen Android; that bai thi bo qua,
    // se hien man hinh nhac xoay thay the).
    try {
        if (window.IS_MOBILE === true && screen.orientation && screen.orientation.lock) {
            screen.orientation.lock("landscape").catch(function(){});
        }
    } catch (e) {}
    pikachuWindowId = createWindow({
        title: 'Pikachu',
        iconUrl: "assets/icons/defaultGameIcon2.svg",
        additionClass: "pikachu-app",
        allowResize: false,
        fullScreenApp: true,
        onClose: function() {
            try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
        }
    });
    InitPikachuGame();
    loadAppScript("./apps/game.pikachu/assets/script.js", function() {})
}
function InitPikachuGame() {
    $('#' + pikachuWindowId).find('.window-content').html(`
    <div class="wrap">
        <div id="pkc-mainMenu">
            <header>
                <div class="eyebrow">つなげる · PIKACHU</div>
                <h1>Nối <em>Hình</em></h1>
                <svg class="brush-underline" viewBox="0 0 340 14" preserveAspectRatio="none">
                    <path d="M4 8 C 60 2, 120 12, 170 6 S 280 2, 336 9"/>
                </svg>
                <div class="subtitle">Nối hai ô giống nhau bằng một đường thẳng không quá 2 lần rẽ.</div>
                <button class="rules-btn" id="pkc-rulesBtn" title="Cách chơi">?</button>
            </header>

            <div class="rules-modal" id="pkc-rulesModal" style="display:none;">
                <div class="rules-card">
                    <div class="rules-card-head"><span>Cách chơi</span><button class="rules-close" id="pkc-rulesClose" title="Đóng">✕</button></div>
                    <ul>
                    <li>Chọn hai ô có <b>hình giống hệt nhau</b> để nối chúng lại và loại bỏ khỏi bàn cờ.</li>
                    <li>Đường nối giữa hai ô chỉ được phép <b>rẽ tối đa 2 lần</b>, không được đi xuyên qua ô còn hình khác.</li>
                    <li>Sắp bí đường? Nhấn <b>Xáo bài</b> <b>trước khi</b> hết đường nối — bí hẳn là <b>thua luôn</b>, game không tự xáo cứu.</li>
                    <li>Dùng <b>Gợi ý</b> để bàn cờ tự tìm và nhấp nháy một cặp có thể nối — số lần gợi ý có giới hạn.</li>
                    <li>Thắng khi dọn sạch toàn bộ bàn cờ trước khi hết giờ (nếu map có giới hạn thời gian).</li>
                    <li>Map chia thành <b>Pack 10 map</b>: qua ít nhất <b>8/10</b> map của pack hiện tại mới mở pack tiếp theo. Tiến trình lưu trên máy.</li>
                    <li>Từ map <b>Chuyên gia</b>: mỗi lần nối xong, toàn bộ hình còn lại sẽ <b>rơi/dịch chuyển</b> — lúc đầu rơi cố định xuống dưới, sau đảo lên/xuống qua lại, cuối cùng ngẫu nhiên 4 hướng.</li>
                </ul>
                </div>
            </div>

            <div class="controls">
                <div class="pack-picker">
                    <div class="pack-nav">
                        <button class="pack-arrow" id="pkc-packPrev" title="Pack trước">◀</button>
                        <div class="pack-title"><span id="pkc-packName">Pack 1</span><span class="pack-progress" id="pkc-packProg">0/10</span></div>
                        <button class="pack-arrow" id="pkc-packNext" title="Pack sau">▶</button>
                    </div>
                    <div class="pack-grid" id="pkc-mapGrid"></div>
                    <div class="pack-locknote" id="pkc-packLockNote" style="display:none;"></div>
                </div>
            </div>
        </div>

        <div id="pkc-gameArea" style="display:none;">
            <div class="pkc-game-layout">
                <div class="pkc-toolbar">
                    <div class="btn-square" id="pkc-btnClose" title="Đóng game">
                        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>
                    </div>
                    <div class="btn-square" id="pkc-btnMenu" title="Về menu">
                        <svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>
                    </div>
                    <div class="btn-square" id="pkc-btnShuffle" title="Xáo bài">
                        <svg viewBox="0 0 24 24"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>
                        <span class="badge" id="pkc-shuffleBadge">1</span>
                    </div>
                    <div class="btn-square" id="pkc-btnHint" title="Gợi ý">
                        <svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z"/></svg>
                        <span class="badge" id="pkc-hintBadge">3</span>
                    </div>
                    <div class="btn-square" id="pkc-btnNewGame" title="Ván mới cùng map">
                        <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
                    </div>
                </div>
                <div class="pkc-boardcol">
                    <div class="pkc-topstats">
                        <div class="stat"><span class="val" id="pkc-statTime">00:00</span><span class="lbl">Thời gian</span></div>
                        <div class="stat"><span class="badge-mode" id="pkc-statMap">-</span><span class="lbl">Map</span></div>
                    </div>
            <div class="board-frame" id="pkc-boardFrame">
                <div class="board" id="pkc-board"></div>
                <div class="link-layer" id="pkc-linkLayer"></div>
                <div class="hanko" id="pkc-hanko"><span>完</span></div>
            </div>
                </div>
            </div>
        </div>

            <div class="result-banner" id="pkc-resultBanner">
                <div class="title" id="pkc-resultTitle">Chưa xong ván này</div>
                <div class="sub" id="pkc-resultSub"></div>
            </div>

            <div class="rotate-hint" id="pkc-rotateHint" style="display:none;">
                <div class="rotate-card">
                    <div class="rotate-icon">📱</div>
                    <div>Xoay ngang điện thoại để chơi</div>
                </div>
            </div>
            <div class="win-modal" id="pkc-winModal" style="display:none;">
                <div class="win-card">
                    <div class="win-emoji">🎉</div>
                    <div class="win-title">Qua màn!</div>
                    <div class="win-sub" id="pkc-winSub"></div>
                    <div class="win-note" id="pkc-winNote" style="display:none;"></div>
                    <div class="win-btns">
                        <button class="win-btn" id="pkc-winMenu">Menu</button>
                        <button class="win-btn" id="pkc-winReplay">Chơi lại</button>
                        <button class="win-btn primary" id="pkc-winNext">Tiếp →</button>
                    </div>
                </div>
            </div>
        </div>

        <footer>Pikachu · trò chơi nối hình thư giãn</footer>
    </div>`);
}
