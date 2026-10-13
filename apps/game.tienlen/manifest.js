registerApp({
    "id": "6",
    "name": "Tiến Lên",
    "icon": "./assets/icons/defaultGameIcon2.svg",
    "execScript": "openTienLen()"
});
let tienlenWindowId = null;
function openTienLen() {
    const $existingApp = $('.tienlen-app');
    if ($existingApp.length > 0) {
        const existingWindowId = $existingApp.closest('.window').attr('id');
        $(`#${existingWindowId}`).attr('index', zIndexCounter + 1);
        $(`#${existingWindowId}`).css('display', 'block');
        return;
    }
    loadAppStylesheet("./apps/game.tienlen/assets/style.css");
    tienlenWindowId = createWindow({
        title: 'Tiến Lên',
        iconUrl: "assets/icons/defaultGameIcon2.svg",
        additionClass: "tienlen-app",
        allowResize: false,
        fullScreenApp: true
    });
    InitTienLen();
    loadAppScript("./apps/game.tienlen/assets/script.js", function() {});
}
function InitTienLen() {
    $('#' + tienlenWindowId).find('.window-content').html(`
    <div class="tl-wrap">
        <div class="tl-table">
            <div class="tl-bot tl-bot-top" id="tl-bot1">
                <div class="tl-bot-name">Bot 1</div>
                <div class="tl-bot-cards" id="tl-botCards1"></div>
                <div class="tl-bot-play" id="tl-botPlay1"></div>
            </div>
            <div class="tl-mid">
                <div class="tl-bot tl-bot-left" id="tl-bot0">
                    <div class="tl-bot-name">Bot 3</div>
                    <div class="tl-bot-cards" id="tl-botCards0"></div>
                    <div class="tl-bot-play" id="tl-botPlay0"></div>
                </div>
                <div class="tl-center">
                    <div class="tl-trick" id="tl-trick"></div>
                    <div class="tl-status" id="tl-status">Chia bài...</div>
                </div>
                <div class="tl-bot tl-bot-right" id="tl-bot2">
                    <div class="tl-bot-name">Bot 2</div>
                    <div class="tl-bot-cards" id="tl-botCards2"></div>
                    <div class="tl-bot-play" id="tl-botPlay2"></div>
                </div>
            </div>
            <div class="tl-popup" id="tl-popup" style="display:none">
                <div class="tl-popup-box">
                    <h2>🏁 Kết quả</h2>
                    <div class="tl-result" id="tl-result"></div>
                    <button class="tl-btn primary" id="tl-again">Chơi tiếp</button>
                </div>
            </div>
            <div class="tl-player">
                <div class="tl-hand" id="tl-hand"></div>
                <div class="tl-level">
                    <span>Độ khó:</span>
                    <button class="tl-btn sm" data-level="easy">Dễ</button>
                    <button class="tl-btn sm active" data-level="medium">Vừa</button>
                    <button class="tl-btn sm" data-level="hard">Khó</button>
                </div>
                <div class="tl-actions">
                    <button class="tl-btn" id="tl-sort">Xếp bài</button>
                    <button class="tl-btn primary" id="tl-play">Đánh</button>
                    <button class="tl-btn" id="tl-pass">Bỏ qua</button>
                    <button class="tl-btn" id="tl-new">Ván mới</button>
                </div>
            </div>
        </div>
    </div>`);
}
