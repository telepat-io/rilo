---
slug: /reference/config-schema
sidebar_position: 2
title: 完整配置模式
---

本页面记录了**项目配置** (`projects/<project>/config.json`) 和 **应用/运行时配置** (`~/.rilo/config.json` + 密钥库) 中的每个配置选项。

## 项目配置 (projects/\<project\>/config.json)

### 必需和核心字段

| 键 | 类型 | 默认值 | 备注 |
|----|------|--------|------|
| `aspectRatio` | string | `"9:16"` | `"1:1"` \| `"16:9"` \| `"9:16"` — 输出视频宽高比 |
| `targetDurationSec` | number | `60` | 目标脚本/旁白持续时间（以秒为单位）；影响节奏 |
| `finalDurationMode` | string | `"match_audio"` | `"match_audio"` \| `"match_visual"` — 如何处理最终合成持续时间 |
| `pauseAfterKeyframes` | boolean | `true` | 当为 `true` 时，管道在关键帧生成后停止以允许审查。设置为 `false` 以一次性运行所有阶段（相当于 CLI 中的 `--full-run`） |

### 关键帧尺寸

| 键 | 类型 | 默认值 | 备注 |
|----|------|--------|------|
| `keyframeWidth` | number | 自动派生 | 关键帧宽度（以像素为单位，必须与 `keyframeHeight` 配对）；≥ 512 |
| `keyframeHeight` | number | 自动派生 | 关键帧高度（以像素为单位，必须与 `keyframeWidth` 配对）；≥ 512 |

如果两者都省略，则根据 `aspectRatio` 和默认基础尺寸（例如 `9:16` → 576×1024）计算。

### 模型选择

| 键 | 类型 | 默认值 | 备注 |
|----|------|--------|------|
| `models` | object | `{}` | 将模型类别映射到所选模型 ID |
| `models.textToText` | string | 从默认值自动填充 | 脚本/镜头生成模型（例如 `"deepseek-ai/deepseek-v3"`） |
| `models.textToSpeech` | string | 从默认值自动填充 | 旁白/配音模型（例如 `"minimax/speech-02-turbo"`） |
| `models.textToImage` | string | 从默认值自动填充 | 关键帧生成模型（例如 `"prunaai/z-image-turbo"`） |
| `models.imageTextToVideo` | string | 从默认值自动填充 | 视频片段生成模型（例如 `"wan-video/wan-2.2-i2v-fast"`） |

自动填充的默认值来自 `models/<model-id>.json` 中的模型目录元数据。有关可用模型，请参阅[模型目录](/reference/model-catalog)。

### 模型选项（每个模型的参数）

| 键 | 类型 | 默认值 | 备注 |
|----|------|--------|------|
| `modelOptions` | object | `{}` | 将模型类别映射到参数覆盖 |
| `modelOptions.textToText` | object | `{}` | 脚本模型的 LLM 参数（例如 `max_tokens`、`temperature`） |
| `modelOptions.textToSpeech` | object | `{}` | 旁白模型的 TTS 参数（例如 `voice_id`、`speed`） |
| `modelOptions.textToImage` | object | `{}` | 图像生成参数（例如 `num_inference_steps`、`guidance_scale`） |
| `modelOptions.imageTextToVideo` | object | `{}` | 视频生成参数（例如 `sample_shift`、`go_fast`） |

**每个模型的有效参数：** 由模型在 `src/steps/textToImageAdapters.js`、`src/steps/imageToVideoAdapters.js` 等中的适配器定义。有关详细参数文档，请参阅[模型适配器和选项](/guides/model-adapters-and-options)。

**参数验证：** 参数在模型请求时进行验证。无效参数可能会被记录或静默忽略，具体取决于模型适配器。

**更改模型选项：** 仅使受影响阶段的缓存输出失效。

### 字幕配置（可选）

