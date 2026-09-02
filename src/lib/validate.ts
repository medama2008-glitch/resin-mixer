import type { Recipe, RecipeFile } from '../types'

export const SCHEMA_VERSION = 1
const STATUSES = ['active', 'archived', 'experimental']

export interface ValidationResult {
  ok: boolean
  recipes: Recipe[]
  errors: string[]
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function validateRecipe(r: unknown, path: string, errors: string[]): Recipe | null {
  if (!isObj(r)) {
    errors.push(`${path} がオブジェクトではありません`)
    return null
  }
  const before = errors.length
  if (typeof r.id !== 'string' || r.id.trim() === '') errors.push(`${path}.id は空でない文字列が必要です`)
  if (typeof r.status !== 'string' || !STATUSES.includes(r.status)) {
    errors.push(`${path}.status は ${STATUSES.join(' | ')} のいずれかが必要です`)
  }
  if (r.date !== undefined && typeof r.date !== 'string') errors.push(`${path}.date は文字列が必要です`)
  if (typeof r.base_component !== 'string' || r.base_component === '') {
    errors.push(`${path}.base_component は文字列が必要です`)
  }
  if (!Array.isArray(r.components) || r.components.length === 0) {
    errors.push(`${path}.components は1件以上の配列が必要です`)
  } else {
    const names = new Set<string>()
    r.components.forEach((c, i) => {
      const p = `${path}.components[${i}]`
      if (!isObj(c)) {
        errors.push(`${p} がオブジェクトではありません`)
        return
      }
      if (typeof c.name !== 'string' || c.name === '') errors.push(`${p}.name は文字列が必要です`)
      else {
        if (names.has(c.name)) errors.push(`${p}.name "${c.name}" が重複しています`)
        names.add(c.name)
      }
      if (typeof c.ratio !== 'number' || !Number.isFinite(c.ratio)) errors.push(`${p}.ratio が数値ではありません`)
      else if (c.ratio < 0) errors.push(`${p}.ratio が負の値です`)
      if (typeof c.role !== 'string' || c.role === '') errors.push(`${p}.role は文字列が必要です`)
      if (typeof c.step !== 'number' || !Number.isInteger(c.step) || c.step < 1) {
        errors.push(`${p}.step は1以上の整数が必要です`)
      }
      if (c.note !== undefined && typeof c.note !== 'string') errors.push(`${p}.note は文字列が必要です`)
    })
    if (typeof r.base_component === 'string' && r.base_component !== '' && !names.has(r.base_component)) {
      errors.push(`${path}.base_component "${r.base_component}" が components に存在しません`)
    }
  }
  if (r.print_profile !== undefined) {
    if (!isObj(r.print_profile)) errors.push(`${path}.print_profile はオブジェクトが必要です`)
    else {
      for (const [k, v] of Object.entries(r.print_profile)) {
        if (typeof v !== 'number' && typeof v !== 'string') {
          errors.push(`${path}.print_profile.${k} は数値または文字列が必要です`)
        }
      }
    }
  }
  if (r.notes !== undefined && typeof r.notes !== 'string') errors.push(`${path}.notes は文字列が必要です`)
  return errors.length === before ? (r as unknown as Recipe) : null
}

/**
 * recipes.json 全体 / 単一レシピ / レシピ配列 のいずれかを受け付けて検証する。
 */
export function validateInput(data: unknown): ValidationResult {
  const errors: string[] = []
  const recipes: Recipe[] = []

  if (Array.isArray(data)) {
    data.forEach((r, i) => {
      const v = validateRecipe(r, `[${i}]`, errors)
      if (v) recipes.push(v)
    })
  } else if (isObj(data) && 'recipes' in data) {
    if (data.schema_version !== SCHEMA_VERSION) {
      errors.push(`schema_version が ${SCHEMA_VERSION} ではありません (${String(data.schema_version)})`)
    }
    if (!Array.isArray(data.recipes)) errors.push('recipes が配列ではありません')
    else {
      data.recipes.forEach((r, i) => {
        const v = validateRecipe(r, `recipes[${i}]`, errors)
        if (v) recipes.push(v)
      })
    }
  } else if (isObj(data)) {
    const v = validateRecipe(data, 'recipe', errors)
    if (v) recipes.push(v)
  } else {
    errors.push('JSON のトップレベルがオブジェクトでも配列でもありません')
  }

  const ids = new Set<string>()
  for (const r of recipes) {
    if (ids.has(r.id)) errors.push(`id "${r.id}" が重複しています`)
    ids.add(r.id)
  }
  return { ok: errors.length === 0, recipes: errors.length === 0 ? recipes : [], errors }
}

export function parseRecipeText(text: string): ValidationResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, recipes: [], errors: [`JSON の構文エラー: ${(e as Error).message}`] }
  }
  return validateInput(data)
}

export function validateRecipeFile(data: unknown): RecipeFile {
  const res = validateInput(data)
  if (!res.ok) throw new Error(res.errors.join('\n'))
  return { schema_version: SCHEMA_VERSION, recipes: res.recipes }
}
