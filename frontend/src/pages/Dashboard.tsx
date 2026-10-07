import type { ChartOptions } from 'chart.js'
import type { ReactNode } from 'react'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import Icon from '../components/Icon'
import type { RateRow, Stats } from '../lib/api'
import { rateColor, type ChartColors } from '../lib/charts'
import type { Theme } from '../lib/storage'

type Props = { stats: Stats | null; error: string; retry: () => void; colors: ChartColors; theme: Theme }

const pct = (v: number | string) => `${v}%`

function rateTooltip(rows: RateRow[]) {
  return {
    callbacks: {
      label: (ctx: { dataIndex: number }) => {
        const r = rows[ctx.dataIndex]
        return ` ${r.cancel_rate}% cancelled of ${r.bookings.toLocaleString()} bookings`
      },
    },
  }
}

function RateBar({ rows, colors, horizontal = false }: { rows: RateRow[]; colors: ChartColors; horizontal?: boolean }) {
  const valueAxis = { min: 0, max: 100, ticks: { callback: pct } }
  const options: ChartOptions<'bar'> = {
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: { legend: { display: false }, tooltip: rateTooltip(rows) },
    scales: horizontal
      ? { x: valueAxis, y: { grid: { display: false } } }
      : { y: valueAxis, x: { grid: { display: false } } },
  }
  return (
    <Bar
      data={{
        labels: rows.map((r) => r.label),
        datasets: [
          {
            label: 'Cancellation rate',
            data: rows.map((r) => r.cancel_rate),
            backgroundColor: rows.map((r) => rateColor(r.cancel_rate, colors)),
            borderRadius: 6,
            maxBarThickness: 46,
          },
        ],
      }}
      options={options}
    />
  )
}

function ChartCard({ title, note, children, size = 'md' }: { title: string; note?: string; children: ReactNode; size?: 'md' | 'lg' }) {
  return (
    <section className="card chart-card">
      <h2 className="card-title">{title}</h2>
      {note && <p className="muted small chart-card__note">{note}</p>}
      <div className={`chart chart--${size}`}>{children}</div>
    </section>
  )
}

