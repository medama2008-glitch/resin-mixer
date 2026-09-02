import { useMemo, useState } from 'react'
import type { Recipe } from '../types'
import { PRINT_PROFILE_LABEL, STATUS_LABEL, roleLabel } from '../types'
import { calcFromBase, calcFromTarget, findBase, fmtGrams, fmtNum, parseDecimal } from '../lib/calc'
import { buildWorkflow, type WorkflowCard } from '../lib/workflow'
import { loadMarginPct, saveMarginPct } from '../lib/storage'

interface Props {
  recipe: Recipe
  isLocal: boolean
}

type Tab = 'calc' | 'steps'

function NumInput({
  value,
  onChange,
  placeholder,
  primary,
  disabled,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  primary?: boolean
  disabled?: boolean
  ariaLabel?: string
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      enterKeyHint="done"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={`num-input ${primary ? 'num-input-primary' : ''}`}
    />
  )
}

export function RecipeView({ recipe, isLocal }: Props) {
  const [tab, setTab] = useState<Tab>('calc')
  const [targetText, setTargetText] = useState('100')
  const [measuredText, setMeasuredText] = useState('')
  const [premixText, setPremixText] = useState('')
  const [marginText, setMarginText] = useState(() => String(loadMarginPct()))
  // 材料ごとのチェック。キーは `${card.key}:${name}`。材料の無いカードは `${card.key}:_`
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const base = findBase(recipe)
  const target = parseDecimal(targetText)
  const measured = parseDecimal(measuredText)
  const premixActual = parseDecimal(premixText)
  const marginPct = parseDecimal(marginText)
  const margin = marginPct !== null && marginPct >= 0 ? marginPct / 100 : 0
  const usingMeasured = measured !== null && measured > 0

  const calc = useMemo(
    () => (usingMeasured ? calcFromBase(recipe, measured) : calcFromTarget(recipe, target ?? 0)),
    [recipe, usingMeasured, measured, target],
  )
  const cards = useMemo(
    () =>
      buildWorkflow(recipe, {
        targetGrams: target ?? 0,
        measuredBase: usingMeasured ? measured : null,
        margin,
        premixActual,
      }),
    [recipe, target, usingMeasured, measured, margin, premixActual],
  )
  const plannedBase = base && target ? calcFromTarget(recipe, target).amounts.find((a) => a.isBase)?.grams : undefined

  const itemKeys = (c: WorkflowCard) =>
    c.items.length > 0 ? c.items.map((it) => `${c.key}:${it.component.name}`) : [`${c.key}:_`]
  const setAll = (keys: string[], value: boolean) =>
    setChecked((prev) => {
      const next = { ...prev }
      for (const k of keys) next[k] = value
      return next
    })

  const onMarginChange = (v: string) => {
    setMarginText(v)
    const n = parseDecimal(v)
    if (n !== null && n >= 0) saveMarginPct(n)
  }

  const measuredField = (primary: boolean) =>
    base ? (
      <label className="field field-base">
        <span className="field-label">
          {base.name} 実測 (g)
          {plannedBase !== undefined && !usingMeasured && <span className="muted"> 目安 {fmtGrams(plannedBase)} g</span>}
        </span>
        <div className="input-row">
          <NumInput
            value={measuredText}
            onChange={setMeasuredText}
            placeholder={plannedBase !== undefined ? fmtGrams(plannedBase) : ''}
            primary={primary}
            ariaLabel={`${base.name} 実測`}
          />
          {measuredText !== '' && (
            <button type="button" className="btn btn-small" onClick={() => setMeasuredText('')}>
              クリア
            </button>
          )}
        </div>
      </label>
    ) : (
      <p className="warn">base_component "{recipe.base_component}" が components に見つかりません</p>
    )

  return (
    <div className="page">
      <div className="recipe-head">
        <div className="recipe-card-head">
          <span className="recipe-id">{recipe.id}</span>
          <span className={`badge status-${recipe.status}`}>{STATUS_LABEL[recipe.status]}</span>
          {isLocal && <span className="badge badge-local">ローカル</span>}
          {recipe.date && <span className="muted">{recipe.date}</span>}
        </div>
        {recipe.notes && <p className="recipe-notes">{recipe.notes}</p>}
      </div>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'calc'} className="tab" onClick={() => setTab('calc')}>
          計算
        </button>
        <button type="button" role="tab" aria-selected={tab === 'steps'} className="tab" onClick={() => setTab('steps')}>
          手順
        </button>
      </div>

      <div className="card inputs">
        <div className="field-row">
          <label className="field">
            <span className="field-label">目標バッチ量 (g)</span>
            <NumInput value={targetText} onChange={setTargetText} disabled={usingMeasured} ariaLabel="目標バッチ量" />
          </label>
          {tab === 'steps' && (
            <label className="field field-narrow">
              <span className="field-label">先溶かし余裕 (%)</span>
              <NumInput value={marginText} onChange={onMarginChange} ariaLabel="先溶かし余裕" />
            </label>
          )}
        </div>
        {tab === 'calc' && measuredField(true)}
        <div className="summary">
          <span>
            合計 <strong>{fmtGrams(calc.total)}</strong> g
          </span>
          <span>
            倍率 <strong>{fmtNum(calc.scale, 3)}</strong> g/比
          </span>
          {usingMeasured && <span className="badge badge-measured">実測基準</span>}
        </div>
      </div>

      {tab === 'calc' ? (
        <table className="amounts">
          <thead>
            <tr>
              <th>成分</th>
              <th className="num">比率</th>
              <th className="num">必要量 (g)</th>
            </tr>
          </thead>
          <tbody>
            {calc.amounts.map((a) => (
              <tr key={a.component.name} className={a.isBase ? 'row-base' : ''}>
                <td>
                  <div className="comp-name">{a.component.name}</div>
                  <div className="comp-role">
                    {roleLabel(a.component.role)}
                    {a.isBase && ' ・ 基準'}
                    {' ・ Step '}
                    {a.component.step}
                  </div>
                </td>
                <td className="num muted">{fmtNum(a.component.ratio, 1)}</td>
                <td className="num grams">{fmtGrams(a.grams)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>合計</td>
              <td className="num muted">{fmtNum(calc.ratioSum, 1)}</td>
              <td className="num grams">{fmtGrams(calc.total)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <div className="steps">
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
                  {c.items.length > 1 && (
                    <span className="step-progress">
                      {doneCount}/{keys.length}
                    </span>
                  )}
                </label>
                <p className="step-text">{c.text}</p>

                {c.kind === 'measure' && c.measure && (
                  <div className="card-inputs">
                    {measuredField(true)}
                    <div className="range-line">
                      <span className="muted">目安</span> <strong>{fmtGrams(c.measure.plan)}</strong> g
                      <span className="muted"> ／ 許容</span> <strong>{fmtGrams(c.measure.lower)}</strong>〜
                      <strong>{fmtGrams(c.measure.upper)}</strong> g
                      {c.measure.measured !== null && c.measure.measured > c.measure.upper && (
                        <span className="warn"> 上限超え</span>
                      )}
                    </div>
                  </div>
                )}

                {c.kind === 'adjust' && (
                  <div className="card-inputs">
                    {c.adjust && (
                      <div className={`remove-line ${c.adjust.remove < 0 ? 'warn' : ''}`}>
                        {c.adjust.remove >= 0 ? (
                          <>
                            はかり表示 <strong className="big">−{fmtGrams(c.adjust.remove)}</strong> g まで抜く
                          </>
                        ) : (
                          <>
                            不足 <strong className="big">{fmtGrams(-c.adjust.remove)}</strong> g
                          </>
                        )}
                      </div>
                    )}
                    <label className="field">
                      <span className="field-label">
                        実際に作った先溶かし液 (g) <span className="muted">未入力なら計画量</span>
                      </span>
                      <div className="input-row">
                        <NumInput
                          value={premixText}
                          onChange={setPremixText}
                          placeholder={c.adjust ? fmtGrams(c.adjust.made) : ''}
                          ariaLabel="実際に作った先溶かし液"
                        />
                        {premixText !== '' && (
                          <button type="button" className="btn btn-small" onClick={() => setPremixText('')}>
                            クリア
                          </button>
                        )}
                      </div>
                    </label>
                  </div>
                )}

                {showItems && (
                  <ul className="step-items">
                    {c.items.map((it) => {
                      const key = `${c.key}:${it.component.name}`
                      const itemDone = !!checked[key]
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
          {recipe.print_profile && (
            <div className="card step-card kind-print">
              <div className="step-head">
                <span className="step-title">印刷設定</span>
              </div>
              <dl className="print-profile">
                {Object.entries(recipe.print_profile).map(([k, v]) => {
                  const meta = PRINT_PROFILE_LABEL[k]
                  return (
                    <div key={k}>
                      <dt>{meta?.label ?? k}</dt>
                      <dd>
                        {String(v)}
                        {meta?.unit ? ` ${meta.unit}` : ''}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
