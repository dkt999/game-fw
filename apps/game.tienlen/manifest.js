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
    try {
        if (window.IS_MOBILE === true && screen.orientation && screen.orientation.lock) {
            screen.orientation.lock("landscape").catch(function(){});
        }
    } catch (e) {}
    tienlenWindowId = createWindow({
        title: 'Tiến Lên',
        iconUrl: "assets/icons/defaultGameIcon2.svg",
        additionClass: "tienlen-app",
        allowResize: false,
        fullScreenApp: true,
        onClose: function() {
            try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
        }
    });
    InitTienLen();
    loadAppScript("./apps/game.tienlen/assets/script.js", function() {});
}
function InitTienLen() {
    $('#' + tienlenWindowId).find('.window-content').html(`
    <div class="tl-arena">
        <!-- Bot 1 (trên) -->
        <div class="tl-seat tl-seat-top">
            <div class="tl-hand-area" id="tl-botCards1"></div>
            <div class="tl-name">Bot 1</div>
            <div class="tl-play-area" id="tl-botPlay1"></div>
        </div>
        <!-- Bot 3 (trái) -->
        <div class="tl-seat tl-seat-left">
            <div class="tl-hand-area" id="tl-botCards0"></div>
            <div class="tl-name">Bot 3</div>
            <div class="tl-play-area" id="tl-botPlay0"></div>
        </div>
        <!-- Giữa: trạng thái -->
        <div class="tl-center-arena">
            <div class="tl-status" id="tl-status">Chia bài...</div>
            <div class="tl-level">
                <button class="tl-btn sm" data-level="easy">Dễ</button>
                <button class="tl-btn sm active" data-level="medium">Vừa</button>
                <button class="tl-btn sm" data-level="hard">Khó</button>
            </div>
        </div>
        <!-- Bot 2 (phải) -->
        <div class="tl-seat tl-seat-right">
            <div class="tl-play-area" id="tl-botPlay2"></div>
            <div class="tl-name">Bot 2</div>
            <div class="tl-hand-area" id="tl-botCards2"></div>
        </div>
        <!-- Người chơi (dưới) -->
        <div class="tl-seat tl-seat-bottom">
            <div class="tl-play-area" id="tl-playerPlay"></div>
            <div class="tl-name">Bạn</div>
            <div class="tl-hand-area player" id="tl-hand"></div>
            <div class="tl-actions">
                <button class="tl-btn" id="tl-sort">Xếp bài</button>
                <button class="tl-btn primary" id="tl-play">Đánh</button>
                <button class="tl-btn" id="tl-pass">Bỏ qua</button>
                <button class="tl-btn" id="tl-new">Ván mới</button>
            </div>
        </div>
        <div class="tl-popup" id="tl-popup" style="display:none">
            <div class="tl-popup-box">
                <h2>🏁 Kết quả</h2>
                <div class="tl-result" id="tl-result"></div>
                <button class="tl-btn primary" id="tl-again">Chơi tiếp</button>
            </div>
        </div>
    </div>`);
}
