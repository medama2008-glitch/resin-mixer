import type { Recipe } from '../types'

const LOCAL_KEY = 'resinmixer.localRecipes.v1'
const CACHE_KEY = 'resinmixer.remoteCache.v1'
const THEME_KEY = 'resinmixer.theme'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* 容量超過やプライベートモードは無視 */
  }
}

export function loadLocalRecipes(): Recipe[] {
  return read<Recipe[]>(LOCAL_KEY, [])
}

export function saveLocalRecipes(recipes: Recipe[]) {
  write(LOCAL_KEY, recipes)
}

/** SW キャッシュに加えて、アプリ側でも最後に取得した recipes.json を保持する */
export function loadRemoteCache(): Recipe[] | null {
  return read<Recipe[] | null>(CACHE_KEY, null)
}

export function saveRemoteCache(recipes: Recipe[]) {
  write(CACHE_KEY, recipes)
}

export type ThemePref = 'auto' | 'light' | 'dark'

export function loadTheme(): ThemePref {
  const t = read<string>(THEME_KEY, 'auto')
  return t === 'light' || t === 'dark' ? t : 'auto'
}

export function saveTheme(t: ThemePref) {
  write(THEME_KEY, t)
}
