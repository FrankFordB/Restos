import { Link, NavLink } from 'react-router-dom'
import './Header.css'
import Button from '../../ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../../app/hooks'
import { selectUser, signOut } from '../../../features/auth/authSlice'
import { selectTenants } from '../../../features/tenants/tenantsSlice'
import { ROLES } from '../../../shared/constants'

export default function Header() {
  const user = useAppSelector(selectUser)
  const tenants = useAppSelector(selectTenants)
  const dispatch = useAppDispatch()

  const tenantSlug = user?.tenantId ? tenants.find((t) => t.id === user.tenantId)?.slug : null
  const storeHref = tenantSlug ? `/store/${tenantSlug}` : '/store/demo-burgers'

  return (
    <header className="header">
      <div className="container header__inner">
        <Link className="header__brand" to="/">
          Resto Proyect
        </Link>

        <nav className="header__nav">
          <NavLink className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')} to="/">
            Home
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')}
            to={storeHref}
          >
            Tienda
          </NavLink>

          {user ? (
            <>
              <NavLink
                className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')}
                to={user.role === ROLES.SUPER_ADMIN ? '/admin' : '/dashboard'}
              >
                Dashboard
              </NavLink>
              <span className="header__user">{user.email}</span>
              <Button variant="secondary" size="sm" onClick={() => dispatch(signOut())}>
                Salir
              </Button>
            </>
          ) : (
            <>
              <NavLink
                className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')}
                to="/login"
              >
                Login
              </NavLink>
              <NavLink
                className={({ isActive }) => (isActive ? 'navlink navlink--active' : 'navlink')}
                to="/register"
              >
                Registro
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
