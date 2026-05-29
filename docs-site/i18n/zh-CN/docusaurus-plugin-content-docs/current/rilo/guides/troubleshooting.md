---
slug: /guides/troubleshooting
sidebar_position: 10
title: 故障排除
---

## 快速分类

**最常见的问题：**
1. 缺失或不正确的 API 令牌 `TELEPAT_REPLICATE_TOKEN`
2. ffmpeg/ffprobe 不在 PATH 中或配置错误
3. 模型 ID 或 modelOptions 无效或与所选适配器不兼容
4. 预测超时（增加 `PREDICTION_MAX_WAIT_MS`）
5. 下载失败（检查 `DOWNLOAD_ALLOWED_HOSTS`、超时和最大字节数设置）

**从这里开始：**
```bash
rilo settings
# 验证 Replicate API Token 已设置 ✓
# 验证 ffmpeg 和 ffprobe 路径正确 ✓
# 检查最大预测等待时间（如果需要则增加）✓
```

---

## CLI 错误

### "Missing --project argument"

**错误消息：**
```
Error: Missing --project argument
```

**原因：** 省略了 `--project` 标志。

**解决方案：**
```bash
# 正确用法：
rilo --project housing-case --story-file ./story.txt

# 而不是：
rilo --story-file ./story.txt  # 缺少 --project
```

### "Project story.md not found"

**错误消息：**
```
Error: Project story.md not found. Provide --story-file once to initialize the project.
```

**原因：** 项目存在但没有 `story.md`。Rilo 可能找不到故事，或者在首次运行时未保存。

**解决方案：**
1. 在下次运行时提供 `--story-file`：
   ```bash
   rilo --project housing-case --story-file ./my-story.txt
   ```

2. 手动检查项目目录：
   ```bash
   ls -la projects/housing-case/
   ```
   如果 `story.md` 缺失，请从文本文件重新创建。

3. 验证项目目录是否已成功创建：
   ```bash
   cat projects/housing-case/config.json  # 应该存在
   ```

### "Validation error: invalid model ID" 或 "Unknown model"

**错误消息：**
```
Error: Model "invalid-model-name" is not recognized or not supported
```

**原因：** `projects/<project>/config.json` 中的模型 ID 在模型目录中不存在。

**解决方案：**
1. 列出可用模型：
   ```bash
   ls models/ | head -10
   # 查看：deepseek-ai__deepseek-v3.json、minimax__speech-02-turbo.json 等
   ```

2. 使用有效的模型 ID 编辑配置：
   ```bash
   cat projects/housing-case/config.json | jq '.models'
   # 检查格式："org/name" 在 models/ 目录中变为 "org__name"
   ```

3. 使用 `rilo settings` 验证可用的默认值（尚未通过 UI 驱动，但在模型目录中有记录）。

### "Invalid modelOption parameter"

**错误消息：**
```
Warning: modelOption "unknown_param" for textToImage is not recognized
```

**原因：** `modelOptions` 中的参数不被所选模型的适配器支持。

**解决方案：**
1. 请参阅[模型适配器和选项](/guides/model-adapters-and-options)了解每个模型和类别的有效参数。

2. 常见的可用模型选项：
   - **textToImage** (Flux)：`num_inference_steps`、`guidance_scale`、`output_format`
   - **textToImage** (Z-Image)：`num_inference_steps`、`output_format`、`output_quality`
   - **imageTextToVideo** (Kling)：`interpolate_output`、`go_fast`
   - **imageTextToVideo** (Wan)：`sample_shift`、`go_fast`、`disable_safety_checker`

3. 删除无法识别的参数或更新模型选择。

### "unauthorized" 或 "invalid API token"

**错误消息：**
```
Error: Replicate API returned: unauthorized
```

**原因：**
- API 令牌缺失或不正确
- 令牌没有权限或已被撤销
- 令牌优先级问题（环境变量与保存的设置）

**解决方案：**
1. 检查令牌是否已设置：
   ```bash
   echo $TELEPAT_REPLICATE_TOKEN  # 或 $TELEPAT_REPLICATE_TOKEN
   ```

2. 通过 `rilo settings` 验证：
   ```bash
   rilo settings
   # 导航到"Replicate API Token"并检查其是否已填充
   ```

3. 如果通过环境变量设置，请确保已导出：
   ```bash
   export TELEPAT_REPLICATE_TOKEN=r8_xxxxx
   rilo --project demo --story-file ./story.txt

   # 而不是：
   TELEPAT_REPLICATE_TOKEN=r8_xxxxx rilo ...  # 在所有 shell 中可能不起作用
   ```

