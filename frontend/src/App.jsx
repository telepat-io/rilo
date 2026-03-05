import { useEffect, useState } from 'react';
import { toDisplayAssetUrl } from './api.js';
import { Sidebar } from './components/layout/Sidebar.jsx';
import { ProjectHeader } from './components/layout/ProjectHeader.jsx';
import { StoryTab } from './components/tabs/StoryTab.jsx';
import { ConfigTab } from './components/tabs/ConfigTab.jsx';
import { VoiceTab } from './components/tabs/VoiceTab.jsx';
import { KeyframeTab } from './components/tabs/KeyframeTab.jsx';
import { AssetGridTab } from './components/tabs/AssetGridTab.jsx';
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
    setShotsText,
    setStoryDirty,
    setScriptDirty,

    configDraft,
    configDirty,
    savingConfig,
    patchConfig,
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
  } = useProjectController();

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
            <p className="empty-state-title">Select a project</p>
            <p className="muted">Or create a new one to get started.</p>
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
                />
              )}

              {activeTab === 'keyframes' && (
                <KeyframeTab
                  assets={keyframes}
                  shots={parseShotsText(shotsText)}
                  selectedProject={selectedProject}
                  isRunning={isRunning}
                  regeneratingMap={regeneratingMap}
                  mediaCss={mediaCss}
                  mediaColMin={mediaColMin}
                  assetCacheKey={assetCacheKey}
                  toDisplayAssetUrl={toDisplayAssetUrl}
                  onSaveShotPrompts={handleSaveShotPrompts}
                  onRegenerateProject={() => handleRunRegenerate(false)}
                  onTargetedRegenerate={handleTargetedRegenerate}
                />
              )}

              {activeTab === 'segments' && (
                <AssetGridTab
                  assets={segments}
                  type="segment"
                  selectedProject={selectedProject}
                  isRunning={isRunning}
                  regeneratingMap={regeneratingMap}
                  mediaCss={mediaCss}
                  mediaColMin={mediaColMin}
                  assetCacheKey={assetCacheKey}
                  toDisplayAssetUrl={toDisplayAssetUrl}
                  onRegenerateProject={() => handleRunRegenerate(false)}
                  onTargetedRegenerate={handleTargetedRegenerate}
                />
              )}

              {activeTab === 'output' && (
                <OutputTab
                  finalVideo={finalVideo}
                  selectedProject={selectedProject}
                  assetCacheKey={assetCacheKey}
                  mediaCss={mediaCss}
                  isRunning={isRunning}
                  toDisplayAssetUrl={toDisplayAssetUrl}
                  onRegenerateProject={() => handleRunRegenerate(false)}
                />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsTab
                  selectedProject={selectedProject}
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
