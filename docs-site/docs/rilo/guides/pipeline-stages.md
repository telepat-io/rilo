---
slug: /guides/pipeline-stages
sidebar_position: 4
title: Pipeline Stages
---

Stage order:
1. script
2. voiceover
3. keyframes
4. segments
5. compose final video
6. subtitle alignment (optional)
7. subtitle burn-in (optional)

Each stage writes artifacts and updates run state for safe resume.

## Stage dependencies

- `voiceover` depends on generated script.
- `keyframes` depend on script shots/prompts.
- `segments` depend on keyframe outputs and prompt context.
- `compose` depends on voiceover plus generated segments.

## Runtime behavior

- Segment count is derived from measured voiceover duration.
- Completed stage artifacts are reused when valid.
- If a required artifact is missing, Rilo regenerates from the earliest necessary stage.

## State and artifacts

Main files under `projects/<project>/`:
- `run-state.json`: stage completion and resume state
- `artifacts.json`: generated paths/URLs and timeline data
- `assets/`: downloaded and generated media

See:
- [Regeneration and Invalidation](/guides/regeneration-and-invalidation)
- [Output Artifacts](/reference/output-artifacts)
- [Pipeline and Invalidation Diagrams](/technical/pipeline-and-invalidation-diagrams)
