// options.js (v9 - Genuinely Complete and Corrected)
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const serviceSelect = document.getElementById('service');
    const apiKeyInput = document.getElementById('apiKey');
    const saveButton = document.getElementById('save');
    const statusDiv = document.getElementById('status');
    const llmSettingsDiv = document.getElementById('llm-settings');
    // Gemini
    const geminiModelSelectorDiv = document.getElementById('gemini-model-selector');
    const fetchGeminiModelsBtn = document.getElementById('fetchGeminiModelsBtn');
    const geminiModelSelect = document.getElementById('geminiModel');
    // DeepSeek
    const deepseekModelSelectorDiv = document.getElementById('deepseek-model-selector');
    const fetchDeepSeekModelsBtn = document.getElementById('fetchDeepSeekModelsBtn');
    const deepseekModelSelect = document.getElementById('deepseekModel');
    // Common
    const systemPromptText = document.getElementById('systemPrompt');
    const userPromptText = document.getElementById('userPrompt');
    const batchSizeInput = document.getElementById('batchSize');
    const batchDelayInput = document.getElementById('batchDelay');

    let cachedSettings = {};

    const defaultSystemPrompt = `You are an expert translator. Your sole purpose is to accurately and fluently translate the user's text into professional, natural-sounding Chinese (Simplified).\n\nRules:\n- Do NOT add any extra explanations, comments, or annotations in your response.\n- Return ONLY the translated text.\n- Preserve the original formatting, including paragraphs and line breaks.\n- If the input text is a proper noun, a brand name, or a technical term that should not be translated, return it as is.\n- Handle complex sentences and idiomatic expressions with care, prioritizing meaning and readability over literal translation.`;
    const defaultUserPrompt = `Please translate the following text into Chinese:\n\n{{text}}`;

    function showStatus(message, color) {
        statusDiv.textContent = message;
        statusDiv.style.color = 'white';
        statusDiv.style.backgroundColor = color === 'green' ? '#28a745' : '#dc3545';
        statusDiv.style.display = 'block';
        if (color === 'green') {
            setTimeout(() => { statusDiv.style.display = 'none'; statusDiv.textContent = ''; }, 3000);
        }
    }

    function updateApiKeyInput(service) {
        if (cachedSettings.apiKeys) {
            apiKeyInput.value = cachedSettings.apiKeys[service] || '';
        }
    }

    function toggleLlmSettings() {
        const selectedService = serviceSelect.value;
        const isLlmService = selectedService === 'gemini' || selectedService === 'deepseek';
        llmSettingsDiv.classList.toggle('hidden', !isLlmService);
        geminiModelSelectorDiv.classList.toggle('hidden', selectedService !== 'gemini');
        deepseekModelSelectorDiv.classList.toggle('hidden', selectedService !== 'deepseek');
    }

    function saveOptions() {
        const currentService = serviceSelect.value;
        const currentApiKey = apiKeyInput.value.trim();

        if (!cachedSettings.apiKeys) {
            cachedSettings.apiKeys = {};
        }
        cachedSettings.apiKeys[currentService] = currentApiKey;

        const settingsToSave = {
            translationService: currentService,
            apiKeys: cachedSettings.apiKeys,
            geminiModel: geminiModelSelect.value,
            deepseekModel: deepseekModelSelect.value,
            systemPrompt: systemPromptText.value,
            userPrompt: userPromptText.value,
            batchSize: parseInt(batchSizeInput.value, 10) || 5,
            batchDelay: parseInt(batchDelayInput.value, 10) || 1000,
        };

        chrome.storage.sync.set(settingsToSave, () => {
            showStatus('设置已保存！', 'green');
        });
    }

    async function fetchGeminiModels() {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showStatus('请输入 Gemini API Key 以获取模型。', 'red');
            return;
        }
        showStatus('正在获取 Gemini 模型列表...', 'black');
        statusDiv.style.backgroundColor = '#eee';
        try {
            const response = await chrome.runtime.sendMessage({ action: 'fetch_gemini_models', key: apiKey });
            if (response.success && response.models) {
                geminiModelSelect.innerHTML = '';
                response.models.forEach(modelName => {
                    const option = document.createElement('option');
                    option.value = modelName;
                    option.textContent = modelName;
                    geminiModelSelect.appendChild(option);
                });
                showStatus('Gemini 模型列表获取成功！', 'green');
            } else {
                showStatus(`获取失败: ${response.error}`, 'red');
            }
        } catch(e) {
            showStatus(`通信错误: ${e.message}`, 'red');
        }
    }

    async function fetchDeepSeekModels() {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showStatus('请输入 DeepSeek API Key 以获取模型。', 'red');
            return;
        }
        showStatus('正在获取 DeepSeek 模型列表...', 'black');
        statusDiv.style.backgroundColor = '#eee';
        try {
            const response = await chrome.runtime.sendMessage({ action: 'fetch_deepseek_models', key: apiKey });
            if (response.success && response.models) {
                deepseekModelSelect.innerHTML = '';
                response.models.forEach(modelName => {
                    const option = document.createElement('option');
                    option.value = modelName;
                    option.textContent = modelName;
                    deepseekModelSelect.appendChild(option);
                });
                showStatus('DeepSeek 模型列表获取成功！', 'green');
            } else {
                showStatus(`获取失败: ${response.error}`, 'red');
            }
        } catch(e) {
            showStatus(`通信错误: ${e.message}`, 'red');
        }
    }

    function restoreOptions() {
        const defaults = {
            translationService: 'deepl',
            apiKeys: { deepl: '', gemini: '', deepseek: '' },
            geminiModel: '',
            deepseekModel: '',
            systemPrompt: defaultSystemPrompt,
            userPrompt: defaultUserPrompt,
            batchSize: 5,
            batchDelay: 1000
        };
        chrome.storage.sync.get(defaults, (items) => {
            cachedSettings = items;
            
            serviceSelect.value = items.translationService;
            updateApiKeyInput(items.translationService);

            systemPromptText.value = items.systemPrompt;
            userPromptText.value = items.userPrompt;
            batchSizeInput.value = items.batchSize;
            batchDelayInput.value = items.batchDelay;
            
            if(items.geminiModel) {
                const option = document.createElement('option');
                option.value = items.geminiModel;
                option.textContent = items.geminiModel;
                geminiModelSelect.appendChild(option);
                geminiModelSelect.value = items.geminiModel;
            }
            if(items.deepseekModel) {
                const option = document.createElement('option');
                option.value = items.deepseekModel;
                option.textContent = items.deepseekModel;
                deepseekModelSelect.appendChild(option);
                deepseekModelSelect.value = items.deepseekModel;
            }
            
            toggleLlmSettings();
        });
    }

    // --- Event Listeners ---
    serviceSelect.addEventListener('change', () => {
        updateApiKeyInput(serviceSelect.value);
        toggleLlmSettings();
    });
    saveButton.addEventListener('click', saveOptions);
    fetchGeminiModelsBtn.addEventListener('click', fetchGeminiModels);
    fetchDeepSeekModelsBtn.addEventListener('click', fetchDeepSeekModels);

    // --- Initial Call ---
    restoreOptions();
});