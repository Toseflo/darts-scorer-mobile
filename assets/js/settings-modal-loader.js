// Load and inject settings modal synchronously
(function loadSettingsModal() {
    // Determine base path based on current location
    const basePath = window.location.pathname.includes('/game/') ? '../assets' : 'assets';
    const modalPath = `${basePath}/components/settings-modal.html`;

    // Use synchronous XMLHttpRequest to ensure modal is loaded before scripts continue
    const xhr = new XMLHttpRequest();
    xhr.open('GET', modalPath, false); // false = synchronous

    try {
        xhr.send(null);

        if (xhr.status === 200) {
            // Create a temporary container to parse the HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = xhr.responseText;

            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    document.body.appendChild(tempDiv.firstElementChild);
                    console.log('Settings modal loaded successfully (after DOM ready)');
                    initializeModalListeners();
                }, { once: true });
            } else {
                // DOM already ready, append immediately
                document.body.appendChild(tempDiv.firstElementChild);
                console.log('Settings modal loaded successfully (immediate)');
                // Initialize after a short delay to ensure DOM is fully ready
                setTimeout(initializeModalListeners, 0);
            }
        } else {
            console.error('Failed to load settings modal, status:', xhr.status);
        }
    } catch (error) {
        console.error('Error loading settings modal:', error);
    }

    // Initialize common modal event listeners (close button and click outside)
    function initializeModalListeners() {
        const settingsModal = document.getElementById('settings-modal');
        const closeBtn = document.getElementById('close-modal-btn');

        if (settingsModal && closeBtn) {
            // Close button listener
            closeBtn.addEventListener('click', () => {
                settingsModal.classList.add('hidden');
            });

            // Click outside to close
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    settingsModal.classList.add('hidden');
                }
            });

            console.log('Settings modal event listeners initialized');
        }
    }
})();

// Global functions to toggle settings modal element visibility
// These functions are used by both main.js (setup) and game.js
window.toggleMultiplierOrderVisibility = function(inputMode, state) {
    const container = document.getElementById('multiplier-order-container');
    if (container) {
        // Get input mode from parameter or from state object (game.js compatibility)
        const mode = inputMode || (state && state.inputMode);
        if (mode === 'field') {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    }
};

window.toggleAutoSubmitVisibility = function(inputMode, multiplierOrder, state) {
    const container = document.getElementById('auto-submit-container');
    if (container) {
        // Get values from parameters or from state object (game.js compatibility)
        const mode = inputMode || (state && state.inputMode);
        const order = multiplierOrder || (state && state.multiplierOrder);

        // Only show auto-submit when in field mode AND 'before' multiplier order
        if (mode === 'field' && order === 'before') {
            container.style.display = 'flex';
        } else {
            container.style.display = 'none';
        }
    }
};

// Helper function to update all visibility settings
window.updateSettingsVisibility = function(inputMode, multiplierOrder, state) {
    window.toggleMultiplierOrderVisibility(inputMode, state);
    window.toggleAutoSubmitVisibility(inputMode, multiplierOrder, state);
};

// Helper function to load settings into modal fields
// Can be called from both setup (main.js) and game (game.js)
window.loadSettingsIntoModal = function(settings, options = {}) {
    const doubleInCheck = document.getElementById('double-in-check');
    const doubleOutCheck = document.getElementById('double-out-check');
    const inputModeSelect = document.getElementById('input-mode-select');
    const multiplierOrderSelect = document.getElementById('multiplier-order-select');
    const autoSubmitCheck = document.getElementById('auto-submit-check');
    const languageSelect = document.getElementById('language-select');

    if (settings) {
        if (doubleInCheck) doubleInCheck.checked = settings.doubleIn || false;
        if (doubleOutCheck) doubleOutCheck.checked = settings.doubleOut !== undefined ? settings.doubleOut : true;
        if (inputModeSelect) inputModeSelect.value = settings.inputMode || 'field';
        if (multiplierOrderSelect) multiplierOrderSelect.value = settings.multiplierOrder || 'after';
        if (autoSubmitCheck) autoSubmitCheck.checked = settings.autoSubmit || false;
        if (languageSelect && settings.language) languageSelect.value = settings.language;

        // Update visibility based on loaded settings
        window.updateSettingsVisibility(settings.inputMode, settings.multiplierOrder);
    }

    // Handle game-specific options if provided
    if (options.gamePointsInput && settings && settings.defaultPoints) {
        options.gamePointsInput.value = settings.defaultPoints;
    }
};

// Helper function to get current settings from modal fields
window.getSettingsFromModal = function() {
    const doubleInCheck = document.getElementById('double-in-check');
    const doubleOutCheck = document.getElementById('double-out-check');
    const inputModeSelect = document.getElementById('input-mode-select');
    const multiplierOrderSelect = document.getElementById('multiplier-order-select');
    const autoSubmitCheck = document.getElementById('auto-submit-check');

    return {
        doubleIn: doubleInCheck ? doubleInCheck.checked : false,
        doubleOut: doubleOutCheck ? doubleOutCheck.checked : true,
        inputMode: inputModeSelect ? inputModeSelect.value : 'field',
        multiplierOrder: multiplierOrderSelect ? multiplierOrderSelect.value : 'after',
        autoSubmit: autoSubmitCheck ? autoSubmitCheck.checked : false
    };
};

// ========== Centralized Settings Storage Functions ==========

// Load settings from localStorage (dartsScorer_settings)
window.loadSettings = function() {
    const settingsJson = storage.getItem('settings');
    if (!settingsJson) {
        return null;
    }
    try {
        return JSON.parse(settingsJson);
    } catch (e) {
        console.error('Error parsing settings:', e);
        return null;
    }
};

// Save settings to localStorage (dartsScorer_settings)
window.saveSettings = function(settings) {
    try {
        storage.setItem('settings', JSON.stringify(settings));
        return true;
    } catch (e) {
        console.error('Error saving settings:', e);
        return false;
    }
};

// Get default settings
window.getDefaultSettings = function() {
    const defaultLang = window.getInitialLanguage ? window.getInitialLanguage() : (navigator.language.split('-')[0] || 'en');
    return {
        doubleIn: false,
        doubleOut: true,
        inputMode: 'field',
        multiplierOrder: 'before',
        autoSubmit: false,
        language: defaultLang,
        defaultPoints: 501
    };
};

// Get settings with fallback to defaults
window.getSettingsOrDefaults = function() {
    return window.loadSettings() || window.getDefaultSettings();
};

// Update specific settings fields and save
window.updateSettings = function(updates) {
    const currentSettings = window.getSettingsOrDefaults();
    const newSettings = { ...currentSettings, ...updates };
    window.saveSettings(newSettings);
    return newSettings;
};

// Update settings from modal and save
window.saveSettingsFromModal = function(additionalSettings = {}) {
    const modalSettings = window.getSettingsFromModal();
    return window.updateSettings({ ...modalSettings, ...additionalSettings });
};

