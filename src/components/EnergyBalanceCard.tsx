import { useMemo, useState } from 'react'
import { KCAL_PER_KG, maintenanceOn } from '../energy'
import { formatNumber } from '../nutrients'
import type { Profile, WeightEntry } from '../types'
import { formatWeightChange } from '../units'
import { dateKey, formatDateLabel, shiftDate } from '../util'

type Lens = 'expenditure' | 'target'
const RANGES = [
  { days: 7, label: '1W' },
  { days: 30, label: '1M' },
  { days: 90, label: '3M' },
]

interface Day {
  date: string
  intake?: number
  reference?: number
  /** Today is still in progress, so it's shown but not counted. */
  partial: boolean
}

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatNumber(Math.abs(Math.round(n)))}`

/**
 * Daily intake compared with expenditure (was there a real deficit or surplus?) or with the calorie target
 * (how closely was the plan followed?), like MacroFactor's energy balance.
 */
export function EnergyBalanceCard({
  profile,
  weights,
  kcalByDate,
  calorieGoal,
}: {
  profile: Profile
  /** Sorted oldest first. */
  weights: WeightEntry[]
  kcalByDate: Record<string, number>
  calorieGoal: number
}) {
  const [lens, setLens] = useState<Lens>('expenditure')
  const [range, setRange] = useState(30)
  const [selected, setSelected] = useState<string>()
  const today = dateKey(new Date())

  const days = useMemo<Day[]>(
    () =>
      Array.from({ length: range }, (_, i) => {
        const date = shiftDate(today, i - range + 1)
        const kcal = kcalByDate[date]
        return {
          date,
          intake: kcal > 0 ? kcal : undefined,
          reference: lens === 'target' ? calorieGoal : maintenanceOn(profile, weights, kcalByDate, date)?.kcal,
          partial: date === today,
        }
      }),
    [range, lens, today, kcalByDate, calorieGoal, profile, weights],
  )
  const usesFormula = lens === 'expenditure' && maintenanceOn(profile, weights, kcalByDate, today)?.source !== 'logs'

  const counted = days.filter((d) => !d.partial && d.intake !== undefined && d.reference !== undefined)
  const avg = (f: (d: Day) => number) => counted.reduce((s, d) => s + f(d), 0) / counted.length
  const avgIntake = counted.length ? avg((d) => d.intake!) : undefined
  const avgReference = counted.length ? avg((d) => d.reference!) : undefined
  const avgDiff = avgIntake !== undefined && avgReference !== undefined ? avgIntake - avgReference : undefined
  const loggedDays = days.filter((d) => !d.partial && d.intake !== undefined).length
  const noReference = lens === 'expenditure' && days.every((d) => d.reference === undefined)

  // Symmetric scale around zero, in steps of 250 kcal. Today's unfinished day doesn't set the scale; its bar is clipped.
  const diffs = counted.map((d) => Math.abs(d.intake! - d.reference!))
  const scale = Math.max(500, Math.ceil(Math.max(0, ...diffs) / 250) * 250)
  const W = 320
  const H = 150
  const pad = { l: 30, r: 4, t: 8, b: 20 }
  const slot = (W - pad.l - pad.r) / range
  const barW = Math.max(1.5, slot * 0.7)
  const y = (kcal: number) => pad.t + ((scale - Math.max(-scale, Math.min(scale, kcal))) / (2 * scale)) * (H - pad.t - pad.b)
  const axisLabel = (n: number) => (n >= 1000 ? `${n / 1000}k` : String(n))
  const zero = y(0)
  const sel = days.find((d) => d.date === selected)

  return (
    <section className="card">
      <h2 className="card-title">Energy balance</h2>
      <div className="segmented small" role="tablist" aria-label="Compare with">
        <button role="tab" aria-selected={lens === 'expenditure'} className={lens === 'expenditure' ? 'active' : ''} onClick={() => setLens('expenditure')}>
          vs Expenditure
        </button>
        <button role="tab" aria-selected={lens === 'target'} className={lens === 'target' ? 'active' : ''} onClick={() => setLens('target')}>
          vs Target
        </button>
      </div>

      {noReference ? (
        <p className="hint">Fill in About you and log your weight to estimate how much you burn each day.</p>
      ) : loggedDays === 0 && !days.at(-1)?.intake ? (
        <p className="hint">Log some food to see your energy balance.</p>
      ) : (
        <>
          <div className="balance-summary" aria-live="polite">
            {sel ? (
              <>
                <span className="hint">{formatDateLabel(sel.date)}{sel.partial ? ' (so far)' : ''}</span>
                {sel.intake === undefined ? (
                  <strong>No food logged</strong>
                ) : (
                  <>
                    <strong className={sel.reference !== undefined && sel.intake > sel.reference ? 'surplus' : 'deficit'}>
                      {sel.reference !== undefined ? `${signed(sel.intake - sel.reference)} kcal` : '—'}
                    </strong>
                    <span className="hint">
                      Ate {formatNumber(Math.round(sel.intake))} kcal
                      {sel.reference !== undefined &&
                        ` · ${lens === 'target' ? 'target' : 'burned about'} ${formatNumber(Math.round(sel.reference))} kcal`}
                    </span>
                  </>
                )}
              </>
            ) : avgDiff !== undefined ? (
              <>
                <span className="hint">
                  Average over {counted.length} logged day{counted.length === 1 ? '' : 's'}
                </span>
                <strong className={avgDiff > 0 ? 'surplus' : 'deficit'}>
                  {signed(avgDiff)} kcal a day{' '}
                  {lens === 'target' ? (avgDiff > 0 ? 'over target' : 'under target') : avgDiff > 0 ? 'surplus' : 'deficit'}
                </strong>
                <span className="hint">
                  Ate {formatNumber(Math.round(avgIntake!))} vs {lens === 'target' ? 'target' : 'burned about'}{' '}
                  {formatNumber(Math.round(avgReference!))} kcal
                  {lens === 'expenditure' &&
                    ` · about ${formatWeightChange((avgDiff * 7) / KCAL_PER_KG, profile.weightUnit)} a week`}
                </span>
              </>
            ) : (
              <span className="hint">Today is counted once it's over.</span>
            )}
          </div>

          <svg className="balance-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Daily ${lens === 'target' ? 'difference from target' : 'energy balance'}`}>
            <text x={pad.l - 4} y={y(scale) + 4} textAnchor="end" className="chart-label">
              +{axisLabel(scale)}
            </text>
            <text x={pad.l - 4} y={zero + 3} textAnchor="end" className="chart-label">
              0
            </text>
            <text x={pad.l - 4} y={y(-scale)} textAnchor="end" className="chart-label">
              −{axisLabel(scale)}
            </text>
            <line x1={pad.l} x2={W - pad.r} y1={zero} y2={zero} className="balance-zero" />
            {days.map((d, i) => {
              const cx = pad.l + slot * i + slot / 2
              const diff = d.intake !== undefined && d.reference !== undefined ? d.intake - d.reference : undefined
              return (
                <g key={d.date} onClick={() => setSelected(selected === d.date ? undefined : d.date)} className="balance-day">
                  <rect x={pad.l + slot * i} y={pad.t} width={slot} height={H - pad.t - pad.b} className="balance-hit" />
                  {diff === undefined ? (
                    <circle cx={cx} cy={zero} r={1.5} className="balance-missing" />
                  ) : (
                    <rect
                      x={cx - barW / 2}
                      y={Math.min(y(diff), zero)}
                      width={barW}
                      height={Math.max(Math.abs(y(diff) - zero), 1)}
                      rx={Math.min(2, barW / 2)}
                      className={`balance-bar ${diff > 0 ? 'surplus' : 'deficit'}${d.partial ? ' partial' : ''}${selected === d.date ? ' selected' : ''}`}
                    />
                  )}
                </g>
              )
            })}
            <text x={pad.l} y={H - 5} className="chart-label">
              {formatDateLabel(days[0].date)}
            </text>
            <text x={W - pad.r} y={H - 5} textAnchor="end" className="chart-label">
              Today
            </text>
          </svg>
          <div className="chart-legend">
            <span className="legend-swatch surplus" /> {lens === 'target' ? 'Over target' : 'Surplus'}
            <span className="legend-swatch deficit" /> {lens === 'target' ? 'Under target' : 'Deficit'}
            <span className="hint legend-note">Tap a day for details</span>
          </div>
        </>
      )}

      <div className="segmented small range" role="tablist" aria-label="Time range">
        {RANGES.map((r) => (
          <button
            key={r.days}
            role="tab"
            aria-selected={range === r.days}
            className={range === r.days ? 'active' : ''}
            onClick={() => {
              setRange(r.days)
              setSelected(undefined)
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      <p className="hint">
        {lens === 'expenditure'
          ? usesFormula
            ? 'Expenditure is estimated with the formula until you have two weeks of weigh-ins and food logs, then from your own data.'
            : 'Expenditure for each day is worked out from your weight trend and food logs over the four weeks before it.'
          : `Compared with your current target of ${formatNumber(calorieGoal)} kcal.`}{' '}
        Days without food logged aren't counted.
      </p>
    </section>
  )
}
