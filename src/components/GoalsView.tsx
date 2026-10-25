import { useMemo } from 'react'
import {
  ACTIVITY_LEVELS,
  AIMS,
  ageOf,
  DEFAULT_RATE,
  ESTIMATE_WINDOW_DAYS,
  estimateFromLogs,
  formulaMaintenance,
  KCAL_PER_KG,
  planFor,
  RATES,
  RECOMP_DEFICIT,
  round10,
} from '../energy'
import { entryNutrients, formatNumber } from '../nutrients'
import { DEFAULT_SETTINGS, type Entry, type Profile, type Settings, type WeightEntry } from '../types'
import { formatRate, formatWeightChange } from '../units'
import { dateKey } from '../util'
import { HeightInput, WeightInput } from './MeasureInputs'
import { WeightCard } from './WeightCard'

export function GoalsView({
  profile,
  onProfileChange,
  weights,
  onWeightsChange,
  entries,
  settings,
  onSettingsChange,
}: {
  profile: Profile
  onProfileChange: (p: Profile) => void
  weights: WeightEntry[]
  onWeightsChange: (w: WeightEntry[]) => void
  entries: Entry[]
  settings: Settings
  onSettingsChange: (s: Settings) => void
}) {
  const today = dateKey(new Date())
  const sorted = useMemo(() => [...weights].sort((a, b) => a.date.localeCompare(b.date)), [weights])
  const latestKg = sorted.at(-1)?.kg
  const set = (patch: Partial<Profile>) => onProfileChange({ ...profile, ...patch })
  const unit = profile.weightUnit

  const kcalByDate = useMemo(() => {
    const out: Record<string, number> = {}
    for (const e of entries) out[e.date] = (out[e.date] ?? 0) + (entryNutrients(e)['energy-kcal'] ?? 0)
    return out
  }, [entries])

  const formula = latestKg ? formulaMaintenance(profile, latestKg) : undefined
  const fromLogs = estimateFromLogs(sorted, kcalByDate, today)
  // Ignore a log-based estimate that is clearly off, usually because meals weren't all logged.
  const logsUsable = fromLogs.ok && fromLogs.maintenance > 1000 && fromLogs.maintenance < 6000
  const maintenance = logsUsable && fromLogs.ok ? fromLogs.maintenance : formula
  const plan = maintenance && profile.aim && latestKg ? planFor(profile, latestKg, maintenance) : undefined
  const target = plan?.target
  const macros = plan?.macros
  const recommended = plan?.goals
  const goalsMatch =
    recommended &&
    recommended.calorieGoal === settings.calorieGoal &&
    recommended.proteinGoal === settings.proteinGoal &&
    recommended.carbsGoal === settings.carbsGoal &&
    recommended.fatGoal === settings.fatGoal

  const missing = [
    !profile.aim && 'your aim',
    !latestKg && 'your weight',
    !profile.sex && 'sex',
    ageOf(profile) === undefined && 'age',
    !profile.heightCm && 'height',
    !profile.activity && 'activity level',
  ].filter(Boolean) as string[]

  const aim = AIMS.find((a) => a.id === profile.aim)
  const age = ageOf(profile)

  return (
    <>
      <section className="card">
        <h2 className="card-title">Your aim</h2>
        <div className="choice-list" role="radiogroup" aria-label="Your aim">
          {AIMS.map((a) => (
            <button
              key={a.id}
              role="radio"
              aria-checked={profile.aim === a.id}
              className={profile.aim === a.id ? 'active' : ''}
              onClick={() =>
set({ aim: a.id, ratePerWeekKg: DEFAULT_RATE[a.id] })
              }
            >
              {a.label}
            </button>
          ))}
        </div>
        {aim && <p className="hint">{aim.detail}</p>}
        {(profile.aim === 'lose' || profile.aim === 'gain') && (
          <>
            <label className="field">
              <span>Pace</span>
              <select
                value={profile.ratePerWeekKg ?? ''}
                onChange={(e) => set({ ratePerWeekKg: Number(e.target.value) })}
              >
                {RATES[profile.aim].map((r) => (
                  <option key={r} value={r}>
                    {formatRate(r, unit)} a week ({Math.round((r * KCAL_PER_KG) / 7)} kcal a day{' '}
                    {profile.aim === 'lose' ? 'less' : 'more'})
                    {r === DEFAULT_RATE[profile.aim!] ? ' – recommended' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Target weight (optional)</span>
              <WeightInput
                kg={profile.targetWeightKg}
                unit={unit}
                label="Target weight"
                onChange={(kg) => set({ targetWeightKg: kg })}
              />
            </label>
          </>
        )}
      </section>

      <WeightCard
        weights={sorted}
        profile={profile}
        onSave={(entry) => onWeightsChange([...weights.filter((w) => w.date !== entry.date), entry])}
        onDelete={(date) => onWeightsChange(weights.filter((w) => w.date !== date))}
      />

      <section className="card">
        <h2 className="card-title">About you</h2>
        <p className="hint">Used to estimate how many calories your body burns. Stored only on this phone.</p>
        <label className="field">
          <span>Name</span>
          <input value={profile.name ?? ''} onChange={(e) => set({ name: e.target.value || undefined })} autoComplete="given-name" />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Sex (for the formula)</span>
            <select value={profile.sex ?? ''} onChange={(e) => set({ sex: (e.target.value || undefined) as Profile['sex'] })}>
              <option value="">Choose…</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </label>
          <label className="field">
            <span>Age</span>
            <input
              inputMode="numeric"
              value={age ?? ''}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ''))
                set({ birthYear: n > 0 && n < 120 ? new Date().getFullYear() - n : undefined })
              }}
            />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Height</span>
            <HeightInput cm={profile.heightCm} unit={profile.heightUnit} onChange={(cm) => set({ heightCm: cm })} />
          </label>
          <label className="field narrow">
            <span>Height in</span>
            <select value={profile.heightUnit} onChange={(e) => set({ heightUnit: e.target.value as Profile['heightUnit'] })}>
              <option value="cm">cm</option>
              <option value="ftin">ft &amp; in</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span>Weight in</span>
          <select value={unit} onChange={(e) => set({ weightUnit: e.target.value as Profile['weightUnit'] })}>
            <option value="kg">Kilograms (kg)</option>
            <option value="stlb">Stones &amp; pounds (st lb)</option>
            <option value="lb">Pounds (lb)</option>
          </select>
        </label>
        <label className="field">
          <span>How active are you?</span>
          <select
            value={profile.activity ?? ''}
            onChange={(e) => set({ activity: (e.target.value || undefined) as Profile['activity'] })}
          >
            <option value="">Choose…</option>
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}: {a.detail}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card">
        <h2 className="card-title">Your numbers</h2>
        {missing.length > 0 && !maintenance ? (
          <p className="hint">Add {listJoin(missing)} above to see your maintenance calories and a daily target.</p>
        ) : (
          <>
            <div className="numbers">
              <div className="number">
                <span>Maintenance</span>
                <strong>{maintenance ? `${formatNumber(round10(maintenance))} kcal` : '—'}</strong>
                <small>
                  {logsUsable ? 'from your weight and food logs' : 'estimated with the Mifflin-St Jeor formula'}
                </small>
              </div>
              <div className="number highlight">
                <span>Daily target</span>
                <strong>{target ? `${formatNumber(round10(target.kcal))} kcal` : '—'}</strong>
                <small>{target && maintenance ? describeTarget(profile, maintenance, target.kcal) : 'choose your aim above'}</small>
              </div>
            </div>
            {target?.limited && (
              <p className="notice">
                Your pace would take you below {formatNumber(target.kcal)} kcal a day, so the target is held there. Eating less
                than this isn't recommended without medical advice. Try a slower pace.
              </p>
            )}
            {macros && (
              <p className="hint">
                Suggested: <strong>{macros.protein} g protein</strong>, {macros.carbs} g carbs and {macros.fat} g fat a day.
                {profile.aim === 'recomp' && ' The high protein helps you build muscle while losing fat.'}
              </p>
            )}
            {recommended && (
              <button className="btn primary wide" disabled={goalsMatch} onClick={() => onSettingsChange({ ...settings, ...recommended })}>
                {goalsMatch ? 'Your daily goals match these numbers' : 'Use these as my daily goals'}
              </button>
            )}
            {logsUsable && fromLogs.ok && formula && (
              <p className="hint">
                Over the last {fromLogs.spanDays} days you averaged {formatNumber(round10(fromLogs.avgIntake))} kcal on the{' '}
                {fromLogs.loggedDays} days you logged, and your weight trend was{' '}
                {formatWeightChange(fromLogs.kgPerWeek, unit)} a week. The formula alone says{' '}
                {formatNumber(round10(formula))} kcal.
              </p>
            )}
            {!fromLogs.ok && (
              <p className="hint">
                After two weeks of weighing in and logging your food, the app will work out your maintenance from your own
                data, which is usually more accurate than the formula. So far in the last {ESTIMATE_WINDOW_DAYS} days:{' '}
                {fromLogs.weighIns} weigh-in{fromLogs.weighIns === 1 ? '' : 's'} over {fromLogs.spanDays} day
                {fromLogs.spanDays === 1 ? '' : 's'}, and {fromLogs.loggedDays} day{fromLogs.loggedDays === 1 ? '' : 's'} of food
                logged between them (needs 3 weigh-ins over 14 days and 10 days logged).
              </p>
            )}
            {fromLogs.ok && !logsUsable && (
              <p className="hint">
                Your logs give an unlikely result, which usually means some meals weren't logged, so the formula is used for
                now.
              </p>
            )}
          </>
        )}
      </section>

      <DailyGoalsCard settings={settings} onChange={onSettingsChange} />
    </>
  )
}

