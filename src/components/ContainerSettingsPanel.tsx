import { useState } from 'react'
import { parseDecimal, fmtNum } from '../lib/calc'
import type { ContainerSettings } from '../lib/storage'
import { NumInput } from './NumInput'

interface Props {
  settings: ContainerSettings
  onChange: (s: ContainerSettings) => void
  /** 表示用: 今回の容器数と総量 */
  containers?: number
  totalGrams?: number
  marginApplied?: boolean
}

/** 容器上限 (mL)・密度・分注の余裕率。折りたたみで表示 */
export function ContainerSettingsPanel({ settings, onChange, containers, totalGrams, marginApplied }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState({
    capacityMl: String(settings.capacityMl),
    density: String(settings.density),
    marginPct: String(settings.marginPct),
  })
  const capacityG = settings.capacityMl * settings.density
  const update = (key: keyof ContainerSettings, v: string) => {
    setText((t) => ({ ...t, [key]: v }))
    const n = parseDecimal(v)
    if (n !== null && n >= 0 && (key !== 'density' || n > 0)) onChange({ ...settings, [key]: n })
  }
  return (
    <div className="container-settings">
      <button type="button" className="btn btn-ghost btn-block" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} 容器: 上限 {settings.capacityMl} mL（約 {fmtNum(capacityG, 0)} g）
        {containers !== undefined && containers > 1 && ` ・ 今回 ${containers} 容器`}
        {marginApplied && ` ・ 余裕 +${settings.marginPct}%`}
        {totalGrams !== undefined && marginApplied && ` → 総量 ${fmtNum(totalGrams, 1)} g`}
      </button>
      {open && (
        <div className="settings-grid">
          <label className="field">
            <span className="field-label">容器の上限 (mL)</span>
            <NumInput value={text.capacityMl} onChange={(v) => update('capacityMl', v)} small ariaLabel="容器の上限" />
          </label>
          <label className="field">
            <span className="field-label">密度 (g/mL)</span>
            <NumInput value={text.density} onChange={(v) => update('density', v)} small ariaLabel="密度" />
          </label>
          <label className="field">
            <span className="field-label">分けるときの余裕 (%)</span>
            <NumInput value={text.marginPct} onChange={(v) => update('marginPct', v)} small ariaLabel="余裕率" />
          </label>
          <p className="muted settings-help">
            総量が上限を超えると主剤を複数容器に分けて湯煎し、カクテルも上限に収まる数に分けます。
            分けて入れるとき (容器が複数、またはまとめて調合の分注) は余裕率ぶん多めに作ります。
          </p>
        </div>
      )}
    </div>
  )
}
