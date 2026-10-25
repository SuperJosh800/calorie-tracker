import { describeQuantity, entryNutrients, formatNumber, sumNutrients } from '../nutrients'
import { MEALS, type Entry, type Meal, type Nutrients, type Settings } from '../types'
import { FoodThumb } from './FoodRow'
import { PlusIcon } from './icons'

export function Summary({ totals, settings }: { totals: Nutrients; settings: Settings }) {
  const eaten = totals['energy-kcal'] ?? 0
  const remaining = settings.calorieGoal - eaten
  const pct = Math.min(eaten / settings.calorieGoal, 1)
  const r = 52
  const c = 2 * Math.PI * r
  const macros = [
    { key: 'proteins', label: 'Protein', goal: settings.proteinGoal, cls: 'protein' },
    { key: 'carbohydrates', label: 'Carbs', goal: settings.carbsGoal, cls: 'carbs' },
    { key: 'fat', label: 'Fat', goal: settings.fatGoal, cls: 'fat' },
  ]
  return (
    <section className="card summary">
      <div className="ring">
        <svg viewBox="0 0 120 120" aria-hidden>
          <circle cx="60" cy="60" r={r} className="ring-track" />
          <circle
            cx="60"
            cy="60"
            r={r}
            className={`ring-fill${remaining < 0 ? ' over' : ''}`}
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
          />
        </svg>
        <div className="ring-label">
          <strong>{formatNumber(Math.abs(remaining))}</strong>
          <span>{remaining < 0 ? 'kcal over' : 'kcal left'}</span>
        </div>
      </div>
      <div className="summary-side">
        <p className="summary-line">
          <strong>{formatNumber(eaten)}</strong> eaten of {formatNumber(settings.calorieGoal)} kcal
        </p>
        {macros.map((m) => {
          const v = totals[m.key] ?? 0
          return (
            <div key={m.key} className="macro">
              <div className="macro-top">
                <span>{m.label}</span>
                <span>
                  {formatNumber(v)} / {m.goal} g
                </span>
              </div>
              <span className={`bar ${m.cls}`}>
                <span style={{ width: `${Math.min((v / m.goal) * 100, 100)}%` }} />
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function greeting(name: string) {
  const h = new Date().getHours()
  return `Good ${h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'}, ${name}`
}

export function DiaryView({
  name,
  entries,
  settings,
  onAdd,
  onOpenEntry,
}: {
  /** Shown as a greeting on today's diary. */
  name?: string
  entries: Entry[]
  settings: Settings
  onAdd: (meal: Meal) => void
  onOpenEntry: (entry: Entry) => void
}) {
  const totals = sumNutrients(entries.map(entryNutrients))
  return (
    <>
      {name && <p className="greeting">{greeting(name)}</p>}
      <Summary totals={totals} settings={settings} />
      {MEALS.map((meal) => {
        const items = entries.filter((e) => e.meal === meal.id)
        const kcal = sumNutrients(items.map(entryNutrients))['energy-kcal'] ?? 0
        return (
          <section key={meal.id} className="card meal">
            <header className="meal-header">
              <h2>{meal.label}</h2>
              <span className="meal-kcal">{formatNumber(kcal)} kcal</span>
            </header>
            {items.map((e) => (
              <button key={e.id} className="list-row" onClick={() => onOpenEntry(e)}>
                <FoodThumb food={e.food} />
                <span className="list-row-main">
                  <span className="list-row-title">{e.food.name}</span>
                  <span className="list-row-sub">{describeQuantity(e)}</span>
                </span>
                <span className="list-row-end">{formatNumber(entryNutrients(e)['energy-kcal'] ?? 0)}</span>
              </button>
            ))}
            <button className="add-row" onClick={() => onAdd(meal.id)}>
              <PlusIcon /> Add food
            </button>
          </section>
        )
      })}
    </>
  )
}
