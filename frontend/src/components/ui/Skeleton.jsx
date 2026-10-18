export default function Skeleton({ width = "100%", height = 16, radius, style, className = "" }) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

/** Convenience block: a card-shaped placeholder with a few text lines. */
export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="card" role="status" aria-label="Loading">
      <div className="stack">
        <Skeleton width="45%" height={20} />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} width={i === lines - 1 ? "70%" : "100%"} height={14} />
        ))}
      </div>
    </div>
  );
}
