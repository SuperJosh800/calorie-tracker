import { NUTRIENT_BY_KEY } from './nutrients'
import type { Food, Nutrients } from './types'
import { uid } from './util'

const API = 'https://world.openfoodfacts.org'
const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'brands',
  'image_front_small_url',
  'serving_size',
  'serving_quantity',
  'product_quantity_unit',
  'nutriments',
].join(',')

type OffProduct = {
  code?: string
  product_name?: string
  product_name_en?: string
  brands?: string | string[]
  image_front_small_url?: string
  serving_size?: string
  serving_quantity?: number | string
  product_quantity_unit?: string
  nutriments?: Record<string, unknown>
}

const MASS_UNITS = new Set(['g', 'mg', 'µg', 'mcg'])

function toFood(p: OffProduct, barcode?: string): Food {
  const raw = p.nutriments ?? {}
  const nutrients: Nutrients = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!k.endsWith('_100g') || typeof v !== 'number' || !Number.isFinite(v)) continue
    const key = k.slice(0, -'_100g'.length)
    // Keep known nutrients plus anything else measured by mass (OFF stores those in grams).
    // This skips scores and estimates such as nova-group or fruits-vegetables-...-estimate.
    if (NUTRIENT_BY_KEY.has(key) || MASS_UNITS.has(String(raw[`${key}_unit`]))) nutrients[key] = v
  }
  if (nutrients['energy-kcal'] === undefined) {
    const kj = raw['energy-kj_100g'] ?? raw['energy_100g']
    if (typeof kj === 'number') nutrients['energy-kcal'] = kj / 4.184
  }
  // Salt is what UK/EU labels declare, and OFF's separate sodium value is sometimes entered wrongly,
  // so sodium is always derived from salt when salt is known.
  if (nutrients.salt !== undefined) nutrients.sodium = nutrients.salt / 2.5
  else if (nutrients.sodium !== undefined) nutrients.salt = nutrients.sodium * 2.5

  const serving = Number(p.serving_quantity)
  const brand = Array.isArray(p.brands) ? p.brands.join(', ') : p.brands
  const code = barcode ?? p.code
  return {
    id: code ? `off:${code}` : uid(),
    name: (p.product_name || p.product_name_en || '').trim() || 'Unnamed product',
    brand: brand?.split(',')[0].trim() || undefined,
    barcode: code,
    imageUrl: p.image_front_small_url,
    basis: p.product_quantity_unit === 'ml' ? 'ml' : 'g',
    servingSize: serving > 0 ? serving : undefined,
    servingLabel: p.serving_size || undefined,
    nutrients,
    source: 'off',
  }
}

export const hasNutrition = (f: Food) => f.nutrients['energy-kcal'] !== undefined

/** Looks a barcode up in Open Food Facts. Returns null when the product isn't in the database. */
export async function lookupBarcode(code: string): Promise<Food | null> {
  // Scanners report UPC-A as 12 digits; Open Food Facts often stores the 13-digit EAN form.
  const candidates = code.length === 12 ? [code, `0${code}`] : [code]
  for (const c of candidates) {
    const res = await fetch(`${API}/api/v2/product/${c}.json?fields=${FIELDS}`)
    if (res.status === 404) continue
    if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`)
    const json = (await res.json()) as { status?: number; product?: OffProduct }
    if (json.status === 1 && json.product) return toFood(json.product, c)
  }
  return null
}

/** Text search. Open Food Facts search is sometimes overloaded, so callers should handle errors. */
export async function searchFoods(query: string): Promise<Food[]> {
  const q = encodeURIComponent(query.trim())
  const attempts = [
    async () => {
      const res = await fetch(
        `${API}/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}`,
        { signal: AbortSignal.timeout(12000) },
      )
      if (!res.ok) throw new Error(`Search returned ${res.status}`)
      return ((await res.json()) as { products?: OffProduct[] }).products ?? []
    },
    async () => {
      const res = await fetch(
        `https://search.openfoodfacts.org/search?q=${q}&page_size=25&langs=en&fields=${FIELDS}`,
        { signal: AbortSignal.timeout(12000) },
      )
      if (!res.ok) throw new Error(`Search returned ${res.status}`)
      return ((await res.json()) as { hits?: OffProduct[] }).hits ?? []
    },
  ]
  let lastError: unknown
  for (const attempt of attempts) {
    try {
      const products = await attempt()
      return products.filter((p) => p.product_name || p.product_name_en).map((p) => toFood(p))
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
}
