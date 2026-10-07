import type { BookingInput } from './api'

// Booking fields shown in the form. Option labels must match CATEGORY_MAPS in backend/features.py.

export type FieldDef = {
  name: string
  label: string
  hint?: string
  type: 'number' | 'select'
  min?: number
  max?: number
  step?: number
  options?: { value: string | number; label: string }[]
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// The six fields from the project specification.
export const CORE_FIELDS: FieldDef[] = [
  { name: 'lead_time', label: 'Lead Time (days)', hint: 'Days between booking and arrival', type: 'number', min: 0, max: 750 },
  {
    name: 'is_repeated_guest',
    label: 'Repeated Guest',
    type: 'select',
    options: [
      { value: 0, label: 'No' },
      { value: 1, label: 'Yes' },
    ],
  },
  { name: 'previous_cancellations', label: 'Previous Cancellations', type: 'number', min: 0, max: 30 },
  { name: 'adr', label: 'Average Daily Rate (ADR)', hint: 'Price per night', type: 'number', min: 0, max: 1000, step: 0.01 },
  {
    name: 'deposit_type',
    label: 'Deposit Type',
    type: 'select',
    options: ['No Deposit', 'Refundable', 'Non Refund'].map((v) => ({ value: v, label: v })),
  },
  { name: 'total_of_special_requests', label: 'Total Special Requests', hint: 'e.g. high floor, twin beds', type: 'number', min: 0, max: 5 },
]

// Optional details. Left blank, the model uses a typical booking's value.
export const EXTRA_FIELDS: FieldDef[] = [
  {
    name: 'hotel',
    label: 'Hotel Type',
    type: 'select',
    options: ['City Hotel', 'Resort Hotel'].map((v) => ({ value: v, label: v })),
  },
  {
    name: 'arrival_date_month',
    label: 'Arrival Month',
    type: 'select',
    options: MONTHS.map((m, i) => ({ value: i + 1, label: m })),
  },
  { name: 'stays_in_weekend_nights', label: 'Weekend Nights', type: 'number', min: 0, max: 20 },
  { name: 'stays_in_week_nights', label: 'Week Nights', type: 'number', min: 0, max: 50 },
  { name: 'adults', label: 'Adults', type: 'number', min: 0, max: 10 },
  { name: 'children', label: 'Children', type: 'number', min: 0, max: 10 },
  {
    name: 'market_segment',
    label: 'Market Segment',
    type: 'select',
    options: ['Online TA', 'Offline TA/TO', 'Direct', 'Corporate', 'Groups', 'Complementary', 'Aviation'].map((v) => ({
      value: v,
      label: v,
    })),
  },
  {
    name: 'customer_type',
    label: 'Customer Type',
    type: 'select',
    options: ['Transient', 'Transient-Party', 'Contract', 'Group'].map((v) => ({ value: v, label: v })),
  },
  { name: 'required_car_parking_spaces', label: 'Parking Spaces', type: 'number', min: 0, max: 3 },
  { name: 'booking_changes', label: 'Booking Changes', type: 'number', min: 0, max: 20 },
]

export const ALL_FIELDS = [...CORE_FIELDS, ...EXTRA_FIELDS]

export const FIELD_LABELS: Record<string, string> = Object.fromEntries(ALL_FIELDS.map((f) => [f.name, f.label]))

export const DEFAULT_BOOKING: BookingInput = {
  lead_time: 45,
  is_repeated_guest: 0,
  previous_cancellations: 0,
  adr: 112.5,
  deposit_type: 'No Deposit',
  total_of_special_requests: 2,
}

export type Preset = { id: string; name: string; emoji: string; note: string; booking: BookingInput }

// One-click sample bookings for demos.
export const PRESETS: Preset[] = [
  {
    id: 'safe',
    name: 'Safe guest',
    emoji: '🟢',
    note: 'Returning guest, short lead time, parking booked',
    booking: {
      lead_time: 12, is_repeated_guest: 1, previous_cancellations: 0, adr: 95,
      deposit_type: 'No Deposit', total_of_special_requests: 2,
      hotel: 'Resort Hotel', market_segment: 'Direct', required_car_parking_spaces: 1,
    },
  },
  {
    id: 'risky',
    name: 'Risky booking',
    emoji: '🔴',
    note: 'Booked 9 months out, cancelled before, non-refundable',
    booking: {
      lead_time: 280, is_repeated_guest: 0, previous_cancellations: 1, adr: 120,
      deposit_type: 'Non Refund', total_of_special_requests: 0,
    },
  },
  {
    id: 'loyal',
    name: 'Loyal regular',
    emoji: '⭐',
    note: 'Corporate repeat guest with a room request',
    booking: {
      lead_time: 30, is_repeated_guest: 1, previous_cancellations: 0, adr: 110,
      deposit_type: 'No Deposit', total_of_special_requests: 1, market_segment: 'Corporate',
    },
  },
  {
    id: 'longlead',
    name: 'Far-ahead online',
    emoji: '🟠',
    note: 'Online booking 5 months ahead, no requests',
    booking: {
      lead_time: 150, is_repeated_guest: 0, previous_cancellations: 0, adr: 130,
      deposit_type: 'No Deposit', total_of_special_requests: 0, market_segment: 'Online TA',
    },
  },
  {
    id: 'family',
    name: 'Summer family',
    emoji: '🏖️',
    note: 'Resort week in July with two children',
    booking: {
      lead_time: 90, is_repeated_guest: 0, previous_cancellations: 0, adr: 180,
      deposit_type: 'No Deposit', total_of_special_requests: 1, hotel: 'Resort Hotel',
      arrival_date_month: 7, adults: 2, children: 2, stays_in_weekend_nights: 2, stays_in_week_nights: 5,
    },
  },
]

/** Short one-line description of a booking, used in lists and selects. */
export function describeBooking(b: BookingInput | Record<string, string>): string {
  const repeat = String(b.is_repeated_guest) === '1' || b.is_repeated_guest === 'Yes' ? 'repeat guest' : 'new guest'
  return `${b.lead_time} days ahead · ${b.deposit_type} · ADR ${Number(b.adr).toFixed(0)} · ${repeat}`
}
