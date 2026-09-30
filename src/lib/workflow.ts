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
  /** 主剤の実測値。未入力 (= 目安どおり) なら null。容器を複数に分ける場合は無視 */
  measuredBase: number | null
  /** 容器 1 つに入れられる上限 (g)。未指定なら分割しない */
  capacityGrams?: number
  /** 分けて入れるときの余裕率 (0.03 = +3%)。容器を分けるときに目標量へ上乗せ */
  splitMargin?: number
  /** 容器を分けなくても余裕を上乗せする (まとめて調合など、後で分注する場合) */
  alwaysMargin?: boolean
}

export interface WorkflowResult {
  cards: WorkflowCard[]
  /** 最終的な容器の数 */
  containers: number
  /** 実際に作る総量 (余裕込み) */
  totalGrams: number
  marginApplied: boolean
}

function toCard(s: StepCard, key: string): WorkflowCard {
  return { key, title: s.title, text: s.text, items: s.items, notes: s.notes, kind: s.kind }
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * 作業手順:
 *  1. 準備: 主剤 (base_component) を小分けして湯煎。加温するのは主剤だけ
 *  2. 先溶かし: 湯煎の間に計画量で作る (一括)
 *  3. 主剤計量: 温まった主剤を目安どおりに計量 (微調整で合わせる)。目安どおりならチェックのみ、
 *     違う値なら入力すると以降の工程 (カクテル・合流) を実測基準で再計算する
 *  4. モノマーカクテル: 先溶かし液とは別容器
 *  5. 主剤合流: 主剤に先溶かし液とカクテルを加える
 *
 * 総量が容器上限を超えるときは、主剤を N 容器に分けて湯煎し、カクテルも上限に収まる数 (A, B, …) に分けて作り、
 * 合流時に各容器へ先溶かし液とカクテルを等分して注ぐ。
 * 先溶かし工程か主剤合流工程が無いレシピは、従来の step 順のまま返す。
 */
export function buildWorkflow(recipe: Recipe, opts: WorkflowOptions): WorkflowResult {
  const cap = opts.capacityGrams && opts.capacityGrams > 0 ? opts.capacityGrams : Infinity
  const m = opts.splitMargin && opts.splitMargin > 0 ? opts.splitMargin : 0
  const n0 = Math.max(1, Math.ceil(opts.targetGrams / cap))
  const marginApplied = m > 0 && (n0 > 1 || !!opts.alwaysMargin)
  const total = marginApplied ? opts.targetGrams * (1 + m) : opts.targetGrams
  const n = Math.max(1, Math.ceil(total / cap))

  const base = findBase(recipe)
  const planCalc = calcFromTarget(recipe, total)
  const planSteps = buildSteps(recipe, planCalc)
  const dissolveIdx = planSteps.findIndex((s) => s.kind === 'dissolve')
  const mergeIdx = planSteps.findIndex((s) => s.kind === 'merge')

  if (!base || dissolveIdx < 0 || mergeIdx < 0) {
    return { cards: planSteps.map((s) => toCard(s, `step:${s.step}`)), containers: 1, totalGrams: total, marginApplied }
  }
  if (n === 1) {
    return { cards: singleFlow(recipe, total, opts.measuredBase), containers: 1, totalGrams: total, marginApplied }
  }

  // ---- 複数容器 ----
  const basePlan = planCalc.amounts.find((a) => a.isBase)!.grams
  const perBase = basePlan / n
  const premix = planSteps[dissolveIdx]
  const premixTotal = premix.items.reduce((s, it) => s + it.grams, 0)
  const cocktailSteps = planSteps.filter((s) => s.kind === 'cocktail' || s.kind === 'generic')
  const cocktailTotal = cocktailSteps.reduce((s, c) => s + c.items.reduce((t, it) => t + it.grams, 0), 0)
  const kPremix = Math.max(1, Math.ceil(premixTotal / cap))
  const mCock = Math.max(1, Math.ceil(cocktailTotal / cap))
  const cards: WorkflowCard[] = []

  cards.push({
    key: 'prep',
    title: '準備',
    text: `${base.name} を ${n} 個の容器に ${fmtGrams(perBase)} g ずつ小分けして湯煎 (40-50℃)。合計 ${fmtGrams(basePlan)} g`,
    items: [],
    notes: [],
    kind: 'prep',
  })

  if (kPremix === 1) {
    cards.push({
      key: 'dissolve',
      title: '先溶かし',
      text: `湯煎の間に 1 容器で一括して作る。${premix.text}`,
      items: premix.items,
      notes: premix.notes,
      kind: 'dissolve',
    })
  } else {
    const part = buildSteps(recipe, calcFromTarget(recipe, total / kPremix))[dissolveIdx]
    for (let i = 0; i < kPremix; i++) {
      const L = LETTERS[i] ?? String(i + 1)
      cards.push({
        key: `dissolve:${L}`,
        title: `先溶かし ${L}`,
        text: `湯煎の間に作る（${kPremix} 容器に分ける、これは ${L}）。${part.text}`,
        items: part.items.map((it) => ({ ...it })),
        notes: part.notes,
        kind: 'dissolve',
      })
    }
  }

  cards.push({
    key: 'measure',
    title: '主剤計量',
    text: `温まった ${base.name} を各容器 ${fmtGrams(perBase)} g に計量（${n} 容器とも、微調整で合わせる）`,
    items: [{ component: base, grams: perBase }],
    notes: [
      `容器を分けているため実測入力は使いません。各容器を目安 ${fmtGrams(perBase)} g に合わせてください`,
      ...planSteps[mergeIdx].notes,
    ],
    kind: 'measure',
    measure: { plan: perBase, measured: null, deviation: 0 },
  })

  if (mCock === 1) {
    for (const s of cocktailSteps) cards.push(toCard(s, `step:${s.step}`))
  } else {
    const partSteps = buildSteps(recipe, calcFromTarget(recipe, total / mCock)).filter(
      (s) => s.kind === 'cocktail' || s.kind === 'generic',
    )
    for (let i = 0; i < mCock; i++) {
      const L = LETTERS[i] ?? String(i + 1)
      for (const s of partSteps) {
        cards.push({
          key: `step:${s.step}:${L}`,
          title: `${s.title} ${L}`,
          text: `【${mCock} 容器に分ける、これは ${L}】${s.text}`,
          items: s.items.map((it) => ({ ...it })),
          notes: s.notes,
          kind: s.kind,
        })
      }
    }
  }

  const merge = planSteps[mergeIdx]
  const liquids = merge.items.filter((it) => it.component.role === 'liquid')
  const extras = merge.items.filter((it) => it.component.role !== 'liquid' && it.component.name !== base.name)
  const perLiquids: StepItem[] = liquids.map((it) => ({ component: it.component, grams: it.grams / n }))
  const perExtras: StepItem[] = extras.map((it) => ({ component: it.component, grams: it.grams / n }))
  let text =
    `${n} 個の各容器（${base.name} ${fmtGrams(perBase)} g、40-50℃加温済み）に ` +
    perLiquids.map((it) => `${it.component.name} ${fmtGrams(it.grams)} g`).join(' と ') +
    ' を注ぎ、ヘラで壁面をこそぎながら混合'
  if (mCock > 1) text += `（カクテルは ${LETTERS.slice(0, mCock).split('').join('/')} から取り分ける）`
  if (perExtras.length > 0) {
    text += `。さらに各容器に ${perExtras.map((it) => `${it.component.name} ${fmtGrams(it.grams)} g`).join(' → ')} を追加して撹拌`
  }
  cards.push({
    key: 'merge',
    title: `主剤合流（${n} 容器）`,
    text,
    items: [{ component: base, grams: perBase }, ...perLiquids, ...perExtras],
    notes: merge.notes,
    kind: 'merge',
  })
  return { cards, containers: n, totalGrams: total, marginApplied }
}

function singleFlow(recipe: Recipe, total: number, measuredBase: number | null): WorkflowCard[] {
  const base = findBase(recipe)!
  const planCalc = calcFromTarget(recipe, total)
  const measured = measuredBase !== null && measuredBase > 0 ? measuredBase : null
  const actualCalc = measured !== null ? calcFromBase(recipe, measured) : planCalc
  const planSteps = buildSteps(recipe, planCalc)
  const actualSteps = buildSteps(recipe, actualCalc)
  const dissolveIdx = planSteps.findIndex((s) => s.kind === 'dissolve')
  const mergeIdx = planSteps.findIndex((s) => s.kind === 'merge')

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
