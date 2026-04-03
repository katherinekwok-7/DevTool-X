const axios = require('axios')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')

const PROVIDER_LABELS = {
  doubao: '豆包',
  claude: 'Claude',
  codex: 'Codex'
}

const DEFAULTS = {
  doubao: {
    model: 'doubao-pro',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions'
  },
  claude: {
    model: 'claude-sonnet-4-20250514',
    endpoint: 'https://api.anthropic.com/v1/messages'
  },
  codex: {
    model: 'gpt-5-codex',
    endpoint: 'https://api.openai.com/v1/responses'
  }
}

let shellProfileCache = null

function ok(content, meta = {}) {
  return {
    ok: true,
    content,
    meta
  }
}

function fail(error, meta = {}) {
  return {
    ok: false,
    error,
    meta
  }
}

function providerLabel(provider) {
  return PROVIDER_LABELS[provider] || provider
}

function requireText(value, fieldLabel) {
  if (!value || !value.trim()) {
    return fail(`请输入${fieldLabel}。`)
  }

  return null
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function normalizeEndpoint(baseUrl, fallbackUrl) {
  const cleanBase = typeof baseUrl === 'string' ? baseUrl.trim() : ''
  if (!cleanBase) {
    return fallbackUrl
  }

  if (/\/chat\/completions$/i.test(cleanBase) || /\/v1\/messages$/i.test(cleanBase) || /\/v1\/responses$/i.test(cleanBase)) {
    return cleanBase
  }

  if (fallbackUrl.endsWith('/chat/completions')) {
    return `${cleanBase.replace(/\/+$/, '')}/api/v3/chat/completions`
  }

  if (fallbackUrl.endsWith('/v1/messages')) {
    if (/\/v1$/i.test(cleanBase)) {
      return `${cleanBase.replace(/\/+$/, '')}/messages`
    }
    return `${cleanBase.replace(/\/+$/, '')}/v1/messages`
  }

  if (fallbackUrl.endsWith('/v1/responses')) {
    if (/\/v1$/i.test(cleanBase)) {
      return `${cleanBase.replace(/\/+$/, '')}/responses`
    }
    return `${cleanBase.replace(/\/+$/, '')}/v1/responses`
  }

  return cleanBase
}

function formatAxiosError(error) {
  if (error.response) {
    const detail = typeof error.response.data === 'string'
      ? error.response.data
      : JSON.stringify(error.response.data)
    return `AI接口调用失败（HTTP ${error.response.status}）：${detail}`
  }

  if (error.code === 'ECONNABORTED') {
    return 'AI接口调用超时，请稍后再试。'
  }

  return `AI接口调用失败：${error.message}`
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') {
      return ''
    }
    return ''
  }
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    return null
  }
}

function extractQuotedValue(text, key) {
  const patterns = [
    new RegExp(`\\$env:${key}\\s*=\\s*['\"]([^'\"]+)['\"]`, 'i'),
    new RegExp(`export\\s+${key}=['\"]([^'\"]+)['\"]`, 'i'),
    new RegExp(`set\\s+-gx\\s+${key}\\s+['\"]([^'\"]+)['\"]`, 'i')
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }

  return ''
}

async function loadShellProfileEnv() {
  if (shellProfileCache) {
    return shellProfileCache
  }

  const home = os.homedir()
  const candidates = [
    path.join(home, '.bashrc'),
    path.join(home, '.bash_profile'),
    path.join(home, '.zshrc'),
    path.join(home, '.config', 'fish', 'config.fish'),
    path.join(home, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'),
    path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1')
  ]

  const envMap = {}
  for (const filePath of candidates) {
    const content = await readTextIfExists(filePath)
    if (!content) {
      continue
    }

    for (const key of ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'OPENAI_API_KEY', 'OPENAI_BASE_URL']) {
      if (!envMap[key]) {
        envMap[key] = extractQuotedValue(content, key)
      }
    }
  }

  shellProfileCache = envMap
  return shellProfileCache
}

function parseTomlSectionValue(toml, sectionName, key) {
  if (!toml) {
    return ''
  }

  const lines = toml.split(/\r?\n/)
  let inTargetSection = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      inTargetSection = trimmed === `[${sectionName}]`
      continue
    }

    if (!inTargetSection) {
      continue
    }

    const valueMatch = trimmed.match(new RegExp(`^${key}\\s*=\\s*['\"]([^'\"]+)['\"]`))
    if (valueMatch) {
      return valueMatch[1].trim()
    }
  }

  return ''
}

function parseTomlTopLevelValue(toml, key) {
  if (!toml) {
    return ''
  }

  const valueRegex = new RegExp(`^\\s*${key}\\s*=\\s*['\"]([^'\"]+)['\"]`, 'm')
  const valueMatch = toml.match(valueRegex)
  return valueMatch ? valueMatch[1].trim() : ''
}

