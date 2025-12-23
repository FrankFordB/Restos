import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from '../../app/hooks'
import { selectIsAuthed } from '../../features/auth/authSlice'

export default function RequireAuth() {
  const isAuthed = useAppSelector(selectIsAuthed)
  const location = useLocation()

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
