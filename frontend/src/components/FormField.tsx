import type { FieldDef } from '../lib/fields'

type Props = {
  field: FieldDef
  value: string
  error?: string
  optional?: boolean
  compact?: boolean
  onChange: (name: string, value: string) => void
}

function FormField({ field, value, error, optional, compact, onChange }: Props) {
  const id = `field-${field.name}${compact ? '-c' : ''}`
  return (
    <div className={`form-field${error ? ' form-field--error' : ''}`}>
      <label htmlFor={id} className="form-field__label">
        {field.label}
      </label>
      {field.type === 'select' ? (
        <select id={id} value={value} onChange={(e) => onChange(field.name, e.target.value)}>
          {optional && <option value="">Typical</option>}
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          value={value}
          placeholder={optional ? 'Typical' : undefined}
          onChange={(e) => onChange(field.name, e.target.value)}
        />
      )}
      {error ? (
        <span className="form-field__error">{error}</span>
      ) : (
        field.hint && !compact && <span className="form-field__hint">{field.hint}</span>
      )}
    </div>
  )
}

export default FormField
