import { useRef } from 'react'
import { DEFAULT_SETTINGS, type Entry, type Food, type Settings } from '../types'

export interface Backup {
  entries: Entry[]
  foods: Food[]
  settings: Settings
}

export function SettingsView({
  settings,
  onChange,
  backup,
  onRestore,
}: {
  settings: Settings
  onChange: (s: Settings) => void
  backup: Backup
  onRestore: (b: Backup) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const goals: [keyof Settings, string, string][] = [
    ['calorieGoal', 'Calories', 'kcal'],
    ['proteinGoal', 'Protein', 'g'],
    ['carbsGoal', 'Carbohydrate', 'g'],
    ['fatGoal', 'Fat', 'g'],
  ]

  const exportData = () => {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `calorie-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Partial<Backup>
      if (!Array.isArray(data.entries)) throw new Error('missing entries')
      if (!confirm(`Replace your data with ${data.entries.length} entries from this backup?`)) return
      onRestore({ entries: data.entries, foods: data.foods ?? [], settings: { ...DEFAULT_SETTINGS, ...data.settings } })
    } catch {
      alert('That file is not a Calorie Tracker backup.')
    }
  }

  return (
    <>
      <section className="card">
        <h2 className="card-title">Daily goals</h2>
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
        <p className="hint">Defaults are UK adult reference intakes. Other vitamins and minerals use UK reference intakes.</p>
      </section>

      <section className="card">
        <h2 className="card-title">Your data</h2>
        <p className="hint">
          Everything is stored on this phone only. Export a backup now and then, or to move to a new phone.
        </p>
        <div className="button-row">
          <button className="btn" onClick={exportData}>
            Export backup
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importData(file)
              e.target.value = ''
            }}
          />
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">About</h2>
        <p className="hint">
          Product data comes from{' '}
          <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">
            Open Food Facts
          </a>
          , a free food database built by volunteers and available under the Open Database License. If a product is missing,
          you can add it there with their app.
        </p>
      </section>
    </>
  )
}