| 键 | 类型 | 默认值 | 备注 |
|----|------|--------|------|
| `subtitleOptions` | object | `undefined` | 字幕生成的主开关和样式 |
| `subtitleOptions.enabled` | boolean | `false` | 为此项目启用/禁用字幕生成 |
| `subtitleOptions.templateId` | string | `"social_center_clean"` | 预定义字幕样式模板 ID |
| `subtitleOptions.position` | string | `"center"` | `"top"` \| `"center"` \| `"bottom"` |
| `subtitleOptions.fontName` | string | `"Helvetica"` | 字体名称（系统安装）；例如 `"Arial"`、`"Helvetica"`、`"Courier"` |
| `subtitleOptions.fontSize` | number | `92` | 字体大小（以像素为单位）；通常为 80–120 适用于移动垂直视频 |
| `subtitleOptions.bold` | boolean | `false` | 应用粗体 |
| `subtitleOptions.italic` | boolean | `false` | 应用斜体样式 |
| `subtitleOptions.makeUppercase` | boolean | `false` | 将所有文本转换为大写 |
| `subtitleOptions.primaryColor` | string | `"#ffffff"` | 文本颜色，十六进制格式 |
| `subtitleOptions.activeColor` | string | `"#9ae6ff"` | 当前正在朗读的单词的高亮颜色，十六进制 |
| `subtitleOptions.outlineColor` | string | `"#111111"` | 文本轮廓/描边颜色，十六进制 |
| `subtitleOptions.backgroundEnabled` | boolean | `true` | 在文本后启用半透明背景 |
| `subtitleOptions.backgroundColor` | string | `"#000000"` | 背景颜色，十六进制 |
| `subtitleOptions.backgroundOpacity` | number | `0.45` | 背景不透明度；0.0（透明）到 1.0（不透明） |
| `subtitleOptions.outline` | number | `3` | 文本轮廓粗细（以像素为单位） |
| `subtitleOptions.shadow` | number | `0` | 文本阴影大小（以像素为单位） |
| `subtitleOptions.marginV` | number | `120` | 当 `position` 不是 `"center"` 时，距顶部/底部边缘的垂直边距 |
| `subtitleOptions.maxWordsPerLine` | number | `4` | 换行前每行的单词数 |
| `subtitleOptions.maxLines` | number | `2` | 同时显示的最大字幕行数 |
| `subtitleOptions.highlightMode` | string | `"current_only"` | 如何高亮当前正在朗读的文本；可能支持其他值 |

**注意：** 如果 `subtitleOptions.enabled` 为 `false`，则在生成期间忽略所有其他字幕字段。

### 完整项目配置示例

```json
{
  "aspectRatio": "9:16",
  "targetDurationSec": 45,
  "finalDurationMode": "match_audio",
  "keyframeWidth": 576,
  "keyframeHeight": 1024,
  "models": {
    "textToText": "deepseek-ai/deepseek-v3",
    "textToSpeech": "minimax/speech-02-turbo",
    "textToImage": "black-forest-labs/flux-2-pro",
    "imageTextToVideo": "wan-video/wan-2.2-i2v-fast"
  },
  "modelOptions": {
    "textToText": {
      "max_tokens": 2048,
      "temperature": 0.1
    },
    "textToSpeech": {
      "voice_id": "Deep_Voice_Man",
      "speed": 1,
      "emotion": "auto"
    },
    "textToImage": {
      "num_inference_steps": 20,
      "guidance_scale": 3,
      "output_format": "jpg"
    },
    "imageTextToVideo": {
      "go_fast": true,
      "sample_shift": 12
    }
  },
  "subtitleOptions": {
    "enabled": true,
    "templateId": "social_center_clean",
    "position": "center",
    "fontName": "Helvetica",
    "fontSize": 92,
    "bold": true,
    "italic": false,
    "makeUppercase": true,
    "primaryColor": "#ffffff",
    "activeColor": "#9ae6ff",
    "outlineColor": "#111111",
    "backgroundEnabled": true,
    "backgroundColor": "#000000",
    "backgroundOpacity": 0.45,
    "outline": 3,
    "shadow": 0,
    "marginV": 120,
    "maxWordsPerLine": 4,
    "maxLines": 2,
    "highlightMode": "current_only"
  }
}
```

---

## 应用/运行时配置 (~/.rilo/config.json + 密钥库)

应用级设置通过 `rilo settings` 或环境变量管理。安全令牌存储在操作系统密钥库中；公共设置存储在 `~/.rilo/config.json` 中。

### 安全设置（密钥库/加密文件）

| 键 | 设置标签 | 环境变量 | 类型 | 备注 |
|----|----------|----------|------|------|
| `replicateApiToken` | Replicate API Token | `TELEPAT_REPLICATE_TOKEN`, `TELEPAT_REPLICATE_TOKEN` | string | 来自 replicate.com/account/api-tokens 的 API 密钥。模型预测必需。 |
| `apiBearerToken` | API Bearer Token | `RILO_API_BEARER_TOKEN`, `API_BEARER_TOKEN` | string | 用于向 rilo HTTP API 端点进行身份验证的 Bearer 令牌。如果运行带身份验证的 HTTP API 则必需。 |

