import type { ReactNode } from 'react'

interface Props {
  /** 0–1 */
  value: number
  size?: number
  stroke?: number
  color?: string
  label: string
  children?: ReactNode
}

export function ProgressRing({ value, size = 64, stroke = 6, color = 'var(--accent)', label, children }: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.min(1, Math.max(0, value))
  return (
    <div
      role="img"
      aria-label={`${label}: ${Math.round(clamped * 100)}%`}
      style={{ position: 'relative', width: size, height: size, flex: 'none' }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 600ms ease' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          fontSize: size / 4.2,
        }}
      >
        {children ?? `${Math.round(clamped * 100)}%`}
      </div>
    </div>
  )
}
