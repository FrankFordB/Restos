import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import './TenantsManager.css'
import Card from '../../ui/Card/Card'
import Input from '../../ui/Input/Input'
import Button from '../../ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { addTenant, createTenant, fetchTenants, selectTenants } from '../../../features/tenants/tenantsSlice'
import { createId } from '../../../shared/ids'
import { selectUser } from '../../../features/auth/authSlice'
import { generateUniqueSlug } from '../../../lib/supabaseApi'
import { isSupabaseConfigured } from '../../../lib/supabaseClient'

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
}

export default function TenantsManager() {
  const dispatch = useAppDispatch()
  const tenants = useAppSelector(selectTenants)
  const user = useAppSelector(selectUser)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  const suggestedSlug = useMemo(() => (name ? slugify(name) : ''), [name])

  useEffect(() => {
    dispatch(fetchTenants())
  }, [dispatch])

  return (
    <div className="tenants">
      <Card
        title="Crear restaurante (tenant)"
        actions={
          <Button
            size="sm"
            onClick={async () => {
              const finalName = name.trim()
              let finalSlug = (slug.trim() || suggestedSlug).trim()
              if (!finalName || !finalSlug) return

              // Si Supabase está configurado, verificar slug único
              if (isSupabaseConfigured) {
                try {
                  finalSlug = await generateUniqueSlug(finalSlug)
                } catch (err) {
                  console.error('Error verificando slug:', err)
                }
              }

              const localTenant = {
                id: createId('tenant'),
                name: finalName,
                slug: finalSlug,
              }

              // fallback MOCK
              dispatch(addTenant(localTenant))

              // Supabase (si está configurado) crea también en DB
              try {
                if (user?.id) await dispatch(createTenant({ name: finalName, slug: finalSlug, ownerUserId: user.id })).unwrap()
              } catch (err) {
                console.error('Error creando tenant:', err)
              }

              setName('')
              setSlug('')
            }}
          >
            Crear
          </Button>
        }
      >
        <div className="tenants__form">
          <Input label="Nombre" value={name} onChange={setName} placeholder="Burger House" />
          <Input label="Slug" value={slug} onChange={setSlug} placeholder={suggestedSlug || 'burger-house'} />
          <p className="muted">URL pública: /r/&lt;slug&gt; (home) y /store/&lt;slug&gt; (menú)</p>
        </div>
      </Card>

      <Card title="Tenants">
        <div className="tenants__list">
          {tenants.map((t) => (
            <div key={t.id} className="tenants__row">
              <div>
                <strong>{t.name}</strong>
                <div className="muted">{t.slug}</div>
              </div>
              <Link className="tenants__link" to={`/r/${t.slug}`}>
                Ver home
              </Link>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
