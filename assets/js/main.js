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

document.addEventListener('DOMContentLoaded', () => {
    const playerList = document.getElementById('player-list');
    const addPlayerBtn = document.getElementById('add-player');
    const startGameBtn = document.getElementById('start-game');
    const settingsBtn = document.getElementById('settings-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const settingsModal = document.getElementById('settings-modal');

    const createPlayerInput = (playerNumber) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'flex items-center space-x-2';
        const placeholderText = `Spieler ${playerNumber}`;
        playerDiv.innerHTML = `
            <input type="text" value="${placeholderText}" class="block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500" data-i18n-placeholder="player_placeholder" placeholder="${placeholderText}">
            <button class="remove-player-btn text-red-500 hover:text-red-700 p-1 rounded-full">
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
        // After initial creation, trigger translation for placeholders
        if (window.setLanguage) {
            window.setLanguage(localStorage.getItem('dartsScorerLanguage') || 'de').catch(error => {
                console.error('Failed to set language:', error);
            });
        }
    };

    addPlayerBtn.addEventListener('click', () => {
        createPlayerInput(playerList.children.length + 1);
        // Re-apply translation for newly added elements
        if (window.setLanguage) {
            window.setLanguage(localStorage.getItem('dartsScorerLanguage') || 'de').catch(error => {
                console.error('Failed to set language:', error);
            });
        }
    });

    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    window.addEventListener('click', (event) => {
        if (event.target === settingsModal) {
            settingsModal.classList.add('hidden');
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

        const gameSettings = {
            points: document.getElementById('game-points').value,
            players: players,
            doubleIn: document.getElementById('double-in-check').checked,
            doubleOut: document.getElementById('double-out-check').checked,
            nextPlayerMode: 'next' // 'next' or 'best'
        };

        localStorage.setItem('dartsGameSettings', JSON.stringify(gameSettings));
        navigateToGame();
    });

    initPlayers();
});

