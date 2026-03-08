const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    checkSeal: () => ipcRenderer.invoke('check-seal'),
    initDb: () => ipcRenderer.invoke('init-db'),
    login: (credentials) => ipcRenderer.invoke('login', credentials),
    registerOwner: (data) => ipcRenderer.invoke('register-owner', data),
    getStaff: () => ipcRenderer.invoke('get-staff'),
    addStaff: (data) => ipcRenderer.invoke('add-staff', data),
    getEnrolledUsers: () => ipcRenderer.invoke('get-enrolled-users'),
    resetDb: () => ipcRenderer.invoke('reset-db'),

    // Inventory APIs
    getProducts: () => ipcRenderer.invoke('get-products'),
    addProduct: (data) => ipcRenderer.invoke('add-product', data),
    addStock: (data) => ipcRenderer.invoke('add-stock', data),
    processTransaction: (data) => ipcRenderer.invoke('process-transaction', data),

    isElectron: true
});
