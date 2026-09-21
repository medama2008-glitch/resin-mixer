interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  primary?: boolean
  disabled?: boolean
  ariaLabel?: string
  small?: boolean
}

export function NumInput({ value, onChange, placeholder, primary, disabled, ariaLabel, small }: Props) {
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
      className={`num-input ${primary ? 'num-input-primary' : ''} ${small ? 'num-input-small' : ''}`}
    />
  )
}
