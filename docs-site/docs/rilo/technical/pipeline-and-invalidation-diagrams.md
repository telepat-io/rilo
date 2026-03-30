---
slug: /technical/pipeline-and-invalidation-diagrams
sidebar_position: 2
title: Pipeline and Invalidation Diagrams
---

This page provides a compact visual reference for stage flow, checkpointing, and invalidation.

## Pipeline Flow

```text
story input
   |
   v
[script] -> [voiceover] -> [keyframes] -> [segments] -> [compose]
                                                     |
                                                     v
                                          [align subtitles] (optional)
                                                     |
                                                     v
                                           [burn-in subtitles] (optional)
```

Notes:
- Segment count is planned from measured voiceover duration.
- Each stage persists artifacts before the next stage starts.

## Checkpoint and Resume Model

```text
run-state.json
  - stage completion flags
  - status/error
  - last update timestamp

artifacts.json
  - script/tone/shots
  - media URLs/paths
  - final outputs and subtitle artifacts
```

Resume rule:
- If required artifacts exist and are valid, completed stages are reused.
- If artifacts are missing/invalid, regeneration starts from the earliest required stage.

## Invalidation Cascade

```text
story/script change
  => voiceover, keyframes, segments, compose, align, burn-in

text-to-image model/options change
  => keyframes, segments, compose, align, burn-in

image-to-video model/options change
  => segments, compose, align, burn-in

subtitle options change
  => align, burn-in
```

## Operational Guardrail

A project-level run lock prevents concurrent writes to the same project.
Use separate projects for parallel experiments.

See also:
- [Pipeline Stages](/guides/pipeline-stages)
- [Regeneration and Invalidation](/guides/regeneration-and-invalidation)
- [Orchestrator and Checkpointing](/technical/orchestrator-and-checkpointing)
