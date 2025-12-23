import './Button.css'

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled,
  onClick,
  children,
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} btn--${size}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
