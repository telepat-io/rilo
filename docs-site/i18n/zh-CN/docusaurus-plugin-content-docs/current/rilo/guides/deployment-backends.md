---
slug: /guides/deployment-backends
sidebar_position: 9
title: 部署后端
---

Rilo 支持：
- 本地后端（默认）
- Firebase 后端（Firestore + Cloud Storage）

核心后端环境变量：

```bash
RILO_OUTPUT_BACKEND=local
RILO_FIREBASE_PROJECT_ID=
RILO_FIREBASE_STORAGE_BUCKET=
RILO_FIREBASE_CLIENT_EMAIL=
RILO_FIREBASE_PRIVATE_KEY=
```

## 本地后端

使用 `RILO_OUTPUT_BACKEND=local` 进行仅文件系统开发。
工件和状态存储在项目目录下。

## Firebase 后端

使用 `RILO_OUTPUT_BACKEND=firebase` 将项目状态镜像到 Firestore，将资产镜像到 Cloud Storage。

推荐设置：
1. 创建具有 Firestore + Storage 访问权限的服务帐户。
2. 提供项目 ID、存储桶、客户端电子邮件和私钥环境变量。
3. 验证存储桶的上传/读取操作权限。

如果 Firebase 凭据缺失或无效，写入和同步操作将失败。

有关完整的运行时配置，请参阅[环境变量](/reference/environment-variables)。