---
slug: /guides/story-format-and-script-generation
sidebar_position: 3
title: Story Format and Script Generation
---

Provide a clear story with context, beats, and desired tone.

Rilo script generation targets duration and can retry when output length is outside target bounds.

Tips for story input:
- Include setting, timeline, and key turning points.
- Prefer concrete details over abstract prompts.
- Keep one clear narrative arc per project.

Visual planning uses measured narration duration:

`segments = ceil(audioDurationSec / 5)`

This keeps visuals from ending before narration.

Related pages:
- [Pipeline Stages](/guides/pipeline-stages)
- [Regeneration and Invalidation](/guides/regeneration-and-invalidation)
