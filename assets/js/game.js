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
    const settingsModal = get('settings-modal');
    const settingsGameBtn = get('settings-game-btn');
    const closeSettingsBtn = get('close-modal-btn');
    const doubleInCheck = get('double-in-check');
    const doubleOutCheck = get('double-out-check');
    const languageSelectGame = get('language-select-game');

    // --- Game State ---
    let state = {};
    let previousState = null; // For undo functionality across players
    let CHECKOUTS = {}; // Checkout data loaded from JSON

    // --- Initial Load ---
    fetch('assets/data/checkouts.json')
        .then(response => response.json())
        .then(data => {
            CHECKOUTS = data;
            init().catch(error => {
                console.error('Failed to initialize game:', error);
            });
        })
        .catch(error => {
            console.error("Could not load checkout data:", error);
            // Optionally, initialize without checkouts
            init().catch(error => {
                console.error('Failed to initialize game:', error);
            });
        });


    async function init() {
        const settings = JSON.parse(localStorage.getItem('dartsGameSettings'));
        if (!settings) {
            window.location.href = './';
            return;
        }

        const savedState = JSON.parse(localStorage.getItem('dartsGameState'));

        if (savedState) {
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
            } else {
                initNewGame(settings);
            }
        } else {
            initNewGame(settings);
        }

        addEventListeners();
        render();
    }

    function initNewGame(settings) {
        state = {
            gameType: parseInt(settings.points, 10),
            doubleIn: settings.doubleIn,
            doubleOut: settings.doubleOut,
            nextPlayerMode: settings.nextPlayerMode || 'next',
            players: settings.players.map(name => createPlayer(name, parseInt(settings.points, 10))),
            currentPlayerIndex: 0,
            legStarterIndex: 0,
            currentTurn: [],
            showError: false,
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
            saveState();
            render();
        });

        // Settings modal event listeners
        settingsGameBtn.addEventListener('click', showSettingsModal);
        closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.add('hidden');
            }
        });
        doubleInCheck.addEventListener('change', (e) => {
            state.doubleIn = e.target.checked;
            saveState();
            render();
        });
        doubleOutCheck.addEventListener('change', (e) => {
            state.doubleOut = e.target.checked;
            saveState();
            render();
        });
    }

    function handleKeypadClick(e) {
        const target = e.target.closest('button');
        if (!target) return;

        const number = target.dataset.number;
        const multiplier = target.dataset.multiplier;
        const action = target.dataset.action;

        if (number !== undefined) {
            handleScoreInput(parseInt(number, 10));
        } else if (multiplier !== undefined) {
            applyMultiplier(parseInt(multiplier, 10));
        } else if (action !== undefined) {
            if (action === 'undo') handleUndo();
            if (action === 'next') submitTurn();
        }
    }

    function handleScoreInput(value) {
        if (state.currentTurn.length >= 3) return;
        state.currentTurn.push({ value, multiplier: 1, score: value });
        state.showError = false; // Hide error when user enters a dart
        render();
    }

    function applyMultiplier(newMultiplier) {
        if (state.currentTurn.length === 0) return;
        const lastDart = state.currentTurn[state.currentTurn.length - 1];
        if (lastDart.value === 0) return; // No multiplier on MISS
        if (lastDart.value === 25 && newMultiplier === 3) newMultiplier = 2; // T25 is not possible

        lastDart.multiplier = (lastDart.multiplier === newMultiplier) ? 1 : newMultiplier;
        lastDart.score = lastDart.value * lastDart.multiplier;
        render();
    }
    function handleUndo() {
        if (state.currentTurn.length > 0) {
            // Remove last dart from current turn
            state.currentTurn.pop();
            render();
        } else if (previousState !== null) {
            // Restore previous player's turn if current turn is empty
            state = JSON.parse(JSON.stringify(previousState));
            previousState = null;
            saveState();
            render();
        }
    }

    function submitTurn() {
        if (state.currentTurn.length === 0) {
            // Prevent submitting an empty turn and show error in current turn display
            state.showError = true;
            render();
            return;
        }

        // Clear error flag
        state.showError = false;

        // Save state before modification to allow undo
        previousState = JSON.parse(JSON.stringify(state));
        const player = state.players[state.currentPlayerIndex];
        let turnTotal = 0;
        let turnHasDoubled = false;

        if (state.doubleIn && !player.hasDoubledIn) {
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
            if (!state.doubleOut || (lastDart && lastDart.multiplier === 2)) {
                isWinner = true;
            } else {
                isBust = true;
            }
        }

        if (!isBust) {
            player.score = scoreAfterTurn;
            player.history.push(turnTotal);
        }

        player.dartsThrown += state.currentTurn.length;

        if (isWinner) {
            player.legs += 1;
            showWinner(player.name);
        } else {
            state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
        }

        state.currentTurn = [];
        saveState();
        render();
    }

    function showWinner(name) {
        winnerNameEl.textContent = name;
        gameOverModal.classList.remove('hidden');
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
        state.showError = false;
        gameOverModal.classList.add('hidden');
        saveState();
        render();
    }

    function resetGame() {
        localStorage.removeItem('dartsGameState');
        localStorage.removeItem('dartsGameSettings');
        window.location.href = './';
    }

    function saveState() {
        localStorage.setItem('dartsGameState', JSON.stringify(state));
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

            if (isActive && state.currentTurn.length > 0) {
                // Calculate score after current darts
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
                    const lang = localStorage.getItem('dartsScorerLanguage') || navigator.language.split('-')[0];
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
                if (state.currentTurn.length > 0 && currentScore !== player.score) {
                    // Show current score with checkout
                    scoreDisplay = `<div class="text-2xl font-bold text-blue-300 text-center" style="line-height: 1.2;">→ ${currentScore} <span class="text-lg text-yellow-400">${specialText}</span></div>`;
                } else {
                    // Show only checkout when no darts thrown yet
                    scoreDisplay = `<div class="text-lg font-medium text-yellow-400 text-center" style="line-height: 1.2; min-height: 2.5rem; display: flex; align-items: center; justify-content: center;">${specialText}</div>`;
                }
            } else {
                // For inactive players, show checkout below
                scoreDisplay = `<div class="text-sm font-medium text-yellow-400 text-center" style="min-height: 2.5rem; display: flex; align-items: center; justify-content: center;">${specialText}</div>`;
            }

            panel.innerHTML = `
                <h2 class="text-base font-semibold truncate text-center">${player.name}</h2>
                <div class="text-5xl font-extrabold text-center ${isActive ? 'text-blue-400' : 'text-gray-500'}" style="line-height: 1.1;">${player.score}</div>
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

        // Show error message if no darts entered and user tried to submit
        if (state.showError && state.currentTurn.length === 0) {
            let errorText;
            if (window.getTranslation) {
                errorText = window.getTranslation('error_no_darts');
            } else {
                const lang = localStorage.getItem('dartsScorerLanguage') || navigator.language.split('-')[0];
                errorText = lang === 'en' ? 'Please enter at least one dart (or MISS)!' : 'Bitte mindestens einen Dart eingeben (oder MISS)!';
            }
            dartEntries.innerHTML = `<span class="text-red-400 font-medium text-center flex-1">${errorText}</span>`;
            turnTotalEl.textContent = '⚠️';
            turnTotalEl.classList.add('text-red-400');
            turnTotalEl.classList.remove('text-gray-500');
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
        turnTotalEl.classList.toggle('text-gray-500', displayTurnTotal === 0);
        turnTotalEl.classList.remove('text-red-400');
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
        // Update checkbox states from current game state
        doubleInCheck.checked = state.doubleIn;
        doubleOutCheck.checked = state.doubleOut;

        // Set current language in dropdown (already populated by localization.js)
        const currentLang = localStorage.getItem('dartsScorerLanguage') || 'de';
        if (languageSelectGame) {
            languageSelectGame.value = currentLang;
        }

        settingsModal.classList.remove('hidden');
    }

    // --- App Start ---
    // init(); // Is now called after checkouts are loaded
});

