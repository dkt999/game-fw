registerApp({
    "id": "8",
    "name": "Pixel Defense",
    "icon": "./assets/icons/defaultGameIcon2.svg",
    "execScript": "openTowerDefense()"
});
let tdWindowId = null;
function openTowerDefense() {
    const $existingApp = $('.towerdefense-app');
    if ($existingApp.length > 0) {
        const existingWindowId = $existingApp.closest('.window').attr('id');
        $(`#${existingWindowId}`).attr('index', zIndexCounter + 1);
        $(`#${existingWindowId}`).css('display', 'block');
        return;
    }
    loadAppStylesheet("./apps/game.towerdefense/assets/style.css");
    tdWindowId = createWindow({
        title: 'Pixel Defense',
        iconUrl: "assets/icons/defaultGameIcon2.svg",
        additionClass: "towerdefense-app",
        allowResize: false,
        fullScreenApp: true
    });
    InitTD();
    loadAppScript("./apps/game.towerdefense/assets/sprites.js", function(){
        loadAppScript("./apps/game.towerdefense/assets/game.js", function(){
            window.TDInit();
        });
    });
}
function InitTD() {
    $('#' + tdWindowId).find('.window-content').html(`
    <div class="td-wrap">
        <div class="td-hud">
            <div class="td-stat">🪙 <span id="td-gold">200</span></div>
            <div class="td-stat">❤️ <span id="td-lives">20</span></div>
            <div class="td-stat">🌊 Đợt <span id="td-wave">0/15</span></div>
            <button class="td-btn primary" id="td-startWave">▶ Bắt đầu</button>
            <button class="td-btn" id="td-restart">↻ Chơi lại</button>
        </div>
        <div class="td-main">
            <div class="td-sidebar">
                <h3>🏹 Tháp</h3>
                <button class="td-tower-btn" data-tower="arrow">
                    <span class="td-tname">Cung</span><span class="td-tcost">50🪙</span>
                    <span class="td-tdesc">Bắn nhanh</span>
                </button>
                <button class="td-tower-btn" data-tower="cannon">
                    <span class="td-tname">Pháo</span><span class="td-tcost">100🪙</span>
                    <span class="td-tdesc">Sát thương lan</span>
                </button>
                <button class="td-tower-btn" data-tower="frost">
                    <span class="td-tname">Băng</span><span class="td-tcost">80🪙</span>
                    <span class="td-tdesc">Làm chậm</span>
                </button>
                <button class="td-tower-btn" data-tower="tesla">
                    <span class="td-tname">Sét</span><span class="td-tcost">150🪙</span>
                    <span class="td-tdesc">Tầm xa</span>
                </button>
                <div class="td-tower-info" id="td-towerInfo" style="display:none"></div>
                <h3>📜 Log</h3>
                <div class="td-log" id="td-log"></div>
            </div>
            <div class="td-board">
                <canvas id="td-canvas"></canvas>
            </div>
        </div>
        <div class="td-popup" id="td-endPopup" style="display:none">
            <div class="td-popup-box">
                <h2 id="td-endTitle"></h2>
                <p id="td-endSub"></p>
                <button class="td-btn primary" id="td-againBtn">Chơi lại</button>
            </div>
        </div>
    </div>`);
    document.getElementById("td-againBtn").addEventListener("click", () => {
        if (window.TDRestart) window.TDRestart();
    });
}
