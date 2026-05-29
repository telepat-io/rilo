---
slug: /getting-started/installation
sidebar_position: 2
title: 安装
---

要求：
- Node.js 22+
- ffmpeg 在 PATH 中
- Replicate API 令牌

推荐安装方式：

```bash
npm install -g @telepat/rilo
```

然后交互式配置凭据：

```bash
rilo settings
```

或使用环境变量设置凭据：

```bash
TELEPAT_REPLICATE_TOKEN=...
RILO_API_BEARER_TOKEN=...
```

如果您不想全局安装，可以使用 `npx`：

```bash
npx @telepat/rilo settings
```

`rilo settings` 将安全令牌存储在操作系统密钥库中（或加密的本地后备），并将非敏感运行时设置存储在 `~/.rilo/config.json` 中。

如果您是从检出的仓库贡献代码，请参阅 [/contributing/development](/contributing/development) 了解 `npm run dev` 工作流。