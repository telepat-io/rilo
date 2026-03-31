---
slug: /guides/troubleshooting
sidebar_position: 10
title: Troubleshooting
---

## Quick Triage

**Most common issues:**
1. Missing or incorrect API tokens `RILO_REPLICATE_API_TOKEN`
2. ffmpeg/ffprobe not in PATH or misconfigured
3. Model IDs or modelOptions invalid or incompatible with selected adapters
4. Predictions timing out (increase `PREDICTION_MAX_WAIT_MS`)
5. Download failures (check `DOWNLOAD_ALLOWED_HOSTS`, timeout, and max-bytes settings)

**Start here:**
```bash
rilo settings
# Verify Replicate API Token is set ✓
# Verify ffmpeg and ffprobe paths are correct ✓
# Check Max Prediction Wait (increase if needed) ✓
```

---

## CLI Errors

### "Missing --project argument"

**Error message:**
```
Error: Missing --project argument
```

**Cause:** The `--project` flag was omitted.

**Solution:**
```bash
# Correct usage:
rilo --project housing-case --story-file ./story.txt

# Not:
rilo --story-file ./story.txt  # Missing --project
```

### "Project story.md not found"

**Error message:**
```
Error: Project story.md not found. Provide --story-file once to initialize the project.
```

**Cause:** The project exists but has no `story.md`. Rilo either couldn't find the story or it wasn't saved on first run.

**Solutions:**
1. Provide `--story-file` on the next run:
   ```bash
   rilo --project housing-case --story-file ./my-story.txt
   ```

2. Manually check the project directory:
   ```bash
   ls -la projects/housing-case/
   ```
   If `story.md` is missing, recreate it from a text file.

3. Verify the project directory was created successfully:
   ```bash
   cat projects/housing-case/config.json  # Should exist
   ```

### "Validation error: invalid model ID" or "Unknown model"

**Error message:**
```
Error: Model "invalid-model-name" is not recognized or not supported
```

**Cause:** A model ID in `projects/<project>/config.json` doesn't exist in the model catalog.

**Solution:**
1. List available models:
   ```bash
   ls models/ | head -10
   # See: deepseek-ai__deepseek-v3.json, minimax__speech-02-turbo.json, etc.
   ```

2. Edit the config with valid model IDs:
   ```bash
   cat projects/housing-case/config.json | jq '.models'
   # Check format: "org/name" becomes "org__name" in models/ directory
   ```

3. Use `rilo settings` to verify available defaults (not yet UI-driven, but documented in the model catalog).

### "Invalid modelOption parameter"

**Error message:**
```
Warning: modelOption "unknown_param" for textToImage is not recognized
```

**Cause:** A parameter in `modelOptions` is not supported by the selected model's adapter.

**Solution:**
1. See [Model Adapters and Options](/guides/model-adapters-and-options) for valid parameters per model and category.

2. Common model options that work:
   - **textToImage** (Flux): `num_inference_steps`, `guidance_scale`, `output_format`
   - **textToImage** (Z-Image): `num_inference_steps`, `output_format`, `output_quality`
   - **imageTextToVideo** (Kling): `interpolate_output`, `go_fast`
   - **imageTextToVideo** (Wan): `sample_shift`, `go_fast`, `disable_safety_checker`

3. Remove unrecognized parameters or update the model selection.

### "unauthorized" or "invalid API token"

**Error message:**
```
Error: Replicate API returned: unauthorized
```

**Cause:**
- API token missing or incorrect
- Token doesn't have permission or is revoked
- Token precedence issue (env var vs. saved setting)

**Solutions:**
1. Check token is set:
   ```bash
   echo $RILO_REPLICATE_API_TOKEN  # or $REPLICATE_API_TOKEN
   ```

2. Verify via `rilo settings`:
   ```bash
   rilo settings
   # Navigate to "Replicate API Token" and check it's populated
   ```

3. If setting via env var, ensure it's exported:
   ```bash
   export RILO_REPLICATE_API_TOKEN=r8_xxxxx
   rilo --project demo --story-file ./story.txt

   # Not:
   RILO_REPLICATE_API_TOKEN=r8_xxxxx rilo ...  # May not work in all shells
   ```

