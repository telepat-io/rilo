---
slug: /reference/cli-reference
sidebar_position: 1
title: CLI 参考
---

## 生成命令

从故事生成完整视频的核心命令：

```bash
rilo --project <name> [--story-file <path>] [--force] [--full-run]
```

### 标志

| 标志 | 类型 | 描述 |
|------|------|------|
| `--project` | `<name>` | **必需。** 项目标识符（允许字母数字、连字符）。创建 `projects/<name>/` 目录。 |
| `--story-file` | `<path>` | 故事文本文件的路径。首次运行时，使用此故事初始化项目。后续运行时，覆盖项目的故事（需要 `--force`）。如果项目已有故事，请省略。 |
| `--force` | 标志 | 在适用的情况下强制从较早阶段重新开始。使依赖于配置更改的工件失效。 |
| `--full-run` | 标志 | 跳过关键帧审查暂停，一次性运行所有管道阶段（覆盖项目配置中的 `pauseAfterKeyframes: true`）。 |
| `--help` | 标志 | 打印使用信息。 |
| `--version` | 标志 | 打印 CLI 版本。 |

### 示例

**首次运行新项目：**
```bash
rilo --project housing-case --story-file ./story.txt
```

**重新运行现有项目（重用故事）：**
```bash
rilo --project housing-case
```

**配置更改后强制重新启动：**
```bash
# 编辑 projects/housing-case/config.json
# 然后使用 --force 重新启动以重新生成受影响的阶段
rilo --project housing-case --force
```

**更新故事并重新生成：**
```bash
rilo --project housing-case --story-file ./new-story.txt --force
```

### 项目输出结构

执行时，rilo 创建目录 `projects/<name>/`，包含：

```
projects/<name>/
├── config.json              # 项目生成设置
├── story.md                 # 格式化的故事
├── artifacts.json           # 生成元数据和路径
├── run-state.json           # 恢复/失效的检查点
├── final.mp4                # 主输出视频
├── final_captioned.mp4      # 带字幕的输出（如果启用）
├── assets/                  # 生成的关键帧、音频、片段
├── logs/                    # 详细的生成日志
└── analytics/               # 每个阶段的性能指标
```

### 退出代码

| 代码 | 含义 |
|------|------|
| `0` | 成功——视频生成完成。 |
| `1` | 错误——缺少参数、文件未找到或生成失败。检查 stderr 输出。 |

### 成功时的输出

成功完成后，rilo 将 JSON 对象打印到 stdout：

```json
{
  "jobId": "job-abc123xyz789",
  "project": "housing-case",
  "finalVideoPath": "projects/housing-case/final.mp4"
}
```

在脚本中解析此输出：
```bash
OUTPUT=$(rilo --project demo --story-file ./story.txt)
VIDEO_PATH=$(echo "$OUTPUT" | jq -r '.finalVideoPath')
echo "视频已保存到：$VIDEO_PATH"
```

### 超时和重试行为

