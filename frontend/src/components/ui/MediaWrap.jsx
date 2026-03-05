export function MediaWrap({ ar, children }) {
  return (
    <div className="media-wrap" style={{ '--ar': ar }}>
      {children}
    </div>
  );
}
