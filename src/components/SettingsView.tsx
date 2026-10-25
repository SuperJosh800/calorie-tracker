import { Capacitor } from '@capacitor/core'
import { useRef } from 'react'
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, type Entry, type Food, type Profile, type Settings, type WeightEntry } from '../types'
import type { ThemeChoice } from '../theme'
import { USDA_SIGNUP_URL } from '../usda'

export interface Backup {
  entries: Entry[]
  foods: Food[]
  settings: Settings
  profile: Profile
  weights: WeightEntry[]
}

export function SettingsView({
  settings,
  onChange,
  backup,
  onRestore,
  onRestartSetup,
  theme,
  onThemeChange,
}: {
  settings: Settings
  onChange: (s: Settings) => void
  backup: Backup
  onRestore: (b: Backup) => void
  onRestartSetup: () => void
  theme: ThemeChoice
  onThemeChange: (t: ThemeChoice) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const exportData = async () => {
    const json = JSON.stringify(backup, null, 2)
    const name = `calorie-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    if (Capacitor.isNativePlatform()) {
      // The Android app can't download files like a browser, so save it and open the share sheet (Drive, email, Files...).
      const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
      const { uri } = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
      await Share.share({ title: 'Calorie Tracker backup', files: [uri] }).catch(() => {})
      return
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    a.download = name
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as Partial<Backup>
      if (!Array.isArray(data.entries)) throw new Error('missing entries')
      if (!confirm(`Replace your data with ${data.entries.length} entries from this backup?`)) return
      onRestore({
        entries: data.entries,
        foods: data.foods ?? [],
        settings: { ...DEFAULT_SETTINGS, ...data.settings },
        profile: { ...DEFAULT_PROFILE, ...data.profile },
        weights: data.weights ?? [],
      })
    } catch {
      alert('That file is not a Calorie Tracker backup.')
    }
  }

  return (
    <>
      <section className="card">
        <h2 className="card-title">Appearance</h2>
        <div className="segmented" role="radiogroup" aria-label="Theme">
          {(
            [
              ['system', 'System'],
              ['light', 'Light'],
              ['dark', 'Dark'],
            ] as const
          ).map(([value, label]) => (
            <button key={value} role="radio" aria-checked={theme === value} className={theme === value ? 'active' : ''} onClick={() => onThemeChange(value)}>
              {label}
            </button>
          ))}
        </div>
        <p className="hint">System follows your phone's light or dark setting. The moon/sun button at the top switches instantly.</p>
      </section>

      <section className="card">
        <h2 className="card-title">Food search</h2>
        <p className="hint">
          Everyday UK foods come from McCance and Widdowson's UK food database, which is built into the app and always
          works. Packaged products come from Open Food Facts. You can also search the US database (USDA FoodData
          Central); without a key, everyone shares a small demo limit. Get a free personal key at{' '}
          <a href={USDA_SIGNUP_URL} target="_blank" rel="noreferrer">
            fdc.nal.usda.gov
          </a>{' '}
          (it arrives by email straight away) and paste it here for up to 1,000 searches an hour.
        </p>
        <label className="field">
          <span>USDA API key (optional)</span>
          <input
            value={settings.usdaApiKey ?? ''}
            onChange={(e) => onChange({ ...settings, usdaApiKey: e.target.value.trim() || undefined })}
            placeholder="Paste your key"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </label>
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
        <h2 className="card-title">Welcome setup</h2>
        <p className="hint">Go through the first-time questions again to set a new goal. Your diary and weigh-ins are kept.</p>
        <button className="btn" onClick={onRestartSetup}>
          Run the welcome setup again
        </button>
      </section>

      <section className="card">
        <h2 className="card-title">About</h2>
        <p className="hint">
          Product data comes from{' '}
          <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">
            Open Food Facts
          </a>
          , a free food database built by volunteers and available under the Open Database License. If a product is missing,
          you can add it there with their app. UK food data comes from McCance and Widdowson's Composition of Foods
          Integrated Dataset and contains public sector information licensed under the Open Government Licence v3.0.
          US food data comes from USDA FoodData Central (public domain).
        </p>
      </section>
    </>
  )
}
