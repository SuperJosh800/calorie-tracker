import type { ActivityLevel, Aim, Profile, Sex, WeightEntry } from './types'
import { daysBetween } from './util'

/** Energy in 1 kg of body weight change, the standard rule of thumb. */
export const KCAL_PER_KG = 7700

export const ACTIVITY_LEVELS: { id: ActivityLevel; factor: number; label: string; detail: string }[] = [
  { id: 'sedentary', factor: 1.2, label: 'Mostly sitting', detail: 'Desk job, little or no exercise' },
  { id: 'light', factor: 1.375, label: 'Lightly active', detail: 'Light exercise or lots of walking, 1–3 days a week' },
  { id: 'moderate', factor: 1.55, label: 'Moderately active', detail: 'Exercise 3–5 days a week' },
  { id: 'active', factor: 1.725, label: 'Very active', detail: 'Hard exercise 6–7 days a week' },
  { id: 'veryActive', factor: 1.9, label: 'Extremely active', detail: 'Physical job plus hard training' },
]

export const AIMS: { id: Aim; label: string; detail: string }[] = [
  { id: 'lose', label: 'Lose weight', detail: 'Eat less than you burn to lose weight at a steady pace.' },
  {
    id: 'recomp',
    label: 'Lose fat & build muscle',
    detail:
      'Eat a little below maintenance (about 10%) with plenty of protein, and do strength training 2–4 times a week. ' +
      'Your weight may only drop slowly while your shape changes, so also go by how your clothes fit or a waist measurement.',
  },
  { id: 'maintain', label: 'Stay the same', detail: 'Eat about what you burn to keep your weight steady.' },
  { id: 'gain', label: 'Gain weight', detail: 'Eat a bit more than you burn. Pair it with strength training to gain mostly muscle.' },
]

/** Calorie deficit for losing fat while building muscle: small enough to keep fuelling training. */
export const RECOMP_DEFICIT = 0.1

export const RATES: Record<'lose' | 'gain', number[]> = {
  lose: [0.25, 0.5, 0.75, 1],
  gain: [0.25, 0.5],
}

/** Below these, NHS guidance is to only diet with medical supervision. */
export const MIN_CALORIES: Record<Sex, number> = { female: 1200, male: 1500 }

export const ageOf = (p: Profile, today = new Date()) =>
  p.birthYear === undefined ? undefined : today.getFullYear() - p.birthYear

/** Resting energy use (basal metabolic rate) from the Mifflin-St Jeor equation. */
export function bmr(p: Profile, kg: number): number | undefined {
  const age = ageOf(p)
  if (!p.sex || age === undefined || !p.heightCm) return undefined
  return 10 * kg + 6.25 * p.heightCm - 5 * age + (p.sex === 'male' ? 5 : -161)
}

/** Calories a day to stay the same weight: resting energy use times activity level. */
export function formulaMaintenance(p: Profile, kg: number): number | undefined {
  const base = bmr(p, kg)
  const factor = ACTIVITY_LEVELS.find((a) => a.id === p.activity)?.factor
  return base === undefined || factor === undefined ? undefined : base * factor
}

/** Daily calories for the user's aim, never below the safe minimum. */
export function targetCalories(p: Profile, maintenance: number): { kcal: number; limited: boolean } {
  const change = ((p.ratePerWeekKg ?? 0) * KCAL_PER_KG) / 7
  const wanted =
    p.aim === 'lose'
      ? maintenance - change
      : p.aim === 'gain'
        ? maintenance + change
        : p.aim === 'recomp'
          ? maintenance * (1 - RECOMP_DEFICIT)
          : maintenance
  const floor = p.sex ? MIN_CALORIES[p.sex] : 0
  return wanted < floor ? { kcal: floor, limited: true } : { kcal: wanted, limited: false }
}

/** Protein in g per kg of body weight: more when dieting or building muscle, most when doing both. */
const PROTEIN_PER_KG: Record<Aim, number> = { maintain: 1.2, lose: 1.6, gain: 1.6, recomp: 2 }

/** Suggested macros: protein from body weight, 30% of calories from fat, and the rest from carbohydrate. */
export function suggestedMacros(kcal: number, kg: number, aim: Aim | undefined) {
  const protein = Math.round(kg * PROTEIN_PER_KG[aim ?? 'maintain'])
  const fat = Math.round((kcal * 0.3) / 9)
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { protein, fat, carbs }
}

export function weeksToTarget(currentKg: number, p: Profile): number | undefined {
  if (!p.targetWeightKg || !p.ratePerWeekKg || (p.aim !== 'lose' && p.aim !== 'gain')) return undefined
  const remaining = p.aim === 'lose' ? currentKg - p.targetWeightKg : p.targetWeightKg - currentKg
  return remaining > 0 ? remaining / p.ratePerWeekKg : 0
}

export const ESTIMATE_WINDOW_DAYS = 28
const MIN_SPAN_DAYS = 14
const MIN_WEIGH_INS = 3
const MIN_LOGGED_DAYS = 10

export type LogEstimate =
  | { ok: true; maintenance: number; avgIntake: number; kgPerWeek: number; loggedDays: number; weighIns: number; spanDays: number }
  | { ok: false; weighIns: number; spanDays: number; loggedDays: number }

/**
 * Maintenance estimated from the user's own logs over the last 4 weeks:
 * average logged intake minus the energy that went into the weight change.
 * The weight trend is a least-squares line through the weigh-ins, which smooths out daily water swings.
 * Only days with food logged count towards average intake.
 */
export function estimateFromLogs(weights: WeightEntry[], kcalByDate: Record<string, number>, today: string): LogEstimate {
  const inWindow = weights
    .filter((w) => {
      const age = daysBetween(w.date, today)
      return age >= 0 && age < ESTIMATE_WINDOW_DAYS
    })
    .sort((a, b) => a.date.localeCompare(b.date))
  const first = inWindow[0]?.date
  const last = inWindow.at(-1)?.date
  const spanDays = first && last ? daysBetween(first, last) : 0
  const logged = Object.entries(kcalByDate).filter(
    ([date, kcal]) => kcal > 0 && first && last && date >= first && date <= last,
  )
  const result = { weighIns: inWindow.length, spanDays, loggedDays: logged.length }
  if (inWindow.length < MIN_WEIGH_INS || spanDays < MIN_SPAN_DAYS || logged.length < MIN_LOGGED_DAYS) {
    return { ok: false, ...result }
  }
  const xs = inWindow.map((w) => daysBetween(first!, w.date))
  const ys = inWindow.map((w) => w.kg)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  const slope =
    xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0) / xs.reduce((sum, x) => sum + (x - mx) ** 2, 0)
  const avgIntake = logged.reduce((sum, [, kcal]) => sum + kcal, 0) / logged.length
  return { ok: true, maintenance: avgIntake - slope * KCAL_PER_KG, avgIntake, kgPerWeek: slope * 7, ...result }
}
