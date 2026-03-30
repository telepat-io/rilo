---
slug: /technical/architecture
sidebar_position: 1
title: Architecture
---

Rilo architecture centers on a pipeline orchestrator with isolated stage modules.

Main areas:
- orchestrator and run-state transitions
- generation stages and adapter registries
- API routes and auth middleware
- storage backends and syncing
- worker processing loop

Core runtime loop:
1. API or CLI creates/resumes a project run.
2. Orchestrator executes generation stages in order.
3. Artifacts and run state are persisted after each stage.
4. Regeneration requests invalidate downstream stages only.

See also:
- [Pipeline and Invalidation Diagrams](/technical/pipeline-and-invalidation-diagrams)
- [Orchestrator and Checkpointing](/technical/orchestrator-and-checkpointing)
