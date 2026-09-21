import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { RecipeEntry } from '../types'
import { validateInput } from '../lib/validate'
import { RecipeView } from './RecipeView'
import { BatchView } from './BatchView'
import { WorkflowCards } from './WorkflowCards'
import { buildBatch, buildBatchWorkflow } from '../lib/batch'

// 実レシピで各画面が例外なく描画できることの確認 (SSR)
const raw = readFileSync(new URL('../../public/recipes.json', import.meta.url), 'utf8')
const recipes = validateInput(JSON.parse(raw)).recipes
const entries: RecipeEntry[] = recipes.map((r) => ({ recipe: r, origin: 'remote' }))
const noop = () => {}

describe('画面のスモーク描画', () => {
  it('RecipeView が全レシピで描画できる', () => {
    for (const r of recipes) {
      const html = renderToString(
        <RecipeView recipe={r} isLocal={false} resolution="coarse" onResolutionChange={noop} />,
      )
      expect(html, r.id).toContain('目標バッチ量')
    }
  })
  it('BatchView が描画できる', () => {
    const html = renderToString(<BatchView entries={entries} resolution="coarse" onResolutionChange={noop} />)
    expect(html).toContain('レシピを選ぶ')
  })
  it('WorkflowCards が分注・個別追加カードを描画できる', () => {
    const pick = recipes.filter((r) => ['B-4FG10', 'B-4FG20', 'B-4F-OB'].includes(r.id))
    expect(pick.length).toBe(3)
    const plan = buildBatch(pick.map((r) => ({ recipe: r, targetGrams: 100 })))
    expect(plan.errors).toEqual([])
    const html = renderToString(<WorkflowCards cards={buildBatchWorkflow(plan, null)} />)
    expect(html).toContain('分注')
    expect(html).toContain('個別追加 B-4FG20')
  })
})
