import { useState } from 'react'
import FormField from '../components/FormField'
import { RiskGauge } from '../components/Gauges'
import Icon from '../components/Icon'
import { predict, type BookingInput, type PredictionResponse } from '../lib/api'
import { CORE_FIELDS, PRESETS } from '../lib/fields'
import type { HistoryEntry } from '../lib/storage'
import { formatRisk } from '../lib/tones'

type Side = { source: string; values: Record<string, string> }

const toValues = (b: BookingInput) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, String(v)]))

function sourceBooking(source: string, history: HistoryEntry[]): BookingInput | undefined {
  if (source.startsWith('preset:')) return PRESETS.find((p) => `preset:${p.id}` === source)?.booking
  if (source.startsWith('history:')) return history.find((h) => `history:${h.id}` === source)?.input
  return undefined
}

type Row = {
  label: string
  a: number | string
  b: number | string
  better: 'low' | 'high' | null
  format?: (v: number) => string
}

function Compare({ history }: { history: HistoryEntry[] }) {
  const [sides, setSides] = useState<Side[]>(() =>
    ['loyal', 'longlead'].map((id) => ({
      source: `preset:${id}`,
      values: toValues(PRESETS.find((p) => p.id === id)!.booking),
    })),
  )
  const [results, setResults] = useState<PredictionResponse[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const pickSource = (i: number, source: string) => {
    const booking = sourceBooking(source, history)
    setSides((s) => s.map((side, j) => (j === i ? { source, values: booking ? toValues(booking) : side.values } : side)))
    setResults(null)
  }

  const setValue = (i: number, name: string, value: string) => {
    setSides((s) => s.map((side, j) => (j === i ? { source: 'custom', values: { ...side.values, [name]: value } } : side)))
    setResults(null)
  }

  const compare = async () => {
    setLoading(true)
    setError('')
    try {
      const bookings = sides.map((s) => {
        const b: BookingInput = {}
        for (const [k, v] of Object.entries(s.values)) {
          if (v === '') continue
          b[k] = Number.isNaN(Number(v)) ? v : Number(v)
        }
        return b
      })
      setResults(await Promise.all(bookings.map(predict)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const rows: Row[] = results
    ? [
        { label: 'Cancellation risk', a: results[0].probabilities.Cancelled, b: results[1].probabilities.Cancelled, better: 'low', format: formatRisk },
        { label: 'Risk level', a: results[0].risk_level, b: results[1].risk_level, better: null },
        { label: 'Prediction', a: results[0].outcome === 'Cancelled' ? 'Likely to cancel' : 'Likely to stay', b: results[1].outcome === 'Cancelled' ? 'Likely to cancel' : 'Likely to stay', better: null },
        { label: 'Guest satisfaction score', a: results[0].guest.satisfaction, b: results[1].guest.satisfaction, better: 'high', format: (v) => `${v.toFixed(1)}/100` },
        { label: 'Repeat booking likelihood', a: results[0].guest.repeat_likelihood, b: results[1].guest.repeat_likelihood, better: 'high', format: (v) => `${v.toFixed(1)}%` },
        { label: 'Loyalty tier', a: results[0].guest.loyalty_tier, b: results[1].guest.loyalty_tier, better: null },
      ]
    : []

  const winner = results ? (results[0].probabilities.Cancelled <= results[1].probabilities.Cancelled ? 0 : 1) : null
  const gap = results ? Math.abs(results[0].probabilities.Cancelled - results[1].probabilities.Cancelled) : 0

  const cellClass = (row: Row, side: 'a' | 'b') => {
    if (!row.better || row.a === row.b) return ''
    const a = Number(row.a)
    const b = Number(row.b)
    const aWins = row.better === 'low' ? a < b : a > b
    return (side === 'a') === aWins ? 'is-better' : ''
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Compare Bookings</h1>
          <p className="muted">Pick two bookings (samples or your history), adjust them if you like, and compare side by side.</p>
        </div>
      </div>

      <div className="compare-grid">
        {sides.map((side, i) => (
          <section className={`card compare-side${winner === i ? ' is-winner' : ''}`} key={i}>
            <div className="compare-side__head">
              <h2 className="card-title">Booking {i === 0 ? 'A' : 'B'}</h2>
              {winner === i && (
                <span className="pill pill--ok">
                  <Icon name="check" size={14} /> More reliable
                </span>
              )}
            </div>
            <select className="compare-side__source" value={side.source} onChange={(e) => pickSource(i, e.target.value)} aria-label={`Booking ${i === 0 ? 'A' : 'B'} source`}>
              {side.source === 'custom' && <option value="custom">Custom (edited)</option>}
              <optgroup label="Sample bookings">
                {PRESETS.map((p) => (
                  <option key={p.id} value={`preset:${p.id}`}>
                    {p.emoji} {p.name}
                  </option>
                ))}
              </optgroup>
              {history.length > 0 && (
                <optgroup label="From your history">
                  {history.slice(0, 15).map((h) => (
                    <option key={h.id} value={`history:${h.id}`}>
                      {h.name} · {new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <div className="form-grid">
              {CORE_FIELDS.map((f) => (
                <FormField key={f.name} field={f} compact value={side.values[f.name] ?? ''} onChange={(name, v) => setValue(i, name, v)} />
              ))}
            </div>
            {results && (
              <div className="compare-side__gauge">
                <RiskGauge value={results[i].probabilities.Cancelled} level={results[i].risk_level} />
              </div>
            )}
          </section>
        ))}
      </div>

      <div className="compare-actions">
        <button type="button" className="btn btn--primary" onClick={compare} disabled={loading}>
          {loading ? <span className="spinner" aria-hidden="true" /> : <Icon name="compare" size={18} />}
          {loading ? 'Comparing…' : 'Compare'}
        </button>
      </div>

      {error && (
        <div className="alert alert--danger" role="alert">
          <Icon name="alert" size={18} />
          <span>{error}</span>
        </div>
      )}

      {results && winner !== null && (
        <section className="card">
          <div className="verdict">
            <Icon name="check" size={20} />
            <span>
              {gap < 1 ? (
                <>Both bookings carry about the same risk.</>
              ) : (
                <>
                  <strong>Booking {winner === 0 ? 'A' : 'B'}</strong> is the more reliable booking: {gap.toFixed(1)}{' '}
                  percentage points lower cancellation risk.
                </>
              )}
            </span>
          </div>
          <div className="table-wrap">
            <table className="table compare-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Booking A</th>
                  <th>Booking B</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td className={cellClass(r, 'a')}>{typeof r.a === 'number' && r.format ? r.format(r.a) : r.a}</td>
                    <td className={cellClass(r, 'b')}>{typeof r.b === 'number' && r.format ? r.format(r.b) : r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

export default Compare
