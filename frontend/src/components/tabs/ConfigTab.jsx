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

  return (
    <div className="tab-pane">
      {configDraft ? (
        <>
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

          <section>
            <h3 className="section-label">Raw config</h3>
            <pre className="config-json">{JSON.stringify(projectConfig, null, 2)}</pre>
          </section>
        </>
      ) : (
        <div className="empty-state">
          <p className="muted">No project config found.</p>
        </div>
      )}
    </div>
  );
}

