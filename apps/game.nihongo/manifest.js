registerApp({
    "id": "7",
    "name": "にほんごチャレンジ",
    "icon": "./assets/icons/defaultGameIcon2.svg",
    "execScript": "openNihongo()"
});
let nihongoWindowId = null;
function openNihongo() {
    const $existingApp = $('.nihongo-app');
    if ($existingApp.length > 0) {
        const existingWindowId = $existingApp.closest('.window').attr('id');
        $(`#${existingWindowId}`).attr('index', zIndexCounter + 1);
        $(`#${existingWindowId}`).css('display', 'block');
        return;
    }
    loadAppStylesheet("./apps/game.nihongo/assets/style.css");
    nihongoWindowId = createWindow({
        title: 'にほんごチャレンジ',
        iconUrl: "assets/icons/defaultGameIcon2.svg",
        additionClass: "nihongo-app",
        allowResize: false,
        fullScreenApp: true
    });
    InitNihongo();
    loadAppScript("./apps/game.nihongo/assets/data.js", function(){
        loadAppScript("./apps/game.nihongo/assets/script.js", function() {});
    });
}
function InitNihongo() {
    $('#' + nihongoWindowId).find('.window-content').html(`
    <div class="nh-wrap">
        <div class="nh-menu" id="nh-menu">
            <h1>🗾 にほんごチャレンジ</h1>
            <p class="nh-sub">Thử thách tiếng Nhật N5</p>
            <div class="nh-modes">
                <button class="nh-mode" data-mode="kana">
                    <span class="nh-mode-icon">🔤</span>
                    <span class="nh-mode-name">かなマスター</span>
                    <span class="nh-mode-desc">Bảng chữ cái</span>
                </button>
                <button class="nh-mode locked" data-mode="kanji" disabled>
                    <span class="nh-mode-icon">🈷️</span>
                    <span class="nh-mode-name">漢字クイズ</span>
                    <span class="nh-mode-desc">Sắp ra mắt</span>
                </button>
                <button class="nh-mode locked" data-mode="grammar" disabled>
                    <span class="nh-mode-icon">📝</span>
                    <span class="nh-mode-name">文法パズル</span>
                    <span class="nh-mode-desc">Sắp ra mắt</span>
                </button>
                <button class="nh-mode locked" data-mode="vocab" disabled>
                    <span class="nh-mode-icon">📚</span>
                    <span class="nh-mode-name">たんごバトル</span>
                    <span class="nh-mode-desc">Sắp ra mắt</span>
                </button>
            </div>
        </div>
        <div class="nh-game" id="nh-game" style="display:none">
            <div class="nh-topbar">
                <button class="nh-btn" id="nh-back">← Menu</button>
                <div class="nh-score">Điểm: <span id="nh-score">0</span></div>
                <div class="nh-streak">🔥 <span id="nh-streak">0</span></div>
                <div class="nh-timer"><span id="nh-time">10</span>s</div>
            </div>
            <div class="nh-kana-type" id="nh-kanaType">
                <button class="nh-btn sm active" data-kana="hira">Hiragana</button>
                <button class="nh-btn sm" data-kana="kata">Katakana</button>
                <button class="nh-btn sm" data-kana="both">Cả hai</button>
            </div>
            <div class="nh-question">
                <div class="nh-kana" id="nh-kana">あ</div>
                <div class="nh-answers" id="nh-answers"></div>
            </div>
            <div class="nh-feedback" id="nh-feedback"></div>
        </div>
    </div>`);
}
