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
                }, { once: true });
            } else {
                // DOM already ready, append immediately
                document.body.appendChild(tempDiv.firstElementChild);
                console.log('Settings modal loaded successfully (immediate)');
            }
        } else {
            console.error('Failed to load settings modal, status:', xhr.status);
        }
    } catch (error) {
        console.error('Error loading settings modal:', error);
    }
})();

