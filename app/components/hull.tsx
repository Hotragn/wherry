import { formatUsd } from "../lib/config.ts";

/** The locked tab as a boat's hold: saffron cargo fills the hull to what's left to spend. */
export function HullGauge({ left, total }: { left: bigint; total: bigint }) {
  const frac =
    total > 0n
      ? Math.max(0, Math.min(1, Number((left * 1000n) / total) / 1000))
      : 0;
  const top = 22 + (1 - frac) * 62;
  return (
    <svg
      viewBox="0 0 240 96"
      className="h-auto w-full max-w-[260px]"
      role="img"
      aria-label={`Hold ${Math.round(frac * 100)}% full: ${formatUsd(left)} of ${formatUsd(total)} left`}
    >
      <defs>
        <clipPath id="hold">
          <path d="M8 22 L232 22 C224 62 188 86 120 86 C52 86 16 62 8 22 Z" />
        </clipPath>
      </defs>
      <path
        d="M8 22 L232 22 C224 62 188 86 120 86 C52 86 16 62 8 22 Z"
        fill="var(--w-surface)"
      />
      <g clipPath="url(#hold)">
        <rect x="0" y={top} width="240" height="96" fill="var(--w-brand)" />
        <path
          d={`M0 ${top} q10 -3 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0`}
          fill="none"
          stroke="var(--w-ink)"
          strokeWidth="2"
        />
        {[60, 100, 140, 180].map((x) => (
          <line
            key={x}
            x1={x}
            y1="22"
            x2={x}
            y2="96"
            stroke="var(--w-ink)"
            strokeWidth="1.5"
            strokeDasharray="2 4"
          />
        ))}
      </g>
      <path
        d="M8 22 L232 22 C224 62 188 86 120 86 C52 86 16 62 8 22 Z"
        fill="none"
        stroke="var(--w-ink)"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <line
        x1="2"
        y1="22"
        x2="238"
        y2="22"
        stroke="var(--w-ink)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <line
        x1="120"
        y1="22"
        x2="120"
        y2="4"
        stroke="var(--w-ink)"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
