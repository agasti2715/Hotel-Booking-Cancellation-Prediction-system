import { useState } from 'react'
import type { PageId } from '../App'
import { RiskDrivers } from '../components/CancellationResult'
import { formatRisk, riskTone, scoreTone } from '../lib/tones'
import Icon from '../components/Icon'
import { ALL_FIELDS } from '../lib/fields'
import { downloadReport } from '../lib/report'
import type { HistoryEntry } from '../lib/storage'
import { EmptyState, EntryPicker } from './GuestAnalytics'

type Props = {
  current: HistoryEntry | null
  history: HistoryEntry[]
  go: (id: PageId) => void
  setCurrentId: (id: string) => void
}

function Report({ current, history, go, setCurrentId }: Props) {
  const [busy, setBusy] = useState(false)

  if (!current) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1>Report</h1>
            <p className="muted">Download a PDF summary of a prediction.</p>
          </div>
        </div>
        <EmptyState go={go} title="No prediction to report yet" text="Make a prediction first, then download its PDF report here." />
      </div>
    )
  }

  const r = current.result
  const download = async () => {
    setBusy(true)
    try {
      await downloadReport(r, current.name)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Report</h1>
          <p className="muted">Preview of the PDF report. It includes the booking, the prediction, the reasons and the actions.</p>
        </div>
        <div className="btn-row">
          <EntryPicker current={current} history={history} setCurrentId={setCurrentId} />
          <button type="button" className="btn btn--primary" onClick={download} disabled={busy}>
            {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="download" size={18} />}
            Download PDF Report
          </button>
        </div>
      </div>

      <article className="card report">
        <header className="report__head">
          <div>
            <h2>Hotel Booking Cancellation Report</h2>
            <span>{current.name} · predicted {new Date(current.time).toLocaleString()}</span>
          </div>
          <Icon name="hotel" size={28} />
        </header>

        <div className="report__boxes">
          <div className={`report-box report-box--${riskTone(r.risk_level)}`}>
            <span>Cancellation risk</span>
            <strong>{formatRisk(r.probabilities.Cancelled)}</strong>
          </div>
          <div className={`report-box report-box--${riskTone(r.risk_level)}`}>
            <span>Risk level</span>
            <strong>{r.risk_level}</strong>
          </div>
          <div className={`report-box report-box--${scoreTone(r.guest.satisfaction)}`}>
            <span>Guest satisfaction</span>
            <strong>{r.guest.satisfaction}/100</strong>
          </div>
          <div className={`report-box report-box--${scoreTone(r.guest.repeat_likelihood)}`}>
            <span>Repeat likelihood</span>
            <strong>{r.guest.repeat_likelihood}%</strong>
          </div>
        </div>

        <div className="report__cols">
          <section>
            <h3>Booking details</h3>
            <dl className="summary-list">
              {ALL_FIELDS.filter((f) => r.booking[f.name] !== undefined).map((f) => (
                <div key={f.name}>
                  <dt>{f.label}</dt>
                  <dd>{r.booking[f.name]}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section>
            <h3>Prediction</h3>
            <p>
              <strong>{r.outcome === 'Cancelled' ? 'Likely to cancel' : 'Likely to be honoured'}</strong> - cancellation
              probability {r.probabilities.Cancelled.toFixed(2)}%, confirmation probability{' '}
              {r.probabilities.Confirmed.toFixed(2)}%. Loyalty tier: {r.guest.loyalty_tier}.
            </p>
            <h3>Why this risk</h3>
            <RiskDrivers drivers={r.drivers} />
            <h3>Recommended actions</h3>
            <ol className="report__tips">
              {r.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          </section>
        </div>
      </article>
    </div>
  )
}

export default Report
