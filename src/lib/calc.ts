import type { Component, Recipe } from '../types'

export interface Amount {
  component: Component
  grams: number
  isBase: boolean
}

export interface Calculation {
  /** 1 ratio 単位あたりのグラム数 */
  scale: number
  amounts: Amount[]
  total: number
  ratioSum: number
}

export function ratioSum(recipe: Recipe): number {
  return recipe.components.reduce((s, c) => s + c.ratio, 0)
}

export function findBase(recipe: Recipe): Component | undefined {
  return recipe.components.find((c) => c.name === recipe.base_component)
}

function build(recipe: Recipe, scale: number): Calculation {
  const amounts = recipe.components.map((c) => ({
    component: c,
    grams: c.ratio * scale,
    isBase: c.name === recipe.base_component,
  }))
  return {
    scale,
    amounts,
    total: amounts.reduce((s, a) => s + a.grams, 0),
    ratioSum: ratioSum(recipe),
  }
}

/** 目標バッチ量(g)から各成分量を求める */
export function calcFromTarget(recipe: Recipe, targetGrams: number): Calculation {
  const sum = ratioSum(recipe)
  const scale = sum > 0 && targetGrams > 0 ? targetGrams / sum : 0
  return build(recipe, scale)
}

/** 基準成分の実測量(g)から他成分を再計算する: 実測 / ratio_base × ratio_i */
export function calcFromBase(recipe: Recipe, measuredBaseGrams: number): Calculation {
  const base = findBase(recipe)
  const scale = base && base.ratio > 0 && measuredBaseGrams > 0 ? measuredBaseGrams / base.ratio : 0
  return build(recipe, scale)
}

/**
 * 質量の表示単位。はかりの最小表示に合わせる。
 * - coarse: 常に 0.1 g (小数1桁)
 * - fine:   10 g 以上は小数1桁、10 g 未満は 0.01 g (小数2桁)
 */
export type GramResolution = 'coarse' | 'fine'
let gramResolution: GramResolution = 'fine'

export function setGramResolution(r: GramResolution) {
  gramResolution = r
}

export function getGramResolution(): GramResolution {
  return gramResolution
}

export function fmtGrams(g: number): string {
  if (!Number.isFinite(g)) return '–'
  if (gramResolution === 'coarse') return g.toFixed(1)
  return Math.abs(g) >= 10 ? g.toFixed(1) : g.toFixed(2)
}

export function fmtNum(n: number, digits = 1): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '–'
}

/** 全角数字・全角ピリオド・読点をゆるく受け付けて数値化する */
export function parseDecimal(s: string): number | null {
  const t = s
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[．，、,]/g, '.')
    .trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
