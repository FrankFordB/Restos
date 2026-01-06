import { useState, useEffect, useRef } from 'react'
import './TutorialSection.css'
import Button from '../../ui/Button/Button'
import Input from '../../ui/Input/Input'
import { 
  ChevronDown, 
  ChevronUp, 
  Play, 
  Youtube, 
  Upload, 
  Pencil, 
  Save, 
  X,
  Trash2,
  Video,
  ExternalLink
} from 'lucide-react'
import { ROLES } from '../../../shared/constants'

/**
 * Sección de tutorial desplegable con soporte para videos de YouTube o locales
 * Solo super_admin puede editar el video, los demás solo pueden verlo
 * 
 * @param {string} sectionId - Identificador único de la sección (ej: 'store-editor', 'orders')
 * @param {string} title - Título del tutorial (default: 'Tutorial')
 * @param {object} user - Objeto usuario con role
 * @param {string} videoUrl - URL del video actual
 * @param {string} videoType - Tipo de video: 'youtube' o 'local'
 * @param {function} onSaveVideo - Callback para guardar el video (sectionId, videoUrl, videoType)
 * @param {boolean} loading - Estado de carga
 */
export default function TutorialSection({ 
  sectionId,
  title = 'Tutorial',
  user,
  videoUrl = '',
  videoType = 'youtube',
  onSaveVideo,
  loading = false
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editVideoUrl, setEditVideoUrl] = useState(videoUrl || '')
  const [editVideoType, setEditVideoType] = useState(videoType || 'youtube')
  const [localVideoFile, setLocalVideoFile] = useState(null)
  const [localVideoPreview, setLocalVideoPreview] = useState('')
  const [saving, setSaving] = useState(false)
  
  const fileInputRef = useRef(null)
  
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN
  const hasVideo = Boolean(videoUrl)
  
  // Sincronizar con props
  useEffect(() => {
    setEditVideoUrl(videoUrl || '')
    setEditVideoType(videoType || 'youtube')
  }, [videoUrl, videoType])
  
  // Limpiar preview de video local al desmontar
  useEffect(() => {
    return () => {
      if (localVideoPreview) {
        URL.revokeObjectURL(localVideoPreview)
      }
    }
  }, [localVideoPreview])

  // Extraer ID de YouTube de una URL
  const getYoutubeEmbedUrl = (url) => {
    if (!url) return null
    
    // Formatos soportados:
    // https://www.youtube.com/watch?v=VIDEO_ID
    // https://youtu.be/VIDEO_ID
    // https://www.youtube.com/embed/VIDEO_ID
    
    let videoId = null
    
    if (url.includes('youtube.com/watch')) {
      const urlParams = new URLSearchParams(url.split('?')[1])
      videoId = urlParams.get('v')
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0]
    } else if (url.includes('youtube.com/embed/')) {
      videoId = url.split('youtube.com/embed/')[1]?.split('?')[0]
    }
    
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`
    }
    
    return null
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('video/')) {
      setLocalVideoFile(file)
      const previewUrl = URL.createObjectURL(file)
      setLocalVideoPreview(previewUrl)
      setEditVideoType('local')
    }
  }

  const handleSave = async () => {
    if (!onSaveVideo) return
    
    setSaving(true)
    try {
      // Si es video local, necesitaríamos subir el archivo primero
      // Por ahora, solo soportamos YouTube o URL directa
      const urlToSave = editVideoType === 'local' && localVideoFile 
        ? localVideoPreview // En producción, aquí iría la URL de Supabase Storage
        : editVideoUrl
        
      await onSaveVideo(sectionId, urlToSave, editVideoType)
      setIsEditing(false)
      setLocalVideoFile(null)
    } catch (err) {
      console.error('Error saving tutorial video:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onSaveVideo) return
    
    setSaving(true)
    try {
      await onSaveVideo(sectionId, '', 'youtube')
      setEditVideoUrl('')
      setEditVideoType('youtube')
      setIsEditing(false)
    } catch (err) {
      console.error('Error deleting tutorial video:', err)
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setEditVideoUrl(videoUrl)
    setEditVideoType(videoType)
    setLocalVideoFile(null)
    setLocalVideoPreview('')
  }

  const embedUrl = editVideoType === 'youtube' ? getYoutubeEmbedUrl(editVideoUrl || videoUrl) : null
  const displayVideoUrl = isEditing ? editVideoUrl : videoUrl

  return (
    <div className="tutorialSection">
      <button 
        className={`tutorialSection__header ${isExpanded ? 'tutorialSection__header--expanded' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="tutorialSection__headerLeft">
          <Video size={18} className="tutorialSection__icon" />
          <span className="tutorialSection__title">{title}</span>
          {hasVideo && <span className="tutorialSection__badge">Video disponible</span>}
        </div>
        <div className="tutorialSection__headerRight">
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>
      
      {isExpanded && (
        <div className="tutorialSection__content">
          {/* Modo edición - Solo super_admin */}
          {isEditing && isSuperAdmin && (
            <div className="tutorialSection__editor">
              <div className="tutorialSection__tabs">
                <button 
                  className={`tutorialSection__tab ${editVideoType === 'youtube' ? 'tutorialSection__tab--active' : ''}`}
                  onClick={() => setEditVideoType('youtube')}
                >
                  <Youtube size={16} />
                  YouTube
                </button>
                <button 
                  className={`tutorialSection__tab ${editVideoType === 'local' ? 'tutorialSection__tab--active' : ''}`}
                  onClick={() => setEditVideoType('local')}
                >
                  <Upload size={16} />
                  Subir video
                </button>
              </div>
              
              {editVideoType === 'youtube' && (
                <div className="tutorialSection__inputGroup">
                  <Input
                    label="URL del video de YouTube"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={editVideoUrl}
                    onChange={setEditVideoUrl}
                  />
                  <p className="tutorialSection__hint">
                    Pega la URL del video de YouTube que deseas mostrar como tutorial
                  </p>
                </div>
              )}
              
              {editVideoType === 'local' && (
                <div className="tutorialSection__uploadArea">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="tutorialSection__fileInput"
                  />
                  <button 
                    className="tutorialSection__uploadBtn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={24} />
                    <span>Seleccionar video</span>
                    <span className="tutorialSection__uploadHint">MP4, WebM, MOV (máx. 100MB)</span>
                  </button>
                  {localVideoFile && (
                    <p className="tutorialSection__fileName">
                      Archivo: {localVideoFile.name}
                    </p>
                  )}
                </div>
              )}
              
              {/* Preview */}
              {(embedUrl || localVideoPreview) && (
                <div className="tutorialSection__preview">
                  <p className="tutorialSection__previewLabel">Vista previa:</p>
                  {editVideoType === 'youtube' && embedUrl && (
                    <div className="tutorialSection__videoWrapper">
                      <iframe
                        src={embedUrl}
                        title="Tutorial preview"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                  {editVideoType === 'local' && localVideoPreview && (
                    <div className="tutorialSection__videoWrapper">
                      <video src={localVideoPreview} controls />
                    </div>
                  )}
                </div>
              )}
              
              <div className="tutorialSection__actions">
                <Button 
                  variant="secondary" 
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  <X size={16} />
                  Cancelar
                </Button>
                {hasVideo && (
                  <Button 
                    variant="danger" 
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    <Trash2 size={16} />
                    Eliminar
                  </Button>
                )}
                <Button 
                  onClick={handleSave}
                  disabled={saving || (!editVideoUrl && !localVideoFile)}
                >
                  <Save size={16} />
                  {saving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          )}
          
          {/* Modo visualización */}
          {!isEditing && (
            <>
              {hasVideo ? (
                <div className="tutorialSection__viewer">
                  {videoType === 'youtube' && getYoutubeEmbedUrl(videoUrl) && (
                    <div className="tutorialSection__videoWrapper">
                      <iframe
                        src={getYoutubeEmbedUrl(videoUrl)}
                        title="Tutorial"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  )}
                  {videoType === 'local' && videoUrl && (
                    <div className="tutorialSection__videoWrapper">
                      <video src={videoUrl} controls />
                    </div>
                  )}
                  
                  {isSuperAdmin && (
                    <div className="tutorialSection__editBar">
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil size={14} />
                        Editar video
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="tutorialSection__empty">
                  <Video size={48} className="tutorialSection__emptyIcon" />
                  <p className="tutorialSection__emptyText">
                    {isSuperAdmin 
                      ? 'No hay video de tutorial configurado. Haz clic en "Agregar video" para configurar uno.'
                      : 'Próximamente: video tutorial para esta sección.'
                    }
                  </p>
                  {isSuperAdmin && (
                    <Button onClick={() => setIsEditing(true)}>
                      <Play size={16} />
                      Agregar video
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