function describeTarget(p: Profile, maintenance: number, kcal: number): string {
  // Use the rounded figures shown on screen so the difference adds up.
  const diff = Math.abs(round10(maintenance) - round10(kcal))
  if (p.aim === 'recomp') return `${diff} kcal (${RECOMP_DEFICIT * 100}%) below maintenance`
  if (p.aim === 'maintain' || diff === 0) return 'same as maintenance'
  return `${diff} kcal ${kcal < maintenance ? 'below' : 'above'} maintenance`
}

const listJoin = (items: string[]) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`

function DailyGoalsCard({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const goals: [Exclude<keyof Settings, 'usdaApiKey'>, string, string][] = [
    ['calorieGoal', 'Calories', 'kcal'],
    ['proteinGoal', 'Protein', 'g'],
    ['carbsGoal', 'Carbohydrate', 'g'],
    ['fatGoal', 'Fat', 'g'],
  ]
  return (
    <section className="card">
      <h2 className="card-title">Daily goals</h2>
      <p className="hint">These drive the diary. Set them from your numbers above, or type your own.</p>
      {goals.map(([key, label, unit]) => (
        <label key={key} className="field inline">
          <span>{label}</span>
          <span className="input-unit">
            <input
              inputMode="numeric"
              value={settings[key] || ''}
              onChange={(e) => onChange({ ...settings, [key]: Number(e.target.value.replace(/\D/g, '')) || 0 })}
              onBlur={() => !settings[key] && onChange({ ...settings, [key]: DEFAULT_SETTINGS[key] })}
            />
            <small>{unit}</small>
          </span>
        </label>
      ))}
    </section>
  )
}
