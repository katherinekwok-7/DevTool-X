const PROVIDER_LABELS = {
  doubao: '豆包',
  claude: 'Claude',
  codex: 'Codex / OpenAI'
}

const AUTH_SOURCE_LABELS = {
  'manual-key': '手动填写 Key',
  'manual-base-url': '手动填写 Base URL',
  env: '当前进程环境变量',
  'shell-profile': 'shell 配置文件',
  'codex-auth.json': '~/.codex/auth.json',
  'codex-config.toml': '~/.codex/config.toml',
  default: '默认值',
  none: '未检测到'
}

window.addEventListener('DOMContentLoaded', initApp)

function $(id) {
  return document.getElementById(id)
}

async function initApp() {
  bindEvents()
  await loadAppMeta()
  await refreshSettings()
  await refreshAuthStatus()
}

function bindEvents() {
  $('openSettingsBtn').addEventListener('click', () => toggleSettings(true))
  $('closeSettingsBtn').addEventListener('click', () => toggleSettings(false))
  $('saveSettingsBtn').addEventListener('click', saveSettings)
  $('revealSettingsBtn').addEventListener('click', revealSettingsPath)
  $('refreshAuthBtn').addEventListener('click', refreshAuthStatus)

  const watchedInputs = [
    'providerSelect',
    'doubaoModel',
    'doubaoKey',
    'doubaoBaseUrl',
    'claudeModel',
    'claudeKey',
    'claudeBaseUrl',
    'codexModel',
    'codexKey',
    'codexBaseUrl'
  ]

  for (const id of watchedInputs) {
    $(id).addEventListener(id === 'providerSelect' ? 'change' : 'input', updateSettingsSummary)
  }

  $('genCodeBtn').addEventListener('click', () => {
    runAction({
      buttonId: 'genCodeBtn',
      outputId: 'codeOutput',
      pendingMessage: '正在生成代码...',
      request: () => window.devtool.generateCode($('codeInput').value)
    })
  })

  $('genEnvBtn').addEventListener('click', () => {
    runAction({
      buttonId: 'genEnvBtn',
      outputId: 'envOutput',
      pendingMessage: '正在生成环境脚本...',
      request: () => window.devtool.generateEnvScript($('envInput').value)
    })
  })

  $('diagnoseBtn').addEventListener('click', () => {
    runAction({
      buttonId: 'diagnoseBtn',
      outputId: 'errorOutput',
      pendingMessage: '正在分析日志...',
      request: () => window.devtool.diagnoseError($('errorInput').value)
    })
  })

  $('genDocBtn').addEventListener('click', () => {
    runAction({
      buttonId: 'genDocBtn',
      outputId: 'docOutput',
      pendingMessage: '正在生成文档...',
      request: () => window.devtool.generateDocument($('docInput').value)
    })
  })
}

async function loadAppMeta() {
  try {
    const meta = await window.devtool.getAppMeta()
    $('appMetaText').textContent = `${meta.name} v${meta.version} · ${meta.platform}`
    $('settingsPathText').textContent = `设置文件：${meta.settingsPath}`
  } catch (error) {
    $('appMetaText').textContent = 'DevTool X'
    $('settingsPathText').textContent = '设置文件路径读取失败'
  }
}

async function refreshSettings() {
  try {
    const settings = await window.devtool.getSettings()
    fillSettingsForm(settings)
    updateSettingsSummary()
    const provider = PROVIDER_LABELS[settings.provider] || settings.provider
    setStatus(`已加载本地设置，当前提供商为 ${provider}。`, 'success')
  } catch (error) {
    setStatus(`读取设置失败：${error.message}`, 'error')
  }
}

async function refreshAuthStatus() {
  try {
    const status = await window.devtool.getAuthStatus()
    $('authStatusText').textContent = formatAuthStatus(status)
  } catch (error) {
    $('authStatusText').textContent = `检测失败：${error.message}`
  }
}

function formatAuthStatus(status) {
  return Object.values(status).map((item) => {
    const authSource = AUTH_SOURCE_LABELS[item.authSource] || item.authSource
    const baseUrlSource = AUTH_SOURCE_LABELS[item.baseUrlSource] || item.baseUrlSource
    const availability = item.available ? '可用' : '未检测到密钥'
    return [
      `${item.label}: ${availability}`,
      `  Key 来源: ${authSource}`,
      `  Base URL 来源: ${baseUrlSource}`,
      `  模型: ${item.model}`,
      `  Endpoint: ${item.endpoint}`
    ].join('\n')
  }).join('\n\n')
}

function fillSettingsForm(settings) {
  $('providerSelect').value = settings.provider || 'doubao'
  $('doubaoModel').value = settings.models?.doubao || 'doubao-pro'
  $('claudeModel').value = settings.models?.claude || 'claude-sonnet-4-20250514'
  $('codexModel').value = settings.models?.codex || 'gpt-5-codex'

  $('doubaoKey').value = settings.apiKeys?.doubao || ''
  $('claudeKey').value = settings.apiKeys?.claude || ''
  $('codexKey').value = settings.apiKeys?.codex || ''

  $('doubaoBaseUrl').value = settings.baseUrls?.doubao || ''
  $('claudeBaseUrl').value = settings.baseUrls?.claude || ''
  $('codexBaseUrl').value = settings.baseUrls?.codex || ''
}

