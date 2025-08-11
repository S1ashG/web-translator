// popup.js (v6 - Verified and Robust)

document.addEventListener('DOMContentLoaded', async () => {
    const translateButton = document.getElementById('translateBtn');
    const messageElement = document.getElementById('message');
    const settingsButton = document.getElementById('settings-btn');

    if (settingsButton) {
        settingsButton.addEventListener('click', () => chrome.runtime.openOptionsPage());
    }

    if (!translateButton) return;

    let activeTab;
    try {
        [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!activeTab || !activeTab.id) throw new Error('无法获取当前标签页。');
        if (activeTab.url && (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('https://chrome.google.com'))) {
            translateButton.disabled = true;
            messageElement.textContent = '无法在此特殊页面上操作。';
            return;
        }

        // Get initial state from background script to set the button correctly
        const response = await chrome.runtime.sendMessage({ action: 'get_tab_state', tabId: activeTab.id });
        if (response) {
            updateButtonUI(response.isTranslating);
        } else {
            throw new Error('未能从后台获取状态，请尝试重新加载插件。');
        }

    } catch (error) {
        console.error("Popup setup error:", error);
        messageElement.textContent = `错误: ${error.message}`;
        messageElement.style.color = 'red';
        translateButton.disabled = true;
        return;
    }

    function updateButtonUI(isTranslating) {
        if (isTranslating) {
            translateButton.textContent = '停止翻译';
            translateButton.style.backgroundColor = '#dc3545'; // A red color for "stop"
        } else {
            translateButton.textContent = '翻译当前页面';
            translateButton.style.backgroundColor = '#007bff'; // A blue color for "start"
        }
    }

    translateButton.addEventListener('click', async () => {
        try {
            // Single message to toggle and get the new state back.
            const response = await chrome.runtime.sendMessage({ action: 'toggle_translation_from_popup', tab: activeTab });
            
            if (response && typeof response.isTranslating !== 'undefined') {
                updateButtonUI(response.isTranslating);
                messageElement.textContent = response.isTranslating ? '翻译已启动。' : '翻译已停止。';
                messageElement.style.color = 'black';
                if (response.error) {
                    throw new Error(response.error);
                }
            } else {
                throw new Error('从后台收到了无效的响应。');
            }
        } catch (error) {
            console.error("Popup click error:", error);
            messageElement.textContent = `错误: ${error.message}`;
            messageElement.style.color = 'red';
        }
    });
});