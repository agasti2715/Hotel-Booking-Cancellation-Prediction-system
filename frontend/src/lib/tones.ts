import type { RiskLevel } from './api'

export type Tone = 'ok' | 'warn' | 'danger'

export function riskTone(level: RiskLevel): Tone {
  return level === 'High' ? 'danger' : level === 'Medium' ? 'warn' : 'ok'
}

/** Tone for a 0-100 score where higher is better. */
export function scoreTone(score: number): Tone {
  if (score >= 70) return 'ok'
  if (score >= 45) return 'warn'
  return 'danger'
}

/** Percentage with one decimal, without claiming certainty at the extremes. */
export function formatRisk(value: number): string {
  if (value >= 99.95) return '>99.9%'
  if (value < 0.05) return '<0.1%'
  return `${value.toFixed(1)}%`
}
