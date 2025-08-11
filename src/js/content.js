// content.js (v8 - Complete, with IntersectionObserver and Toggle Logic)

// Use a self-invoking function to prevent multiple injections from running
(() => {
  if (window.translationManager) {
    console.log("Translation manager already exists.");
    return;
  }

  console.log("Initializing Translation Manager...");

  window.translationManager = {
    observer: null,
    translationQueue: new Set(),
    translationPlaceholders: new Map(), // 用于存储占位符和元素的映射关系
    queueTimeout: null,
    isTranslationActive: false,
    stylesInjected: false,

    start() {
      if (this.isTranslationActive) {
        console.log("Translation is already active.");
        return;
      }
      this.isTranslationActive = true;
      console.log("Translation process STARTED. Setting up IntersectionObserver.");
      this.injectSpinnerStyles();
      
      const elementsToObserve = document.querySelectorAll('p, li, blockquote, h1, h2, h3, h4, h5, h6');
      
      this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
        root: null, // relative to the viewport
        rootMargin: '300px 0px 300px 0px', // Pre-load content 300px above and below the viewport
        threshold: 0.01 // Trigger as soon as a single pixel is visible
      });
      
      elementsToObserve.forEach(el => this.observer.observe(el));
    },

    stop() {
      if (!this.isTranslationActive) {
        console.log("Translation is not active, nothing to stop.");
        return;
      }
      this.isTranslationActive = false;
      console.log("Translation process STOPPED. Disconnecting IntersectionObserver.");
      
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      
      clearTimeout(this.queueTimeout);
      this.translationQueue.clear();
    },

    handleIntersection(entries, observer) {
      if (!this.isTranslationActive) return;

      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          if (!element.dataset.translated && !element.dataset.translationRequested) {
            const text = element.innerText;
            if (text && text.trim().length > 3) {
              this.translationQueue.add(element);
              element.dataset.translationRequested = 'true';
            }
          }
          // Important: Unobserve the element after it has been seen once to prevent re-triggering.
          // It's now in the queue to be processed or has been ignored.
          observer.unobserve(element);
        }
      });

      if (this.translationQueue.size > 0) {
        this.debouncedProcessQueue();
      }
    },
    
    debouncedProcessQueue() {
      clearTimeout(this.queueTimeout);
      this.queueTimeout = setTimeout(() => {
        this.processQueue();
      }, 500); // Wait 500ms of "scroll inactivity" before sending request
    },
    
    async processQueue() {
      if (this.translationQueue.size === 0 || !this.isTranslationActive) return;
      
      const elementsToTranslate = Array.from(this.translationQueue);
      this.translationQueue.clear();
      
      const textsToTranslate = elementsToTranslate.map(el => el.innerText);
      
      // Step 1: Create placeholders on the page immediately.
      this.createPlaceholdersFor(elementsToTranslate);
      
      console.log(`[CONTENT.JS] Sending batch of ${textsToTranslate.length} visible texts to background.`);
      
      try {
        const translationMap = await chrome.runtime.sendMessage({
          action: 'translate_batch',
          texts: textsToTranslate
        });

        // Step 3: Update the placeholders with the results.
        if (translationMap && this.isTranslationActive) {
          for (const originalText in translationMap) {
            // Check for own property to be safe
            if (Object.prototype.hasOwnProperty.call(translationMap, originalText)) {
              const translatedText = translationMap[originalText];
              this.updateTranslation(originalText, translatedText);
            }
          }
        }
      } catch (error) {
        console.error("Error communicating with background script:", error, chrome.runtime.lastError);
        // Also update the UI to show the error
        textsToTranslate.forEach(text => this.updateTranslation(text, `[翻译通信错误: ${error.message}]`));
      }
    },
    
    createPlaceholdersFor(elements) {
      elements.forEach(p => {
        if (!this.isTranslationActive) return;
    
        const originalText = p.innerText;
        
        // Don't create a placeholder if one already exists for this text
        if (this.translationPlaceholders.has(originalText)) return;
    
        let placeholder = document.createElement('div');
        
        // Add a class for styling and identification
        placeholder.className = 'translation-placeholder-loading';
        
        // Create and append spinner
        const spinner = document.createElement('div');
        spinner.className = 'translation-spinner';
        placeholder.appendChild(spinner);

        // Apply styles directly for now
        placeholder.style.fontSize = '0.9em';
        placeholder.style.marginTop = '5px';
        placeholder.style.paddingLeft = '10px';
    
        p.parentNode.insertBefore(placeholder, p.nextSibling);
        
        // Mark the original element as having a translation attached
        p.dataset.translated = 'true';
    
        // Store the placeholder for future updates
        this.translationPlaceholders.set(originalText, placeholder);
      });
    },

    updateTranslation(originalText, translatedText) {
      const placeholder = this.translationPlaceholders.get(originalText);

      if (placeholder) {
        placeholder.innerHTML = ''; // Clear the spinner
        placeholder.innerText = translatedText;
        
        // Update styles for a successful or failed translation
        placeholder.classList.remove('translation-placeholder-loading');
        placeholder.classList.add('translation-placeholder-done');
        
        if (translatedText.startsWith('[翻译失败') || translatedText.startsWith('[翻译通信错误')) {
            placeholder.style.color = '#d9534f'; // Red for error
            placeholder.style.borderLeft = '3px solid #d9534f';
        } else {
            placeholder.style.color = '#007bff';
            placeholder.style.borderLeft = '3px solid #007bff';
        }

        placeholder.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
        placeholder.style.lineHeight = '1.5';
        placeholder.style.fontStyle = 'normal';
      } else {
            //console.warn(`No placeholder found for text: ${originalText}`);
            }
    },

    injectSpinnerStyles() {
      if (this.stylesInjected) return;
      const styleId = 'translation-spinner-styles';
      if (document.getElementById(styleId)) return;

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes translation-spinner-rotation {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .translation-spinner {
          display: inline-block;
          width: 1em; height: 1em;
          border: 2px solid rgba(0, 0, 0, 0.1);
          border-left-color: #007bff;
          border-radius: 50%;
          animation: translation-spinner-rotation 0.8s linear infinite;
          vertical-align: middle;
        }
      `;
      document.head.appendChild(style);
      this.stylesInjected = true;
    }
  };

  // Main message listener for content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case "start_translation":
        window.translationManager.start();
        // No response needed for fire-and-forget.
        break;
      case "stop_translation":
        window.translationManager.stop();
        // No response needed.
        break;
    }
  });

})();