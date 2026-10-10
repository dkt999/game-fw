function addTaskbarIcon(appName, iconUrl, windowId) {
    const taskbar = document.getElementById('taskbar');
    const taskbarIcon = document.createElement('div');
    taskbarIcon.classList.add('taskbar-icon');
    taskbarIcon.id = `taskbar-icon-${windowId}`;
    taskbarIcon.style.backgroundImage = `url('${iconUrl}')`;
    taskbarIcon.title = appName;
    taskbarIcon.dataset.windowId = windowId;
    taskbar.appendChild(taskbarIcon);

    // Add click event listener to the taskbar icon
    taskbarIcon.addEventListener('click', function() {
        const windowElement = document.getElementById(windowId);
        if (windowElement) {
            // Toggle window visibility
            if (windowElement.style.display === 'none') {
                windowElement.style.display = 'block';
            } else {
                windowElement.style.display = 'none';
            }
        }
    });
    return taskbarIcon;
}