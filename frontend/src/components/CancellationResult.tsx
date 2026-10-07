import type { Driver, PredictionResponse } from '../lib/api'
import { riskTone, scoreTone } from '../lib/tones'
import { RiskGauge } from './Gauges'
import Icon from './Icon'

type Props = {
  response: PredictionResponse
  name: string
  onReport?: () => void
  onAnalytics?: () => void
}

/** "Why this risk": each factor's push up (red) or down (green) versus a typical booking. */
export function RiskDrivers({ drivers }: { drivers: Driver[] }) {
  if (!drivers.length) {
    return <p className="muted small">This booking looks like a typical booking, so no single detail stands out.</p>
  }
  const max = Math.max(...drivers.map((d) => Math.abs(d.impact)), 1)
  return (
    <ul className="drivers">
      {drivers.map((d) => {
        const up = d.impact > 0
        const width = `${(Math.abs(d.impact) / max) * 100}%`
        return (
          <li key={d.field} className="driver">
            <div className="driver__text">
              <span className="driver__label">{d.label}</span>
              <span className="driver__value">
                {d.value} <em>vs typical {d.typical}</em>
              </span>
            </div>
            <div className="driver__bar">
              <div className="driver__half driver__half--down">
                {!up && <span className="driver__fill driver__fill--down" style={{ width }} />}
              </div>
              <div className="driver__half">
                {up && <span className="driver__fill driver__fill--up" style={{ width }} />}
              </div>
            </div>
            <span className={`driver__impact ${up ? 'text-danger' : 'text-ok'}`}>
              {up ? '+' : ''}
              {d.impact.toFixed(1)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function CancellationResult({ response, name, onReport, onAnalytics }: Props) {
  const isCancelled = response.outcome === 'Cancelled'
  const tone = riskTone(response.risk_level)
  const { Cancelled, Confirmed } = response.probabilities

  return (
    <section className={`result-card result-card--${tone}`} aria-live="polite">
      <div className="result-card__head">
        <RiskGauge value={Cancelled} level={response.risk_level} />
        <div className="result-card__verdict">
          <span className={`pill pill--${tone}`}>{response.risk_level} risk</span>
          <h3 className="result-card__title">
            {isCancelled ? 'Likely to cancel' : 'Likely to be honoured'}
          </h3>
          <p className="muted small">{name}</p>
        </div>
      </div>

      <div className="prob-bars">
        <div className="prob-bar">
          <div className="prob-bar__row">
            <span>Cancellation risk confidence</span>
            <strong>{Cancelled.toFixed(2)}%</strong>
          </div>
          <div className="prob-bar__track">
            <span className="prob-bar__fill prob-bar__fill--danger" style={{ width: `${Cancelled}%` }} />
          </div>
        </div>
        <div className="prob-bar">
          <div className="prob-bar__row">
            <span>Booking confirmation probability</span>
            <strong>{Confirmed.toFixed(2)}%</strong>
          </div>
          <div className="prob-bar__track">
            <span className="prob-bar__fill prob-bar__fill--ok" style={{ width: `${Confirmed}%` }} />
          </div>
        </div>
      </div>

      <div className="mini-metrics">
        <div className={`mini-metric mini-metric--${scoreTone(response.guest.satisfaction)}`}>
          <span>Guest satisfaction</span>
          <strong>{response.guest.satisfaction}/100</strong>
        </div>
        <div className={`mini-metric mini-metric--${scoreTone(response.guest.repeat_likelihood)}`}>
          <span>Repeat likelihood</span>
          <strong>{response.guest.repeat_likelihood}%</strong>
        </div>
        <div className="mini-metric">
          <span>Loyalty tier</span>
          <strong>{response.guest.loyalty_tier}</strong>
        </div>
      </div>

      <h4 className="section-title">
        <Icon name="sparkle" size={16} /> Why this risk?
        <span className="muted small"> percentage points vs a typical booking</span>
      </h4>
      <RiskDrivers drivers={response.drivers} />

      <h4 className="section-title">
        <Icon name="bulb" size={16} /> Recommended actions
      </h4>
      <ul className="tips">
        {response.tips.map((tip) => (
          <li key={tip}>
            <Icon name="check" size={15} />
            <span>{tip}</span>
          </li>
        ))}
      </ul>

      {(onReport || onAnalytics) && (
        <div className="result-card__actions">
          {onReport && (
            <button type="button" className="btn btn--ghost" onClick={onReport}>
              <Icon name="download" size={16} /> PDF report
            </button>
          )}
          {onAnalytics && (
            <button type="button" className="btn btn--ghost" onClick={onAnalytics}>
              <Icon name="guest" size={16} /> Guest analytics
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export default CancellationResult
