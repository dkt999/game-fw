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
    const isMobile = (typeof window !== "undefined") && window.IS_MOBILE === true;
    const parentHeight = $('.icon-item').parent().height();
    const parentWidth = $('.icon-item').parent().width();
    pikachuWindowId = createWindow({
        title: 'Pikachu',
        iconUrl: "assets/icons/defaultGameIcon2.svg",
        additionClass: "pikachu-app",
        width: parentHeight - 25,
        height: parentHeight - 50,
        allowResize: false,
        fullScreenApp: isMobile,
        top: parentHeight - parentHeight + 25,
        left: parentWidth/2 - (parentHeight / 2)  + 25
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
            </header>

            <details class="rules">
                <summary>Cách chơi</summary>
                <ul>
                    <li>Chọn hai ô có <b>hình giống hệt nhau</b> để nối chúng lại và loại bỏ khỏi bàn cờ.</li>
                    <li>Đường nối giữa hai ô chỉ được phép <b>rẽ tối đa 2 lần</b>, không được đi xuyên qua ô còn hình khác.</li>
                    <li>Bí đường? Nhấn <b>Xáo bài</b> để xáo lại các ô còn lại (không đổi số lần xáo còn hạn chế ở mức khó cao).</li>
                    <li>Dùng <b>Gợi ý</b> để bàn cờ tự tìm và nhấp nháy một cặp có thể nối — số lần gợi ý có giới hạn.</li>
                    <li>Thắng khi dọn sạch toàn bộ bàn cờ trước khi hết giờ (nếu map có giới hạn thời gian).</li>
                </ul>
            </details>

            <div class="controls">
                <div class="diff-row" id="pkc-diffRow">
                    <button class="diff-btn" data-diff="easy">Dễ</button>
                    <button class="diff-btn" data-diff="medium">Trung bình</button>
                    <button class="diff-btn" data-diff="hard">Khó</button>
                    <button class="diff-btn" data-diff="expert">Chuyên gia</button>
                </div>
                <details class="map-picker">
                    <summary>Chọn map cụ thể (<span id="pkc-mapCount">0</span> map)</summary>
                    <div class="map-grid" id="pkc-mapGrid"></div>
                </details>
            </div>
        </div>

        <div id="pkc-gameArea" style="display:none;">
            <div class="stats-row">
                <div class="stats-container">
                    <div class="btn-square" id="pkc-btnMenu" title="Về menu">
                        <svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>
                    </div>
                    <div class="btn-square" id="pkc-btnShuffle" title="Xáo bài">
                        <svg viewBox="0 0 24 24"><path d="M16 3h5v5"/><path d="M4 20L21 3"/><path d="M21 16v5h-5"/><path d="M15 15l6 6"/><path d="M4 4l5 5"/></svg>
                    </div>
                    <div class="btn-square" id="pkc-btnHint" title="Gợi ý">
                        <svg viewBox="0 0 24 24"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2Z"/></svg>
                        <span class="badge" id="pkc-hintBadge">3</span>
                    </div>
                    <div class="btn-square" id="pkc-btnNewGame" title="Ván mới cùng map">
                        <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>
                    </div>
                </div>
                <div class="stats-container">
                    <div class="stat"><span class="val" id="pkc-statTime">00:00</span><span class="lbl">Thời gian</span></div>
                    <div class="stat"><span class="val" id="pkc-statPairs">0/0</span><span class="lbl">Cặp còn lại</span></div>
                    <div class="stat"><span class="val" id="pkc-statShuffle">-</span><span class="lbl">Xáo còn lại</span></div>
                    <div class="stat"><span class="badge-mode" id="pkc-statMap">-</span><span class="lbl">Map</span></div>
                </div>
            </div>

            <div class="board-frame" id="pkc-boardFrame">
                <div class="board" id="pkc-board"></div>
                <div class="link-layer" id="pkc-linkLayer"></div>
                <div class="hanko" id="pkc-hanko"><span>完</span></div>
            </div>

            <div class="result-banner" id="pkc-resultBanner">
                <div class="title" id="pkc-resultTitle">Hoàn thành!</div>
                <div class="sub" id="pkc-resultSub"></div>
            </div>
        </div>

        <footer>Pikachu · trò chơi nối hình thư giãn</footer>
    </div>`);
}
