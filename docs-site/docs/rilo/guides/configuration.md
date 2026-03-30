---
slug: /guides/configuration
sidebar_position: 1
title: Configuration
---

Rilo project configuration lives in `config.json`.

Example:

```json
{
	"aspectRatio": "9:16",
	"targetDurationSec": 60,
	"finalDurationMode": "match_audio",
	"keyframeWidth": 576,
	"keyframeHeight": 1024,
	"models": {
		"textToText": "deepseek-ai/deepseek-v3",
		"textToSpeech": "minimax/speech-02-turbo",
		"textToImage": "prunaai/z-image-turbo",
		"imageTextToVideo": "wan-video/wan-2.2-i2v-fast"
	},
	"modelOptions": {
		"textToImage": {
			"num_inference_steps": 8,
			"output_format": "jpg"
		}
	}
}
```

Key fields:
- `aspectRatio`: `1:1`, `16:9`, `9:16`
- `targetDurationSec`: target narration/script duration
- `finalDurationMode`: `match_audio` or `match_visual`
- `models`: selected model per category
- `modelOptions`: validated per selected model

Notes:
- `targetDurationSec` influences script planning and downstream segment count.
- Segment count is derived from measured narration duration and fixed 5-second segments.
- `keyframeWidth` and `keyframeHeight` must be provided together when overriding size.
- Missing model selections are filled from defaults.

Defaults are loaded from model catalog metadata in models/.

See also:
- [Model Adapters and Options](/guides/model-adapters-and-options)
- [Environment Variables](/reference/environment-variables)
