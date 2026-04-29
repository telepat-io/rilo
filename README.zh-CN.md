<p align="center"><img src="./rilo-logo.webp" width="128" alt="Rilo"></p>
<h1 align="center">Rilo</h1>
<hr>
<p align="center"><em>从故事到屏幕。</em></p>

<p align="center">
  <a href="https://docs.telepat.io/rilo">📖 文档</a>
  · <a href="./README.md">🇺🇸 English</a>
  · <a href="./README.zh-CN.md">🇨🇳 简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/telepat-io/rilo/actions/workflows/ci.yml"><img src="https://github.com/telepat-io/rilo/actions/workflows/ci.yml/badge.svg?branch=main" alt="Build"></a>
  <a href="https://codecov.io/gh/telepat-io/rilo"><img src="https://codecov.io/gh/telepat-io/rilo/graph/badge.svg" alt="Codecov"></a>
  <a href="https://www.npmjs.com/package/@telepat/rilo"><img src="https://img.shields.io/npm/v/@telepat/rilo" alt="npm"></a>
  <a href="https://github.com/telepat-io/rilo/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="License"></a>
</p>

故事优先的竖屏视频生成工具。

Rilo 将一个故事转化为完整的短视频流水线：脚本生成、配音生成、关键帧生成、视频片段生成、最终合成，以及可选的字幕对齐与烧录。

## 它能解决什么问题

Rilo 专为创作者和团队打造，支持大规模、可复现的高质量短视频生产。

- 一条命令将纯文本故事转换为成品竖屏视频。
- 通过检查点运行和定向重新生成实现快速迭代。
- 选择模型并覆盖每模型选项，获得完全的创意控制。
- 输出到本地磁盘或 Firebase，便于团队协作。
- 通过 CLI、API 或 worker 运行，适配生产流水线。

## 快速开始

环境要求：Node.js 22+、PATH 中有 ffmpeg、Replicate API token。

```bash
npm install -g @telepat/rilo
rilo settings
rilo --project demo --story-file ./story.txt
```

预期结果：

- 在 `projects/demo/` 下创建项目文件夹。
- 完整流水线依次运行脚本、配音、关键帧、片段和合成。
- 最终视频写入 `projects/demo/final.mp4`。
- 可通过 `rilo preview` 打开仪表板预览。

## 环境要求

- Node.js 22+
- PATH 中有 ffmpeg
- Replicate API token
- macOS、Linux 或 Windows

## 工作原理

Rilo 运行分阶段流水线：脚本生成、语音合成、镜头提示生成、关键帧渲染、片段生成和最终视频合成。每个阶段都会写入检查点产物，因此你可以恢复或有选择地重新生成。

配置会合并 CLI 标志、环境变量和 `~/.rilo/config.json`，并以模式默认值兜底。预览仪表板（`rilo preview`）启动本地 API、worker 和 Vite React 前端，用于监控和编辑。

## 与 AI Agent 一起使用

Rilo 为智能体和自动化工作流提供多种接口：

- **CLI 自动化** — 所有生成均由 CLI 标志和环境变量驱动。初始设置后无需交互式提示。
- **HTTP API** — `rilo preview` 启动 Express API，提供完整的 job 和 project CRUD、资源服务和 webhook 端点。通过 `Authorization: Bearer <API_BEARER_TOKEN>` 进行 Bearer token 认证。
- **OpenAPI 规范** — 自动生成 OpenAPI 3.1 规范，支持基于模式的智能体集成。
- **Webhook** — 订阅 job 生命周期事件，用于外部编排。
- **Firebase Functions** — 部署 `src/api/firebaseFunction.js` 实现无服务器 API 托管。
- **Agent 文档** — [API 参考](https://docs.telepat.io/rilo/reference/api-reference) 涵盖端点、认证和 webhook。

## 安全与信任

- API token 和 Replicate 凭证在 OS 密钥库可用时保存（macOS Keychain、Windows Credential Manager、Linux Secret Service）。
- 如果无原生密钥库可用，则回退到 `~/.rilo/.secrets` 的 AES-256 加密文件。
- 环境变量（`RILO_REPLICATE_API_TOKEN`、`RILO_API_BEARER_TOKEN`）优先级最高，会覆盖已存储的值。
- Preview `--expose` 模式应仅在可信网络或隔离环境中使用。

## 文档与支持

- [文档站点](https://docs.telepat.io/rilo)
- [快速上手](https://docs.telepat.io/rilo/getting-started/quickstart)
- [CLI 参考](https://docs.telepat.io/rilo/reference/cli-reference)
- [配置指南](https://docs.telepat.io/rilo/guides/configuration)
- [API 参考](https://docs.telepat.io/rilo/reference/api-reference)
- [故障排查](https://docs.telepat.io/rilo/guides/troubleshooting)
- 语言支持：English 与 简体中文
- [仓库](https://github.com/telepat-io/rilo)
- [npm 包](https://www.npmjs.com/package/@telepat/rilo)

## 贡献

欢迎贡献。请参阅[开发指南](https://docs.telepat.io/rilo/contributing/development)了解本地环境搭建、构建命令和测试工作流。

## 许可证

MIT。详见 [LICENSE](./LICENSE)。
