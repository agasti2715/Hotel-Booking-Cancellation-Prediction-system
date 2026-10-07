// Calls to the Flask API. Paths are relative: Vite proxies them in development,
// and Flask serves both the API and the built app in single-command mode.

export type BookingInput = Record<string, string | number>

export type Driver = {
  field: string
  label: string
  value: string
  typical: string
  impact: number
}

export type GuestScores = {
  satisfaction: number
  satisfaction_base: number
  satisfaction_breakdown: { reason: string; points: number }[]
  repeat_likelihood: number
  repeat_breakdown: { reason: string; points: number }[]
  loyalty_tier: 'Loyal' | 'Promising' | 'At risk'
}

export type RiskLevel = 'Low' | 'Medium' | 'High'

export type PredictionResponse = {
  status: 'success'
  outcome: 'Confirmed' | 'Cancelled'
  probabilities: { Confirmed: number; Cancelled: number }
  risk_level: RiskLevel
  drivers: Driver[]
  tips: string[]
  guest: GuestScores
  booking: Record<string, string>
}

export type BatchRow =
  | {
      row: number
      status: 'success'
      outcome: 'Confirmed' | 'Cancelled'
      cancel_probability: number
      risk_level: RiskLevel
      satisfaction: number
      repeat_likelihood: number
      booking: Record<string, string>
    }
  | { row: number; status: 'error'; error: string }

export type BatchResponse = {
  status: 'success'
  total: number
  scored: number
  high_risk: number
  results: BatchRow[]
}

export type RateRow = { label: string; bookings: number; cancel_rate: number }

export type ModelScores = {
  name: string
  accuracy: number
  precision: number
  recall: number
  f1: number
  roc_auc: number
  train_seconds: number
}

export type Stats = {
  dataset: {
    total_bookings: number
    cancelled: number
    cancel_rate: number
    avg_lead_time: number
    avg_adr: number
    by_hotel: RateRow[]
    by_deposit: RateRow[]
    by_lead_time: RateRow[]
    by_special_requests: RateRow[]
    by_market_segment: RateRow[]
    by_month: RateRow[]
    by_guest_type: RateRow[]
    satisfaction_by_customer_type: { label: string; score: number }[]
  }
  model: {
    selected: string
    unique_rows: number
    train_rows: number
    test_rows: number
    features: number
    comparison: ModelScores[]
    confusion_matrix: {
      true_confirmed: number
      false_cancelled: number
      false_confirmed: number
      true_cancelled: number
    }
    feature_importance: { feature: string; importance: number }[]
    trained_at: string
  }
}

export class ApiError extends Error {
  fields: Record<string, string>
  constructor(message: string, fields: Record<string, string> = {}) {
    super(message)
    this.fields = fields
  }
}

const OFFLINE =
  'Cannot reach the prediction server. Start the Flask backend (python app.py in the backend folder) and try again.'

async function request<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(OFFLINE)
  }
  const data = await res.json().catch(() => null)
  if (!res.ok || !data || data.status === 'error') {
    // Without a JSON body the request never reached Flask (the dev proxy answers 502/504 when it is down).
    throw new ApiError(data?.error ?? (data ? `Request failed with status ${res.status}` : OFFLINE), data?.fields ?? {})
  }
  return data as T
}

export const predict = (booking: BookingInput) => request<PredictionResponse>('/predict', booking)

export const predictBatch = (bookings: BookingInput[]) =>
  request<BatchResponse>('/predict/batch', { bookings })

export const fetchStats = () => request<Stats>('/stats')
