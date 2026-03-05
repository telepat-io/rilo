import { Modal } from './ui/Modal.jsx';

export function CreateProjectModal({
  open,
  creatingProject,
  createProjectName,
  createProjectStory,
  onClose,
  onSubmit,
  onNameChange,
  onStoryChange
}) {
  return (
    <Modal open={open} title="New project" onClose={onClose}>
      <form className="modal-form" onSubmit={onSubmit}>
        <div className="field">
          <label className="field-label">Project name</label>
          <input
            type="text"
            placeholder="my-project-name"
            value={createProjectName}
            onChange={(event) => onNameChange(event.target.value)}
            required
            autoFocus
          />
          <span className="field-hint">Lowercase letters, numbers, hyphens, underscores</span>
        </div>
        <div className="field">
          <label className="field-label">Story <span className="field-hint">(optional)</span></label>
          <textarea
            placeholder="Paste your story here…"
            value={createProjectStory}
            onChange={(event) => onStoryChange(event.target.value)}
            rows={6}
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={creatingProject}>
            {creatingProject ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
