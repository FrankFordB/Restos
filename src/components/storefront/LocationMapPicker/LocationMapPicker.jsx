import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icon issue with bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

export default function LocationMapPicker({ lat, lng, onPositionChange }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markerRef = useRef(null)
  const onPositionChangeRef = useRef(onPositionChange)

  // Keep callback ref up to date to avoid stale closures
  useEffect(() => {
    onPositionChangeRef.current = onPositionChange
  }, [onPositionChange])

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return

    // Init map
    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 18,
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    // Draggable marker
    const marker = L.marker([lat, lng], { draggable: true }).addTo(map)

    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      onPositionChangeRef.current?.(pos.lat, pos.lng)
    })

    // Also allow clicking on map to reposition
    map.on('click', (e) => {
      marker.setLatLng(e.latlng)
      onPositionChangeRef.current?.(e.latlng.lat, e.latlng.lng)
    })

    mapInstanceRef.current = map
    markerRef.current = marker

    // Force re-render of tiles after short delay (container size issue)
    setTimeout(() => map.invalidateSize(), 200)

    return () => {
      map.remove()
      mapInstanceRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only init once

  // Update marker if coords change externally (e.g. GPS re-fetch)
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      const currentPos = markerRef.current.getLatLng()
      if (Math.abs(currentPos.lat - lat) > 0.00001 || Math.abs(currentPos.lng - lng) > 0.00001) {
        markerRef.current.setLatLng([lat, lng])
        mapInstanceRef.current.setView([lat, lng], mapInstanceRef.current.getZoom())
      }
    }
  }, [lat, lng])

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: '220px',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '2px solid #e5e7eb',
      }}
    />
  )
}
