import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import Icon, { type IconName } from './components/Icon'
import { fetchStats, predict, type BookingInput, type Stats } from './lib/api'
import { applyChartTheme } from './lib/charts'
import { DEFAULT_BOOKING } from './lib/fields'
import { loadHistory, loadTheme, newEntry, saveHistory, saveTheme, type HistoryEntry, type Theme } from './lib/storage'
import Compare from './pages/Compare'
import Dashboard from './pages/Dashboard'
import GuestAnalytics from './pages/GuestAnalytics'
import History from './pages/History'
import Home from './pages/Home'
import Predict from './pages/Predict'
import Report from './pages/Report'

export type PageId = 'home' | 'predict' | 'analytics' | 'dashboard' | 'compare' | 'history' | 'report'

const NAV: { id: PageId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'predict', label: 'Prediction', icon: 'predict' },
  { id: 'analytics', label: 'Guest Analytics', icon: 'guest' },
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'compare', label: 'Compare', icon: 'compare' },
  { id: 'history', label: 'History & Batch', icon: 'history' },
  { id: 'report', label: 'Report', icon: 'report' },
]

function pageFromHash(): PageId {
  const id = window.location.hash.replace('#/', '') as PageId
  return NAV.some((n) => n.id === id) ? id : 'home'
}

export type FormState = { values: Record<string, string>; name: string }

const toFormValues = (b: BookingInput) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, String(v)]))

function App() {
  const [page, setPage] = useState<PageId>(pageFromHash)
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)
  const [currentId, setCurrentId] = useState<string | null>(() => history[0]?.id ?? null)
  const [form, setForm] = useState<FormState>({ values: toFormValues(DEFAULT_BOOKING), name: 'Custom booking' })
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsError, setStatsError] = useState('')
  const [online, setOnline] = useState<boolean | null>(null)

  const current = useMemo(() => history.find((h) => h.id === currentId) ?? null, [history, currentId])
  const chartColors = useMemo(() => applyChartTheme(theme), [theme])

  useEffect(() => {
    const onHash = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    saveTheme(theme)
  }, [theme])

  const loadStats = useCallback(() => {
    fetchStats()
      .then((s) => {
        setStats(s)
        setStatsError('')
        setOnline(true)
      })
      .catch((e: Error) => {
        setStatsError(e.message)
        setOnline(false)
      })
  }, [])

  useEffect(loadStats, [loadStats])

  const retryStats = useCallback(() => {
    setStatsError('')
    loadStats()
  }, [loadStats])

  const go = useCallback((id: PageId) => {
    window.location.hash = `#/${id}`
  }, [])

  const runPrediction = useCallback(async (input: BookingInput, name: string) => {
    const result = await predict(input)
    const entry = newEntry(input, result, name)
    setHistory((prev) => saveHistory([entry, ...prev]))
    setCurrentId(entry.id)
    setOnline(true)
    return entry
  }, [])

  const updateHistory = useCallback((entries: HistoryEntry[]) => {
    setHistory(saveHistory(entries))
  }, [])

  const openEntry = useCallback(
    (entry: HistoryEntry) => {
      setCurrentId(entry.id)
      setForm({ values: toFormValues(entry.input), name: entry.name })
      go('predict')
    },
    [go],
  )

  const shared = { current, history, go, setCurrentId }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar__inner">
          <a className="brand" href="#/home">
            <span className="brand__logo">
              <Icon name="hotel" size={20} />
            </span>
            <span className="brand__text">
              <strong className="brand__full">Hotel Booking Cancellation Prediction</strong>
              <strong className="brand__short">Cancellation Predictor</strong>
              <span>Guest Experience Analytics Platform</span>
            </span>
          </a>
          <div className="topbar__right">
            <span className={`status status--${online === null ? 'wait' : online ? 'ok' : 'off'}`}>
              <span className="status__dot" />
              {online === null ? 'Connecting…' : online ? 'Model online' : 'API offline'}
            </span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </div>
        </div>
        <nav className="nav" aria-label="Main">
          <div className="nav__inner">
            {NAV.map((n) => (
              <a key={n.id} href={`#/${n.id}`} className={`nav__link${page === n.id ? ' is-active' : ''}`}>
                <Icon name={n.icon} size={16} />
                {n.label}
              </a>
            ))}
          </div>
        </nav>
      </header>

      <main className="container" key={page}>
        {page === 'home' && <Home stats={stats} go={go} />}
        {page === 'predict' && (
          <Predict
            form={form}
            setForm={setForm}
            current={current}
            onPredict={runPrediction}
            go={go}
            modelName={stats?.model.selected}
          />
        )}
        {page === 'analytics' && <GuestAnalytics {...shared} colors={chartColors} />}
        {page === 'dashboard' && (
          <Dashboard stats={stats} error={statsError} retry={retryStats} colors={chartColors} theme={theme} />
        )}
        {page === 'compare' && <Compare history={history} />}
        {page === 'history' && (
          <History history={history} updateHistory={updateHistory} openEntry={openEntry} />
        )}
        {page === 'report' && <Report {...shared} />}
      </main>

      <footer className="footer">
        <span>Hotel Booking Cancellation Prediction System · React + Flask + scikit-learn</span>
        <span>
          {stats
            ? `Trained on ${stats.dataset.total_bookings.toLocaleString()} bookings · ${stats.model.selected}`
            : 'Hotel booking demand dataset (Antonio, Almeida & Nunes, 2019)'}
        </span>
      </footer>
    </div>
  )
}

export default App
