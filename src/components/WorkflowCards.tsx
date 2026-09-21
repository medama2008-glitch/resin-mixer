import { useState, type ReactNode } from 'react'
import { roleLabel } from '../types'
import { fmtGrams } from '../lib/calc'
import type { WorkflowCard } from '../lib/workflow'

interface Props {
  cards: WorkflowCard[]
  /** 主剤計量カードの中に描く追加 UI (実測入力など) */
  renderMeasure?: (card: WorkflowCard) => ReactNode
}

/**
 * 工程カードの一覧。材料ごとのチェックと、全材料チェックで自動的に入る工程チェック。
 * 材料の無いカード (準備・計量・分注など) は工程チェックのみ。
 */
export function WorkflowCards({ cards, renderMeasure }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const itemKeys = (c: WorkflowCard) => {
    const withItems = c.items.some((it) => !it.carried) && c.kind !== 'measure'
    return withItems
      ? c.items.filter((it) => !it.carried).map((it) => `${c.key}:${it.component.name}`)
      : [`${c.key}:_`]
  }
  const setAll = (keys: string[], value: boolean) =>
    setChecked((prev) => {
      const next = { ...prev }
      for (const k of keys) next[k] = value
      return next
    })

  return (
    <>
      {cards.map((c, idx) => {
        const keys = itemKeys(c)
        const doneCount = keys.filter((k) => checked[k]).length
        const done = doneCount === keys.length
        const showItems = c.items.length > 0 && c.kind !== 'measure'
        return (
          <div key={c.key} className={`card step-card kind-${c.kind} ${done ? 'done' : ''}`}>
            <label className="step-head">
              <input
                type="checkbox"
                checked={done}
                ref={(el) => {
                  if (el) el.indeterminate = !done && doneCount > 0
                }}
                onChange={(e) => setAll(keys, e.target.checked)}
              />
              <span className="step-no">Step {idx + 1}</span>
              <span className="step-title">{c.title}</span>
              {showItems && c.items.length > 1 && (
                <span className="step-progress">
                  {doneCount}/{keys.length}
                </span>
              )}
            </label>
            <p className="step-text">{c.text}</p>
            {c.kind === 'measure' && renderMeasure?.(c)}
            {showItems && (
              <ul className="step-items">
                {c.items.map((it) => {
                  const key = `${c.key}:${it.component.name}`
                  const itemDone = !!checked[key]
                  if (it.carried) {
                    return (
                      <li key={it.component.name} className="carried">
                        <span className="item-check item-carried" aria-hidden="true">
                          ↳
                        </span>
                        <span className="comp-name">{it.component.name}</span>
                        <span className="comp-role">{roleLabel(it.component.role)}・そのまま</span>
                        <span className="grams">{fmtGrams(it.grams)} g</span>
                      </li>
                    )
                  }
                  return (
                    <li key={it.component.name} className={itemDone ? 'done' : ''}>
                      <label className="item-check">
                        <input
                          type="checkbox"
                          checked={itemDone}
                          onChange={(e) => setChecked((prev) => ({ ...prev, [key]: e.target.checked }))}
                          aria-label={`${it.component.name} を投入済み`}
                        />
                      </label>
                      <span className="comp-name">{it.component.name}</span>
                      <span className="comp-role">{roleLabel(it.component.role)}</span>
                      <span className="grams">{fmtGrams(it.grams)} g</span>
                      {it.cumulative !== undefined && c.items.length > 1 && (
                        <span className="cumulative">累計 {fmtGrams(it.cumulative)}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {c.notes.length > 0 && (
              <ul className="step-notes">
                {c.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </>
  )
}
