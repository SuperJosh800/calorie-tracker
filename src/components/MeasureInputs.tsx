import { useState } from 'react'
import type { HeightUnit, WeightUnit } from '../types'
import { heightToParts, partsToCm, partsToKg, weightToParts } from '../units'

/** Number boxes for a measurement split into parts, such as stones + pounds or feet + inches. */
function PartsInput({
  parts,
  units,
  label,
  onChange,
}: {
  parts: string[]
  units: string[]
  label: string
  onChange: (parts: string[]) => void
}) {
  return (
    <span className="parts-input">
      {parts.map((p, i) => (
        <span key={units[i]} className="input-unit">
          <input
            inputMode="decimal"
            value={p}
            aria-label={`${label} (${units[i]})`}
            onChange={(e) => onChange(parts.map((q, j) => (j === i ? e.target.value : q)))}
          />
          <small>{units[i]}</small>
        </span>
      ))}
    </span>
  )
}

/** Weight entry in the user's unit; reports kilograms (undefined while empty or invalid). */
export function WeightInput({
  kg,
  unit,
  label = 'Weight',
  onChange,
}: {
  kg?: number
  unit: WeightUnit
  label?: string
  onChange: (kg: number | undefined) => void
}) {
  const [state, setState] = useState(() => ({ unit, parts: weightToParts(kg, unit) }))
  // Re-show the same weight when the user switches units.
  if (state.unit !== unit) setState({ unit, parts: weightToParts(kg, unit) })
  return (
    <PartsInput
      label={label}
      parts={state.parts}
      units={unit === 'stlb' ? ['st', 'lb'] : [unit]}
      onChange={(parts) => {
        setState({ unit, parts })
        onChange(partsToKg(parts, unit))
      }}
    />
  )
}

export function HeightInput({
  cm,
  unit,
  onChange,
}: {
  cm?: number
  unit: HeightUnit
  onChange: (cm: number | undefined) => void
}) {
  const [state, setState] = useState(() => ({ unit, parts: heightToParts(cm, unit) }))
  if (state.unit !== unit) setState({ unit, parts: heightToParts(cm, unit) })
  return (
    <PartsInput
      label="Height"
      parts={state.parts}
      units={unit === 'cm' ? ['cm'] : ['ft', 'in']}
      onChange={(parts) => {
        setState({ unit, parts })
        onChange(partsToCm(parts, unit))
      }}
    />
  )
}
