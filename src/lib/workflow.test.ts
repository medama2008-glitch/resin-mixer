import { describe, expect, it } from 'vitest'
import type { Recipe } from '../types'
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

describe('buildWorkflow', () => {
  it('実測前: 準備→先溶かし(+5%)→主剤計量→調整→カクテル→合流', () => {
    const cards = buildWorkflow(B2, { targetGrams: 100, measuredBase: null, margin: 0.05, premixActual: null })
    expect(cards.map((c) => c.kind)).toEqual(['prep', 'dissolve', 'measure', 'adjust', 'cocktail', 'merge'])
    expect(cards[0].text).toBe('L-6206 を 64.0 g 以上小分けして湯煎 (40-50℃)。目安 61.0 g')
    expect(cards[1].text).toBe('湯煎の間に作る。ACMO 21.0 g を容器に取り、BAPO 1.05 g を少量ずつ加えて溶解（計 22.1 g）')
    expect(cards[2].measure).toMatchObject({ plan: 61, measured: null })
    expect(cards[2].measure!.lower).toBeCloseTo(57.95, 6)
    expect(cards[2].measure!.upper).toBeCloseTo(64.05, 6)
    expect(cards[3].adjust).toBeUndefined()
    expect(cards[3].text).toContain('実測値を入力すると')
  })

  it('実測 58.0: 先溶かし液 22.05 g から 2.08 g 抜く、カクテルは実測基準', () => {
    const cards = buildWorkflow(B2, { targetGrams: 100, measuredBase: 58, margin: 0.05, premixActual: null })
    const adj = cards[3].adjust!
    expect(adj.made).toBeCloseTo(22.05, 6)
    expect(adj.needed).toBeCloseTo((58 / 61) * 21, 6)
    expect(adj.remove).toBeCloseTo(22.05 - (58 / 61) * 21, 6)
    expect(cards[3].text).toBe('先溶かし液の容器をはかりに載せて風袋引きし、表示が −2.08 g になるまで抜く（残り 20.0 g）')
    // カクテルは 58/61 倍
    expect(cards[4].text).toBe('EO3-TMPTA 12.4 g → L-6105 4.47 g → 顔料(緑) 0.29 g を追加して撹拌')
    expect(cards[5].text).toContain('L-6206 58.0 g')
  })

  it('実測 66: 先溶かし液が不足し、主剤の減らし量を示す', () => {
    const cards = buildWorkflow(B2, { targetGrams: 100, measuredBase: 66, margin: 0.05, premixActual: null })
    const adj = cards[3].adjust!
    expect(adj.remove).toBeLessThan(0)
    // 不足分 = 66/61*21 − 22.05。主剤換算 = 不足 / 21 × 61
    const shortage = (66 / 61) * 21 - 22.05
    expect(adj.baseReduction).toBeCloseTo((shortage / 21) * 61, 6)
    expect(cards[3].text).toContain('不足')
    expect(cards[2].measure!.measured).toBe(66)
  })

  it('実際に作った先溶かし液の量を入れるとそこから引く', () => {
    const cards = buildWorkflow(B2, { targetGrams: 100, measuredBase: 58, margin: 0.05, premixActual: 23 })
    expect(cards[3].adjust!.made).toBe(23)
    expect(cards[3].adjust!.remove).toBeCloseTo(23 - (58 / 61) * 21, 6)
  })

  it('先溶かし工程が無いレシピは従来の step 順のまま', () => {
    const r: Recipe = {
      ...B2,
      components: B2.components.map((c) => (c.name === 'BAPO' ? { ...c, step: 2 } : c)),
    }
    const cards = buildWorkflow(r, { targetGrams: 100, measuredBase: null, margin: 0.05, premixActual: null })
    expect(cards.map((c) => c.kind)).toEqual(['generic', 'cocktail', 'merge'])
  })
})
