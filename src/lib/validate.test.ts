import { describe, expect, it } from 'vitest'
import { parseRecipeText, validateInput } from './validate'

const good = {
  id: 'B-3',
  status: 'experimental',
  base_component: 'L-6206',
  components: [
    { name: 'L-6206', ratio: 60, role: 'oligomer', step: 2 },
    { name: 'ACMO', ratio: 40, role: 'diluent', step: 1 },
  ],
}

describe('validateInput', () => {
  it('recipes.json 全体を受け付ける', () => {
    const r = validateInput({ schema_version: 1, recipes: [good] })
    expect(r.ok).toBe(true)
    expect(r.recipes.map((x) => x.id)).toEqual(['B-3'])
  })
  it('単一レシピを受け付ける', () => {
    expect(validateInput(good).ok).toBe(true)
  })
  it('配列を受け付ける', () => {
    expect(validateInput([good]).ok).toBe(true)
  })
  it('schema_version 違いを報告する', () => {
    const r = validateInput({ schema_version: 2, recipes: [good] })
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toContain('schema_version')
  })
  it('ratio が数値でないと位置付きで報告する', () => {
    const bad = { ...good, components: [good.components[0], { ...good.components[1], ratio: '40' }] }
    const r = validateInput({ schema_version: 1, recipes: [bad] })
    expect(r.errors).toContain('recipes[0].components[1].ratio が数値ではありません')
  })
  it('base_component が存在しないと報告する', () => {
    const r = validateInput({ ...good, base_component: 'XXX' })
    expect(r.errors.some((e) => e.includes('base_component'))).toBe(true)
  })
  it('必須フィールド欠落を報告する', () => {
    const r = validateInput({ id: 'x' })
    expect(r.errors.some((e) => e.includes('status'))).toBe(true)
    expect(r.errors.some((e) => e.includes('components'))).toBe(true)
  })
})

describe('parseRecipeText', () => {
  it('構文エラーを報告する', () => {
    const r = parseRecipeText('{ oops')
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toContain('構文エラー')
  })
})
