import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validateInput } from './validate'
import { calcFromTarget } from './calc'
import { buildSteps } from './steps'

// public/recipes.json 自体の検証。レシピ追加時に npm test で壊れていないことを確認する。
const raw = readFileSync(new URL('../../public/recipes.json', import.meta.url), 'utf8')

describe('public/recipes.json', () => {
  const data: unknown = JSON.parse(raw)
  const result = validateInput(data)

  it('スキーマ検証に通る', () => {
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.recipes.length).toBeGreaterThan(0)
  })

  it('各レシピの ratio 合計が 95〜105 の範囲', () => {
    for (const r of result.recipes) {
      const sum = r.components.reduce((s, c) => s + c.ratio, 0)
      expect(sum, r.id).toBeGreaterThan(95)
      expect(sum, r.id).toBeLessThan(105)
    }
  })

  it('各レシピで手順カードが生成できる', () => {
    for (const r of result.recipes) {
      const steps = buildSteps(r, calcFromTarget(r, 100))
      expect(steps.length, r.id).toBeGreaterThan(0)
      expect(steps.some((s) => s.kind === 'merge'), `${r.id}: 主剤合流工程がない`).toBe(true)
    }
  })
})
