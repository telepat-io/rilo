---
slug: /features
title: "Turn a Story Into a Finished Video"
description: What Rilo can do for creators and teams who need reproducible video generation at scale.
keywords: [rilo, features, video generation, ai video, text-to-video, vertical video]
sidebar_label: Features
sidebar_position: 1
---

# Turn a Story Into a Finished Video

Rilo turns a plain text story into a finished video — AI-generated script, voiceover, keyframes, and composition, all in one command.

Built for creators and teams who need reproducible, high-quality video at scale without manual editing.

---

## Full Pipeline, One Command

Write your story in plain text. Rilo handles the rest:

**Script generation → Voiceover synthesis → Keyframe rendering → Segment generation → Final composition**

No manual stitching. No timeline editing. One command from story to finished video.

```bash
rilo --project demo --story-file ./story.txt
```

---

## Checkpointed Runs

Every stage saves checkpointed artifacts. Resume an interrupted run from where it left off. Regenerate just the segments if you changed a model. Re-render only keyframes if you tweaked prompts.

```bash
rilo --project demo                         # resume from last checkpoint
rilo --project demo --force                 # restart from earlier stages
rilo --project demo --force --full-run      # skip keyframe review, run all stages
```

Fine-grained control without starting over.

---

## Your Models, Your Control

Choose your text-to-image and image-to-video models. Override per-model options for full creative control. Switch models between runs without changing your story.

Rilo's model adapter system maps your story context to each model's native input format — you don't need to learn model-specific APIs.

---

## Code-Driven Pipeline

Deterministic code handles job orchestration, checkpointing, artifact management, and state tracking. Your tokens go toward creative generation — script writing, image rendering, and video synthesis — not toward infrastructure overhead.

No context windows burned on file I/O. No tokens wasted on orchestration chatter. Just generation where it counts.

---

## Subtitle Alignment & Burn-In

Auto-align subtitles to voiceover timing with `ffsubsync`. Burn them into the final video as styled ASS subtitles. Optional, configurable, and fully automated.

```bash
# Configure in your project config
rilo --project demo --story-file ./story.txt
```

---

## Preview Dashboard

Start a local web dashboard for project management, live status monitoring, asset preview, and targeted regeneration.

```bash
rilo preview
rilo preview --port 4000 --no-open
```

Api server, background worker, and Vite React frontend — all started in one command. View job history, inspect artifacts, and trigger regenerations from your browser.

---

## HTTP API & Webhooks

Run Rilo as a service. Bearer-token authentication. OpenAPI 3.1 spec for schema-driven integration. Webhook subscriptions for job lifecycle events.

- **Swagger UI** at `/docs` when running `npm run api`
- **OpenAPI JSON** at `/openapi.json`
- **Webhook events** for job created, stage completed, job finished, job failed
- **Firebase Functions** adapter for serverless deployment

---

## Cross-Platform

Runs on macOS, Linux, and Windows. Requires Node.js 22+ and `ffmpeg` in PATH.

---

## Ready to Generate Your First Video?

[Get Started →](./getting-started/installation.md)

Or jump straight to the [Quickstart](./getting-started/quickstart.md) and [CLI Reference](./reference/cli-reference.md).
