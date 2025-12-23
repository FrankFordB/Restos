import './Card.css'

export default function Card({ title, children, actions }) {
  return (
    <section className="card">
      {title ? (
        <header className="card__header">
          <h2 className="card__title">{title}</h2>
          {actions ? <div className="card__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="card__body">{children}</div>
    </section>
  )
}
