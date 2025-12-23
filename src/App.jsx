import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AppLayout from './components/layout/AppLayout/AppLayout'
import RequireAuth from './shared/guards/RequireAuth'
import RequireRole from './shared/guards/RequireRole'
import { ROLES } from './shared/constants'

import HomePage from './pages/Home/HomePage'
import LoginPage from './pages/Auth/LoginPage'
import RegisterPage from './pages/Auth/RegisterPage'
import StorefrontPage from './pages/Storefront/StorefrontPage'
import UserDashboardPage from './pages/Dashboard/UserDashboardPage'
import AdminDashboardPage from './pages/Dashboard/AdminDashboardPage'
import UnauthorizedPage from './pages/System/UnauthorizedPage'
import NotFoundPage from './pages/System/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/store/:slug" element={<StorefrontPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<UserDashboardPage />} />

            <Route element={<RequireRole allow={[ROLES.SUPER_ADMIN]} />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
