import { useState } from 'react'
import { weeksToTarget } from '../energy'
import type { Profile, WeightEntry } from '../types'
import { formatWeight, formatWeightChange } from '../units'
import { dateKey, daysBetween, formatDateLabel } from '../util'
import { CloseIcon } from './icons'
import { WeightInput } from './MeasureInputs'

const CHART_DAYS = 90

function WeightChart({ weights, profile }: { weights: WeightEntry[]; profile: Profile }) {
  const today = dateKey(new Date())
  const points = weights.filter((w) => daysBetween(w.date, today) < CHART_DAYS)
  if (points.length < 2) return null
  const W = 320
  const H = 140
  const pad = { l: 8, r: 8, t: 14, b: 22 }
  const values = points.map((p) => p.kg)
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
  const first = points[0].date
  const span = Math.max(daysBetween(first, points.at(-1)!.date), 1)
  const x = (date: string) => pad.l + (daysBetween(first, date) / span) * (W - pad.l - pad.r)
  const y = (kg: number) => pad.t + ((max - kg) / (max - min)) * (H - pad.t - pad.b)
  return (
    <svg className="weight-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weight over time">
      {showTarget && (
        <>
          <line x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} className="chart-target" />
          <text x={W - pad.r} y={y(target) - 4} textAnchor="end" className="chart-label">
            Target {formatWeight(target, profile.weightUnit)}
          </text>
        </>
      )}
      <polyline points={points.map((p) => `${x(p.date)},${y(p.kg)}`).join(' ')} className="chart-line" />
      {points.map((p) => (
        <circle key={p.date} cx={x(p.date)} cy={y(p.kg)} r={3} className="chart-dot" />
      ))}
      <text x={pad.l} y={H - 6} className="chart-label">
        {formatDateLabel(first)}
      </text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" className="chart-label">
        {formatDateLabel(points.at(-1)!.date)}
      </text>
    </svg>
  )
}

export function WeightCard({
  weights,
  profile,
  onSave,
  onDelete,
}: {
  /** Sorted oldest first. */
  weights: WeightEntry[]
  profile: Profile
  onSave: (entry: WeightEntry) => void
  onDelete: (date: string) => void
}) {
  const today = dateKey(new Date())
  const [date, setDate] = useState(today)
  const [kg, setKg] = useState<number | undefined>()
  const [formKey, setFormKey] = useState(0)
  const latest = weights.at(-1)
  const unit = profile.weightUnit
  const weeks = latest ? weeksToTarget(latest.kg, profile) : undefined

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
            <strong className="weight-now">{formatWeight(latest.kg, unit)}</strong>
            <span className="hint">{formatDateLabel(latest.date)}</span>
          </div>
          {weights.length > 1 && (
            <div className="weight-stat">
              <strong>{formatWeightChange(latest.kg - weights[0].kg, unit)}</strong>
              <span className="hint">since {formatDateLabel(weights[0].date)}</span>
            </div>
          )}
          {profile.targetWeightKg && (profile.aim === 'lose' || profile.aim === 'gain') && (
            <div className="weight-stat">
              <strong>{formatWeight(Math.abs(latest.kg - profile.targetWeightKg), unit)}</strong>
              <span className="hint">
                to go
                {weeks ? ` · about ${Math.ceil(weeks)} week${Math.ceil(weeks) === 1 ? '' : 's'}` : ''}
              </span>
            </div>
          )}
        </div>
      ) : (
        <p className="hint">Weigh yourself first thing in the morning, before eating, for the most consistent numbers.</p>
      )}

      <WeightChart weights={weights} profile={profile} />

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
          {[...weights]
            .reverse()
            .slice(0, 7)
            .map((w) => (
              <div key={w.date} className="weight-row">
                <span>{formatDateLabel(w.date)}</span>
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
