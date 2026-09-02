export type Role = 'oligomer' | 'diluent' | 'crosslinker' | 'initiator' | 'blocker' | (string & {})

export type RecipeStatus = 'active' | 'archived' | 'experimental'

export interface Component {
  name: string
  ratio: number
  role: Role
  step: number
  note?: string
}

export interface PrintProfile {
  exposure_s?: number
  bottom_layers?: number
  bottom_exposure_s?: number
  layer_mm?: number
  rest_after_retract_s?: number
  [key: string]: number | string | undefined
}

export interface Recipe {
  id: string
  status: RecipeStatus
  date?: string
  base_component: string
  components: Component[]
  print_profile?: PrintProfile
  notes?: string
}

export interface RecipeFile {
  schema_version: number
  recipes: Recipe[]
}

/** 一覧表示用。origin で recipes.json 由来かローカル(インポート)かを区別する */
export interface RecipeEntry {
  recipe: Recipe
  origin: 'remote' | 'local'
}

export const ROLE_LABEL: Record<string, string> = {
  oligomer: '主剤',
  diluent: '希釈剤',
  crosslinker: '架橋剤',
  initiator: '開始剤',
  blocker: 'ブロッカー',
}

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role
}

export const STATUS_LABEL: Record<RecipeStatus, string> = {
  active: '採用',
  experimental: '試作',
  archived: '過去',
}

export const PRINT_PROFILE_LABEL: Record<string, { label: string; unit: string }> = {
  layer_mm: { label: '積層ピッチ', unit: 'mm' },
  exposure_s: { label: '露光時間', unit: 's' },
  bottom_layers: { label: '底面層数', unit: '層' },
  bottom_exposure_s: { label: '底面露光', unit: 's' },
  rest_after_retract_s: { label: 'リトラクト後待機', unit: 's' },
}
