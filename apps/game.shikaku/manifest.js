registerApp({
    "id": "1",
    "name": "Shikaku",
    "icon": "./assets/icons/defaultGameIcon2.svg",
    "execScript": "openShikakuGame()"
});
let shikakuWindowId = null;
function openShikakuGame() {
    const $existingApp = $('.shikaku-app');
    if ($existingApp.length > 0) {
        const existingWindowId = $existingApp.closest('.window').attr('id');
        console.log(zIndexCounter)
        $(`#${existingWindowId}`).attr('index', zIndexCounter + 1);
        $(`#${existingWindowId}`).css('display', 'block');
        return; 
    }
    loadAppStylesheet("./apps/game.shikaku/assets/style.css");
    // Game luôn mở fullscreen (giống Sudoku); chế độ cửa sổ để dành cho app sau này.
    shikakuWindowId = createWindow({
        title: 'Shikaku',
        iconUrl: "assets/icons/defaultGameIcon2.svg",
        additionClass: "shikaku-app",
        allowResize: false,
        fullScreenApp: true
    });
    InitShikakuGame();
    loadAppScript("./apps/game.shikaku/assets/script.js", function() { 
        
    })
}
function InitShikakuGame() {
    $('#' + shikakuWindowId).find('.window-content').html(`
    <div class="wrap">
        <div id="shk-mainShikakuMenu"> 
            <header>
                <div class="eyebrow">四角に切れ · SHIKAKU</div>
                <h1>Ô Vuông <em>Số</em></h1>
                <svg class="brush-underline" viewBox="0 0 340 14" preserveAspectRatio="none">
                    <path d="M4 8 C 60 2, 120 12, 170 6 S 280 2, 336 9"/>
                </svg>
            </header>
            <details class="rules">
                <summary>Luật chơi</summary>
                <ul>
                    <li>Bảng là một lưới hình chữ nhật, kích thước hai cạnh từ <b>5 đến 16</b> ô tùy độ khó. Một số ô trên lưới có sẵn con số.</li>
                    <li>Kéo chuột (hoặc vuốt trên điện thoại) từ một ô để chọn ra một vùng hình chữ nhật.</li>
                    <li>Vùng bạn chọn phải chứa <b>đúng một con số</b>, và tổng số ô trong vùng phải <b>bằng đúng</b> con số đó — ví dụ số 4 có thể là 1×4, 4×1 hoặc 2×2.</li>
                    <li>Các vùng đã đặt <b>không được chồng lên nhau</b>. Mỗi vùng hợp lệ sẽ được tô một màu riêng để phân biệt.</li>
                    <li>Đặt nhầm hay đổi ý? Nhấn vào vùng màu đó để bỏ chọn.</li>
                    <li>Bạn <b>phá đảo</b> khi toàn bộ lưới được lấp đầy bằng các vùng hợp lệ, không ô nào trống hay chồng lấn.</li>
                </ul>
            </details>
            <div class="controls">
                <div class="diff-row" id="shk-diffRow">
                <button class="diff-btn" data-diff="easy">Dễ · 5–6</button>
                <button class="diff-btn" data-diff="medium">Trung bình · 7–9</button>
                <button class="diff-btn" data-diff="hard">Khó · 10–12</button>
                <button class="diff-btn" data-diff="expert">Rất khó · 13–16</button>
                <button class="diff-btn" data-diff="custom">Tùy chỉnh</button>
                </div>

                <div class="custom-panel" id="shk-customPanel">
                    <div class="custom-row">
                        <label for="customW">Chiều rộng <span id="shk-cwVal">8</span></label>
                        <input type="range" min="5" max="32" value="8" id="shk-customW">
                    </div>
                    <div class="custom-row">
                        <label for="customH">Chiều cao <span id="shk-chVal">8</span></label>
                        <input type="range" min="5" max="32" value="8" id="shk-customH">
                    </div>
                    <button class="btn primary" id="shk-btnCustomStart">Bắt đầu ván tùy chỉnh</button>
                </div>
                <div class="action-row" id="shk-actionRowStartGame">
                    <button class="btn primary" id="shk-btnNew">Bắt đầu ván mới</button>
                </div>
                <div class="hint-line">Kéo để chọn vùng · Nhấn vào vùng màu để bỏ chọn</div>
            </div>
        </div>
        <div id="shk-gameShikakuArea" style="display: none;">
            <div class="stats-row">
                <div class="stats-container">
                    <div class="btn-square home" id="shk-btnMenu"></div>
                    <div class="btn-square clear" id="shk-btnClear"></div>
                    <div class="btn-square new" id="shk-btnNewGame"></div>
                </div>
                <div class="stats-container">
                    <div class="stat"><span class="val" id="shk-statTime">00:00</span><span class="lbl">Thời gian</span></div>
                    <div class="stat"><span class="val" id="shk-statFilled">0/0</span><span class="lbl">Đã lấp đầy</span></div>
                    <div class="stat"><span class="val" id="shk-statRegions">0</span><span class="lbl">Vùng đã đặt</span></div>
                </div>
            </div>
            <div class="board-frame" id="shk-boardFrame">
                <div class="board" id="shk-board">
                <div class="numbers-layer" id="shk-numbersLayer"></div>
                <div class="regions-layer" id="shk-regionsLayer"></div>
                <div class="preview-layer" id="shk-previewLayer">
                    <div class="preview" id="shk-preview"></div>
                </div>
                <div class="hanko" id="shk-hanko"><span>完</span></div>
            </div>
        </div>
            <div class="result-banner" id="shk-resultBanner">
                <div class="title">Completed!</div>
                <div class="sub" id="shk-resultSub"></div>
            </div>
        </div>
    </div>
    <footer>Shikaku · trò chơi câu đố logic Nhật Bản</footer>
</div>`);
}