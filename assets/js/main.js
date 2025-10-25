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

    // Initialize settings modal elements
    const initSettingsModal = () => {
        settingsModal = document.getElementById('settings-modal');
        closeModalBtn = document.getElementById('close-modal-btn');

        if (settingsModal && closeModalBtn) {
            // Load saved settings if they exist
            const savedSettings = JSON.parse(storage.getItem('settings'));

            const doubleInCheck = document.getElementById('double-in-check');
            const doubleOutCheck = document.getElementById('double-out-check');
            const inputModeSelect = document.getElementById('input-mode-select');

            if (savedSettings) {
                // Apply saved settings
                if (doubleInCheck) doubleInCheck.checked = savedSettings.doubleIn || false;
                if (doubleOutCheck) doubleOutCheck.checked = savedSettings.doubleOut !== undefined ? savedSettings.doubleOut : true;
                if (inputModeSelect) inputModeSelect.value = savedSettings.inputMode || 'field';

                // Set default points if available
                const gamePointsInput = document.getElementById('game-points');
                if (gamePointsInput && savedSettings.defaultPoints) {
                    gamePointsInput.value = savedSettings.defaultPoints;
                }
            } else {
                // Set default values only if no saved settings
                if (doubleOutCheck && !doubleOutCheck.hasAttribute('data-initialized')) {
                    doubleOutCheck.checked = true;
                    doubleOutCheck.setAttribute('data-initialized', 'true');
                }
            }

            // Add event listeners to save settings when changed
            if (doubleInCheck) {
                doubleInCheck.addEventListener('change', () => {
                    updateSetupSettings();
                });
            }
            if (doubleOutCheck) {
                doubleOutCheck.addEventListener('change', () => {
                    updateSetupSettings();
                });
            }
            if (inputModeSelect) {
                inputModeSelect.addEventListener('change', () => {
                    updateSetupSettings();
                });
            }

            closeModalBtn.addEventListener('click', () => {
                settingsModal.classList.add('hidden');
            });

            window.addEventListener('click', (event) => {
                if (event.target === settingsModal) {
                    settingsModal.classList.add('hidden');
                }
            });
        }
    };

    // Initialize modal (should be loaded synchronously by now)
    initSettingsModal();

    const updateSetupSettings = () => {
        const doubleInCheck = document.getElementById('double-in-check');
        const doubleOutCheck = document.getElementById('double-out-check');
        const inputModeSelect = document.getElementById('input-mode-select');

        let currentSettings = JSON.parse(storage.getItem('settings'));
        if (!currentSettings) {
            // Create default settings if none exist - use browser language or fallback to 'en'
            const defaultLang = window.getInitialLanguage ? window.getInitialLanguage() : (navigator.language.split('-')[0] || 'en');
            currentSettings = {
                doubleIn: false,
                doubleOut: true,
                inputMode: 'field',
                language: defaultLang,
                defaultPoints: 501
            };
        }

        // Update settings with current values
        if (doubleInCheck) currentSettings.doubleIn = doubleInCheck.checked;
        if (doubleOutCheck) currentSettings.doubleOut = doubleOutCheck.checked;
        if (inputModeSelect) currentSettings.inputMode = inputModeSelect.value;

        storage.setItem('settings', JSON.stringify(currentSettings));
    };

    const createPlayerInput = (playerNumber) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'flex items-center space-x-2';
        const placeholderText = `Spieler ${playerNumber}`;
        playerDiv.innerHTML = `
            <input type="text" value="${placeholderText}" class="input-field" data-i18n-placeholder="player_placeholder" placeholder="${placeholderText}">
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

        const doubleInCheck = document.getElementById('double-in-check');
        const doubleOutCheck = document.getElementById('double-out-check');
        const inputModeSelect = document.getElementById('input-mode-select');

        // Get current language from existing settings or default
        const currentSettings = JSON.parse(storage.getItem('settings'));
        const currentLanguage = currentSettings && currentSettings.language ? currentSettings.language : 'de';

        // Save user preferences (persistent settings)
        const userSettings = {
            doubleIn: doubleInCheck ? doubleInCheck.checked : false,
            doubleOut: doubleOutCheck ? doubleOutCheck.checked : true,
            inputMode: inputModeSelect ? inputModeSelect.value : 'field',
            language: currentLanguage,
            defaultPoints: parseInt(document.getElementById('game-points').value, 10)
        };
        storage.setItem('settings', JSON.stringify(userSettings));

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