4. 在 [replicate.com](https://replicate.com/account/api-tokens) 上验证令牌。

5. 优先级：环境变量 > ~/.rilo/config.json > 默认值。如果设置了环境变量，`rilo settings` 菜单会将其显示为只读。

### "ffmpeg/ffprobe not found" 或 "command not found"

**错误消息：**
```
Error: ffmpeg not found. Install ffmpeg or set FFMPEG_BIN in settings.
```

**原因：**
- ffmpeg/ffprobe 不在 PATH 中
- 设置中的二进制路径配置错误
- 未安装二进制文件

**解决方案：**
1. 安装 ffmpeg（如果尚未安装）：
   ```bash
   # macOS
   brew install ffmpeg

   # Linux (Ubuntu/Debian)
   sudo apt-get install ffmpeg

   # Windows
   choco install ffmpeg
   # 或从 ffmpeg.org 下载
   ```

2. 验证安装：
   ```bash
   which ffmpeg
   which ffprobe
   ffmpeg -version
   ```

3. 在 `rilo settings` 中配置：
   ```bash
   rilo settings
   # 导航到"ffmpeg 二进制文件"，输入完整路径：/usr/local/bin/ffmpeg
   # 或者如果在 PATH 中，只需：ffmpeg
   ```

4. 通过环境变量设置：
   ```bash
   export FFMPEG_BIN=/usr/local/bin/ffmpeg
   rilo --project demo --story-file ./story.txt
   ```

---

## 预测和网络问题

### "Prediction timed out"

**错误消息：**
```
Error: Prediction timed out after 600000ms
```

**原因：**
- 预测耗时超过 `PREDICTION_MAX_WAIT_MS`
- 网络连接问题
- 提供商推理速度慢
- 提供商端队列高

**解决方案：**
1. 增加超时：
   ```bash
   rilo settings
   # 导航到"最大预测等待时间 (ms)"
   # 从 600000 增加到 900000 (15 分钟) 或更高
   ```

   或通过环境变量：
   ```bash
   export PREDICTION_MAX_WAIT_MS=900000
   rilo --project demo --story-file ./story.txt
   ```

2. 使用 `--force` 重试：
   ```bash
   rilo --project demo --force
   # 从失败的阶段重新开始
   ```

3. 检查网络和提供商状态：
   - 验证互联网连接
   - 检查 Replicate 状态页面

### "Download failed" 或 "exceeds max file size"

**错误消息：**
```
Error: Downloaded file (120MB) exceeds DOWNLOAD_MAX_BYTES (104857600)
```

**原因：**
- 文件大于 `DOWNLOAD_MAX_BYTES`
- 下载超时
- 下载主机不在 `DOWNLOAD_ALLOWED_HOSTS` 中

**解决方案：**
1. 增加最大下载大小：
   ```bash
   rilo settings
   # 导航到"下载最大大小 (字节)"
   # 从 104857600 (100 MB) 增加到 209715200 (200 MB) 或更多
   ```

   或通过环境变量：
   ```bash
   export DOWNLOAD_MAX_BYTES=209715200
   rilo --project demo --story-file ./story.txt
   ```

2. 增加下载超时：
   ```bash
   export DOWNLOAD_TIMEOUT_MS=30000
   ```

3. 检查允许的主机：
   ```bash
   rilo settings
   # 查看"下载允许的主机"——应包括文件托管的域名
   # 默认值：replicate.delivery,replicate.com
   ```

4. 如果需要，添加自定义主机：
   ```bash
   cat ~/.rilo/config.json | jq .downloadAllowedHosts
   # 如果需要，编辑以包含您的 CDN
   ```

---

## 生成和阶段失败

### "Story validation failed" 或 "Story is too short"

**错误消息：**
```
Error: Story is required and must be at least 50 characters
```

**原因：**
- 故事为空或太短
- 故事没有足够的细节用于脚本生成

**解决方案：**
- 提供更长、更清晰的故事（目标为 200+ 个字符）：
  ```bash
  cat > story.txt <<'EOF'
  一对年轻夫妇在社区花园相遇时发现他们共同热爱园艺。几个月来，他们一起种植蔬菜和花卉，通过耐心的照料了解彼此。当春天到来时，他们的花园盛开，色彩缤纷，他们的关系也如此。他们决定结婚，并承诺像他们培育的多年生植物一样一起变老。
  EOF

  rilo --project garden-case --story-file ./story.txt
  ```

### "Script generation failed" 或 "LLM returned error"

**错误消息：**
```
Error: Script generation failed: LLM returned status 400
```

**原因：**
- 脚本模型（例如 DeepSeek）返回错误
- 特定于 LLM 的问题（速率限制、无效参数、配额超限）
- 连接模型提供商的网络错误

**解决方案：**
1. 等待并重试：
   ```bash
   rilo --project demo --force
   # 从脚本阶段重新开始
   ```

2. 增加重试次数：
   ```bash
   export MAX_RETRIES=5
   export RETRY_DELAY_MS=5000
   rilo --project demo --force
   ```

3. 检查 LLM 模型选项兼容性：
   ```bash
   cat projects/demo/config.json | jq '.modelOptions.textToText'
   # 验证 max_tokens、temperature 等参数对模型是否有效
   ```

4. 尝试不同的模型：
   ```bash
   # 编辑 projects/demo/config.json
   # 将 "models.textToText" 更改为另一个模型（例如，如果可用，使用 "gpt-4"）
   rilo --project demo --force
   ```

### "Keyframe/segment generation failure"

**错误消息：**
```
Error: Image generation failed: model returned error
```

**原因：**
- 图像/视频模型返回错误或超时
- 模型参数与所选模型不兼容
- 安全检查器或输出格式不支持

**解决方案：**
1. 增加超时重试：
   ```bash
   export PREDICTION_MAX_WAIT_MS=900000
   rilo --project demo --force
   ```

2. 查看并调整模型选项：
   ```bash
   cat projects/demo/config.json | jq '.modelOptions'
   # 删除有问题的参数
   rilo --project demo --force
   ```

3. 切换到更快/更稳定的模型：
   ```bash
   # 编辑 projects/demo/config.json
   # "textToImage": "black-forest-labs/flux-schnell"  # 比 flux-pro 更快
   rilo --project demo --force
   ```

4. 检查合成/输出设置：
   ```bash
   cat projects/demo/config.json | jq '{aspectRatio, keyframeWidth, keyframeHeight}'
   # 验证尺寸是否合理（每个 ≥ 512）
   ```

### "Composition failed" 或 "Final video creation error"

**错误消息：**
```
Error: Composition failed: could not create final video
```

**原因：**
- 合成期间的 ffmpeg 错误
- 音频/视频编解码器不匹配
- 磁盘空间问题
- 字幕烧录失败（如果启用）

**解决方案：**
1. 检查磁盘空间：
   ```bash
   df -h
   # 对于典型视频，应至少有 2-5 GB 可用空间
   ```

2. 验证 ffmpeg：
   ```bash
   ffmpeg -version
   ffprobe -version
   ```

3. 如果启用了字幕，请禁用并重试：
   ```bash
   cat projects/demo/config.json | jq '.subtitleOptions.enabled'
   # 设置为 false 并删除 subtitleOptions 或设置 enabled: false
   rilo --project demo --force
   ```

4. 检查资产：
   ```bash
   ls -lh projects/demo/assets/
   # 验证音频和视频片段是否存在且不为空
   ```

---

## 日志和调试

### 检查项目日志端点 (HTTP API)

```bash
curl -H "Authorization: Bearer $RILO_API_BEARER_TOKEN" \
  http://localhost:3000/projects/demo/logs?limit=50
```

### 检查 run-state.json

```bash
cat projects/demo/run-state.json | jq '.stages'
# 显示哪些阶段已成功完成
# 最后阶段表示失败的位置
```

### 检查 artifacts.json

```bash
cat projects/demo/artifacts.json | jq 'keys'
# 列出所有保存的工件（音频、关键帧、片段、最终视频等）
# 缺失的键表示哪个阶段失败了
```

### 启用详细日志（基于环境）

设置 `DEBUG=rilo:*` 以查看详细日志：
```bash
export DEBUG=rilo:*
rilo --project demo --force
```

或检查生成的日志目录：
```bash
ls -la projects/demo/logs/
cat projects/demo/logs/generation-YYYY-MM-DD.log
```

---

## 快速分类清单

1. ✓ 检查项目日志端点以获取最新错误：
   ```bash
   curl http://localhost:3000/projects/demo/logs
   ```

2. ✓ 检查 `run-state.json` 以获取最后完成的阶段：
   ```bash
   cat projects/demo/run-state.json | jq '.stages | keys[-1]'
   ```

3. ✓ 检查 `artifacts.json` 以获取缺失的输出路径/URL：
   ```bash
   cat projects/demo/artifacts.json | jq 'keys'
   ```

4. ✓ 从失败的阶段重试有针对性的重新生成：
   ```bash
   rilo --project demo --force
   ```

5. ✓ 验证应用设置：
   ```bash
   rilo settings
   # 审查令牌、超时、二进制路径
   ```

---

## 另请参阅

- [CLI 参考](/reference/cli-reference) — 所有命令和标志
- [配置](/guides/configuration) — 项目和应用设置
- [环境变量](/reference/environment-variables) — 设置优先级和示例
- [重新生成和失效](/guides/regeneration-and-invalidation) — 何时使用 `--force`
- [管道阶段](/guides/pipeline-stages) — 详细的阶段分解和输出