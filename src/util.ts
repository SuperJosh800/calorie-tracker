import { useEffect, useState } from 'react'
import type { Meal } from './types'

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
