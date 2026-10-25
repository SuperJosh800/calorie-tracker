import { useEffect, useState } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
const KEY = 'ct.theme'
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function storedTheme(): ThemeChoice {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '"system"')
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

const resolve = (choice: ThemeChoice): 'light' | 'dark' =>
  choice === 'system' ? (darkQuery().matches ? 'dark' : 'light') : choice

/** Sets the colours on <html>. Called before the first render too, so the app doesn't flash the wrong theme. */
export function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = resolve(choice)
}

/** The user's theme choice (saved on this phone) and the theme actually showing. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(storedTheme)
  const [resolved, setResolved] = useState(() => resolve(choice))
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(choice))
    const update = () => {
      applyTheme(choice)
      setResolved(resolve(choice))
    }
    update()
    if (choice !== 'system') return
    // Follow the phone switching between light and dark while the app is open.
    const query = darkQuery()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [choice])
  return { choice, setChoice, resolved }
}
