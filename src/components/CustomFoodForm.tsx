import { useState } from 'react'
import { formatNumber, fromDisplay, NUTRIENTS, toDisplay } from '../nutrients'
import type { Food, Nutrients } from '../types'
import { uid } from '../util'
import { Sheet } from './Sheet'

const MAIN = ['energy-kcal', 'fat', 'saturated-fat', 'carbohydrates', 'sugars', 'fiber', 'proteins', 'salt']

/** Create or edit a food from its nutrition label (values per 100 g/ml). */
export function CustomFoodForm({
  initial,
  notice,
  onSave,
  onClose,
}: {
  initial?: Partial<Food>
  notice?: string
  onSave: (food: Food) => void
  onClose: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [barcode, setBarcode] = useState(initial?.barcode ?? '')
  const [basis, setBasis] = useState<Food['basis']>(initial?.basis ?? 'g')
  const [serving, setServing] = useState(initial?.servingSize ? String(initial.servingSize) : '')
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(initial?.nutrients ?? {})) {
      const d = NUTRIENTS.find((n) => n.key === k)
      if (d) out[k] = formatNumber(toDisplay(d, v))
    }
    return out
  })
  const [showMore, setShowMore] = useState(() => Object.keys(values).some((k) => !MAIN.includes(k)))

  const num = (s: string | undefined) => (s === undefined || s.trim() === '' ? undefined : Number(s.replace(',', '.')))
  const kcal = num(values['energy-kcal'])
  const valid = name.trim() !== '' && kcal !== undefined && kcal >= 0

  const save = () => {
    const nutrients: Nutrients = {}
    for (const d of NUTRIENTS) {
      const v = num(values[d.key])
      if (v !== undefined && Number.isFinite(v)) nutrients[d.key] = fromDisplay(d, v)
    }
    if (nutrients.salt !== undefined) nutrients.sodium = nutrients.salt / 2.5
    else if (nutrients.sodium !== undefined) nutrients.salt = nutrients.sodium * 2.5
    const servingSize = num(serving)
    const code = barcode.replace(/\D/g, '') || undefined
    onSave({
      id: initial?.source === 'custom' && initial.id ? initial.id : code ? `custom:${code}` : uid(),
      name: name.trim(),
      brand: brand.trim() || undefined,
      barcode: code,
      imageUrl: initial?.imageUrl,
      basis,
      servingSize: servingSize && servingSize > 0 ? servingSize : undefined,
      servingLabel: servingSize && servingSize > 0 ? `${formatNumber(servingSize)} ${basis}` : undefined,
      nutrients,
      source: 'custom',
    })
  }

  const fields = NUTRIENTS.filter((d) => showMore || MAIN.includes(d.key))

  return (
    <Sheet
      title={initial?.source === 'custom' ? 'Edit food' : 'Create food'}
      onClose={onClose}
      footer={
        <button className="btn primary grow" disabled={!valid} onClick={save}>
          Save food
        </button>
      }
    >
      {notice && <p className="notice">{notice}</p>}
      <label className="field">
        <span>Name *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Porridge oats" />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Brand</span>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} />
        </label>
        <label className="field">
          <span>Barcode</span>
          <input inputMode="numeric" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </label>
      </div>
      <div className="field-row">
        <label className="field">
          <span>Measured in</span>
          <select value={basis} onChange={(e) => setBasis(e.target.value as Food['basis'])}>
            <option value="g">grams (g)</option>
            <option value="ml">millilitres (ml)</option>
          </select>
        </label>
        <label className="field">
          <span>Serving size ({basis})</span>
          <input inputMode="decimal" value={serving} onChange={(e) => setServing(e.target.value)} placeholder="optional" />
        </label>
      </div>

      <h3 className="section-title">Nutrition per 100 {basis}</h3>
      <div className="nutrient-inputs">
        {fields.map((d) => (
          <label key={d.key} className={`field inline${d.sub ? ' sub' : ''}`}>
            <span>
              {d.label}
              {d.key === 'energy-kcal' ? ' *' : ''}
            </span>
            <span className="input-unit">
              <input
                inputMode="decimal"
                value={values[d.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [d.key]: e.target.value }))}
              />
              <small>{d.unit}</small>
            </span>
          </label>
        ))}
      </div>
      <button className="btn wide" onClick={() => setShowMore((s) => !s)}>
        {showMore ? 'Show fewer nutrients' : 'More nutrients (vitamins, minerals…)'}
      </button>
    </Sheet>
  )
}