function Dashboard({ stats, error, retry, colors, theme }: Props) {
  if (!stats) {
    return (
      <div className="page">
        <div className="page-head">
          <h1>Dashboard</h1>
        </div>
        <div className="card placeholder">
          {error ? (
            <>
              <span className="placeholder__icon placeholder__icon--danger">
                <Icon name="alert" size={28} />
              </span>
              <h3>Couldn't load the dashboard</h3>
              <p className="muted">{error}</p>
              <button type="button" className="btn btn--primary" onClick={retry}>
                Try again
              </button>
            </>
          ) : (
            <>
              <span className="spinner spinner--lg" aria-hidden="true" />
              <p className="muted">Loading statistics…</p>
            </>
          )}
        </div>
      </div>
    )
  }

  const d = stats.dataset
  const m = stats.model
  const cm = m.confusion_matrix
  const cmTotal = cm.true_confirmed + cm.false_cancelled + cm.false_confirmed + cm.true_cancelled
  const metricNames = ['accuracy', 'precision', 'recall', 'f1', 'roc_auc'] as const
  const metricLabels = ['Accuracy', 'Precision', 'Recall', 'F1 score', 'ROC-AUC']
  const modelColors = [colors.blue, colors.violet, colors.primary]

  return (
    <div className="page" key={theme}>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">
            Cancellation patterns in {d.total_bookings.toLocaleString()} real hotel bookings, and how the prediction
            model performs. Hover any chart for details.
          </p>
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <span>Total bookings</span>
          <strong>{d.total_bookings.toLocaleString()}</strong>
        </div>
        <div className="kpi kpi--danger">
          <span>Cancelled</span>
          <strong>{d.cancelled.toLocaleString()}</strong>
          <em>{d.cancel_rate}% of all bookings</em>
        </div>
        <div className="kpi">
          <span>Average lead time</span>
          <strong>{d.avg_lead_time} days</strong>
        </div>
        <div className="kpi">
          <span>Average daily rate</span>
          <strong>{d.avg_adr.toFixed(2)}</strong>
        </div>
        <div className="kpi kpi--primary">
          <span>Model in use</span>
          <strong>{m.selected}</strong>
          <em>{m.comparison.find((c) => c.name === m.selected)?.accuracy}% accuracy</em>
        </div>
      </div>

      <div className="chart-grid">
        <ChartCard title="Cancellation rate distribution">
          <Doughnut
            data={{
              labels: ['Cancelled', 'Not cancelled'],
              datasets: [
                {
                  data: [d.cancelled, d.total_bookings - d.cancelled],
                  backgroundColor: [colors.cancel, colors.confirm],
                  borderWidth: 0,
                },
              ],
            }}
            options={{
              maintainAspectRatio: false,
              cutout: '62%',
              plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                  callbacks: {
                    label: (ctx) => ` ${(ctx.raw as number).toLocaleString()} bookings (${((Number(ctx.raw) / d.total_bookings) * 100).toFixed(1)}%)`,
                  },
                },
              },
            }}
          />
        </ChartCard>

        <ChartCard title="Lead time vs cancellation" note="The further ahead a booking is made, the more likely it is cancelled.">
          <RateBar rows={d.by_lead_time} colors={colors} />
        </ChartCard>

        <ChartCard title="Deposit type vs cancellation" note="Non-refundable bookings here are mostly agent/group blocks that get released.">
          <RateBar rows={d.by_deposit} colors={colors} />
        </ChartCard>

        <ChartCard title="Special requests vs cancellation" note="Guests who ask for something specific usually turn up.">
          <RateBar rows={d.by_special_requests} colors={colors} />
        </ChartCard>

        <ChartCard title="Monthly cancellation trend">
          <Line
            data={{
              labels: d.by_month.map((r) => r.label.slice(0, 3)),
              datasets: [
                {
                  label: 'Cancellation rate',
                  data: d.by_month.map((r) => r.cancel_rate),
                  borderColor: colors.primary,
                  backgroundColor: colors.primarySoft,
                  fill: true,
                  tension: 0.35,
                  pointRadius: 4,
                },
              ],
            }}
            options={{
              maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: rateTooltip(d.by_month) },
              scales: { y: { ticks: { callback: pct } }, x: { grid: { display: false } } },
            }}
          />
        </ChartCard>

        <ChartCard title="Market segment vs cancellation">
          <RateBar rows={d.by_market_segment} colors={colors} horizontal />
        </ChartCard>

        <ChartCard title="Guest satisfaction comparison" note="Average guest satisfaction score by customer type.">
          <Bar
            data={{
              labels: d.satisfaction_by_customer_type.map((r) => r.label),
              datasets: [
                {
                  label: 'Average satisfaction',
                  data: d.satisfaction_by_customer_type.map((r) => r.score),
                  backgroundColor: colors.primary,
                  borderRadius: 6,
                  maxBarThickness: 46,
                },
              ],
            }}
            options={{
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: { y: { min: 40, max: 80 }, x: { grid: { display: false } } },
            }}
          />
        </ChartCard>

        <section className="card chart-card">
          <h2 className="card-title">City vs Resort · New vs Returning</h2>
          <div className="facts">
            {[...d.by_hotel, ...d.by_guest_type].map((r) => (
              <div className="fact" key={r.label}>
                <div className="fact__row">
                  <span>{r.label}</span>
                  <strong>{r.cancel_rate}%</strong>
                </div>
                <div className="prob-bar__track">
                  <span className="prob-bar__fill" style={{ width: `${r.cancel_rate}%`, background: rateColor(r.cancel_rate, colors) }} />
                </div>
                <span className="muted small">{r.bookings.toLocaleString()} bookings</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <h2 className="block-title">Model performance</h2>
      <p className="muted model-note">
        Three models were trained on {m.train_rows.toLocaleString()} unique bookings and tested on{' '}
        {m.test_rows.toLocaleString()} bookings they had never seen. <strong>{m.selected}</strong> was selected for the
        best F1 score, the balance between catching cancellations and avoiding false alarms.
      </p>
      <div className="chart-grid">
        <ChartCard title="Model comparison" size="lg">
          <Bar
            data={{
              labels: metricLabels,
              datasets: m.comparison.map((c, i) => ({
                label: c.name + (c.name === m.selected ? ' (selected)' : ''),
                data: metricNames.map((k) => c[k]),
                backgroundColor: modelColors[i % modelColors.length],
                borderRadius: 5,
              })),
            }}
            options={{
              maintainAspectRatio: false,
              plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}%` } } },
              scales: { y: { min: 0, max: 100, ticks: { callback: pct } }, x: { grid: { display: false } } },
            }}
          />
        </ChartCard>

        <ChartCard title="What the model relies on most" note="Drop in ROC-AUC when each feature is shuffled (permutation importance)." size="lg">
          <Bar
            data={{
              labels: m.feature_importance.map((f) => f.feature),
              datasets: [
                {
                  label: 'Importance',
                  data: m.feature_importance.map((f) => f.importance),
                  backgroundColor: colors.blue,
                  borderRadius: 5,
                },
              ],
            }}
            options={{
              maintainAspectRatio: false,
              indexAxis: 'y',
              plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => ` ${ctx.raw} pts of ROC-AUC` } } },
              scales: { y: { grid: { display: false } } },
            }}
          />
        </ChartCard>

        <section className="card chart-card">
          <h2 className="card-title">Confusion matrix ({m.selected})</h2>
          <p className="muted small chart-card__note">Rows: what really happened. Columns: what the model predicted.</p>
          <div className="cm">
            <span />
            <span className="cm__head">Predicted: stays</span>
            <span className="cm__head">Predicted: cancels</span>
            <span className="cm__side">Actually stayed</span>
            <span className="cm__cell cm__cell--ok">
              <strong>{cm.true_confirmed.toLocaleString()}</strong>
              <em>correct · {((cm.true_confirmed / cmTotal) * 100).toFixed(1)}%</em>
            </span>
            <span className="cm__cell cm__cell--bad">
              <strong>{cm.false_cancelled.toLocaleString()}</strong>
              <em>false alarm · {((cm.false_cancelled / cmTotal) * 100).toFixed(1)}%</em>
            </span>
            <span className="cm__side">Actually cancelled</span>
            <span className="cm__cell cm__cell--bad">
              <strong>{cm.false_confirmed.toLocaleString()}</strong>
              <em>missed · {((cm.false_confirmed / cmTotal) * 100).toFixed(1)}%</em>
            </span>
            <span className="cm__cell cm__cell--ok">
              <strong>{cm.true_cancelled.toLocaleString()}</strong>
              <em>caught · {((cm.true_cancelled / cmTotal) * 100).toFixed(1)}%</em>
            </span>
          </div>
        </section>

        <section className="card chart-card">
          <h2 className="card-title">Training summary</h2>
          <dl className="summary-list">
            <div><dt>Dataset</dt><dd>Hotel booking demand (Antonio, Almeida &amp; Nunes, 2019)</dd></div>
            <div><dt>Valid bookings</dt><dd>{d.total_bookings.toLocaleString()}</dd></div>
            <div><dt>Unique rows used for training</dt><dd>{m.unique_rows.toLocaleString()}</dd></div>
            <div><dt>Train / test split</dt><dd>80% / 20% (stratified)</dd></div>
            <div><dt>Features</dt><dd>{m.features} (blank form fields use a typical booking's value)</dd></div>
            <div><dt>Preprocessing</dt><dd>Label encoding + StandardScaler</dd></div>
            <div><dt>Trained</dt><dd>{m.trained_at}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  )
}

export default Dashboard
