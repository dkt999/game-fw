/* =====================================================================
   mobile.js — Nhận diện thiết bị di động cho game-fw
   File này phải được load TRƯỚC background.js / window.js / desktop.js
   và trước mọi manifest.js của game.

   window.IS_MOBILE = true khi:
     - viewport hẹp (<= 767px), hoặc
     - thiết bị cảm ứng (pointer: coarse) có cạnh màn hình nhỏ < 900px
       (bắt cả tablet dọc).
   Đồng thời gắn class `is-mobile` lên <html> để CSS bám theo.
===================================================================== */
(function () {
    "use strict";
    function detectMobile() {
        try {
            if (window.matchMedia("(max-width: 767px)").matches) return true;
            var coarse = window.matchMedia("(pointer: coarse)").matches;
            if (coarse) {
                var s = window.screen || {};
                var w = s.width || window.innerWidth || 0;
                var h = s.height || window.innerHeight || 0;
                if (Math.min(w, h) > 0 && Math.min(w, h) < 900) return true;
            }
        } catch (e) { /* bỏ qua, coi như desktop */ }
        return false;
    }
    window.IS_MOBILE = detectMobile();
    if (window.IS_MOBILE) {
        document.documentElement.classList.add("is-mobile");
    }
    /* Version asset de chong cache: moi lan push code moi thi tang version nay
       (va ?v= tren index.html) de dien thoai khong dung file CSS/JS cu. */
    window.APP_VERSION = "20261011l";

    /* Wake Lock: giữ màn hình không tự tắt khi chơi (app/PWA).
       Trình duyệt tự huỷ khi ẩn app -> xin lại khi hiện lên. */
    var _wakeLock = null;
    function requestWakeLock() {
        try {
            if (!("wakeLock" in navigator) || !navigator.wakeLock.request) return;
            // Chỉ giữ khi app đang hiển thị
            if (document.visibilityState !== "visible") return;
            navigator.wakeLock.request("screen").then(function(lock) {
                _wakeLock = lock;
                lock.addEventListener("release", function() { _wakeLock = null; });
            }).catch(function() { /* thiết bị không cho -> bỏ qua */ });
        } catch (e) { /* không hỗ trợ -> bỏ qua */ }
    }
    if (window.IS_MOBILE) {
        requestWakeLock();
        document.addEventListener("visibilitychange", function() {
            if (document.visibilityState === "visible") requestWakeLock();
        });
    }
})();
