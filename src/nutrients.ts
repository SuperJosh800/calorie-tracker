import type { Entry, Nutrients, Settings } from './types'

export type DisplayUnit = 'kcal' | 'g' | 'mg' | 'µg'
export type NutrientGroup = 'Energy & macros' | 'Vitamins' | 'Minerals' | 'Other'

export interface NutrientDef {
  key: string
  label: string
  unit: DisplayUnit
  group: NutrientGroup
  /** UK/EU reference intake for an adult, in `unit`. */
  ri?: number
  sub?: boolean
}

const def = (
  key: string,
  label: string,
  unit: DisplayUnit,
  group: NutrientGroup,
  ri?: number,
  sub = false,
): NutrientDef => ({ key, label, unit, group, ri, sub })

const M = 'Energy & macros'
const V = 'Vitamins'
const MIN = 'Minerals'
const O = 'Other'

export const NUTRIENTS: NutrientDef[] = [
  def('energy-kcal', 'Energy', 'kcal', M, 2000),
  def('fat', 'Fat', 'g', M, 70),
  def('saturated-fat', 'Saturates', 'g', M, 20, true),
  def('monounsaturated-fat', 'Monounsaturates', 'g', M, undefined, true),
  def('polyunsaturated-fat', 'Polyunsaturates', 'g', M, undefined, true),
  def('omega-3-fat', 'Omega-3', 'g', M, undefined, true),
  def('omega-6-fat', 'Omega-6', 'g', M, undefined, true),
  def('trans-fat', 'Trans fat', 'g', M, undefined, true),
  def('cholesterol', 'Cholesterol', 'mg', M),
  def('carbohydrates', 'Carbohydrate', 'g', M, 260),
  def('sugars', 'Sugars', 'g', M, 90, true),
  def('added-sugars', 'Added sugars', 'g', M, undefined, true),
  def('starch', 'Starch', 'g', M, undefined, true),
  def('polyols', 'Polyols', 'g', M, undefined, true),
  def('fiber', 'Fibre', 'g', M, 30),
  def('proteins', 'Protein', 'g', M, 50),
  def('salt', 'Salt', 'g', M, 6),
  def('sodium', 'Sodium', 'mg', M, 2400, true),

  def('vitamin-a', 'Vitamin A', 'µg', V, 800),
  def('vitamin-d', 'Vitamin D', 'µg', V, 5),
  def('vitamin-e', 'Vitamin E', 'mg', V, 12),
  def('vitamin-k', 'Vitamin K', 'µg', V, 75),
  def('vitamin-c', 'Vitamin C', 'mg', V, 80),
  def('vitamin-b1', 'Thiamin (B1)', 'mg', V, 1.1),
  def('vitamin-b2', 'Riboflavin (B2)', 'mg', V, 1.4),
  def('vitamin-pp', 'Niacin (B3)', 'mg', V, 16),
  def('pantothenic-acid', 'Pantothenic acid (B5)', 'mg', V, 6),
  def('vitamin-b6', 'Vitamin B6', 'mg', V, 1.4),
  def('biotin', 'Biotin (B7)', 'µg', V, 50),
  def('vitamin-b9', 'Folate (B9)', 'µg', V, 200),
  def('vitamin-b12', 'Vitamin B12', 'µg', V, 2.5),

  def('potassium', 'Potassium', 'mg', MIN, 2000),
  def('calcium', 'Calcium', 'mg', MIN, 800),
  def('phosphorus', 'Phosphorus', 'mg', MIN, 700),
  def('magnesium', 'Magnesium', 'mg', MIN, 375),
  def('iron', 'Iron', 'mg', MIN, 14),
  def('zinc', 'Zinc', 'mg', MIN, 10),
  def('copper', 'Copper', 'mg', MIN, 1),
  def('manganese', 'Manganese', 'mg', MIN, 2),
  def('selenium', 'Selenium', 'µg', MIN, 55),
  def('iodine', 'Iodine', 'µg', MIN, 150),
  def('chloride', 'Chloride', 'mg', MIN, 800),
  def('fluoride', 'Fluoride', 'mg', MIN, 3.5),
  def('chromium', 'Chromium', 'µg', MIN, 40),
  def('molybdenum', 'Molybdenum', 'µg', MIN, 50),

  def('caffeine', 'Caffeine', 'mg', O),
]

export const NUTRIENT_BY_KEY = new Map(NUTRIENTS.map((n) => [n.key, n]))
export const GROUPS: NutrientGroup[] = [M, V, MIN, O]

const FACTOR: Record<DisplayUnit, number> = { kcal: 1, g: 1, mg: 1e3, 'µg': 1e6 }

/** Definition for any nutrient key, including ones we don't know (shown under "Other"). */
export function defFor(key: string, sampleValue = 1): NutrientDef {
  const known = NUTRIENT_BY_KEY.get(key)
  if (known) return known
  const label = key.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
  const unit: DisplayUnit = sampleValue >= 1 ? 'g' : sampleValue >= 0.001 ? 'mg' : 'µg'
  return def(key, label, unit, O)
}

export const toDisplay = (d: NutrientDef, value: number) => value * FACTOR[d.unit]
export const fromDisplay = (d: NutrientDef, value: number) => value / FACTOR[d.unit]

export function formatNumber(v: number): string {
  const a = Math.abs(v)
  if (a === 0) return '0'
  if (a < 0.01) return '<0.01'
  if (a >= 100) return String(Math.round(v))
  if (a >= 1) return String(Math.round(v * 10) / 10)
  return String(Math.round(v * 100) / 100)
}

export function formatNutrient(d: NutrientDef, value: number): string {
  return `${formatNumber(toDisplay(d, value))} ${d.unit}`
}

export function scaleNutrients(per100: Nutrients, amount: number): Nutrients {
  const out: Nutrients = {}
  for (const [k, v] of Object.entries(per100)) out[k] = (v * amount) / 100
  return out
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = {}
  for (const n of list) for (const [k, v] of Object.entries(n)) out[k] = (out[k] ?? 0) + v
  return out
}

/** Amount of an entry in grams/ml. */
export function entryAmount(e: Pick<Entry, 'quantity' | 'unit' | 'food'>): number {
  return e.unit === 'serving' ? e.quantity * (e.food.servingSize ?? 100) : e.quantity
}

export const entryNutrients = (e: Entry) => scaleNutrients(e.food.nutrients, entryAmount(e))

export function describeQuantity(e: Pick<Entry, 'quantity' | 'unit' | 'food'>): string {
  if (e.unit === 'serving') {
    const n = formatNumber(e.quantity)
    return `${n} serving${e.quantity === 1 ? '' : 's'} (${formatNumber(entryAmount(e))} ${e.food.basis})`
  }
  return `${formatNumber(e.quantity)} ${e.food.basis}`
}

/** Daily targets in display units, with the user's own goals replacing the default reference intakes. */
export function dailyTargets(s: Settings): Record<string, number> {
  const t: Record<string, number> = {}
  for (const n of NUTRIENTS) if (n.ri) t[n.key] = n.ri
  t['energy-kcal'] = s.calorieGoal
  t.proteins = s.proteinGoal
  t.carbohydrates = s.carbsGoal
  t.fat = s.fatGoal
  return t
}
