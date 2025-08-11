// popup.js (v6 - Verified and Robust)

document.addEventListener('DOMContentLoaded', () => {
  // Get elements after the DOM is fully loaded
  const translateButton = document.getElementById('translateBtn');
  const messageElement = document.getElementById('message');
  const settingsButton = document.getElementById('settings-btn');

  // Defensive check in case the element doesn't exist
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      // This is the standard Chrome API to open the options page
      chrome.runtime.openOptionsPage();
    });
  }

  if (translateButton) {
    translateButton.addEventListener('click', async () => {
      try {
        messageElement.textContent = '初始化...';
        messageElement.style.color = 'black';

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.id) throw new Error('无法获取当前标签页。');
        if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('https://chrome.google.com'))) {
          throw new Error('无法在此特殊页面上翻译。');
        }
        
        messageElement.textContent = '正在注入脚本...';
        
        await new Promise((resolve, reject) => {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          }, () => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve());
        });

        chrome.tabs.sendMessage(tab.id, { action: "start_translation" });
        messageElement.textContent = '翻译指令已发送，内容将分批显示。';

      } catch (error) {
        console.error("Popup script error:", error);
        messageElement.textContent = `错误: ${error.message}`;
        messageElement.style.color = 'red';
      }
    });
  }
});