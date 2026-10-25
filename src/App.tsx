import { useEffect, useMemo, useState } from 'react'
import { AddFoodSheet, type AddTab } from './components/AddFoodSheet'
import { CustomFoodForm } from './components/CustomFoodForm'
import { DiaryView } from './components/DiaryView'
import { GoalsView } from './components/GoalsView'
import { FoodSheet } from './components/FoodSheet'
import {
  BookIcon,
  ChartIcon,
  ChevronLeft,
  ChevronRight,
  GearIcon,
  MoonIcon,
  ScanIcon,
  SunIcon,
  TargetIcon,
} from './components/icons'
import { NutrientsView } from './components/NutrientsView'
import { Onboarding } from './components/Onboarding'
import { SettingsView } from './components/SettingsView'
import { dailyTargets } from './nutrients'
import { useTheme } from './theme'
import {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  type Entry,
  type Food,
  type Meal,
  type Profile,
  type Settings,
  type WeightEntry,
} from './types'
import { dateKey, formatDateLabel, mealForNow, shiftDate, uid, usePersistentState } from './util'

type Tab = 'diary' | 'nutrients' | 'goals' | 'settings'
type SheetState =
  | { kind: 'add'; meal: Meal; tab: AddTab }
  | { kind: 'food'; food: Food; meal: Meal; entry?: Entry }
  | { kind: 'custom'; meal: Meal; initial?: Partial<Food>; notice?: string }

