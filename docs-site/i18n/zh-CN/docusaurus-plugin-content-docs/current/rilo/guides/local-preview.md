---
slug: /guides/local-preview
sidebar_position: 8
title: 本地预览
---

前端应用程序提供项目 CRUD、轮询、定向重新生成和媒体预览。

运行完整的本地堆栈：

```bash
npm run dev:all
```

前端默认 URL 为 `http://localhost:5173`。

`npm run dev:all` 启动：
- API 服务器
- 工作进程处理器
- 前端开发服务器

如果您分别运行服务，请先启动 API 和工作进程，然后启动前端。

快速健康检查：
- API 健康状态：`GET /health`
- API 文档：`GET /docs`