生成超时和重试由应用设置控制（请参阅[设置命令](#settings-command)）：

- **预测超时**：`PREDICTION_MAX_WAIT_MS`（默认值：600,000 ms / 10 分钟）
- **重试次数**：`maxRetries`（默认值：2）
- **重试延迟**：`retryDelayMs`（默认值：2,500 ms）

通过 `rilo settings` 或环境变量配置这些（请参阅[环境变量](/reference/environment-variables)）。

## 设置命令

无需编辑文件即可交互式配置 rilo：

```bash
rilo settings
```

这将打开一个交互式菜单，您可以在其中：
- 安全地输入和更新 API 凭据（Replicate、API Bearer Token）
- 调整性能设置（超时、重试、轮询间隔）
- 配置二进制路径（ffmpeg、ffprobe、ffsubsync）
- 查看当前设置及其来源（环境变量、配置文件或默认值）

### 导航

- **方向键** — 在设置中上下移动
- **回车** — 编辑所选设置
- **Esc / Ctrl+C** — 不保存退出
- **完成** — 保存并退出
- **取消** — 不保存退出

### 设置存储位置

| 设置类型 | 存储位置 | 备注 |
|----------|----------|------|
| **API 令牌**（Replicate、Bearer） | 操作系统密钥库或加密文件 | 安全存储，绝不以纯文本形式存储在 config.json 中 |
| **性能**（超时、重试、限制） | `~/.rilo/config.json` | 纯文本 JSON；非敏感设置 |
| **二进制路径**（ffmpeg、ffprobe、ffsubsync） | `~/.rilo/config.json` | 纯文本 JSON |
| **Firebase 凭据、Webhook、API 端口** | 仅环境变量 | 无法通过设置命令编辑 |

### 优先级规则

解析设置值时，rilo 按此顺序检查（第一个匹配项生效）：

1. **环境变量**（最高优先级）
   - `RILO_<SETTING_NAME>` 或 `<SETTING_NAME>`
   - 示例：`RILO_MAX_RETRIES=5` 覆盖任何保存的设置

2. **~/.rilo/config.json**（如果存在且通过 `rilo settings` 设置）
   - 仅在未设置环境变量时适用

3. **模式默认值**（最低优先级）
   - 内置后备值

**注意：** 如果设置了环境变量，`rilo settings` 菜单会将该设置显示为"只读（通过环境变量）"，并在环境变量存在时忽略任何已保存的 config.json 值。

## Home 命令

在系统文件管理器中打开默认的 Rilo 应用目录：

```bash
rilo home
```

这将打开 `~/.rilo`，其中存储 Rilo 的默认本地数据，包括：

- `config.json` 用于保存的公共设置
- `projects/` 用于本地项目目录
- `output/` 用于使用默认值时生成的输出

### 示例

```bash
rilo home
npx @telepat/rilo home
```

### 平台行为

- macOS 使用 `open`
- Linux 使用 `xdg-open`
- Windows 使用 `cmd /c start`

如果所需的打开器不可用，rilo 将以代码 `1` 退出并打印清晰的错误。

## 预览命令

在一个命令中启动本地仪表板、API 和工作进程：

```bash
rilo preview [--port <n>] [--host <host>] [--no-open] [--expose --unsafe-no-auth]
```

### 标志

| 标志 | 类型 | 描述 |
|------|------|------|
| `--port` | `<n>` | 预览 API/仪表板的端口（默认值：`3000`）。 |
| `--host` | `<host>` | 主机绑定地址（默认值：`127.0.0.1`；使用 `--expose` 时默认为 `0.0.0.0`）。 |
| `--no-open` | 标志 | 跳过自动打开浏览器。 |
| `--expose` | 标志 | 允许外部/容器访问预览。 |
| `--unsafe-no-auth` | 标志 | 与 `--expose` 一起必需；无需 API 认证即可运行预览。 |

### 示例

**本地预览（推荐默认）：**

```bash
rilo preview
```

这将在仅回环地址上启动预览并打开仪表板。

**为容器/隧道暴露的预览（不安全）：**

```bash
rilo preview --expose --unsafe-no-auth --host 0.0.0.0 --port 3000
```

仅在受信任的网络或隔离环境中使用暴露模式。

## 调用方法

选择适合您环境的调用模式：

### 全局安装

从 npm 全局安装：

```bash
npm install -g @telepat/rilo
rilo --help
rilo settings
rilo home
rilo --project demo --story-file ./story.txt
```

### npx（无需安装）

直接运行，无需任何安装：

```bash
npx @telepat/rilo --help
npx @telepat/rilo settings
npx @telepat/rilo home
npx @telepat/rilo --project demo --story-file ./story.txt
```

这将下载并运行 npm 中的最新版本。适用于 CI/CD 和一次性运行。

### 贡献者工作流（检出的仓库）

使用 `npm run dev` 作为包装器：

```bash
npm run dev -- settings
npm run dev -- home
npm run dev -- --project demo --story-file ./story.txt
npm run dev -- --project demo --force
```

这确保使用正确的 Node.js 环境和本地代码。

## 帮助文本

显示内置帮助：

```bash
rilo --help
```

输出：
```
Usage: rilo --project <name> [--story-file <path>] [--force] [--full-run]
       rilo settings
   rilo home
Example: rilo --project housing-case --story-file ./story.txt
```

## 相关文档

- **[配置](/guides/configuration)** — 项目设置、模型和选项
- **[环境变量](/reference/environment-variables)** — 所有环境变量和优先级
- **[故障排除](/guides/troubleshooting)** — 常见 CLI 和生成问题
- **[API 认证和 Webhook](/reference/api-auth-and-webhooks)** — API 端点的 Bearer 令牌设置