import { describe, expect, it } from 'vitest'
import type { Recipe } from '../types'
import { calcFromBase, calcFromTarget, fmtGrams, parseDecimal } from './calc'

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

const g = (c: ReturnType<typeof calcFromBase>, name: string) => c.amounts.find((a) => a.component.name === name)!.grams

describe('calcFromTarget', () => {
  it('100g バッチで比率通りの量になる', () => {
    const c = calcFromTarget(B2, 100)
    expect(c.total).toBeCloseTo(100, 6)
    expect(g(c, 'L-6206')).toBeCloseTo(61, 6)
    expect(g(c, 'BAPO')).toBeCloseTo(1, 6)
  })
  it('比率合計が100でなくても目標量にスケールする', () => {
    const r = { ...B2, components: B2.components.map((c) => ({ ...c, ratio: c.ratio * 2 })) }
    const c = calcFromTarget(r, 50)
    expect(c.total).toBeCloseTo(50, 6)
    expect(g(c, 'L-6206')).toBeCloseTo(30.5, 6)
  })
  it('0 以下は全成分 0', () => {
    expect(calcFromTarget(B2, 0).total).toBe(0)
  })
})

describe('calcFromBase (受け入れ確認 1)', () => {
  it('L-6206 実測 66.3 → ACMO 21.7', () => {
    const c = calcFromBase(B2, 66.3)
    expect(fmtGrams(g(c, 'ACMO'))).toBe('21.7')
    expect(fmtGrams(g(c, 'EO3-TMPTA'))).toBe('14.1')
    expect(fmtGrams(g(c, 'L-6105'))).toBe('5.11')
    expect(fmtGrams(g(c, 'BAPO'))).toBe('1.09')
    expect(fmtGrams(g(c, '顔料(緑)'))).toBe('0.33')
    expect(fmtGrams(g(c, 'L-6206'))).toBe('66.3')
    expect(c.scale).toBeCloseTo(66.3 / 61, 9)
  })
})

describe('parseDecimal', () => {
  it('全角数字と全角ピリオドを受け付ける', () => {
    expect(parseDecimal('６６．３')).toBe(66.3)
    expect(parseDecimal(' 12,5 ')).toBe(12.5)
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
  })
})
