let windowCounter = 0;
let zIndexCounter = 1;
let fsGameWindows = 0; // dem cua so game fullscreen dang mo (de thoat browser-fullscreen khi dong het)

/* Vao browser fullscreen (an thanh cong cu + notification bar cua trinh duyet).
   Chi goi tren mobile khi mo game; iPhone Safari khong ho tro thi bo qua em. */
function enterBrowserFullscreen() {
    try {
        if (document.fullscreenElement || document.webkitFullscreenElement) return;
        var el = document.documentElement;
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) {
            var p = req.call(el);
            if (p && typeof p.catch === "function") p.catch(function(){});
        }
    } catch (e) { /* thiet bi khong ho tro: bo qua */ }
}
function exitBrowserFullscreen() {
    try {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if ((document.fullscreenElement || document.webkitFullscreenElement) && ex) {
            var p = ex.call(document);
            if (p && typeof p.catch === "function") p.catch(function(){});
        }
    } catch (e) {}
}
function createWindow({
    title = "Untitled",
    content = "Empty window",
    iconUrl = "assets/icons/defaultIcon.svg",
    additionClass = "",
    width = 600,
    height = 400,
    top = 50,
    left = 50,
    allowResize = true,
    fullScreenApp = false
    } = {}) {
    // Tren mobile: moi cua so luon mo fullscreen, khong keo-tha/resize.
    var _isMobileWin = (typeof window !== 'undefined') && window.IS_MOBILE === true;
    if (_isMobileWin) { fullScreenApp = true; allowResize = false; }
    //1. Init windows layout 
    const windowElement = document.createElement('div');
    const uniqueId = `window-${Date.now()}-${++windowCounter}`;
    windowElement.id = uniqueId;
    windowElement.classList.add('window');
    if(fullScreenApp == true) {
        windowElement.style.left = '-1px';
        windowElement.style.top  = '-1px';
        windowElement.style.width  = `100%`;
        windowElement.style.height = `100%`;
        windowElement.style.minWidth = '0';
        windowElement.style.borderRadius = '0';
        if (window.IS_MOBILE === true) { enterBrowserFullscreen(); fsGameWindows++; }
        $('#taskbar').hide();
        $('#desktop').css('height', '100%');
    }
    else 
    {
        windowElement.style.left = left + 'px';
        windowElement.style.top = top + 'px';
        windowElement.style.width = `${width}px`;
        windowElement.style.height = `${height}px`;
        $('#taskbar').show();
        $('#desktop').css('height', 'calc(100% - 45px)');
    }
    
    windowElement.style.zIndex = zIndexCounter;
    //2. Create title bar layout 
    const windowTitleBar = document.createElement('div');
    windowTitleBar.classList.add('window-titlebar');
    //3. Create title bar toolbox layout
    const windowTitle = document.createElement('div');
    windowTitle.classList.add('window-title');
    const windowTitleIcon = document.createElement('div');
    windowTitleIcon.classList.add('window-title-icon');
    windowTitleIcon.style.backgroundImage = `url('${iconUrl}')`;
    const windowTitleText = document.createElement('div');
    windowTitleText.classList.add('window-title-text');
    windowTitleText.textContent = title;
    windowTitle.appendChild(windowTitleIcon);
    windowTitle.appendChild(windowTitleText);
    windowTitleBar.appendChild(windowTitle);
    const windowTitleBarToolBox = document.createElement('div');
    windowTitleBarToolBox.classList.add('window-titlebar-toolbox');
    const btnMaximizer = document.createElement('div');
    if(allowResize) {
        btnMaximizer.classList.add(
            'window-titlebar-toolbox-btn',
            'btn-icon-maximize'
        );
    }
    const btnMinimizer = document.createElement('div');
    btnMinimizer.classList.add(
        'window-titlebar-toolbox-btn',
        'btn-icon-minimize'
    );
    const btnCloser = document.createElement('div');
    btnCloser.classList.add(
        'window-titlebar-toolbox-btn',
        'btn-icon-close'
    );
    windowTitleBar.appendChild(windowTitleBarToolBox);
    if(!fullScreenApp) { 
        windowTitleBarToolBox.appendChild(btnMinimizer);
        windowTitleBarToolBox.appendChild(btnMaximizer);
        windowTitleBarToolBox.addEventListener('mousedown', function(event) {
            event.stopPropagation();
        });
        btnMaximizer.addEventListener('click', function(event) {
            event.stopPropagation();
            console.log('Nút Maximize được click, không kích hoạt sự kiện của title bar!');
        });
        btnMinimizer.addEventListener('click', function(event) {
            windowElement.style.display = 'none';
            event.stopPropagation();
        });
        
    }
    windowTitleBarToolBox.appendChild(btnCloser);
    btnCloser.addEventListener('click', function(event) {
        event.stopPropagation();
        windowElement.remove();
        taskbarIcon.remove();
        if (window.IS_MOBILE === true) {
            fsGameWindows = Math.max(0, fsGameWindows - 1);
            if (fsGameWindows === 0) exitBrowserFullscreen();
        }
        $('#taskbar').show();
        $('#desktop').css('height', '');
    });
    let taskbarIcon = addTaskbarIcon(title, iconUrl, uniqueId);
    
    const windowContent = document.createElement('div');
    windowContent.classList.add('window-content');
    if (additionClass) {
        windowContent.classList.add(additionClass);
    }
    windowContent.innerHTML = content;
    windowElement.appendChild(windowTitleBar);
    windowElement.appendChild(windowContent);

    document.getElementById('desktop').appendChild(windowElement);

    if (!_isMobileWin) { makeDraggable(windowElement, windowTitleBar); }
    bringToFront(windowElement);
    if (allowResize && !_isMobileWin) {
        makeResizable(windowElement);
    }
    
    return uniqueId;
}
function bringToFront(windowElement) {
    windowElement.addEventListener('mousedown', () => {
        zIndexCounter++;
        windowElement.style.zIndex = zIndexCounter;
    });
}