**存储：** 操作系统密钥库（macOS 钥匙串、Windows 凭据管理器、Linux Secret Service）或 `~/.rilo/.secrets` 中的 AES-256 加密文件（如果没有本机密钥库）。

### 公共设置 (~/.rilo/config.json)

#### 预测和重试行为

| 键 | 设置标签 | 环境变量 | 类型 | 默认值 | 备注 |
|----|----------|----------|------|--------|------|
| `maxRetries` | 最大重试次数 | `MAX_RETRIES` | number | `2` | 失败预测的重试次数；≥ 0 |
| `retryDelayMs` | 重试延迟 (ms) | `RETRY_DELAY_MS` | number | `2500` | 重试之间等待的毫秒数；≥ 0 |
| `predictionPollIntervalMs` | 轮询间隔 (ms) | `PREDICTION_POLL_INTERVAL_MS` | number | `1500` | 检查预测状态的频率；≥ 100 |
| `predictionMaxWaitMs` | 最大预测等待时间 (ms) | `PREDICTION_MAX_WAIT_MS` | number | `600000` (10 分钟) | 等待单个预测完成的最长时间；≥ 1000 |

#### 下载行为

| 键 | 设置标签 | 环境变量 | 类型 | 默认值 | 备注 |
|----|----------|----------|------|--------|------|
| `downloadTimeoutMs` | 下载超时 (ms) | `DOWNLOAD_TIMEOUT_MS` | number | `20000` | 下载生成媒体文件的超时时间；≥ 1000 |
| `downloadMaxBytes` | 下载最大大小 (字节) | `DOWNLOAD_MAX_BYTES` | number | `104857600` (100 MB) | 下载文件大小的硬性上限；> 0 |
| `downloadAllowedHosts` | 下载允许的主机 | `DOWNLOAD_ALLOWED_HOSTS` | string | `"replicate.delivery,replicate.com"` | 逗号分隔的允许用于媒体下载的主机名列表；非空 |

#### 二进制路径

| 键 | 设置标签 | 环境变量 | 类型 | 默认值 | 备注 |
|----|----------|----------|------|--------|------|
| `ffmpegBin` | ffmpeg 二进制文件 | `FFMPEG_BIN` | string | `"ffmpeg"` | ffmpeg 的路径或命令名；非空；通常在 PATH 中 |
| `ffprobeBin` | ffprobe 二进制文件 | `FFPROBE_BIN` | string | `"ffprobe"` | ffprobe 的路径或命令名；非空；通常在 PATH 中 |
| `ffsubsyncBin` | ffsubsync 二进制文件 | `FFSUBSYNC_BIN` | string | `"ffsubsync"` | ffsubsync 的路径或命令名（可选的字幕对齐工具）；非空 |

#### API 日志

| 键 | 设置标签 | 环境变量 | 类型 | 默认值 | 备注 |
|----|----------|----------|------|--------|------|
| `apiDefaultLogsLimit` | 默认日志限制 | `API_DEFAULT_LOGS_LIMIT` | number | `100` | HTTP API 每个请求返回的默认日志条目数；> 0 |
| `apiMaxLogsLimit` | 最大日志限制 | `API_MAX_LOGS_LIMIT` | number | `1000` | HTTP API 返回的日志条目数硬性上限；> 0 |

#### 仅限于环境变量的设置（不在 ~/.rilo/config.json 中）

这些只能通过环境变量设置；无法通过 `rilo settings` 编辑：

| 环境变量 | 类型 | 备注 |
|----------|------|------|
| `FIREBASE_PROJECT_ID` | string | Firestore/Storage 的 Firebase 项目 ID（可选） |
| `FIREBASE_PRIVATE_KEY` | string | Firebase 服务帐户私钥（可选） |
| `FIREBASE_CLIENT_EMAIL` | string | Firebase 服务帐户客户端电子邮件（可选） |
| `RILO_WEBHOOK_SECRET` | string | 用于验证传入 Webhook 签名的共享密钥（可选） |
| `RILO_WEBHOOK_URL` | string | 要向其发送作业状态更新的 URL（可选） |
| `RILO_API_PORT` | string | HTTP API 端口；默认 `3000` |
| `RILO_PROJECTS_DIR` | string | 自定义项目目录；默认 `"projects/"` |
| `RILO_OUTPUTS_DIR` | string | 后端的自定义输出目录；默认 `"outputs/"` |
| `RILO_BACKEND` | string | 输出后端：`"local"` 或 `"firebase"`（默认：`"local"`） |

