registerApp({
    "id": "9",
    "name": "Nông Trại Vui Vẻ",
    "icon": "./assets/icons/farmIcon.svg",
    "execScript": "openFarmGame()"
});
let farmWindowId = null;
function openFarmGame() {
    const $existingApp = $('.farm-app');
    if ($existingApp.length > 0) {
        const existingWindowId = $existingApp.closest('.window').attr('id');
        $(`#${existingWindowId}`).attr('index', zIndexCounter + 1);
        $(`#${existingWindowId}`).css('display', 'block');
        return;
    }
    loadAppStylesheet("./apps/game.farm/assets/style.css");
    farmWindowId = createWindow({
        title: 'Nông Trại Vui Vẻ',
        iconUrl: "assets/icons/farmIcon.svg",
        additionClass: "farm-app",
        allowResize: false,
        fullScreenApp: true
    });
    $('#' + farmWindowId).find('.window-content').html(`
    <div class="farm-wrap">
        <header class="farm-hud">
            <div class="farm-hud-left">
                <div class="farm-pill" id="farm-coins" title="Xu">🪙 <b>0</b></div>
                <div class="farm-pill" title="Cấp độ">⭐ <b id="farm-level">1</b>
                    <span class="farm-expbar"><i id="farm-expfill"></i></span>
                </div>
                <div class="farm-pill farm-auto" id="farm-autocoin" title="Xu tự động: +100 mỗi 10 phút">🎁 <b>+100</b> <span id="farm-autotime">10:00</span></div>
            </div>
            <div class="farm-hud-right">
                <button class="farm-hbtn" id="farm-btn-shop">🛒 Cửa hàng</button>
                <button class="farm-hbtn" id="farm-btn-kho">🎒 Kho</button>
                <button class="farm-hbtn" id="farm-btn-help">❓</button>
                <button class="farm-hbtn" id="farm-btn-sound">🔊</button>
            </div>
        </header>
        <nav class="farm-tabs">
            <button class="farm-tab active" data-tab="vuon">🌱 Vườn</button>
            <button class="farm-tab" data-tab="ao" id="farm-tab-ao">🐟 Ao <span class="farm-lock">🔒</span></button>
            <button class="farm-tab" data-tab="chuong" id="farm-tab-chuong">🐔 Chuồng <span class="farm-lock">🔒</span></button>
        </nav>
        <main class="farm-main">
            <section class="farm-pane active" id="farm-pane-vuon">
                <div class="farm-grid" id="farm-grid"></div>
            </section>
            <section class="farm-pane" id="farm-pane-ao">
                <div class="farm-water" id="farm-pond"></div>
                <p class="farm-note">Nuôi cá: mua cá giống → cho ăn 2 lần → thu hoạch bán xu + nhận phân bón.</p>
            </section>
            <section class="farm-pane" id="farm-pane-chuong">
                <div class="farm-coop" id="farm-coop"></div>
                <p class="farm-note">Nuôi gà: mua gà giống → cho ăn 2 lần → thu trứng bán xu + nhận phân bón.</p>
            </section>
        </main>
        <div class="farm-seedbar" id="farm-seedbar" style="display:none"></div>
        <footer class="farm-toolbar" id="farm-toolbar">
            <button class="farm-tool" data-tool="seed">🌱<span>Gieo</span></button>
            <button class="farm-tool" data-tool="water">💧<span>Tưới</span></button>
            <button class="farm-tool" data-tool="harvest">🧺<span>Thu hoạch</span></button>
            <button class="farm-tool" data-tool="fertilize">🌾<span>Bón phân</span></button>
            <button class="farm-tool" data-tool="clear">🧹<span>Dọn</span></button>
        </footer>
        <div class="farm-toast" id="farm-toast"></div>
        <div class="farm-modal" id="farm-modal" style="display:none"><div class="farm-modal-box" id="farm-modal-box"></div></div>
    </div>`);
    loadAppScript("./apps/game.farm/assets/script.js", function() {
        if (window.FarmGame && window.FarmGame.init) window.FarmGame.init(farmWindowId);
    });
}
