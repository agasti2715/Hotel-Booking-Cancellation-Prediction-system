import type { RiskLevel } from '../lib/api'
import { formatRisk, riskTone, type Tone } from '../lib/tones'

/** Half-circle gauge for the cancellation risk. */
export function RiskGauge({ value, level }: { value: number; level: RiskLevel }) {
  const length = Math.PI * 50
  const filled = (Math.max(0, Math.min(100, value)) / 100) * length
  return (
    <div className={`gauge gauge--${riskTone(level)}`} role="img" aria-label={`Cancellation risk ${value.toFixed(1)} percent`}>
      <svg viewBox="0 0 120 68">
        <path d="M10 60 A50 50 0 0 1 110 60" className="gauge__track" />
        <path
          d="M10 60 A50 50 0 0 1 110 60"
          className="gauge__value"
          strokeDasharray={`${filled} ${length}`}
        />
      </svg>
      <div className="gauge__label">
        <strong>{formatRisk(value)}</strong>
        <span>cancellation risk</span>
      </div>
    </div>
  )
}

/** Circular progress ring for a 0-100 score. */
export function ScoreRing({
  value,
  label,
  tone,
  suffix = '',
  size = 120,
}: {
  value: number
  label: string
  tone: Tone | 'primary'
  suffix?: string
  size?: number
}) {
  const r = 42
  const c = 2 * Math.PI * r
  const filled = (Math.max(0, Math.min(100, value)) / 100) * c
  return (
    <div className={`ring ring--${tone}`} style={{ width: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={r} className="ring__track" />
        <circle
          cx="50"
          cy="50"
          r={r}
          className="ring__value"
          strokeDasharray={`${filled} ${c}`}
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="54" textAnchor="middle" className="ring__text">
          {Math.round(value)}
          {suffix}
        </text>
      </svg>
      <span className="ring__label">{label}</span>
    </div>
  )
}
