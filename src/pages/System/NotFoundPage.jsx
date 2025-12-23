import { Link } from 'react-router-dom'
import Button from '../../components/ui/Button/Button'

export default function NotFoundPage() {
  return (
    <div>
      <h1>404</h1>
      <p className="muted">Página no encontrada.</p>
      <Link to="/">
        <Button variant="secondary">Volver al Home</Button>
      </Link>
    </div>
  )
}
