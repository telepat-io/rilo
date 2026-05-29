---
slug: /guides/configuration
sidebar_position: 1
title: 配置
---

Rilo 有两个配置范围：
- **项目配置** (`projects/<project>/config.json`)：生成选项，如持续时间、宽高比、模型选择和模型选项。
- **应用/运行时配置** (`~/.rilo/config.json` + 安全密钥库)：API 令牌、重试次数、超时、二进制路径以及由 `rilo settings` 管理的相关运行时设置。

## 项目配置

Rilo 项目配置位于 `config.json` 中。

### 示例 config.json

```json
{
  "aspectRatio": "9:16",
  "targetDurationSec": 60,
  "finalDurationMode": "match_audio",
  "keyframeWidth": 576,
  "keyframeHeight": 1024,
  "models": {
    "textToText": "deepseek-ai/deepseek-v3",
    "textToSpeech": "minimax/speech-02-turbo",
    "textToImage": "prunaai/z-image-turbo",
    "imageTextToVideo": "wan-video/wan-2.2-i2v-fast"
  },
  "modelOptions": {
    "textToImage": {
      "num_inference_steps": 8,
      "output_format": "jpg"
    }
  },
  "subtitleOptions": {
    "enabled": true,
    "templateId": "social_center_clean",
    "position": "center",
    "fontSize": 92,
    "bold": true,
    "primaryColor": "#ffffff"
  }
}
```

### 核心设置

#### `aspectRatio`
- **类型：** `string`
- **允许的值：** `"1:1"`、`"16:9"`、`"9:16"`
- **默认值：** `"9:16"`
- **描述：** 输出视频的宽高比。决定关键帧尺寸和最终合成。更改此选项会使所有关键帧和片段失效。

#### `targetDurationSec`
- **类型：** `number`
- **默认值：** `60`
- **描述：** 目标旁白/脚本持续时间（以秒为单位）。影响脚本规划（镜头数量、节奏）和下游片段规划。片段数量根据实际旁白持续时间得出，通常为 5 秒一块。

#### `finalDurationMode`
- **类型：** `string`
- **允许的值：** `"match_audio"`、`"match_visual"`
- **默认值：** `"match_audio"`
- **描述：** 控制合成持续时间：
  - `"match_audio"` — 最终视频持续时间 = 旁白 + 静音填充（如果需要）
  - `"match_visual"` — 最终视频持续时间 = 所有视觉片段的总和（可能会剪切音频）

#### `keyframeWidth` 和 `keyframeHeight`
- **类型：** `number`
- **默认值：** 从 `aspectRatio` 派生（例如 `9:16` → 576x1024）
- **描述：** 生成关键帧的尺寸（以像素为单位）。必须成对提供；两者都必须是整数 ≥ 512。更改这些会使所有关键帧和片段失效。

### 模型配置

#### `models`

将生成阶段映射到所选模型的对象：

```json
{
  "models": {
    "textToText": "deepseek-ai/deepseek-v3",
    "textToSpeech": "minimax/speech-02-turbo",
    "textToImage": "prunaai/z-image-turbo",
    "imageTextToVideo": "wan-video/wan-2.2-i2v-fast"
  }
}
```

**模型类别：**
- `textToText` — 脚本生成（输入：故事 → 输出：脚本）
- `textToSpeech` — 旁白生成（输入：脚本 → 输出：旁白音频）
- `textToImage` — 关键帧生成（输入：镜头描述 → 输出：静态图像）
- `imageTextToVideo` — 片段生成（输入：关键帧 + 文本叠加 → 输出：视频片段）

**有效的模型 ID：** 请参阅[模型目录](/reference/model-catalog)了解完整列表和每个模型的功能。

**缺少的选择：** 如果省略某个类别，rilo 会回退到该类别的默认模型（在 `models/<model-id>.json` 中定义）。

#### `modelOptions`

每个模型的参数覆盖。每个键是一个模型类别；每个值是参数名称 → 值的对象：

```json
{
  "modelOptions": {
    "textToImage": {
      "num_inference_steps": 8,
      "guidance_scale": 0,
      "output_format": "jpg"
    },
    "textToSpeech": {
      "voice_id": "Deep_Voice_Man",
      "speed": 1.1
    }
  }
}
```

**每个模型的有效参数：** 由所选模型的适配器定义。有关每个模型和类别的详细参数文档，请参阅[模型适配器和选项](/guides/model-adapters-and-options)。

**验证：** 参数在运行时进行验证。无效参数会被记录；通常，未使用的参数会被静默忽略。更改模型选项只会使该阶段的输出失效。

### 字幕配置

#### `subtitleOptions`

可选对象，用于启用和配置字幕生成：

