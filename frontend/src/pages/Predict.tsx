import { useState, type FormEvent } from 'react'
import type { FormState, PageId } from '../App'
import CancellationResult from '../components/CancellationResult'
import FormField from '../components/FormField'
import Icon from '../components/Icon'
import { ApiError, type BookingInput } from '../lib/api'
import { CORE_FIELDS, DEFAULT_BOOKING, EXTRA_FIELDS, PRESETS, type FieldDef } from '../lib/fields'
import { downloadReport } from '../lib/report'
import type { HistoryEntry } from '../lib/storage'

type Props = {
  form: FormState
  setForm: (f: FormState) => void
  current: HistoryEntry | null
  onPredict: (input: BookingInput, name: string) => Promise<HistoryEntry>
  go: (id: PageId) => void
  modelName?: string
}

const NUMERIC_SELECTS = new Set(['is_repeated_guest', 'arrival_date_month'])

/** Form strings -> request body. Blank optional fields are left out so the model uses typical values. */
function toBooking(values: Record<string, string>, fields: FieldDef[]) {
  const booking: BookingInput = {}
  const errors: Record<string, string> = {}
  for (const f of fields) {
    const raw = (values[f.name] ?? '').trim()
    const required = CORE_FIELDS.includes(f)
    if (raw === '') {
      if (required) errors[f.name] = 'Required'
      continue
    }
    if (f.type === 'number' || NUMERIC_SELECTS.has(f.name)) {
      const n = Number(raw)
      if (Number.isNaN(n)) errors[f.name] = 'Enter a number'
      else if (f.min !== undefined && n < f.min) errors[f.name] = `Minimum ${f.min}`
      else if (f.max !== undefined && n > f.max) errors[f.name] = `Maximum ${f.max}`
      else booking[f.name] = n
    } else {
      booking[f.name] = raw
    }
  }
  return { booking, errors }
}

function Predict({ form, setForm, current, onPredict, go, modelName }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showMore, setShowMore] = useState(() => EXTRA_FIELDS.some((f) => form.values[f.name]))

  const setValue = (name: string, value: string) => {
    setForm({ values: { ...form.values, [name]: value }, name: 'Custom booking' })
    setErrors((e) => ({ ...e, [name]: '' }))
  }

  const evaluate = async (values: Record<string, string>, name: string) => {
    const { booking, errors: found } = toBooking(values, [...CORE_FIELDS, ...EXTRA_FIELDS])
    setErrors(found)
    setMessage('')
    if (Object.keys(found).length) return
    setLoading(true)
    try {
      await onPredict(booking, name)
    } catch (e) {
      const err = e as ApiError
      setErrors(err.fields ?? {})
      setMessage(err.message)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    evaluate(form.values, form.name)
  }

  const applyPreset = (presetId: string) => {
    const preset = PRESETS.find((p) => p.id === presetId)!
    const values = Object.fromEntries(Object.entries(preset.booking).map(([k, v]) => [k, String(v)]))
    setForm({ values, name: preset.name })
    if (EXTRA_FIELDS.some((f) => values[f.name])) setShowMore(true)
    evaluate(values, preset.name)
  }

  const reset = () => {
    setForm({
      values: Object.fromEntries(Object.entries(DEFAULT_BOOKING).map(([k, v]) => [k, String(v)])),
      name: 'Custom booking',
    })
    setErrors({})
    setMessage('')
  }

  const extrasFilled = EXTRA_FIELDS.filter((f) => form.values[f.name]).length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Booking Cancellation Prediction</h1>
          <p className="muted">Guest booking risk assessment portal{modelName ? ` · ${modelName} model` : ''}</p>
        </div>
      </div>

      <div className="presets" role="group" aria-label="Sample bookings">
        <span className="presets__label">Try a sample:</span>
        {PRESETS.map((p) => (
          <button
            type="button"
            key={p.id}
            className={`chip${form.name === p.name ? ' is-active' : ''}`}
            onClick={() => applyPreset(p.id)}
            title={p.note}
            disabled={loading}
          >
            <span aria-hidden="true">{p.emoji}</span> {p.name}
          </button>
        ))}
      </div>

      <div className="predict-grid">
        <form className="card form-card" onSubmit={onSubmit} noValidate>
          <h2 className="card-title">Booking details</h2>
          <div className="form-grid">
            {CORE_FIELDS.map((f) => (
              <FormField
                key={f.name}
                field={f}
                value={form.values[f.name] ?? ''}
                error={errors[f.name]}
                onChange={setValue}
              />
            ))}
          </div>

          <button type="button" className="more-toggle" onClick={() => setShowMore((s) => !s)} aria-expanded={showMore}>
            <span className={`more-toggle__chev${showMore ? ' is-open' : ''}`}>
              <Icon name="chevron" size={16} />
            </span>
            More booking details (optional)
            {extrasFilled > 0 && <span className="badge">{extrasFilled} set</span>}
          </button>
          {showMore && (
            <div className="form-grid form-grid--3 more-fields">
              <p className="more-fields__note muted small">Leave blank to use a typical booking's value.</p>
              {EXTRA_FIELDS.map((f) => (
                <FormField
                  key={f.name}
                  field={f}
                  optional
                  compact
                  value={form.values[f.name] ?? ''}
                  error={errors[f.name]}
                  onChange={setValue}
                />
              ))}
            </div>
          )}

          {message && (
            <div className="alert alert--danger" role="alert">
              <Icon name="alert" size={18} />
              <span>{message}</span>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn btn--primary btn--block" disabled={loading}>
              {loading ? <span className="spinner" aria-hidden="true" /> : <Icon name="predict" size={18} />}
              {loading ? 'Evaluating…' : 'Evaluate Cancellation Risk'}
            </button>
            <button type="button" className="btn btn--ghost" onClick={reset} disabled={loading}>
              Reset
            </button>
          </div>
        </form>

        <div className={loading ? 'is-loading' : undefined}>
          {current ? (
            <CancellationResult
              response={current.result}
              name={`${current.name} · ${new Date(current.time).toLocaleTimeString()}`}
              onReport={() => downloadReport(current.result, current.name)}
              onAnalytics={() => go('analytics')}
            />
          ) : (
            <div className="card placeholder">
              <span className="placeholder__icon">
                <Icon name="predict" size={28} />
              </span>
              <h3>Your prediction appears here</h3>
              <p className="muted">
                Fill in the booking details and press <strong>Evaluate Cancellation Risk</strong>, or pick one of the
                sample bookings above.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Predict
