// Navigation helper function
function navigateToSetup() {
    let path = window.location.pathname;
    if (path.endsWith("index.html")) {
        path = path.substring(0, path.length - 10);
    }
    if (path.endsWith("/")) {
        path = path.substring(0, path.length - 1);
    }
    // Remove /game from the path
    if (path.endsWith("/game")) {
        path = path.substring(0, path.length - 5);
    }
    // If path is empty, use root
    if (!path || path === '') {
        path = '/';
    }
    window.location.href = path;
}

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const get = (id) => document.getElementById(id);
    const scoreboard = get('scoreboard');
    const statsDisplay = get('stats-display');
    const dartEntries = get('dart-entries');
    const turnTotalEl = get('turn-total');
    const keypad = document.querySelector('.keypad');
    const allPlayersModal = get('all-players-modal');
    const allPlayersList = get('all-players-list');
    const closeModalBtn = get('close-all-players-modal-btn');
    const gameOverModal = get('game-over-modal');
    const winnerNameEl = get('winner-name');
    const nextLegBtn = get('next-leg-btn');
    const newGameModalBtn = get('new-game-modal-btn');
    const resetGameBtn = get('reset-game-btn');
    const nextPlayerDisplaySettings = get('next-player-display-settings');
    const nextPlayerModeSelect = get('next-player-mode-select');
    const settingsGameBtn = get('settings-game-btn');

    // Settings modal elements - will be initialized after modal is loaded
    let settingsModal, closeSettingsBtn, doubleInCheck, doubleOutCheck, languageSelect, inputModeSelect, multiplierOrderSelect, autoSubmitCheck;

    // --- Game State ---
    let state = {};
    let previousState = null; // For undo functionality across players
    let CHECKOUTS = {}; // Checkout data loaded from JSON
    let scoreInputBuffer = ''; // Buffer for score input mode
    let previousScoreInputBuffer = ''; // Buffer for undo in score input mode

    // --- Initial Load ---
    const initializeGame = async () => {
        // Wait for translations to be loaded
        let attempts = 0;
        while (!window.getTranslation && attempts < 50) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }

        // Load checkouts data
        try {
            const response = await fetch('../assets/data/checkouts.json');
            if (response.ok) {
                CHECKOUTS = await response.json();
            }
        } catch (error) {
            console.error("Could not load checkout data:", error);
        }

        // Initialize the game
        await init();
    };

    initializeGame().catch(error => {
        console.error('Failed to initialize game:', error);
    });


    async function init() {
        // Load settings (user preferences)
        let settings = JSON.parse(storage.getItem('settings'));
        if (!settings) {
            // Create default settings - use browser language or fallback to 'en'
            const defaultLang = window.getInitialLanguage ? window.getInitialLanguage() : (navigator.language.split('-')[0] || 'en');
            settings = {
                points: 501,
                doubleIn: false,
                doubleOut: true,
                inputMode: 'field',
                multiplierOrder: 'after',
                autoSubmit: false,
                language: defaultLang,
                defaultPoints: 501
            };
            storage.setItem('settings', JSON.stringify(settings));
        }

        // Load setup data (players for this game)
        const setupData = JSON.parse(storage.getItem('setupData'));
        if (!setupData || !setupData.players || setupData.players.length === 0) {
            // No setup data - go to setup page
            navigateToSetup();
            return;
        }

        const savedState = JSON.parse(storage.getItem('gameState'));

        if (savedState) {
            // Only show resume dialog if there's actual game progress
            // (at least one player has thrown darts)
            const hasGameProgress = savedState.players && savedState.players.some(p =>
                p.history && p.history.length > 0
            );

            if (hasGameProgress) {
                const confirmText = window.getTranslation
                    ? window.getTranslation('confirm_resume_game')
                    : 'Möchten Sie das letzte Spiel fortsetzen?';

                let result;

                // Use customConfirm if available, otherwise fallback to native confirm
                if (typeof window.customConfirm === 'function') {
                    try {
                        result = await window.customConfirm(confirmText);
                    } catch (error) {
                        console.error('Custom confirm error:', error);
                        result = confirm(confirmText);
                    }
                } else {
                    result = confirm(confirmText);
                }

                if (result) {
                    state = savedState;
                    state.showError = false;
                    state.showInvalidInputError = state.showInvalidInputError || false;
                    // Ensure multiplierOrder exists (for backward compatibility)
                    if (!state.multiplierOrder) {
                        state.multiplierOrder = settings.multiplierOrder || 'after';
                    }
                    // Ensure autoSubmit exists (for backward compatibility)
                    if (state.autoSubmit === undefined) {
                        state.autoSubmit = settings.autoSubmit || false;
                    }
                    // Always start with no pending multiplier
                    state.pendingMultiplier = null;
                } else {
                    // User clicked No - delete saved game
                    storage.removeItem('gameState');
                    initNewGame(settings, setupData);
                }
            } else {
                // No actual game progress, just start new game and clean up old state
                storage.removeItem('gameState');
                initNewGame(settings, setupData);
            }
        } else {
            initNewGame(settings, setupData);
        }


        addEventListeners();
        renderKeypad();
        render();
    }

    function initNewGame(settings, setupData) {
        state = {
            gameType: parseInt(setupData.points, 10),
            doubleIn: settings.doubleIn,
            doubleOut: settings.doubleOut,
            nextPlayerMode: 'next',
            inputMode: settings.inputMode,
            multiplierOrder: settings.multiplierOrder || 'after',
            autoSubmit: settings.autoSubmit || false,
            pendingMultiplier: null, // For 'before' mode - stores the multiplier to apply
            players: setupData.players.map(name => createPlayer(name, parseInt(setupData.points, 10))),
            currentPlayerIndex: 0,
            legStarterIndex: 0,
            currentTurn: [],
            showError: false,
            showInvalidInputError: false,
        };
    }

    function createPlayer(name, score) {
        return {
            name: name,
            score: score,
            legs: 0,
            dartsThrown: 0,
            history: [],
            hasDoubledIn: false,
        };
    }

    function addEventListeners() {
        keypad.addEventListener('click', handleKeypadClick);
        scoreboard.addEventListener('click', showAllPlayersModal);

        // Add keyboard support for score input mode
        document.addEventListener('keydown', handleKeyboardInput);

        closeModalBtn.addEventListener('click', () => allPlayersModal.classList.add('hidden'));
        allPlayersModal.addEventListener('click', (e) => {
            if (e.target === allPlayersModal) {
                allPlayersModal.classList.add('hidden');
            }
        });
        resetGameBtn.addEventListener('click', () => {
            const confirmText = window.getTranslation
                ? window.getTranslation('confirm_reset_game')
                : 'Möchten Sie das Spiel wirklich zurücksetzen und zum Setup zurückkehren?';

            if (window.customConfirm) {
                window.customConfirm(confirmText).then(result => {
                    if (result) {
                        resetGame();
                    }
                }).catch(error => {
                    console.error('Confirm error:', error);
                });
            } else {
                // Fallback to native confirm
                if (confirm(confirmText)) {
                    resetGame();
                }
            }
        });
        nextLegBtn.addEventListener('click', startNextLeg);
        newGameModalBtn.addEventListener('click', resetGame);
        nextPlayerModeSelect.addEventListener('change', (e) => {
            state.nextPlayerMode = e.target.value;
            updateSettings();
            render();
        });

        settingsGameBtn.addEventListener('click', showSettingsModal);
    }

    function initSettingsModalListeners() {
        settingsModal = get('settings-modal');
        closeSettingsBtn = get('close-modal-btn');
        doubleInCheck = get('double-in-check');
        doubleOutCheck = get('double-out-check');
        languageSelect = get('language-select');
        inputModeSelect = get('input-mode-select');
        multiplierOrderSelect = get('multiplier-order-select');
        autoSubmitCheck = get('auto-submit-check');

        if (!settingsModal || !closeSettingsBtn || !doubleInCheck || !doubleOutCheck || !inputModeSelect) {
            console.error('Settings modal elements not found');
            return;
        }

        // Set current language value in the select
        if (languageSelect) {
            const settings = JSON.parse(storage.getItem('settings'));
            if (settings && settings.language) {
                languageSelect.value = settings.language;
            }
        }

        // Settings modal event listeners
        closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.add('hidden');
            }
        });
        doubleInCheck.addEventListener('change', (e) => {
            state.doubleIn = e.target.checked;
            // Update settings in localStorage
            updateSettings();
            render();
        });
        doubleOutCheck.addEventListener('change', (e) => {
            state.doubleOut = e.target.checked;
            // Update settings in localStorage
            updateSettings();
            render();
        });
        inputModeSelect.addEventListener('change', (e) => {
            state.inputMode = e.target.value;
            scoreInputBuffer = ''; // Clear buffer when switching modes
            state.currentTurn = []; // Clear current turn when switching modes
            state.pendingMultiplier = null; // Clear pending multiplier
            // Update settings in localStorage
            updateSettings();
            // Show/hide multiplier order selector
            toggleMultiplierOrderVisibility();
            // Show/hide auto-submit based on mode
            toggleAutoSubmitVisibility();
            renderKeypad();
            render();
        });

        if (multiplierOrderSelect) {
            multiplierOrderSelect.addEventListener('change', (e) => {
                state.multiplierOrder = e.target.value;
                state.pendingMultiplier = null; // Clear pending multiplier when changing mode
                state.currentTurn = []; // Clear current turn when switching modes
                // Update settings in localStorage
                updateSettings();
                // Show/hide auto-submit based on multiplier order
                toggleAutoSubmitVisibility();
                renderKeypad();
                render();
            });
        }

        if (autoSubmitCheck) {
            autoSubmitCheck.addEventListener('change', (e) => {
                state.autoSubmit = e.target.checked;
                // Update settings in localStorage
                updateSettings();
            });
        }
    }

    function toggleMultiplierOrderVisibility() {
        const container = get('multiplier-order-container');
        if (container) {
            if (state.inputMode === 'field') {
                container.style.display = 'block';
            } else {
                container.style.display = 'none';
            }
        }
    }

    function toggleAutoSubmitVisibility() {
        const container = get('auto-submit-container');
        if (container) {
            // Only show auto-submit when in field mode AND 'before' multiplier order
            if (state.inputMode === 'field' && state.multiplierOrder === 'before') {
                container.style.display = 'flex';
            } else {
                container.style.display = 'none';
            }
        }
    }

    // Initialize settings modal (should be loaded synchronously by now)
    initSettingsModalListeners();

    function handleKeypadClick(e) {
        const target = e.target.closest('button');
        if (!target) return;

        const number = target.dataset.number;
        const multiplier = target.dataset.multiplier;
        const action = target.dataset.action;
        const digit = target.dataset.digit;

        if (state.inputMode === 'score') {
            // Score input mode
            if (digit !== undefined) {
                handleDigitInput(digit);
            } else if (action === 'clear') {
                scoreInputBuffer = '';
                render();
            } else if (action === 'undo') {
                handleUndo();
            } else if (action === 'next') {
                submitTurn();
            }
        } else {
            // Field input mode
            if (number !== undefined) {
                handleScoreInput(parseInt(number, 10));
            } else if (multiplier !== undefined) {
                applyMultiplier(parseInt(multiplier, 10));
            } else if (action !== undefined) {
                if (action === 'undo') handleUndo();
                if (action === 'next') submitTurn();
            }
        }
    }

    function handleKeyboardInput(e) {
        // Only handle keyboard input in score mode
        if (state.inputMode !== 'score') return;

        // Ignore if modal is open
        if (allPlayersModal && !allPlayersModal.classList.contains('hidden')) return;
        if (gameOverModal && !gameOverModal.classList.contains('hidden')) return;
        if (settingsModal && !settingsModal.classList.contains('hidden')) return;

        // Handle number keys (0-9)
        if (e.key >= '0' && e.key <= '9') {
            e.preventDefault();
            handleDigitInput(e.key);
        }
        // Handle Backspace
        else if (e.key === 'Backspace') {
            e.preventDefault();
            if (scoreInputBuffer.length > 0) {
                // Remove last digit
                scoreInputBuffer = scoreInputBuffer.slice(0, -1);
                render();
            } else {
                // If buffer is empty, trigger undo
                handleUndo();
            }
        }
        // Handle Enter
        else if (e.key === 'Enter') {
            e.preventDefault();
            submitTurn();
        }
        // Handle Escape to clear buffer
        else if (e.key === 'Escape') {
            e.preventDefault();
            scoreInputBuffer = '';
            render();
        }
    }

    function handleDigitInput(digit) {
        // In score mode, we're entering the total score for the turn, not individual darts
        scoreInputBuffer += digit;

        // Clear any invalid input error when user starts typing
        if (state.showInvalidInputError) {
            state.showInvalidInputError = false;
        }

        render();
    }

    function handleScoreInput(value) {
        if (state.currentTurn.length >= 3) return;

        let multiplier = 1;

        // In 'before' mode, use pending multiplier if set
        if (state.multiplierOrder === 'before' && state.pendingMultiplier) {
            multiplier = state.pendingMultiplier;
            // Handle special case: T25 is not possible
            if (value === 25 && multiplier === 3) {
                multiplier = 2;
            }
            // Clear pending multiplier after use
            state.pendingMultiplier = null;
        }

        const score = value * multiplier;
        state.currentTurn.push({ value, multiplier, score });
        state.showError = false; // Hide error when user enters a dart
        renderKeypad(); // Re-render keypad to update button states
        render();

        // Auto-submit after third dart if enabled and in 'before' mode
        if (state.autoSubmit && state.multiplierOrder === 'before' && state.currentTurn.length === 3) {
            // Small delay to let the UI update before submitting
            setTimeout(() => {
                submitTurn();
            }, 500);
        }
    }

    function applyMultiplier(newMultiplier) {
        if (state.multiplierOrder === 'before') {
            // In 'before' mode, toggle the pending multiplier (highlight mode)
            if (state.pendingMultiplier === newMultiplier) {
                state.pendingMultiplier = null; // Deactivate if clicking the same button
            } else {
                state.pendingMultiplier = newMultiplier; // Activate the multiplier
            }
            renderKeypad(); // Re-render to show highlighted state
            render();
        } else {
            // In 'after' mode, modify the last dart
            if (state.currentTurn.length === 0) return;
            const lastDart = state.currentTurn[state.currentTurn.length - 1];
            if (lastDart.value === 0) return; // No multiplier on MISS
            if (lastDart.value === 25 && newMultiplier === 3) newMultiplier = 2; // T25 is not possible

            lastDart.multiplier = (lastDart.multiplier === newMultiplier) ? 1 : newMultiplier;
            lastDart.score = lastDart.value * lastDart.multiplier;
            render();
        }
    }
    function handleUndo() {
        // In score mode, undo works differently
        if (state.inputMode === 'score') {
            if (scoreInputBuffer.length > 0) {
                // Remove last digit from buffer
                scoreInputBuffer = scoreInputBuffer.slice(0, -1);
                render();
            } else if (previousState !== null) {
                // Restore previous player's turn
                state = JSON.parse(JSON.stringify(previousState));
                scoreInputBuffer = previousScoreInputBuffer;
                previousState = null;
                previousScoreInputBuffer = '';
                saveState();
                renderKeypad();
                render();
            }
            return;
        }

        // Field mode
        if (state.currentTurn.length > 0) {
            // Remove last dart from current turn
            state.currentTurn.pop();
            state.pendingMultiplier = null; // Clear pending multiplier
            renderKeypad(); // Re-render to update button states
            render();
        } else if (previousState !== null) {
            // Restore previous player's turn if current turn is empty
            state = JSON.parse(JSON.stringify(previousState));
            previousState = null;
            saveState();
            renderKeypad();
            render();
        }
    }

    function submitTurn() {
        // In score mode, convert buffer to turn score
        if (state.inputMode === 'score') {
            if (scoreInputBuffer === '') {
                // No score entered
                state.showError = true;
                state.showInvalidInputError = false;
                render();
                return;
            }

            const totalScore = parseInt(scoreInputBuffer, 10);
            if (isNaN(totalScore) || totalScore < 0 || totalScore > 180) {
                // Invalid score - show error and clear buffer
                state.showInvalidInputError = true;
                state.showError = false;
                scoreInputBuffer = ''; // Clear buffer so user can start fresh
                render();
                return;
            }

            // Valid score - clear any errors
            state.showInvalidInputError = false;

            // Store total score as a single "turn" entry
            state.currentTurn = [{ value: totalScore, multiplier: 1, score: totalScore }];
            scoreInputBuffer = '';
        }

        if (state.currentTurn.length === 0) {
            // Prevent submitting an empty turn and show error in current turn display
            state.showError = true;
            render();
            return;
        }

        // Clear error flag
        state.showError = false;
        state.pendingMultiplier = null; // Clear any pending multiplier

        // Save state before modification to allow undo
        previousState = JSON.parse(JSON.stringify(state));
        previousScoreInputBuffer = state.inputMode === 'score' ? String(state.currentTurn[0].score) : '';
        const player = state.players[state.currentPlayerIndex];
        let turnTotal = 0;
        let turnHasDoubled = false;

        if (state.doubleIn && !player.hasDoubledIn) {
            // In score mode, we can't track individual doubles, so skip this turn
            if (state.inputMode === 'score') {
                // Can't use score mode with double in requirement
                state.currentTurn = [];
                render();
                return;
            }

            for (const dart of state.currentTurn) {
                if (!turnHasDoubled && dart.multiplier === 2) {
                    turnHasDoubled = true;
                }
                if (turnHasDoubled) {
                    turnTotal += dart.score;
                }
            }
            if (turnHasDoubled) player.hasDoubledIn = true;
        } else {
            turnTotal = state.currentTurn.reduce((sum, dart) => sum + dart.score, 0);
        }

        const scoreAfterTurn = player.score - turnTotal;
        const lastDart = state.currentTurn[state.currentTurn.length - 1];
        let isBust = scoreAfterTurn < 0 || (scoreAfterTurn === 1 && state.doubleOut);
        let isWinner = false;

        if (scoreAfterTurn === 0) {
            // In score mode, we can't verify double out
            if (state.inputMode === 'score' && state.doubleOut) {
                // Can't verify double out in score mode - assume valid
                isWinner = true;
            } else if (!state.doubleOut || (lastDart && lastDart.multiplier === 2)) {
                isWinner = true;
            } else {
                isBust = true;
            }
        }

        if (!isBust) {
            player.score = scoreAfterTurn;
            player.history.push(turnTotal);
        }

        // In score mode, always count as 3 darts thrown
        player.dartsThrown += state.inputMode === 'score' ? 3 : state.currentTurn.length;

        if (isWinner) {
            player.legs += 1;
            showWinner(player.name);
        } else {
            state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
        }

        state.currentTurn = [];
        state.pendingMultiplier = null;
        saveState();
        renderKeypad();
        render();
    }

    function showWinner(name) {
        winnerNameEl.textContent = name;
        gameOverModal.classList.remove('hidden');

        // Start confetti animation
        startConfetti();
    }

    // Confetti animation
    function startConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const confettiPieces = [];
        const confettiCount = 150;
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];

        class Confetti {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height - canvas.height;
                this.size = Math.random() * 10 + 5;
                this.speedY = Math.random() * 3 + 2;
                this.speedX = Math.random() * 2 - 1;
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.rotation = Math.random() * 360;
                this.rotationSpeed = Math.random() * 10 - 5;
            }

            update() {
                this.y += this.speedY;
                this.x += this.speedX;
                this.rotation += this.rotationSpeed;

                // Reset if off screen
                if (this.y > canvas.height) {
                    this.y = -20;
                    this.x = Math.random() * canvas.width;
                }
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation * Math.PI / 180);
                ctx.fillStyle = this.color;
                ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
                ctx.restore();
            }
        }

        // Create confetti pieces
        for (let i = 0; i < confettiCount; i++) {
            confettiPieces.push(new Confetti());
        }

        let animationId;
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            confettiPieces.forEach(piece => {
                piece.update();
                piece.draw();
            });

            animationId = requestAnimationFrame(animate);
        }

        animate();

        // Stop confetti after 10 seconds or when modal is closed
        const stopConfetti = () => {
            cancelAnimationFrame(animationId);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        };

        setTimeout(stopConfetti, 10000);

        // Also stop when modal is hidden
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.classList.contains('hidden')) {
                    stopConfetti();
                    observer.disconnect();
                }
            });
        });

        observer.observe(gameOverModal, { attributes: true, attributeFilter: ['class'] });
    }

    function startNextLeg() {
        state.legStarterIndex = (state.legStarterIndex + 1) % state.players.length;
        state.currentPlayerIndex = state.legStarterIndex;
        state.players.forEach(p => {
            p.score = state.gameType;
            p.dartsThrown = 0;
            p.history = [];
            p.hasDoubledIn = false;
        });
        state.currentTurn = [];
        state.pendingMultiplier = null;
        state.showError = false;
        gameOverModal.classList.add('hidden');
        saveState();
        renderKeypad();
        render();
    }

    function resetGame() {
        storage.removeItem('gameState');
        storage.removeItem('setupData'); // Clear setup data to force new player input

        // Update settings with current game settings
        updateSettings();

        navigateToSetup();
    }

    function updateSettings() {
        // Update only the settings in localStorage, not the game state
        let currentSettings = JSON.parse(storage.getItem('settings'));
        if (!currentSettings) {
            // Get language from settings if exists, otherwise default
            const existingSettings = JSON.parse(storage.getItem('settings'));
            currentSettings = {
                doubleIn: false,
                doubleOut: true,
                inputMode: 'field',
                multiplierOrder: 'after',
                autoSubmit: false,
                language: existingSettings?.language || 'de',
                defaultPoints: 501
            };
        }

        // Update game-related settings, but preserve language
        currentSettings.doubleIn = state.doubleIn;
        currentSettings.doubleOut = state.doubleOut;
        currentSettings.inputMode = state.inputMode;
        currentSettings.multiplierOrder = state.multiplierOrder || 'after';
        currentSettings.autoSubmit = state.autoSubmit || false;
        // Keep existing language and defaultPoints

        storage.setItem('settings', JSON.stringify(currentSettings));
    }

    function saveState() {
        storage.setItem('gameState', JSON.stringify(state));
    }

    function getCheckoutSuggestion(score, dartsRemaining) {
        // Determine which checkout table to use based on remaining darts
        const dartsKey = Math.min(dartsRemaining, 3).toString();

        if (!CHECKOUTS || !CHECKOUTS[dartsKey]) {
            return '';
        }

        // Maximum possible checkout scores for each dart count
        const maxCheckouts = {
            '1': 50,   // BULL
            '2': 110,  // T20-BULL
            '3': 170   // T20-T20-BULL
        };

        if (score < 2 || score > maxCheckouts[dartsKey]) {
            return '';
        }

        const checkoutTable = CHECKOUTS[dartsKey];
        return checkoutTable[score] || '';
    }

    function render() {
        renderScoreboard();
        renderCurrentTurn();
    }

    function renderKeypad() {
        const keypadGrid = document.getElementById('keypad-grid');

        if (state.inputMode === 'score') {
            // Score input mode: 0-9 buttons for total score entry
            keypadGrid.className = 'space-y-1.5';
            keypadGrid.innerHTML = `
                <div class="grid grid-cols-3 gap-1.5">
                    <button data-digit="7" class="keypad-btn number-btn text-xl font-bold py-5 rounded-lg">7</button>
                    <button data-digit="8" class="keypad-btn number-btn text-xl font-bold py-5 rounded-lg">8</button>
                    <button data-digit="9" class="keypad-btn number-btn text-xl font-bold py-5 rounded-lg">9</button>
                    <button data-digit="4" class="keypad-btn number-btn text-xl font-bold py-5 rounded-lg">4</button>
                    <button data-digit="5" class="keypad-btn number-btn text-xl font-bold py-5 rounded-lg">5</button>
                    <button data-digit="6" class="keypad-btn number-btn text-xl font-bold py-5 rounded-lg">6</button>
                    <button data-digit="1" class="keypad-btn number-btn text-xl font-bold py-5 rounded-lg">1</button>
                    <button data-digit="2" class="keypad-btn number-btn text-xl font-bold py-5 rounded-lg">2</button>
                    <button data-digit="3" class="keypad-btn number-btn text-xl font-bold py-5 rounded-lg">3</button>
                    <button data-digit="0" class="keypad-btn number-btn text-xl font-bold py-5 rounded-lg col-span-2">0</button>
                    <button data-action="clear" class="keypad-btn special-btn btn-undo text-lg font-bold py-5 rounded-lg">C</button>
                </div>
                <div class="grid grid-cols-2 gap-1.5">
                    <button data-action="undo" class="keypad-btn special-btn btn-undo text-lg font-bold py-4 rounded-lg" data-i18n="undo">ZURÜCK</button>
                    <button data-action="next" class="keypad-btn special-btn btn-next text-lg font-bold py-4 rounded-lg" data-i18n="done">FERTIG</button>
                </div>
            `;
        } else {
            // Field input mode: original layout
            // Add 'active' class to multiplier buttons if they are pending in 'before' mode
            const tripleActive = (state.multiplierOrder === 'before' && state.pendingMultiplier === 3) ? 'multiplier-active' : '';
            const doubleActive = (state.multiplierOrder === 'before' && state.pendingMultiplier === 2) ? 'multiplier-active' : '';

            keypadGrid.className = 'space-y-1.5';
            keypadGrid.innerHTML = `
                <div class="grid grid-cols-2 gap-1.5">
                    <button data-multiplier="3" class="multiplier-btn keypad-btn btn-triple text-lg font-bold py-3 rounded-lg ${tripleActive}" data-i18n="tripple">TRIPLE</button>
                    <button data-multiplier="2" class="multiplier-btn keypad-btn btn-double text-lg font-bold py-3 rounded-lg ${doubleActive}" data-i18n="double">DOPPEL</button>
                </div>
                <div class="grid grid-cols-4 gap-1.5">
                    <button data-number="17" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">17</button>
                    <button data-number="18" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">18</button>
                    <button data-number="19" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">19</button>
                    <button data-number="20" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">20</button>
                    <button data-number="13" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">13</button>
                    <button data-number="14" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">14</button>
                    <button data-number="15" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">15</button>
                    <button data-number="16" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">16</button>
                    <button data-number="9" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">9</button>
                    <button data-number="10" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">10</button>
                    <button data-number="11" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">11</button>
                    <button data-number="12" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">12</button>
                    <button data-number="5" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">5</button>
                    <button data-number="6" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">6</button>
                    <button data-number="7" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">7</button>
                    <button data-number="8" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">8</button>
                    <button data-number="1" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">1</button>
                    <button data-number="2" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">2</button>
                    <button data-number="3" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">3</button>
                    <button data-number="4" class="keypad-btn number-btn text-xl font-bold py-3 rounded-lg">4</button>
                </div>
                <div class="grid grid-cols-4 gap-1.5">
                    <button data-number="25" class="keypad-btn number-btn text-lg font-bold py-3 rounded-lg" data-i18n="bull">BULL</button>
                    <button data-number="0" class="keypad-btn number-btn text-lg font-bold py-3 rounded-lg" data-i18n="miss">MISS</button>
                    <button data-action="undo" class="keypad-btn special-btn btn-undo text-lg font-bold py-3 rounded-lg" data-i18n="undo">ZURÜCK</button>
                    <button data-action="next" class="keypad-btn special-btn btn-next text-lg font-bold py-3 rounded-lg" data-i18n="done">FERTIG</button>
                </div>
            `;
        }

        // Re-apply translations after changing keypad
        if (window.setLanguage) {
            const settings = JSON.parse(storage.getItem('settings'));
            const currentLang = settings && settings.language ? settings.language : 'en';
            window.setLanguage(currentLang).catch(error => {
                console.error('Failed to apply language:', error);
            });
        }
    }

    function renderScoreboard() {
        scoreboard.innerHTML = '';
        statsDisplay.innerHTML = '';
        const currentPlayer = state.players[state.currentPlayerIndex];

        let playersToShow;

        // For exactly 2 players, always show both in fixed positions
        if (state.players.length === 2) {
            playersToShow = [state.players[0], state.players[1]];
        } else if (state.players.length === 1) {
            playersToShow = [currentPlayer];
        } else {
            // For 3+ players, show current player and next player
            playersToShow = [currentPlayer];
            let nextPlayer;
            if (state.nextPlayerMode === 'best') {
                nextPlayer = [...state.players]
                    .filter(p => p !== currentPlayer)
                    .sort((a, b) => a.score - b.score)[0];
            } else {
                const nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
                nextPlayer = state.players[nextPlayerIndex];
            }
            playersToShow.push(nextPlayer);
        }

        const panelWidth = state.players.length === 1 ? 'w-full' : 'w-1/2';

        playersToShow.forEach((player) => {
            const isActive = player === currentPlayer;
            const panel = document.createElement('div');
            panel.className = `player-panel ${panelWidth} bg-gray-800 p-2 rounded-lg border-2 border-gray-700 transition-all duration-300 ${isActive ? 'player-active' : ''}`;

            const avg = player.dartsThrown > 0 ? ((state.gameType - player.score) / player.dartsThrown) * 3 : 0;
            const high = player.history.length > 0 ? Math.max(0, ...player.history) : 0;

            // Calculate current score after thrown darts for active player
            let currentScore = player.score;
            let dartsRemaining = 3;

            if (isActive) {
                // For score input mode, use the buffer
                if (state.inputMode === 'score' && scoreInputBuffer) {
                    const inputScore = parseInt(scoreInputBuffer, 10);
                    if (!isNaN(inputScore)) {
                        currentScore = player.score - inputScore;
                        dartsRemaining = 0; // All darts used in score mode
                    }
                } else if (state.currentTurn.length > 0) {
                    // For field input mode, calculate score after current darts
                    let turnTotal = 0;
                    let turnHasDoubled = false;

                    for (const dart of state.currentTurn) {
                        if (state.doubleIn && !player.hasDoubledIn) {
                            if (!turnHasDoubled && dart.multiplier === 2) {
                                turnHasDoubled = true;
                            }
                            if (turnHasDoubled) {
                                turnTotal += dart.score;
                            }
                        } else {
                            turnTotal += dart.score;
                        }
                    }

                    currentScore = player.score - turnTotal;
                    dartsRemaining = 3 - state.currentTurn.length;
                }
            }

            const checkout = getCheckoutSuggestion(currentScore, dartsRemaining);

            // Check if player needs Double In and if current turn has a double
            let needsDoubleIn = state.doubleIn && !player.hasDoubledIn && isActive;
            let currentTurnHasDouble = false;

            if (needsDoubleIn && state.currentTurn.length > 0) {
                // Check if any dart in current turn is a double
                currentTurnHasDouble = state.currentTurn.some(dart => dart.multiplier === 2);
            }

            let specialText;
            if (needsDoubleIn && !currentTurnHasDouble) {
                // Show Double In message only if no double has been thrown yet in current turn
                if (window.getTranslation) {
                    specialText = window.getTranslation('double_in_required');
                } else {
                    // Fallback based on browser language
                    const lang = storage.getItem('language') || navigator.language.split('-')[0];
                    specialText = lang === 'en' ? 'Double In required' : 'Double In benötigt';
                }
            } else if (checkout) {
                // Show checkout in parentheses if available
                specialText = `(${checkout})`;
            } else {
                specialText = '';
            }

            // Always show current score for active player, include checkout in same line
            let scoreDisplay;
            if (isActive) {
                // Check if there's input (either darts in field mode or buffer in score mode)
                const hasInput = (state.inputMode === 'score' && scoreInputBuffer) || state.currentTurn.length > 0;

                if (hasInput && currentScore !== player.score) {
                    // Show current score with checkout
                    scoreDisplay = `<div class="text-2xl font-bold score-display-current text-center" style="line-height: 1.2;">→ ${currentScore} <span class="text-lg score-special-text">${specialText}</span></div>`;
                } else {
                    // Show only checkout when no darts thrown yet
                    scoreDisplay = `<div class="text-lg font-medium score-special-text text-center" style="line-height: 1.2; min-height: 2.5rem; display: flex; align-items: center; justify-content: center;">${specialText}</div>`;
                }
            } else {
                // For inactive players
                // Show "Tap for all players" hint for second player when 3+ players
                const isSecondPanel = playersToShow.indexOf(player) === 1;
                if (state.players.length >= 3 && isSecondPanel) {
                    // Show hint to tap for all players instead of checkout
                    const hintText = window.getTranslation
                        ? window.getTranslation('tap_for_all_players')
                        : '👥 Tippen für alle';
                    scoreDisplay = `<div class="text-xs font-medium text-gray-400 text-center" style="min-height: 2.5rem; display: flex; align-items: center; justify-content: center;">${hintText}</div>`;
                } else {
                    // Show checkout for inactive players (when only 2 players)
                    scoreDisplay = `<div class="text-sm font-medium score-special-text text-center" style="min-height: 2.5rem; display: flex; align-items: center; justify-content: center;">${specialText}</div>`;
                }
            }

            panel.innerHTML = `
                <h2 class="text-base font-semibold truncate text-center">${player.name}</h2>
                <div class="text-5xl font-extrabold text-center ${isActive ? 'score-display-current' : 'score-display-inactive'}" style="line-height: 1.1;">${player.score}</div>
                ${scoreDisplay}
            `;
            scoreboard.appendChild(panel);

            const statsDiv = document.createElement('div');
            statsDiv.className = `${panelWidth} text-center`;
            statsDiv.innerHTML = `Avg: ${avg.toFixed(2)} | High: ${high} | Legs: ${player.legs}`;
            statsDisplay.appendChild(statsDiv);
        });
    }

    function renderCurrentTurn() {
        dartEntries.innerHTML = '';
        let displayTurnTotal = 0;
        let turnHasDoubled = false;
        const player = state.players[state.currentPlayerIndex];

        // In score mode, show the input buffer
        if (state.inputMode === 'score') {
            // Check for invalid input error first
            if (state.showInvalidInputError) {
                let errorText;
                if (window.getTranslation) {
                    errorText = window.getTranslation('error_invalid_score');
                } else {
                    const lang = storage.getItem('language') || navigator.language.split('-')[0];
                    errorText = lang === 'en' ? 'Please enter a number between 0 and 180!' : 'Bitte Zahl zwischen 0 und 180 eingeben!';
                }
                dartEntries.innerHTML = `<span class="score-error-text font-medium text-center flex-1">${errorText}</span>`;
                turnTotalEl.textContent = '⚠️';
                turnTotalEl.classList.add('score-error-text');
                turnTotalEl.classList.remove('text-gray-500');
                return;
            }

            if (scoreInputBuffer) {
                // Show current input on the right
                turnTotalEl.textContent = scoreInputBuffer;
                turnTotalEl.classList.remove('score-display-inactive', 'score-error-text');
            } else {
                // Show error or placeholder
                if (state.showError) {
                    let errorText;
                    if (window.getTranslation) {
                        errorText = window.getTranslation('error_no_darts');
                    } else {
                        const lang = storage.getItem('language') || navigator.language.split('-')[0];
                        errorText = lang === 'en' ? 'Please enter score!' : 'Bitte Punktzahl eingeben!';
                    }
                    dartEntries.innerHTML = `<span class="score-error-text font-medium text-center flex-1">${errorText}</span>`;
                    turnTotalEl.textContent = '⚠️';
                    turnTotalEl.classList.add('score-error-text');
                    turnTotalEl.classList.remove('score-display-inactive');
                } else {
                    turnTotalEl.textContent = '0';
                    turnTotalEl.classList.add('score-display-inactive');
                    turnTotalEl.classList.remove('score-error-text');
                }
            }
            return;
        }

        // Field mode - show individual darts
        // Show error message if no darts entered and user tried to submit
        if (state.showError && state.currentTurn.length === 0) {
            let errorText;
            if (window.getTranslation) {
                errorText = window.getTranslation('error_no_darts');
            } else {
                const lang = storage.getItem('language') || navigator.language.split('-')[0];
                errorText = lang === 'en' ? 'Please enter at least one dart (or MISS)!' : 'Bitte mindestens einen Dart eingeben (oder MISS)!';
            }
            dartEntries.innerHTML = `<span class="score-error-text font-medium text-center flex-1">${errorText}</span>`;
            turnTotalEl.textContent = '⚠️';
            turnTotalEl.classList.add('score-error-text');
            turnTotalEl.classList.remove('score-display-inactive');
            return;
        }

        state.currentTurn.forEach(dart => {
            let prefix = dart.multiplier === 2 ? 'D' : dart.multiplier === 3 ? 'T' : '';
            let text = `${prefix}${dart.value}`;
            if (dart.value === 25) text = prefix === 'D' ? 'BULL' : '25';
            if (dart.value === 0) text = 'MISS';

            let effectiveScore = dart.score;
            if (state.doubleIn && !player.hasDoubledIn) {
                if (!turnHasDoubled) {
                    if (dart.multiplier === 2) {
                        turnHasDoubled = true;
                    } else {
                        effectiveScore = 0;
                        text = `(${text}) 0`;
                    }
                }
            }
            displayTurnTotal += effectiveScore;
            dartEntries.innerHTML += `<span class="bg-gray-700 px-3 py-2 rounded-md text-lg font-medium">${text}</span>`;
        });

        turnTotalEl.textContent = displayTurnTotal;
        turnTotalEl.classList.toggle('score-display-inactive', displayTurnTotal === 0);
        turnTotalEl.classList.remove('score-error-text');
    }

    function showAllPlayersModal() {
        allPlayersList.innerHTML = '';
        const sortedPlayers = [...state.players].sort((a, b) => a.score - b.score);

        sortedPlayers.forEach((player, index) => {
            const li = document.createElement('li');
            const isCurrent = player.name === state.players[state.currentPlayerIndex].name;
            li.className = `flex justify-between p-3 bg-gray-700 rounded-md text-lg ${isCurrent ? 'border-2 border-blue-500' : ''}`;
            li.innerHTML = `
                <span class="truncate pr-4">${isCurrent ? '🎯' : `${index + 1}.`} ${player.name}</span>
                <span class="font-bold whitespace-nowrap">${player.score} (Legs: ${player.legs})</span>
            `;
            allPlayersList.appendChild(li);
        });

        if (state.players.length > 2) {
            nextPlayerDisplaySettings.classList.remove('hidden');
            nextPlayerModeSelect.value = state.nextPlayerMode;
        } else {
            nextPlayerDisplaySettings.classList.add('hidden');
        }

        allPlayersModal.classList.remove('hidden');
    }

    function showSettingsModal() {
        if (!settingsModal) {
            console.error('Settings modal not loaded yet');
            return;
        }

        // Update checkbox states from current game state
        if (doubleInCheck) doubleInCheck.checked = state.doubleIn;
        if (doubleOutCheck) doubleOutCheck.checked = state.doubleOut;

        // Set input mode from current game state
        if (inputModeSelect) {
            inputModeSelect.value = state.inputMode;
        }

        // Set multiplier order from current game state
        if (multiplierOrderSelect) {
            multiplierOrderSelect.value = state.multiplierOrder || 'after';
        }

        // Set auto-submit from current game state
        if (autoSubmitCheck) {
            autoSubmitCheck.checked = state.autoSubmit || false;
        }

        // Show/hide multiplier order based on input mode
        toggleMultiplierOrderVisibility();

        // Show/hide auto-submit based on input mode and multiplier order
        toggleAutoSubmitVisibility();

        // Set current language in dropdown (already populated by localization.js)
        const settings = JSON.parse(storage.getItem('settings'));
        const currentLang = settings && settings.language ? settings.language : 'en';
        if (languageSelect) {
            languageSelect.value = currentLang;
        }

        settingsModal.classList.remove('hidden');
    }

    // --- App Start ---
    // init(); // Is now called after checkouts are loaded
});

