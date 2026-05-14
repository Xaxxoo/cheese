import type { BreakdownSlice, RevenuePoint } from '../../types';
import { formatCompactNumber } from '../../lib/format';

/* ─── Revenue Area Chart ─────────────────────────────── */

function buildPath(points: RevenuePoint[], key: 'gross' | 'settled') {
  if (points.length < 2) return '';
  const W = 100, H = 48, PX = 4, PY = 6;
  const values = points.map((p) => p[key]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);

  return points
    .map((p, i) => {
      const x = PX + (i / (points.length - 1)) * (W - PX * 2);
      const y = H - PY - ((p[key] - min) / range) * (H - PY * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export function RevenueAreaChart({ points }: { points: RevenuePoint[] }) {
  if (!points.length) return null;

  const grossPath   = buildPath(points, 'gross');
  const settledPath = buildPath(points, 'settled');
  const maxVal      = Math.max(...points.map((p) => p.gross), 1);
  const displayPoints = points.slice(-7);

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-[color:var(--merchant-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#D4A843]" />
          Gross
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[color:var(--merchant-border)] opacity-80" />
          Settled
        </span>
        <span className="ml-auto font-medium text-[color:var(--merchant-text)]">
          {formatCompactNumber(maxVal)} peak
        </span>
      </div>

      {/* SVG Chart */}
      <div className="relative overflow-hidden rounded-lg">
        <svg
          viewBox="0 0 100 48"
          preserveAspectRatio="none"
          className="h-48 w-full"
        >
          <defs>
            <linearGradient id="m-gross-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#D4A843" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#D4A843" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id="m-settled-g" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#94A3B8" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((frac) => (
            <line
              key={frac}
              x1="4" y1={6 + frac * 36}
              x2="96" y2={6 + frac * 36}
              stroke="currentColor"
              strokeOpacity="0.06"
              strokeWidth="0.4"
            />
          ))}

          {/* Settled area + line */}
          <path
            d={`${settledPath} L 96 48 L 4 48 Z`}
            fill="url(#m-settled-g)"
          />
          <path
            d={settledPath}
            fill="none"
            stroke="#94A3B8"
            strokeWidth="1"
            strokeOpacity="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Gross area + line */}
          <path
            d={`${grossPath} L 96 48 L 4 48 Z`}
            fill="url(#m-gross-g)"
          />
          <path
            d={grossPath}
            fill="none"
            stroke="#D4A843"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="flex items-center justify-between text-[10px] text-[color:var(--merchant-muted)]">
        {displayPoints.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}

/* ─── Donut Chart ────────────────────────────────────── */

export function BreakdownDonutChart({ slices }: { slices: BreakdownSlice[] }) {
  const total  = slices.reduce((s, slice) => s + slice.value, 0);
  let   offset = 0;

  if (!slices.length || total === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-xs text-[color:var(--merchant-muted)]">No data available.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-5">
      {/* Donut */}
      <div className="relative h-20 w-20 flex-shrink-0">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle
            cx="21" cy="21" r="15.915"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.07"
            strokeWidth="5"
          />
          {slices.map((slice) => {
            const pct       = (slice.value / total) * 100;
            const dasharray = `${pct} ${100 - pct}`;
            const dash      = -offset;
            offset += pct;
            return (
              <circle
                key={slice.label}
                cx="21" cy="21" r="15.915"
                fill="none"
                stroke={slice.color}
                strokeWidth="5"
                strokeDasharray={dasharray}
                strokeDashoffset={dash}
                strokeLinecap="butt"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-[11px] font-semibold text-[color:var(--merchant-text)]">
            {total}%
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-2 min-w-0">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center gap-2 text-xs">
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="min-w-0 flex-1 truncate text-[color:var(--merchant-soft-text)]">
              {slice.label}
            </span>
            <span className="flex-shrink-0 font-medium text-[color:var(--merchant-text)]">
              {slice.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
