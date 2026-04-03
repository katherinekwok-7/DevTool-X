const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('devtool', {
  getAppMeta: () => ipcRenderer.invoke('app:get-meta'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  revealSettingsPath: () => ipcRenderer.invoke('settings:reveal'),
  getAuthStatus: () => ipcRenderer.invoke('auth:get-status'),
  generateCode: (prompt) => ipcRenderer.invoke('ai:generate', prompt),
  diagnoseError: (log) => ipcRenderer.invoke('ai:diagnose', log),
  generateEnvScript: (config) => ipcRenderer.invoke('ai:env', config),
  generateDocument: (prompt) => ipcRenderer.invoke('ai:doc', prompt)
})
