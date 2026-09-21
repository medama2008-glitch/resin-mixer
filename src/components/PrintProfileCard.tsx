import type { Recipe } from '../types'
import { OPTICS_LABEL, PRINT_PROFILE_LABEL } from '../types'

export function PrintProfileCard({ recipe }: { recipe: Recipe }) {
  if (!recipe.print_profile && !recipe.optics) return null
  const optics = recipe.optics ?? {}
  const opticNums = Object.entries(optics).filter(([, v]) => typeof v === 'number' || typeof v === 'boolean')
  const opticTexts = Object.entries(optics).filter(([, v]) => typeof v === 'string')
  return (
    <div className="card step-card kind-print">
      <div className="step-head">
        <span className="step-title">印刷設定</span>
      </div>
      {recipe.print_profile && (
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
      )}
      {opticNums.length > 0 && (
        <>
          <div className="section-title">光学特性</div>
          <dl className="print-profile">
            {opticNums.map(([k, v]) => {
              const meta = OPTICS_LABEL[k]
              return (
                <div key={k}>
                  <dt>{meta?.label ?? k}</dt>
                  <dd>
                    {v === null ? '–' : typeof v === 'boolean' ? (v ? 'はい' : 'いいえ') : String(v)}
                    {meta?.unit && v !== null ? ` ${meta.unit}` : ''}
                  </dd>
                </div>
              )
            })}
          </dl>
        </>
      )}
      {opticTexts.length > 0 && (
        <ul className="step-notes">
          {opticTexts.map(([k, v]) => (
            <li key={k}>
              {OPTICS_LABEL[k]?.label ?? k}: {String(v)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
