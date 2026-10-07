import type { BookingInput, PredictionResponse } from './api'

// Prediction history and theme live in the browser's localStorage.
// Every read and write is guarded: private windows or blocked storage just mean no history.

export type HistoryEntry = {
  id: string
  time: string
  name: string
  input: BookingInput
  result: PredictionResponse
}

const HISTORY_KEY = 'hbcp.history'
const THEME_KEY = 'hbcp.theme'
const MAX_HISTORY = 50

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveHistory(entries: HistoryEntry[]): HistoryEntry[] {
  const trimmed = entries.slice(0, MAX_HISTORY)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed))
  } catch {
    // Storage full or blocked: keep the in-memory list for this session.
  }
  return trimmed
}

export function newEntry(input: BookingInput, result: PredictionResponse, name: string): HistoryEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: new Date().toISOString(),
    name,
    input,
    result,
  }
}

export type Theme = 'light' | 'dark'

export function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // fall through to the system preference
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // ignore
  }
}
