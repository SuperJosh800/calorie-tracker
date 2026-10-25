export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snacks'

export const MEALS: { id: Meal; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' },
]

/**
 * Nutrient amounts per 100 g (or 100 ml), keyed by Open Food Facts nutrient id.
 * Values are in grams, except `energy-kcal`, which is in kcal.
 */
export type Nutrients = Record<string, number>

export type DietStatus = 'yes' | 'no' | 'maybe'
export interface Diet {
  vegan?: DietStatus
  vegetarian?: DietStatus
}

export interface Food {
  id: string
  name: string
  brand?: string
  barcode?: string
  imageUrl?: string
  basis: 'g' | 'ml'
  /** Size of one serving in grams/ml. */
  servingSize?: number
  servingLabel?: string
  nutrients: Nutrients
  /** Vegan/vegetarian status from Open Food Facts' ingredient analysis or the product's labels. */
  diet?: Diet
  source: 'off' | 'usda' | 'cofid' | 'custom'
}

export interface Entry {
  id: string
  date: string
  meal: Meal
  /** Snapshot of the food, so later edits to a food don't rewrite history. */
  food: Food
  quantity: number
  /** `base` means grams/ml (see `food.basis`); `serving` means number of servings. */
  unit: 'base' | 'serving'
  createdAt: number
}

export interface Settings {
  calorieGoal: number
  proteinGoal: number
  carbsGoal: number
  fatGoal: number
  /** Optional personal USDA FoodData Central key, for a higher search limit than the shared demo key. */
  usdaApiKey?: string
}

export const DEFAULT_SETTINGS: Settings = {
  calorieGoal: 2000,
  proteinGoal: 50,
  carbsGoal: 260,
  fatGoal: 70,
}
