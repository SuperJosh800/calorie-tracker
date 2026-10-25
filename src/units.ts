import type { HeightUnit, WeightUnit } from './types'

const KG_PER_LB = 0.45359237
const CM_PER_IN = 2.54
const round1 = (n: number) => Math.round(n * 10) / 10
/** Weights keep one decimal place at any size (102.4 kg), unlike nutrient amounts. */
const fmt1 = (n: number) => String(round1(n))

function stonesAndPounds(kg: number): [number, number] {
  const totalLb = round1(kg / KG_PER_LB)
  const st = Math.floor(totalLb / 14)
  return [st, round1(totalLb - st * 14)]
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  if (unit === 'kg') return `${fmt1(round1(kg))} kg`
  if (unit === 'lb') return `${fmt1(round1(kg / KG_PER_LB))} lb`
  const [st, lb] = stonesAndPounds(kg)
  return `${st} st ${fmt1(lb)} lb`
}

/** A weight difference, such as "-1.2 kg" or "+3 lb" (stones users see pounds for small changes). */
export function formatWeightChange(kg: number, unit: WeightUnit): string {
  const value = unit === 'kg' ? round1(kg) : round1(kg / KG_PER_LB)
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${fmt1(Math.abs(value))} ${unit === 'kg' ? 'kg' : 'lb'}`
}

export function formatRate(kgPerWeek: number, unit: WeightUnit): string {
  return unit === 'kg' ? `${Math.round(kgPerWeek * 100) / 100} kg` : `${fmt1(kgPerWeek / KG_PER_LB)} lb`
}

export function formatHeight(cm: number, unit: HeightUnit): string {
  if (unit === 'cm') return `${Math.round(cm)} cm`
  const totalIn = Math.round(cm / CM_PER_IN)
  return `${Math.floor(totalIn / 12)} ft ${totalIn % 12} in`
}

/** Text for the input boxes of a weight: [kg], [st, lb] or [lb]. */
export function weightToParts(kg: number | undefined, unit: WeightUnit): string[] {
  if (unit === 'stlb') {
    if (kg === undefined) return ['', '']
    const [st, lb] = stonesAndPounds(kg)
    return [String(st), fmt1(lb)]
  }
  if (kg === undefined) return ['']
  return [fmt1(round1(unit === 'kg' ? kg : kg / KG_PER_LB))]
}

const num = (s: string | undefined) => {
  const n = Number((s ?? '').replace(',', '.'))
  return s?.trim() && Number.isFinite(n) && n >= 0 ? n : undefined
}

export function partsToKg(parts: string[], unit: WeightUnit): number | undefined {
  if (unit === 'stlb') {
    const st = num(parts[0])
    const lb = num(parts[1])
    if (st === undefined && lb === undefined) return undefined
    const kg = ((st ?? 0) * 14 + (lb ?? 0)) * KG_PER_LB
    return kg > 0 ? kg : undefined
  }
  const v = num(parts[0])
  if (!v) return undefined
  return unit === 'kg' ? v : v * KG_PER_LB
}

export function heightToParts(cm: number | undefined, unit: HeightUnit): string[] {
  if (unit === 'cm') return [cm === undefined ? '' : String(Math.round(cm))]
  if (cm === undefined) return ['', '']
  const totalIn = Math.round(cm / CM_PER_IN)
  return [String(Math.floor(totalIn / 12)), String(totalIn % 12)]
}

export function partsToCm(parts: string[], unit: HeightUnit): number | undefined {
  if (unit === 'cm') return num(parts[0]) || undefined
  const ft = num(parts[0])
  const inches = num(parts[1])
  if (ft === undefined && inches === undefined) return undefined
  const cm = ((ft ?? 0) * 12 + (inches ?? 0)) * CM_PER_IN
  return cm > 0 ? cm : undefined
}
