import { Play, Video } from 'lucide-react'
import './PageTutorialButton.css'

/**
 * Botón de tutorial para la parte superior de cada página del dashboard
 * Al hacer clic, hace scroll hacia la sección de tutorial al final de la página
 * 
 * @param {string} sectionId - ID de la sección para el scroll (ej: 'tutorial-store-editor')
 * @param {string} label - Texto del botón (default: 'Tutorial')
 * @param {boolean} hasVideo - Si hay video disponible, muestra un indicador
 */
export default function PageTutorialButton({ 
  sectionId, 
  label = 'Tutorial',
  hasVideo = false 
}) {
  const handleClick = () => {
    const tutorialElement = document.getElementById(sectionId)
    if (tutorialElement) {
      tutorialElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      // Expandir el tutorial si está colapsado
      const header = tutorialElement.querySelector('.tutorialSection__header')
      if (header && !tutorialElement.querySelector('.tutorialSection__header--expanded')) {
        setTimeout(() => header.click(), 500)
      }
    }
  }

  return (
    <button 
      className={`pageTutorialBtn ${hasVideo ? 'pageTutorialBtn--hasVideo' : ''}`}
      onClick={handleClick}
      title="Ver tutorial de esta sección"
    >
      {hasVideo ? <Video size={16} /> : <Play size={16} />}
      <span>{label}</span>
      {hasVideo && <span className="pageTutorialBtn__badge">Video</span>}
    </button>
  )
}
