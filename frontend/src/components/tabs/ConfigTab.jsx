import { useEffect, useMemo, useState } from 'react';
import { ModelConfigSection } from '../ui/ModelConfigSection.jsx';
import { ComboBox } from '../ui/ComboBox.jsx';

const SUBTITLE_FONT_OPTIONS = [
  'Arial',
  'Helvetica',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Gill Sans',
  'Futura',
  'Avenir Next',
  'Bebas Neue',
  'Oswald',
  'Poppins',
  'Roboto',
  'Open Sans',
  'Lato',
  'Noto Sans',
  'Source Sans Pro',
  'Inter',
  'Times New Roman',
  'Georgia'
];

const SUBTITLE_TEMPLATE_PRESETS = [
  {
    id: 'custom',
    label: 'Custom (no preset)',
    description: 'Start from your current caption style without applying a template.',
    defaults: null
  },
  {
    id: 'social_center_punch',
    label: 'Social Center Punch',
    description: 'Few words, center emphasis, thick border, high contrast.',
    defaults: {
      position: 'center',
      fontName: 'Bebas Neue',
      fontSize: 108,
      bold: true,
      italic: false,
      makeUppercase: true,
      primaryColor: '#ffffff',
      activeColor: '#ffe066',
      outlineColor: '#111111',
      outline: 4,
      shadow: 0,
      backgroundEnabled: true,
      backgroundColor: '#000000',
      backgroundOpacity: 0.45,
      marginV: 120,
      maxWordsPerLine: 4,
      maxLines: 2,
      highlightMode: 'spoken_upcoming'
    }
  },
  {
    id: 'social_center_clean',
    label: 'Social Center Clean',
    description: 'Centered captions with cleaner typography and lighter border.',
    defaults: {
      position: 'center',
      fontName: 'Poppins',
      fontSize: 92,
      bold: true,
      italic: false,
      makeUppercase: true,
      primaryColor: '#ffffff',
      activeColor: '#9ae6ff',
      outlineColor: '#111111',
      outline: 3,
      shadow: 0,
      backgroundEnabled: true,
      backgroundColor: '#000000',
      backgroundOpacity: 0.45,
      marginV: 120,
      maxWordsPerLine: 4,
      maxLines: 2,
      highlightMode: 'current_only'
    }
  },
  {
    id: 'social_center_story',
    label: 'Social Center Story',
    description: 'Centered storytelling style with calmer emphasis and roomier pacing.',
    defaults: {
      position: 'center',
      fontName: 'Avenir Next',
      fontSize: 82,
      bold: true,
      italic: false,
      makeUppercase: true,
      primaryColor: '#ffffff',
      activeColor: '#b8f2ff',
      outlineColor: '#111111',
      outline: 3,
      shadow: 0,
      backgroundEnabled: true,
      backgroundColor: '#000000',
      backgroundOpacity: 0.4,
      marginV: 108,
      maxWordsPerLine: 5,
      maxLines: 2,
      highlightMode: 'current_only'
    }
  }
];

const TEXT_TO_IMAGE_MODEL_IDS = {
  pruna: 'prunaai/z-image-turbo',
  flux: 'black-forest-labs/flux-2-pro',
  fluxSchnell: 'black-forest-labs/flux-schnell',
  nanoBananaPro: 'google/nano-banana-pro',
  seedream4: 'bytedance/seedream-4'
};

const IMAGE_TO_VIDEO_MODEL_IDS = {
  wan: 'wan-video/wan-2.2-i2v-fast',
  klingV3: 'kwaivgi/kling-v3-video',
  pixverseV56: 'pixverse/pixverse-v5.6',
  veo31: 'google/veo-3.1',
  veo31Fast: 'google/veo-3.1-fast'
};

const TTS_MODEL_IDS = {
  minimax: 'minimax/speech-02-turbo',
  chatterboxTurbo: 'resemble-ai/chatterbox-turbo',
  kokoro82m: 'jaaari/kokoro-82m'
};

const MINIMAX_OPTION_KEYS = [
  'emotion', 'pitch', 'speed', 'volume', 'voice_id', 'audio_format',
  'sample_rate', 'bitrate', 'channel', 'language_boost', 'subtitle_enable', 'english_normalization'
];
const CHATTERBOX_OPTION_KEYS = ['voice', 'temperature', 'top_p', 'top_k', 'repetition_penalty', 'seed'];
const KOKORO_OPTION_KEYS = ['voice', 'speed'];

const CHATTERBOX_VOICES = [
  'Aaron','Abigail','Anaya','Andy','Archer','Brian','Chloe','Dylan','Emmanuel',
  'Ethan','Evelyn','Gavin','Gordon','Ivan','Laura','Lucy','Madison','Marisol','Meera','Walter'
];

const KOKORO_VOICES = [
  'af_alloy','af_aoede','af_bella','af_jessica','af_kore','af_nicole','af_nova','af_river',
  'af_sarah','af_sky','am_adam','am_echo','am_eric','am_fenrir','am_liam','am_michael',
  'am_onyx','am_puck','bf_alice','bf_emma','bf_isabella','bf_lily','bm_daniel','bm_fable',
  'bm_george','bm_lewis','ff_siwis','hf_alpha','hf_beta','hm_omega','hm_psi','if_sara',
  'im_nicola','jf_alpha','jf_gongitsune','jf_nezumi','jf_tebukuro','jm_kumo','zf_xiaobei',
  'zf_xiaoni','zf_xiaoxiao','zf_xiaoyi','zm_yunjian','zm_yunxi','zm_yunxia','zm_yunyang'
];

const KLING_USD_PER_SECOND = { standard: { withAudio: 0.252, withoutAudio: 0.168 }, pro: { withAudio: 0.336, withoutAudio: 0.224 } };
const PIXVERSE_USD_PER_SECOND = { '360p': 0.07, '540p': 0.07, '720p': 0.09, '1080p': 0.15 };
const VEO_USD_PER_SECOND = { standardWithoutAudio: 0.2, withoutAudio: 0.1 };

function resolveSubtitleTemplate(templateId) {
  return SUBTITLE_TEMPLATE_PRESETS.find((template) => template.id === templateId) || SUBTITLE_TEMPLATE_PRESETS[0];
}

function detectInstalledFonts(candidates) {
  if (typeof document === 'undefined') {
    return candidates;
  }

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    return candidates;
  }

  const testText = 'mmmmmmmmmmlliOO00';
  const testSize = '72px';
  const baseFonts = ['monospace', 'serif', 'sans-serif'];

  const widthFor = (fontFamily) => {
    context.font = `${testSize} ${fontFamily}`;
    return context.measureText(testText).width;
  };

  const baseWidths = Object.fromEntries(baseFonts.map((base) => [base, widthFor(base)]));

  return candidates.filter((font) => baseFonts.some((base) => widthFor(`"${font}", ${base}`) !== baseWidths[base]));
}

