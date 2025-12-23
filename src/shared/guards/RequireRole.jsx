import { Navigate, Outlet } from 'react-router-dom'
import { useAppSelector } from '../../app/hooks'
import { selectUser } from '../../features/auth/authSlice'

export default function RequireRole({ allow }) {
  const user = useAppSelector(selectUser)

  if (!user) return <Navigate to="/login" replace />
  if (!allow.includes(user.role)) return <Navigate to="/unauthorized" replace />

  return <Outlet />
}
