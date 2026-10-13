registerApp({
    "id": "5",
    "name": "1024",
    "icon": "./assets/icons/defaultGameIcon2.svg",
    "execScript": "openGame1024()"
});
let game1024WindowId = null;
function openGame1024() {
    const $existingApp = $('.game1024-app');
    if ($existingApp.length > 0) {
        const existingWindowId = $existingApp.closest('.window').attr('id');
        $(`#${existingWindowId}`).attr('index', zIndexCounter + 1);
        $(`#${existingWindowId}`).css('display', 'block');
        return;
    }
    loadAppStylesheet("./apps/game.1024/assets/style.css");
    game1024WindowId = createWindow({
        title: '1024',
        iconUrl: "assets/icons/defaultGameIcon2.svg",
        additionClass: "game1024-app",
        allowResize: false,
        fullScreenApp: true
    });
    InitGame1024();
    loadAppScript("./apps/game.1024/assets/script.js", function() {});
}
function InitGame1024() {
    $('#' + game1024WindowId).find('.window-content').html(`
    <div class="g1024-wrap">
        <header class="g1024-header">
            <div>
                <h1>1024</h1>
                <p class="g1024-sub">Trượt để gộp số — chạm 1024 là thắng!</p>
            </div>
            <div class="g1024-scores">
                <div class="g1024-score"><span class="lbl">Điểm</span><span class="val" id="g1024-score">0</span></div>
                <div class="g1024-score"><span class="lbl">Kỷ lục</span><span class="val" id="g1024-best">0</span></div>
            </div>
        </header>
        <div class="g1024-controls">
            <button class="g1024-btn" id="g1024-new">↻ Ván mới</button>
            <button class="g1024-btn" id="g1024-undo">↩ Hoàn tác</button>
        </div>
        <div class="g1024-board-frame">
            <div class="g1024-board" id="g1024-board">
                <div class="g1024-tiles" id="g1024-tiles"></div>
            </div>
            <div class="g1024-overlay" id="g1024-overlay">
                <div class="g1024-overlay-text" id="g1024-overlayText"></div>
                <button class="g1024-btn primary" id="g1024-again">Chơi lại</button>
            </div>
        </div>
        <p class="g1024-hint">Dùng phím mũi tên / WASD hoặc vuốt để chơi</p>
    </div>`);
}
