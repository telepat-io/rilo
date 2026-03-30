---
slug: /guides/deployment-backends
sidebar_position: 9
title: Deployment Backends
---

Rilo supports:
- local backend (default)
- firebase backend (Firestore + Cloud Storage)

Core backend env vars:

```bash
RILO_OUTPUT_BACKEND=local
RILO_FIREBASE_PROJECT_ID=
RILO_FIREBASE_STORAGE_BUCKET=
RILO_FIREBASE_CLIENT_EMAIL=
RILO_FIREBASE_PRIVATE_KEY=
```

## Local backend

Use `RILO_OUTPUT_BACKEND=local` for filesystem-only development.
Artifacts and state are stored under project directories.

## Firebase backend

Use `RILO_OUTPUT_BACKEND=firebase` to mirror project state to Firestore and assets to Cloud Storage.

Recommended setup:
1. Create a service account with Firestore + Storage access.
2. Provide project ID, bucket, client email, and private key env vars.
3. Verify bucket permissions for upload/read operations.

If Firebase credentials are missing or invalid, writes and sync operations fail.

See [Environment Variables](/reference/environment-variables) for full runtime config.
