---
slug: /
title: Rilo
sidebar_label: Welcome
sidebar_position: 0
---

import HomepageFeatures from '@site/src/components/HomepageFeatures';

Rilo is a story-first vertical video generation pipeline.

It turns a story into script, narration, keyframes, segments, and a final composed video with optional subtitle alignment and burn-in.

## Quickstart

```bash
npm install
cp .env.example .env
npm run dev:all
```

Set credentials either in `.env` or interactively:

```bash
npm run dev -- settings
```

```bash
rilo --project demo --story-file ./story.txt
```

If you prefer API-driven runs, start the HTTP server with `npm run api` and check:
- Swagger UI at `/docs`
- OpenAPI JSON at `/openapi.json`

## Sections

- Getting Started: install and first run
- Guides: pipeline workflows and operation
- Reference: CLI, env vars, models, artifacts, API auth/webhooks
- Technical: architecture and run-state internals
- Contributing: development and docs/release process

## Recommended Reading Path

1. [Installation](/getting-started/installation)
2. [Quickstart](/getting-started/quickstart)
3. [Configuration](/guides/configuration)
4. [Pipeline Stages](/guides/pipeline-stages)
5. [Regeneration and Invalidation](/guides/regeneration-and-invalidation)
6. [Glossary](/reference/glossary)

<HomepageFeatures />
