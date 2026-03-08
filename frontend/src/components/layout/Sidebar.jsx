export function Sidebar({
  apiBaseUrl,
  hasToken,
  loadingProjects,
  projects,
  selectedProject,
  onSelectProject,
  onShowCreate,
  onRefreshProjects
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/talefire-logo-dark.svg" alt="Talefire" className="logo-img" />
        {!hasToken && <span className="badge badge-fail">No token</span>}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-row">
          <span className="sidebar-section-title">Projects</span>
          <button type="button" className="btn btn-sm btn-primary" onClick={onShowCreate}>+ New</button>
        </div>
        {loadingProjects
          ? <p className="muted size-sm">Loading…</p>
          : (
            <ul className="project-list">
              {projects.map((projectName) => (
                <li key={projectName}>
                  <button
                    type="button"
                    className={`project-item${projectName === selectedProject ? ' project-item-active' : ''}`}
                    onClick={() => onSelectProject(projectName)}
                  >
                    {projectName}
                  </button>
                </li>
              ))}
              {projects.length === 0 && <li><p className="muted size-sm">No projects yet.</p></li>}
            </ul>
          )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRefreshProjects} disabled={loadingProjects}>
          ↻ Refresh list
        </button>
      </div>

      <div className="sidebar-footer">
        <span className="muted size-xs">{apiBaseUrl}</span>
      </div>
    </aside>
  );
}