function makeDraggable(windowElement, handle) {
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;

    handle.addEventListener('mousedown', (e) => {
        isDragging = true;

        const rect = windowElement.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;

        handle.style.cursor = 'grabbing';

        // Ngăn chọn text khi kéo
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const desktop = document.getElementById('desktop');
        const desktopRect = desktop.getBoundingClientRect();

        let newLeft = e.clientX - desktopRect.left - offsetX;
        let newTop = e.clientY - desktopRect.top - offsetY;

        // Giới hạn không cho kéo ra ngoài desktop
        const maxLeft = desktop.clientWidth - windowElement.offsetWidth;
        const maxTop = desktop.clientHeight - windowElement.offsetHeight;

        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        windowElement.style.left = newLeft + 'px';
        windowElement.style.top = newTop + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            handle.style.cursor = 'grab';
        }
    });
}
function makeResizable(windowElement) {
    // Khai báo 8 hướng
    const resizers = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

    resizers.forEach(direction => {
        const resizer = document.createElement('div');
        resizer.classList.add('resizer', `resizer-${direction}`);
        windowElement.appendChild(resizer);

        resizer.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();

            // Lấy kích thước và vị trí ban đầu
            const styles = getComputedStyle(windowElement);
            const originalWidth = parseFloat(styles.getPropertyValue('width'));
            const originalHeight = parseFloat(styles.getPropertyValue('height'));
            
            // Lấy giới hạn min-width, min-height trực tiếp từ CSS fen đã cài đặt (ví dụ 600px)
            const minWidth = parseFloat(styles.getPropertyValue('min-width')) || 250;
            const minHeight = parseFloat(styles.getPropertyValue('min-height')) || 150;

            const originalX = windowElement.offsetLeft;
            const originalY = windowElement.offsetTop;
            const originalMouseX = e.pageX;
            const originalMouseY = e.pageY;

            document.body.style.cursor = styles.cursor;

            function resize(e) {
                // Xử lý kéo cạnh phải (East)
                if (direction.includes('e')) {
                    let width = originalWidth + (e.pageX - originalMouseX);
                    if (width < minWidth) width = minWidth; // Không cho nhỏ hơn giới hạn
                    windowElement.style.width = width + 'px';
                }
                
                // Xử lý kéo cạnh trái (West) - Đã Fix
                if (direction.includes('w')) {
                    let width = originalWidth - (e.pageX - originalMouseX);
                    if (width < minWidth) width = minWidth; // Khóa width
                    windowElement.style.width = width + 'px';
                    
                    // Tọa độ left phụ thuộc vào khoảng cách width thực tế đã bị thu hẹp
                    windowElement.style.left = originalX + (originalWidth - width) + 'px';
                }
                
                // Xử lý kéo cạnh dưới (South)
                if (direction.includes('s')) {
                    let height = originalHeight + (e.pageY - originalMouseY);
                    if (height < minHeight) height = minHeight;
                    windowElement.style.height = height + 'px';
                }
                
                // Xử lý kéo cạnh trên (North) - Đã Fix
                if (direction.includes('n')) {
                    let height = originalHeight - (e.pageY - originalMouseY);
                    if (height < minHeight) height = minHeight;
                    windowElement.style.height = height + 'px';
                    
                    // Tọa độ top phụ thuộc vào khoảng cách height thực tế đã bị thu hẹp
                    windowElement.style.top = originalY + (originalHeight - height) + 'px';
                }
            }

            function stopResize() {
                document.removeEventListener('mousemove', resize);
                document.removeEventListener('mouseup', stopResize);
                document.body.style.cursor = 'default';
            }

            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
        });
    });
}