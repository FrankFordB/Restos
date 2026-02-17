import { useEffect } from 'react'
import { useAppSelector } from '../../app/hooks'
import { selectThemeForTenant } from '../../features/theme/themeSlice'
import { FONTS, loadGoogleFont } from '../../shared/subscriptions'

export default function ThemeApplier({ tenantId }) {
  const theme = useAppSelector(selectThemeForTenant(tenantId || 'tenant_demo'))

  useEffect(() => {
    const root = document.documentElement
    
    // Apply colors
    root.style.setProperty('--primary', theme.primary)
    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--background', theme.background)
    root.style.setProperty('--text', theme.text)
    root.style.setProperty('--radius', theme.radius)
    
    // Apply font family
    const fontFamily = theme.fontFamily || 'Inter'
    const fontConfig = FONTS[fontFamily]
    root.style.setProperty('--font-family', fontConfig?.family || `'${fontFamily}', sans-serif`)
    
    // Load font dynamically
    loadGoogleFont(fontFamily)
    
    // Apply layout/card/button styles as data attributes for CSS targeting
    root.dataset.cardStyle = theme.cardStyle || 'glass'
    root.dataset.buttonStyle = theme.buttonStyle || 'rounded'
    root.dataset.layoutStyle = theme.layoutStyle || 'modern'
    
  }, [theme])

  return null
}
