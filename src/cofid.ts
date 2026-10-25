import type { Food, Nutrients } from './types'
import { matchesQuery, rankByName } from './util'

/**
 * McCance and Widdowson's Composition of Foods Integrated Dataset (CoFID): the UK government's
 * reference data for about 2,900 everyday UK foods. It ships with the app as public/cofid.json
 * (built by scripts/build-cofid.py), so searching it is instant, works offline and has no limits.
 */
type CofidFile = {
  keys: string[]
  toGrams: number[]
  foods: [code: string, name: string, basis: 'g' | 'ml', values: (number | null)[]][]
}

let foods: Promise<Food[]> | undefined

function load(): Promise<Food[]> {
  foods ??= fetch(`${import.meta.env.BASE_URL}cofid.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load UK food data (${res.status})`)
      return res.json() as Promise<CofidFile>
    })
    .then((file) =>
      file.foods.map(([code, name, basis, values]) => {
        const nutrients: Nutrients = {}
        values.forEach((v, i) => {
          if (v !== null) nutrients[file.keys[i]] = v * file.toGrams[i]
        })
        if (nutrients.sodium !== undefined) nutrients.salt = nutrients.sodium * 2.5
        return { id: `cofid:${code}`, name, brand: 'UK (McCance & Widdowson)', basis, nutrients, source: 'cofid' } satisfies Food
      }),
    )
    .catch((e) => {
      foods = undefined // let the next search retry
      throw e
    })
  return foods
}

export async function searchCofid(query: string): Promise<Food[]> {
  const all = await load()
  return rankByName(
    all.filter((f) => matchesQuery(f, query)),
    query,
  )
}
