// Project identifier for localStorage to avoid conflicts with other projects on same domain
const PROJECT_PREFIX = 'dartsScorer_';

// Helper functions for localStorage with project prefix
const storage = {
    getItem: (key) => localStorage.getItem(PROJECT_PREFIX + key),
    setItem: (key, value) => localStorage.setItem(PROJECT_PREFIX + key, value),
    removeItem: (key) => localStorage.removeItem(PROJECT_PREFIX + key)
};
