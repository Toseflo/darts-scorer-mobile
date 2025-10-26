// Navigation helper function
function navigateToGame() {
    let path = window.location.pathname;
    if (path.endsWith("index.html")) {
        path = path.substring(0, path.length - 10);
    }
    // If path ends with /, remove it
    if (path.endsWith("/")) {
        path = path.substring(0, path.length - 1);
    }
    window.location.href = path + "/game";
}

document.addEventListener('DOMContentLoaded', async () => {
    const playerList = document.getElementById('player-list');
    const addPlayerBtn = document.getElementById('add-player');
    const startGameBtn = document.getElementById('start-game');
    const settingsBtn = document.getElementById('settings-btn');

    let settingsModal = document.getElementById('settings-modal');
    let closeModalBtn = document.getElementById('close-modal-btn');

    // Define updateSetupSettings before it's used in event listeners
    const updateSetupSettings = () => {
        // Use centralized function to save settings from modal
        window.saveSettingsFromModal();
    };

    // Initialize settings modal elements
    const initSettingsModal = () => {
        settingsModal = document.getElementById('settings-modal');
        closeModalBtn = document.getElementById('close-modal-btn');

        if (settingsModal && closeModalBtn) {
            // Load saved settings using centralized function
            const savedSettings = window.loadSettings();

            if (savedSettings) {
                // Use global helper function to load settings into modal
                const gamePointsInput = document.getElementById('game-points');
                window.loadSettingsIntoModal(savedSettings, { gamePointsInput });
            } else {
                // Set default values only if no saved settings
                const doubleOutCheck = document.getElementById('double-out-check');
                if (doubleOutCheck && !doubleOutCheck.hasAttribute('data-initialized')) {
                    doubleOutCheck.checked = true;
                    doubleOutCheck.setAttribute('data-initialized', 'true');
                }
                // Update visibility with defaults
                window.updateSettingsVisibility('field', 'before');
            }

            // Get references to all settings elements for event listeners
            const doubleInCheck = document.getElementById('double-in-check');
            const doubleOutCheck = document.getElementById('double-out-check');
            const inputModeSelect = document.getElementById('input-mode-select');
            const multiplierOrderSelect = document.getElementById('multiplier-order-select');
            const autoSubmitCheck = document.getElementById('auto-submit-check');

            // Add event listeners to save settings when changed
            if (doubleInCheck) {
                doubleInCheck.addEventListener('change', updateSetupSettings);
            }
            if (doubleOutCheck) {
                doubleOutCheck.addEventListener('change', updateSetupSettings);
            }
            if (inputModeSelect) {
                inputModeSelect.addEventListener('change', () => {
                    updateSetupSettings();
                    // Update visibility when input mode changes
                    const multiplierOrder = multiplierOrderSelect ? multiplierOrderSelect.value : 'after';
                    window.updateSettingsVisibility(inputModeSelect.value, multiplierOrder);
                });
            }
            if (multiplierOrderSelect) {
                multiplierOrderSelect.addEventListener('change', () => {
                    updateSetupSettings();
                    // Update visibility when multiplier order changes
                    const inputMode = inputModeSelect ? inputModeSelect.value : 'field';
                    window.updateSettingsVisibility(inputMode, multiplierOrderSelect.value);
                });
            }
            if (autoSubmitCheck) {
                autoSubmitCheck.addEventListener('change', updateSetupSettings);
            }

            // Note: Close button and click-outside listeners are now in settings-modal-loader.js
        }
    };

    // Initialize modal (should be loaded synchronously by now)
    initSettingsModal();

    const createPlayerInput = (playerNumber) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'flex items-center space-x-2';
        const translations = window.translations || {};
        const playerPlaceholder = translations.player_placeholder || 'Player';
        const placeholderText = `${playerPlaceholder} ${playerNumber}`;
        playerDiv.innerHTML = `
            <input type="text" value="${placeholderText}" class="input-field" data-i18n-placeholder="player_placeholder" data-player-number="${playerNumber}" placeholder="${placeholderText}" autocomplete="off">
            <button class="remove-player-btn">
                <svg class="h-6 w-6" viewBox="0 0 24 24" stroke="currentColor" style="fill: none;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
            </button>
        `;
        playerList.appendChild(playerDiv);

        playerDiv.querySelector('.remove-player-btn').addEventListener('click', () => {
            if (playerList.children.length > 1) {
                playerDiv.remove();
            }
        });
    };

    const initPlayers = () => {
        createPlayerInput(1);
        createPlayerInput(2);
    };

    addPlayerBtn.addEventListener('click', () => {
        createPlayerInput(playerList.children.length + 1);
    });

    settingsBtn.addEventListener('click', () => {
        if (settingsModal) {
            settingsModal.classList.remove('hidden');

            // Update visibility when opening modal
            const inputModeSelect = document.getElementById('input-mode-select');
            const multiplierOrderSelect = document.getElementById('multiplier-order-select');
            const inputMode = inputModeSelect ? inputModeSelect.value : 'field';
            const multiplierOrder = multiplierOrderSelect ? multiplierOrderSelect.value : 'after';
            window.updateSettingsVisibility(inputMode, multiplierOrder);
        }
    });

    startGameBtn.addEventListener('click', () => {
        const players = Array.from(playerList.querySelectorAll('input'))
            .map(input => input.value.trim())
            .filter(name => name);

        if (players.length === 0) {
            const alertText = window.getTranslation
                ? window.getTranslation('alert_min_one_player')
                : 'Bitte fügen Sie mindestens einen Spieler hinzu.';
            alert(alertText);
            return;
        }

        // Get current language from existing settings or default
        const currentSettings = window.getSettingsOrDefaults();
        const currentLanguage = currentSettings.language;

        // Save user preferences using centralized function
        const defaultPoints = parseInt(document.getElementById('game-points').value, 10);
        window.saveSettingsFromModal({
            language: currentLanguage,
            defaultPoints: defaultPoints
        });

        // Save setup data for this specific game (temporary)
        const setupData = {
            points: parseInt(document.getElementById('game-points').value, 10),
            players: players
        };
        storage.setItem('setupData', JSON.stringify(setupData));

        navigateToGame();
    });

    initPlayers();
});

