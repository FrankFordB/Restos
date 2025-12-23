import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import './AuthPages.css'
import Card from '../../components/ui/Card/Card'
import Input from '../../components/ui/Input/Input'
import Button from '../../components/ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { clearAuthError, selectAuth, signInWithEmail } from '../../features/auth/authSlice'
import { ROLES } from '../../shared/constants'

export default function LoginPage() {
  const dispatch = useAppDispatch()
  const auth = useAppSelector(selectAuth)
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const goAfter = (role) => {
    const from = location.state?.from
    if (from) return navigate(from)
    return navigate(role === ROLES.SUPER_ADMIN ? '/admin' : '/dashboard')
  }

  return (
    <div className="auth">
      <Card
        title="Iniciar sesión"
        actions={
          <Link to="/register" className="auth__link">
            Crear cuenta
          </Link>
        }
      >
        <div className="auth__form">
          <Input label="Email" value={email} onChange={setEmail} placeholder="demo@resto.local" />
          <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="demo123" />

          {auth.error ? <div className="auth__error">{auth.error}</div> : null}

          <div className="auth__actions">
            <Button
              onClick={async () => {
                dispatch(clearAuthError())
                try {
                  const user = await dispatch(signInWithEmail({ email, password })).unwrap()
                  goAfter(user.role)
                } catch {
                  // error handled in slice
                }
              }}
            >
              Entrar
            </Button>
            <Button variant="secondary" onClick={() => {
              setEmail('demo@resto.local')
              setPassword('demo123')
            }}>
              Cargar demo
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
