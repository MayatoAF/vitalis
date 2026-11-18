import { useId } from 'react';

interface Band {
  from: number;
  to: number;
  color?: string;
}

interface LineChartProps {
  values: number[];
  labels?: string[];
  height?: number;
  color?: string;
  min?: number;
  max?: number;
  band?: Band;
  goal?: number;
  unit?: string;
  formatValue?: (value: number) => string;
  ariaLabel: string;
}

const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 22;
const W = 600;

export function LineChart({
  values,
  labels,
  height = 180,
  color = 'var(--mint)',
  min,
  max,
  band,
  goal,
  unit = '',
  formatValue,
  ariaLabel,
}: LineChartProps) {
  const gradientId = useId().replace(/:/g, '');
  const data = values.length ? values : [0];
  const innerH = height - PAD_T - PAD_B;
  const innerW = W - PAD_L - PAD_R;
  const numeric = data.filter((value) => Number.isFinite(value));
  const dataMin = numeric.length ? Math.min(...numeric) : 0;
  const dataMax = numeric.length ? Math.max(...numeric) : 1;
  const padding = Math.max(1, (dataMax - dataMin) * 0.14);
  let lo = min ?? dataMin - padding;
  let hi = max ?? dataMax + padding;
  if (hi - lo < 1) {
    hi = lo + 1;
  }
  if (band) {
    lo = Math.min(lo, band.from);
    hi = Math.max(hi, band.to);
  }

  const xAt = (index: number) => PAD_L + (data.length === 1 ? innerW / 2 : (index / (data.length - 1)) * innerW);
  const yAt = (value: number) => PAD_T + innerH - ((value - lo) / (hi - lo)) * innerH;

  const linePath = data.map((value, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(1)},${yAt(value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${xAt(data.length - 1).toFixed(1)},${PAD_T + innerH} L${xAt(0).toFixed(1)},${PAD_T + innerH} Z`;

  const gridValues = [lo, lo + (hi - lo) / 2, hi];
  const labelIndexes = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
    (value, index, array) => array.indexOf(value) === index,
  );
  const fmt = formatValue ?? ((value: number) => `${Math.round(value)}${unit}`);

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={ariaLabel} style={{ width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id={`grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {band ? (
          <rect
            x={PAD_L}
            y={yAt(band.to)}
            width={innerW}
            height={Math.max(1, yAt(band.from) - yAt(band.to))}
            fill={band.color ?? 'rgba(47,224,176,0.1)'}
            rx={4}
          />
        ) : null}

        <g className="chart-grid">
          {gridValues.map((value, index) => (
            <line key={index} x1={PAD_L} x2={W - PAD_R} y1={yAt(value)} y2={yAt(value)} />
          ))}
        </g>

        {gridValues.map((value, index) => (
          <text key={index} className="chart-axis" x={PAD_L - 7} y={yAt(value) + 3} textAnchor="end">
            {Math.round(value)}
          </text>
        ))}

        {goal !== undefined ? (
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={yAt(goal)}
            y2={yAt(goal)}
            stroke="var(--muted)"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.6"
          />
        ) : null}

        <path d={areaPath} fill={`url(#grad-${gradientId})`} />
        <path className="chart-line" d={linePath} stroke={color} />

        {data.length <= 24
          ? data.map((value, index) => (
              <circle key={index} className="chart-dot" cx={xAt(index)} cy={yAt(value)} r={2.6} fill={color}>
                <title>{`${labels?.[index] ?? ''}: ${fmt(value)}`}</title>
              </circle>
            ))
          : null}

        {labels
          ? labelIndexes.map((index) => (
              <text key={index} className="chart-axis" x={xAt(index)} y={height - 4} textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}>
                {labels[index]}
              </text>
            ))
          : null}
      </svg>
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  muted?: boolean;
}

export function WeeklyBars({
  data,
  goal,
  color = 'var(--mint)',
  formatValue,
  ariaLabel,
}: {
  data: BarDatum[];
  goal?: number;
  color?: string;
  formatValue?: (value: number) => string;
  ariaLabel: string;
}) {
  const maxValue = Math.max(goal ?? 0, ...data.map((item) => item.value), 1);
  const fmt = formatValue ?? ((value: number) => `${Math.round(value)}`);
  return (
    <div className="weekly-bars" role="img" aria-label={ariaLabel}>
      {data.map((item) => {
        const pct = Math.max(3, Math.min(100, (item.value / maxValue) * 100));
        return (
          <div className="bar-col" key={item.label} title={`${item.label}: ${fmt(item.value)}`}>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  height: `${pct}%`,
                  background: item.muted
                    ? 'var(--surface-3)'
                    : `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 45%, transparent))`,
                }}
              />
              {goal !== undefined && goal > 0 ? <span className="bar-goal" style={{ bottom: `${(goal / maxValue) * 100}%` }} /> : null}
            </div>
            <span className="bar-label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StackedBar({
  parts,
  ariaLabel,
}: {
  parts: { value: number; color: string; label: string }[];
  ariaLabel: string;
}) {
  const total = parts.reduce((acc, part) => acc + part.value, 0) || 1;
  return (
    <div>
      <div className="tir-bar" role="img" aria-label={ariaLabel}>
        {parts.map((part) => (
          <span key={part.label} style={{ width: `${(part.value / total) * 100}%`, background: part.color }} title={`${part.label}: ${Math.round(part.value)}%`} />
        ))}
      </div>
      <div className="tir-legend">
        {parts.map((part) => (
          <span className="tir-legend__item" key={part.label}>
            <span className="tir-legend__dot" style={{ background: part.color }} />
            {part.label} <b>{Math.round(part.value)}%</b>
          </span>
        ))}
      </div>
    </div>
  );
}
