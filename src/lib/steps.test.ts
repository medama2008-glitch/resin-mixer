import { describe, expect, it } from 'vitest'
import type { Recipe } from '../types'
import { calcFromBase } from './calc'
import { buildSteps } from './steps'

const B2: Recipe = {
  id: 'B-2',
  status: 'active',
  base_component: 'L-6206',
  components: [
    { name: 'L-6206', ratio: 61.0, role: 'oligomer', step: 3 },
    { name: 'ACMO', ratio: 20.0, role: 'diluent', step: 1 },
    { name: 'BAPO', ratio: 1.0, role: 'initiator', step: 1, note: 'ACMO全量に溶解' },
    { name: 'EO3-TMPTA', ratio: 13.0, role: 'crosslinker', step: 2 },
    { name: 'L-6105', ratio: 4.7, role: 'diluent', step: 2 },
    { name: '顔料(緑)', ratio: 0.3, role: 'blocker', step: 2 },
  ],
}

describe('buildSteps (受け入れ確認 2)', () => {
  const steps = buildSteps(B2, calcFromBase(B2, 66.3))

  it('step 1→2→3 の順で 3 枚', () => {
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3])
    expect(steps.map((s) => s.kind)).toEqual(['dissolve', 'cocktail', 'merge'])
  })
  it('Step 1: 先溶かし文言と note', () => {
    expect(steps[0].text).toBe('ACMO 21.7 g を容器に取り、BAPO 1.09 g を少量ずつ加えて溶解')
    expect(steps[0].notes).toEqual(['BAPO: ACMO全量に溶解'])
  })
  it('Step 2: 先溶かし液とは別の容器で作る', () => {
    expect(steps[1].text).toBe(
      '先溶かし液とは別の容器に EO3-TMPTA 14.1 g → L-6105 5.11 g → 顔料(緑) 0.33 g を取り撹拌（先溶かし液は撹拌を続ける）',
    )
  })
  it('Step 3: 主剤合流で先溶かし液とカクテルを両方加える', () => {
    expect(steps[2].text).toBe(
      'L-6206 66.3 g（40-50℃加温済み）に 先溶かし液 (ACMO+BAPO) と モノマーカクテル (EO3-TMPTA+L-6105+顔料(緑)) を全量注ぎ、ヘラで壁面をこそぎながら混合',
    )
    expect(steps[2].items.map((it) => it.component.name)).toEqual([
      'L-6206',
      '先溶かし液 (ACMO+BAPO)',
      'モノマーカクテル (EO3-TMPTA+L-6105+顔料(緑))',
    ])
    expect(steps[2].items[1].grams).toBeCloseTo(21 * (66.3 / 61), 6)
    expect(steps[2].items[2].grams).toBeCloseTo(18 * (66.3 / 61), 6)
  })
  it('累計は容器ごと', () => {
    expect(steps[0].items.at(-1)!.cumulative).toBeCloseTo(21 * (66.3 / 61), 6)
    expect(steps[1].items.at(-1)!.cumulative).toBeCloseTo(18 * (66.3 / 61), 6)
    expect(steps[2].items[0].cumulative).toBeUndefined()
  })
})

describe('buildSteps: 複数オリゴマーのブレンド', () => {
  const r: Recipe = {
    ...B2,
    components: [
      ...B2.components,
      { name: 'L-9999', ratio: 10, role: 'oligomer', step: 3 },
    ],
  }
  it('合流工程の他のオリゴマーは加温せず合流後に追加', () => {
    const steps = buildSteps(r, calcFromBase(r, 61))
    expect(steps[2].text).toContain('L-6206 61.0 g（40-50℃加温済み）に 先溶かし液 (ACMO+BAPO) と モノマーカクテル')
    expect(steps[2].text).toContain('。さらに L-9999 10.0 g を追加して撹拌')
  })
  it('合流工程のオリゴマー以外は「さらに追加」', () => {
    const r2: Recipe = {
      ...B2,
      components: [...B2.components, { name: '添加剤X', ratio: 1, role: 'additive', step: 3 }],
    }
    const steps = buildSteps(r2, calcFromBase(r2, 61))
    expect(steps[2].text).toContain('さらに 添加剤X 1.00 g を追加して撹拌')
  })
})
