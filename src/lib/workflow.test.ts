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
    const cards = buildWorkflow(B2, { targetGrams: 100, measuredBase: null })
    expect(cards.map((c) => c.kind)).toEqual(['prep', 'dissolve', 'measure', 'cocktail', 'merge'])
    expect(cards[0].text).toBe('L-6206 を小分けして湯煎 (40-50℃)。目安 61.0 g')
    expect(cards[1].text).toBe('湯煎の間に作る。ACMO 20.0 g を容器に取り、BAPO 1.00 g を少量ずつ加えて溶解')
    expect(cards[2].text).toBe('温まった L-6206 を 61.0 g 計量（微調整で目安に合わせる）')
    expect(cards[2].measure).toEqual({ plan: 61, measured: null, deviation: 0 })
    expect(cards[3].text).toBe('EO3-TMPTA 13.0 g → L-6105 4.70 g → 顔料(緑) 0.30 g を追加して撹拌')
    expect(cards[4].text).toContain('L-6206 61.0 g')
  })

  it('実測 58: 先溶かしは計画量のまま、カクテル以降は実測基準、ずれの注意が付く', () => {
    const cards = buildWorkflow(B2, { targetGrams: 100, measuredBase: 58 })
    expect(cards[1].text).toContain('ACMO 20.0 g')
    expect(cards[2].measure!.deviation).toBeCloseTo(58 / 61 - 1, 9)
    expect(cards[2].notes[0]).toContain('-4.9%')
    expect(cards[3].text).toBe('EO3-TMPTA 12.4 g → L-6105 4.47 g → 顔料(緑) 0.29 g を追加して撹拌')
    expect(cards[4].text).toContain('L-6206 58.0 g')
  })

  it('1% 未満のずれは注意を出さない', () => {
    const cards = buildWorkflow(B2, { targetGrams: 100, measuredBase: 61.3 })
    expect(cards[2].notes).toEqual([])
  })

  it('先溶かし工程が無いレシピは従来の step 順のまま', () => {
    const r: Recipe = {
      ...B2,
      components: B2.components.map((c) => (c.name === 'BAPO' ? { ...c, step: 2 } : c)),
    }
    const cards = buildWorkflow(r, { targetGrams: 100, measuredBase: null })
    expect(cards.map((c) => c.kind)).toEqual(['generic', 'cocktail', 'merge'])
  })
})