export function ConfigTab({
  configDraft,
  projectConfig,
  mediaW,
  mediaH,
  configDirty,
  savingConfig,
  isRunning,
  onPatchConfig,
  onPatchModel,
  onPatchModelOption,
  onPatchOptionalInt,
  onSaveConfig
}) {
  const models = configDraft?.models || {};
  const tttOptions = configDraft?.modelOptions?.textToText || {};
  const subtitleOptions = configDraft?.subtitleOptions || {};
  const [activeConfigTab, setActiveConfigTab] = useState('video');
  const [detectedSubtitleFonts, setDetectedSubtitleFonts] = useState(SUBTITLE_FONT_OPTIONS);
  const [subtitleFontDetectionReady, setSubtitleFontDetectionReady] = useState(false);

  useEffect(() => {
    const installedFonts = detectInstalledFonts(SUBTITLE_FONT_OPTIONS);
    setDetectedSubtitleFonts(installedFonts.length > 0 ? installedFonts : SUBTITLE_FONT_OPTIONS);
    setSubtitleFontDetectionReady(true);
  }, []);

  const subtitleFontOptions = useMemo(() => {
    const currentFont = String(subtitleOptions.fontName || '').trim();
    if (!currentFont) {
      return detectedSubtitleFonts;
    }
    return detectedSubtitleFonts.includes(currentFont)
      ? detectedSubtitleFonts
      : [currentFont, ...detectedSubtitleFonts];
  }, [detectedSubtitleFonts, subtitleOptions.fontName]);

  const selectedTemplate = resolveSubtitleTemplate(subtitleOptions.templateId || 'custom');
  const isHexColor = (value) => /^#[0-9a-fA-F]{6}$/.test(String(value || '').trim());
  const resolveColorValue = (value, fallback) => (isHexColor(value) ? value : fallback);
  const applySubtitleTemplate = (templateId) => {
    const template = resolveSubtitleTemplate(templateId);
    if (!template.defaults) {
      return;
    }

    onPatchConfig('subtitleOptions', {
      ...subtitleOptions,
      ...template.defaults,
      templateId: template.id,
      enabled: true
    });
  };

  // ── keyframe (text-to-image) model helpers ──────────────────────────────
  const t2iOptions = configDraft?.modelOptions?.textToImage || {};
  const textToImageModelId = models.textToImage || TEXT_TO_IMAGE_MODEL_IDS.pruna;

  function handleKeyframeModelChange(nextModelId) {
    onPatchModel('textToImage', nextModelId);
    const clear = (keys) => keys.forEach((k) => onPatchModelOption('textToImage', k, undefined));
    if (nextModelId === TEXT_TO_IMAGE_MODEL_IDS.flux) {
      clear(['num_inference_steps','guidance_scale','go_fast','num_outputs','disable_safety_checker','megapixels','resolution','safety_filter_level','allow_fallback_model','size','sequential_image_generation','max_images','enhance_prompt']);
    } else if (nextModelId === TEXT_TO_IMAGE_MODEL_IDS.fluxSchnell) {
      clear(['guidance_scale','safety_tolerance','num_inference_steps','output_format','resolution','safety_filter_level','allow_fallback_model','size','sequential_image_generation','max_images','enhance_prompt']);
    } else if (nextModelId === TEXT_TO_IMAGE_MODEL_IDS.nanoBananaPro) {
      clear(['num_inference_steps','guidance_scale','safety_tolerance','seed','go_fast','output_quality','num_outputs','disable_safety_checker','megapixels','output_format','size','sequential_image_generation','max_images','enhance_prompt']);
    } else if (nextModelId === TEXT_TO_IMAGE_MODEL_IDS.seedream4) {
      clear(['num_inference_steps','guidance_scale','safety_tolerance','seed','go_fast','output_quality','num_outputs','disable_safety_checker','megapixels','output_format','resolution','safety_filter_level','allow_fallback_model']);
    } else {
      clear(['safety_tolerance','num_outputs','disable_safety_checker','megapixels','resolution','safety_filter_level','allow_fallback_model','size','sequential_image_generation','max_images','enhance_prompt']);
    }
  }

  function renderKeyframeModelSpecificFields() {
    if (textToImageModelId === TEXT_TO_IMAGE_MODEL_IDS.flux) {
      return (<>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-safety">Safety Tolerance</label>
          <input id="cfg-kf-safety" type="number" className="config-input" min={1} max={5} step={1} placeholder="2" value={t2iOptions.safety_tolerance ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10); onPatchModelOption('textToImage', 'safety_tolerance', Number.isNaN(v) ? undefined : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-seed">Seed <span className="config-form-optional">(optional)</span></label>
          <input id="cfg-kf-seed" type="number" className="config-input" step={1} placeholder="random" value={t2iOptions.seed ?? ''} onChange={(e) => { const v = e.target.value === '' ? null : parseInt(e.target.value, 10); onPatchModelOption('textToImage', 'seed', Number.isNaN(v) ? null : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-output-format">Output Format</label>
          <select id="cfg-kf-output-format" className="config-select" value={t2iOptions.output_format ?? 'webp'} onChange={(e) => onPatchModelOption('textToImage', 'output_format', e.target.value)}>
            <option value="webp">webp</option><option value="png">png</option><option value="jpg">jpg</option><option value="jpeg">jpeg</option>
          </select>
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-quality">Output Quality</label>
          <input id="cfg-kf-quality" type="number" className="config-input" min={0} max={100} step={1} placeholder="80" value={t2iOptions.output_quality ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10); onPatchModelOption('textToImage', 'output_quality', Number.isNaN(v) ? undefined : v); }} />
        </div>
      </>);
    }
    if (textToImageModelId === TEXT_TO_IMAGE_MODEL_IDS.fluxSchnell) {
      return (<>
        <p className="muted size-sm">FLUX Schnell uses project <code>aspectRatio</code> and ignores custom <code>keyframeWidth</code>/<code>keyframeHeight</code> overrides.</p>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-num-outputs">Number of Outputs</label>
          <input id="cfg-kf-num-outputs" type="number" className="config-input" min={1} max={4} step={1} placeholder="1" value={t2iOptions.num_outputs ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10); onPatchModelOption('textToImage', 'num_outputs', Number.isNaN(v) ? undefined : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-steps">Inference Steps</label>
          <input id="cfg-kf-steps" type="number" className="config-input" min={1} max={4} step={1} placeholder="4" value={t2iOptions.num_inference_steps ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10); onPatchModelOption('textToImage', 'num_inference_steps', Number.isNaN(v) ? undefined : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-seed">Seed <span className="config-form-optional">(optional)</span></label>
          <input id="cfg-kf-seed" type="number" className="config-input" step={1} placeholder="random" value={t2iOptions.seed ?? ''} onChange={(e) => { const v = e.target.value === '' ? null : parseInt(e.target.value, 10); onPatchModelOption('textToImage', 'seed', Number.isNaN(v) ? null : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-output-format">Output Format</label>
          <select id="cfg-kf-output-format" className="config-select" value={t2iOptions.output_format ?? 'webp'} onChange={(e) => onPatchModelOption('textToImage', 'output_format', e.target.value)}>
            <option value="webp">webp</option><option value="jpg">jpg</option><option value="png">png</option>
          </select>
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-quality">Output Quality</label>
          <input id="cfg-kf-quality" type="number" className="config-input" min={0} max={100} step={1} placeholder="80" value={t2iOptions.output_quality ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10); onPatchModelOption('textToImage', 'output_quality', Number.isNaN(v) ? undefined : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-disable-safety">Disable Safety Checker</label>
          <input id="cfg-kf-disable-safety" type="checkbox" checked={t2iOptions.disable_safety_checker ?? false} onChange={(e) => onPatchModelOption('textToImage', 'disable_safety_checker', e.target.checked)} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-go-fast">Go Fast</label>
          <input id="cfg-kf-go-fast" type="checkbox" checked={t2iOptions.go_fast ?? true} onChange={(e) => onPatchModelOption('textToImage', 'go_fast', e.target.checked)} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-megapixels">Megapixels</label>
          <input id="cfg-kf-megapixels" type="text" className="config-input" placeholder="1" value={t2iOptions.megapixels ?? ''} onChange={(e) => onPatchModelOption('textToImage', 'megapixels', e.target.value || undefined)} />
        </div>
      </>);
    }
    if (textToImageModelId === TEXT_TO_IMAGE_MODEL_IDS.nanoBananaPro) {
      return (<>
        <p className="muted size-sm">Nano Banana Pro uses project <code>aspectRatio</code> and ignores custom <code>keyframeWidth</code>/<code>keyframeHeight</code> overrides.</p>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-resolution">Resolution</label>
          <select id="cfg-kf-resolution" className="config-select" value={t2iOptions.resolution ?? '2K'} onChange={(e) => onPatchModelOption('textToImage', 'resolution', e.target.value)}>
            <option value="1K">1K</option><option value="2K">2K</option><option value="4K">4K</option>
          </select>
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-output-format">Output Format</label>
          <select id="cfg-kf-output-format" className="config-select" value={t2iOptions.output_format ?? 'jpg'} onChange={(e) => onPatchModelOption('textToImage', 'output_format', e.target.value)}>
            <option value="jpg">jpg</option><option value="png">png</option><option value="webp">webp</option>
          </select>
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-safety-level">Safety Filter Level</label>
          <select id="cfg-kf-safety-level" className="config-select" value={t2iOptions.safety_filter_level ?? 'block_only_high'} onChange={(e) => onPatchModelOption('textToImage', 'safety_filter_level', e.target.value)}>
            <option value="block_low_and_above">block_low_and_above</option>
            <option value="block_medium_and_above">block_medium_and_above</option>
            <option value="block_only_high">block_only_high</option>
          </select>
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-allow-fallback">Allow Fallback Model</label>
          <input id="cfg-kf-allow-fallback" type="checkbox" checked={t2iOptions.allow_fallback_model ?? false} onChange={(e) => onPatchModelOption('textToImage', 'allow_fallback_model', e.target.checked)} />
        </div>
      </>);
    }
    if (textToImageModelId === TEXT_TO_IMAGE_MODEL_IDS.seedream4) {
      return (<>
        <p className="muted size-sm">Seedream 4 uses project <code>aspectRatio</code> and preset sizes (<code>1K</code>, <code>2K</code>, <code>4K</code>).</p>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-size">Size</label>
          <select id="cfg-kf-size" className="config-select" value={t2iOptions.size ?? '2K'} onChange={(e) => onPatchModelOption('textToImage', 'size', e.target.value)}>
            <option value="1K">1K</option><option value="2K">2K</option><option value="4K">4K</option>
          </select>
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-seq-gen">Sequential Image Generation</label>
          <select id="cfg-kf-seq-gen" className="config-select" value={t2iOptions.sequential_image_generation ?? 'disabled'} onChange={(e) => onPatchModelOption('textToImage', 'sequential_image_generation', e.target.value)}>
            <option value="disabled">disabled</option><option value="auto">auto</option>
          </select>
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-max-images">Max Images</label>
          <input id="cfg-kf-max-images" type="number" className="config-input" min={1} max={15} step={1} placeholder="1" value={t2iOptions.max_images ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10); onPatchModelOption('textToImage', 'max_images', Number.isNaN(v) ? undefined : v); }} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-kf-enhance">Enhance Prompt</label>
          <input id="cfg-kf-enhance" type="checkbox" checked={t2iOptions.enhance_prompt ?? true} onChange={(e) => onPatchModelOption('textToImage', 'enhance_prompt', e.target.checked)} />
        </div>
      </>);
    }
    return (<>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-kf-steps">Inference Steps</label>
        <input id="cfg-kf-steps" type="number" className="config-input" min={1} max={50} step={1} placeholder="8" value={t2iOptions.num_inference_steps ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10); onPatchModelOption('textToImage', 'num_inference_steps', Number.isNaN(v) ? undefined : v); }} />
      </div>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-kf-guidance">Guidance Scale</label>
        <input id="cfg-kf-guidance" type="number" className="config-input" min={0} max={20} step={0.1} placeholder="0" value={t2iOptions.guidance_scale ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseFloat(e.target.value); onPatchModelOption('textToImage', 'guidance_scale', Number.isNaN(v) ? undefined : v); }} />
      </div>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-kf-seed">Seed <span className="config-form-optional">(optional)</span></label>
        <input id="cfg-kf-seed" type="number" className="config-input" step={1} placeholder="random" value={t2iOptions.seed ?? ''} onChange={(e) => { const v = e.target.value === '' ? null : parseInt(e.target.value, 10); onPatchModelOption('textToImage', 'seed', Number.isNaN(v) ? null : v); }} />
      </div>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-kf-output-format">Output Format</label>
        <select id="cfg-kf-output-format" className="config-select" value={t2iOptions.output_format ?? 'jpg'} onChange={(e) => onPatchModelOption('textToImage', 'output_format', e.target.value)}>
          <option value="jpg">jpg</option><option value="jpeg">jpeg</option><option value="png">png</option><option value="webp">webp</option>
        </select>
      </div>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-kf-quality">Output Quality</label>
        <input id="cfg-kf-quality" type="number" className="config-input" min={0} max={100} step={1} placeholder="80" value={t2iOptions.output_quality ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10); onPatchModelOption('textToImage', 'output_quality', Number.isNaN(v) ? undefined : v); }} />
      </div>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-kf-go-fast">Go Fast</label>
        <input id="cfg-kf-go-fast" type="checkbox" checked={t2iOptions.go_fast ?? false} onChange={(e) => onPatchModelOption('textToImage', 'go_fast', e.target.checked)} />
      </div>
    </>);
  }

  // ── segment (image-to-video) model helpers ──────────────────────────────
  const i2vOptions = configDraft?.modelOptions?.imageTextToVideo || {};
  const imageToVideoModelId = models.imageTextToVideo || IMAGE_TO_VIDEO_MODEL_IDS.wan;

  function handleSegmentModelChange(nextModelId) {
    onPatchModel('imageTextToVideo', nextModelId);
    const clear = (keys) => keys.forEach((k) => onPatchModelOption('imageTextToVideo', k, undefined));
    if (nextModelId === IMAGE_TO_VIDEO_MODEL_IDS.wan) {
      clear(['negative_prompt','mode','generate_audio','quality','generate_audio_switch','thinking_type','resolution']);
    } else if (nextModelId === IMAGE_TO_VIDEO_MODEL_IDS.klingV3) {
      clear(['interpolate_output','go_fast','sample_shift','seed','disable_safety_checker','lora_weights_transformer','lora_scale_transformer','lora_weights_transformer_2','lora_scale_transformer_2','quality','generate_audio_switch','thinking_type','resolution']);
      onPatchModelOption('imageTextToVideo', 'generate_audio', false);
    } else if (nextModelId === IMAGE_TO_VIDEO_MODEL_IDS.pixverseV56) {
      clear(['interpolate_output','go_fast','sample_shift','disable_safety_checker','lora_weights_transformer','lora_scale_transformer','lora_weights_transformer_2','lora_scale_transformer_2','mode','generate_audio','resolution']);
      onPatchModelOption('imageTextToVideo', 'generate_audio_switch', false);
    } else if (nextModelId === IMAGE_TO_VIDEO_MODEL_IDS.veo31 || nextModelId === IMAGE_TO_VIDEO_MODEL_IDS.veo31Fast) {
      clear(['interpolate_output','go_fast','sample_shift','disable_safety_checker','lora_weights_transformer','lora_scale_transformer','lora_weights_transformer_2','lora_scale_transformer_2','mode','quality','generate_audio_switch','thinking_type']);
      onPatchModelOption('imageTextToVideo', 'generate_audio', false);
    }
  }

  function getKlingEstimatedCostLabel() {
    const mode = i2vOptions.mode === 'standard' ? 'standard' : 'pro';
    const usdPerSecond = KLING_USD_PER_SECOND[mode].withoutAudio;
    return `Estimated cost for current settings: $${(usdPerSecond * 5).toFixed(2)} per 5s segment.`;
  }
  function getPixverseEstimatedCostLabel() {
    const quality = ['360p','540p','720p','1080p'].includes(i2vOptions.quality) ? i2vOptions.quality : '540p';
    return `Estimated cost for current settings: $${(PIXVERSE_USD_PER_SECOND[quality] * 5).toFixed(2)} per 5s segment (${quality}).`;
  }
  function getVeoEstimatedCostLabel() {
    const isVeo31 = imageToVideoModelId === IMAGE_TO_VIDEO_MODEL_IDS.veo31;
    const usdPerSecond = isVeo31 ? VEO_USD_PER_SECOND.standardWithoutAudio : VEO_USD_PER_SECOND.withoutAudio;
    return `Estimated cost for current settings: $${(usdPerSecond * 5).toFixed(2)} per 5s segment (audio disabled).`;
  }

  function renderSegmentModelSpecificFields() {
    if (imageToVideoModelId === IMAGE_TO_VIDEO_MODEL_IDS.klingV3) {
      return (<>
        <p className="muted size-sm">Kling v3 uses start/end keyframes and fixed <code>duration=5s</code>.</p>
        <p className="muted size-sm">{getKlingEstimatedCostLabel()}</p>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-seg-negative-prompt">Negative Prompt</label>
          <textarea id="cfg-seg-negative-prompt" className="config-input" rows={3} placeholder="Optional exclusions" value={i2vOptions.negative_prompt ?? ''} onChange={(e) => onPatchModelOption('imageTextToVideo', 'negative_prompt', e.target.value || null)} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-seg-mode">Mode</label>
          <select id="cfg-seg-mode" className="config-select" value={i2vOptions.mode ?? 'pro'} onChange={(e) => onPatchModelOption('imageTextToVideo', 'mode', e.target.value)}>
            <option value="standard">standard (720p)</option>
            <option value="pro">pro (1080p)</option>
          </select>
        </div>
        <p className="muted size-sm">Native audio generation is currently disabled for this model.</p>
      </>);
    }
    if (imageToVideoModelId === IMAGE_TO_VIDEO_MODEL_IDS.pixverseV56) {
      return (<>
        <p className="muted size-sm">PixVerse v5.6 uses start/end keyframes and fixed <code>duration=5s</code>.</p>
        <p className="muted size-sm">{getPixverseEstimatedCostLabel()}</p>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-seg-quality">Quality</label>
          <select id="cfg-seg-quality" className="config-select" value={i2vOptions.quality ?? '540p'} onChange={(e) => onPatchModelOption('imageTextToVideo', 'quality', e.target.value)}>
            <option value="360p">360p</option><option value="540p">540p</option><option value="720p">720p</option><option value="1080p">1080p</option>
          </select>
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-seg-negative-prompt">Negative Prompt</label>
          <textarea id="cfg-seg-negative-prompt" className="config-input" rows={3} placeholder="Optional exclusions" value={i2vOptions.negative_prompt ?? ''} onChange={(e) => onPatchModelOption('imageTextToVideo', 'negative_prompt', e.target.value || null)} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-seg-seed">Seed <span className="config-form-optional">(optional)</span></label>
          <input id="cfg-seg-seed" type="number" className="config-input" step={1} placeholder="random" value={i2vOptions.seed ?? ''} onChange={(e) => { const v = e.target.value === '' ? null : parseInt(e.target.value, 10); onPatchModelOption('imageTextToVideo', 'seed', Number.isNaN(v) ? null : v); }} />
        </div>
        <p className="muted size-sm">Native audio generation is currently disabled for this model.</p>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-seg-thinking-type">Thinking Type</label>
          <input id="cfg-seg-thinking-type" type="text" className="config-input" placeholder="auto" value={i2vOptions.thinking_type ?? ''} onChange={(e) => onPatchModelOption('imageTextToVideo', 'thinking_type', e.target.value || undefined)} />
        </div>
      </>);
    }
    if (imageToVideoModelId === IMAGE_TO_VIDEO_MODEL_IDS.veo31 || imageToVideoModelId === IMAGE_TO_VIDEO_MODEL_IDS.veo31Fast) {
      const veoLabel = imageToVideoModelId === IMAGE_TO_VIDEO_MODEL_IDS.veo31 ? 'Veo 3.1' : 'Veo 3.1 Fast';
      return (<>
        <p className="muted size-sm">{veoLabel} uses start/end keyframes and fixed <code>duration=5s</code>.</p>
        <p className="muted size-sm">{getVeoEstimatedCostLabel()}</p>
        <p className="muted size-sm">Native audio generation is currently disabled for this model.</p>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-seg-resolution">Resolution</label>
          <select id="cfg-seg-resolution" className="config-select" value={i2vOptions.resolution ?? '1080p'} onChange={(e) => onPatchModelOption('imageTextToVideo', 'resolution', e.target.value)}>
            <option value="720p">720p</option><option value="1080p">1080p</option>
          </select>
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-seg-negative-prompt">Negative Prompt</label>
          <textarea id="cfg-seg-negative-prompt" className="config-input" rows={3} placeholder="Optional exclusions" value={i2vOptions.negative_prompt ?? ''} onChange={(e) => onPatchModelOption('imageTextToVideo', 'negative_prompt', e.target.value || null)} />
        </div>
        <div className="config-form-field">
          <label className="config-form-label" htmlFor="cfg-seg-seed">Seed <span className="config-form-optional">(optional)</span></label>
          <input id="cfg-seg-seed" type="number" className="config-input" step={1} placeholder="random" value={i2vOptions.seed ?? ''} onChange={(e) => { const v = e.target.value === '' ? null : parseInt(e.target.value, 10); onPatchModelOption('imageTextToVideo', 'seed', Number.isNaN(v) ? null : v); }} />
        </div>
      </>);
    }
    // Default: Wan 2.2
    return (<>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-seg-sample-shift">Sample Shift</label>
        <input id="cfg-seg-sample-shift" type="number" className="config-input" min={1} max={20} step={0.1} placeholder="12" value={i2vOptions.sample_shift ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseFloat(e.target.value); onPatchModelOption('imageTextToVideo', 'sample_shift', Number.isNaN(v) ? undefined : v); }} />
      </div>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-seg-seed">Seed <span className="config-form-optional">(optional)</span></label>
        <input id="cfg-seg-seed" type="number" className="config-input" step={1} placeholder="random" value={i2vOptions.seed ?? ''} onChange={(e) => { const v = e.target.value === '' ? null : parseInt(e.target.value, 10); onPatchModelOption('imageTextToVideo', 'seed', Number.isNaN(v) ? null : v); }} />
      </div>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-seg-lora1">LoRA Weights <span className="config-form-optional">(optional)</span></label>
        <input id="cfg-seg-lora1" type="text" className="config-input" placeholder="none" value={i2vOptions.lora_weights_transformer ?? ''} onChange={(e) => onPatchModelOption('imageTextToVideo', 'lora_weights_transformer', e.target.value || null)} />
      </div>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-seg-lora1-scale">LoRA Scale</label>
        <input id="cfg-seg-lora1-scale" type="number" className="config-input" step={0.1} placeholder="1" value={i2vOptions.lora_scale_transformer ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseFloat(e.target.value); onPatchModelOption('imageTextToVideo', 'lora_scale_transformer', Number.isNaN(v) ? undefined : v); }} />
      </div>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-seg-lora2">LoRA Weights 2 <span className="config-form-optional">(optional)</span></label>
        <input id="cfg-seg-lora2" type="text" className="config-input" placeholder="none" value={i2vOptions.lora_weights_transformer_2 ?? ''} onChange={(e) => onPatchModelOption('imageTextToVideo', 'lora_weights_transformer_2', e.target.value || null)} />
      </div>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-seg-lora2-scale">LoRA Scale 2</label>
        <input id="cfg-seg-lora2-scale" type="number" className="config-input" step={0.1} placeholder="1" value={i2vOptions.lora_scale_transformer_2 ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseFloat(e.target.value); onPatchModelOption('imageTextToVideo', 'lora_scale_transformer_2', Number.isNaN(v) ? undefined : v); }} />
      </div>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-seg-go-fast">Go Fast</label>
        <input id="cfg-seg-go-fast" type="checkbox" checked={i2vOptions.go_fast ?? true} onChange={(e) => onPatchModelOption('imageTextToVideo', 'go_fast', e.target.checked)} />
      </div>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-seg-interpolate">Interpolate Output</label>
        <input id="cfg-seg-interpolate" type="checkbox" checked={i2vOptions.interpolate_output ?? false} onChange={(e) => onPatchModelOption('imageTextToVideo', 'interpolate_output', e.target.checked)} />
      </div>
      <div className="config-form-field">
        <label className="config-form-label" htmlFor="cfg-seg-safety">Disable Safety Checker</label>
        <input id="cfg-seg-safety" type="checkbox" checked={i2vOptions.disable_safety_checker ?? false} onChange={(e) => onPatchModelOption('imageTextToVideo', 'disable_safety_checker', e.target.checked)} />
      </div>
    </>);
  }

  // ── voice (text-to-speech) model helpers ────────────────────────────────
  const ttsOptions = configDraft?.modelOptions?.textToSpeech || {};
  const selectedTtsModelId = models.textToSpeech || TTS_MODEL_IDS.minimax;
  const isMinimax = selectedTtsModelId === TTS_MODEL_IDS.minimax;
  const isChatterbox = selectedTtsModelId === TTS_MODEL_IDS.chatterboxTurbo;
  const isKokoro = selectedTtsModelId === TTS_MODEL_IDS.kokoro82m;

  function handleVoiceModelChange(nextModelId) {
    onPatchModel('textToSpeech', nextModelId);
    if (nextModelId === TTS_MODEL_IDS.minimax) {
      [...CHATTERBOX_OPTION_KEYS, ...KOKORO_OPTION_KEYS].forEach((k) => onPatchModelOption('textToSpeech', k, undefined));
    } else if (nextModelId === TTS_MODEL_IDS.chatterboxTurbo) {
      [...MINIMAX_OPTION_KEYS, 'speed'].forEach((k) => onPatchModelOption('textToSpeech', k, undefined));
    } else {
      [...MINIMAX_OPTION_KEYS, ...CHATTERBOX_OPTION_KEYS].forEach((k) => onPatchModelOption('textToSpeech', k, undefined));
    }
  }

  return (
    <div className="tab-pane">
      {configDraft ? (
        <>
          <div className="config-inner-tab-bar" role="tablist" aria-label="Config sections">
            {[
              { id: 'video', label: 'Video' },
              { id: 'captions', label: 'Captions' },
              { id: 'models', label: 'Models' },
              { id: 'raw', label: 'Raw' }
            ].map(({ id, label }) => (
              <button
                key={id}
                role="tab"
                type="button"
                className={`config-inner-tab${activeConfigTab === id ? ' config-inner-tab-active' : ''}`}
                aria-selected={activeConfigTab === id}
                onClick={() => setActiveConfigTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {activeConfigTab === 'video' && (
            <form className="config-form" onSubmit={(event) => { event.preventDefault(); onSaveConfig(); }}>
              <div className="config-form-fields">
                <section className="config-group" aria-labelledby="cfg-group-video">
                  <header className="config-group-header">
                    <h3 id="cfg-group-video" className="config-group-title">Video Setup</h3>
                    <p className="config-group-note muted size-sm">Output shape and overall timing.</p>
                  </header>
                  <div className="config-group-grid">
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-aspect">Aspect Ratio</label>
                      <select
                        id="cfg-aspect"
                        className="config-select"
                        value={configDraft.aspectRatio || '9:16'}
                        onChange={(event) => onPatchConfig('aspectRatio', event.target.value)}
                      >
                        <option value="9:16">9:16 — Portrait</option>
                        <option value="16:9">16:9 — Landscape</option>
                        <option value="1:1">1:1 — Square</option>
                      </select>
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-duration">Target Duration (sec)</label>
                      <input
                        id="cfg-duration"
                        type="number"
                        className="config-input"
                        min={5}
                        max={600}
                        step={1}
                        value={configDraft.targetDurationSec ?? ''}
                        onChange={(event) => {
                          const value = parseInt(event.target.value, 10);
                          if (!isNaN(value)) {
                            onPatchConfig('targetDurationSec', value);
                          }
                        }}
                      />
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-finalduration">Final Duration Mode</label>
                      <select
                        id="cfg-finalduration"
                        className="config-select"
                        value={configDraft.finalDurationMode || 'match_audio'}
                        onChange={(event) => onPatchConfig('finalDurationMode', event.target.value)}
                      >
                        <option value="match_audio">Match Audio</option>
                        <option value="match_visual">Match Visual</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className="config-group" aria-labelledby="cfg-group-keyframes">
                  <header className="config-group-header">
                    <h3 id="cfg-group-keyframes" className="config-group-title">Frame Resolution</h3>
                    <p className="config-group-note muted size-sm">Leave width/height empty to auto-resolve from aspect ratio.</p>
                  </header>
                  <div className="config-group-grid">
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-kfw">Keyframe Width <span className="config-form-optional">(optional)</span></label>
                      <input
                        id="cfg-kfw"
                        type="number"
                        className="config-input"
                        min={64}
                        max={2048}
                        step={1}
                        placeholder="auto"
                        value={configDraft.keyframeWidth ?? ''}
                        onChange={(event) => onPatchOptionalInt('keyframeWidth', event.target.value)}
                      />
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-kfh">Keyframe Height <span className="config-form-optional">(optional)</span></label>
                      <input
                        id="cfg-kfh"
                        type="number"
                        className="config-input"
                        min={64}
                        max={2048}
                        step={1}
                        placeholder="auto"
                        value={configDraft.keyframeHeight ?? ''}
                        onChange={(event) => onPatchOptionalInt('keyframeHeight', event.target.value)}
                      />
                    </div>
                    <div className="config-form-field config-form-field--readonly">
                      <span className="config-form-label">Resolved Size</span>
                      <span className="config-value">{`${mediaW} × ${mediaH}`}</span>
                    </div>
                  </div>
                </section>
              </div>
              <div className="config-form-actions">
                <button type="submit" className="btn btn-primary" disabled={!configDirty || savingConfig || isRunning}>
                  {savingConfig ? 'Saving…' : 'Save Config'}
                </button>
                {configDirty && <span className="muted size-sm">Unsaved changes</span>}
              </div>
            </form>
          )}

          {activeConfigTab === 'captions' && (
            <form className="config-form" onSubmit={(event) => { event.preventDefault(); onSaveConfig(); }}>
              <div className="config-form-fields">
                <section className="config-group" aria-labelledby="cfg-group-subtitles">
                  <header className="config-group-header">
                    <h3 id="cfg-group-subtitles" className="config-group-title">Subtitles</h3>
                    <p className="config-group-note muted size-sm">Style and readability controls for caption burn-in.</p>
                  </header>
                  <div className="config-group-grid">
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-sub-enabled">Subtitle Burn-In</label>
                      <select
                        id="cfg-sub-enabled"
                        className="config-select"
                        value={subtitleOptions.enabled ? 'on' : 'off'}
                        onChange={(event) => onPatchConfig('subtitleOptions', {
                          ...subtitleOptions,
                          enabled: event.target.value === 'on'
                        })}
                      >
                        <option value="off">Off</option>
                        <option value="on">On</option>
                      </select>
                    </div>

                    {subtitleOptions.enabled && (
                      <>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-template">Caption Template</label>
                          <select
                            id="cfg-sub-template"
                            className="config-select"
                            value={subtitleOptions.templateId || 'custom'}
                            onChange={(event) => onPatchConfig('subtitleOptions', {
                              ...subtitleOptions,
                              templateId: event.target.value
                            })}
                          >
                            {SUBTITLE_TEMPLATE_PRESETS.map((template) => (
                              <option key={template.id} value={template.id}>{template.label}</option>
                            ))}
                          </select>
                          <p className="muted size-sm">{selectedTemplate.description}</p>
                          <div className="config-inline-actions">
                            <button
                              type="button"
                              className="btn"
                              disabled={(subtitleOptions.templateId || 'custom') === 'custom'}
                              onClick={() => applySubtitleTemplate(subtitleOptions.templateId || 'custom')}
                            >
                              Apply Template
                            </button>
                            <button
                              type="button"
                              className="btn"
                              disabled={(subtitleOptions.templateId || 'custom') === 'custom'}
                              onClick={() => applySubtitleTemplate(subtitleOptions.templateId || 'custom')}
                            >
                              Reset To Template
                            </button>
                          </div>
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-font">Subtitle Font</label>
                          <ComboBox
                            id="cfg-sub-font"
                            className="config-input"
                            placeholder="Poppins"
                            value={subtitleOptions.fontName || ''}
                            options={subtitleFontOptions}
                            inputStyle={{
                              fontFamily: subtitleOptions.fontName
                                ? `"${subtitleOptions.fontName}", sans-serif`
                                : undefined
                            }}
                            getOptionStyle={(fontName) => ({
                              fontFamily: `"${fontName}", sans-serif`
                            })}
                            onChange={(value) => onPatchConfig('subtitleOptions', {
                              ...subtitleOptions,
                              fontName: value || ''
                            })}
                          />
                          <p className="muted size-sm">
                            {subtitleFontDetectionReady
                              ? `Showing ${subtitleFontOptions.length} likely available fonts on this device (you can still type any font name).`
                              : 'Detecting available fonts on this device...'}
                          </p>
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-position">Subtitle Position</label>
                          <select
                            id="cfg-sub-position"
                            className="config-select"
                            value={subtitleOptions.position || 'center'}
                            onChange={(event) => onPatchConfig('subtitleOptions', {
                              ...subtitleOptions,
                              position: event.target.value
                            })}
                          >
                            <option value="center">Center</option>
                            <option value="bottom">Bottom</option>
                            <option value="top">Top</option>
                          </select>
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-highlight-mode">Highlight Mode</label>
                          <select
                            id="cfg-sub-highlight-mode"
                            className="config-select"
                            value={subtitleOptions.highlightMode || 'spoken_upcoming'}
                            onChange={(event) => onPatchConfig('subtitleOptions', {
                              ...subtitleOptions,
                              highlightMode: event.target.value
                            })}
                          >
                            <option value="spoken_upcoming">Spoken vs Upcoming</option>
                            <option value="current_only">Current Word Only</option>
                          </select>
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-size">Subtitle Size</label>
                          <input
                            id="cfg-sub-size"
                            type="number"
                            className="config-input"
                            min={16}
                            max={120}
                            step={1}
                            value={subtitleOptions.fontSize ?? ''}
                            onChange={(event) => {
                              const value = parseInt(event.target.value, 10);
                              if (!isNaN(value)) {
                                onPatchConfig('subtitleOptions', {
                                  ...subtitleOptions,
                                  fontSize: value
                                });
                              }
                            }}
                          />
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-bold">Weight</label>
                          <select
                            id="cfg-sub-bold"
                            className="config-select"
                            value={subtitleOptions.bold === false ? 'regular' : 'bold'}
                            onChange={(event) => onPatchConfig('subtitleOptions', {
                              ...subtitleOptions,
                              bold: event.target.value === 'bold'
                            })}
                          >
                            <option value="bold">Bold</option>
                            <option value="regular">Regular</option>
                          </select>
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-italic">Italic</label>
                          <select
                            id="cfg-sub-italic"
                            className="config-select"
                            value={subtitleOptions.italic ? 'on' : 'off'}
                            onChange={(event) => onPatchConfig('subtitleOptions', {
                              ...subtitleOptions,
                              italic: event.target.value === 'on'
                            })}
                          >
                            <option value="off">Off</option>
                            <option value="on">On</option>
                          </select>
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-uppercase">Uppercase Captions</label>
                          <select
                            id="cfg-sub-uppercase"
                            className="config-select"
                            value={subtitleOptions.makeUppercase ? 'on' : 'off'}
                            onChange={(event) => onPatchConfig('subtitleOptions', {
                              ...subtitleOptions,
                              makeUppercase: event.target.value === 'on'
                            })}
                          >
                            <option value="off">Off</option>
                            <option value="on">On</option>
                          </select>
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-primary">Base Color</label>
                          <div className="config-color-input-row">
                            <input
                              type="color"
                              className="config-color-picker"
                              value={resolveColorValue(subtitleOptions.primaryColor, '#ffffff')}
                              onChange={(event) => onPatchConfig('subtitleOptions', {
                                ...subtitleOptions,
                                primaryColor: event.target.value
                              })}
                              aria-label="Choose subtitle base color"
                            />
                            <input
                              id="cfg-sub-primary"
                              type="text"
                              className="config-input"
                              placeholder="#ffffff"
                              value={subtitleOptions.primaryColor || ''}
                              onChange={(event) => onPatchConfig('subtitleOptions', {
                                ...subtitleOptions,
                                primaryColor: event.target.value
                              })}
                            />
                          </div>
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-active">Active Word Color</label>
                          <div className="config-color-input-row">
                            <input
                              type="color"
                              className="config-color-picker"
                              value={resolveColorValue(subtitleOptions.activeColor, '#ffe066')}
                              onChange={(event) => onPatchConfig('subtitleOptions', {
                                ...subtitleOptions,
                                activeColor: event.target.value
                              })}
                              aria-label="Choose subtitle active word color"
                            />
                            <input
                              id="cfg-sub-active"
                              type="text"
                              className="config-input"
                              placeholder="#ffe066"
                              value={subtitleOptions.activeColor || ''}
                              onChange={(event) => onPatchConfig('subtitleOptions', {
                                ...subtitleOptions,
                                activeColor: event.target.value
                              })}
                            />
                          </div>
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-outline-color">Border Color</label>
                          <div className="config-color-input-row">
                            <input
                              type="color"
                              className="config-color-picker"
                              value={resolveColorValue(subtitleOptions.outlineColor, '#111111')}
                              onChange={(event) => onPatchConfig('subtitleOptions', {
                                ...subtitleOptions,
                                outlineColor: event.target.value
                              })}
                              aria-label="Choose subtitle border color"
                            />
                            <input
                              id="cfg-sub-outline-color"
                              type="text"
                              className="config-input"
                              placeholder="#111111"
                              value={subtitleOptions.outlineColor || ''}
                              onChange={(event) => onPatchConfig('subtitleOptions', {
                                ...subtitleOptions,
                                outlineColor: event.target.value
                              })}
                            />
                          </div>
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-outline">Border Width</label>
                          <input
                            id="cfg-sub-outline"
                            type="number"
                            className="config-input"
                            min={0}
                            max={12}
                            step={1}
                            value={subtitleOptions.outline ?? ''}
                            onChange={(event) => {
                              const value = parseInt(event.target.value, 10);
                              if (!isNaN(value)) {
                                onPatchConfig('subtitleOptions', {
                                  ...subtitleOptions,
                                  outline: value
                                });
                              }
                            }}
                          />
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-shadow">Shadow</label>
                          <input
                            id="cfg-sub-shadow"
                            type="number"
                            className="config-input"
                            min={0}
                            max={12}
                            step={1}
                            value={subtitleOptions.shadow ?? ''}
                            onChange={(event) => {
                              const value = parseInt(event.target.value, 10);
                              if (!isNaN(value)) {
                                onPatchConfig('subtitleOptions', {
                                  ...subtitleOptions,
                                  shadow: value
                                });
                              }
                            }}
                          />
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-margin-v">Vertical Margin</label>
                          <input
                            id="cfg-sub-margin-v"
                            type="number"
                            className="config-input"
                            min={0}
                            max={400}
                            step={1}
                            value={subtitleOptions.marginV ?? ''}
                            onChange={(event) => {
                              const value = parseInt(event.target.value, 10);
                              if (!isNaN(value)) {
                                onPatchConfig('subtitleOptions', {
                                  ...subtitleOptions,
                                  marginV: value
                                });
                              }
                            }}
                          />
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-background-enabled">Background Box</label>
                          <select
                            id="cfg-sub-background-enabled"
                            className="config-select"
                            value={subtitleOptions.backgroundEnabled ? 'on' : 'off'}
                            onChange={(event) => onPatchConfig('subtitleOptions', {
                              ...subtitleOptions,
                              backgroundEnabled: event.target.value === 'on'
                            })}
                          >
                            <option value="off">Off</option>
                            <option value="on">On</option>
                          </select>
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-background-color">Background Color</label>
                          <div className="config-color-input-row">
                            <input
                              type="color"
                              className="config-color-picker"
                              value={resolveColorValue(subtitleOptions.backgroundColor, '#000000')}
                              onChange={(event) => onPatchConfig('subtitleOptions', {
                                ...subtitleOptions,
                                backgroundColor: event.target.value
                              })}
                              aria-label="Choose subtitle background color"
                            />
                            <input
                              id="cfg-sub-background-color"
                              type="text"
                              className="config-input"
                              placeholder="#000000"
                              value={subtitleOptions.backgroundColor || ''}
                              onChange={(event) => onPatchConfig('subtitleOptions', {
                                ...subtitleOptions,
                                backgroundColor: event.target.value
                              })}
                            />
                          </div>
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-background-opacity">Background Opacity</label>
                          <input
                            id="cfg-sub-background-opacity"
                            type="number"
                            className="config-input"
                            min={0}
                            max={0.85}
                            step={0.05}
                            value={subtitleOptions.backgroundOpacity ?? ''}
                            onChange={(event) => {
                              const value = Number.parseFloat(event.target.value);
                              if (!Number.isNaN(value)) {
                                onPatchConfig('subtitleOptions', {
                                  ...subtitleOptions,
                                  backgroundOpacity: value
                                });
                              }
                            }}
                          />
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-max-words">Words Per Caption</label>
                          <input
                            id="cfg-sub-max-words"
                            type="number"
                            className="config-input"
                            min={1}
                            max={20}
                            step={1}
                            value={subtitleOptions.maxWordsPerLine ?? ''}
                            onChange={(event) => {
                              const value = parseInt(event.target.value, 10);
                              if (!isNaN(value)) {
                                onPatchConfig('subtitleOptions', {
                                  ...subtitleOptions,
                                  maxWordsPerLine: value
                                });
                              }
                            }}
                          />
                        </div>
                        <div className="config-form-field">
                          <label className="config-form-label" htmlFor="cfg-sub-max-lines">Max Lines</label>
                          <input
                            id="cfg-sub-max-lines"
                            type="number"
                            className="config-input"
                            min={1}
                            max={3}
                            step={1}
                            value={subtitleOptions.maxLines ?? ''}
                            onChange={(event) => {
                              const value = parseInt(event.target.value, 10);
                              if (!isNaN(value)) {
                                onPatchConfig('subtitleOptions', {
                                  ...subtitleOptions,
                                  maxLines: value
                                });
                              }
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </section>
              </div>
              <div className="config-form-actions">
                <button type="submit" className="btn btn-primary" disabled={!configDirty || savingConfig || isRunning}>
                  {savingConfig ? 'Saving…' : 'Save Config'}
                </button>
                {configDirty && <span className="muted size-sm">Unsaved changes</span>}
              </div>
            </form>
          )}

          {activeConfigTab === 'models' && (
            <>
              <ModelConfigSection
                modelId={models.textToText}
                title="Text to Text Model"
                configDirty={configDirty}
                savingConfig={savingConfig}
                isRunning={isRunning}
                onSaveConfig={onSaveConfig}
              >
                <div className="config-form-field">
                  <label className="config-form-label" htmlFor="cfg-model-text">Model ID</label>
                  <input
                    id="cfg-model-text"
                    type="text"
                    className="config-input"
                    value={models.textToText || ''}
                    onChange={(event) => onPatchModel('textToText', event.target.value)}
                  />
                </div>
                <div className="config-form-field">
                  <label className="config-form-label" htmlFor="cfg-ttt-max-tokens">Max Tokens</label>
                  <input
                    id="cfg-ttt-max-tokens"
                    type="number"
                    className="config-input"
                    min={1}
                    max={8192}
                    step={1}
                    placeholder="2048"
                    value={tttOptions.max_tokens ?? ''}
                    onChange={(event) => {
                      const v = event.target.value === '' ? undefined : parseInt(event.target.value, 10);
                      onPatchModelOption('textToText', 'max_tokens', Number.isNaN(v) ? undefined : v);
                    }}
                  />
                </div>
                <div className="config-form-field">
                  <label className="config-form-label" htmlFor="cfg-ttt-temperature">Temperature</label>
                  <input
                    id="cfg-ttt-temperature"
                    type="number"
                    className="config-input"
                    min={0}
                    max={2}
                    step={0.01}
                    placeholder="0.1"
                    value={tttOptions.temperature ?? ''}
                    onChange={(event) => {
                      const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                      onPatchModelOption('textToText', 'temperature', Number.isNaN(v) ? undefined : v);
                    }}
                  />
                </div>
                <div className="config-form-field">
                  <label className="config-form-label" htmlFor="cfg-ttt-presence">Presence Penalty</label>
                  <input
                    id="cfg-ttt-presence"
                    type="number"
                    className="config-input"
                    min={-2}
                    max={2}
                    step={0.01}
                    placeholder="0"
                    value={tttOptions.presence_penalty ?? ''}
                    onChange={(event) => {
                      const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                      onPatchModelOption('textToText', 'presence_penalty', Number.isNaN(v) ? undefined : v);
                    }}
                  />
                </div>
                <div className="config-form-field">
                  <label className="config-form-label" htmlFor="cfg-ttt-frequency">Frequency Penalty</label>
                  <input
                    id="cfg-ttt-frequency"
                    type="number"
                    className="config-input"
                    min={-2}
                    max={2}
                    step={0.01}
                    placeholder="0"
                    value={tttOptions.frequency_penalty ?? ''}
                    onChange={(event) => {
                      const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                      onPatchModelOption('textToText', 'frequency_penalty', Number.isNaN(v) ? undefined : v);
                    }}
                  />
                </div>
                <div className="config-form-field">
                  <label className="config-form-label" htmlFor="cfg-ttt-top-p">Top P</label>
                  <input
                    id="cfg-ttt-top-p"
                    type="number"
                    className="config-input"
                    min={0}
                    max={1}
                    step={0.01}
                    placeholder="1"
                    value={tttOptions.top_p ?? ''}
                    onChange={(event) => {
                      const v = event.target.value === '' ? undefined : parseFloat(event.target.value);
                      onPatchModelOption('textToText', 'top_p', Number.isNaN(v) ? undefined : v);
                    }}
                  />
                </div>
              </ModelConfigSection>

              <ModelConfigSection
                modelId={textToImageModelId}
                title="Keyframe Model"
                configDirty={configDirty}
                savingConfig={savingConfig}
                isRunning={isRunning}
                onSaveConfig={onSaveConfig}
              >
                <div className="config-form-field">
                  <label className="config-form-label" htmlFor="cfg-kf-model">Model</label>
                  <select
                    id="cfg-kf-model"
                    className="config-select"
                    value={textToImageModelId}
                    onChange={(event) => handleKeyframeModelChange(event.target.value)}
                  >
                    <option value={TEXT_TO_IMAGE_MODEL_IDS.pruna}>Z Image Turbo (`prunaai/z-image-turbo`)</option>
                    <option value={TEXT_TO_IMAGE_MODEL_IDS.flux}>FLUX 2 Pro (`black-forest-labs/flux-2-pro`)</option>
                    <option value={TEXT_TO_IMAGE_MODEL_IDS.fluxSchnell}>FLUX Schnell (`black-forest-labs/flux-schnell`)</option>
                    <option value={TEXT_TO_IMAGE_MODEL_IDS.nanoBananaPro}>Nano Banana Pro (`google/nano-banana-pro`)</option>
                    <option value={TEXT_TO_IMAGE_MODEL_IDS.seedream4}>Seedream 4 (`bytedance/seedream-4`)</option>
                  </select>
                </div>
                {renderKeyframeModelSpecificFields()}
              </ModelConfigSection>

              <ModelConfigSection
                modelId={imageToVideoModelId}
                title="Segment Model"
                configDirty={configDirty}
                savingConfig={savingConfig}
                isRunning={isRunning}
                onSaveConfig={onSaveConfig}
              >
                <div className="config-form-field">
                  <label className="config-form-label" htmlFor="cfg-seg-model">Model</label>
                  <select
                    id="cfg-seg-model"
                    className="config-select"
                    value={imageToVideoModelId}
                    onChange={(event) => handleSegmentModelChange(event.target.value)}
                  >
                    <option value={IMAGE_TO_VIDEO_MODEL_IDS.wan}>Wan 2.2 I2V Fast (`wan-video/wan-2.2-i2v-fast`)</option>
                    <option value={IMAGE_TO_VIDEO_MODEL_IDS.klingV3}>Kling V3 Video (`kwaivgi/kling-v3-video`)</option>
                    <option value={IMAGE_TO_VIDEO_MODEL_IDS.pixverseV56}>PixVerse v5.6 (`pixverse/pixverse-v5.6`)</option>
                    <option value={IMAGE_TO_VIDEO_MODEL_IDS.veo31}>Veo 3.1 (`google/veo-3.1`)</option>
                    <option value={IMAGE_TO_VIDEO_MODEL_IDS.veo31Fast}>Veo 3.1 Fast (`google/veo-3.1-fast`)</option>
                  </select>
                </div>
                {renderSegmentModelSpecificFields()}
              </ModelConfigSection>

              <ModelConfigSection
                modelId={selectedTtsModelId}
                title="Voice Model"
                configDirty={configDirty}
                savingConfig={savingConfig}
                isRunning={isRunning}
                onSaveConfig={onSaveConfig}
              >
                <div className="config-form-field">
                  <label className="config-form-label" htmlFor="cfg-voice-model">Model</label>
                  <select
                    id="cfg-voice-model"
                    className="config-select"
                    value={selectedTtsModelId}
                    onChange={(event) => handleVoiceModelChange(event.target.value)}
                  >
                    <option value={TTS_MODEL_IDS.minimax}>minimax/speech-02-turbo</option>
                    <option value={TTS_MODEL_IDS.chatterboxTurbo}>resemble-ai/chatterbox-turbo</option>
                    <option value={TTS_MODEL_IDS.kokoro82m}>jaaari/kokoro-82m</option>
                  </select>
                </div>
                {isMinimax && (
                  <>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-id">Voice ID</label>
                      <ComboBox
                        id="cfg-voice-id"
                        className="config-input"
                        placeholder="Wise_Woman"
                        value={ttsOptions.voice_id ?? ''}
                        onChange={(v) => onPatchModelOption('textToSpeech', 'voice_id', v)}
                        options={['Wise_Woman','Deep_Voice_Man','Imposing_Manner','Friendly_Person','Lively_Girl','Young_Knight']}
                      />
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-emotion">Emotion</label>
                      <select id="cfg-voice-emotion" className="config-select" value={ttsOptions.emotion ?? 'auto'} onChange={(e) => onPatchModelOption('textToSpeech', 'emotion', e.target.value)}>
                        {['auto','neutral','happy','sad','angry','fearful','disgusted','surprised','calm','fluent'].map((em) => (
                          <option key={em} value={em}>{em}</option>
                        ))}
                      </select>
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-speed">Speed</label>
                      <input id="cfg-voice-speed" type="number" className="config-input" min={0.5} max={2} step={0.05} placeholder="1" value={ttsOptions.speed ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseFloat(e.target.value); onPatchModelOption('textToSpeech', 'speed', Number.isNaN(v) ? undefined : v); }} />
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-pitch">Pitch</label>
                      <input id="cfg-voice-pitch" type="number" className="config-input" min={-12} max={12} step={1} placeholder="0" value={ttsOptions.pitch ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10); onPatchModelOption('textToSpeech', 'pitch', Number.isNaN(v) ? undefined : v); }} />
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-volume">Volume</label>
                      <input id="cfg-voice-volume" type="number" className="config-input" min={0} max={10} step={0.1} placeholder="1" value={ttsOptions.volume ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseFloat(e.target.value); onPatchModelOption('textToSpeech', 'volume', Number.isNaN(v) ? undefined : v); }} />
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-audio-format">Audio Format</label>
                      <select id="cfg-voice-audio-format" className="config-select" value={ttsOptions.audio_format ?? 'mp3'} onChange={(e) => onPatchModelOption('textToSpeech', 'audio_format', e.target.value)}>
                        <option value="mp3">mp3</option><option value="wav">wav</option><option value="flac">flac</option><option value="pcm">pcm</option>
                      </select>
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-channel">Channel</label>
                      <select id="cfg-voice-channel" className="config-select" value={ttsOptions.channel ?? 'mono'} onChange={(e) => onPatchModelOption('textToSpeech', 'channel', e.target.value)}>
                        <option value="mono">mono</option><option value="stereo">stereo</option>
                      </select>
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-sample-rate">Sample Rate (Hz)</label>
                      <input id="cfg-voice-sample-rate" type="number" className="config-input" min={8000} max={44100} step={100} placeholder="32000" value={ttsOptions.sample_rate ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10); onPatchModelOption('textToSpeech', 'sample_rate', Number.isNaN(v) ? undefined : v); }} />
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-bitrate">Bitrate (bps)</label>
                      <input id="cfg-voice-bitrate" type="number" className="config-input" min={32000} max={256000} step={1000} placeholder="128000" value={ttsOptions.bitrate ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10); onPatchModelOption('textToSpeech', 'bitrate', Number.isNaN(v) ? undefined : v); }} />
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-lang-boost">Language Boost</label>
                      <input id="cfg-voice-lang-boost" type="text" className="config-input" list="cfg-voice-lang-list" placeholder="None" value={ttsOptions.language_boost ?? ''} onChange={(e) => onPatchModelOption('textToSpeech', 'language_boost', e.target.value || undefined)} />
                      <datalist id="cfg-voice-lang-list">
                        {['None','Automatic','en','zh','ja','ko','es','fr','de','pt'].map((l) => <option key={l} value={l} />)}
                      </datalist>
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-subtitle">Subtitle Enable</label>
                      <input id="cfg-voice-subtitle" type="checkbox" checked={ttsOptions.subtitle_enable ?? false} onChange={(e) => onPatchModelOption('textToSpeech', 'subtitle_enable', e.target.checked)} />
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-en-norm">English Normalization</label>
                      <input id="cfg-voice-en-norm" type="checkbox" checked={ttsOptions.english_normalization ?? false} onChange={(e) => onPatchModelOption('textToSpeech', 'english_normalization', e.target.checked)} />
                    </div>
                  </>
                )}
                {isChatterbox && (
                  <>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-chatterbox-voice">Voice</label>
                      <select id="cfg-voice-chatterbox-voice" className="config-select" value={ttsOptions.voice ?? 'Andy'} onChange={(e) => onPatchModelOption('textToSpeech', 'voice', e.target.value)}>
                        {CHATTERBOX_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-chatterbox-temperature">Temperature</label>
                      <input id="cfg-voice-chatterbox-temperature" type="number" className="config-input" min={0.05} max={2} step={0.01} placeholder="0.8" value={ttsOptions.temperature ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseFloat(e.target.value); onPatchModelOption('textToSpeech', 'temperature', Number.isNaN(v) ? undefined : v); }} />
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-chatterbox-top-p">Top P</label>
                      <input id="cfg-voice-chatterbox-top-p" type="number" className="config-input" min={0.5} max={1} step={0.01} placeholder="0.95" value={ttsOptions.top_p ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseFloat(e.target.value); onPatchModelOption('textToSpeech', 'top_p', Number.isNaN(v) ? undefined : v); }} />
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-chatterbox-top-k">Top K</label>
                      <input id="cfg-voice-chatterbox-top-k" type="number" className="config-input" min={1} max={2000} step={1} placeholder="1000" value={ttsOptions.top_k ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseInt(e.target.value, 10); onPatchModelOption('textToSpeech', 'top_k', Number.isNaN(v) ? undefined : v); }} />
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-chatterbox-repetition">Repetition Penalty</label>
                      <input id="cfg-voice-chatterbox-repetition" type="number" className="config-input" min={1} max={2} step={0.01} placeholder="1.2" value={ttsOptions.repetition_penalty ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseFloat(e.target.value); onPatchModelOption('textToSpeech', 'repetition_penalty', Number.isNaN(v) ? undefined : v); }} />
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-chatterbox-seed">Seed</label>
                      <input id="cfg-voice-chatterbox-seed" type="number" className="config-input" min={0} step={1} placeholder="Random" value={ttsOptions.seed ?? ''} onChange={(e) => { const v = e.target.value === '' ? null : parseInt(e.target.value, 10); onPatchModelOption('textToSpeech', 'seed', Number.isNaN(v) ? undefined : v); }} />
                    </div>
                    <div className="config-form-field">
                      <p className="muted size-sm" style={{ margin: 0 }}>Voice cloning via <code>reference_audio</code> is supported by this model but disabled in this app for now.</p>
                    </div>
                  </>
                )}
                {isKokoro && (
                  <>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-kokoro-voice">Voice</label>
                      <select id="cfg-voice-kokoro-voice" className="config-select" value={ttsOptions.voice ?? 'af_bella'} onChange={(e) => onPatchModelOption('textToSpeech', 'voice', e.target.value)}>
                        {KOKORO_VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                    <div className="config-form-field">
                      <label className="config-form-label" htmlFor="cfg-voice-kokoro-speed">Speed</label>
                      <input id="cfg-voice-kokoro-speed" type="number" className="config-input" min={0.1} max={5} step={0.1} placeholder="1" value={ttsOptions.speed ?? ''} onChange={(e) => { const v = e.target.value === '' ? undefined : parseFloat(e.target.value); onPatchModelOption('textToSpeech', 'speed', Number.isNaN(v) ? undefined : v); }} />
                    </div>
                  </>
                )}
              </ModelConfigSection>
            </>
          )}

          {activeConfigTab === 'raw' && (
            <section>
              <h3 className="section-label">Raw config</h3>
              <pre className="config-json">{JSON.stringify(projectConfig, null, 2)}</pre>
            </section>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p className="muted">No project config found.</p>
        </div>
      )}
    </div>
  );
}
