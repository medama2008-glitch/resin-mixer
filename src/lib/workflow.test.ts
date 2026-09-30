import { beforeAll, describe, expect, it } from 'vitest'
import type { Recipe } from '../types'
import { setGramResolution } from './calc'
import { buildWorkflow } from './workflow'

const B2: Recipe = {
  id: 'B-2',
  status: 'active',
  base_component: 'L-6206',
  components: [
    { name: 'L-6206', ratio: 61.0, role: 'oligomer', step: 3 },
    { name: 'ACMO', ratio: 20.0, role: 'diluent', step: 1 },
    { name: 'BAPO', ratio: 1.0, role: 'initiator', step: 1 },
    { name: 'EO3-TMPTA', ratio: 13.0, role: 'crosslinker', step: 2 },
    { name: 'L-6105', ratio: 4.7, role: 'diluent', step: 2 },
    { name: '顔料(緑)', ratio: 0.3, role: 'blocker', step: 2 },
  ],
}

beforeAll(() => setGramResolution('fine'))

describe('buildWorkflow', () => {
  it('目安どおり: 準備→先溶かし→主剤計量→カクテル→合流', () => {
    const { cards, containers, marginApplied } = buildWorkflow(B2, { targetGrams: 100, measuredBase: null })
    expect(containers).toBe(1)
    expect(marginApplied).toBe(false)
    expect(cards.map((c) => c.kind)).toEqual(['prep', 'dissolve', 'measure', 'cocktail', 'merge'])
    expect(cards[0].text).toBe('L-6206 を小分けして湯煎 (40-50℃)。目安 61.0 g')
    expect(cards[1].text).toBe('湯煎の間に作る。ACMO 20.0 g を容器に取り、BAPO 1.00 g を少量ずつ加えて溶解')
    expect(cards[2].text).toBe('温まった L-6206 を 61.0 g 計量（微調整で目安に合わせる）')
    expect(cards[2].measure).toEqual({ plan: 61, measured: null, deviation: 0 })
    expect(cards[3].text).toBe('先溶かし液とは別の容器に EO3-TMPTA 13.0 g → L-6105 4.70 g → 顔料(緑) 0.30 g を取り撹拌（先溶かし液は撹拌を続ける）')
    expect(cards[4].text).toContain('L-6206 61.0 g')
  })

  it('実測 58: 先溶かしは計画量のまま、カクテル以降は実測基準、ずれの注意が付く', () => {
    const { cards } = buildWorkflow(B2, { targetGrams: 100, measuredBase: 58 })
    expect(cards[1].text).toContain('ACMO 20.0 g')
    expect(cards[2].measure!.deviation).toBeCloseTo(58 / 61 - 1, 9)
    expect(cards[2].notes[0]).toContain('-4.9%')
    expect(cards[3].text).toBe('先溶かし液とは別の容器に EO3-TMPTA 12.4 g → L-6105 4.47 g → 顔料(緑) 0.29 g を取り撹拌（先溶かし液は撹拌を続ける）')
    expect(cards[4].text).toContain('L-6206 58.0 g')
  })

  it('1% 未満のずれは注意を出さない', () => {
    const { cards } = buildWorkflow(B2, { targetGrams: 100, measuredBase: 61.3 })
    expect(cards[2].notes).toEqual([])
  })

  it('先溶かし工程が無いレシピは従来の step 順のまま', () => {
    const r: Recipe = {
      ...B2,
      components: B2.components.map((c) => (c.name === 'BAPO' ? { ...c, step: 2 } : c)),
    }
    const { cards } = buildWorkflow(r, { targetGrams: 100, measuredBase: null })
    expect(cards.map((c) => c.kind)).toEqual(['generic', 'cocktail', 'merge'])
  })

  it('容器上限を超えると主剤を分けて湯煎し、余裕を上乗せする', () => {
    // 1500 g, 上限 715 g (650 mL × 1.1), 余裕 3% → 1545 g を 3 容器
    const res = buildWorkflow(B2, { targetGrams: 1500, measuredBase: 60, capacityGrams: 715, splitMargin: 0.03 })
    expect(res.containers).toBe(3)
    expect(res.marginApplied).toBe(true)
    expect(res.totalGrams).toBeCloseTo(1545, 9)
    expect(res.cards.map((c) => c.kind)).toEqual(['prep', 'dissolve', 'measure', 'cocktail', 'merge'])
    const perBase = (1545 * 0.61) / 3
    expect(res.cards[0].text).toBe(`L-6206 を 3 個の容器に ${perBase.toFixed(1)} g ずつ小分けして湯煎 (40-50℃)。合計 ${(1545 * 0.61).toFixed(1)} g`)
    expect(res.cards[1].text).toContain('1 容器で一括')
    expect(res.cards[1].text).toContain('ACMO 309.0 g')
    // 実測は無視される
    expect(res.cards[2].measure).toEqual({ plan: perBase, measured: null, deviation: 0 })
    // カクテル 18% × 1545 = 278.1 g は上限内なので 1 容器
    expect(res.cards[3].text).toContain(`EO3-TMPTA ${(1545 * 0.13).toFixed(1)} g`)
    expect(res.cards[4].title).toBe('主剤合流（3 容器）')
    expect(res.cards[4].text).toContain(`先溶かし液 (ACMO+BAPO) ${((1545 * 0.21) / 3).toFixed(1)} g と モノマーカクテル (EO3-TMPTA+L-6105+顔料(緑)) ${((1545 * 0.18) / 3).toFixed(1)} g`)
  })

  it('カクテルが上限を超えるときは A/B に分ける', () => {
    const res = buildWorkflow(B2, { targetGrams: 3000, measuredBase: null, capacityGrams: 300, splitMargin: 0 })
    expect(res.containers).toBe(10)
    const titles = res.cards.map((c) => c.title)
    expect(titles.filter((t) => t.startsWith('モノマーカクテル')).length).toBe(2) // 540 g → 2 容器
    expect(titles).toContain('モノマーカクテル A')
    expect(titles).toContain('モノマーカクテル B')
    expect(res.cards.at(-1)!.text).toContain('カクテルは A/B から取り分ける')
  })
})
