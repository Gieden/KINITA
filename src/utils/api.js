// src/utils/api.js

export const getApiBase = () => {
    let savedServer = localStorage.getItem('kinita_server_ip');

    // 1. Forced Satellite Mode
    if (savedServer) {
        // Ensure we don't double up on http://
        savedServer = savedServer.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
        return `http://${savedServer}/kinita/public/api`;
    }

    // 2. Native Web Mode
    if (!window.electronAPI) {
        return '/kinita/public/api';
    }

    // 3. Electron Sync Mode
    if (localStorage.getItem('kinita_sync_mode') === 'mysql') {
        return 'http://localhost/kinita/public/api';
    }

    // 4. Default Fallback for Electron Master/Hybrid
    if (window.electronAPI) {
        return 'http://localhost/kinita/public/api';
    }

    return null;
};

export const fetchApi = async (endpoint, options = {}) => {
    const apiBase = getApiBase();
    if (apiBase) {
        const url = endpoint.startsWith('http') ? endpoint : `${apiBase}/${endpoint}`;
        return await fetch(url, options);
    }
    throw new Error("No remote API base configured. Use local handlers.");
};
