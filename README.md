# Web Translator

_An AI-powered, immersive, and highly configurable web page translation extension for Chrome._

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-brightgreen.svg)
![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)
![Made-with-AI](https://img.shields.io/badge/Made%20with-AI-blueviolet.svg)

An immersive, bilingual web page translation extension that provides a side-by-side reading experience. This tool is designed to help users learn languages and read foreign content with ease by displaying translations directly beneath the original text.

This project is heavily inspired by the popular "Immersive Translate" extension and focuses on providing a robust, configurable, and cost-effective translation experience for web pages.

***

### A Note on Development: An AI Collaboration

A special aspect of this project is that it was developed in close collaboration with a large language model (Google's Gemini). A significant portion of the code, from the initial scaffolding and feature implementation to complex debugging and refactoring, was generated and guided through conversational AI. This repository serves as a practical example of human-AI partnership in software development.

***

## ✨ Key Features

-   **Immersive Translation:** Displays translations paragraph-by-paragraph, directly below the original text, for a seamless bilingual reading experience.
-   **Multiple Backends:** Supports three powerful translation service providers:
    -   **DeepL**
    -   **Google Gemini**
    -   **Deepseek**
-   **Translate-on-Scroll:** To save on API costs, the extension only translates content that is currently visible on your screen. As you scroll down, new text is automatically translated on demand.
-   **Highly Configurable:** A detailed options page allows you to:
    -   Switch between translation services.
    -   Securely store a separate API key for each service.
    -   Fetch and select specific models for LLM providers (Gemini, Deepseek).
    -   Customize the System and User Prompts for LLM-based translations.
    -   Adjust performance settings like batch size and request delay to respect API rate limits.
-   **Keyboard Shortcut:** Start or stop the translation on any page with a simple keyboard shortcut (`Alt+T`). The toggle is tab-specific, allowing you to manage translations independently on different pages.

## 🚀 Installation (from source)

As this is a local project, you need to load it as an unpacked extension in Chrome.

1.  **Download or Clone:** Download this repository as a ZIP file and unzip it, or clone it using Git.
2.  **Open Chrome Extensions:** Open your Chrome browser and navigate to `chrome://extensions`.
3.  **Enable Developer Mode:** Turn on the "Developer mode" switch, usually located in the top-right corner.
4.  **Load the Extension:** Click on the "Load unpacked" button that appears.
5.  **Select the Folder:** In the file dialog, select the project folder (the one that contains `manifest.json`).

The extension icon should now appear in your browser's toolbar.

## 🔧 Configuration & Usage

Before you can start translating, you must configure your preferred translation service.

1.  **Open the Options Page:**
    -   Click the popup icon in your toolbar, then click the gear icon in the top-right corner.
    -   Alternatively, right-click the extension icon and select "Options."

2.  **Configure Your Service:**
    -   Use the "Translation Service" dropdown to select either DeepL, Google Gemini, or Deepseek.
    -   Enter your personal API key for the selected service. The extension will automatically save and switch keys as you change services.
    -   If you selected Gemini or Deepseek, click the "Fetch/Refresh Models" button to validate your key and load available models into the dropdown. Select a model.
    -   (Optional) Adjust the LLM prompts or performance settings to your liking.
    -   Click **"Save Settings"**.

3.  **Start Translating:**
    -   Navigate to any webpage you wish to translate.
    -   Press the keyboard shortcut **`Alt+T`** to start the translation. Visible content will be translated.
    -   Press **`Alt+T`** again to stop the "translate-on-scroll" process. Already translated text will remain.

## 🌐 Supported Services & Browsers

-   **Translation Providers:**
    -   [DeepL API (Free & Pro)](https://www.deepl.com/pro-api)
    -   [Google AI for Developers (Gemini API)](https://ai.google.dev/)
    -   [Deepseek Platform](https://platform.deepseek.com/)

-   **Browsers:**
    -   ✅ **Google Chrome:** Fully supported.
    -   ⚠️ **Other Chromium Browsers (Edge, Brave, etc.):** Should work but are not officially tested.

## 📄 License

This project is licensed under the **Apache License 2.0**. See the `LICENSE` file for more details.