import { Link, useLocation } from 'react-router-dom'
import Button from '../../components/ui/Button/Button'
import { UtensilsCrossed } from 'lucide-react'
import './NotFoundPage.css'

export default function NotFoundPage() {
  const location = useLocation()

  return (
    <div className="notFound">
      <div className="notFound__content">
        <span className="notFound__emoji"><UtensilsCrossed size={64} /></span>
        <h1 className="notFound__title">404</h1>
        <h2 className="notFound__subtitle">Página no encontrada</h2>
        <p className="notFound__description">
          Lo sentimos, la página <code>{location.pathname}</code> no existe o fue movida.
        </p>
        <div className="notFound__actions">
          <Link to="/">
            <Button variant="primary">Ir al inicio</Button>
          </Link>
          <Link to="/restaurantes">
            <Button variant="secondary">Ver restaurantes</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
