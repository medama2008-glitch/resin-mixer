import { useState } from 'react'
import type { RecipeEntry, RecipeStatus } from '../types'
import { STATUS_LABEL } from '../types'
import type { RemoteState } from '../useRecipes'

interface Props {
  entries: RecipeEntry[]
  remoteState: RemoteState
  onRefresh: () => void
}

function RecipeCard({ entry }: { entry: RecipeEntry }) {
  const { recipe, origin } = entry
  const notesHead = recipe.notes ? recipe.notes.slice(0, 60) + (recipe.notes.length > 60 ? '…' : '') : ''
  return (
    <a className="card recipe-card" href={`#/r/${encodeURIComponent(recipe.id)}`}>
      <div className="recipe-card-head">
        <span className="recipe-id">{recipe.id}</span>
        <span className={`badge status-${recipe.status}`}>{STATUS_LABEL[recipe.status]}</span>
        {origin === 'local' && <span className="badge badge-local">ローカル</span>}
      </div>
      <div className="recipe-meta">
        {recipe.date && <span>{recipe.date}</span>}
        <span>{recipe.components.length} 成分 / 主剤 {recipe.base_component}</span>
      </div>
      {notesHead && <p className="recipe-notes">{notesHead}</p>}
    </a>
  )
}

export function RecipeList({ entries, remoteState, onRefresh }: Props) {
  const [showArchived, setShowArchived] = useState(false)
  const visible = entries.filter((e) => e.recipe.status !== 'archived')
  const archived = entries.filter((e) => e.recipe.status === 'archived')
  const counts = entries.reduce<Record<RecipeStatus, number>>(
    (acc, e) => ((acc[e.recipe.status] += 1), acc),
    { active: 0, experimental: 0, archived: 0 },
  )

  return (
    <div className="page">
      <div className="toolbar">
        <div className="status-line">
          {remoteState.kind === 'loading' && <span className="muted">recipes.json 取得中…</span>}
          {remoteState.kind === 'ok' && <span className="muted">最新のレシピを取得済み</span>}
          {remoteState.kind === 'error' && (
            <span className="warn">
              {remoteState.fromCache ? 'オフライン: 前回取得分を表示中' : 'recipes.json を取得できません'}
            </span>
          )}
        </div>
        <button type="button" className="btn btn-small" onClick={onRefresh}>
          再取得
        </button>
      </div>
      {remoteState.kind === 'error' && !remoteState.fromCache && (
        <pre className="error-box">{remoteState.message}</pre>
      )}

      {visible.length === 0 && remoteState.kind !== 'loading' && (
        <p className="empty">
          表示できるレシピがありません。<a href="#/import">インポート</a>から JSON を貼り付けるか、
          recipes.json を更新してください。
        </p>
      )}
      <div className="card-list">
        {visible.map((e) => (
          <RecipeCard key={`${e.origin}-${e.recipe.id}`} entry={e} />
        ))}
      </div>

      {archived.length > 0 && (
        <div className="archived">
          <button
            type="button"
            className="btn btn-ghost btn-block"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? '▾' : '▸'} 過去レシピ ({counts.archived})
          </button>
          {showArchived && (
            <div className="card-list">
              {archived.map((e) => (
                <RecipeCard key={`${e.origin}-${e.recipe.id}`} entry={e} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
