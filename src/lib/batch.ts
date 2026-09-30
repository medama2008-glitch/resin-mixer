import type { Component, Recipe } from '../types'
import { fmtGrams, ratioSum } from './calc'
import { buildWorkflow, type WorkflowResult } from './workflow'

export interface BatchInput {
  recipe: Recipe
  targetGrams: number
}

export interface Addition {
  component: Component
  grams: number
}

export interface BatchRecipePlan {
  recipe: Recipe
  targetGrams: number
  /** 共通ミックスから分け取る量 */
  masterGrams: number
  /** 分け取った後に個別に加える成分 */
  additions: Addition[]
}

export interface BatchPlan {
  /** 共通部分だけを取り出した合成レシピ。ratio は各レシピの総量に対する wt% */
  master: Recipe
  masterTotal: number
  /** 共通部分が各レシピに占める割合 (0-1) */
  sharedFraction: number
  perRecipe: BatchRecipePlan[]
  errors: string[]
}

const EPS = 1e-9

/**
 * 複数レシピをまとめて調合する計画を作る。
 * 各成分について「全レシピに共通する最小の比率」を共通ミックスに回し、
 * 残り (各レシピの比率 − 最小) を分注後に個別に加える。
 * 濃度だけ違うレシピ群なら、差分の成分だけが個別追加になる。
 */
export function buildBatch(inputs: BatchInput[]): BatchPlan {
  const errors: string[] = []
  const valid = inputs.filter((i) => i.targetGrams > 0)
  if (valid.length < 2) errors.push('レシピを 2 つ以上選び、バッチ量を入れてください')
  const bases = new Set(valid.map((i) => i.recipe.base_component))
  if (bases.size > 1) errors.push(`主剤が異なるレシピは同時に調合できません (${[...bases].join(', ')})`)
  if (errors.length > 0) {
    return { master: emptyMaster(), masterTotal: 0, sharedFraction: 0, perRecipe: [], errors }
  }

  // 各レシピの成分を総量に対する割合に正規化
  const fractions = valid.map((i) => {
    const sum = ratioSum(i.recipe)
    const m = new Map<string, number>()
    for (const c of i.recipe.components) m.set(c.name, sum > 0 ? c.ratio / sum : 0)
    return m
  })
  // 成分名の登場順 (最初のレシピから順に)
  const names: string[] = []
  const meta = new Map<string, Component>()
  for (const i of valid) {
    for (const c of i.recipe.components) {
      if (!meta.has(c.name)) {
        meta.set(c.name, c)
        names.push(c.name)
      }
    }
  }
  const shared = new Map<string, number>()
  for (const n of names) {
    shared.set(n, Math.min(...fractions.map((f) => f.get(n) ?? 0)))
  }
  const sharedFraction = [...shared.values()].reduce((s, v) => s + v, 0)
  const baseName = valid[0].recipe.base_component
  if ((shared.get(baseName) ?? 0) <= EPS) errors.push('主剤が共通部分に含まれません')

  const master: Recipe = {
    id: '共通ミックス',
    status: 'experimental',
    base_component: baseName,
    components: names
      .filter((n) => (shared.get(n) ?? 0) > EPS)
      .map((n) => ({ ...meta.get(n)!, ratio: shared.get(n)! * 100 })),
  }
  const perRecipe: BatchRecipePlan[] = valid.map((i, k) => {
    const additions: Addition[] = []
    for (const c of i.recipe.components) {
      const extra = (fractions[k].get(c.name) ?? 0) - (shared.get(c.name) ?? 0)
      if (extra > EPS) additions.push({ component: c, grams: i.targetGrams * extra })
    }
    additions.sort((a, b) => a.component.step - b.component.step)
    return { recipe: i.recipe, targetGrams: i.targetGrams, masterGrams: i.targetGrams * sharedFraction, additions }
  })
  const masterTotal = perRecipe.reduce((s, p) => s + p.masterGrams, 0)
  return { master, masterTotal, sharedFraction, perRecipe, errors }
}

function emptyMaster(): Recipe {
  return { id: '共通ミックス', status: 'experimental', base_component: '', components: [] }
}

export interface BatchWorkflowOptions {
  measuredBase: number | null
  capacityGrams?: number
  splitMargin?: number
}

export interface BatchWorkflowResult extends WorkflowResult {
  /** 実測入力による倍率 (容器 1 つのときのみ。それ以外は 1) */
  scale: number
  /** 分注後に余る共通ミックス (g) */
  leftover: number
}

/** 共通ミックスの手順 + 分注 + 個別追加 をカードにする。分注するので余裕率は常に上乗せする */
export function buildBatchWorkflow(plan: BatchPlan, opts: BatchWorkflowOptions): BatchWorkflowResult {
  if (plan.errors.length > 0) return { cards: [], containers: 1, totalGrams: 0, marginApplied: false, scale: 1, leftover: 0 }
  const res = buildWorkflow(plan.master, {
    targetGrams: plan.masterTotal,
    measuredBase: opts.measuredBase,
    capacityGrams: opts.capacityGrams,
    splitMargin: opts.splitMargin,
    alwaysMargin: true,
  })
  const measurePlan = res.cards.find((c) => c.kind === 'measure')?.measure?.plan ?? 0
  const scale =
    res.containers === 1 && opts.measuredBase !== null && opts.measuredBase > 0 && measurePlan > 0
      ? opts.measuredBase / measurePlan
      : 1
  const made = res.totalGrams * scale
  const need = plan.perRecipe.reduce((s, p) => s + p.masterGrams, 0)
  const leftover = made - need
  const cards = [...res.cards]
  const splitText = plan.perRecipe.map((p) => `${p.recipe.id} ${fmtGrams(p.masterGrams)} g`).join(' / ')
  const from = res.containers > 1 ? `${res.containers} 容器の共通ミックス` : '共通ミックス'
  cards.push({
    key: 'split',
    title: '分注',
    text:
      `${from}（計 ${fmtGrams(made)} g${res.marginApplied ? '、余裕込み' : ''}）から各レシピの容器に取り分ける: ${splitText}` +
      (leftover > 0.005 ? `（余り ${fmtGrams(leftover)} g）` : ''),
    items: [],
    notes: [],
    kind: 'split',
  })
  for (const p of plan.perRecipe) {
    const items = p.additions.map((a) => ({ component: a.component, grams: a.grams }))
    const text =
      items.length === 0
        ? `${p.recipe.id}: 追加なし（共通ミックスのまま）`
        : `${p.recipe.id} の容器に ${items.map((it) => `${it.component.name} ${fmtGrams(it.grams)} g`).join(' → ')} を追加して撹拌`
    cards.push({
      key: `individual:${p.recipe.id}`,
      title: `個別追加 ${p.recipe.id}`,
      text,
      items,
      notes: items.filter((it) => it.component.note).map((it) => `${it.component.name}: ${it.component.note}`),
      kind: 'individual',
    })
  }
  return { ...res, cards, scale, leftover }
}
