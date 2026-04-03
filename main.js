const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { generateCode, diagnoseError, generateEnvScript, generateDocument, getAuthStatus } = require('./api/aiClient')
const { loadSettings, saveSettings, getSettingsPath } = require('./configStore')

let win

function createWindow() {
  if (win && !win.isDestroyed()) {
    win.focus()
    return
  }

  win = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 1024,
    minHeight: 760,
    autoHideMenuBar: true,
    title: 'DevTool X',
    backgroundColor: '#f3efe7',
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  win.on('closed', () => {
    win = null
  })

  win.loadFile(path.join(__dirname, 'index.html'))
}

async function runTask(handler, payload) {
  const settings = await loadSettings()
  return handler(payload, settings)
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.devtool.x')
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('settings:get', async () => {
  return loadSettings()
})

ipcMain.handle('settings:save', async (_event, nextSettings) => {
  return saveSettings(nextSettings)
})

ipcMain.handle('settings:reveal', async () => {
  await shell.showItemInFolder(getSettingsPath())
  return true
})

ipcMain.handle('auth:get-status', async () => {
  const settings = await loadSettings()
  return getAuthStatus(settings)
})

ipcMain.handle('app:get-meta', async () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    settingsPath: getSettingsPath(),
    platform: process.platform
  }
})

ipcMain.handle('ai:generate', async (_event, prompt) => {
  return runTask(generateCode, prompt)
})

ipcMain.handle('ai:diagnose', async (_event, log) => {
  return runTask(diagnoseError, log)
})

ipcMain.handle('ai:env', async (_event, config) => {
  return runTask(generateEnvScript, config)
})

ipcMain.handle('ai:doc', async (_event, prompt) => {
  return runTask(generateDocument, prompt)
})
