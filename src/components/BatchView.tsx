import { useMemo, useState } from 'react'
import type { RecipeEntry } from '../types'
import { STATUS_LABEL, roleLabel } from '../types'
import { fmtGrams, fmtNum, parseDecimal, type GramResolution } from '../lib/calc'
import { buildBatch, buildBatchWorkflow, masterBasePlan } from '../lib/batch'
import { NumInput } from './NumInput'
import { WorkflowCards } from './WorkflowCards'
import { MeasureField, ResolutionToggle } from './RecipeView'

interface Props {
  entries: RecipeEntry[]
  resolution: GramResolution
  onResolutionChange: (r: GramResolution) => void
}

type Tab = 'plan' | 'steps'

export function BatchView({ entries, resolution, onResolutionChange }: Props) {
  const [tab, setTab] = useState<Tab>('plan')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [measuredText, setMeasuredText] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const candidates = entries.filter((e) => showArchived || e.recipe.status !== 'archived')
  const chosen = entries.filter((e) => selected[e.recipe.id])
  const inputs = chosen.map((e) => ({
    recipe: e.recipe,
    targetGrams: parseDecimal(targets[e.recipe.id] ?? '') ?? 100,
  }))
  const measured = parseDecimal(measuredText)
  const measuredBase = measured !== null && measured > 0 ? measured : null

  const plan = useMemo(() => buildBatch(inputs), [inputs])
  const cards = useMemo(
    () => buildBatchWorkflow(plan, measuredBase),
    // resolution は丸めに効く
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, measuredBase, resolution],
  )
  const basePlan = plan.errors.length === 0 ? masterBasePlan(plan) : 0
  const scale = measuredBase !== null && basePlan > 0 ? measuredBase / basePlan : 1

  return (
    <div className="page">
      <p className="muted">
        濃度違いなどの近いレシピをまとめて作るための手順。全レシピに共通する分を「共通ミックス」として一度に作り、
        分注してから差分の成分だけ個別に加えます。
      </p>

      <div className="card">
        <div className="toolbar">
          <span className="field-label">レシピを選ぶ (2 つ以上)</span>
          <label className="check-inline">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            過去も表示
          </label>
        </div>
        <ul className="pick-list">
          {candidates.map((e) => {
            const id = e.recipe.id
            const on = !!selected[id]
            return (
              <li key={id} className={on ? 'on' : ''}>
                <label className="pick-row">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(ev) => setSelected((s) => ({ ...s, [id]: ev.target.checked }))}
                  />
                  <span className="pick-id">{id}</span>
                  <span className={`badge status-${e.recipe.status}`}>{STATUS_LABEL[e.recipe.status]}</span>
                  <span className="muted pick-base">主剤 {e.recipe.base_component}</span>
                </label>
                {on && (
                  <div className="pick-target">
                    <span className="muted">バッチ量 (g)</span>
                    <NumInput
                      value={targets[id] ?? ''}
                      onChange={(v) => setTargets((t) => ({ ...t, [id]: v }))}
                      placeholder="100"
                      small
                      ariaLabel={`${id} のバッチ量`}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {plan.errors.length > 0 ? (
        <p className="empty">{plan.errors.join(' / ')}</p>
      ) : (
        <>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'plan'} className="tab" onClick={() => setTab('plan')}>
              配分
            </button>
            <button type="button" role="tab" aria-selected={tab === 'steps'} className="tab" onClick={() => setTab('steps')}>
              手順
            </button>
          </div>

          <div className="card inputs">
            <div className="summary">
              <span>
                共通ミックス <strong>{fmtGrams(plan.masterTotal * scale)}</strong> g
              </span>
              <span>
                共通率 <strong>{fmtNum(plan.sharedFraction * 100, 1)}</strong> %
              </span>
              {measuredBase !== null && <span className="badge badge-measured">実測基準</span>}
              <ResolutionToggle resolution={resolution} onChange={onResolutionChange} />
            </div>
          </div>

          {tab === 'plan' ? (
            <>
              <h2 className="section-title">共通ミックスの配合</h2>
              <table className="amounts">
                <thead>
                  <tr>
                    <th>成分</th>
                    <th className="num">共通 wt%</th>
                    <th className="num">必要量 (g)</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.master.components.map((c) => {
                    const isBase = c.name === plan.master.base_component
                    const sum = plan.master.components.reduce((s, x) => s + x.ratio, 0)
                    return (
                      <tr key={c.name} className={isBase ? 'row-base' : ''}>
                        <td>
                          <div className="comp-name">{c.name}</div>
                          <div className="comp-role">
                            {roleLabel(c.role)}
                            {isBase && ' ・ 基準'}
                          </div>
                        </td>
                        <td className="num muted">{fmtNum(c.ratio, 2)}</td>
                        <td className="num grams">{fmtGrams((plan.masterTotal * scale * c.ratio) / sum)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <h2 className="section-title">分注と個別追加</h2>
              <div className="card-list">
                {plan.perRecipe.map((p) => (
                  <div key={p.recipe.id} className="card">
                    <div className="recipe-card-head">
                      <span className="recipe-id">{p.recipe.id}</span>
                      <span className="muted">目標 {fmtGrams(p.targetGrams * scale)} g</span>
                    </div>
                    <ul className="step-items">
                      <li>
                        <span className="comp-name">共通ミックス</span>
                        <span className="comp-role">分注</span>
                        <span className="grams">{fmtGrams(p.masterGrams * scale)} g</span>
                      </li>
                      {p.additions.map((a) => (
                        <li key={a.component.name}>
                          <span className="comp-name">{a.component.name}</span>
                          <span className="comp-role">
                            {roleLabel(a.component.role)} ・ 追加
                          </span>
                          <span className="grams">{fmtGrams(a.grams * scale)} g</span>
                        </li>
                      ))}
                    </ul>
                    {p.additions.length === 0 && <p className="muted">追加なし (共通ミックスのまま)</p>}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="steps">
              <WorkflowCards
                cards={cards}
                renderMeasure={(c) => (
                  <MeasureField
                    plan={c.measure?.plan ?? 0}
                    value={measuredText}
                    onChange={setMeasuredText}
                    label={plan.master.base_component}
                  />
                )}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
