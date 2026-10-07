import { Bar } from 'react-chartjs-2'
import type { PageId } from '../App'
import { ScoreRing } from '../components/Gauges'
import { formatRisk, riskTone, scoreTone } from '../lib/tones'
import Icon from '../components/Icon'
import type { ChartColors } from '../lib/charts'
import { describeBooking } from '../lib/fields'
import type { HistoryEntry } from '../lib/storage'

type Props = {
  current: HistoryEntry | null
  history: HistoryEntry[]
  go: (id: PageId) => void
  setCurrentId: (id: string) => void
  colors: ChartColors
}

export function EntryPicker({
  current,
  history,
  setCurrentId,
}: {
  current: HistoryEntry
  history: HistoryEntry[]
  setCurrentId: (id: string) => void
}) {
  return (
    <label className="picker">
      <span className="muted small">Booking</span>
      <select value={current.id} onChange={(e) => setCurrentId(e.target.value)}>
        {history.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name} · {new Date(h.time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
            {formatRisk(h.result.probabilities.Cancelled)} risk
          </option>
        ))}
      </select>
    </label>
  )
}

export function EmptyState({ go, title, text }: { go: (id: PageId) => void; title: string; text: string }) {
  return (
    <div className="card placeholder">
      <span className="placeholder__icon">
        <Icon name="guest" size={28} />
      </span>
      <h3>{title}</h3>
      <p className="muted">{text}</p>
      <button type="button" className="btn btn--primary" onClick={() => go('predict')}>
        Make a prediction <Icon name="arrow" size={16} />
      </button>
    </div>
  )
}

function Breakdown({ base, items, total, unit }: { base?: number; items: { reason: string; points: number }[]; total: number; unit: string }) {
  return (
    <table className="breakdown">
      <tbody>
        {base !== undefined && (
          <tr>
            <td>Starting score</td>
            <td className="num">{base}</td>
          </tr>
        )}
        {items.map((i) => (
          <tr key={i.reason}>
            <td>{i.reason}</td>
            <td className={`num ${i.points < 0 ? 'text-danger' : 'text-ok'}`}>
              {i.points > 0 ? '+' : ''}
              {i.points}
            </td>
          </tr>
        ))}
        <tr className="breakdown__total">
          <td>Total (capped 0-100)</td>
          <td className="num">
            {total}
            {unit}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

function GuestAnalytics({ current, history, go, setCurrentId, colors }: Props) {
  if (!current) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1>Guest Experience Analytics</h1>
            <p className="muted">Satisfaction, repeat booking likelihood and loyalty for each booking.</p>
          </div>
        </div>
        <EmptyState go={go} title="No booking to analyse yet" text="Run a prediction first; its guest experience scores will show up here." />
      </div>
    )
  }

  const { result } = current
  const guest = result.guest
  const recent = history.slice(0, 8).reverse()

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Guest Experience Analytics</h1>
          <p className="muted">{describeBooking(current.input)}</p>
        </div>
        <EntryPicker current={current} history={history} setCurrentId={setCurrentId} />
      </div>

      <div className="card rings-card">
        <ScoreRing value={result.probabilities.Cancelled} suffix="%" label="Predicted cancellation risk" tone={riskTone(result.risk_level)} />
        <ScoreRing value={guest.satisfaction} label="Guest satisfaction score" tone={scoreTone(guest.satisfaction)} />
        <ScoreRing value={guest.repeat_likelihood} suffix="%" label="Repeat booking likelihood" tone={scoreTone(guest.repeat_likelihood)} />
        <div className="tier">
          <span className="muted small">Loyalty tier</span>
          <strong className={`tier__name tier__name--${guest.loyalty_tier === 'Loyal' ? 'ok' : guest.loyalty_tier === 'Promising' ? 'warn' : 'danger'}`}>
            {guest.loyalty_tier}
          </strong>
          <span className="muted small">
            {guest.loyalty_tier === 'Loyal'
              ? 'Likely to come back - reward them.'
              : guest.loyalty_tier === 'Promising'
                ? 'Could become a regular with a good stay.'
                : 'Needs attention to win them over.'}
          </span>
        </div>
      </div>

      <div className="two-col">
        <section className="card">
          <h2 className="card-title">How the satisfaction score was built</h2>
          <Breakdown base={guest.satisfaction_base} items={guest.satisfaction_breakdown} total={guest.satisfaction} unit="/100" />
        </section>
        <section className="card">
          <h2 className="card-title">How repeat likelihood was built</h2>
          <Breakdown items={guest.repeat_breakdown} total={guest.repeat_likelihood} unit="%" />
        </section>
      </div>

      {recent.length > 1 && (
        <section className="card">
          <h2 className="card-title">Guest satisfaction comparison - your recent bookings</h2>
          <div className="chart chart--md">
            <Bar
              data={{
                labels: recent.map((h, i) => `${i + 1}. ${h.name}`),
                datasets: [
                  { label: 'Cancellation risk %', data: recent.map((h) => h.result.probabilities.Cancelled), backgroundColor: colors.cancel, borderRadius: 6 },
                  { label: 'Satisfaction', data: recent.map((h) => h.result.guest.satisfaction), backgroundColor: colors.primary, borderRadius: 6 },
                  { label: 'Repeat likelihood %', data: recent.map((h) => h.result.guest.repeat_likelihood), backgroundColor: colors.blue, borderRadius: 6 },
                ],
              }}
              options={{
                maintainAspectRatio: false,
                scales: { y: { min: 0, max: 100 }, x: { grid: { display: false } } },
                plugins: { legend: { position: 'bottom' } },
              }}
            />
          </div>
        </section>
      )}

      <p className="muted small note">
        The dataset has no review scores, so satisfaction and repeat likelihood are transparent rule-based indicators
        built from booking signals (shown above). The cancellation risk comes from the machine learning model.
      </p>
    </div>
  )
}

export default GuestAnalytics
