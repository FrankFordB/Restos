import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import './AuthPages.css'
import Card from '../../components/ui/Card/Card'
import Input from '../../components/ui/Input/Input'
import Button from '../../components/ui/Button/Button'
import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { addTenant } from '../../features/tenants/tenantsSlice'
import { clearAuthError, registerWithEmail, selectAuth } from '../../features/auth/authSlice'

export default function RegisterPage() {
  const dispatch = useAppDispatch()
  const auth = useAppSelector(selectAuth)
  const navigate = useNavigate()

  const [tenantName, setTenantName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="auth">
      <Card
        title="Registro de restaurante"
        actions={
          <Link to="/login" className="auth__link">
            Ya tengo cuenta
          </Link>
        }
      >
        <div className="auth__form">
          <Input label="Nombre del restaurante" value={tenantName} onChange={setTenantName} placeholder="Mi Hamburguesería" />
          <Input label="Email" value={email} onChange={setEmail} placeholder="mi@resto.com" />
          <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="mínimo 6" />

          {auth.error ? <div className="auth__error">{auth.error}</div> : null}

          <div className="auth__actions">
            <Button
              onClick={async () => {
                dispatch(clearAuthError())
                try {
                  const result = await dispatch(
                    registerWithEmail({ email, password, tenantName }),
                  ).unwrap()
                  if (result?.createdTenant) dispatch(addTenant(result.createdTenant))
                  navigate('/dashboard')
                } catch {
                  // error handled in slice
                }
              }}
            >
              Crear
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
