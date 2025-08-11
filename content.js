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
    queueTimeout: null,
    isTranslationActive: false,

    start() {
      if (this.isTranslationActive) {
        console.log("Translation is already active.");
        return;
      }
      this.isTranslationActive = true;
      console.log("Translation process STARTED. Setting up IntersectionObserver.");
      
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
      
      console.log(`[CONTENT.JS] Sending batch of ${textsToTranslate.length} visible texts to background.`);
      
      try {
        const translationMap = await chrome.runtime.sendMessage({
          action: 'translate_batch',
          texts: textsToTranslate
        });

        if (translationMap && this.isTranslationActive) { // Check active status again before rendering
          this.renderTranslations(translationMap, elementsToTranslate);
        }
      } catch (error) {
        console.error("Error communicating with background script:", error);
      }
    },
    
    renderTranslations(translationMap, elements) {
      elements.forEach(p => {
        const originalText = p.innerText;
        const translatedText = translationMap[originalText];
        if (translatedText) {
          p.dataset.translated = 'true';
          
          const host = document.createElement('div');
          const shadowRoot = host.attachShadow({ mode: 'open' });
          const styleElement = document.createElement('style');
          styleElement.textContent = `
            div {
              color: #007bff;
              font-size: 0.95em;
              margin-top: 5px;
              border-left: 3px solid #007bff;
              padding-left: 10px;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              line-height: 1.5;
            }
          `;
          const translationElement = document.createElement('div');
          translationElement.innerText = translatedText;
          
          shadowRoot.appendChild(styleElement);
          shadowRoot.appendChild(translationElement);
          
          p.parentNode.insertBefore(host, p.nextSibling);
        }
      });
    }
  };

  // Main message listener for content script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case "start_translation":
        window.translationManager.start();
        break;
      case "stop_translation":
        window.translationManager.stop();
        break;
    }
  });

})();