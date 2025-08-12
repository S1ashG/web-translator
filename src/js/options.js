// options.js (v11 - Corrected Logic)

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
    // Local LLM
    const localLlmSettingsDiv = document.getElementById('local-llm-settings');
    const localLlmApiBaseInput = document.getElementById('localLlmApiBase');
    const localLlmModelSelect = document.getElementById('localLlmModel');
    const customLocalLlmModelInput = document.getElementById('customLocalLlmModel');
    const testLocalLlmConnectionBtn = document.getElementById('testLocalLlmConnectionBtn');
    const batchSizeInput = document.getElementById('batchSize');
    const batchDelayInput = document.getElementById('batchDelay');
    // Style Settings
    const stylePresetRadios = document.querySelectorAll('input[name="stylePreset"]');
    const customStyleOptionsDiv = document.getElementById('custom-style-options');
    const customFontSizeInput = document.getElementById('customFontSize');
    const customColorInput = document.getElementById('customColor');
    const matchStyleCheckbox = document.getElementById('matchStyleCheckbox');
    const styleDetailsFieldset = document.getElementById('style-details-fieldset');
    // Navigation elements
    const navItems = document.querySelectorAll('.options-nav .nav-item');
    const panels = document.querySelectorAll('.options-panels .panel');

    let cachedSettings = {};
    let localModelsFetched = false;

    const defaultSystemPrompt = `You are an expert translator. Your sole purpose is to accurately and fluently translate the user's text into professional, natural-sounding Chinese (Simplified).\n\nRules:\n- Do NOT add any extra explanations, comments, or annotations in your response.\n- Return ONLY the translated text.\n- Preserve the original formatting, including paragraphs and line breaks.\n- If the input text is a proper noun, a brand name, or a technical term that should not be translated, return it as is.\n- Handle complex sentences and idiomatic expressions with care, prioritizing meaning and readability over literal translation.`
    const defaultUserPrompt = `Please translate the following text into Chinese:\n\n{{text}}`;

    function showStatus(message, color) {
        statusDiv.textContent = message;
        statusDiv.style.color = 'white';
        statusDiv.style.backgroundColor = color === 'green' ? '#28a745' : (color === 'red' ? '#dc3545' : '#6c757d');
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

    function updateUiForService() {
        const selectedService = serviceSelect.value;
        const isLlmService = selectedService === 'gemini' || selectedService === 'deepseek';
        const isLocalLlm = selectedService === 'local';

        apiKeyInput.parentElement.classList.toggle('hidden', isLocalLlm);
        localLlmSettingsDiv.classList.toggle('hidden', !isLocalLlm);
        llmSettingsDiv.classList.toggle('hidden', !isLlmService && !isLocalLlm);
        geminiModelSelectorDiv.classList.toggle('hidden', selectedService !== 'gemini');
        deepseekModelSelectorDiv.classList.toggle('hidden', selectedService !== 'deepseek');

        if (isLocalLlm && !localModelsFetched) {
            fetchLocalLlmModels();
        }
    }

    function toggleCustomStyleVisibility() {
        const isCustom = document.querySelector('input[name="stylePreset"]:checked').value === 'custom';
        customStyleOptionsDiv.classList.toggle('hidden', !isCustom);
    }

    function toggleStyleDetailsFieldset() {
        styleDetailsFieldset.disabled = matchStyleCheckbox.checked;
        toggleCustomStyleVisibility();
    }

    function handleNavClick(event) {
        const targetId = event.currentTarget.dataset.target;
        navItems.forEach(item => item.classList.remove('active'));
        event.currentTarget.classList.add('active');
        panels.forEach(panel => panel.classList.toggle('active', panel.id === targetId));
    }

    function handleLocalModelChange() {
        const isCustom = localLlmModelSelect.value === 'custom';
        customLocalLlmModelInput.classList.toggle('hidden', !isCustom);
        localLlmModelSelect.style.width = isCustom ? 'auto' : '100%';
        testLocalLlmConnectionBtn.classList.toggle('hidden', !isCustom && localLlmModelSelect.options.length <= 1);
    }

    function saveOptions() {
        const currentService = serviceSelect.value;
        const currentApiKey = apiKeyInput.value.trim();

        if (!cachedSettings.apiKeys) {
            cachedSettings.apiKeys = {};
        }
        cachedSettings.apiKeys[currentService] = currentApiKey;

        const stylePreset = document.querySelector('input[name="stylePreset"]:checked').value;
        const customStyle = {
            fontSize: customFontSizeInput.value,
            color: customColorInput.value
        };

        let localModelName = localLlmModelSelect.value;
        if (localModelName === 'custom') {
            localModelName = customLocalLlmModelInput.value.trim();
        }

        const settingsToSave = {
            translationService: currentService,
            apiKeys: cachedSettings.apiKeys,
            geminiModel: geminiModelSelect.value,
            deepseekModel: deepseekModelSelect.value,
            localLlmApiBase: localLlmApiBaseInput.value.trim(),
            localLlmModelName: localModelName,
            systemPrompt: systemPromptText.value,
            userPrompt: userPromptText.value,
            batchSize: parseInt(batchSizeInput.value, 10) || 5,
            batchDelay: parseInt(batchDelayInput.value, 10) || 1000,
            stylePreset: stylePreset,
            customStyle: customStyle,
            matchOriginalStyle: matchStyleCheckbox.checked
        };

        chrome.storage.sync.set(settingsToSave, () => {
            showStatus('设置已保存！', 'green');
        });
    }

    async function testLocalLlmConnection() {
        const apiBase = localLlmApiBaseInput.value.trim();
        if (!apiBase) {
            showStatus('请输入本地服务的 API Base URL。', 'red');
            return;
        }
        showStatus('正在测试连接...', 'grey');
        try {
            // We reuse the fetch_local_llm_models action as a simple way to check if the endpoint is reachable.
            const response = await chrome.runtime.sendMessage({
                action: 'fetch_local_llm_models',
                apiBase: apiBase
            });
            if (response.success) {
                showStatus(`连接成功！发现 ${response.models.length} 个模型。`, 'green');
            } else {
                showStatus(`连接失败: ${response.error}`, 'red');
            }
        } catch (e) {
            showStatus(`通信错误: ${e.message}`, 'red');
        }
    }

    async function fetchLocalLlmModels() {
        localModelsFetched = true;
        const apiBase = localLlmApiBaseInput.value.trim();
        if (!apiBase) {
            // Don't show an error, just means it's not configured yet.
            return;
        }
        showStatus('正在获取本地模型列表...', 'grey');

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'fetch_local_llm_models',
                apiBase: apiBase
            });

            const savedModelName = cachedSettings.localLlmModelName;
            localLlmModelSelect.innerHTML = ''; // Clear previous options

            if (response.success && response.models) {
                response.models.forEach(modelName => {
                    const option = document.createElement('option');
                    option.value = modelName;
                    option.textContent = modelName;
                    localLlmModelSelect.appendChild(option);
                });
                showStatus('本地模型列表获取成功！', 'green');
            } else {
                showStatus(`获取模型失败: ${response.error || '未知错误'}`, 'red');
            }

            // Add the custom option regardless of fetch success
            const customOption = document.createElement('option');
            customOption.value = 'custom';
            customOption.textContent = '自定义';
            localLlmModelSelect.appendChild(customOption);

            // Restore selection
            const foundSavedModel = [...localLlmModelSelect.options].some(opt => opt.value === savedModelName);

            if (foundSavedModel) {
                localLlmModelSelect.value = savedModelName;
            } else if (savedModelName) {
                localLlmModelSelect.value = 'custom';
                customLocalLlmModelInput.value = savedModelName;
            }

            handleLocalModelChange();

        } catch (e) {
            showStatus(`通信错误: ${e.message}`, 'red');
            // Still add custom option on error
            const customOption = document.createElement('option');
            customOption.value = 'custom';
            customOption.textContent = '自定义';
            localLlmModelSelect.appendChild(customOption);
            handleLocalModelChange();
        }
    }

    async function fetchGeminiModels() {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            showStatus('请输入 Gemini API Key 以获取模型。', 'red');
            return;
        }
        showStatus('正在获取 Gemini 模型列表...', 'grey');
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
        showStatus('正在获取 DeepSeek 模型列表...', 'grey');
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
            localLlmApiBase: 'http://localhost:11434',
            localLlmModelName: 'llama3',
            systemPrompt: defaultSystemPrompt,
            userPrompt: defaultUserPrompt,
            batchSize: 5,
            batchDelay: 1000,
            stylePreset: 'default',
            matchOriginalStyle: false,
            customStyle: { fontSize: 0.95, color: '#007bff' }
        };
        chrome.storage.sync.get(defaults, (items) => {
            cachedSettings = items;
            
            serviceSelect.value = items.translationService;
            updateApiKeyInput(items.translationService);

            localLlmApiBaseInput.value = items.localLlmApiBase;
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
            
            // For local LLM, the list will be populated by updateUiForService
            // which is called at the end of this function.

            document.querySelector(`input[name="stylePreset"][value="${items.stylePreset}"]`).checked = true;
            customFontSizeInput.value = items.customStyle.fontSize;
            customColorInput.value = items.customStyle.color;
            matchStyleCheckbox.checked = items.matchOriginalStyle;

            updateUiForService();
            toggleStyleDetailsFieldset();
        });
    }

    // --- Event Listeners ---
    serviceSelect.addEventListener('change', () => {
        updateApiKeyInput(serviceSelect.value);
        updateUiForService();
    });
    saveButton.addEventListener('click', saveOptions);
    testLocalLlmConnectionBtn.addEventListener('click', testLocalLlmConnection);
    fetchGeminiModelsBtn.addEventListener('click', fetchGeminiModels);
    fetchDeepSeekModelsBtn.addEventListener('click', fetchDeepSeekModels);
    localLlmModelSelect.addEventListener('change', handleLocalModelChange);
    localLlmApiBaseInput.addEventListener('change', () => { 
        localModelsFetched = false; // Re-fetch if base URL changes
        if (serviceSelect.value === 'local') {
            fetchLocalLlmModels();
        }
    });
    stylePresetRadios.forEach(radio => {
        radio.addEventListener('change', toggleCustomStyleVisibility);
    });
    matchStyleCheckbox.addEventListener('change', toggleStyleDetailsFieldset);
    navItems.forEach(item => {
        item.addEventListener('click', handleNavClick);
    });

    // --- Initial Call ---
    restoreOptions();
});