function collectSettings() {
  return {
    provider: $('providerSelect').value,
    apiKeys: {
      doubao: $('doubaoKey').value,
      claude: $('claudeKey').value,
      codex: $('codexKey').value
    },
    baseUrls: {
      doubao: $('doubaoBaseUrl').value,
      claude: $('claudeBaseUrl').value,
      codex: $('codexBaseUrl').value
    },
    models: {
      doubao: $('doubaoModel').value || 'doubao-pro',
      claude: $('claudeModel').value || 'claude-sonnet-4-20250514',
      codex: $('codexModel').value || 'gpt-5-codex'
    }
  }
}

async function saveSettings() {
  const button = $('saveSettingsBtn')
  setButtonBusy(button, true)
  setStatus('正在保存设置...', 'loading')

  try {
    const settings = await window.devtool.saveSettings(collectSettings())
    fillSettingsForm(settings)
    updateSettingsSummary()
    await refreshAuthStatus()
    setStatus('设置已保存。手动填写的 Key / Base URL 会优先于自动检测。', 'success')
    toggleSettings(false)
  } catch (error) {
    setStatus(`保存设置失败：${error.message}`, 'error')
  } finally {
    setButtonBusy(button, false)
  }
}

async function revealSettingsPath() {
  try {
    await window.devtool.revealSettingsPath()
    setStatus('已定位到本地设置文件。', 'success')
  } catch (error) {
    setStatus(`打开设置文件失败：${error.message}`, 'error')
  }
}

async function runAction({ buttonId, outputId, pendingMessage, request }) {
  const button = $(buttonId)
  const output = $(outputId)

  setButtonBusy(button, true)
  setStatus(pendingMessage, 'loading')
  output.textContent = ''

  try {
    const result = await request()
    if (result.ok) {
      output.textContent = result.content
      const metaSuffix = result.meta?.provider ? ` (${PROVIDER_LABELS[result.meta.provider] || result.meta.provider} / ${result.meta.model})` : ''
      setStatus(`执行完成${metaSuffix}。`, 'success')
      return
    }

    output.textContent = result.error
    setStatus(result.error, 'error')
  } catch (error) {
    output.textContent = error.message
    setStatus(`执行失败：${error.message}`, 'error')
  } finally {
    setButtonBusy(button, false)
  }
}

function toggleSettings(visible) {
  $('settingsPanel').classList.toggle('hidden', !visible)
}

function updateSettingsSummary() {
  const provider = $('providerSelect').value
  const providerName = PROVIDER_LABELS[provider]
  const keyInputMap = {
    doubao: 'doubaoKey',
    claude: 'claudeKey',
    codex: 'codexKey'
  }
  const baseUrlInputMap = {
    doubao: 'doubaoBaseUrl',
    claude: 'claudeBaseUrl',
    codex: 'codexBaseUrl'
  }
  const modelInputMap = {
    doubao: 'doubaoModel',
    claude: 'claudeModel',
    codex: 'codexModel'
  }

  const hasManualKey = Boolean($(keyInputMap[provider]).value.trim())
  const hasManualBaseUrl = Boolean($(baseUrlInputMap[provider]).value.trim())
  const model = $(modelInputMap[provider]).value.trim()

  $('settingsSummary').textContent = hasManualKey
    ? `当前提供商：${providerName}。已填写手动 Key${hasManualBaseUrl ? '，并覆盖了 Base URL。' : '。'}`
    : `当前提供商：${providerName}。未填写手动 Key，将尝试使用自动检测或默认配置。`

  if (provider === 'doubao') {
    $('providerHint').textContent = `豆包当前模型为 ${model || 'doubao-pro'}。支持手动 Key / Base URL，也支持从 DOUBAO_* 或 ARK_* 环境变量读取。`
    return
  }

  if (provider === 'claude') {
    $('providerHint').textContent = `Claude 当前模型为 ${model || 'claude-sonnet-4-20250514'}。支持手动 Key，也会尝试从 ANTHROPIC_* 环境变量或 shell profile 中读取 ai-forge login 写入的配置。`
    return
  }

  $('providerHint').textContent = `Codex / OpenAI 当前模型为 ${model || 'gpt-5-codex'}。支持手动 Key，也会尝试从 OPENAI_* 环境变量以及 ai-forge login -p codex 写入的 ~/.codex/auth.json 与 ~/.codex/config.toml 自动读取。`
}

function setStatus(message, tone) {
  const bar = $('statusBar')
  bar.textContent = message
  bar.dataset.tone = tone
}

function setButtonBusy(button, busy) {
  if (!button.dataset.label) {
    button.dataset.label = button.textContent
  }

  button.disabled = busy
  button.textContent = busy ? '处理中...' : button.dataset.label
}
