export function StatusBadge({ status }) {
  const className = {
    pending: 'badge badge-pending',
    running: 'badge badge-running',
    completed: 'badge badge-ok',
    failed: 'badge badge-fail',
    paused: 'badge badge-paused'
  }[status] || 'badge';

  return <span className={className}>{status || 'unknown'}</span>;
}
