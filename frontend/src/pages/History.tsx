import { useRef, useState, type DragEvent } from 'react'
import Icon from '../components/Icon'
import { predictBatch, type BatchResponse, type BookingInput } from '../lib/api'
import { BATCH_TEMPLATE, downloadFile, parseCsv, toCsv } from '../lib/csv'
import { describeBooking } from '../lib/fields'
import { formatRisk } from '../lib/tones'
import type { HistoryEntry } from '../lib/storage'

type Props = {
  history: HistoryEntry[]
  updateHistory: (entries: HistoryEntry[]) => void
  openEntry: (entry: HistoryEntry) => void
}

const LEVEL_TONE = { Low: 'ok', Medium: 'warn', High: 'danger' } as const

function exportHistory(history: HistoryEntry[]) {
  const rows = history.map((h) => ({
    time: new Date(h.time).toLocaleString(),
    name: h.name,
    ...h.result.booking,
    cancellation_risk: h.result.probabilities.Cancelled,
    risk_level: h.result.risk_level,
    outcome: h.result.outcome,
    satisfaction: h.result.guest.satisfaction,
    repeat_likelihood: h.result.guest.repeat_likelihood,
  }))
  const columns = rows.length ? Object.keys(rows[0]) : []
  downloadFile(`prediction-history-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, columns))
}

function BatchScoring() {
  const [fileName, setFileName] = useState('')
  const [batch, setBatch] = useState<BatchResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setFileName(file.name)
    setError('')
    setBatch(null)
    const rows = parseCsv(await file.text())
    if (!rows.length) {
      setError('The file has no data rows. Use the template: a header row, then one booking per line.')
      return
    }
    setLoading(true)
    try {
      setBatch(await predictBatch(rows as BookingInput[]))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const scored = batch?.results.filter((r) => r.status === 'success') ?? []
  const avgRisk = scored.length ? scored.reduce((s, r) => s + r.cancel_probability, 0) / scored.length : 0

  const exportResults = () => {
    if (!batch) return
    const rows = batch.results.map((r) =>
      r.status === 'success'
        ? { row: r.row, ...r.booking, cancellation_risk: r.cancel_probability, risk_level: r.risk_level, outcome: r.outcome, satisfaction: r.satisfaction, repeat_likelihood: r.repeat_likelihood, error: '' }
        : { row: r.row, error: r.error },
    )
    const columns = ['row', 'lead_time', 'adr', 'deposit_type', 'is_repeated_guest', 'previous_cancellations', 'total_of_special_requests', 'cancellation_risk', 'risk_level', 'outcome', 'satisfaction', 'repeat_likelihood', 'error']
    downloadFile(`batch-predictions-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, columns))
  }

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Batch scoring (CSV upload)</h2>
          <p className="muted small">Score up to 1,000 bookings at once. Columns use the same names as the form fields.</p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={() => downloadFile('booking-template.csv', '﻿' + BATCH_TEMPLATE)}>
          <Icon name="download" size={16} /> Template
        </button>
      </div>

      <div
        className={`dropzone${dragging ? ' is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      >
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            handleFile(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        {loading ? <span className="spinner spinner--lg" aria-hidden="true" /> : <Icon name="upload" size={28} />}
        <strong>{loading ? `Scoring ${fileName}…` : 'Drop a CSV file here or click to choose'}</strong>
        <span className="muted small">
          Needs lead_time, adr, deposit_type, is_repeated_guest, previous_cancellations, total_of_special_requests
        </span>
      </div>

      {error && (
        <div className="alert alert--danger" role="alert">
          <Icon name="alert" size={18} />
          <span>{error}</span>
        </div>
      )}

      {batch && (
        <>
          <div className="kpis kpis--compact">
            <div className="kpi">
              <span>Rows scored</span>
              <strong>
                {batch.scored} / {batch.total}
              </strong>
            </div>
            <div className="kpi kpi--danger">
              <span>High risk</span>
              <strong>{batch.high_risk}</strong>
            </div>
            <div className="kpi">
              <span>Average risk</span>
              <strong>{avgRisk.toFixed(1)}%</strong>
            </div>
            <div className="kpi">
              <span>Rows with errors</span>
              <strong>{batch.total - batch.scored}</strong>
            </div>
          </div>
          <div className="card-head">
            <span className="muted small">Results for {fileName}</span>
            <button type="button" className="btn btn--ghost" onClick={exportResults}>
              <Icon name="download" size={16} /> Download results
            </button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Booking</th>
                  <th>Risk</th>
                  <th>Prediction</th>
                  <th>Satisfaction</th>
                  <th>Repeat</th>
                </tr>
              </thead>
              <tbody>
                {batch.results.map((r) =>
                  r.status === 'success' ? (
                    <tr key={r.row}>
                      <td>{r.row}</td>
                      <td className="small">{describeBooking(r.booking)}</td>
                      <td>
                        <span className={`pill pill--${LEVEL_TONE[r.risk_level]}`}>{formatRisk(r.cancel_probability)}</span>
                      </td>
                      <td>{r.outcome === 'Cancelled' ? 'Likely to cancel' : 'Likely to stay'}</td>
                      <td>{r.satisfaction}</td>
                      <td>{r.repeat_likelihood}%</td>
                    </tr>
                  ) : (
                    <tr key={r.row} className="row-error">
                      <td>{r.row}</td>
                      <td colSpan={5} className="small text-danger">
                        {r.error}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function History({ history, updateHistory, openEntry }: Props) {
  const clearAll = () => {
    if (window.confirm(`Delete all ${history.length} saved predictions from this browser?`)) updateHistory([])
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>History &amp; Batch Scoring</h1>
          <p className="muted">Your predictions are saved in this browser. Open one again, export them, or score a whole file.</p>
        </div>
      </div>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Prediction history</h2>
            <p className="muted small">{history.length ? `${history.length} saved (latest 50 kept)` : 'Nothing saved yet'}</p>
          </div>
          <div className="btn-row">
            <button type="button" className="btn btn--ghost" onClick={() => exportHistory(history)} disabled={!history.length}>
              <Icon name="download" size={16} /> Export CSV
            </button>
            <button type="button" className="btn btn--ghost btn--danger" onClick={clearAll} disabled={!history.length}>
              <Icon name="trash" size={16} /> Clear all
            </button>
          </div>
        </div>
        {history.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Booking</th>
                  <th>Risk</th>
                  <th>Prediction</th>
                  <th>Satisfaction</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="small nowrap">{new Date(h.time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>
                      <strong>{h.name}</strong>
                      <div className="muted small">{describeBooking(h.input)}</div>
                    </td>
                    <td>
                      <span className={`pill pill--${LEVEL_TONE[h.result.risk_level]}`}>
                        {formatRisk(h.result.probabilities.Cancelled)}
                      </span>
                    </td>
                    <td>{h.result.outcome === 'Cancelled' ? 'Likely to cancel' : 'Likely to stay'}</td>
                    <td>{h.result.guest.satisfaction}</td>
                    <td className="nowrap actions">
                      <button type="button" className="link-btn" onClick={() => openEntry(h)}>
                        Open
                      </button>
                      <button
                        type="button"
                        className="icon-btn icon-btn--sm"
                        onClick={() => updateHistory(history.filter((x) => x.id !== h.id))}
                        aria-label={`Delete ${h.name}`}
                        title="Delete"
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted empty-line">Predictions you make on the Prediction page will appear here.</p>
        )}
      </section>

      <BatchScoring />
    </div>
  )
}

export default History