4. Verify token on [replicate.com](https://replicate.com/account/api-tokens).

5. Precedence: Env var > ~/.rilo/config.json > default. If an env var is set, the `rilo settings` menu shows it as read-only.

### "ffmpeg/ffprobe not found" or "command not found"

**Error message:**
```
Error: ffmpeg not found. Install ffmpeg or set FFMPEG_BIN in settings.
```

**Cause:**
- ffmpeg/ffprobe not in PATH
- Binary path misconfigured in settings
- Binary not installed

**Solutions:**
1. Install ffmpeg (if not already installed):
   ```bash
   # macOS
   brew install ffmpeg

   # Linux (Ubuntu/Debian)
   sudo apt-get install ffmpeg

   # Windows
   choco install ffmpeg
   # Or download from ffmpeg.org
   ```

2. Verify installation:
   ```bash
   which ffmpeg
   which ffprobe
   ffmpeg -version
   ```

3. Configure in `rilo settings`:
   ```bash
   rilo settings
   # Navigate to "ffmpeg Binary", enter full path: /usr/local/bin/ffmpeg
   # Or if in PATH, just: ffmpeg
   ```

4. Set via env var:
   ```bash
   export FFMPEG_BIN=/usr/local/bin/ffmpeg
   rilo --project demo --story-file ./story.txt
   ```

---

## Prediction & Network Issues

### "Prediction timed out"

**Error message:**
```
Error: Prediction timed out after 600000ms
```

**Cause:**
- Prediction takes longer than `PREDICTION_MAX_WAIT_MS`
- Network connectivity issues
- Provider experiencing slow inference
- High queue on the provider's side

**Solutions:**
1. Increase timeout:
   ```bash
   rilo settings
   # Navigate to "Max Prediction Wait (ms)"
   # Increase from 600000 to 900000 (15 min) or higher
   ```

   Or via env var:
   ```bash
   export PREDICTION_MAX_WAIT_MS=900000
   rilo --project demo --story-file ./story.txt
   ```

2. Retry with `--force`:
   ```bash
   rilo --project demo --force
   # Restarts from the failed stage
   ```

3. Check network and provider status:
   - Verify internet connectivity
   - Check Replicate status page

### "Download failed" or "exceeds max file size"

**Error message:**
```
Error: Downloaded file (120MB) exceeds DOWNLOAD_MAX_BYTES (104857600)
```

**Cause:**
- File is larger than `DOWNLOAD_MAX_BYTES`
- Download timeout exceeded
- Download host not in `DOWNLOAD_ALLOWED_HOSTS`

**Solutions:**
1. Increase max download size:
   ```bash
   rilo settings
   # Navigate to "Download Max Size (bytes)"
   # Increase from 104857600 (100 MB) to 209715200 (200 MB) or more
   ```

   Or via env var:
   ```bash
   export DOWNLOAD_MAX_BYTES=209715200
   rilo --project demo --story-file ./story.txt
   ```

2. Increase download timeout:
   ```bash
   export DOWNLOAD_TIMEOUT_MS=30000
   ```

3. Check allowed hosts:
   ```bash
   rilo settings
   # View "Download Allowed Hosts" — should include domains where files are hosted
   # Default: replicate.delivery,replicate.com
   ```

4. Add custom hosts if needed:
   ```bash
   cat ~/.rilo/config.json | jq .downloadAllowedHosts
   # Edit if necessary to include your CDN
   ```

---

## Generation & Stage Failures

### "Story validation failed" or "Story is too short"

**Error message:**
```
Error: Story is required and must be at least 50 characters
```

**Cause:**
- Story is empty or too short
- Story doesn't have enough detail for script generation

**Solution:**
- Provide a longer, clearer story (aim for 200+ characters):
  ```bash
  cat > story.txt <<'EOF'
  A young couple discovers they share a love of gardening when they meet at a community plot.
  Over months, they grow vegetables and flowers together, learning about each other through patient care.
  When spring arrives, their garden blooms in full colour, and so does their relationship.
  They decide to get married and promise to grow old together, like the perennial plants they've nurtured.
  EOF

  rilo --project garden-case --story-file ./story.txt
  ```

### "Script generation failed" or "LLM returned error"

**Error message:**
```
Error: Script generation failed: LLM returned status 400
```

**Cause:**
- Script model (e.g., DeepSeek) returned an error
- LLM-specific issue (rate limit, invalid parameters, quota exceeded)
- Network error reaching model provider

**Solutions:**
1. Wait and retry:
   ```bash
   rilo --project demo --force
   # Restarts from script stage
   ```

2. Increase retry count:
   ```bash
   export MAX_RETRIES=5
   export RETRY_DELAY_MS=5000
   rilo --project demo --force
   ```

3. Check LLM model options compatibility:
   ```bash
   cat projects/demo/config.json | jq '.modelOptions.textToText'
   # Verify parameters like max_tokens, temperature, etc. are valid for the model
   ```

4. Try a different model:
   ```bash
   # Edit projects/demo/config.json
   # Change "models.textToText" to another model (e.g., "gpt-4" if available)
   rilo --project demo --force
   ```

### "Keyframe/segment generation failure"

**Error message:**
```
Error: Image generation failed: model returned error
```

**Cause:**
- Image/video model returned error or timeout
- Model parameters incompatible with the selected model
- Safety checker or output format not supported

**Solutions:**
1. Retry with increased timeout:
   ```bash
   export PREDICTION_MAX_WAIT_MS=900000
   rilo --project demo --force
   ```

2. Review and adjust model options:
   ```bash
   cat projects/demo/config.json | jq '.modelOptions'
   # Remove problematic parameters
   rilo --project demo --force
   ```

3. Switch to a faster/more stable model:
   ```bash
   # Edit projects/demo/config.json
   # "textToImage": "black-forest-labs/flux-schnell"  # Faster than flux-pro
   rilo --project demo --force
   ```

4. Check composition/output settings:
   ```bash
   cat projects/demo/config.json | jq '{aspectRatio, keyframeWidth, keyframeHeight}'
   # Verify dimensions are reasonable (≥ 512 each)
   ```

### "Composition failed" or "Final video creation error"

**Error message:**
```
Error: Composition failed: could not create final video
```

**Cause:**
- ffmpeg error during composition
- Audio/video codec mismatch
- Disk space issue
- Subtitle burn-in failed (if enabled)

**Solutions:**
1. Check disk space:
   ```bash
   df -h
   # Should have at least 2–5 GB free for a typical video
   ```

2. Verify ffmpeg:
   ```bash
   ffmpeg -version
   ffprobe -version
   ```

3. If subtitles are enabled, disable and retry:
   ```bash
   cat projects/demo/config.json | jq '.subtitleOptions.enabled'
   # Set to false and remove subtitleOptions or set enabled: false
   rilo --project demo --force
   ```

4. Check assets:
   ```bash
   ls -lh projects/demo/assets/
   # Verify audio and video segments exist and are not empty
   ```

---

## Logging and Debugging

### Check project logs endpoint (HTTP API)

```bash
curl -H "Authorization: Bearer $RILO_API_BEARER_TOKEN" \
  http://localhost:3000/projects/demo/logs?limit=50
```

### Inspect run-state.json

```bash
cat projects/demo/run-state.json | jq '.stages'
# Shows which stages completed successfully
# Last stage indicates where it failed
```

### Inspect artifacts.json

```bash
cat projects/demo/artifacts.json | jq 'keys'
# Lists all saved artifacts (audio, keyframes, segments, final video, etc.)
# Missing keys indicate which stage failed
```

### Enable verbose logging (environment-based)

Set `DEBUG=rilo:*` to see detailed logs:
```bash
export DEBUG=rilo:*
rilo --project demo --force
```

Or check the generated logs directory:
```bash
ls -la projects/demo/logs/
cat projects/demo/logs/generation-YYYY-MM-DD.log
```

---

## Fast Triage Checklist

1. ✓ Check project logs endpoint for the latest error:
   ```bash
   curl http://localhost:3000/projects/demo/logs
   ```

2. ✓ Inspect `run-state.json` for the last completed stage:
   ```bash
   cat projects/demo/run-state.json | jq '.stages | keys[-1]'
   ```

3. ✓ Inspect `artifacts.json` for missing output paths/URLs:
   ```bash
   cat projects/demo/artifacts.json | jq 'keys'
   ```

4. ✓ Retry targeted regeneration from the failed stage:
   ```bash
   rilo --project demo --force
   ```

5. ✓ Verify app settings:
   ```bash
   rilo settings
   # Review tokens, timeouts, binary paths
   ```

---

## See Also

- [CLI Reference](/reference/cli-reference) — All commands and flags
- [Configuration](/guides/configuration) — Project and app settings
- [Environment Variables](/reference/environment-variables) — Setting precedence and examples
- [Regeneration and Invalidation](/guides/regeneration-and-invalidation) — When to use `--force`
- [Pipeline Stages](/guides/pipeline-stages) — Detailed stage breakdown and outputs
