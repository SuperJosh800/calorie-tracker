import { useRef, useState } from 'react'
import { hasNutrition, lookupBarcode, searchOpenFoodFacts } from '../openFoodFacts'
import { MEALS, type Food, type Meal } from '../types'
import { searchUsda, UsdaRateLimitError } from '../usda'
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

type SourceResult = { state: 'loading' } | { state: 'done'; results: Food[] } | { state: 'error'; message: string }

export function AddFoodSheet({
  meal,
  initialTab,
  recentFoods,
  myFoods,
  usdaApiKey,
  onPick,
  onCreate,
  onClose,
}: {
  meal: Meal
  initialTab: AddTab
  recentFoods: Food[]
  myFoods: Food[]
  usdaApiKey?: string
  onPick: (food: Food) => void
  onCreate: (initial?: Partial<Food>, notice?: string) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<AddTab>(initialTab)
  const [lookup, setLookup] = useState<Lookup>({ state: 'idle' })
  const [scanKey, setScanKey] = useState(0)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState<{ off: SourceResult; usda: SourceResult } | null>(null)
  const searchId = useRef(0)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

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

  // Both sources are queried at once and each list shows as soon as it arrives:
  // Open Food Facts for packaged products (often overloaded), USDA for generic foods.
  const runSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    const id = ++searchId.current
    setSearch({ off: { state: 'loading' }, usda: { state: 'loading' } })
    setExpanded({})
    const run = (source: 'off' | 'usda', promise: Promise<Food[]>, errorMessage: (e: unknown) => string) =>
      promise.then(
        (results) => id === searchId.current && setSearch((s) => s && { ...s, [source]: { state: 'done', results } }),
        (err) =>
          id === searchId.current && setSearch((s) => s && { ...s, [source]: { state: 'error', message: errorMessage(err) } }),
      )
    run('off', searchOpenFoodFacts(query), () => 'Open Food Facts search is busy right now. Scanning the barcode still works.')
    run('usda', searchUsda(query, usdaApiKey), (err) =>
      err instanceof UsdaRateLimitError
        ? 'The shared USDA search limit has been reached. Add your own free USDA key in Settings to keep searching.'
        : 'Generic food search is unavailable right now. Check your internet connection.',
    )
  }

  // Each source shows its top results first so one long list doesn't hide the other.
  const PREVIEW = 8
  const searchSection = (title: string, result: SourceResult, emptyText: string) => (
    <section className="search-section">
      <h3 className="section-title">{title}</h3>
      {result.state === 'loading' && <p className="hint">Searching…</p>}
      {result.state === 'error' && <p className="hint">{result.message}</p>}
      {result.state === 'done' && result.results.length === 0 && <p className="hint">{emptyText}</p>}
      {result.state === 'done' && (
        <div className="list">
          {(expanded[title] ? result.results : result.results.slice(0, PREVIEW)).map((f, i) => (
            <FoodRow key={f.id + i} food={f} onClick={() => onPick(f)} />
          ))}
        </div>
      )}
      {result.state === 'done' && result.results.length > PREVIEW && !expanded[title] && (
        <button className="link show-all" onClick={() => setExpanded((x) => ({ ...x, [title]: true }))}>
          Show all {result.results.length}
        </button>
      )}
    </section>
  )

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
              placeholder="e.g. banana or Heinz beans"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search foods"
              autoFocus
            />
            <button className="btn primary" type="submit" aria-label="Search">
              <SearchIcon />
            </button>
          </form>
          {search && (
            <>
              {searchSection('Packaged products', search.off, 'No packaged products found.')}
              {searchSection('Generic foods', search.usda, 'No generic foods found.')}
            </>
          )}
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
