import type { Food, Nutrients } from './types'
import { rankByName } from './util'

/**
 * USDA FoodData Central: free, public-domain data for generic foods (fruit, meat, rice…),
 * with full vitamin and mineral data. It allows browser requests, unlike Open Food Facts search.
 * The shared DEMO_KEY is heavily rate-limited; a free personal key raises the limit to 1,000 an hour.
 */
export const USDA_SIGNUP_URL = 'https://fdc.nal.usda.gov/api-key-signup'

export class UsdaRateLimitError extends Error {}

// USDA nutrient number -> our nutrient key. Values in search results are per 100 g.
const NUTRIENT_NUMBERS: Record<string, string> = {
  '204': 'fat',
  '606': 'saturated-fat',
  '645': 'monounsaturated-fat',
  '646': 'polyunsaturated-fat',
  '605': 'trans-fat',
  '601': 'cholesterol',
  '205': 'carbohydrates',
  '269': 'sugars',
  '209': 'starch',
  '291': 'fiber',
  '203': 'proteins',
  '307': 'sodium',
  '320': 'vitamin-a',
  '328': 'vitamin-d',
  '323': 'vitamin-e',
  '430': 'vitamin-k',
  '401': 'vitamin-c',
  '404': 'vitamin-b1',
  '405': 'vitamin-b2',
  '406': 'vitamin-pp',
  '410': 'pantothenic-acid',
  '415': 'vitamin-b6',
  '417': 'vitamin-b9',
  '418': 'vitamin-b12',
  '306': 'potassium',
  '301': 'calcium',
  '305': 'phosphorus',
  '304': 'magnesium',
  '303': 'iron',
  '309': 'zinc',
  '312': 'copper',
  '315': 'manganese',
  '317': 'selenium',
  '262': 'caffeine',
}
const TO_GRAMS: Record<string, number> = { G: 1, MG: 1e-3, UG: 1e-6 }

type UsdaFood = {
  fdcId: number
  description: string
  foodNutrients?: { nutrientNumber?: string; unitName?: string; value?: number }[]
  foodMeasures?: { disseminationText?: string; gramWeight?: number }[]
}

function toFood(f: UsdaFood): Food {
  const nutrients: Nutrients = {}
  const energy: Record<string, number> = {}
  for (const n of f.foodNutrients ?? []) {
    if (!n.nutrientNumber || typeof n.value !== 'number') continue
    const unit = n.unitName?.toUpperCase() ?? ''
    if (unit === 'KCAL' || unit === 'KJ') energy[`${n.nutrientNumber}:${unit}`] = n.value
    const key = NUTRIENT_NUMBERS[n.nutrientNumber]
    if (key && TO_GRAMS[unit]) nutrients[key] = n.value * TO_GRAMS[unit]
  }
  // 208 is the standard kcal figure; Foundation foods sometimes only have the Atwater (957/958) or kJ values.
  const kcal = energy['208:KCAL'] ?? energy['957:KCAL'] ?? energy['958:KCAL']
  const kj = energy['268:KJ']
  if (kcal !== undefined) nutrients['energy-kcal'] = kcal
  else if (kj !== undefined) nutrients['energy-kcal'] = kj / 4.184
  if (nutrients.sodium !== undefined) nutrients.salt = nutrients.sodium * 2.5

  const measure = f.foodMeasures?.find(
    (m) => m.gramWeight && m.gramWeight > 0 && m.disseminationText && !/not specified/i.test(m.disseminationText),
  )
  return {
    id: `usda:${f.fdcId}`,
    name: f.description,
    brand: 'Generic (USDA)',
    basis: 'g',
    servingSize: measure?.gramWeight,
    servingLabel: measure ? `${measure.disseminationText} (${Math.round(measure.gramWeight!)} g)` : undefined,
    nutrients,
    source: 'usda',
  }
}

export async function searchUsda(query: string, apiKey?: string): Promise<Food[]> {
  const params = new URLSearchParams({
    api_key: apiKey?.trim() || 'DEMO_KEY',
    query: query.trim(),
    pageSize: '25',
    dataType: 'Foundation,SR Legacy,Survey (FNDDS)',
  })
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?${params}`, {
    signal: AbortSignal.timeout(12000),
  })
  if (res.status === 429) throw new UsdaRateLimitError('USDA search limit reached')
  if (!res.ok) throw new Error(`USDA search returned ${res.status}`)
  const json = (await res.json()) as { foods?: UsdaFood[] }
  const foods = (json.foods ?? []).map(toFood).filter((f) => f.nutrients['energy-kcal'] !== undefined)
  // USDA's own ranking is loose ("apple" returns croissants first).
  return rankByName(foods, query)
}
