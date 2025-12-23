import './Input.css'

export default function Input({ label, value, onChange, type = 'text', placeholder, name, ...rest }) {
  return (
    <label className="input">
      {label ? <span className="input__label">{label}</span> : null}
      <input
        className="input__control"
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        {...rest}
      />
    </label>
  )
}
