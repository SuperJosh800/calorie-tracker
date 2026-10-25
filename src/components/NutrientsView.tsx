import { dailyTargets, entryNutrients, sumNutrients } from '../nutrients'
import type { Entry, Settings } from '../types'
import { NutrientTable } from './NutrientTable'

export function NutrientsView({ entries, settings }: { entries: Entry[]; settings: Settings }) {
  const totals = sumNutrients(entries.map(entryNutrients))
  return (
    <section className="card">
      <h2 className="card-title">All nutrients</h2>
      {entries.length === 0 ? (
        <p className="hint">Nothing logged for this day yet.</p>
      ) : (
        <>
          <p className="hint">
            Totals from {entries.length} item{entries.length === 1 ? '' : 's'}. Vitamins and minerals only count when the
            product label lists them.
          </p>
          <NutrientTable values={totals} targets={dailyTargets(settings)} />
        </>
      )}
    </section>
  )
}
