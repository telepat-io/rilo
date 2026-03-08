import { useEffect, useState } from 'react';
import { toDisplayAssetUrl } from './api.js';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { ProjectHeader } from './components/layout/ProjectHeader.jsx';
import { StoryTab } from './components/tabs/StoryTab.jsx';
import { ConfigTab } from './components/tabs/ConfigTab.jsx';
import { VoiceTab } from './components/tabs/VoiceTab.jsx';
import { KeyframeTab } from './components/tabs/KeyframeTab.jsx';
import { SegmentsTab } from './components/tabs/SegmentsTab.jsx';
import { OutputTab } from './components/tabs/OutputTab.jsx';
import { AnalyticsTab } from './components/tabs/AnalyticsTab.jsx';
import { CreateProjectModal } from './components/CreateProjectModal.jsx';
import { useProjectController } from './hooks/useProjectController.js';

export function App() {
  const [activeTab, setActiveTab] = useState('story');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
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
    activeSegmentIndex,
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
  } = useProjectController();

  const parsedShots = parseShotsText(shotsText);
  const expectedSegmentCount = Math.max(0, parsedShots.length - 1);
  const includeSubtitleStages = Boolean(
    configDraft?.subtitleOptions?.enabled ?? projectDetails?.config?.subtitleOptions?.enabled
  );

  useEffect(() => {
    setActiveTab('story');
  }, [selectedProject]);

  return (
    <div className="app-shell">
      <Sidebar
        apiBaseUrl={apiConfig.apiBaseUrl}
        hasToken={apiConfig.hasToken}
        loadingProjects={loadingProjects}
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={setSelectedProject}
        onShowCreate={() => setShowCreateModal(true)}
        onRefreshProjects={loadProjects}
      />

      <div className="main-area">
        {!selectedProject ? (
          <div className="empty-state">
            <img src="/talefire-logo-dark.svg" alt="Talefire" className="empty-state-logo" />
            <p className="empty-state-title">Select a project to get started</p>
            <p className="muted size-sm">Pick an existing project from the sidebar, or create a new one.</p>
            <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>+ New project</button>
          </div>
        ) : (
          <>
            <ProjectHeader
              selectedProject={selectedProject}
              runStatus={runStatus}
              isRunning={isRunning}
              loadingDetails={loadingDetails}
              steps={steps}
              activeStep={activeStep}
              includeSubtitleStages={includeSubtitleStages}
              tabs={tabs}
              activeTab={activeTab}
              onRefresh={() => loadProjectDetails(selectedProject)}
              onRegenerate={() => handleRunRegenerate(false)}
              onForceRestart={() => handleRunRegenerate(true)}
              onChangeTab={setActiveTab}
            />

            <div className="tab-content">
              {activeTab === 'story' && (
                <StoryTab
                  storyText={storyText}
                  dirty={storyDirty}
                  savingContent={savingStoryContent}
                  onStoryChange={(value) => {
                    setStoryText(value);
                    setStoryDirty(true);
                  }}
                  onSave={handleSaveStoryContent}
                />
              )}

              {activeTab === 'config' && (
                <ConfigTab
                  configDraft={configDraft}
                  projectConfig={projectDetails?.config}
                  mediaW={mediaW}
                  mediaH={mediaH}
                  configDirty={configDirty}
                  savingConfig={savingConfig}
                  isRunning={isRunning}
                  onPatchConfig={patchConfig}
                  onPatchModel={patchConfigModel}
                  onPatchModelOption={patchConfigModelOption}
                  onPatchOptionalInt={patchOptionalIntConfig}
                  onSaveConfig={handleSaveConfig}
                />
              )}

              {activeTab === 'voice' && (
                <VoiceTab
                  voiceAsset={voiceAsset}
                  selectedProject={selectedProject}
                  assetCacheKey={assetCacheKey}
                  isRunning={isRunning}
                  busy={Boolean(regeneratingMap.voiceover)}
                  scriptBusy={Boolean(regeneratingMap.script)}
                  scriptText={scriptText}
                  dirty={scriptDirty}
                  savingContent={savingScriptContent}
                  onScriptChange={(value) => {
                    setScriptText(value);
                    setScriptDirty(true);
                  }}
                  onSave={handleSaveScriptContent}
                  toDisplayAssetUrl={toDisplayAssetUrl}
                  onRegenerateVoice={() => handleTargetedRegenerate('voiceover')}
                  onRegenerateScript={() => handleTargetedRegenerate('script')}
                  configDraft={configDraft}
                  onPatchModel={patchConfigModel}
                  onPatchModelOption={patchConfigModelOption}
                  configDirty={configDirty}
                  savingConfig={savingConfig}
                  onSaveConfig={handleSaveConfig}
                />
              )}

              {activeTab === 'keyframes' && (
                <KeyframeTab
                  assets={keyframes}
                  shots={parsedShots}
                  selectedProject={selectedProject}
                  isRunning={isRunning}
                  activeStep={activeStep}
                  activeSegmentIndex={activeSegmentIndex}
                  regeneratingMap={regeneratingMap}
                  mediaCss={mediaCss}
                  mediaColMin={mediaColMin}
                  assetCacheKey={assetCacheKey}
                  toDisplayAssetUrl={toDisplayAssetUrl}
                  onSaveShotPrompts={handleSaveShotPrompts}
                  onRegenerateProject={() => handleRunRegenerate(false)}
                  onTargetedRegenerate={handleTargetedRegenerate}
                  configDraft={configDraft}
                  onPatchModel={patchConfigModel}
                  onPatchModelOption={patchConfigModelOption}
                  configDirty={configDirty}
                  savingConfig={savingConfig}
                  onSaveConfig={handleSaveConfig}
                />
              )}

              {activeTab === 'segments' && (
                <SegmentsTab
                  assets={segments}
                  expectedCount={expectedSegmentCount}
                  selectedProject={selectedProject}
                  isRunning={isRunning}
                  activeStep={activeStep}
                  regeneratingMap={regeneratingMap}
                  mediaCss={mediaCss}
                  mediaColMin={mediaColMin}
                  assetCacheKey={assetCacheKey}
                  toDisplayAssetUrl={toDisplayAssetUrl}
                  onRegenerateProject={() => handleRunRegenerate(false)}
                  onTargetedRegenerate={handleTargetedRegenerate}
                  configDraft={configDraft}
                  onPatchModel={patchConfigModel}
                  onPatchModelOption={patchConfigModelOption}
                  configDirty={configDirty}
                  savingConfig={savingConfig}
                  onSaveConfig={handleSaveConfig}
                />
              )}

              {activeTab === 'output' && (
                <OutputTab
                  finalVideo={finalVideo}
                  selectedProject={selectedProject}
                  assetCacheKey={assetCacheKey}
                  mediaCss={mediaCss}
                  isRunning={isRunning}
                  subtitleEnabled={includeSubtitleStages}
                  alignBusy={Boolean(regeneratingMap.align)}
                  burninBusy={Boolean(regeneratingMap.burnin)}
                  toDisplayAssetUrl={toDisplayAssetUrl}
                  onRegenerateProject={() => handleRunRegenerate(false)}
                  onRegenerateAlign={() => handleTargetedRegenerate('align')}
                  onRegenerateBurnin={() => handleTargetedRegenerate('burnin')}
                />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsTab
                  selectedProject={selectedProject}
                  includeSubtitleStages={includeSubtitleStages}
                />
              )}
            </div>
          </>
        )}
      </div>

      {(message || errorMessage) && (
        <div className={`toast-popup ${errorMessage ? 'toast-error' : 'toast-ok'}`}>
          <span>{errorMessage || message}</span>
          <button type="button" className="toast-close" onClick={clearToast}>✕</button>
        </div>
      )}

      <CreateProjectModal
        open={showCreateModal}
        creatingProject={creatingProject}
        createProjectName={createProjectName}
        createProjectStory={createProjectStory}
        onClose={() => setShowCreateModal(false)}
        onSubmit={(event) => handleCreateProject(event, () => setShowCreateModal(false))}
        onNameChange={setCreateProjectName}
        onStoryChange={setCreateProjectStory}
      />
    </div>
  );
}
