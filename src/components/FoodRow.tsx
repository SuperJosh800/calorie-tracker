import { formatNumber } from '../nutrients'
import type { Diet, Food } from '../types'

function dietLabel(diet: Diet): { text: string; tone: 'vegan' | 'veggie' | 'meat' | 'unsure' } | undefined {
  if (diet.vegan === 'yes') return { text: 'Vegan', tone: 'vegan' }
  if (diet.vegetarian === 'yes') return { text: diet.vegan === 'maybe' ? 'Vegetarian · maybe vegan' : 'Vegetarian', tone: 'veggie' }
  if (diet.vegetarian === 'no') return { text: 'Not vegetarian', tone: 'meat' }
  if (diet.vegetarian === 'maybe') return { text: 'Maybe vegetarian', tone: 'unsure' }
  if (diet.vegan === 'no') return { text: 'Not vegan', tone: 'unsure' }
  if (diet.vegan === 'maybe') return { text: 'Maybe vegan', tone: 'unsure' }
  return undefined
}

export function DietBadge({ diet }: { diet?: Diet }) {
  const label = diet && dietLabel(diet)
  return label ? <span className={`diet-badge ${label.tone}`}>{label.text}</span> : null
}

export function FoodThumb({ food }: { food: Food }) {
  return food.imageUrl ? (
    <img className="thumb" src={food.imageUrl} alt="" loading="lazy" />
  ) : (
    <span className="thumb thumb-placeholder" aria-hidden>
      {food.name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export function FoodRow({ food, onClick }: { food: Food; onClick: () => void }) {
  const kcal = food.nutrients['energy-kcal']
  return (
    <button className="list-row" onClick={onClick}>
      <FoodThumb food={food} />
      <span className="list-row-main">
        <span className="list-row-title">{food.name}</span>
        {food.diet && <DietBadge diet={food.diet} />}
        <span className="list-row-sub">{[food.brand, food.servingLabel && `serving ${food.servingLabel}`].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="list-row-end stacked">
        {kcal !== undefined ? (
          <>
            {formatNumber(kcal)} kcal
            <small>per 100{food.basis}</small>
          </>
        ) : (
          <small>no data</small>
        )}
      </span>
    </button>
  )
}
