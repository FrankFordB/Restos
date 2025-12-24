import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import './DirectoryPage.css'
import Card from '../../components/ui/Card/Card'
import Button from '../../components/ui/Button/Button'
import Input from '../../components/ui/Input/Input'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { fetchTenants, selectTenants } from '../../features/tenants/tenantsSlice'
import { isSupabaseConfigured } from '../../lib/supabaseClient'

function isTenantPremium(tenant) {
  const until = tenant?.premium_until || tenant?.premiumUntil
  if (!until) return false
  const ms = Date.parse(until)
  if (!Number.isFinite(ms)) return false
  return ms > Date.now()
}

export default function DirectoryPage() {
  const dispatch = useAppDispatch()
  const tenants = useAppSelector(selectTenants)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (isSupabaseConfigured) dispatch(fetchTenants())
  }, [dispatch])

  const filtered = useMemo(() => {
    const list = (tenants || []).filter((t) => t?.isPublic !== false)
    const query = q.trim().toLowerCase()
    if (!query) return list
    return list.filter((t) => {
      const name = String(t?.name || '').toLowerCase()
      const slug = String(t?.slug || '').toLowerCase()
      return name.includes(query) || slug.includes(query)
    })
  }, [tenants, q])

  return (
    <div className="directory">
      <div className="directory__header">
        <div>
          <h1 className="directory__title">Restaurantes y empresas</h1>
          <p className="muted">Listado público. Solo aparecen los que el dueño dejó visibles.</p>
        </div>

        <div className="directory__actions">
          <Link to="/">
            <Button variant="secondary">Volver</Button>
          </Link>
        </div>
      </div>

      <Card title="Buscar">
        <div className="directory__search">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o slug…"
          />
          <div className="muted directory__count">{filtered.length} resultados</div>
        </div>
      </Card>

      <Card title="Listado">
        {filtered.length ? (
          <div className="directory__list">
            {filtered.map((t) => {
              const premium = isTenantPremium(t)
              return (
                <div key={t.id} className="directory__row">
                  <div className="directory__meta">
                    <div className="directory__name">
                      {t.name}
                      <span className={premium ? 'directory__badge directory__badge--premium' : 'directory__badge'}>
                        {premium ? 'Premium' : 'Gratis'}
                      </span>
                    </div>
                    <div className="muted directory__slug">/store/{t.slug}</div>
                  </div>

                  <Link to={`/store/${t.slug}`}>
                    <Button size="sm">Ver</Button>
                  </Link>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="muted">No hay resultados para esa búsqueda.</p>
        )}
      </Card>
    </div>
  )
}