```json
{
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

**关键字段：**
- `enabled` — 启用/禁用字幕生成；如果为 `false`，则忽略其他字幕字段。
- `templateId` — 预定义的样式模板（例如 `"social_center_clean"`）。
- `position` — 字幕位置：`"top"`、`"center"`、`"bottom"`。
- `fontSize` — 字体大小（以像素为单位，例如 `92`）。
- `fontName` — 字体名称（例如 `"Helvetica"`、`"Arial"`）。
- `primaryColor` — 文本颜色，十六进制（例如 `"#ffffff"`）。
- `activeColor` — 当前正在朗读的文本的高亮颜色，十六进制（例如 `"#9ae6ff"`）。
- `outlineColor` — 文本轮廓颜色，十六进制（例如 `"#111111"`）。
- `backgroundEnabled` — 在文本后启用半透明背景。
- `backgroundColor` — 背景颜色，十六进制。
- `backgroundOpacity` — 背景不透明度（0.0–1.0）。
- `outline` — 文本轮廓粗细（以像素为单位）。
- `marginV` — 距屏幕边缘的垂直边距（以像素为单位）。
- `maxWordsPerLine` — 每行最大单词数；控制换行。
- `maxLines` — 同时显示的最大行数。
- `highlightMode` — `"current_only"` 仅高亮当前正在朗读的单词；还有其他模式可用。

**可选字幕对齐：** 如果启用，rilo 可以使用 `ffsubsync`（需要二进制文件在 PATH 中或通过设置配置）更精确地对齐字幕。请参阅[字幕：对齐与烧录](/guides/subtitles-align-and-burn-in)。

## 应用/运行时配置

应用级设置存储在 `~/.rilo/config.json`（纯文本公共设置）和操作系统密钥库/加密文件（安全令牌）中。通过 `rilo settings` 管理这些设置或设置环境变量。

### 安全设置（存储在密钥库中）
- `replicateApiToken` — Replicate API 密钥
- `apiBearerToken` — 用于 rilo API 端点的 Bearer 令牌

### 公共设置（存储在 ~/.rilo/config.json 中）
- `maxRetries` — 失败预测的重试次数（默认值：2）
- `retryDelayMs` — 重试之间的延迟（以毫秒为单位，默认值：2500）
- `predictionPollIntervalMs` — 预测状态的轮询间隔（默认值：1500）
- `predictionMaxWaitMs` — 单个预测的最大等待时间（默认值：600000）
- `downloadTimeoutMs` — 下载媒体文件的超时时间（默认值：20000）
- `downloadMaxBytes` — 下载的最大文件大小（默认值：104857600 / 100 MB）
- `downloadAllowedHosts` — 允许下载的主机名，逗号分隔
- `ffmpegBin` — ffmpeg 二进制文件的路径（默认值：`"ffmpeg"`）
- `ffprobeBin` — ffprobe 二进制文件的路径（默认值：`"ffprobe"`）
- `ffsubsyncBin` — ffsubsync 二进制文件的路径（默认值：`"ffsubsync"`）
- `apiDefaultLogsLimit` — API 返回的默认日志条目数（默认值：100）
- `apiMaxLogsLimit` — 日志条目的硬性上限（默认值：1000）

### 配置优先级

解析任何设置时：

1. **环境变量**（最高优先级）— 例如 `RILO_MAX_RETRIES=5`
2. **~/.rilo/config.json**（如果通过 `rilo settings` 设置）
3. **模式默认值**（最低优先级）

如果设置了环境变量，`rilo settings` 会将其显示为只读。

### 管理设置

**交互式菜单：**
```bash
rilo settings
```

**环境变量：**
```bash
export TELEPAT_REPLICATE_TOKEN=r8_xxxxx
export RILO_MAX_RETRIES=5
export PREDICTION_MAX_WAIT_MS=900000
rilo --project demo --story-file ./story.txt
```

**直接文件编辑（不推荐）：**
```bash
cat ~/.rilo/config.json
```

## 配置工作流

**首次运行：**
1. 运行 `rilo settings` 安全地输入您的 Replicate API 令牌
2. 可选地调整超时、重试次数、二进制路径
3. 这些设置全局应用于所有项目

**新项目：**
1. 运行 `rilo --project <name> --story-file <path>` 进行初始化
2. 这将创建 `projects/<name>/config.json`，其中包含合理的默认值
3. 编辑此文件以自定义模型、宽高比、持续时间等
4. 使用 `--force` 重新运行以应用更改

**迭代：**
1. 更改 `projects/<name>/config.json`
2. 运行 `rilo --project <name> --force`
3. Rilo 使受影响的阶段失效并重新生成

## 注意事项

- `targetDurationSec` 影响脚本规划；它不是严格强制的；实际持续时间取决于生成的内容。
- 片段数量根据测量的旁白持续时间（通常为 5 秒一块）得出，而不是 `targetDurationSec`。
- 如果未提供 `keyframeWidth` 和 `keyframeHeight`，rilo 会从 `aspectRatio` 计算它们。
- 更改 `aspectRatio`、`keyframeWidth`、`keyframeHeight` 或模型会使所有下游工作失效。
- 特定于模型的参数验证在运行时进行；无效参数会被记录。
- 字幕烧录是可选的；启用/禁用不会影响视频生成。

## 另请参阅

- [CLI 参考](/reference/cli-reference) — 命令和标志
- [环境变量](/reference/environment-variables) — 所有环境变量和优先级
- [模型适配器和选项](/guides/model-adapters-and-options) — 每个模型的详细参数文档
- [重新生成和失效](/guides/regeneration-and-invalidation) — 配置更改如何触发重新生成
- [字幕：对齐与烧录](/guides/subtitles-align-and-burn-in) — 字幕选项和工作流