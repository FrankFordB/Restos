import { Link } from 'react-router-dom'
import './HomePage.css'
import Card from '../../components/ui/Card/Card'
import Button from '../../components/ui/Button/Button'

export default function HomePage() {
  return (
    <div className="home">
      <section className="home__hero">
        <div className="home__heroText">
          <h1>Vende comida online con tu propio panel</h1>
          <p className="muted">
            Super usuario para controlar todo, y usuarios (restaurantes) con dashboard para cambiar diseño, productos y
            precios.
          </p>
          <div className="home__cta">
            <Link to="/register">
              <Button>Crear mi restaurante</Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary">Entrar</Button>
            </Link>
          </div>
          <p className="home__creds">
            Demo: <strong>demo@resto.local</strong> / <strong>demo123</strong> · Admin: <strong>admin@resto.local</strong>{' '}
            / <strong>admin123</strong>
          </p>
        </div>

        <Card title="Tienda demo">
          <p className="muted">Visita la tienda pública y mira cómo cambia con el diseño del tenant.</p>
          <Link to="/store/demo-burgers">
            <Button size="sm">Ver tienda</Button>
          </Link>
        </Card>
      </section>

      <section className="home__grid">
        <Card title="Roles y control">
          <ul className="home__list">
            <li>Super usuario: administra tenants</li>
            <li>Usuario restaurante: administra su tienda</li>
            <li>Rutas protegidas y estado persistente</li>
          </ul>
        </Card>
        <Card title="Personalización">
          <ul className="home__list">
            <li>Colores y radio por tenant</li>
            <li>Productos, precios y estado activo</li>
            <li>Vista pública /store/:slug</li>
          </ul>
        </Card>
        <Card title="Escalable">
          <ul className="home__list">
            <li>Redux Toolkit por features</li>
            <li>Componentes .jsx + CSS por carpeta</li>
            <li>Preparado para Supabase (PostgreSQL)</li>
          </ul>
        </Card>
      </section>
    </div>
  )
}
