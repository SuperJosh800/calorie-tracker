import { formatNumber } from '../nutrients'
import type { Food } from '../types'

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
