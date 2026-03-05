import { useEffect, useMemo, useState } from 'react';
import {
  createProject,
  getApiConfigSummary,
  getJob,
  getProject,
  getProjectPrompts,
  listProjects,
  patchProjectConfig,
  patchProjectContent,
  regenerateProject
} from '../api.js';

const AR_PRESETS = { '9:16': [576, 1024], '16:9': [1024, 576], '1:1': [1024, 1024] };
const POLL_INTERVAL_MS = Number(import.meta.env.VITE_POLL_INTERVAL_MS || 3000);
const DEFAULT_MODEL_SELECTIONS = {
  textToText: 'deepseek-ai/deepseek-v3',
  textToSpeech: 'minimax/speech-02-turbo',
  textToImage: 'prunaai/z-image-turbo',
  imageTextToVideo: 'wan-video/wan-2.2-i2v-fast'
};

function resolveMediaDimensions(config, artifacts) {
  const sizeKey = artifacts?.keyframeSizeKey;
  if (sizeKey) {
    const [width, height] = sizeKey.split('x').map(Number);
    if (width > 0 && height > 0) return { width, height };
  }

  if (Number.isInteger(config?.keyframeWidth) && Number.isInteger(config?.keyframeHeight)) {
    return { width: config.keyframeWidth, height: config.keyframeHeight };
  }

  const [width, height] = AR_PRESETS[config?.aspectRatio] || AR_PRESETS['9:16'];
  return { width, height };
}

function sortByPath(arr) {
  return [...arr].sort((a, b) => a.path.localeCompare(b.path));
}

function parseShotsText(input) {
  return input.split('\n').map((line) => line.trim()).filter(Boolean);
}

function normalizeConfigDraft(config) {
  if (!config || typeof config !== 'object') {
    return null;
  }

  return {
    ...config,
    models: {
      ...DEFAULT_MODEL_SELECTIONS,
      ...(config.models || {})
    },
    modelOptions: {
      ...(config.modelOptions || {})
    }
  };
}

