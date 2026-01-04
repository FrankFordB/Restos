import { useEffect } from 'react'
import { useAppSelector } from '../../app/hooks'
import { selectThemeForTenant } from '../../features/theme/themeSlice'

// Font imports mapping
const FONT_IMPORTS = {
  'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'Roboto': 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap',
  'Poppins': 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
  'Montserrat': 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap',
  'Open Sans': 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&display=swap',
  'Lato': 'https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap',
  'Nunito': 'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&display=swap',
  'Raleway': 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap',
  'Playfair Display': 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
  'Source Sans Pro': 'https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap',
}

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
    root.style.setProperty('--font-family', `'${fontFamily}', sans-serif`)
    
    // Load font if not already loaded
    const fontUrl = FONT_IMPORTS[fontFamily]
    if (fontUrl) {
      const existingLink = document.querySelector(`link[href="${fontUrl}"]`)
      if (!existingLink) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = fontUrl
        document.head.appendChild(link)
      }
    }
    
    // Apply layout/card/button styles as data attributes for CSS targeting
    root.dataset.cardStyle = theme.cardStyle || 'glass'
    root.dataset.buttonStyle = theme.buttonStyle || 'rounded'
    root.dataset.layoutStyle = theme.layoutStyle || 'modern'
    
  }, [theme])

  return null
}