async function resolveProviderConfig(provider, settings) {
  const shellEnv = await loadShellProfileEnv()
  const manualKey = settings?.apiKeys?.[provider]?.trim() || ''
  const manualBaseUrl = settings?.baseUrls?.[provider]?.trim() || ''
  const manualModel = settings?.models?.[provider]?.trim() || ''

  if (provider === 'doubao') {
    const envKey = firstNonEmpty(process.env.DOUBAO_API_KEY, process.env.ARK_API_KEY)
    const envBaseUrl = firstNonEmpty(process.env.DOUBAO_BASE_URL, process.env.ARK_BASE_URL)
    const envModel = firstNonEmpty(process.env.DOUBAO_MODEL, process.env.ARK_MODEL)

    return {
      provider,
      apiKey: firstNonEmpty(manualKey, envKey),
      baseUrl: normalizeEndpoint(firstNonEmpty(manualBaseUrl, envBaseUrl), DEFAULTS.doubao.endpoint),
      model: firstNonEmpty(manualModel, envModel, DEFAULTS.doubao.model),
      authSource: manualKey ? 'manual-key' : envKey ? 'env' : 'none',
      baseUrlSource: manualBaseUrl ? 'manual-base-url' : envBaseUrl ? 'env' : 'default'
    }
  }

  if (provider === 'claude') {
    const envKey = firstNonEmpty(process.env.ANTHROPIC_API_KEY, shellEnv.ANTHROPIC_API_KEY)
    const envBaseUrl = firstNonEmpty(process.env.ANTHROPIC_BASE_URL, shellEnv.ANTHROPIC_BASE_URL)

    return {
      provider,
      apiKey: firstNonEmpty(manualKey, envKey),
      baseUrl: normalizeEndpoint(firstNonEmpty(manualBaseUrl, envBaseUrl), DEFAULTS.claude.endpoint),
      model: firstNonEmpty(manualModel, DEFAULTS.claude.model),
      authSource: manualKey ? 'manual-key' : process.env.ANTHROPIC_API_KEY ? 'env' : shellEnv.ANTHROPIC_API_KEY ? 'shell-profile' : 'none',
      baseUrlSource: manualBaseUrl ? 'manual-base-url' : process.env.ANTHROPIC_BASE_URL ? 'env' : shellEnv.ANTHROPIC_BASE_URL ? 'shell-profile' : 'default'
    }
  }

  if (provider === 'codex') {
    const codexAuth = await readJsonIfExists(path.join(os.homedir(), '.codex', 'auth.json'))
    const codexConfig = await readTextIfExists(path.join(os.homedir(), '.codex', 'config.toml'))
    const fileKey = codexAuth?.OPENAI_API_KEY || ''
    const fileBaseUrl = parseTomlSectionValue(codexConfig, 'model_providers.OpenAI', 'base_url')
    const fileModel = parseTomlTopLevelValue(codexConfig, 'model')
    const envKey = firstNonEmpty(process.env.OPENAI_API_KEY, shellEnv.OPENAI_API_KEY)
    const envBaseUrl = firstNonEmpty(process.env.OPENAI_BASE_URL, shellEnv.OPENAI_BASE_URL)

    return {
      provider,
      apiKey: firstNonEmpty(manualKey, envKey, fileKey),
      baseUrl: normalizeEndpoint(firstNonEmpty(manualBaseUrl, envBaseUrl, fileBaseUrl), DEFAULTS.codex.endpoint),
      model: firstNonEmpty(manualModel, fileModel, DEFAULTS.codex.model),
      authSource: manualKey ? 'manual-key' : process.env.OPENAI_API_KEY ? 'env' : shellEnv.OPENAI_API_KEY ? 'shell-profile' : fileKey ? 'codex-auth.json' : 'none',
      baseUrlSource: manualBaseUrl ? 'manual-base-url' : process.env.OPENAI_BASE_URL ? 'env' : shellEnv.OPENAI_BASE_URL ? 'shell-profile' : fileBaseUrl ? 'codex-config.toml' : 'default'
    }
  }

  return {
    provider,
    apiKey: '',
    baseUrl: '',
    model: '',
    authSource: 'none',
    baseUrlSource: 'default'
  }
}

async function getAuthStatus(settings) {
  const statuses = {}
  for (const provider of Object.keys(PROVIDER_LABELS)) {
    const config = await resolveProviderConfig(provider, settings)
    statuses[provider] = {
      provider,
      label: providerLabel(provider),
      available: Boolean(config.apiKey),
      authSource: config.authSource,
      baseUrlSource: config.baseUrlSource,
      model: config.model,
      endpoint: config.baseUrl
    }
  }

  return statuses
}

async function callDoubao(systemPrompt, userPrompt, config) {
  try {
    const res = await axios.post(config.baseUrl, {
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1
    }, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    })

    const content = res.data?.choices?.[0]?.message?.content
    if (!content || typeof content !== 'string') {
      return fail('豆包返回格式异常，请检查模型配置。')
    }

    return ok(content.trim(), { provider: 'doubao', model: config.model })
  } catch (error) {
    return fail(formatAxiosError(error))
  }
}

