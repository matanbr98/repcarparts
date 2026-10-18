export default function Badge({ tone, className = "", children }) {
  return <span className={`badge ${tone ? `badge--${tone}` : ""} ${className}`.trim()}>{children}</span>;
}