export function useProjectController() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [projectDetails, setProjectDetails] = useState(null);
  const [currentJob, setCurrentJob] = useState(null);
  const [activeJobId, setActiveJobId] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [savingStoryContent, setSavingStoryContent] = useState(false);
  const [savingScriptContent, setSavingScriptContent] = useState(false);
  const [regeneratingMap, setRegeneratingMap] = useState({});
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [assetCacheKey, setAssetCacheKey] = useState(0);

  const [createProjectName, setCreateProjectName] = useState('');
  const [createProjectStory, setCreateProjectStory] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  const [storyText, setStoryText] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [shotsText, setShotsText] = useState('');
  const [storyDirty, setStoryDirty] = useState(false);
  const [scriptDirty, setScriptDirty] = useState(false);

  const [configDraft, setConfigDraft] = useState(null);
  const [configDirty, setConfigDirty] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const apiConfig = getApiConfigSummary();

  const assets = projectDetails?.assets || [];
  const voiceAsset = useMemo(
    () => assets.find((asset) => asset.path === 'assets/audio/voiceover.mp3')
      || assets.find((asset) => asset.path.startsWith('assets/audio/'))
      || null,
    [assets]
  );
  const keyframes = useMemo(() => sortByPath(assets.filter((asset) => asset.path.startsWith('assets/keyframes/'))), [assets]);
  const segments = useMemo(() => sortByPath(assets.filter((asset) => asset.path.startsWith('assets/segments/'))), [assets]);
  const finalVideo = useMemo(() => assets.find((asset) => asset.path === 'final.mp4') || null, [assets]);

  const { width: mediaW, height: mediaH } = resolveMediaDimensions(
    projectDetails?.config,
    projectDetails?.runState?.artifacts
  );
  const mediaCss = `${mediaW}/${mediaH}`;
  const mediaColMin = `${Math.min(320, Math.max(120, Math.round(220 * mediaW / mediaH)))}px`;
  const runStatus = currentJob?.status || projectDetails?.runState?.status;
  const isRunning = runStatus === 'running' || runStatus === 'pending';
  const rawSteps = (isRunning ? currentJob?.steps : null) || projectDetails?.runState?.steps;
  const activeStep =
    isRunning
    && typeof currentJob?.payload?.activeStep === 'string'
      ? currentJob.payload.activeStep
      : null;
  const hasPendingChangedShots =
    isRunning
    && Array.isArray(currentJob?.payload?.changedShotIndexes)
    && currentJob.payload.changedShotIndexes.length > 0;
  const steps = hasPendingChangedShots
    ? {
      ...rawSteps,
      keyframes: activeStep === 'segments' || activeStep === 'compose',
      segments: activeStep === 'compose',
      compose: false
    }
    : rawSteps;

  const tabs = [
    { id: 'story', label: 'Story' },
    { id: 'config', label: 'Project Config' },
    { id: 'voice', label: 'Voice', count: voiceAsset ? 1 : null },
    { id: 'keyframes', label: 'Keyframes', count: keyframes.length || null },
    { id: 'segments', label: 'Segments', count: segments.length || null },
    { id: 'output', label: 'Output', count: finalVideo ? 1 : null },
    { id: 'analytics', label: 'Analytics', align: 'right' }
  ];

  function flash(msg, isError = false) {
    if (isError) {
      setErrorMessage(msg);
      setMessage('');
      return;
    }

    setMessage(msg);
    setErrorMessage('');
  }

  function clearToast() {
    setMessage('');
    setErrorMessage('');
  }

  async function loadProjects() {
    setLoadingProjects(true);
    try {
      const response = await listProjects();
      setProjects(response.projects || []);
      if (!selectedProject && response.projects?.length) {
        setSelectedProject(response.projects[0]);
      }
    } catch (error) {
      flash(error.message, true);
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadProjectDetails(projectName) {
    if (!projectName) {
      setProjectDetails(null);
      return;
    }

    setLoadingDetails(true);
    try {
      const [details, prompts] = await Promise.all([getProject(projectName), getProjectPrompts(projectName)]);
      setProjectDetails(details);
      setStoryText(details.story || '');
      setScriptText(prompts.script || details.runState?.artifacts?.script || '');
      setShotsText((prompts.shots || details.runState?.artifacts?.shots || []).join('\n'));
      setStoryDirty(false);
      setScriptDirty(false);
      setConfigDraft(normalizeConfigDraft(details.config));
      setConfigDirty(false);
      setAssetCacheKey((value) => value + 1);
    } catch (error) {
      flash(error.message, true);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function refreshProjectAssets(projectName) {
    if (!projectName) return;

    try {
      const [details, prompts] = await Promise.all([
        getProject(projectName),
        getProjectPrompts(projectName)
      ]);
      setProjectDetails(details);

      if (!scriptDirty) {
        setScriptText(prompts.script || details.runState?.artifacts?.script || '');
      }

      if (!storyDirty) {
        setShotsText((prompts.shots || details.runState?.artifacts?.shots || []).join('\n'));
      }
    } catch {
      // silent polling errors
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    loadProjectDetails(selectedProject);
    setCurrentJob(null);
    setActiveJobId('');
    clearToast();
  }, [selectedProject]);

  useEffect(() => {
    if (!message && !errorMessage) return undefined;
    const id = setTimeout(() => {
      setMessage('');
      setErrorMessage('');
    }, 5000);
    return () => clearTimeout(id);
  }, [message, errorMessage]);

  useEffect(() => {
    if (!selectedProject || !activeJobId) return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const job = await getJob(activeJobId);
        if (cancelled) return;

        setCurrentJob(job);
        if (job.status === 'completed' || job.status === 'failed') {
          setActiveJobId('');
          if (job.status === 'failed') {
            flash(`Job failed: ${job.error || 'unknown error'}`, true);
          } else {
            flash('Generation complete.');
          }
          await loadProjectDetails(selectedProject);
          return;
        }

        await refreshProjectAssets(selectedProject);
      } catch (error) {
        if (!cancelled) {
          flash(error.message, true);
          setActiveJobId('');
        }
      }
    };

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeJobId, selectedProject]);

  useEffect(() => {
    const shouldPollProject = Boolean(selectedProject) && !activeJobId && (runStatus === 'running' || runStatus === 'pending');
    if (!shouldPollProject) return undefined;

    let cancelled = false;
    const pollProject = async () => {
      if (cancelled) return;
      await refreshProjectAssets(selectedProject);
    };

    pollProject();
    const timer = setInterval(pollProject, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selectedProject, activeJobId, runStatus]);

  async function handleCreateProject(event, onSuccess) {
    event.preventDefault();
    setCreatingProject(true);
    try {
      const created = await createProject({ project: createProjectName, story: createProjectStory });
      setCreateProjectName('');
      setCreateProjectStory('');
      flash(`Project "${created.project}" created.`);
      await loadProjects();
      setSelectedProject(created.project);
      if (typeof onSuccess === 'function') {
        onSuccess(created);
      }
    } catch (error) {
      flash(error.message, true);
    } finally {
      setCreatingProject(false);
    }
  }

  async function handleSaveStoryContent() {
    if (!selectedProject) return;

    setSavingStoryContent(true);
    try {
      await patchProjectContent(selectedProject, {
        story: storyText,
        shots: parseShotsText(shotsText)
      });
      flash('Story saved.');
      setStoryDirty(false);
      await loadProjectDetails(selectedProject);
    } catch (error) {
      flash(error.message, true);
    } finally {
      setSavingStoryContent(false);
    }
  }

  async function handleSaveScriptContent() {
    if (!selectedProject) return;

    setSavingScriptContent(true);
    try {
      await patchProjectContent(selectedProject, {
        script: scriptText
      });
      flash('Script saved.');
      setScriptDirty(false);
      await loadProjectDetails(selectedProject);
    } catch (error) {
      flash(error.message, true);
    } finally {
      setSavingScriptContent(false);
    }
  }

  async function handleSaveShotPrompts(updatedShotsText) {
    if (!selectedProject) return;
    try {
      await patchProjectContent(selectedProject, {
        shots: parseShotsText(updatedShotsText)
      });
      flash('Prompt saved.');
      setShotsText(updatedShotsText);
    } catch (error) {
      flash(error.message, true);
      throw error;
    }
  }

  function patchConfig(key, value) {
    setConfigDraft((previous) => {
      const next = { ...previous };
      if (value === null || value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
    setConfigDirty(true);
  }

  function patchOptionalIntConfig(key, value) {
    const parsed = value === '' ? undefined : parseInt(value, 10);
    patchConfig(key, Number.isNaN(parsed) ? undefined : parsed);
  }

  function patchConfigModel(category, value) {
    setConfigDraft((previous) => {
      const base = normalizeConfigDraft(previous) || normalizeConfigDraft({}) || { models: { ...DEFAULT_MODEL_SELECTIONS } };
      const nextValue = typeof value === 'string' ? value.trim() : '';
      return {
        ...base,
        models: {
          ...base.models,
          [category]: nextValue
        }
      };
    });
    setConfigDirty(true);
  }

  function patchConfigModelOption(category, key, value) {
    setConfigDraft((previous) => {
      const base = normalizeConfigDraft(previous) || { models: { ...DEFAULT_MODEL_SELECTIONS }, modelOptions: {} };
      const prevCat = (base.modelOptions?.[category]) || {};
      return {
        ...base,
        modelOptions: {
          ...(base.modelOptions || {}),
          [category]: { ...prevCat, [key]: value }
        }
      };
    });
    setConfigDirty(true);
  }

  async function handleSaveConfig() {
    if (!selectedProject || !configDraft) return;

    setSavingConfig(true);
    try {
      await patchProjectConfig(selectedProject, configDraft);
      flash('Config saved.');
      setConfigDirty(false);
      await loadProjectDetails(selectedProject);
    } catch (error) {
      flash(error.message, true);
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleRunRegenerate(forceRestart) {
    if (!selectedProject) return;

    try {
      const response = await regenerateProject(selectedProject, { forceRestart });
      if (response.jobId) {
        setActiveJobId(response.jobId);
        flash('Generation started.');
      } else {
        flash('Regeneration request accepted.');
      }
    } catch (error) {
      if (error.status === 409 && error.payload?.jobId) {
        setActiveJobId(error.payload.jobId);
        flash('Attached to active job.');
        return;
      }
      flash(error.message, true);
    }
  }

  async function handleTargetedRegenerate(targetType, index) {
    if (!selectedProject) return;

    const key = targetType === 'voiceover' || targetType === 'script'
      ? targetType
      : `${targetType}-${index}`;
    setRegeneratingMap((map) => ({ ...map, [key]: true }));
    try {
      await regenerateProject(
        selectedProject,
        targetType === 'voiceover' || targetType === 'script' ? { targetType } : { targetType, index }
      );
      if (targetType === 'voiceover') {
        flash('Voiceover regenerated.');
      } else if (targetType === 'script') {
        flash('Script regenerated.');
      } else {
        flash(`${targetType === 'keyframe' ? 'Keyframe' : 'Segment'} ${index + 1} regenerated.`);
      }
      await loadProjectDetails(selectedProject);
      setAssetCacheKey((value) => value + 1);
    } catch (error) {
      flash(error.message, true);
    } finally {
      setRegeneratingMap((map) => {
        const next = { ...map };
        delete next[key];
        return next;
      });
    }
  }

  return {
    apiConfig,
    projects,
    selectedProject,
    setSelectedProject,
    projectDetails,
    loadingProjects,
    loadingDetails,
    savingStoryContent,
    savingScriptContent,
    regeneratingMap,
    message,
    errorMessage,
    clearToast,
    assetCacheKey,

    createProjectName,
    setCreateProjectName,
    createProjectStory,
    setCreateProjectStory,
    creatingProject,

    storyText,
    scriptText,
    shotsText,
    storyDirty,
    scriptDirty,
    setStoryText,
    setScriptText,
    setShotsText,
    setStoryDirty,
    setScriptDirty,

    configDraft,
    configDirty,
    savingConfig,
    patchConfig,
    patchConfigModel,
    patchConfigModelOption,
    patchOptionalIntConfig,

    keyframes,
    segments,
    voiceAsset,
    finalVideo,
    mediaW,
    mediaH,
    mediaCss,
    mediaColMin,
    runStatus,
    isRunning,
    steps,
    activeStep,
    tabs,

    loadProjects,
    loadProjectDetails,
    parseShotsText,
    handleCreateProject,
    handleSaveStoryContent,
    handleSaveScriptContent,
    handleSaveShotPrompts,
    handleSaveConfig,
    handleRunRegenerate,
    handleTargetedRegenerate
  };
}
