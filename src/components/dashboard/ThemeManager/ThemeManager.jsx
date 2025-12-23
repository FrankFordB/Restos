import { useEffect } from 'react'
import './ThemeManager.css'
import Card from '../../ui/Card/Card'
import Button from '../../ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { fetchTenantTheme, saveTenantTheme, selectThemeForTenant } from '../../../features/theme/themeSlice'

export default function ThemeManager({ tenantId }) {
  const dispatch = useAppDispatch()
  const theme = useAppSelector(selectThemeForTenant(tenantId))

  useEffect(() => {
    dispatch(fetchTenantTheme(tenantId))
  }, [dispatch, tenantId])

  const set = (patch) => dispatch(saveTenantTheme({ tenantId, theme: { ...theme, ...patch } }))

  return (
    <Card
      title="Diseño (CSS variables)"
      actions={
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            set({
              primary: '#111827',
              accent: '#f59e0b',
              background: '#ffffff',
              text: '#111827',
              radius: '12px',
            })
          }
        >
          Reset
        </Button>
      }
    >
      <div className="theme">
        <label className="theme__row">
          <span>Primary</span>
          <input type="color" value={theme.primary} onChange={(e) => set({ primary: e.target.value })} />
        </label>
        <label className="theme__row">
          <span>Accent</span>
          <input type="color" value={theme.accent} onChange={(e) => set({ accent: e.target.value })} />
        </label>
        <label className="theme__row">
          <span>Background</span>
          <input type="color" value={theme.background} onChange={(e) => set({ background: e.target.value })} />
        </label>
        <label className="theme__row">
          <span>Text</span>
          <input type="color" value={theme.text} onChange={(e) => set({ text: e.target.value })} />
        </label>
        <label className="theme__row">
          <span>Radius</span>
          <input
            className="theme__radius"
            value={theme.radius}
            onChange={(e) => set({ radius: e.target.value })}
            placeholder="12px"
          />
        </label>
        <p className="muted">Esto afecta Header, botones, tarjetas y la tienda pública.</p>
      </div>
    </Card>
  )
}
