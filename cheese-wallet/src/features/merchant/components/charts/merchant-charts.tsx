import type { BreakdownSlice, RevenuePoint } from '../../types';
import { formatCompactNumber } from '../../lib/format';

function buildLinePath(points: RevenuePoint[], key: 'gross' | 'settled') {
  const width = 100;
  const height = 44;
  const padding = 4;
  const values = points.map((point) => point[key]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);

  return points
    .map((point, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
      const y =
        height -
        padding -
        ((point[key] - min) / range) * (height - padding * 2);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

export function RevenueAreaChart({ points }: { points: RevenuePoint[] }) {
  const grossPath = buildLinePath(points, 'gross');
  const settledPath = buildLinePath(points, 'settled');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-[color:var(--merchant-muted)]">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#1d4ed8]" />
          Gross volume
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#0f766e]" />
          Settled volume
        </span>
      </div>
      <svg viewBox="0 0 100 44" className="h-52 w-full overflow-visible">
        <defs>
          <linearGradient id="merchantGrossGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="merchantSettledGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f766e" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0f766e" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {points.map((point, index) => (
          <line
            key={point.label}
            x1={4 + (index * 92) / Math.max(points.length - 1, 1)}
            y1="4"
            x2={4 + (index * 92) / Math.max(points.length - 1, 1)}
            y2="40"
            stroke="rgba(148, 163, 184, 0.08)"
            strokeDasharray="1.5 3.5"
          />
        ))}
        <path d={`${grossPath} L 96 40 L 4 40 Z`} fill="url(#merchantGrossGradient)" />
        <path d={`${settledPath} L 96 40 L 4 40 Z`} fill="url(#merchantSettledGradient)" />
        <path d={grossPath} fill="none" stroke="#2563eb" strokeWidth="1.6" strokeLinecap="round" />
        <path d={settledPath} fill="none" stroke="#0f766e" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <div className="grid grid-cols-3 gap-3 text-xs text-[color:var(--merchant-muted)] md:grid-cols-6">
        {points.slice(-6).map((point) => (
          <div key={point.label}>
            <p>{point.label}</p>
            <p className="mt-1 font-semibold text-[color:var(--merchant-text)]">
              {formatCompactNumber(point.gross)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BreakdownDonutChart({ slices }: { slices: BreakdownSlice[] }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let offset = 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[220px,1fr] lg:items-center">
      <div className="relative mx-auto h-56 w-56">
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
          <circle
            cx="21"
            cy="21"
            r="15.915"
            fill="none"
            stroke="rgba(148, 163, 184, 0.12)"
            strokeWidth="4"
          />
          {slices.map((slice) => {
            const value = (slice.value / total) * 100;
            const dasharray = `${value} ${100 - value}`;
            const dashoffset = -offset;
            offset += value;

            return (
              <circle
                key={slice.label}
                cx="21"
                cy="21"
                r="15.915"
                fill="none"
                stroke={slice.color}
                strokeWidth="4"
                strokeDasharray={dasharray}
                strokeDashoffset={dashoffset}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--merchant-muted)]">
            Live mix
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--merchant-text)]">
            {total}%
          </p>
          <p className="mt-1 text-sm text-[color:var(--merchant-soft-text)]">
            Current distribution
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {slices.map((slice) => (
          <div
            key={slice.label}
            className="flex items-start justify-between gap-4 rounded-2xl border border-[color:var(--merchant-border)] bg-[color:var(--merchant-panel-soft)] px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <span
                className="mt-1 h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <div>
                <p className="text-sm font-semibold text-[color:var(--merchant-text)]">
                  {slice.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--merchant-muted)]">
                  {slice.note}
                </p>
              </div>
            </div>
            <span className="text-sm font-semibold text-[color:var(--merchant-text)]">
              {slice.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