async function callClaude(systemPrompt, userPrompt, config) {
  try {
    const res = await axios.post(config.baseUrl, {
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ]
    }, {
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      timeout: 60000
    })

    const parts = Array.isArray(res.data?.content) ? res.data.content : []
    const content = parts
      .filter((item) => item?.type === 'text' && item.text)
      .map((item) => item.text)
      .join('\n\n')

    if (!content) {
      return fail('Claude 返回格式异常，请检查模型配置。')
    }

    return ok(content.trim(), { provider: 'claude', model: config.model })
  } catch (error) {
    return fail(formatAxiosError(error))
  }
}

function extractOpenAIText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }

  const outputs = Array.isArray(data?.output) ? data.output : []
  const chunks = []
  for (const item of outputs) {
    const content = Array.isArray(item?.content) ? item.content : []
    for (const block of content) {
      if ((block?.type === 'output_text' || block?.type === 'text') && block.text) {
        chunks.push(block.text)
      }
    }
  }

  return chunks.join('\n\n').trim()
}

async function callCodex(systemPrompt, userPrompt, config) {
  try {
    const res = await axios.post(config.baseUrl, {
      model: config.model,
      input: [
        {
          role: 'developer',
          content: [
            {
              type: 'input_text',
              text: systemPrompt
            }
          ]
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: userPrompt
            }
          ]
        }
      ],
      reasoning: {
        effort: 'medium'
      }
    }, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000
    })

    const content = extractOpenAIText(res.data)
    if (!content) {
      return fail('Codex / OpenAI 返回格式异常，请检查模型或网关配置。')
    }

    return ok(content, { provider: 'codex', model: config.model })
  } catch (error) {
    return fail(formatAxiosError(error))
  }
}

async function callAI(systemPrompt, userPrompt, settings) {
  const provider = settings?.provider || 'doubao'
  const config = await resolveProviderConfig(provider, settings)

  if (!config.apiKey) {
    if (provider === 'codex') {
      return fail('请先在“连接设置”里填写 Codex / OpenAI Key，或先执行 ai-forge login -p codex。')
    }

    if (provider === 'claude') {
      return fail('请先在“连接设置”里填写 Claude Key，或先通过 ai-forge login / ANTHROPIC_* 环境变量完成登录。')
    }

    return fail(`请先在“连接设置”里填写 ${providerLabel(provider)} 的 API Key。`)
  }

  if (provider === 'doubao') {
    return callDoubao(systemPrompt, userPrompt, config)
  }

  if (provider === 'claude') {
    return callClaude(systemPrompt, userPrompt, config)
  }

  if (provider === 'codex') {
    return callCodex(systemPrompt, userPrompt, config)
  }

  return fail('当前提供商配置无效，请重新选择。')
}

async function generateCode(prompt, settings) {
  const validation = requireText(prompt, '代码需求')
  if (validation) {
    return validation
  }

  return callAI(
    '你是资深跨语言开发助手。支持 C、C++、Rust、Go、Java、Python、JavaScript、TypeScript、C#、Shell 以及其他主流语言。根据用户需求生成可直接运行或可直接集成的代码；如果用户指定语言、标准、框架、操作系统、构建工具、库版本，必须严格遵循；如果用户没有指定语言，则选择最适合任务的主流语言。默认只输出代码，除非用户明确要求解释。',
    prompt.trim(),
    settings
  )
}

async function diagnoseError(log, settings) {
  const validation = requireText(log, '报错日志')
  if (validation) {
    return validation
  }

  return callAI(
    '你是专业调试专家。分析报错根因，给出可执行的修复步骤；如果日志涉及环境、依赖、版本、平台差异，要明确指出；尽量输出清晰的排查顺序。',
    `请分析这个报错，并给出修复方案：\n\n${log.trim()}`,
    settings
  )
}

async function generateEnvScript(config, settings) {
  const validation = requireText(config, '环境需求')
  if (validation) {
    return validation
  }

  return callAI(
    '你是跨平台环境自动化专家。用户会描述目标操作系统、发行版、版本、shell、架构、包管理器以及希望安装的语言或工具链。请根据这些信息生成尽可能幂等、可执行的环境初始化脚本。如果关键信息缺失，先在脚本顶部用注释写出你的关键假设，再给出脚本。Linux 或 macOS 默认输出 bash，Windows 默认输出 PowerShell；如果用户指定 shell，必须严格遵循。除脚本和必要注释外，不要输出额外解释。',
    config.trim(),
    settings
  )
}

async function generateDocument(prompt, settings) {
  const validation = requireText(prompt, '文档需求')
  if (validation) {
    return validation
  }

  return callAI(
    '你是技术写作助手。根据用户要求生成专业、结构清晰、适合直接使用的技术文档、README、周报或方案说明。',
    prompt.trim(),
    settings
  )
}

module.exports = {
  generateCode,
  diagnoseError,
  generateEnvScript,
  generateDocument,
  getAuthStatus
}
