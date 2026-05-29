---
slug: /getting-started/quickstart
sidebar_position: 3
title: 快速开始
---

## 安装与设置

推荐工作流：

```bash
npm install -g @telepat/rilo
rilo settings
rilo --project housing-case --story-file ./examples/story.txt
```

或通过 npx 运行，无需全局安装：

```bash
npx @telepat/rilo settings
npx @telepat/rilo --project housing-case --story-file ./examples/story.txt
```

如果您是从本仓库源码贡献代码，请参阅 [/contributing/development](/contributing/development) 了解 `npm run dev` 工作流。

## 您的首次生成

### 步骤 1：配置 API 令牌

在运行首次生成之前，请设置您的 Replicate API 令牌：

**选项 A：交互式设置菜单（推荐）**
```bash
rilo settings
```

这将打开一个菜单，您可以在其中安全地输入 Replicate API 令牌并配置其他设置。

**选项 B：环境变量**
```bash
export TELEPAT_REPLICATE_TOKEN=r8_xxxxxxxxxxxxx
```

### 步骤 2：使用故事创建新项目

创建一个简单的故事文件：

```bash
cat > wedding-story.txt <<'EOF'
一对夫妇的爱情故事始于一个舒适的咖啡馆，他们在那里因一杯共享的拿铁而初次相遇。多年后，他们回到同一个地方，在亲友的见证下举行了一场亲密的仪式，这些亲友见证了他们旅程的开始。视频庆祝了在熟悉的地方找到永恒的美好。
EOF
```

初始化您的项目：

```bash
rilo --project wedding-case --story-file ./wedding-story.txt
```

首次运行时，rilo：
1. 创建 `projects/wedding-case/` 目录
2. 存储 `config.json`（项目生成设置）
3. 保存 `story.md`（格式化的故事）
4. 开始生成管道
5. 完成时输出 `projects/wedding-case/final.mp4`

### 步骤 3：监控进度

在终端输出中查看生成进度：

```
✓ 脚本生成完成 (2.3s)
✓ 旁白生成完成 (8.1s)
  正在生成关键帧... (1/12)
  正在生成关键帧... (2/12)
  ...
✓ 合成完成 (15.2s)
```

在此处查找输出：
```
projects/wedding-case/
├── config.json              # 项目设置
├── story.md                 # 您的故事
├── final.mp4                # 主输出视频
├── artifacts.json           # 生成元数据
├── run-state.json           # 恢复的检查点
├── assets/                  # 生成的关键帧、音频等
└── logs/                    # 详细的生成日志
```

## 常见工作流

### 从特定阶段重新运行 (--force)

如果生成中途失败，使用 `--force` 从较早阶段重新开始，而无需重新生成已完成的工作：

```bash
# 从关键帧生成重新开始（重用之前的阶段）
rilo --project wedding-case --force

# 重新运行整个管道（谨慎使用）
rilo --project wedding-case --force
```

有关更多详情，请参阅[重新生成和失效](/guides/regeneration-and-invalidation)。

### 在项目中途更新项目设置

如果您想在开始项目后更改宽高比、持续时间或模型选择：

1. 编辑 `projects/wedding-case/config.json`：
   ```json
   {
     "aspectRatio": "9:16",
     "targetDurationSec": 30,
     "models": {
       "textToImage": "black-forest-labs/flux-2-pro"
     }
   }
   ```

2. 使用 `--force` 重新运行以失效并重新生成受影响的阶段：
   ```bash
   rilo --project wedding-case --force
   ```

### 配置应用范围设置

全局调整超时、重试次数或二进制路径：

```bash
rilo settings
# 导航到"最大重试次数"、"轮询间隔"、"ffmpeg 二进制文件"等。
使用方向键选择 → 回车编辑 → 回车保存 → "完成"退出
```

这些设置存储在 `~/.rilo/config.json` 中，优先级如下：
1. 环境变量（最高优先级）
2. `~/.rilo/config.json`（您通过 `rilo settings` 配置的设置）
3. 模式默认值（最低优先级）

### 在后续运行中使用自定义故事文件

如果您想更新现有项目的故事，请再次传递 `--story-file`：

```bash
cat > new-wedding-story.txt <<'EOF'
... 更新的故事文本 ...
EOF

rilo --project wedding-case --story-file ./new-wedding-story.txt --force
```

这将覆盖 `projects/wedding-case/story.md` 并从头开始重新生成。

## 调用模式

选择适合您工作流的调用方法：

| 方法 | 命令 | 最适合 |
|------|------|--------|
| **全局安装** | `rilo --project <name> --story-file <path>` | 执行 `npm install -g @telepat/rilo` 后 |
| **npx** | `npx @telepat/rilo --project <name> --story-file <path>` | 无需安装；CI/CD |
| **贡献者开发** | `npm run dev -- --project <name> --story-file <path>` | 从检出的仓库工作 |

## 后续步骤

- **[CLI 参考](/reference/cli-reference)** — 所有标志和命令
- **[配置](/guides/configuration)** — 项目设置、模型和选项
- **[故障排除](/guides/troubleshooting)** — 常见问题和解决方案
- **[模型目录](/reference/model-catalog)** — 可用模型及其功能