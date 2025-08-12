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
    accumulationQueue: new Set(), // Holds elements waiting to be batched.
    translationPlaceholders: new Map(), // 用于存储占位符和元素的映射关系
    queueTimeout: null,
    isTranslationActive: false,
    stylesInjected: false,
    styleSettings: null, // To store loaded style settings
    contentBatchSize: 30, // Default value, will be overwritten by settings.
    FLUSH_DELAY: 1500, // Delay to flush remaining items after scrolling stops.

    async start() {
      if (this.isTranslationActive) {
        console.log("Translation is already active.");
        return;
      }
      this.isTranslationActive = true;
      console.log("Translation process STARTED. Setting up IntersectionObserver.");
      await this.loadSettings(); // Load settings before starting
      
      const elementsToObserve = document.querySelectorAll('p, li, blockquote, h1, h2, h3, h4, h5, h6');
      
      this.observer = new IntersectionObserver(this.handleIntersection.bind(this), {
        root: null, // relative to the viewport
        rootMargin: '300px 0px 300px 0px', // Pre-load content 300px above and below the viewport
        threshold: 0.01 // Trigger as soon as a single pixel is visible
      });
      
      elementsToObserve.forEach(el => this.observer.observe(el));
      
      this.injectSpinnerStyles(); // Inject styles after settings are loaded
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
      this.accumulationQueue.clear();
    },

    handleIntersection(entries, observer) {
      if (!this.isTranslationActive) return;

      let newItemsAdded = false;
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          if (!element.dataset.translated && !element.dataset.translationRequested) {
            const text = element.innerText;
            if (text && text.trim().length > 3) {
              this.accumulationQueue.add(element);
              element.dataset.translationRequested = 'true';
              newItemsAdded = true;
            }
          }
          // Important: Unobserve the element after it has been seen once to prevent re-triggering.
          // It's now in the queue to be processed or has been ignored.
          observer.unobserve(element);
        }
      });

      // If we added new items, we might need to process a batch or set a timeout for the remainder.
      if (newItemsAdded) {
        this.triggerBatchProcessing();
      }
    },
    
    // New function to manage batching logic
    triggerBatchProcessing() {
      // As long as we have enough items for a full batch, process them immediately.
      while (this.accumulationQueue.size >= this.contentBatchSize) {
        // Take the first contentBatchSize items from the Set.
        const elementsToTranslate = Array.from(this.accumulationQueue).slice(0, this.contentBatchSize);
        
        // Remove these elements from the main queue.
        elementsToTranslate.forEach(el => this.accumulationQueue.delete(el));
        
        console.log(`Processing a full batch of ${this.contentBatchSize} items.`);
        // Process this batch immediately, without debounce.
        this.processQueue(elementsToTranslate);
      }
      
      // If there are any leftover items, set a timer to flush them later.
      // This handles the "end of scroll" or "small page" cases.
      if (this.accumulationQueue.size > 0) {
        this.debouncedProcessQueue();
      }
    },

    debouncedProcessQueue() {
      clearTimeout(this.queueTimeout);
      this.queueTimeout = setTimeout(() => {
        // When the timer fires, process ALL remaining items in the queue.
        const remainingElements = Array.from(this.accumulationQueue);
        this.accumulationQueue.clear();
        
        if (remainingElements.length > 0) {
          console.log(`Flushing remaining ${remainingElements.length} items from queue.`);
          this.processQueue(remainingElements);
        }
      }, this.FLUSH_DELAY); // Wait for scrolling to stop before sending the last partial request.
    },
    
    async processQueue(elementsToTranslate) {
      if (elementsToTranslate.length === 0 || !this.isTranslationActive) return;
      
      const textsToTranslate = elementsToTranslate.map(el => el.innerText);
      
      // Step 1: Create placeholders on the page immediately.
      // This is now correctly timed: only for elements being translated.
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
        // We store the original element as well, to be able to copy its style later.
        this.translationPlaceholders.set(originalText, { placeholder, originalElement: p });
      });
    },

    updateTranslation(originalText, translatedText) {
      const entry = this.translationPlaceholders.get(originalText);

      if (entry) {
        const { placeholder, originalElement } = entry;
        placeholder.innerHTML = ''; // Clear the spinner
        placeholder.innerText = translatedText;
        
        // Update styles for a successful or failed translation
        placeholder.classList.remove('translation-placeholder-loading');
        placeholder.classList.add('translation-placeholder-done');
        
        // Common structural styles
        placeholder.style.marginTop = '5px';
        placeholder.style.paddingLeft = '10px';

        if (translatedText.startsWith('[翻译失败') || translatedText.startsWith('[翻译通信错误')) {
            // Error styling is independent and consistent
            placeholder.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
            placeholder.style.lineHeight = '1.5';
            placeholder.style.fontStyle = 'normal';
            placeholder.style.color = '#d9534f'; // Red for error
            placeholder.style.borderLeft = '3px solid #d9534f';
            placeholder.style.fontSize = '0.9em';
        } else if (this.styleSettings.match) {
            // NEW: Match original style
            const computedStyle = window.getComputedStyle(originalElement);
            const propsToCopy = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'color', 'lineHeight', 'textAlign', 'textTransform', 'letterSpacing'];
            propsToCopy.forEach(prop => {
                placeholder.style[prop] = computedStyle[prop];
            });
            placeholder.style.borderLeft = `3px solid ${computedStyle.color}`;
        } else {
            // Apply the entire style object loaded from settings.
            Object.assign(placeholder.style, this.styleSettings);
        }
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
    },

    async loadSettings() {
        const presets = {
            default: {
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                lineHeight: '1.5',
                fontStyle: 'normal',
                color: '#007bff',
                fontSize: '0.95em',
                borderLeft: '3px solid #007bff',
            },
            subtle: {
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                lineHeight: '1.5',
                fontStyle: 'normal',
                color: '#555',
                fontSize: '0.9em',
                borderLeft: '3px solid #ccc',
            },
            highlighted: {
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                lineHeight: '1.5',
                fontStyle: 'normal',
                color: 'black',
                fontSize: '0.95em',
                borderLeft: '3px solid #ffc107',
                backgroundColor: '#fffbe6',
                // Override paddingLeft from the common structural styles
                // Note: padding is set in updateTranslation, so this is an example
                padding: '5px 10px',
            }
        };

        const items = await chrome.storage.sync.get({
            stylePreset: 'default',
            customStyle: { fontSize: 0.95, color: '#007bff' },
            matchOriginalStyle: false,
            batchSize: 30 // Default batch size if not set in storage
        });

        // 1. Set the batch size for content script
        this.contentBatchSize = items.batchSize > 0 ? items.batchSize : 30;
        console.log(`[CONTENT.JS] Batch size set to: ${this.contentBatchSize}`);

        // 2. Set style settings
        if (items.matchOriginalStyle) {
            this.styleSettings = { match: true };
            return;
        }

        if (items.stylePreset === 'custom') {
            this.styleSettings = {
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                lineHeight: '1.5',
                fontStyle: 'normal',
                color: items.customStyle.color,
                fontSize: `${items.customStyle.fontSize}em`,
                borderLeft: `3px solid ${items.customStyle.color}`
            };
        } else {
            this.styleSettings = presets[items.stylePreset] || presets.default;
        }
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