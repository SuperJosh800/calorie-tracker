import { useRef, useState, type ReactNode } from 'react'
import { searchCofid } from '../cofid'
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

type Source = 'uk' | 'off' | 'usda'
type SourceResult =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'done'; results: Food[] }
  | { state: 'error'; message: string }
type DietFilter = 'all' | 'vegetarian' | 'vegan'

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
  const [search, setSearch] = useState<({ query: string } & Record<Source, SourceResult>) | null>(null)
  const searchId = useRef(0)
  const [expanded, setExpanded] = useState<Partial<Record<Source, boolean>>>({})
  const [dietFilter, setDietFilter] = useState<DietFilter>('all')

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

  // Each source fills in its own list as soon as it answers: the built-in UK database instantly,
  // Open Food Facts for packaged products (often overloaded), and USDA only on request
  // because its shared demo key allows very few searches an hour.
  const runSource = (source: Source, q: string, id: number) => {
    const update = (result: SourceResult) =>
      id === searchId.current && setSearch((s) => s && { ...s, [source]: result })
    update({ state: 'loading' })
    const promise =
      source === 'uk' ? searchCofid(q) : source === 'off' ? searchOpenFoodFacts(q) : searchUsda(q, usdaApiKey)
    promise.then(
      (results) => update({ state: 'done', results }),
      (err) =>
        update({
          state: 'error',
          message:
            source === 'off'
              ? 'Open Food Facts search is busy right now. Scanning the barcode still works.'
              : source === 'uk'
                ? 'Could not load the UK food database. Check your internet connection and try again.'
                : err instanceof UsdaRateLimitError
                  ? 'The shared USDA search limit has been reached. Add your own free USDA key in Settings to keep searching.'
                  : 'USDA search is unavailable right now. Check your internet connection.',
        }),
    )
  }

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    const id = ++searchId.current
    setSearch({ query: q, uk: { state: 'loading' }, off: { state: 'loading' }, usda: { state: 'idle' } })
    setExpanded({})
    runSource('uk', q, id)
    runSource('off', q, id)
  }

  const dietMatches = (f: Food) =>
    dietFilter === 'all' || (dietFilter === 'vegan' ? f.diet?.vegan === 'yes' : f.diet?.vegetarian === 'yes')

  // Each source shows its top results first so one long list doesn't hide the others.
  const PREVIEW = 8
  const searchSection = (
    source: Source,
    title: string,
    emptyText: string,
    { filter, extra, idle }: { filter?: (f: Food) => boolean; extra?: ReactNode; idle?: ReactNode } = {},
  ) => {
    const result = search![source]
    const results = result.state === 'done' ? result.results.filter(filter ?? (() => true)) : []
    return (
      <section className="search-section">
        <h3 className="section-title">{title}</h3>
        {extra}
        {result.state === 'idle' && idle}
        {result.state === 'loading' && <p className="hint">Searching…</p>}
        {result.state === 'error' && <p className="hint">{result.message}</p>}
        {result.state === 'done' && results.length === 0 && <p className="hint">{emptyText}</p>}
        <div className="list">
          {(expanded[source] ? results : results.slice(0, PREVIEW)).map((f, i) => (
            <FoodRow key={f.id + i} food={f} onClick={() => onPick(f)} />
          ))}
        </div>
        {results.length > PREVIEW && !expanded[source] && (
          <button className="link show-all" onClick={() => setExpanded((x) => ({ ...x, [source]: true }))}>
            Show all {results.length}
          </button>
        )}
      </section>
    )
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
              {searchSection('uk', 'UK foods', 'No UK foods found. Try fewer or simpler words, like "beans".')}
              {searchSection(
                'off',
                'Packaged products',
                dietFilter === 'all' ? 'No packaged products found.' : `No ${dietFilter} products in these results.`,
                {
                  filter: dietMatches,
                  extra: (
                    <div className="segmented small" role="group" aria-label="Diet filter">
                      {(['all', 'vegetarian', 'vegan'] as const).map((d) => (
                        <button
                          key={d}
                          className={dietFilter === d ? 'active' : ''}
                          aria-pressed={dietFilter === d}
                          onClick={() => setDietFilter(d)}
                        >
                          {d === 'all' ? 'All' : d === 'vegan' ? 'Vegan' : 'Vegetarian'}
                        </button>
                      ))}
                    </div>
                  ),
                },
              )}
              {searchSection('usda', 'More generic foods (USDA)', 'No USDA foods found.', {
                idle: (
                  <button className="btn wide" onClick={() => runSource('usda', search.query, searchId.current)}>
                    <SearchIcon /> Search the US database too
                  </button>
                ),
              })}
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
