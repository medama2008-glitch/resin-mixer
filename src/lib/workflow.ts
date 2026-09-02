import type { Recipe } from '../types'
import { calcFromBase, calcFromTarget, findBase, fmtGrams } from './calc'
import { buildSteps, type StepCard, type StepItem, type StepKind } from './steps'

export type WorkflowKind = StepKind | 'prep' | 'measure' | 'adjust'

export interface WorkflowCard {
  /** チェック状態のキー。並びが変わっても安定するように意味ベースにする */
  key: string
  title: string
  text: string
  items: StepItem[]
  notes: string[]
  kind: WorkflowKind
  /** 主剤計量カードの情報 */
  measure?: { plan: number; lower: number; upper: number; measured: number | null }
  /** 先溶かし液の調整カードの情報 */
  adjust?: {
    made: number
    needed: number
    /** 抜く量 (g)。負なら不足 */
    remove: number
    /** 不足時に主剤をどれだけ減らせば足りるか (g) */
    baseReduction: number
  }
}

export interface WorkflowOptions {
  targetGrams: number
  /** 主剤の実測値。未入力なら null */
  measuredBase: number | null
  /** 先溶かし液の余裕率 (0.05 = +5%) */
  margin: number
  /** 実際に作った先溶かし液の質量。未入力なら計画量×(1+margin) */
  premixActual: number | null
}

function toCard(s: StepCard, key: string): WorkflowCard {
  return { key, title: s.title, text: s.text, items: s.items, notes: s.notes, kind: s.kind }
}

/**
 * 作業手順を「湯煎と並行して先溶かし液を余裕付きで作り、主剤の実測後に余剰を抜く」流れに組み替える。
 *
 *  1. 準備: 主剤を小分けして湯煎
 *  2. 先溶かし (余裕 +margin): 計画量 × (1+margin)
 *  3. 主剤計量: 温まった主剤を計量 → 実測入力。許容範囲を表示
 *  4. 先溶かし液の調整: 作った量 − 実測基準の必要量 を抜く
 *  5. モノマーカクテル: 実測基準の量
 *  6. 主剤合流
 *
 * 先溶かし工程 (initiator を含む最小 step) か主剤合流工程が無いレシピは、従来の step 順のまま返す。
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

  const margin = Math.max(0, opts.margin)
  const basePlan = planCalc.amounts.find((a) => a.isBase)!.grams
  const upper = basePlan * (1 + margin)
  const lower = basePlan * (1 - margin)

  // 先溶かし液: 計画量 × (1+margin) で作る
  const premixCalc = calcFromTarget(recipe, opts.targetGrams * (1 + margin))
  const premixStep = buildSteps(recipe, premixCalc)[dissolveIdx]
  const premixPlanMade = premixStep.items.reduce((s, it) => s + it.grams, 0)
  const made = opts.premixActual !== null && opts.premixActual > 0 ? opts.premixActual : premixPlanMade
  const dissolveStepNo = planSteps[dissolveIdx].step
  const premixRatioSum = recipe.components
    .filter((c) => c.step === dissolveStepNo)
    .reduce((s, c) => s + c.ratio, 0)
  const needed = measured !== null ? (measured / base.ratio) * premixRatioSum : null

  const cards: WorkflowCard[] = []

  cards.push({
    key: 'prep',
    title: '準備',
    text: `${base.name} を ${fmtGrams(upper)} g 以上小分けして湯煎 (40-50℃)。目安 ${fmtGrams(basePlan)} g`,
    items: [],
    notes: [],
    kind: 'prep',
  })

  cards.push({
    key: 'dissolve',
    title: `先溶かし (余裕 +${Math.round(margin * 100)}%)`,
    text: `湯煎の間に作る。${premixStep.text}（計 ${fmtGrams(premixPlanMade)} g）`,
    items: premixStep.items,
    notes: premixStep.notes,
    kind: 'dissolve',
  })

  const measureItem: StepItem = {
    component: base,
    grams: measured ?? basePlan,
  }
  cards.push({
    key: 'measure',
    title: '主剤計量',
    text:
      `温まった ${base.name} を計量して実測値を入力。` +
      `許容 ${fmtGrams(lower)}〜${fmtGrams(upper)} g（上限を超えると先溶かし液が不足。下回るのは可、バッチが小さくなるだけ）`,
    items: [measureItem],
    notes: planSteps[mergeIdx].notes,
    kind: 'measure',
    measure: { plan: basePlan, lower, upper, measured },
  })

  if (needed === null) {
    cards.push({
      key: 'adjust',
      title: '先溶かし液の調整',
      text: `${base.name} の実測値を入力すると抜く量を表示します（作った量 ${fmtGrams(made)} g）`,
      items: [],
      notes: [],
      kind: 'adjust',
    })
  } else {
    const remove = made - needed
    const baseReduction = remove < 0 ? (-remove / premixRatioSum) * base.ratio : 0
    const text =
      remove >= 0
        ? `先溶かし液の容器をはかりに載せて風袋引きし、表示が −${fmtGrams(remove)} g になるまで抜く（残り ${fmtGrams(needed)} g）`
        : `先溶かし液が ${fmtGrams(-remove)} g 不足。${base.name} を ${fmtGrams(baseReduction)} g 減らして再計量するか、先溶かし液を追加で作る`
    cards.push({
      key: 'adjust',
      title: '先溶かし液の調整',
      text,
      items: [],
      notes: [],
      kind: 'adjust',
      adjust: { made, needed, remove, baseReduction },
    })
  }

  for (const s of actualSteps) {
    if (s.kind === 'dissolve' || s.kind === 'merge') continue
    cards.push(toCard(s, `step:${s.step}`))
  }

  cards.push(toCard(actualSteps[mergeIdx], 'merge'))
  return cards
}
