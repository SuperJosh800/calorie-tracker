import { useState } from 'react'
import { ACTIVITY_LEVELS, ageOf, AIMS, DEFAULT_RATE, formulaMaintenance, KCAL_PER_KG, planFor, RATES, round10, weeksToTarget } from '../energy'
import { formatNumber } from '../nutrients'
import type { Profile, Settings } from '../types'
import { formatRate, formatWeight } from '../units'
import { ChevronLeft } from './icons'
import { HeightInput, WeightInput } from './MeasureInputs'

type Step = 'welcome' | 'name' | 'aim' | 'about' | 'weight' | 'activity' | 'plan'
const STEPS: Step[] = ['welcome', 'name', 'aim', 'about', 'weight', 'activity', 'plan']

/** First-run setup: asks for the user's name, aim and details, then shows their personal plan. */
export function Onboarding({
  initialProfile,
  initialWeightKg,
  onFinish,
  onSkip,
}: {
  initialProfile: Profile
  initialWeightKg?: number
  onFinish: (profile: Profile, weightKg: number, goals: Partial<Settings>) => void
  onSkip: () => void
}) {
  const [step, setStep] = useState<Step>('welcome')
  const [p, setP] = useState<Profile>(initialProfile)
  const [kg, setKg] = useState(initialWeightKg)
  const set = (patch: Partial<Profile>) => setP((prev) => ({ ...prev, ...patch }))
  const index = STEPS.indexOf(step)
  const next = () => setStep(STEPS[index + 1])
  const back = () => setStep(STEPS[index - 1])
  const name = p.name?.trim()
  const age = ageOf(p)

  const canContinue: Record<Step, boolean> = {
    welcome: true,
    name: !!name,
    aim: !!p.aim,
    about: !!p.sex && age !== undefined && !!p.heightCm,
    weight: !!kg,
    activity: !!p.activity,
    plan: true,
  }

  const maintenance = kg ? formulaMaintenance(p, kg) : undefined
  const plan = kg && maintenance ? planFor(p, kg, maintenance) : undefined
  const weeks = kg ? weeksToTarget(kg, p) : undefined

  return (
    <div className="onboarding">
      {step !== 'welcome' && (
        <header className="onboarding-top">
          <button className="icon-btn" onClick={back} aria-label="Back">
            <ChevronLeft />
          </button>
          <div className="progress" aria-label={`Step ${index} of ${STEPS.length - 1}`}>
            <span style={{ width: `${(index / (STEPS.length - 1)) * 100}%` }} />
          </div>
        </header>
      )}

      <main className="onboarding-body">
        {step === 'welcome' && (
          <div className="welcome">
            <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={96} height={96} />
            <h1>Welcome to Calorie Tracker</h1>
            <p>Scan barcodes, see every nutrient in your food, and get daily targets built around your goal.</p>
            <p className="hint">It takes about a minute to set up. Everything stays on your phone.</p>
          </div>
        )}

        {step === 'name' && (
          <>
            <h1>What should we call you?</h1>
            <input
              className="big-input"
              value={p.name ?? ''}
              onChange={(e) => set({ name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && name && next()}
              placeholder="Your first name"
              autoComplete="given-name"
              autoFocus
            />
          </>
        )}

        {step === 'aim' && (
          <>
            <h1>What's your goal, {name}?</h1>
            <div className="option-list" role="radiogroup" aria-label="Your goal">
              {AIMS.map((a) => (
                <button
                  key={a.id}
                  role="radio"
                  aria-checked={p.aim === a.id}
                  className={p.aim === a.id ? 'active' : ''}
                  onClick={() => set({ aim: a.id, ratePerWeekKg: DEFAULT_RATE[a.id] })}
                >
                  <strong>{a.label}</strong>
                  <span>{a.detail}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'about' && (
          <>
            <h1>A bit about you</h1>
            <p className="hint">This lets us estimate how many calories your body burns.</p>
            <div className="segmented" role="radiogroup" aria-label="Sex">
              {(['female', 'male'] as const).map((s) => (
                <button key={s} role="radio" aria-checked={p.sex === s} className={p.sex === s ? 'active' : ''} onClick={() => set({ sex: s })}>
                  {s === 'female' ? 'Female' : 'Male'}
                </button>
              ))}
            </div>
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
            <div className="field">
              <span className="field-label-row">
                <span>Height</span>
                <UnitToggle
                  value={p.heightUnit}
                  options={[
                    ['cm', 'cm'],
                    ['ftin', 'ft & in'],
                  ]}
                  onChange={(heightUnit) => set({ heightUnit })}
                />
              </span>
              <HeightInput cm={p.heightCm} unit={p.heightUnit} onChange={(heightCm) => set({ heightCm })} />
            </div>
          </>
        )}

        {step === 'weight' && (
          <>
            <h1>How much do you weigh?</h1>
            <div className="field">
              <span className="field-label-row">
                <span>Current weight</span>
                <UnitToggle
                  value={p.weightUnit}
                  options={[
                    ['kg', 'kg'],
                    ['stlb', 'st & lb'],
                    ['lb', 'lb'],
                  ]}
                  onChange={(weightUnit) => set({ weightUnit })}
                />
              </span>
              <WeightInput kg={kg} unit={p.weightUnit} onChange={setKg} />
            </div>
            {(p.aim === 'lose' || p.aim === 'gain') && (
              <>
                <label className="field">
                  <span>Target weight (optional)</span>
                  <WeightInput kg={p.targetWeightKg} unit={p.weightUnit} label="Target weight" onChange={(t) => set({ targetWeightKg: t })} />
                </label>
                <label className="field">
                  <span>Pace</span>
                  <select value={p.ratePerWeekKg ?? ''} onChange={(e) => set({ ratePerWeekKg: Number(e.target.value) })}>
                    {RATES[p.aim].map((r) => (
                      <option key={r} value={r}>
                        {formatRate(r, p.weightUnit)} a week{r === DEFAULT_RATE[p.aim!] ? ' (recommended)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                {p.ratePerWeekKg && (
                  <p className="hint">
                    About {Math.round((p.ratePerWeekKg * KCAL_PER_KG) / 7)} kcal a day {p.aim === 'lose' ? 'less' : 'more'} than
                    you burn.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {step === 'activity' && (
          <>
            <h1>How active are you?</h1>
            <p className="hint">Think about a normal week, including your job and any exercise.</p>
            <div className="option-list" role="radiogroup" aria-label="Activity level">
              {ACTIVITY_LEVELS.map((a) => (
                <button
                  key={a.id}
                  role="radio"
                  aria-checked={p.activity === a.id}
                  className={p.activity === a.id ? 'active' : ''}
                  onClick={() => set({ activity: a.id })}
                >
                  <strong>{a.label}</strong>
                  <span>{a.detail}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'plan' && plan && maintenance && kg && (
          <div className="plan">
            <h1>Nice goal, {name}!</h1>
            <p className="plan-lead">We'll help you get there.</p>
            <div className="plan-card">
              <span>Your daily target</span>
              <strong>{formatNumber(plan.goals.calorieGoal)} kcal</strong>
              <small>
                Your body burns about {formatNumber(round10(maintenance))} kcal a day.{' '}
                {aimMessage(p, maintenance, plan.target.kcal)}
              </small>
            </div>
            <div className="plan-macros">
              <div>
                <strong>{plan.macros.protein} g</strong>
                <span>Protein</span>
              </div>
              <div>
                <strong>{plan.macros.carbs} g</strong>
                <span>Carbs</span>
              </div>
              <div>
                <strong>{plan.macros.fat} g</strong>
                <span>Fat</span>
              </div>
            </div>
            {plan.target.limited && (
              <p className="notice">
                We've kept your target at {formatNumber(plan.target.kcal)} kcal, the lowest that's recommended without medical
                advice. A slower pace would be kinder to your body.
              </p>
            )}
            {weeks !== undefined && weeks > 0 && p.targetWeightKg && (
              <p className="plan-eta">
                At {formatRate(p.ratePerWeekKg!, p.weightUnit)} a week you could reach{' '}
                <strong>{formatWeight(p.targetWeightKg, p.weightUnit)}</strong> in about{' '}
                <strong>{Math.ceil(weeks)} weeks</strong>.
              </p>
            )}
            <p className="hint">
              Log your food and weigh in a few times a week. After two weeks the app learns your real maintenance from your
              own data and fine-tunes these numbers. You can change anything later in the Goals tab.
            </p>
          </div>
        )}
      </main>

      <footer className="onboarding-footer">
        {step === 'plan' ? (
          <button className="btn primary wide" onClick={() => plan && kg && onFinish({ ...p, onboarded: true }, kg, plan.goals)}>
            Start tracking
          </button>
        ) : (
          <button className="btn primary wide" disabled={!canContinue[step]} onClick={next}>
            {step === 'welcome' ? 'Get started' : step === 'activity' ? 'See my plan' : 'Continue'}
          </button>
        )}
        {step === 'welcome' && (
          <button className="link skip" onClick={onSkip}>
            Skip for now
          </button>
        )}
      </footer>
    </div>
  )
}

function aimMessage(p: Profile, maintenance: number, kcal: number): string {
  // Use the rounded figures shown on screen so the difference adds up.
  const diff = formatNumber(Math.abs(round10(maintenance) - round10(kcal)))
  switch (p.aim) {
    case 'recomp':
      return `Eating ${diff} kcal under that, with plenty of protein and regular strength training, helps you burn fat while building muscle.`
    case 'lose':
      return `Eating ${diff} kcal under that each day means steady fat loss.`
    case 'gain':
      return `Eating ${diff} kcal over that each day gives your body what it needs to grow. Pair it with strength training.`
    default:
      return 'Eating about that much keeps your weight steady.'
  }
}

function UnitToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <span className="unit-toggle" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'active' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </span>
  )
}
