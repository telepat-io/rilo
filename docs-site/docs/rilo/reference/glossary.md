---
slug: /reference/glossary
sidebar_position: 4
title: Glossary
---

This glossary standardizes key terms used throughout the Rilo docs.

## Core terms

- Stage:
  a pipeline phase such as script, voiceover, keyframes, segments, compose, align subtitles, or burn-in subtitles.
- Run state:
  persisted stage status and run metadata in `run-state.json`.
- Artifact:
  generated output metadata (paths, URLs, timeline, prompts) persisted in `artifacts.json`.
- Project:
  the named workspace under `projects/<project>/` containing config, content, artifacts, run state, and assets.
- Regeneration:
  rerunning one or more downstream stages after targeted changes.
- Invalidation:
  marking downstream stages as stale when upstream inputs change.
- Run lock:
  project-level lock preventing concurrent writes for the same project.

## API terms

- Jobs API:
  endpoints under `/jobs` to start a run and fetch job status.
- Projects API:
  endpoints under `/projects` for project CRUD, config/content updates, logs, artifacts, analytics, and targeted regeneration.
- Webhook:
  callback endpoint (`/webhooks/replicate`) receiving external prediction updates.

## File-level references

- `config.json`: project configuration and model selections/options.
- `story.md`: source story input.
- `run-state.json`: stage completion and run metadata.
- `artifacts.json`: generated outputs and references.
- `assets/`: downloaded/generated media files.
