import { useMemo, useState } from 'react'
import type { Recipe } from '../types'
import { STATUS_LABEL, roleLabel } from '../types'
import {
  calcFromBase,
  calcFromTarget,
  findBase,
  fmtGrams,
  fmtNum,
  parseDecimal,
  type GramResolution,
} from '../lib/calc'
import { buildWorkflow } from '../lib/workflow'
import { NumInput } from './NumInput'
import { WorkflowCards } from './WorkflowCards'
import { PrintProfileCard } from './PrintProfileCard'

interface Props {
  recipe: Recipe
  isLocal: boolean
  resolution: GramResolution
  onResolutionChange: (r: GramResolution) => void
}

type Tab = 'calc' | 'steps'

export function RecipeView({ recipe, isLocal, resolution, onResolutionChange }: Props) {
  const [tab, setTab] = useState<Tab>('calc')
  const [targetText, setTargetText] = useState('100')
  const [measuredText, setMeasuredText] = useState('')

  const base = findBase(recipe)
  const target = parseDecimal(targetText)
  const measured = parseDecimal(measuredText)
  const usingMeasured = measured !== null && measured > 0

  const calc = useMemo(
    () => (usingMeasured ? calcFromBase(recipe, measured) : calcFromTarget(recipe, target ?? 0)),
    [recipe, usingMeasured, measured, target],
  )
  const cards = useMemo(
    () => buildWorkflow(recipe, { targetGrams: target ?? 0, measuredBase: usingMeasured ? measured : null }),
    // resolution は文言中の数値の丸めに効くので依存に含める
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipe, target, usingMeasured, measured, resolution],
  )
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
          <NumInput value={targetText} onChange={setTargetText} disabled={usingMeasured} ariaLabel="目標バッチ量" />
        </label>
        {tab === 'calc' &&
          (base ? (
            <label className="field field-base">
              <span className="field-label">
                {base.name} 実測 (g)
                {plannedBase !== undefined && !usingMeasured && (
                  <span className="muted"> 目安 {fmtGrams(plannedBase)} g</span>
                )}
              </span>
              <div className="input-row">
                <NumInput
                  value={measuredText}
                  onChange={setMeasuredText}
                  placeholder={plannedBase !== undefined ? fmtGrams(plannedBase) : ''}
                  primary
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
          ))}
        <div className="summary">
          <span>
            合計 <strong>{fmtGrams(calc.total)}</strong> g
          </span>
          <span>
            倍率 <strong>{fmtNum(calc.scale, 3)}</strong> g/比
          </span>
          {usingMeasured && <span className="badge badge-measured">実測基準</span>}
          <ResolutionToggle resolution={resolution} onChange={onResolutionChange} />
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
          <WorkflowCards
            cards={cards}
            renderMeasure={(c) => (
              <MeasureField
                plan={c.measure?.plan ?? 0}
                value={measuredText}
                onChange={setMeasuredText}
                label={base?.name ?? ''}
              />
            )}
          />
          <PrintProfileCard recipe={recipe} />
        </div>
      )}
    </div>
  )
}

export function ResolutionToggle({
  resolution,
  onChange,
}: {
  resolution: GramResolution
  onChange: (r: GramResolution) => void
}) {
  return (
    <div className="seg" role="group" aria-label="表示単位">
      <button type="button" className="seg-btn" aria-pressed={resolution === 'coarse'} onClick={() => onChange('coarse')}>
        0.1 g
      </button>
      <button type="button" className="seg-btn" aria-pressed={resolution === 'fine'} onClick={() => onChange('fine')}>
        0.01 g
      </button>
    </div>
  )
}

/** 主剤計量カード内: 目安と違うときだけ実測を入れる欄 */
export function MeasureField({
  plan,
  value,
  onChange,
  label,
}: {
  plan: number
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <div className="card-inputs">
      <label className="field">
        <span className="field-label">
          目安と違うときだけ入力 ({label} 実測 g) <span className="muted">空なら目安 {fmtGrams(plan)} g</span>
        </span>
        <div className="input-row">
          <NumInput value={value} onChange={onChange} placeholder={fmtGrams(plan)} small ariaLabel={`${label} 実測`} />
          {value !== '' && (
            <button type="button" className="btn btn-small" onClick={() => onChange('')}>
              クリア
            </button>
          )}
        </div>
      </label>
    </div>
  )
}
