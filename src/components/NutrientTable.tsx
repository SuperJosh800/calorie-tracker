import { defFor, formatNumber, GROUPS, NUTRIENTS, toDisplay } from '../nutrients'
import type { Nutrients } from '../types'

const ALWAYS_SHOWN = ['energy-kcal', 'fat', 'saturated-fat', 'carbohydrates', 'sugars', 'fiber', 'proteins', 'salt']

/** Every nutrient in `values`, grouped, with % of daily target when one exists. */
export function NutrientTable({ values, targets }: { values: Nutrients; targets?: Record<string, number> }) {
  const keys = new Set([...ALWAYS_SHOWN, ...Object.keys(values)])
  const known = NUTRIENTS.filter((n) => keys.has(n.key))
  const extras = [...keys].filter((k) => !known.some((n) => n.key === k)).sort().map((k) => defFor(k, values[k]))
  const defs = [...known, ...extras]

  return (
    <div className="nutrient-table">
      {GROUPS.map((group) => {
        const rows = defs.filter((d) => d.group === group)
        if (!rows.length) return null
        return (
          <section key={group}>
            <h3>{group}</h3>
            {rows.map((d) => {
              const v = values[d.key]
              const shown = v === undefined ? undefined : toDisplay(d, v)
              const target = targets?.[d.key]
              const pct = shown !== undefined && target ? (shown / target) * 100 : undefined
              return (
                <div key={d.key} className={`nutrient-row${d.sub ? ' sub' : ''}`}>
                  <span className="nutrient-label">{d.label}</span>
                  <span className="nutrient-value">{shown === undefined ? '—' : `${formatNumber(shown)} ${d.unit}`}</span>
                  <span className="nutrient-pct">{pct === undefined ? '' : `${Math.round(pct)}%`}</span>
                  {pct !== undefined && (
                    <span className="nutrient-bar" aria-hidden>
                      <span style={{ width: `${Math.min(pct, 100)}%` }} className={pct > 100 ? 'over' : ''} />
                    </span>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}
      {targets && <p className="hint">% = share of your daily target or the UK adult reference intake.</p>}
    </div>
  )
}
