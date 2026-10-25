import { useEffect, useState } from 'react'
import type { Food, Meal } from './types'

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function shiftDate(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  return dateKey(new Date(y, m - 1, d + days))
}

export function formatDateLabel(key: string): string {
  const today = dateKey(new Date())
  if (key === today) return 'Today'
  if (key === shiftDate(today, -1)) return 'Yesterday'
  if (key === shiftDate(today, 1)) return 'Tomorrow'
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function mealForNow(): Meal {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 15) return 'lunch'
  if (h >= 17 && h < 22) return 'dinner'
  return 'snacks'
}

const queryWords = (query: string) =>
  query
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean)
    // "crisps" should find "Crisps" and "Crisp bread"; "beans" should find "Baked beans".
    .map((w) => (w.length > 3 ? w.replace(/s$/, '') : w))

/** Orders foods so names that start with the query and contain all its words come first, shorter names first. */
export function rankByName(foods: Food[], query: string): Food[] {
  const words = queryWords(query)
  const score = (f: Food) => {
    const name = f.name.toLowerCase()
    let s = 0
    if (!name.startsWith(words[0] ?? '')) s += 100
    s += words.filter((w) => !name.includes(w)).length * 50
    return s + name.length
  }
  return [...foods].sort((a, b) => score(a) - score(b))
}

/** True when the food's name contains every word of the query. */
export function matchesQuery(food: Food, query: string): boolean {
  const name = food.name.toLowerCase()
  return queryWords(query).every((w) => name.includes(w))
}

/** useState that persists to localStorage on this device. */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])
  return [value, setValue] as const
}
