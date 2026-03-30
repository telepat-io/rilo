---
slug: /guides/troubleshooting
sidebar_position: 10
title: Troubleshooting
---

Common checks:
- RILO_REPLICATE_API_TOKEN present and valid
- ffmpeg available in PATH
- model IDs and modelOptions valid for selected adapters
- API bearer token sent for protected endpoints

For debugging, inspect project logs plus run-state and artifact files.

## Frequent failures

- `story is required` or short story validation errors:
	provide a longer, clearer story input.
- unauthorized API responses:
	send `Authorization: Bearer <RILO_API_BEARER_TOKEN>`.
- long-running predictions timing out:
	increase `PREDICTION_MAX_WAIT_MS` and confirm provider quotas.
- download failures:
	verify `DOWNLOAD_ALLOWED_HOSTS`, timeout, and max-bytes settings.

## Fast triage checklist

1. Check project logs endpoint for the latest error.
2. Inspect `run-state.json` for the last completed stage.
3. Inspect `artifacts.json` for missing output paths/URLs.
4. Retry targeted regeneration from the failed stage.

See:
- [Environment Variables](/reference/environment-variables)
- [Regeneration and Invalidation](/guides/regeneration-and-invalidation)
