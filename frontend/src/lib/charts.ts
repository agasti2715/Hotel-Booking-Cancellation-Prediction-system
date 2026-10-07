import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js'
import type { Theme } from './storage'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler)

export type ChartColors = {
  primary: string
  primarySoft: string
  cancel: string
  confirm: string
  warn: string
  blue: string
  violet: string
  grid: string
  text: string
}

const LIGHT: ChartColors = {
  primary: '#0f766e',
  primarySoft: 'rgba(15, 118, 110, 0.15)',
  cancel: '#dc2626',
  confirm: '#16a34a',
  warn: '#d97706',
  blue: '#2563eb',
  violet: '#7c3aed',
  grid: 'rgba(100, 116, 139, 0.15)',
  text: '#475569',
}

const DARK: ChartColors = {
  primary: '#2dd4bf',
  primarySoft: 'rgba(45, 212, 191, 0.18)',
  cancel: '#f87171',
  confirm: '#4ade80',
  warn: '#fbbf24',
  blue: '#60a5fa',
  violet: '#a78bfa',
  grid: 'rgba(148, 163, 184, 0.14)',
  text: '#94a3b8',
}

/** Apply theme colours to Chart.js defaults and return the palette for datasets. */
export function applyChartTheme(theme: Theme): ChartColors {
  const c = theme === 'dark' ? DARK : LIGHT
  ChartJS.defaults.color = c.text
  ChartJS.defaults.borderColor = c.grid
  ChartJS.defaults.font.family = getComputedStyle(document.body).fontFamily
  ChartJS.defaults.plugins.tooltip.padding = 10
  ChartJS.defaults.plugins.tooltip.cornerRadius = 8
  ChartJS.defaults.plugins.legend.labels.boxWidth = 12
  return c
}

/** Colour for a cancellation rate: green when low, amber in the middle, red when high. */
export function rateColor(rate: number, c: ChartColors) {
  if (rate >= 50) return c.cancel
  if (rate >= 30) return c.warn
  return c.confirm
}
