---
slug: /reference/environment-variables
sidebar_position: 3
title: 环境变量
---

## 配置

Rilo 通过环境变量（从 `.env` 或系统环境）进行配置。您也可以使用 `rilo settings` 交互式管理大多数非敏感设置（请参阅 [CLI 参考](/reference/cli-reference#settings-command)）。

## API 凭据

必需：

```bash
TELEPAT_REPLICATE_TOKEN=
RILO_API_BEARER_TOKEN=
```

这些也可以通过 `rilo settings` 管理，它们会安全地存储在您的操作系统密钥库中（如果本机密钥库不可用，则存储在加密的本地文件中）。

存储和后端选择：

```bash
RILO_OUTPUT_BACKEND=local
OUTPUT_DIR=~/.rilo/output
PROJECTS_DIR=~/.rilo/projects
```

Firebase 后端：

```bash
RILO_FIREBASE_PROJECT_ID=
RILO_FIREBASE_STORAGE_BUCKET=
RILO_FIREBASE_CLIENT_EMAIL=
RILO_FIREBASE_PRIVATE_KEY=
```

运行时调优：

```bash
PREDICTION_POLL_INTERVAL_MS=1500
PREDICTION_MAX_WAIT_MS=600000
MAX_RETRIES=2
RETRY_DELAY_MS=2500
DOWNLOAD_TIMEOUT_MS=20000
DOWNLOAD_MAX_BYTES=104857600
DOWNLOAD_ALLOWED_HOSTS=replicate.delivery,replicate.com
API_PORT=3000
API_DEFAULT_LOGS_LIMIT=100
API_MAX_LOGS_LIMIT=1000
```

媒体工具：

```bash
FFMPEG_BIN=ffmpeg
FFPROBE_BIN=ffprobe
FFSUBSYNC_BIN=ffsubsync
```

如果您的部署使用了带 SECRET_ 前缀的环境变量，Rilo 支持核心凭据和后端配置的 `SECRET_*` 等效项。

## 通过 CLI 配置

上述大多数设置都可以交互式编辑（Firebase、Webhook 和 API 端口除外，它们仍仅限于环境变量）：

```bash
rilo settings
```

当您通过 `rilo settings` 保存设置时，它会存储在 `~/.rilo/config.json` 中（用于公共设置）或存储在操作系统密钥库中（用于 API 令牌）。

**优先级：**
1. **环境变量**（最高优先级——始终生效）
2. **存储的设置**（`~/.rilo/config.json` 或操作系统密钥库）
3. **模式默认值**（最低优先级）

这意味着如果您设置了环境变量，则忽略 `rilo settings` 为该变量存储的任何值。环境变量非常适合部署和 CI/CD，而设置命令则方便交互式工作站设置。

## 隐藏设置

以下设置**仅限于环境变量**，不会出现在 `rilo settings` 菜单中：
- Firebase 凭据 (`RILO_FIREBASE_*`)
- Webhook 配置 (`USE_WEBHOOKS`, `WEBHOOK_SECRET`)
- 输出后端选择 (`RILO_OUTPUT_BACKEND`)
- API 端口 (`API_PORT`)
- 自定义数据目录 (`OUTPUT_DIR`, `PROJECTS_DIR`)