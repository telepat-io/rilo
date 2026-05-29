---
slug: /features
title: "将故事转化为成品视频"
description: Rilo 能为需要大规模可重复视频生成的创作者和团队带来什么。
keywords: [rilo, features, video generation, ai video, text-to-video, vertical video]
sidebar_label: 功能特性
sidebar_position: 1
---

# 将故事转化为成品视频

Rilo 将纯文本故事转化为成品视频——AI 生成的脚本、旁白、关键帧和合成，全部在一个命令中完成。

专为需要大规模可重复、高质量视频且无需手动编辑的创作者和团队打造。

---

## 完整管道，一个命令

用纯文本编写您的故事。Rilo 处理其余所有事情：

**脚本生成 → 旁白合成 → 关键帧渲染 → 片段生成 → 最终合成**

无需手动拼接。无需时间线编辑。一个命令，从故事到成品视频。

```bash
rilo --project demo --story-file ./story.txt
```

---

## 检查点运行

每个阶段都会保存检查点工件。从上次中断的地方恢复运行。如果您更改了模型，只需重新生成片段。如果您调整了提示，只需重新渲染关键帧。

```bash
rilo --project demo                         # 从上次检查点恢复
rilo --project demo --force                 # 从较早阶段重新开始
rilo --project demo --force --full-run      # 跳过关键帧审查，运行所有阶段
```

无需从头开始，即可进行精细控制。

---

## 您的模型，您的控制

选择您的文本到图像和图像到视频模型。覆盖每个模型的选项以获得完全的创作控制。在运行之间切换模型，无需更改您的故事。

Rilo 的模型适配器系统将您的故事上下文映射到每个模型的原生输入格式——您无需学习特定于模型的 API。

---

## 代码驱动的管道

确定性代码处理作业编排、检查点、工件管理和状态跟踪。您的令牌用于创造性生成——脚本编写、图像渲染和视频合成——而不是基础设施开销。

没有上下文窗口被文件 I/O 消耗。没有令牌浪费在编排通信上。只在关键处进行生成。

---

## 字幕对齐与烧录

使用 `ffsubsync` 自动对齐字幕与旁白时间。将字幕作为样式化的 ASS 字幕烧录到最终视频中。可选、可配置且完全自动化。

```bash
# 在项目配置中设置
rilo --project demo --story-file ./story.txt
```

---

## 预览仪表板

启动本地 Web 仪表板，用于项目管理、实时状态监控、工件预览和定向重新生成。

```bash
rilo preview
rilo preview --port 4000 --no-open
```

API 服务器、后台工作者和 Vite React 前端——全部在一个命令中启动。在浏览器中查看作业历史、检查工件并触发重新生成。

---

## HTTP API 与 Webhook

将 Rilo 作为服务运行。Bearer 令牌认证。OpenAPI 3.1 规范用于模式驱动的集成。Webhook 订阅用于作业生命周期事件。

- 运行 `npm run api` 时，**Swagger UI** 位于 `/docs`
- **OpenAPI JSON** 位于 `/openapi.json`
- **Webhook 事件**用于作业创建、阶段完成、作业结束、作业失败
- **Firebase Functions** 适配器用于无服务器部署

---

## 跨平台

可在 macOS、Linux 和 Windows 上运行。需要 Node.js 22+ 和 `ffmpeg` 在 PATH 中。

---

## 准备好生成您的第一个视频了吗？

[开始使用 →](./getting-started/installation.md)

或直接跳转到[快速开始](./getting-started/quickstart.md)和 [CLI 参考](./reference/cli-reference.md)。