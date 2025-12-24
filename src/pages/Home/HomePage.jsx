import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './HomePage.css'
import Card from '../../components/ui/Card/Card'
import Button from '../../components/ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { fetchTenants, selectTenants } from '../../features/tenants/tenantsSlice'
import { isSupabaseConfigured } from '../../lib/supabaseClient'

export default function HomePage() {
  const dispatch = useAppDispatch()
  const tenants = useAppSelector(selectTenants)

  const isTenantPremium = (t) => {
    const until = t?.premium_until || t?.premiumUntil
    if (!until) return false
    const ms = Date.parse(until)
    if (!Number.isFinite(ms)) return false
    return ms > Date.now()
  }

  useEffect(() => {
    if (isSupabaseConfigured) dispatch(fetchTenants())
  }, [dispatch])

  const publicTenants = (tenants || []).filter((t) => t?.isPublic !== false)

  return (
    <div className="home">
      <section className="home__hero">
        <div className="home__heroText">
          <h1>Tu restaurante online, listo para vender</h1>
          <p className="muted">
            Te damos una tienda moderna, un panel para administrarla y herramientas para crecer. Ideal para restaurantes,
            dark kitchens, cafeterías y emprendedores.
          </p>
          <div className="home__cta">
            <Link to="/register">
              <Button>Crear mi restaurante</Button>
            </Link>
            <Link to="/login">
              <Button variant="secondary">Entrar</Button>
            </Link>
          </div>

          <div className="home__badges">
            <span className="home__badge">Tienda por restaurante</span>
            <span className="home__badge">Panel de control</span>
            <span className="home__badge">Diseño personalizable</span>
            <span className="home__badge">Supabase listo</span>
          </div>
        </div>

        <Card title="Ver restaurantes">
          <p className="muted">Explora la lista completa de restaurantes y empresas publicados.</p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Link to="/restaurantes">
              <Button variant="secondary" size="sm">Ver más</Button>
            </Link>
          </div>
        </Card>
      </section>

      <section className="home__grid">
        <Card title="Beneficios">
          <ul className="home__list">
            <li>Tu propia tienda pública por restaurante: <strong>/store/:slug</strong></li>
            <li>Catálogo con productos, precios e imágenes</li>
            <li>Diseño personalizable (colores, bordes, estilo)</li>
            <li>Control de visibilidad: aparecer o no en el Home</li>
          </ul>
        </Card>

        <Card title="Cómo funciona">
          <ol className="home__steps">
            <li>Creas tu restaurante y eliges si será visible en el Home.</li>
            <li>Cargas productos, precios y fotos desde tu dashboard.</li>
            <li>Compartes tu link de tienda y comienzas a vender.</li>
          </ol>
        </Card>

        <Card title="Soporte y seguridad">
          <ul className="home__list">
            <li>Accesos por roles (super_admin y tenant_admin)</li>
            <li>Datos en Supabase (PostgreSQL) + RLS</li>
            <li>Gestión de cuentas: premium, cancelación y perfiles (super admin)</li>
          </ul>
        </Card>
      </section>

      <section className="home__contact">
        <Card title="Contacto">
          <div className="home__contactGrid">
            <div>
              <p className="home__contactTitle">¿Querés sumar tu restaurante?</p>
              <p className="muted">Escribinos y te ayudamos con la configuración y puesta en línea.</p>
              <div className="home__contactList">
                <div>
                  <div className="muted">Email</div>
                  <div><strong>contacto@restos.app</strong></div>
                </div>
                <div>
                  <div className="muted">Teléfono / WhatsApp</div>
                  <div><strong>+00 000 000 000</strong></div>
                </div>
              </div>
            </div>

            <div>
              <p className="home__contactTitle">Redes</p>
              <div className="home__social">
                <a className="home__socialLink" href="https://instagram.com" target="_blank" rel="noreferrer">
                  Instagram
                </a>
                <a className="home__socialLink" href="https://facebook.com" target="_blank" rel="noreferrer">
                  Facebook
                </a>
                <a className="home__socialLink" href="https://tiktok.com" target="_blank" rel="noreferrer">
                  TikTok
                </a>
                <a className="home__socialLink" href="https://wa.me" target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </div>
              <p className="muted" style={{ marginTop: 10 }}>
                (Estos links son ejemplo. Los cambiamos por los tuyos cuando me pases tus redes.)
              </p>
            </div>
          </div>
        </Card>
      </section>
    </div>
  )
}
