import { useState } from 'react'
import { entryAmount, formatNumber, scaleNutrients } from '../nutrients'
import { MEALS, type Entry, type Food, type Meal } from '../types'
import { DietBadge, FoodThumb } from './FoodRow'
import { NutrientTable } from './NutrientTable'
import { Sheet } from './Sheet'

/** Shows a food's nutrients and lets the user choose an amount and meal, for a new or existing entry. */
export function FoodSheet({
  food,
  meal: initialMeal,
  entry,
  targets,
  onSave,
  onDelete,
  onEditFood,
  onClose,
}: {
  food: Food
  meal: Meal
  entry?: Entry
  targets: Record<string, number>
  onSave: (meal: Meal, quantity: number, unit: Entry['unit']) => void
  onDelete?: () => void
  onEditFood?: () => void
  onClose: () => void
}) {
  const [meal, setMeal] = useState<Meal>(entry?.meal ?? initialMeal)
  const [unit, setUnit] = useState<Entry['unit']>(entry?.unit ?? (food.servingSize ? 'serving' : 'base'))
  const [qty, setQty] = useState(String(entry?.quantity ?? (food.servingSize ? 1 : 100)))
  const [view, setView] = useState<'amount' | 'per100'>('amount')

  const quantity = Number(qty.replace(',', '.'))
  const valid = quantity > 0 && Number.isFinite(quantity)
  const amount = valid ? entryAmount({ quantity, unit, food }) : 0
  const values = view === 'amount' ? scaleNutrients(food.nutrients, amount) : food.nutrients
  const n = (k: string) => formatNumber(values[k] ?? 0)

  const changeUnit = (next: Entry['unit']) => {
    if (next === unit || !food.servingSize) return
    // Keep the same amount of food when switching units.
    const converted = next === 'serving' ? amount / food.servingSize : amount
    setQty(valid ? formatNumber(converted) : next === 'serving' ? '1' : '100')
    setUnit(next)
  }

  return (
    <Sheet
      title={entry ? 'Edit entry' : 'Add food'}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <button className="btn danger" onClick={onDelete}>
              Delete
            </button>
          )}
          <button className="btn primary grow" disabled={!valid} onClick={() => onSave(meal, quantity, unit)}>
            {entry ? 'Save' : `Add ${valid ? formatNumber(values['energy-kcal'] ?? 0) : 0} kcal`}
          </button>
        </>
      }
    >
      <div className="food-head">
        <FoodThumb food={food} />
        <div>
          <h3>{food.name}</h3>
          <DietBadge diet={food.diet} />
          <p className="hint">
            {[food.brand, food.barcode && `Barcode ${food.barcode}`].filter(Boolean).join(' · ')}
            {onEditFood && (
              <>
                {' '}
                <button className="link" onClick={onEditFood}>
                  Edit food
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Amount</span>
          <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} onFocus={(e) => e.target.select()} />
        </label>
        <label className="field">
          <span>Unit</span>
          <select value={unit} onChange={(e) => changeUnit(e.target.value as Entry['unit'])} disabled={!food.servingSize}>
            <option value="base">{food.basis}</option>
            {food.servingSize && <option value="serving">servings</option>}
          </select>
        </label>
      </div>
      {food.servingSize && (
        <p className="hint field-hint">
          1 serving = {formatNumber(food.servingSize)} {food.basis}
          {food.servingLabel && food.servingLabel !== `${formatNumber(food.servingSize)} ${food.basis}`
            ? ` (${food.servingLabel})`
            : ''}
        </p>
      )}
      <div className="field-row">
        <label className="field">
          <span>Meal</span>
          <select value={meal} onChange={(e) => setMeal(e.target.value as Meal)}>
            {MEALS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="segmented" role="tablist">
        <button className={view === 'amount' ? 'active' : ''} onClick={() => setView('amount')}>
          {valid ? `${formatNumber(amount)} ${food.basis}` : 'This amount'}
        </button>
        <button className={view === 'per100' ? 'active' : ''} onClick={() => setView('per100')}>
          Per 100 {food.basis}
        </button>
      </div>

      <div className="macro-chips">
        <div className="chip kcal">
          <strong>{n('energy-kcal')}</strong>
          <span>kcal</span>
        </div>
        <div className="chip protein">
          <strong>{n('proteins')} g</strong>
          <span>Protein</span>
        </div>
        <div className="chip carbs">
          <strong>{n('carbohydrates')} g</strong>
          <span>Carbs</span>
        </div>
        <div className="chip fat">
          <strong>{n('fat')} g</strong>
          <span>Fat</span>
        </div>
      </div>

      <NutrientTable values={values} targets={view === 'amount' ? targets : undefined} />
      {food.diet && (
        <p className="hint">
          Vegan/vegetarian status comes from the product's labels or an automatic check of its ingredients list, so treat
          it as a guide and check the pack.
        </p>
      )}
      {food.source === 'off' && (
        <p className="hint">
          Data from{' '}
          <a href={`https://world.openfoodfacts.org/product/${food.barcode}`} target="_blank" rel="noreferrer">
            Open Food Facts
          </a>
          .
        </p>
      )}
      {food.source === 'cofid' && (
        <p className="hint">
          UK data from McCance and Widdowson's{' '}
          <a href="https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid" target="_blank" rel="noreferrer">
            Composition of Foods Integrated Dataset
          </a>
          . Contains public sector information licensed under the Open Government Licence v3.0.
        </p>
      )}
      {food.source === 'usda' && (
        <p className="hint">
          Generic data from{' '}
          <a href={`https://fdc.nal.usda.gov/food-details/${food.id.slice('usda:'.length)}/nutrients`} target="_blank" rel="noreferrer">
            USDA FoodData Central
          </a>
          .
        </p>
      )}
    </Sheet>
  )
}
