window.appListData = [];
window.APP_VERSION = "20261022a";
function registerApp(appInfo) {
    window.appListData.push(appInfo);
}
function assetUrl(path) {
    var v = (typeof window !== "undefined" && window.APP_VERSION) ? "?v=" + window.APP_VERSION : "";
    return path + v;
}
function loadAppStylesheet(cssPath) {
    if (!cssPath) return;
    if ($(`link[href^="${cssPath}"]`).length === 0) {
        $('<link>', {
            rel: 'stylesheet',
            type: 'text/css',
            href: assetUrl(cssPath),
        }).appendTo('head');
    }
}
function loadAppScript(scriptPath, callback) {
    if (!scriptPath) {
        if (callback) callback();
        return;
    }
    if ($(`script[src^="${scriptPath}"]`).length === 0) {
        $.getScript(assetUrl(scriptPath))
            .done(function() {
                if (callback) callback();
            })
            .fail(function() {
                console.error("Không thể tải script: " + scriptPath);
            });
    } else {
        if (callback) callback();
    }
}
$(document).ready(function() {
    const desktopUrl = assetUrl('assets/config/desktop.json');
    const appListUrl = assetUrl('assets/config/app_list.json');
    $.getJSON(appListUrl)
        .done(function(manifestList) {
            let scriptPromises = manifestList.map(function(item) {
                return $.getScript(assetUrl(item.manifest));
            });
            $.when.apply($, scriptPromises).done(function() {
                $.getJSON(desktopUrl)
                    .done(function(desktopData) {
                        const icons = desktopData.iconsApp;
                        let htmlContent = '';
                $.each(icons, function(index, item) {
                    const appInfo = window.appListData.find(app => String(app.id) === String(item.id));
                    if (appInfo) {
                        htmlContent += `
                            <div class="icon-item" data-id="${item.id}" data-slot="${item.slot}" data-script="${encodeURIComponent(appInfo.execScript || '')}">
                                <img class="icon-item-logo" src="${appInfo.icon}" alt="${appInfo.name}">
                                <span class="icon-item-text">${appInfo.name}</span>
                            </div>
                        `;
                            }
                        });
                        $('#icon-layout').html(htmlContent);
                    })
                    .fail(function() {
                        console.error("Không thể tải file desktop.json");
                    });
            }).fail(function() {
                console.error("Lỗi khi tải một hoặc nhiều file manifest.js");
            });
        })
        .fail(function() {
            console.error("Không thể tải file app_list.json");
        });
    $('#icon-layout').on('click', '.icon-item', function() {
        const encodedScript = $(this).attr('data-script');
        if (encodedScript) {
            const scriptToRun = decodeURIComponent(encodedScript);
            try {
                const runFn = new Function(scriptToRun);
                runFn();
            } catch (e) {
                console.error("Lỗi khi thực thi script ứng dụng:", e);
            }
        }
    });
});