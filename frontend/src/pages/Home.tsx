import type { PageId } from '../App'
import Icon, { type IconName } from '../components/Icon'
import type { Stats } from '../lib/api'

const FEATURES: { id: PageId; icon: IconName; title: string; text: string }[] = [
  { id: 'predict', icon: 'predict', title: 'Cancellation Prediction', text: 'Enter booking details and get the cancellation risk in real time, with the reasons behind it.' },
  { id: 'analytics', icon: 'guest', title: 'Guest Experience Analytics', text: 'Guest satisfaction score, repeat booking likelihood and loyalty tier for every booking.' },
  { id: 'dashboard', icon: 'dashboard', title: 'Interactive Dashboard', text: 'Cancellation patterns across 119k real bookings, plus how the model was chosen.' },
  { id: 'compare', icon: 'compare', title: 'Booking Comparison', text: 'Put two bookings side by side and see which one is the more reliable.' },
  { id: 'history', icon: 'history', title: 'History & Batch Scoring', text: 'Every prediction is saved. Upload a CSV to score a whole list of bookings at once.' },
  { id: 'report', icon: 'report', title: 'PDF Reports', text: 'Download a one-page report with the booking, the risk, the drivers and the actions.' },
]

const STEPS = [
  ['Enter booking', 'Lead time, deposit, ADR, special requests and guest history in the React form.'],
  ['Flask API', 'The details are sent as JSON to /predict, validated, and merged with typical values.'],
  ['ML model', 'Features are scaled with StandardScaler and scored by the trained classifier.'],
  ['Result', 'Risk, reasons, recommended actions and guest scores come back instantly.'],
]

function Home({ stats, go }: { stats: Stats | null; go: (id: PageId) => void }) {
  const selected = stats?.model.comparison.find((m) => m.name === stats.model.selected)
  return (
    <div className="page">
      <section className="hero">
        <div className="hero__content">
          <span className="hero__eyebrow">
            <Icon name="sparkle" size={14} /> Machine learning for hotel revenue teams
          </span>
          <h1>Know which bookings will cancel — before they do.</h1>
          <p>
            Predict hotel booking cancellations from six booking details, understand what drives the risk, and act
            early to protect occupancy and guest experience.
          </p>
          <div className="hero__actions">
            <button type="button" className="btn btn--light" onClick={() => go('predict')}>
              Start a prediction <Icon name="arrow" size={16} />
            </button>
            <button type="button" className="btn btn--outline-light" onClick={() => go('dashboard')}>
              Explore the data
            </button>
          </div>
        </div>
        <div className="hero__stats">
          <div className="hero-stat">
            <strong>{stats ? stats.dataset.total_bookings.toLocaleString() : '119k'}</strong>
            <span>real bookings analysed</span>
          </div>
          <div className="hero-stat">
            <strong>{stats ? `${stats.dataset.cancel_rate}%` : '37%'}</strong>
            <span>of bookings were cancelled</span>
          </div>
          <div className="hero-stat">
            <strong>{selected ? `${selected.accuracy}%` : '-'}</strong>
            <span>model accuracy ({stats?.model.selected ?? 'loading'})</span>
          </div>
          <div className="hero-stat">
            <strong>{selected ? `${selected.roc_auc}%` : '-'}</strong>
            <span>ROC-AUC on unseen bookings</span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="block-title">What you can do</h2>
        <div className="feature-grid">
          {FEATURES.map((f) => (
            <button type="button" key={f.id} className="feature-card" onClick={() => go(f.id)}>
              <span className="feature-card__icon">
                <Icon name={f.icon} size={20} />
              </span>
              <strong>{f.title}</strong>
              <span>{f.text}</span>
              <span className="feature-card__go">
                Open <Icon name="arrow" size={14} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="block-title">How it works</h2>
        <ol className="steps">
          {STEPS.map(([title, text], i) => (
            <li key={title} className="step">
              <span className="step__num">{i + 1}</span>
              <strong>{title}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

export default Home
