import { useState } from 'react'
import type { Recipe } from '../types'
import { parseRecipeText } from '../lib/validate'

interface Props {
  local: Recipe[]
  onImport: (recipes: Recipe[]) => void
  onRemove: (id: string) => void
}

const PLACEHOLDER = `{
  "schema_version": 1,
  "recipes": [ { "id": "B-3", "status": "experimental", ... } ]
}
または単一レシピ { "id": "B-3", ... } を貼り付け`

export function ImportView({ local, onImport, onRemove }: Props) {
  const [text, setText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')

  const doImport = () => {
    const res = parseRecipeText(text)
    if (!res.ok) {
      setErrors(res.errors)
      setMessage('')
      return
    }
    onImport(res.recipes)
    setErrors([])
    setMessage(`${res.recipes.length} 件をインポートしました: ${res.recipes.map((r) => r.id).join(', ')}`)
    setText('')
  }

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setText(t)
    } catch {
      setErrors(['クリップボードを読めませんでした。テキストエリアに手動で貼り付けてください'])
    }
  }

  return (
    <div className="page">
      <div className="card">
        <p className="muted">
          チャットで出力した JSON（recipes.json 全体でも単一レシピでも可）を貼り付けてください。
          インポートしたレシピはこの端末に保存され、同じ id の recipes.json より優先されます。
        </p>
        <textarea
          className="json-input"
          rows={10}
          placeholder={PLACEHOLDER}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <div className="btn-row">
          <button type="button" className="btn btn-ghost" onClick={paste}>
            クリップボードから貼り付け
          </button>
          <button type="button" className="btn btn-primary" onClick={doImport} disabled={text.trim() === ''}>
            インポート
          </button>
        </div>
        {errors.length > 0 && (
          <ul className="error-list">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        {message && <p className="ok-box">{message}</p>}
      </div>

      <h2 className="section-title">この端末のレシピ ({local.length})</h2>
      {local.length === 0 ? (
        <p className="muted">インポート済みレシピはありません</p>
      ) : (
        <div className="card-list">
          {local.map((r) => (
            <div key={r.id} className="card local-row">
              <a href={`#/r/${encodeURIComponent(r.id)}`} className="local-link">
                <span className="recipe-id">{r.id}</span>
                <span className="muted"> {r.date ?? ''}</span>
              </a>
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() => {
                  if (window.confirm(`${r.id} をこの端末から削除しますか？`)) onRemove(r.id)
                }}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
