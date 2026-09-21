import type { Component, Recipe } from '../types'
import { fmtGrams, ratioSum } from './calc'
import { buildWorkflow, type WorkflowCard } from './workflow'

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

/** 共通ミックスの手順 + 分注 + 個別追加 をカードにする */
export function buildBatchWorkflow(plan: BatchPlan, measuredBase: number | null): WorkflowCard[] {
  if (plan.errors.length > 0) return []
  const scale = measuredBase !== null && measuredBase > 0 ? measuredBase / masterBasePlan(plan) : 1
  const cards = buildWorkflow(plan.master, { targetGrams: plan.masterTotal, measuredBase })
  const splitText = plan.perRecipe.map((p) => `${p.recipe.id} ${fmtGrams(p.masterGrams * scale)} g`).join(' / ')
  cards.push({
    key: 'split',
    title: '分注',
    text: `共通ミックス（計 ${fmtGrams(plan.masterTotal * scale)} g）を ${plan.perRecipe.length} つの容器に分ける: ${splitText}`,
    items: [],
    notes: [],
    kind: 'split',
  })
  for (const p of plan.perRecipe) {
    const items = p.additions.map((a) => ({ component: a.component, grams: a.grams * scale }))
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
  return cards
}

export function masterBasePlan(plan: BatchPlan): number {
  const base = plan.master.components.find((c) => c.name === plan.master.base_component)
  const sum = ratioSum(plan.master)
  return base && sum > 0 ? (plan.masterTotal * base.ratio) / sum : 0
}
