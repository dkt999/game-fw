registerApp({
    "id": "4",
    "name": "Mahjong",
    "icon": "./assets/icons/defaultGameIcon2.svg",
    "execScript": "openMahjongGame()"
});
let mahjongWindowId = null;
function openMahjongGame() {
    const $existingApp = $('.mahjong-app');
    if ($existingApp.length > 0) {
        const existingWindowId = $existingApp.closest('.window').attr('id');
        $(`#${existingWindowId}`).attr('index', zIndexCounter + 1);
        $(`#${existingWindowId}`).css('display', 'block');
        return;
    }
    loadAppStylesheet("./apps/game.mahjong/assets/style.css");
    try {
        if (window.IS_MOBILE === true && screen.orientation && screen.orientation.lock) {
            screen.orientation.lock("landscape").catch(function(){});
        }
    } catch (e) {}
    mahjongWindowId = createWindow({
        title: 'Mahjong',
        iconUrl: "assets/icons/defaultGameIcon2.svg",
        additionClass: "mahjong-app",
        allowResize: false,
        fullScreenApp: true,
        onClose: function() {
            try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
        }
    });
    InitMahjongGame();
    loadAppScript("./apps/game.mahjong/assets/script.js", function() {})
}
function InitMahjongGame() {
    $('#' + mahjongWindowId).find('.window-content').html(`
    <div class="mj-wrap">
        <div id="mj-mainMenu">
            <header>
                <div class="eyebrow">🀄 MAHJONG</div>
                <h1>Xếp <em>Hình</em></h1>
                <div class="subtitle">Gỡ các cặp hình giống nhau. Chỉ được chọn hình <b>tự do</b> (không bị hình nào đè lên).</div>
                <button class="rules-btn" id="mj-rulesBtn" title="Cách chơi">?</button>
            </header>
            <div class="rules-modal" id="mj-rulesModal" style="display:none;">
                <div class="rules-card">
                    <div class="rules-card-head"><span>Cách chơi</span><button class="rules-close" id="mj-rulesClose" title="Đóng">✕</button></div>
                    <ul>
                    <li>Các hình xếp chồng nhiều lớp. Chỉ được chọn hình <b>tự do</b>: <b>không bị hình nào đè lên</b>.</li>
                    <li>Chọn 2 hình tự do <b>giống hệt nhau</b> để gỡ khỏi bàn.</li>
                    <li>Hình bị chặn sẽ tối đi, không chọn được.</li>
                    <li>Bí đường: dùng <b>Xáo</b> để trộn lại các hình còn lại (số lượt giới hạn).</li>
                    <li>Dùng <b>Gợi ý</b> để máy chỉ một cặp có thể gỡ.</li>
                    <li>Thắng khi dọn sạch toàn bộ bàn.</li>
                    <li>Game có <b>10 pack × 10 map</b> (100 map). <b>5 map đầu</b> là thế cơ bản (<b>Mặt phẳng</b> → <b>Tháp đơn</b>) để làm quen. Từ map 6, <b>mỗi map 1 kiểu</b> xoay vòng: <b>Pháo đài</b>, <b>Song tháp</b>, <b>Kim tự tháp</b>, <b>Rải rác</b>, <b>Vòng vây</b>, <b>Chữ thập</b>.</li>
                    <li>Qua 1 map sẽ mở map tiếp theo. Tiến trình lưu trên máy.</li>
                    </ul>
                </div>
            </div>
            <div class="controls">
                <div class="pack-picker">
                    <div class="pack-nav">
                        <button class="pack-arrow" id="mj-packPrev" title="Pack trước">◀</button>
                        <div class="pack-title"><span id="mj-packName">Pack 1</span><span class="pack-progress" id="mj-packProg">0/10</span></div>
                        <button class="pack-arrow" id="mj-packNext" title="Pack sau">▶</button>
                    </div>
                    <div class="pack-grid" id="mj-mapGrid"></div>
                    <div class="pack-locknote" id="mj-packLockNote" style="display:none;"></div>
                </div>
            </div>
        </div>
        <div id="mj-game" style="display:none;">
            <div class="mj-toolbar">
                <div class="btn-square" id="mj-btnClose" title="Thoát"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></div>
                <div class="btn-square" id="mj-btnHome" title="Menu"><svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg></div>
                <div class="btn-square" id="mj-btnShuffle" title="Xáo hình"><svg viewBox="0 0 24 24"><path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="M4 4l5 5"/></svg><span class="badge" id="mj-shuffleBadge">3</span></div>
                <div class="btn-square" id="mj-btnHint" title="Gợi ý"><svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z"/></svg><span class="badge" id="mj-hintBadge">3</span></div>
                <div class="btn-square" id="mj-btnNew" title="Ván mới"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg></div>
            </div>
            <div class="mj-topbar">
                <span id="mj-statTime">⏱ 00:00</span>
                <span id="mj-statLeft">🀄 0</span>
                <span id="mj-statDiff">Vừa</span>
            </div>
            <div class="mj-warnbar" id="mj-warnBar" style="display:none;"></div>
            <div class="mj-boardFrame" id="mj-boardFrame">
                <div class="mj-board" id="mj-board"></div>
            </div>
            <div class="mj-modal" id="mj-endModal" style="display:none;">
                <div class="mj-modal-card">
                    <div class="mj-emoji" id="mj-endEmoji">🎉</div>
                    <div class="mj-title" id="mj-endTitle">Thắng rồi!</div>
                    <div class="mj-sub" id="mj-endSub"></div>
                    <button class="mj-btn" id="mj-againBtn">Chơi lại</button>
                    <button class="mj-btn ghost" id="mj-menuBtn">Menu</button>
                </div>
            </div>
        </div>
    </div>
    `);
}
