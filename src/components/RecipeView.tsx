import { useMemo, useState } from 'react'
import type { Recipe } from '../types'
import { PRINT_PROFILE_LABEL, STATUS_LABEL, roleLabel } from '../types'
import { calcFromBase, calcFromTarget, findBase, fmtGrams, fmtNum, parseDecimal } from '../lib/calc'
import { buildSteps } from '../lib/steps'

interface Props {
  recipe: Recipe
  isLocal: boolean
}

type Tab = 'calc' | 'steps'

export function RecipeView({ recipe, isLocal }: Props) {
  const [tab, setTab] = useState<Tab>('calc')
  const [targetText, setTargetText] = useState('100')
  const [measuredText, setMeasuredText] = useState('')
  const [checked, setChecked] = useState<Record<number, boolean>>({})

  const base = findBase(recipe)
  const target = parseDecimal(targetText)
  const measured = parseDecimal(measuredText)
  const usingMeasured = measured !== null && measured > 0

  const calc = useMemo(
    () => (usingMeasured ? calcFromBase(recipe, measured) : calcFromTarget(recipe, target ?? 0)),
    [recipe, usingMeasured, measured, target],
  )
  const steps = useMemo(() => buildSteps(recipe, calc), [recipe, calc])
  const plannedBase = base && target ? calcFromTarget(recipe, target).amounts.find((a) => a.isBase)?.grams : undefined

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
        <label className="field">
          <span className="field-label">目標バッチ量 (g)</span>
          <input
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            value={targetText}
            onChange={(e) => setTargetText(e.target.value)}
            className="num-input"
            disabled={usingMeasured}
          />
        </label>
        {base ? (
          <label className="field field-base">
            <span className="field-label">
              {base.name} 実測 (g)
              {plannedBase !== undefined && !usingMeasured && (
                <span className="muted"> 目安 {fmtGrams(plannedBase)} g</span>
              )}
            </span>
            <div className="input-row">
              <input
                type="text"
                inputMode="decimal"
                enterKeyHint="done"
                placeholder={plannedBase !== undefined ? fmtGrams(plannedBase) : ''}
                value={measuredText}
                onChange={(e) => setMeasuredText(e.target.value)}
                className="num-input num-input-primary"
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
        )}
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
          {steps.map((s) => {
            const done = !!checked[s.step]
            return (
              <div key={s.step} className={`card step-card kind-${s.kind} ${done ? 'done' : ''}`}>
                <label className="step-head">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={(e) => setChecked((c) => ({ ...c, [s.step]: e.target.checked }))}
                  />
                  <span className="step-no">Step {s.step}</span>
                  <span className="step-title">{s.title}</span>
                </label>
                <p className="step-text">{s.text}</p>
                <ul className="step-items">
                  {s.items.map((it) => (
                    <li key={it.component.name}>
                      <span className="comp-name">{it.component.name}</span>
                      <span className="comp-role">{roleLabel(it.component.role)}</span>
                      <span className="grams">{fmtGrams(it.grams)} g</span>
                      {it.cumulative !== undefined && s.items.length > 1 && (
                        <span className="cumulative">累計 {fmtGrams(it.cumulative)}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {s.notes.length > 0 && (
                  <ul className="step-notes">
                    {s.notes.map((n) => (
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
