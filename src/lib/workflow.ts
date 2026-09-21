import type { Recipe } from '../types'
import { calcFromBase, calcFromTarget, findBase, fmtGrams } from './calc'
import { buildSteps, type StepCard, type StepItem, type StepKind } from './steps'

export type WorkflowKind = StepKind | 'prep' | 'measure' | 'split' | 'individual'

export interface WorkflowCard {
  /** チェック状態のキー。並びが変わっても安定するように意味ベースにする */
  key: string
  title: string
  text: string
  items: StepItem[]
  notes: string[]
  kind: WorkflowKind
  /** 主剤計量カードの情報 */
  measure?: {
    plan: number
    measured: number | null
    /** 実測 / 目安 − 1。実測未入力なら 0 */
    deviation: number
  }
}

export interface WorkflowOptions {
  targetGrams: number
  /** 主剤の実測値。未入力 (= 目安どおり) なら null */
  measuredBase: number | null
}

function toCard(s: StepCard, key: string): WorkflowCard {
  return { key, title: s.title, text: s.text, items: s.items, notes: s.notes, kind: s.kind }
}

/**
 * 作業手順:
 *  1. 準備: 主剤 (base_component) を小分けして湯煎。加温するのは主剤だけ
 *  2. 先溶かし: 湯煎の間に計画量で作る
 *  3. 主剤計量: 温まった主剤を目安どおりに計量 (微調整で合わせる)。目安どおりならチェックのみ、
 *     違う値なら入力すると以降の工程 (カクテル・合流) を実測基準で再計算する
 *  4. モノマーカクテル
 *  5. 主剤合流
 *
 * 先溶かし工程か主剤合流工程が無いレシピは、従来の step 順のまま返す。
 */
export function buildWorkflow(recipe: Recipe, opts: WorkflowOptions): WorkflowCard[] {
  const base = findBase(recipe)
  const planCalc = calcFromTarget(recipe, opts.targetGrams)
  const measured = opts.measuredBase !== null && opts.measuredBase > 0 ? opts.measuredBase : null
  const actualCalc = measured !== null ? calcFromBase(recipe, measured) : planCalc
  const planSteps = buildSteps(recipe, planCalc)
  const actualSteps = buildSteps(recipe, actualCalc)

  const dissolveIdx = planSteps.findIndex((s) => s.kind === 'dissolve')
  const mergeIdx = planSteps.findIndex((s) => s.kind === 'merge')
  if (!base || dissolveIdx < 0 || mergeIdx < 0) {
    return actualSteps.map((s) => toCard(s, `step:${s.step}`))
  }

  const basePlan = planCalc.amounts.find((a) => a.isBase)!.grams
  const deviation = measured !== null && basePlan > 0 ? measured / basePlan - 1 : 0
  const cards: WorkflowCard[] = []

  cards.push({
    key: 'prep',
    title: '準備',
    text: `${base.name} を小分けして湯煎 (40-50℃)。目安 ${fmtGrams(basePlan)} g`,
    items: [],
    notes: [],
    kind: 'prep',
  })

  // 先溶かし液は主剤計量の前に作るので常に計画量
  const premix = planSteps[dissolveIdx]
  cards.push({
    key: 'dissolve',
    title: '先溶かし',
    text: `湯煎の間に作る。${premix.text}`,
    items: premix.items,
    notes: premix.notes,
    kind: 'dissolve',
  })

  const measureNotes = [...planSteps[mergeIdx].notes]
  if (Math.abs(deviation) > 0.01) {
    measureNotes.unshift(
      `目安から ${deviation > 0 ? '+' : ''}${(deviation * 100).toFixed(1)}% ずれています。先溶かし液は計画量で作成済みなので、以降の工程だけ実測基準で再計算します。可能なら ${base.name} を目安に合わせ直してください`,
    )
  }
  cards.push({
    key: 'measure',
    title: '主剤計量',
    text: `温まった ${base.name} を ${fmtGrams(basePlan)} g 計量（微調整で目安に合わせる）`,
    items: [{ component: base, grams: measured ?? basePlan }],
    notes: measureNotes,
    kind: 'measure',
    measure: { plan: basePlan, measured, deviation },
  })

  for (const s of actualSteps) {
    if (s.kind === 'dissolve' || s.kind === 'merge') continue
    cards.push(toCard(s, `step:${s.step}`))
  }
  cards.push(toCard(actualSteps[mergeIdx], 'merge'))
  return cards
}
