---
slug: /guides/model-adapters-and-options
sidebar_position: 2
title: Model Adapters and Options
---

Rilo uses adapter modules to normalize model-specific inputs:
- text-to-image adapters
- image-to-video adapters

This allows swapping models without changing orchestration logic.

## How options are applied

- `models` selects which provider model is used per category.
- `modelOptions` is resolved against the selected model metadata.
- Unknown keys, invalid types, and out-of-range values are rejected.

## Categories

- `textToText`: script generation model options
- `textToSpeech`: voice and speech controls
- `textToImage`: keyframe generation options
- `imageTextToVideo`: segment generation options

## Recommended tuning workflow

1. Start with default models and no overrides.
2. Add one option at a time in `modelOptions`.
3. Run a short project and inspect output quality and runtime.
4. Save stable presets in project config for repeatability.

See:
- [Model Catalog](/reference/model-catalog)
- [Configuration](/guides/configuration)
- [Troubleshooting](/guides/troubleshooting)
