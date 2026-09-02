import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Recipe, RecipeEntry } from './types'
import { validateInput } from './lib/validate'
import { loadLocalRecipes, loadRemoteCache, saveLocalRecipes, saveRemoteCache } from './lib/storage'

export type RemoteState =
  | { kind: 'loading' }
  | { kind: 'ok'; fromCache: boolean }
  | { kind: 'error'; message: string; fromCache: boolean }

const RECIPES_URL = `${import.meta.env.BASE_URL}recipes.json`

export function useRecipes() {
  const [remote, setRemote] = useState<Recipe[]>(() => loadRemoteCache() ?? [])
  const [remoteState, setRemoteState] = useState<RemoteState>({ kind: 'loading' })
  const [local, setLocal] = useState<Recipe[]>(() => loadLocalRecipes())

  const refresh = useCallback(async () => {
    setRemoteState({ kind: 'loading' })
    try {
      const res = await fetch(RECIPES_URL, { cache: 'no-cache' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: unknown = await res.json()
      const v = validateInput(data)
      if (!v.ok) throw new Error(`recipes.json の検証エラー:\n${v.errors.join('\n')}`)
      setRemote(v.recipes)
      saveRemoteCache(v.recipes)
      setRemoteState({ kind: 'ok', fromCache: false })
    } catch (e) {
      const cached = loadRemoteCache()
      const fromCache = cached !== null && cached.length > 0
      setRemoteState({ kind: 'error', message: (e as Error).message, fromCache })
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const entries = useMemo<RecipeEntry[]>(() => {
    const map = new Map<string, RecipeEntry>()
    for (const r of remote) map.set(r.id, { recipe: r, origin: 'remote' })
    for (const r of local) map.set(r.id, { recipe: r, origin: 'local' }) // 同 id はローカル優先
    return [...map.values()].sort((a, b) => (b.recipe.date ?? '').localeCompare(a.recipe.date ?? ''))
  }, [remote, local])

  const importRecipes = useCallback((recipes: Recipe[]) => {
    setLocal((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]))
      for (const r of recipes) map.set(r.id, r)
      const next = [...map.values()]
      saveLocalRecipes(next)
      return next
    })
  }, [])

  const removeLocal = useCallback((id: string) => {
    setLocal((prev) => {
      const next = prev.filter((r) => r.id !== id)
      saveLocalRecipes(next)
      return next
    })
  }, [])

  return { entries, local, remoteState, refresh, importRecipes, removeLocal }
}
