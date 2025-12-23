import { createId } from '../../shared/ids'
import { ROLES } from '../../shared/constants'

const USERS_KEY = 'mock.users'

function readUsers() {
  const raw = localStorage.getItem(USERS_KEY)
  if (!raw) {
    const seed = [
      {
        id: 'user_superadmin',
        email: 'admin@resto.local',
        password: 'admin123',
        role: ROLES.SUPER_ADMIN,
        tenantId: null,
      },
      {
        id: 'user_demo_tenant_admin',
        email: 'demo@resto.local',
        password: 'demo123',
        role: ROLES.TENANT_ADMIN,
        tenantId: 'tenant_demo',
      },
    ]
    localStorage.setItem(USERS_KEY, JSON.stringify(seed))
    return seed
  }
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function writeUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function mockSignIn({ email, password }) {
  const users = readUsers()
  const match = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password,
  )

  if (!match) {
    const error = new Error('Credenciales inválidas')
    error.code = 'INVALID_CREDENTIALS'
    throw error
  }

  const { password: _pw, ...safeUser } = match
  return safeUser
}

export function mockRegister({ email, password, tenantName }) {
  const users = readUsers()
  const exists = users.some((u) => u.email.toLowerCase() === email.toLowerCase())
  if (exists) {
    const error = new Error('Ese email ya está registrado')
    error.code = 'EMAIL_IN_USE'
    throw error
  }

  const tenantId = createId('tenant')

  const newUser = {
    id: createId('user'),
    email,
    password,
    role: ROLES.TENANT_ADMIN,
    tenantId,
  }

  writeUsers([...users, newUser])

  const { password: _pw, ...safeUser } = newUser

  return {
    user: safeUser,
    createdTenant: {
      id: tenantId,
      slug: tenantName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, ''),
      name: tenantName.trim(),
    },
  }
}
