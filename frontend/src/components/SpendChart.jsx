import { formatMoney, monthLabel } from "../lib/format";

const W = 600;
const H = 200;
const PAD = { top: 16, right: 8, bottom: 28, left: 8 };

/** Small hand-written SVG bar chart of spend per month. data: [{ month: 'YYYY-MM', total }] */
export default function SpendChart({ data = [] }) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.total || 0));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(40, slot * 0.6);
  const summary = data.map((d) => `${monthLabel(d.month)} ${formatMoney(d.total)}`).join(", ");

  return (
    <figure className="spend-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Monthly spend: ${summary}`} preserveAspectRatio="xMidYMid meet">
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--border-strong)" />
        {data.map((d, i) => {
          const h = Math.round(((d.total || 0) / max) * innerH);
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const y = H - PAD.bottom - h;
          return (
            <g key={d.month}>
              <rect x={x} y={y} width={barW} height={Math.max(h, d.total ? 2 : 0)} rx="4" fill="var(--teal-500)">
                <title>{`${d.month}: ${formatMoney(d.total)}`}</title>
              </rect>
              {d.total > 0 && data.length <= 12 && (
                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="11" fill="var(--navy-700)">
                  {d.total}
                </text>
              )}
              <text x={x + barW / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">
                {monthLabel(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
