import { useState } from 'react'
import { hasNutrition, lookupBarcode, searchFoods } from '../openFoodFacts'
import { MEALS, type Food, type Meal } from '../types'
import { FoodRow } from './FoodRow'
import { PlusIcon, SearchIcon } from './icons'
import { Scanner } from './Scanner'
import { Sheet } from './Sheet'

export type AddTab = 'scan' | 'search' | 'recent' | 'mine'

type Lookup =
  | { state: 'idle' }
  | { state: 'loading'; code: string }
  | { state: 'notFound'; code: string }
  | { state: 'error'; code: string; message: string }

export function AddFoodSheet({
  meal,
  initialTab,
  recentFoods,
  myFoods,
  onPick,
  onCreate,
  onClose,
}: {
  meal: Meal
  initialTab: AddTab
  recentFoods: Food[]
  myFoods: Food[]
  onPick: (food: Food) => void
  onCreate: (initial?: Partial<Food>, notice?: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<AddTab>(initialTab)
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' })
  const [scanKey, setScanKey] = useState(0)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<{ loading: boolean; results?: Food[]; error?: string }>({ loading: false })

  const handleBarcode = async (code: string) => {
    const mine = myFoods.find((f) => f.barcode === code)
    if (mine) return onPick(mine)
    setLookup({ state: 'loading', code })
    try {
      const food = await lookupBarcode(code)
      if (!food) return setLookup({ state: 'notFound', code })
      if (!hasNutrition(food)) {
        return onCreate(
          { name: food.name, brand: food.brand, barcode: code, imageUrl: food.imageUrl, servingSize: food.servingSize, basis: food.basis },
          'This product has no nutrition info in Open Food Facts yet. Copy it from the label.',
        )
      }
      onPick(food)
    } catch (e) {
      setLookup({ state: 'error', code, message: (e as Error).message })
    }
  }

  const rescan = () => {
    setLookup({ state: 'idle' })
    setScanKey((k) => k + 1)
  }

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearch({ loading: true })
    try {
      setSearch({ loading: false, results: await searchFoods(query) })
    } catch {
      setSearch({
        loading: false,
        error: 'Open Food Facts search is busy right now. Try again in a minute, scan the barcode, or create the food yourself.',
      })
    }
  }

  const mealLabel = MEALS.find((m) => m.id === meal)?.label

  return (
    <Sheet title={`Add to ${mealLabel}`} onClose={onClose}>
      <div className="tabs" role="tablist">
        {(
          [
            ['scan', 'Scan'],
            ['search', 'Search'],
            ['recent', 'Recent'],
            ['mine', 'My foods'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'scan' &&
        (lookup.state === 'idle' ? (
          <Scanner key={scanKey} onDetected={handleBarcode} />
        ) : (
          <div className="empty">
            {lookup.state === 'loading' && <p>Looking up {lookup.code}…</p>}
            {lookup.state === 'notFound' && (
              <>
                <p>
                  Barcode <strong>{lookup.code}</strong> isn't in the Open Food Facts database yet.
                </p>
                <button className="btn primary" onClick={() => onCreate({ barcode: lookup.code })}>
                  Add it from the label
                </button>
              </>
            )}
            {lookup.state === 'error' && (
              <p>
                Couldn't look up {lookup.code}: {lookup.message}. Check your internet connection.
              </p>
            )}
            {lookup.state !== 'loading' && (
              <button className="btn" onClick={rescan}>
                Scan again
              </button>
            )}
          </div>
        ))}

      {tab === 'search' && (
        <>
          <form className="row-form" onSubmit={runSearch}>
            <input
              type="search"
              placeholder="e.g. Heinz baked beans"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search foods"
              autoFocus
            />
            <button className="btn primary" type="submit" aria-label="Search" disabled={search.loading}>
              <SearchIcon />
            </button>
          </form>
          {search.loading && <p className="hint center">Searching…</p>}
          {search.error && <p className="notice">{search.error}</p>}
          {search.results?.length === 0 && <p className="hint center">No results.</p>}
          <div className="list">
            {search.results?.map((f, i) => <FoodRow key={f.id + i} food={f} onClick={() => onPick(f)} />)}
          </div>
        </>
      )}

      {tab === 'recent' && (
        <div className="list">
          {recentFoods.length === 0 && <p className="hint center">Foods you log will show up here.</p>}
          {recentFoods.map((f) => (
            <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />
          ))}
        </div>
      )}

      {tab === 'mine' && (
        <>
          <button className="btn wide" onClick={() => onCreate()}>
            <PlusIcon /> Create a food
          </button>
          <div className="list">
            {myFoods.length === 0 && <p className="hint center">Foods you create will show up here.</p>}
            {myFoods.map((f) => (
              <FoodRow key={f.id} food={f} onClick={() => onPick(f)} />
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}
