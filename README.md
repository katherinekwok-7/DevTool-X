# DevTool X

一个基于 Electron 的桌面版 AI 开发效率工具，当前包含 4 个核心工作流：

- 任意语言代码生成
- 跨平台环境脚本生成
- 报错日志排查
- 技术文档 / 周报 / README 生成

## 当前能力

- 支持 3 个提供商：豆包、Claude、Codex / OpenAI
- 支持手动填写 API Key / Base URL / 模型
- 支持部分自动检测登录态：
  - Claude: `ANTHROPIC_*` 环境变量，以及 shell profile 中由 `ai-forge login` 写入的配置
  - Codex / OpenAI: `OPENAI_*` 环境变量，以及 `ai-forge login -p codex` 写入的 `~/.codex/auth.json` 和 `~/.codex/config.toml`
- 环境脚本生成功能改为自由描述输入，不再限制固定模板
- 已内置 GitHub Actions，可在 GitHub 上构建 Windows / macOS / Linux 安装包

## 本地启动

先安装依赖：

```bash
npm install
```

再启动应用：

```bash
npm start
```

启动后点击右上角“连接设置”：

- 如果你想手动管理密钥，直接填写对应提供商的 Key / Base URL / 模型
- 如果你已经执行过 `ai-forge login -p codex`，Codex 通常会自动检测 `~/.codex` 下的配置
- 如果你已经执行过 `ai-forge login` 并让 `ANTHROPIC_*` 写入 shell profile，Claude 在部分环境下也可自动检测

## 打包命令

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

说明：

- `build:win` 生成 NSIS 安装包
- `build:mac` 生成 DMG
- `build:linux` 同时生成 `AppImage` 和 `deb`
- 打包产物默认输出到 `dist/`

## GitHub Actions 多平台构建

项目已包含工作流文件：

- `.github/workflows/build.yml`

上传到 GitHub 后：

1. push 到 `main` 或 `master` 分支，会自动构建三平台产物并上传为 Actions artifacts
2. 打 tag，例如 `v1.0.0`，会在构建完成后自动把安装包发布到 GitHub Release

## 关于 ai-forge login

推荐理解为两种登录方式并存：

1. UI 手动填写
   - 适合单机快速使用
   - 手动填写的 Key / Base URL 优先级最高

2. `ai-forge login`
   - 对 Codex，`ai-forge login -p codex` 会写入 `~/.codex/auth.json` 和 `~/.codex/config.toml`，应用会自动尝试读取
   - 对 Claude，应用会优先读取当前进程环境变量，也会尝试解析常见 shell profile 中写入的 `ANTHROPIC_*` 变量

## 后续建议

- 如果要正式对外发布，最好把第三方 AI 请求迁移到你自己的后端服务，避免把终端侧 Key 直接暴露给最终用户
- 如果要继续做产品化发布，建议再补正式图标、签名证书、自动更新和设置页验证逻辑
