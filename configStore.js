const { app } = require('electron')
const fs = require('fs/promises')
const path = require('path')

const SUPPORTED_PROVIDERS = ['doubao', 'claude', 'codex']

const DEFAULT_SETTINGS = Object.freeze({
  provider: 'doubao',
  apiKeys: {
    doubao: '',
    claude: '',
    codex: ''
  },
  baseUrls: {
    doubao: '',
    claude: '',
    codex: ''
  },
  models: {
    doubao: 'doubao-pro',
    claude: 'claude-sonnet-4-20250514',
    codex: 'gpt-5-codex'
  }
})

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function normalizeSettings(input = {}) {
  const defaults = cloneDefaults()
  const normalized = {
    provider: SUPPORTED_PROVIDERS.includes(input.provider) ? input.provider : defaults.provider,
    apiKeys: { ...defaults.apiKeys },
    baseUrls: { ...defaults.baseUrls },
    models: { ...defaults.models }
  }

  const inputApiKeys = input.apiKeys || {}
  for (const provider of Object.keys(normalized.apiKeys)) {
    normalized.apiKeys[provider] = typeof inputApiKeys[provider] === 'string'
      ? inputApiKeys[provider].trim()
      : defaults.apiKeys[provider]
  }

  const inputBaseUrls = input.baseUrls || {}
  for (const provider of Object.keys(normalized.baseUrls)) {
    normalized.baseUrls[provider] = typeof inputBaseUrls[provider] === 'string'
      ? inputBaseUrls[provider].trim()
      : defaults.baseUrls[provider]
  }

  const inputModels = input.models || {}
  for (const provider of Object.keys(normalized.models)) {
    normalized.models[provider] = typeof inputModels[provider] === 'string' && inputModels[provider].trim()
      ? inputModels[provider].trim()
      : defaults.models[provider]
  }

  return normalized
}

async function loadSettings() {
  try {
    const raw = await fs.readFile(getSettingsPath(), 'utf8')
    return normalizeSettings(JSON.parse(raw))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to load settings:', error)
    }
    return cloneDefaults()
  }
}

async function saveSettings(nextSettings) {
  const normalized = normalizeSettings(nextSettings)

  await fs.mkdir(path.dirname(getSettingsPath()), { recursive: true })
  await fs.writeFile(getSettingsPath(), JSON.stringify(normalized, null, 2), 'utf8')

  return normalized
}

module.exports = {
  DEFAULT_SETTINGS,
  getSettingsPath,
  loadSettings,
  saveSettings
}
