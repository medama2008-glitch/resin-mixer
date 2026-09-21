import type { Component, Recipe } from '../types'
import { fmtGrams, type Calculation } from './calc'

export interface StepItem {
  component: Component
  grams: number
  /** その容器内の累計(g)。主剤合流工程では undefined */
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

/** 合流前に別々の容器で作っておく液 */
interface Container {
  /** 表示名。例: 先溶かし液 (ACMO+BAPO) */
  name: string
  names: string[]
  grams: number
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

function containerLabel(title: string, names: string[]): string {
  const base = title === '計量' ? '計量した液' : title === 'モノマーカクテル' ? 'モノマーカクテル' : `${title}液`
  return `${base} (${names.join('+')})`
}

/**
 * step 番号ごとに成分をまとめ、工程カードの文言を動的生成する。
 * - 最小 step に開始剤と溶媒が含まれる → 先溶かし工程 (dissolve)。専用の容器で作り、撹拌を続ける
 * - base_component を含む step → 主剤合流工程 (merge)
 * - それ以外 → モノマーカクテル (cocktail)。先溶かし液とは別の容器で作る
 * 合流時に、先溶かし液とモノマーカクテルを両方とも主剤に加える。
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

  const cards: StepCard[] = []
  const containers: Container[] = []
  let dissolve: Container | undefined
  let cocktail: Container | undefined

  for (const step of stepNos) {
    const items = byStep.get(step)!
    const notes = items
      .filter((it) => it.component.note)
      .map((it) => `${it.component.name}: ${it.component.note}`)
    const isMerge = step === mergeStep
    const initiators = items.filter((it) => it.component.role === 'initiator')
    const others = items.filter((it) => it.component.role !== 'initiator')

    if (isMerge) {
      // 加温するのは主剤 (base_component) だけ。同じ工程の他成分は合流後に追加
      const bases = items.filter((it) => it.component.name === recipe.base_component)
      const extras = items.filter((it) => it.component.name !== recipe.base_component)
      let text = `${joinPlus(bases)}（40-50℃加温済み）`
      const liquids: StepItem[] = containers.map((c) => ({
        component: { name: c.name, ratio: 0, role: 'liquid', step },
        grams: c.grams,
      }))
      text +=
        containers.length === 0
          ? 'を容器に取る'
          : `に ${containers.map((c) => c.name).join(' と ')} を全量注ぎ、ヘラで壁面をこそぎながら混合`
      if (extras.length > 0) text += `。さらに ${joinArrow(extras)} を追加して撹拌`
      cards.push({ step, title: '主剤合流', text, items: [...bases, ...liquids, ...extras], notes, kind: 'merge' })
      continue
    }

    // 投入順: 開始剤以外 → 開始剤
    const ordered = [...others, ...initiators]

    if (step === firstStep && initiators.length > 0 && others.length > 0) {
      let cum = 0
      for (const it of ordered) it.cumulative = cum += it.grams
      const text = `${joinPlus(others)} を容器に取り、${joinPlus(initiators)} を少量ずつ加えて溶解`
      cards.push({ step, title: '先溶かし', text, items: ordered, notes, kind: 'dissolve' })
      const names = ordered.map((it) => it.component.name)
      dissolve = { name: containerLabel('先溶かし', names), names, grams: cum }
      containers.push(dissolve)
      continue
    }

    if (cocktail === undefined) {
      // 新しい容器 (先溶かし液とは別)
      let cum = 0
      for (const it of ordered) it.cumulative = cum += it.grams
      const title = dissolve ? 'モノマーカクテル' : '計量'
      const where = dissolve ? '先溶かし液とは別の容器に' : '容器に'
      const tail = dissolve ? '撹拌（先溶かし液は撹拌を続ける）' : '撹拌'
      const text = `${where} ${joinArrow(ordered)} を取り${tail}`
      cards.push({ step, title, text, items: ordered, notes, kind: dissolve ? 'cocktail' : 'generic' })
      const names = ordered.map((it) => it.component.name)
      cocktail = { name: containerLabel(title, names), names, grams: cum }
      containers.push(cocktail)
    } else {
      // 既にあるカクテル容器に追加
      let cum = cocktail.grams
      for (const it of ordered) it.cumulative = cum += it.grams
      const text = `${cocktail.name} の容器に ${joinArrow(ordered)} を追加して撹拌`
      cards.push({ step, title: 'モノマーカクテル', text, items: ordered, notes, kind: 'cocktail' })
      cocktail.grams = cum
      cocktail.names.push(...ordered.map((it) => it.component.name))
      cocktail.name = containerLabel('モノマーカクテル', cocktail.names)
    }
  }
  return cards
}
