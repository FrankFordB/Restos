import { useEffect } from 'react'
import { useAppSelector } from '../../app/hooks'
import { selectThemeForTenant } from '../../features/theme/themeSlice'

export default function ThemeApplier({ tenantId }) {
  const theme = useAppSelector(selectThemeForTenant(tenantId || 'tenant_demo'))

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--primary', theme.primary)
    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--background', theme.background)
    root.style.setProperty('--text', theme.text)
    root.style.setProperty('--radius', theme.radius)
  }, [theme])

  return null
}
