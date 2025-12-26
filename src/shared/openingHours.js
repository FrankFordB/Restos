// Utility functions and hook for checking store opening hours

const DAYS_MAP = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
}

/**
 * Check if the store is currently open based on opening hours
 * @param {Array} openingHours - Array of { day, open, close, enabled }
 * @returns {{ isOpen: boolean, currentSchedule: object | null, nextOpen: string | null }}
 */
export function checkIsStoreOpen(openingHours) {
  if (!openingHours || !Array.isArray(openingHours) || openingHours.length === 0) {
    // No hours defined = always open
    return { isOpen: true, currentSchedule: null, nextOpen: null, noSchedule: true }
  }

  const now = new Date()
  const currentDay = DAYS_MAP[now.getDay()]
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')

  // Find today's schedule
  const todaySchedule = openingHours.find(h => h.day?.toLowerCase() === currentDay && h.enabled)

  if (todaySchedule) {
    const { open, close } = todaySchedule
    
    // Handle overnight hours (e.g., 22:00 - 02:00)
    if (close < open) {
      // Overnight: open if current time >= open OR current time < close
      if (currentTime >= open || currentTime < close) {
        return { isOpen: true, currentSchedule: todaySchedule, nextOpen: null }
      }
    } else {
      // Normal hours
      if (currentTime >= open && currentTime < close) {
        return { isOpen: true, currentSchedule: todaySchedule, nextOpen: null }
      }
    }

    // Store is closed but has schedule for today
    if (currentTime < todaySchedule.open) {
      return { 
        isOpen: false, 
        currentSchedule: todaySchedule, 
        nextOpen: `Hoy a las ${todaySchedule.open}` 
      }
    }
  }

  // Find next open day
  const daysOrder = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const currentDayIndex = now.getDay()
  
  for (let i = 1; i <= 7; i++) {
    const nextDayIndex = (currentDayIndex + i) % 7
    const nextDayName = DAYS_MAP[nextDayIndex]
    const nextSchedule = openingHours.find(h => h.day?.toLowerCase() === nextDayName && h.enabled)
    
    if (nextSchedule) {
      const dayLabel = i === 1 ? 'Mañana' : nextSchedule.day.charAt(0).toUpperCase() + nextSchedule.day.slice(1)
      return { 
        isOpen: false, 
        currentSchedule: null, 
        nextOpen: `${dayLabel} a las ${nextSchedule.open}` 
      }
    }
  }

  // No schedule found at all
  return { isOpen: false, currentSchedule: null, nextOpen: null }
}

/**
 * Format opening hours for display
 * @param {Array} openingHours
 * @returns {Array} Formatted hours grouped by schedule
 */
export function formatOpeningHours(openingHours) {
  if (!openingHours || !Array.isArray(openingHours)) return []
  
  return openingHours
    .filter(h => h.enabled)
    .map(h => ({
      day: h.day.charAt(0).toUpperCase() + h.day.slice(1),
      hours: `${h.open} - ${h.close}`
    }))
}

/**
 * Get default opening hours template
 */
export function getDefaultOpeningHours() {
  return [
    { day: 'lunes', open: '09:00', close: '22:00', enabled: true },
    { day: 'martes', open: '09:00', close: '22:00', enabled: true },
    { day: 'miercoles', open: '09:00', close: '22:00', enabled: true },
    { day: 'jueves', open: '09:00', close: '22:00', enabled: true },
    { day: 'viernes', open: '09:00', close: '23:00', enabled: true },
    { day: 'sabado', open: '10:00', close: '23:00', enabled: true },
    { day: 'domingo', open: '10:00', close: '21:00', enabled: false },
  ]
}

export const DAYS_OPTIONS = [
  { value: 'lunes', label: 'Lunes' },
  { value: 'martes', label: 'Martes' },
  { value: 'miercoles', label: 'Miércoles' },
  { value: 'jueves', label: 'Jueves' },
  { value: 'viernes', label: 'Viernes' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
]

export const TIME_OPTIONS = (() => {
  const options = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
      options.push({ value: time, label: time })
    }
  }
  return options
})()
