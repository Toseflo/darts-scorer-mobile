document.addEventListener('DOMContentLoaded', () => {
    // Determine base path for assets based on current location
    const basePath = window.location.pathname.includes('/game/') ? '../assets' : 'assets';

    const translations = {};
    // To add a new language:
    // 1. Create a new JSON file in assets/lang/ (e.g., fr.json)
    // 2. Add "language_name" field with the display name
    // 3. Add the language code to the array below
    const availableLanguages = ['de', 'en']; // List of available language files

    // Custom confirm dialog function - Make available immediately
    window.customConfirm = (message) => {
        return new Promise((resolve) => {
            const dialog = document.getElementById('confirm-dialog');
            const messageEl = document.getElementById('confirm-message');
            const yesBtn = document.getElementById('confirm-yes-btn');
            const noBtn = document.getElementById('confirm-no-btn');

            if (!dialog || !messageEl || !yesBtn || !noBtn) {
                console.warn('Custom confirm elements not found, using native confirm');
                resolve(confirm(message));
                return;
            }

            messageEl.textContent = message;
            dialog.classList.remove('hidden');

            const handleYes = () => {
                cleanup();
                resolve(true);
            };

            const handleNo = () => {
                cleanup();
                resolve(false);
            };

            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                }
            };

            const cleanup = () => {
                dialog.classList.add('hidden');
                yesBtn.removeEventListener('click', handleYes);
                noBtn.removeEventListener('click', handleNo);
                document.removeEventListener('keydown', handleEscape);
            };

            yesBtn.addEventListener('click', handleYes);
            noBtn.addEventListener('click', handleNo);
            document.addEventListener('keydown', handleEscape);
        });
    };


    const loadAvailableLanguages = async () => {
        const languageOptions = [];

        for (const lang of availableLanguages) {
            try {
                const response = await fetch(`${basePath}/lang/${lang}.json`);
                if (response.ok) {
                    /** @type {{language_name?: string}} */
                    const data = await response.json();
                    if (data.language_name) {
                        languageOptions.push({
                            code: lang,
                            name: data.language_name
                        });
                        // Preload translation
                        translations[lang] = data;
                    }
                } else {
                    console.error(`Failed to fetch ${lang}.json: ${response.status}`);
                }
            } catch (error) {
                console.error(`Failed to load language ${lang}:`, error);
            }
        }

        return languageOptions;
    };

    const populateLanguageSelect = (languages, selectedLang) => {
        // Populate main language select (index.html)
        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            langSelect.innerHTML = '';
            languages.forEach(lang => {
                const option = document.createElement('option');
                option.value = lang.code;
                option.textContent = lang.name;
                langSelect.appendChild(option);
            });
            langSelect.value = selectedLang;
        }
    };

    const loadTranslations = async (lang) => {
        try {
            const response = await fetch(`${basePath}/lang/${lang}.json`);
            if (!response.ok) {
                console.error(`Could not load ${lang}.json`);
                // Fallback to English if the selected language fails to load
                if (lang !== 'en') {
                    await loadTranslations('en');
                }
                return;
            }
            translations[lang] = await response.json();
        } catch (error) {
            console.error(error);
            // Fallback to English if the selected language fails to load
            if (lang !== 'en') {
                await loadTranslations('en');
            }
        }
    };

    const translatePage = (lang) => {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (translations[lang] && translations[lang][key]) {
                element.innerHTML = translations[lang][key];
            }
        });
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            if (translations[lang] && translations[lang][key]) {
                document.title = translations[lang][key];
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (translations[lang] && translations[lang][key]) {
                element.placeholder = translations[lang][key];
            }
        });
    };

    const setLanguage = async (lang) => {
        if (!translations[lang]) {
            await loadTranslations(lang);
        }
        translatePage(lang);
        localStorage.setItem('dartsScorerLanguage', lang);

        // Update both language selects
        const langSelect = document.getElementById('language-select');
        if (langSelect) langSelect.value = lang;

        const langSelectGame = document.getElementById('language-select-game');
        if (langSelectGame) langSelectGame.value = lang;
    };

    const getTranslation = (key) => {
        const lang = localStorage.getItem('dartsScorerLanguage') || 'en';
        return (translations[lang] && translations[lang][key]) || key;
    };


    const getInitialLanguage = () => {
        return localStorage.getItem('dartsScorerLanguage') || navigator.language.split('-')[0] || 'en';
    };

    // Initialize
    const init = async () => {
        const languages = await loadAvailableLanguages();
        const initialLang = getInitialLanguage();

        // Ensure initial language exists in available languages
        const langExists = languages.some(l => l.code === initialLang);
        const selectedLang = langExists ? initialLang : (languages[0]?.code || 'en');

        populateLanguageSelect(languages, selectedLang);

        const langSelect = document.getElementById('language-select');
        if (langSelect) {
            langSelect.addEventListener('change', (e) => {
                setLanguage(e.target.value);
            });
        }

        // Make setLanguage globally available
        window.setLanguage = setLanguage;
        window.getTranslation = getTranslation;
        // customConfirm is already set globally at the top

        // Set initial language
        await setLanguage(selectedLang);
    };

    // Initialize (settings modal should be loaded synchronously by now)
    init().catch(error => {
        console.error('Failed to initialize localization:', error);
    });
});

