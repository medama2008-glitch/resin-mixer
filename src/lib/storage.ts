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

const RESOLUTION_KEY = 'resinmixer.gramResolution'

/** 表示単位。既定は 0.1 g (coarse) */
export function loadResolution(): 'coarse' | 'fine' {
  return read<string>(RESOLUTION_KEY, 'coarse') === 'fine' ? 'fine' : 'coarse'
}

export function saveResolution(r: 'coarse' | 'fine') {
  write(RESOLUTION_KEY, r)
}

const CONTAINER_KEY = 'resinmixer.container.v1'

export interface ContainerSettings {
  /** 容器 1 つの上限 (mL) */
  capacityMl: number
  /** 液の密度 (g/mL)。mL → g の換算に使う */
  density: number
  /** 分けて入れるときの余裕 (%) */
  marginPct: number
}

export const DEFAULT_CONTAINER: ContainerSettings = { capacityMl: 650, density: 1.1, marginPct: 3 }

export function loadContainerSettings(): ContainerSettings {
  const v = read<Partial<ContainerSettings>>(CONTAINER_KEY, {})
  const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : d)
  return {
    capacityMl: num(v.capacityMl, DEFAULT_CONTAINER.capacityMl),
    density: num(v.density, DEFAULT_CONTAINER.density) || DEFAULT_CONTAINER.density,
    marginPct: num(v.marginPct, DEFAULT_CONTAINER.marginPct),
  }
}

export function saveContainerSettings(c: ContainerSettings) {
  write(CONTAINER_KEY, c)
}

export type ThemePref = 'auto' | 'light' | 'dark'

export function loadTheme(): ThemePref {
  const t = read<string>(THEME_KEY, 'auto')
  return t === 'light' || t === 'dark' ? t : 'auto'
}

export function saveTheme(t: ThemePref) {
  write(THEME_KEY, t)
}
