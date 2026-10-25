import { useState } from 'react'
import { plannedKgPerWeek, weeksToReach, weightRate, weightTrend } from '../energy'
import type { Profile, WeightEntry } from '../types'
import { formatWeight, formatWeightChange } from '../units'
import { dateKey, daysBetween, formatDateLabel, shiftDate } from '../util'
import { CloseIcon } from './icons'
import { WeightInput } from './MeasureInputs'

const CHART_DAYS = 90

type TrendPoint = WeightEntry & { trend: number }

function WeightChart({ points, profile }: { points: TrendPoint[]; profile: Profile }) {
  const today = dateKey(new Date())
  const shown = points.filter((p) => daysBetween(p.date, today) < CHART_DAYS)
  if (shown.length < 2) return null
  const W = 320
  const H = 150
  const pad = { l: 8, r: 8, t: 14, b: 22 }
  const values = shown.flatMap((p) => [p.kg, p.trend])
  const target = profile.targetWeightKg
  let min = Math.min(...values)
  let max = Math.max(...values)
  // Show the target line only when it's close enough not to flatten the chart.
  const showTarget = target !== undefined && Math.abs(target - (min + max) / 2) < Math.max(max - min, 2) * 2
  if (showTarget) {
    min = Math.min(min, target)
    max = Math.max(max, target)
  }
  const spread = Math.max(max - min, 1)
  min -= spread * 0.1
  max += spread * 0.1
  const first = shown[0].date
  const span = Math.max(daysBetween(first, shown.at(-1)!.date), 1)
  const x = (date: string) => pad.l + (daysBetween(first, date) / span) * (W - pad.l - pad.r)
  const y = (kg: number) => pad.t + ((max - kg) / (max - min)) * (H - pad.t - pad.b)
  return (
    <figure className="weight-chart-wrap">
      <svg className="weight-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scale weight and trend weight over time">
        {showTarget && (
          <>
            <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} className="chart-target" />
            <text x={W - pad.r} y={y(target) - 4} textAnchor="end" className="chart-label">
              Goal {formatWeight(target, profile.weightUnit)}
            </text>
          </>
        )}
        {shown.map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r={2.5} className="chart-scale-dot" />
        ))}
        <polyline points={shown.map((p) => `${x(p.date)},${y(p.trend)}`).join(' ')} className="chart-line" />
        <text x={pad.l} y={H - 6} className="chart-label">
          {formatDateLabel(first)}
        </text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" className="chart-label">
          {formatDateLabel(shown.at(-1)!.date)}
        </text>
      </svg>
      <figcaption className="chart-legend">
        <span className="legend-line" /> Trend weight <span className="legend-dot" /> Scale weight
      </figcaption>
    </figure>
  )
}

const etaText = (weeks: number, today: string) => {
  const w = Math.ceil(weeks)
  const date = new Date(`${shiftDate(today, w * 7)}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `about ${w} week${w === 1 ? '' : 's'} (around ${date})`
}

export function WeightCard({
  weights,
  profile,
  maintenance,
  onSave,
  onDelete,
}: {
  /** Sorted oldest first. */
  weights: WeightEntry[]
  profile: Profile
  maintenance?: number
  onSave: (entry: WeightEntry) => void
  onDelete: (date: string) => void
}) {
  const today = dateKey(new Date())
  const [date, setDate] = useState(today)
  const [kg, setKg] = useState<number | undefined>()
  const [formKey, setFormKey] = useState(0)
  const unit = profile.weightUnit
  const points = weightTrend(weights)
  const latest = points.at(-1)
  const rate = weightRate(weights, today)
  const target = profile.targetWeightKg
  const planned = plannedKgPerWeek(profile, maintenance)
  const plannedWeeks = latest && target ? weeksToReach(latest.trend, target, planned) : undefined
  const trendWeeks = latest && target ? weeksToReach(latest.trend, target, rate) : undefined

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!kg) return
    onSave({ date, kg })
    setKg(undefined)
    setDate(today)
    setFormKey((k) => k + 1)
  }

  return (
    <section className="card">
      <h2 className="card-title">Weight</h2>
      {latest ? (
        <div className="weight-summary">
          <div>
            <span className="hint">Trend weight</span>
            <strong className="weight-now">{formatWeight(latest.trend, unit)}</strong>
            <span className="hint">
              Scale: {formatWeight(latest.kg, unit)}, {formatDateLabel(latest.date).toLowerCase()}
            </span>
          </div>
          {rate !== undefined && (
            <div className="weight-stat">
              <span className="hint">Last 4 weeks</span>
              <strong>{formatWeightChange(rate, unit)}</strong>
              <span className="hint">a week</span>
            </div>
          )}
          {points.length > 1 && (
            <div className="weight-stat">
              <span className="hint">Since {formatDateLabel(points[0].date)}</span>
              <strong>{formatWeightChange(latest.trend - points[0].trend, unit)}</strong>
              <span className="hint">trend</span>
            </div>
          )}
        </div>
      ) : (
        <p className="hint">Weigh yourself first thing in the morning, before eating, for the most consistent numbers.</p>
      )}
      {latest && (
        <p className="hint">
          Trend weight smooths out daily swings from water, salt and food, so it shows what your body is really doing.
        </p>
      )}

      <WeightChart points={points} profile={profile} />

      {latest && target && (
        <div className="goal-eta">
          <strong>
            Goal {formatWeight(target, unit)} · {formatWeight(Math.abs(latest.trend - target), unit)} to go
          </strong>
          {weeksToReach(latest.trend, target, 1) === 0 ? (
            <span>You've reached your goal weight. Nice work!</span>
          ) : (
            <>
              {planned !== undefined && (
                <span>
                  At your planned pace ({formatWeightChange(planned, unit)} a week):{' '}
                  {plannedWeeks !== undefined ? etaText(plannedWeeks, today) : "your plan isn't heading towards this goal"}
                </span>
              )}
              <span>
                At your current rate
                {rate !== undefined ? ` (${formatWeightChange(rate, unit)} a week)` : ''}:{' '}
                {rate === undefined
                  ? 'weigh in for at least a week to see this'
                  : trendWeeks !== undefined
                    ? etaText(trendWeeks, today)
                    : 'not heading towards your goal yet'}
              </span>
            </>
          )}
        </div>
      )}

      <form className="weight-form" onSubmit={save}>
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
        </label>
        <label className="field">
          <span>Weight</span>
          <WeightInput key={formKey} unit={unit} onChange={setKg} />
        </label>
        <button className="btn primary" type="submit" disabled={!kg}>
          {weights.some((w) => w.date === date) ? 'Update' : 'Log weight'}
        </button>
      </form>

      {weights.length > 0 && (
        <div className="weight-history">
          {[...points]
            .reverse()
            .slice(0, 7)
            .map((w) => (
              <div key={w.date} className="weight-row">
                <span>{formatDateLabel(w.date)}</span>
                <span className="hint">trend {formatWeight(w.trend, unit)}</span>
                <strong>{formatWeight(w.kg, unit)}</strong>
                <button className="icon-btn small" onClick={() => onDelete(w.date)} aria-label={`Delete weight for ${w.date}`}>
                  <CloseIcon />
                </button>
              </div>
            ))}
        </div>
      )}
    </section>
  )
}

