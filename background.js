// background.js (v13.1 - Re-verified Complete Code)

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = "RateLimitError";
  }
}

// State Management
let activeTranslationTabs = {};

// Core Logic Triggers
async function toggleTranslationForTab(tab) {
  if (!tab || !tab.id) {
    console.error("Invalid tab provided to toggleTranslation.");
    return;
  }
  if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('https://chrome.google.com'))) {
    console.log('Cannot run script on special page:', tab.url);
    return;
  }
  
  const tabId = tab.id;
  const isCurrentlyTranslating = activeTranslationTabs[tabId] || false;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });

    if (isCurrentlyTranslating) {
      console.log(`Sending STOP command to tab ${tabId}`);
      await chrome.tabs.sendMessage(tabId, { action: "stop_translation" });
      activeTranslationTabs[tabId] = false;
    } else {
      console.log(`Sending START command to tab ${tabId}`);
      activeTranslationTabs[tabId] = true;
      await chrome.tabs.sendMessage(tabId, { action: "start_translation" });
    }
  } catch (error) {
    console.error("Error in toggleTranslationForTab:", error);
    // This can happen if the content script is not ready, e.g., on a freshly opened tab.
    // A small delay and retry could be a strategy, but for now, we just log it.
  }
}

// Listeners
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "trigger_translation") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      toggleTranslationForTab(tab);
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'translate_batch':
      handleTranslationBatch(request.texts, sender.tab.id)
        .then(sendResponse)
        .catch(error => {
          console.error("Fatal error in handleTranslationBatch promise chain:", error);
          sendResponse({}); 
        });
      return true;

    case 'fetch_gemini_models':
      fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${request.key}`)
        .then(response => { if (!response.ok) throw new Error(`Invalid API Key or network error (${response.status})`); return response.json(); })
        .then(data => {
          const models = data.models.filter(m => m.supportedGenerationMethods.includes("generateContent")).map(m => m.name.replace('models/', ''));
          sendResponse({ success: true, models });
        }).catch(error => { console.error("Failed to fetch Gemini models:", error); sendResponse({ success: false, error: error.message }); });
      return true;

    case 'fetch_deepseek_models':
      fetch('https://api.deepseek.com/models', { headers: { 'Authorization': `Bearer ${request.key}` }})
        .then(response => { if (!response.ok) throw new Error(`Invalid API Key or network error (${response.status})`); return response.json(); })
        .then(data => {
          const models = data.data ? data.data.map(m => m.id) : [];
          sendResponse({ success: true, models: models.filter(m => m.includes('chat')) });
        }).catch(error => { console.error("Failed to fetch DeepSeek models:", error); sendResponse({ success: false, error: error.message }); });
      return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete activeTranslationTabs[tabId];
  console.log(`Cleaned up state for closed tab ${tabId}`);
});


// Batch Handler and API Callers
async function handleTranslationBatch(texts, tabId) {
  console.log(`[BACKGROUND.JS] Received batch request with ${texts.length} items for tab ${tabId}.`);
  const settings = await chrome.storage.sync.get({
    translationService: 'deepl',
    apiKeys: { deepl: '', gemini: '', deepseek: '' },
    geminiModel: '',
    deepseekModel: '',
    systemPrompt: '',
    userPrompt: '',
    batchSize: 5,
    batchDelay: 1000,
  });

  console.log('[BACKGROUND.JS] Using settings:', settings);
  
  const currentApiKey = settings.apiKeys[settings.translationService];
  if (!currentApiKey) {
    throw new Error(`API Key for service "${settings.translationService}" is not set.`);
  }

  const batchSize = settings.batchSize;
  const delay = settings.batchDelay;
  const translationMap = {};

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const promises = batch.map(async (text) => {
      try {
        let translatedText;
        const llmSettings = { ...settings, apiKey: currentApiKey };
        if (settings.translationService === 'deepl') {
          translatedText = await translateWithDeepL(text, currentApiKey);
        } else if (settings.translationService === 'gemini') {
          translatedText = await translateWithGemini(text, llmSettings);
        } else if (settings.translationService === 'deepseek') {
          translatedText = await translateWithDeepSeek(text, llmSettings);
        }
        if (typeof translatedText === 'string') {
          translationMap[text] = translatedText;
        }
      } catch (error) {
        console.error(`[BACKGROUND.JS] CATCH ERROR on "${text.substring(0, 30)}..."`, error);
        translationMap[text] = `[翻译失败: ${error.message}]`;
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('429') || errorMessage.includes('quota')) {
          console.error("Rate limit or quota error detected. Stopping all further batches.");
          throw new RateLimitError(error.message);
        }
      }
    });

    try {
      await Promise.all(promises);
    } catch (error) {
      if (error instanceof RateLimitError) {
        console.log("Stopping loop due to RateLimitError.");
        break; 
      }
    }

    if (i + batchSize < texts.length) {
      await sleep(delay);
    }
  }
  
  console.log(`[BACKGROUND.JS] Batch processing complete. Returning map with ${Object.keys(translationMap).length} entries.`);
  return translationMap;
}

async function translateWithDeepL(text, apiKey) {
  const apiUrl = 'https://api-free.deepl.com/v2/translate';
  const params = new URLSearchParams({ auth_key: apiKey, text: text, target_lang: 'ZH' });
  const response = await fetch(apiUrl, { method: 'POST', body: params });
  if (!response.ok) throw new Error(`DeepL API Error: ${response.status}`);
  const data = await response.json();
  return data.translations && data.translations.length > 0 ? data.translations[0].text : undefined;
}

async function translateWithGemini(text, settings) {
  const { apiKey, geminiModel, systemPrompt, userPrompt } = settings;
  if (!geminiModel) throw new Error("Gemini model not selected.");
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;
  const requestBody = {
    contents: [{ role: "user", parts: [{ text: userPrompt.replace('{{text}}', text) }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ]
  };
  const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Gemini API Error: ${errorData.error?.message || response.status}`);
  }
  const data = await response.json();
  if (!data.candidates || data.candidates.length === 0) { return "[模型因安全原因未返回结果]"; }
  return data.candidates[0].content.parts[0].text;
}

async function translateWithDeepSeek(text, settings) {
    const { apiKey, systemPrompt, userPrompt, deepseekModel } = settings;
    if (!deepseekModel) throw new Error("DeepSeek model not selected in options.");
    const apiUrl = 'https://api.deepseek.com/chat/completions';
    const requestBody = {
        model: deepseekModel,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt.replace('{{text}}', text) }
        ]
    };
    const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` }, body: JSON.stringify(requestBody) });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`DeepSeek API Error: ${errorData.error?.message || response.status}`);
    }
    const data = await response.json();
    if (!data.choices || data.choices.length === 0) { return "[模型未返回有效翻译]"; }
    return data.choices[0].message.content;
}