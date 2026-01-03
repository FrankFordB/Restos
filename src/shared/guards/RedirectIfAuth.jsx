import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../../features/auth/authSlice'
import { ROLES } from '../constants'

/**
 * Guard que redirige a usuarios ya autenticados
 * Útil para páginas de login/register que no deberían verse si ya estás logueado
 */
export default function RedirectIfAuth({ children }) {
  const user = useAppSelector(selectUser)
  const location = useLocation()

  if (user) {
    // Si el usuario ya está autenticado, redirigir según su rol
    const redirectTo = user.role === ROLES.SUPER_ADMIN ? '/admin' : '/dashboard'
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  // Si no está autenticado, mostrar el contenido (login/register)
  return children ? children : <Outlet />
}
