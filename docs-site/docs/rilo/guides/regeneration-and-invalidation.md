---
slug: /guides/regeneration-and-invalidation
sidebar_position: 5
title: Regeneration and Invalidation
---

Rilo supports partial reruns by invalidating downstream stages when upstream inputs change.

Examples:
- story/script edits invalidate voiceover and all following visual stages
- keyframe model or prompt edits invalidate keyframes and later stages

Use project regenerate APIs for targeted reruns instead of full project recreation.

## Common invalidation patterns

- `PATCH /projects/:project/content` with story/script changes:
  voiceover, keyframes, segments, and compose are invalidated.
- model selection or model option changes:
  invalidation starts at the affected category (or earlier if needed).
- subtitle option changes:
  subtitle alignment and burn-in outputs are invalidated.

## Targeted regeneration

Use `POST /projects/:project/regenerate` for scoped reruns.
This is ideal when only one keyframe or segment needs to be replaced.

## Concurrency note

Rilo enforces a project run lock. If a project already has an active run,
regeneration requests should wait or use a different project.

See [Pipeline and Invalidation Diagrams](/technical/pipeline-and-invalidation-diagrams) for visual flow.