### 示例 ~/.rilo/config.json

```json
{
  "maxRetries": 3,
  "retryDelayMs": 3000,
  "predictionPollIntervalMs": 2000,
  "predictionMaxWaitMs": 900000,
  "downloadTimeoutMs": 25000,
  "downloadMaxBytes": 209715200,
  "downloadAllowedHosts": "replicate.delivery,replicate.com,cdn.example.com",
  "ffmpegBin": "/usr/local/bin/ffmpeg",
  "ffprobeBin": "/usr/local/bin/ffprobe",
  "ffsubsyncBin": "ffsubsync",
  "apiDefaultLogsLimit": 200,
  "apiMaxLogsLimit": 2000
}
```

安全设置（`replicateApiToken`、`apiBearerToken`）**不**在此文件中；它们存储在密钥库中。

---

## 配置优先级

对于任何设置，rilo 按此顺序解析值（第一个匹配项生效）：

1. **环境变量**（最高优先级）
   - 示例：`RILO_MAX_RETRIES=5`、`TELEPAT_REPLICATE_TOKEN=r8_xxx`
   - 按顺序检查特定环境变量和通用环境变量（例如，在 `TELEPAT_REPLICATE_TOKEN` 之前检查 `TELEPAT_REPLICATE_TOKEN`）
   - 设置后，`rilo settings` 菜单将该值显示为"只读（通过环境变量）"

2. **~/.rilo/config.json**（如果存在且键已写入）
   - 仅在未设置环境变量时适用
   - 可通过 `rilo settings` 编辑

3. **模式默认值**（最低优先级）
   - 内置后备值

**示例：**
```bash
# 环境变量生效
export MAX_RETRIES=10
rilo settings  # 显示"最大重试次数：10 (通过环境变量) — 只读"

# 无环境变量；使用 config.json 值
cat ~/.rilo/config.json | jq .maxRetries  # 3
# 如果环境变量和 config.json 都不存在，则使用模式默认值 (2)
```

---

## 验证规则

### 项目配置

- `aspectRatio`：必须是 `"1:1"`、`"16:9"`、`"9:16"` 之一
- `targetDurationSec`：必须是正整数 (> 0)
- `finalDurationMode`：必须是 `"match_audio"` 或 `"match_visual"`
- `keyframeWidth`、`keyframeHeight`：如果两者都提供，必须是整数 ≥ 512；如果提供了一个，则必须提供两者；如果都未提供，则从宽高比自动派生
- `models.<category>`：必须对应于模型目录中的有效模型 ID
- `modelOptions.<category>.<param>`：根据每个模型适配器进行验证；无效参数可能会被记录或忽略
- `subtitleOptions.enabled`：必须是布尔值；如果为 `false`，则忽略其他字幕字段
- 十六进制颜色字段：必须是有效的十六进制颜色（例如 `"#ffffff"`、`"#000000"`）
- 不透明度字段：必须是 0.0 到 1.0 之间的数字

验证错误会被记录；如果关键配置无效，生成可能会失败。

### 应用配置

- `maxRetries`、`apiDefaultLogsLimit`、`apiMaxLogsLimit`：必须是非负整数
- `retryDelayMs`、`downloadTimeoutMs`、`downloadMaxBytes`、`predictionPollIntervalMs`、`predictionMaxWaitMs`：必须是正整数
- `predictionPollIntervalMs`：必须 ≥ 100
- `predictionMaxWaitMs`：必须 ≥ 1000
- `downloadTimeoutMs`：必须 ≥ 1000
- `ffmpegBin`、`ffprobeBin`、`ffsubsyncBin`：必须是非空字符串
- `downloadAllowedHosts`：必须非空；逗号分隔的主机名列表

在设置保存或环境变量应用期间，无效的应用配置将被拒绝。

---

## 相关文档

- **[配置](/guides/configuration)** — 配置工作流和示例
- **[CLI 参考](/reference/cli-reference)** — 命令和标志
- **[环境变量](/reference/environment-variables)** — 所有环境变量及示例
- **[模型适配器和选项](/guides/model-adapters-and-options)** — 每个模型的参数文档
- **[模型目录](/reference/model-catalog)** — 按类别划分的可用模型