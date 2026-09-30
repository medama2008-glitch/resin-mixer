import { beforeAll, describe, expect, it } from 'vitest'
import type { Recipe } from '../types'
import { setGramResolution } from './calc'
import { buildBatch, buildBatchWorkflow } from './batch'

const mk = (id: string, l6105: number, extra: { name: string; ratio: number; step: number; role: string }[] = []): Recipe => ({
  id,
  status: 'experimental',
  base_component: 'L-6206',
  components: [
    { name: 'L-6206', ratio: 58, role: 'oligomer', step: 3 },
    { name: 'ACMO', ratio: 18, role: 'diluent', step: 1 },
    { name: 'BAPO', ratio: 2, role: 'initiator', step: 1 },
    { name: 'EO3-TMPTA', ratio: 13, role: 'crosslinker', step: 2 },
    { name: 'L-6105', ratio: l6105, role: 'diluent', step: 2 },
    ...extra,
  ],
})
const FG10 = mk('B-4FG10', 8, [{ name: '顔料(緑)', ratio: 1, role: 'blocker', step: 2 }])
const FG20 = mk('B-4FG20', 7, [{ name: '顔料(緑)', ratio: 2, role: 'blocker', step: 2 }])
const FOB = mk('B-4F-OB', 8.55, [
  { name: '顔料(緑)', ratio: 0.3, role: 'blocker', step: 2 },
  { name: 'OB', ratio: 0.15, role: 'blocker', step: 1 },
])

beforeAll(() => setGramResolution('fine'))

describe('buildBatch', () => {
  it('共通最小分をマスターに、差分を個別追加にする', () => {
    const plan = buildBatch([
      { recipe: FG10, targetGrams: 100 },
      { recipe: FG20, targetGrams: 100 },
      { recipe: FOB, targetGrams: 100 },
    ])
    expect(plan.errors).toEqual([])
    // 共通: L-6206 58, ACMO 18, BAPO 2, EO3 13, L-6105 7, 顔料 0.3 = 98.3%
    expect(plan.sharedFraction).toBeCloseTo(0.983, 9)
    expect(plan.master.components.map((c) => `${c.name}:${c.ratio.toFixed(2)}`)).toEqual([
      'L-6206:58.00',
      'ACMO:18.00',
      'BAPO:2.00',
      'EO3-TMPTA:13.00',
      'L-6105:7.00',
      '顔料(緑):0.30',
    ])
    expect(plan.masterTotal).toBeCloseTo(294.9, 9)
    const add = (id: string) =>
      plan.perRecipe.find((p) => p.recipe.id === id)!.additions.map((a) => `${a.component.name}:${a.grams.toFixed(2)}`)
    expect(add('B-4FG10')).toEqual(['L-6105:1.00', '顔料(緑):0.70'])
    expect(add('B-4FG20')).toEqual(['顔料(緑):1.70'])
    expect(add('B-4F-OB')).toEqual(['OB:0.15', 'L-6105:1.55'])
    // 各レシピの合計は目標どおり
    for (const p of plan.perRecipe) {
      const total = p.masterGrams + p.additions.reduce((s, a) => s + a.grams, 0)
      expect(total).toBeCloseTo(100, 9)
    }
  })

  it('主剤が違うレシピはエラー', () => {
    const other: Recipe = { ...FG10, id: 'X', base_component: 'ACMO' }
    const plan = buildBatch([
      { recipe: FG10, targetGrams: 100 },
      { recipe: other, targetGrams: 100 },
    ])
    expect(plan.errors[0]).toContain('主剤が異なる')
  })

  it('手順: 共通ミックスの工程 → 分注 → 個別追加', () => {
    const plan = buildBatch([
      { recipe: FG10, targetGrams: 100 },
      { recipe: FG20, targetGrams: 50 },
    ])
    const { cards } = buildBatchWorkflow(plan, { measuredBase: null })
    expect(cards.map((c) => c.kind)).toEqual(['prep', 'dissolve', 'measure', 'cocktail', 'merge', 'split', 'individual', 'individual'])
    // 共通 = 58+18+2+13+7+1 = 99% → 99.0 + 49.5
    expect(cards[5].text).toBe('共通ミックス（計 148.5 g）から各レシピの容器に取り分ける: B-4FG10 99.0 g / B-4FG20 49.5 g')
    expect(cards[6].text).toBe('B-4FG10 の容器に L-6105 1.00 g を追加して撹拌')
    expect(cards[7].text).toBe('B-4FG20 の容器に 顔料(緑) 0.50 g を追加して撹拌')
  })

  it('余裕率を付けると共通ミックスを多めに作り、余りを表示する', () => {
    const plan = buildBatch([
      { recipe: FG10, targetGrams: 100 },
      { recipe: FG20, targetGrams: 50 },
    ])
    const res = buildBatchWorkflow(plan, { measuredBase: null, splitMargin: 0.03 })
    expect(res.marginApplied).toBe(true)
    expect(res.totalGrams).toBeCloseTo(148.5 * 1.03, 9)
    expect(res.leftover).toBeCloseTo(148.5 * 0.03, 9)
    const split = res.cards.find((c) => c.kind === 'split')!
    expect(split.text).toBe(
      '共通ミックス（計 153.0 g、余裕込み）から各レシピの容器に取り分ける: B-4FG10 99.0 g / B-4FG20 49.5 g（余り 4.46 g）',
    )
  })
})
