import type { Component, Recipe } from '../types'
import { fmtGrams, type Calculation } from './calc'

export interface StepItem {
  component: Component
  grams: number
  /** カクテル容器内の累計(g)。主剤合流工程では undefined */
  cumulative?: number
}

export type StepKind = 'dissolve' | 'cocktail' | 'merge' | 'generic'

export interface StepCard {
  step: number
  title: string
  text: string
  items: StepItem[]
  notes: string[]
  kind: StepKind
}

function q(c: Component, g: number): string {
  return `${c.name} ${fmtGrams(g)} g`
}

function joinArrow(items: StepItem[]): string {
  return items.map((it) => q(it.component, it.grams)).join(' → ')
}

function joinPlus(items: StepItem[]): string {
  return items.map((it) => q(it.component, it.grams)).join(' + ')
}

/**
 * step 番号ごとに成分をまとめ、工程カードの文言を動的生成する。
 * - 最小 step に開始剤と溶媒が含まれる → 先溶かし工程 (dissolve)
 * - base_component を含む step → 主剤合流工程 (merge)
 * - それ以外 → モノマーカクテル (cocktail)
 */
export function buildSteps(recipe: Recipe, calc: Calculation): StepCard[] {
  const byStep = new Map<number, StepItem[]>()
  for (const a of calc.amounts) {
    const list = byStep.get(a.component.step) ?? []
    list.push({ component: a.component, grams: a.grams })
    byStep.set(a.component.step, list)
  }
  const stepNos = [...byStep.keys()].sort((a, b) => a - b)
  const firstStep = stepNos[0]
  const mergeStep = recipe.components.find((c) => c.name === recipe.base_component)?.step

  let cum = 0 // カクテル容器の累計
  const cards: StepCard[] = []
  let prevCocktailStep: number | undefined

  for (const step of stepNos) {
    const items = byStep.get(step)!
    const notes = items
      .filter((it) => it.component.note)
      .map((it) => `${it.component.name}: ${it.component.note}`)
    const isMerge = step === mergeStep
    const initiators = items.filter((it) => it.component.role === 'initiator')
    const others = items.filter((it) => it.component.role !== 'initiator')

    if (isMerge) {
      const bases = items.filter((it) => it.component.name === recipe.base_component)
      const extras = items.filter((it) => it.component.name !== recipe.base_component)
      let text = `${joinPlus(bases)}（40-50℃加温済み）`
      const prevTitle = cards.length > 0 ? cards[cards.length - 1].title : undefined
      text +=
        prevCocktailStep === undefined
          ? 'を容器に取る'
          : `に${prevTitle}の液を全量注ぎ、ヘラで壁面をこそぎながら混合`
      if (extras.length > 0) text += `。さらに ${joinArrow(extras)} を追加して撹拌`
      cards.push({ step, title: '主剤合流', text, items: [...bases, ...extras], notes, kind: 'merge' })
      continue
    }

    // 投入順: 開始剤以外 → 開始剤。累計を付ける
    const ordered = [...others, ...initiators]
    for (const it of ordered) {
      cum += it.grams
      it.cumulative = cum
    }

    if (step === firstStep && initiators.length > 0 && others.length > 0) {
      const text = `${joinPlus(others)} を容器に取り、${joinPlus(initiators)} を少量ずつ加えて溶解`
      cards.push({ step, title: '先溶かし', text, items: ordered, notes, kind: 'dissolve' })
    } else if (prevCocktailStep === undefined) {
      const text = `${joinArrow(ordered)} を容器に取り撹拌`
      cards.push({ step, title: '計量', text, items: ordered, notes, kind: 'generic' })
    } else {
      const text = `${joinArrow(ordered)} を追加して撹拌`
      cards.push({ step, title: 'モノマーカクテル', text, items: ordered, notes, kind: 'cocktail' })
    }
    prevCocktailStep = step
  }
  return cards
}
