---
slug: /technical/orchestrator-and-checkpointing
sidebar_position: 2
title: Orchestrator and Checkpointing
---

The orchestrator coordinates stage execution and persists checkpoints so runs can resume.

Checkpointing enables:
- deterministic recovery after failure
- partial reruns after upstream edits
- stable project-level artifacts across retries

## What is checkpointed

Per project run, Rilo persists:
- stage completion state in `run-state.json`
- generated outputs and paths in `artifacts.json`
- local media files in `assets/`

## Resume behavior

If a run is restarted for the same project:
- completed stages are reused when artifacts are valid
- missing or invalid artifacts trigger regeneration from the earliest required stage
- downstream stages remain invalidated until prerequisites are rebuilt

## Run locking

Rilo applies a project-level run lock to prevent concurrent mutations on the same project.
If a project is already running, new run/regeneration requests should wait.

See:
- [Pipeline Stages](/guides/pipeline-stages)
- [Regeneration and Invalidation](/guides/regeneration-and-invalidation)