export default function App() {
  const [entries, setEntries] = usePersistentState<Entry[]>('ct.entries', [])
  const [myFoods, setMyFoods] = usePersistentState<Food[]>('ct.foods', [])
  const [storedSettings, setSettings] = usePersistentState<Settings>('ct.settings', DEFAULT_SETTINGS)
  const settings = { ...DEFAULT_SETTINGS, ...storedSettings }
  const [storedProfile, setProfile] = usePersistentState<Profile>('ct.profile', DEFAULT_PROFILE)
  const profile = { ...DEFAULT_PROFILE, ...storedProfile }
  const [weights, setWeights] = usePersistentState<WeightEntry[]>('ct.weights', [])
  const theme = useTheme()
  const [date, setDate] = useState(() => dateKey(new Date()))
  const [tab, setTab] = useState<Tab>('diary')
  const [sheet, setSheet] = useState<SheetState | null>(null)

  useEffect(() => {
    // Ask the browser not to evict our data when the phone is low on storage.
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  const dayEntries = useMemo(
    () => entries.filter((e) => e.date === date).sort((a, b) => a.createdAt - b.createdAt),
    [entries, date],
  )
  const recentFoods = useMemo(() => {
    const seen = new Set<string>()
    const out: Food[] = []
    for (const e of [...entries].sort((a, b) => b.createdAt - a.createdAt)) {
      if (seen.has(e.food.id)) continue
      seen.add(e.food.id)
      out.push(e.food)
      if (out.length >= 30) break
    }
    return out
  }, [entries])

  const saveEntry = (food: Food, meal: Meal, quantity: number, unit: Entry['unit'], existing?: Entry) => {
    if (existing) {
      setEntries((list) => list.map((e) => (e.id === existing.id ? { ...e, meal, quantity, unit } : e)))
    } else {
      setEntries((list) => [...list, { id: uid(), date, meal, food, quantity, unit, createdAt: Date.now() }])
    }
    setSheet(null)
    setTab('diary')
  }

  const saveMyFood = (food: Food, meal: Meal) => {
    setMyFoods((list) => [food, ...list.filter((f) => f.id !== food.id)])
    setSheet({ kind: 'food', food, meal })
  }

  if (!profile.onboarded) {
    const latest = [...weights].sort((a, b) => a.date.localeCompare(b.date)).at(-1)
    return (
      <div className="app">
        <Onboarding
          initialProfile={profile}
          initialWeightKg={latest?.kg}
          onFinish={(p, kg, goals) => {
            const today = dateKey(new Date())
            setProfile({ ...p, name: p.name?.trim() })
            setWeights((list) => [...list.filter((w) => w.date !== today), { date: today, kg }])
            setSettings({ ...settings, ...goals })
            setTab('diary')
          }}
          onSkip={() => setProfile({ ...profile, onboarded: true })}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="topbar">
        {tab === 'settings' || tab === 'goals' ? (
          <h1>{tab === 'goals' ? 'Goals' : 'Settings'}</h1>
        ) : (
          <div className="date-nav">
            <button className="icon-btn" onClick={() => setDate((d) => shiftDate(d, -1))} aria-label="Previous day">
              <ChevronLeft />
            </button>
            <button className="date-label" onClick={() => setDate(dateKey(new Date()))}>
              {formatDateLabel(date)}
            </button>
            <button className="icon-btn" onClick={() => setDate((d) => shiftDate(d, 1))} aria-label="Next day">
              <ChevronRight />
            </button>
          </div>
        )}
        <button
          className="icon-btn theme-btn"
          onClick={() => theme.setChoice(theme.resolved === 'dark' ? 'light' : 'dark')}
          aria-label={theme.resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme.resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>

      <main className="content">
        {tab === 'diary' && (
          <DiaryView
            name={date === dateKey(new Date()) ? profile.name : undefined}
            entries={dayEntries}
            settings={settings}
            onAdd={(meal) => setSheet({ kind: 'add', meal, tab: 'scan' })}
            onOpenEntry={(entry) => setSheet({ kind: 'food', food: entry.food, meal: entry.meal, entry })}
          />
        )}
        {tab === 'nutrients' && <NutrientsView entries={dayEntries} settings={settings} />}
        {tab === 'goals' && (
          <GoalsView
            profile={profile}
            onProfileChange={setProfile}
            weights={weights}
            onWeightsChange={setWeights}
            entries={entries}
            settings={settings}
            onSettingsChange={setSettings}
          />
        )}
        {tab === 'settings' && (
          <SettingsView
            settings={settings}
            onChange={setSettings}
            backup={{ entries, foods: myFoods, settings, profile, weights }}
            onRestartSetup={() => setProfile({ ...profile, onboarded: false })}
            theme={theme.choice}
            onThemeChange={theme.setChoice}
            onRestore={(b) => {
              setEntries(b.entries)
              setMyFoods(b.foods)
              setSettings(b.settings)
              setProfile(b.profile)
              setWeights(b.weights)
            }}
          />
        )}
      </main>

      <nav className="tabbar">
        <button className={tab === 'diary' ? 'active' : ''} onClick={() => setTab('diary')}>
          <BookIcon />
          <span>Diary</span>
        </button>
        <button className={tab === 'nutrients' ? 'active' : ''} onClick={() => setTab('nutrients')}>
          <ChartIcon />
          <span>Nutrients</span>
        </button>
        <button className="scan-btn" onClick={() => setSheet({ kind: 'add', meal: mealForNow(), tab: 'scan' })}>
          <span className="scan-circle">
            <ScanIcon />
          </span>
          <span>Scan</span>
        </button>
        <button className={tab === 'goals' ? 'active' : ''} onClick={() => setTab('goals')}>
          <TargetIcon />
          <span>Goals</span>
        </button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>
          <GearIcon />
          <span>Settings</span>
        </button>
      </nav>

      {sheet?.kind === 'add' && (
        <AddFoodSheet
          meal={sheet.meal}
          initialTab={sheet.tab}
          recentFoods={recentFoods}
          myFoods={myFoods}
          usdaApiKey={settings.usdaApiKey}
          onPick={(food) => setSheet({ kind: 'food', food, meal: sheet.meal })}
          onCreate={(initial, notice) => setSheet({ kind: 'custom', meal: sheet.meal, initial, notice })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'food' && (
        <FoodSheet
          key={sheet.food.id + (sheet.entry?.id ?? '')}
          food={sheet.food}
          meal={sheet.meal}
          entry={sheet.entry}
          targets={dailyTargets(settings)}
          onSave={(meal, quantity, unit) => saveEntry(sheet.food, meal, quantity, unit, sheet.entry)}
          onDelete={
            sheet.entry
              ? () => {
                  const id = sheet.entry!.id
                  setEntries((list) => list.filter((e) => e.id !== id))
                  setSheet(null)
                }
              : undefined
          }
          onEditFood={
            !sheet.entry && sheet.food.source === 'custom'
              ? () => setSheet({ kind: 'custom', meal: sheet.meal, initial: sheet.food })
              : undefined
          }
          onClose={() => setSheet(null)}
        />
      )}
      {sheet?.kind === 'custom' && (
        <CustomFoodForm
          initial={sheet.initial}
          notice={sheet.notice}
          onSave={(food) => saveMyFood(food, sheet.meal)}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
