import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AppLayout from './components/layout/AppLayout/AppLayout'
import RequireAuth from './shared/guards/RequireAuth'
import RequireRole from './shared/guards/RequireRole'
import { ROLES } from './shared/constants'

import HomePage from './pages/Home/HomePage'
import LoginPage from './pages/Auth/LoginPage'
import RegisterPage from './pages/Auth/RegisterPage'
import StorefrontPage from './pages/Storefront/StorefrontPage'
import TenantHomePage from './pages/TenantHome/TenantHomePage'
import DirectoryPage from './pages/Directory/DirectoryPage'
import UserDashboardPage from './pages/Dashboard/UserDashboardPage'
import AdminDashboardPage from './pages/Dashboard/AdminDashboardPage'
import UnauthorizedPage from './pages/System/UnauthorizedPage'
import NotFoundPage from './pages/System/NotFoundPage'
import PaymentResult from './pages/Payment/PaymentResult'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/restaurantes" element={<DirectoryPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/r/:slug" element={<TenantHomePage />} />
          <Route path="/store/:slug" element={<StorefrontPage />} />
          <Route path="/tienda/:slug" element={<StorefrontPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Páginas de resultado de pago de MercadoPago */}
          <Route path="/payment/success" element={<PaymentResult />} />
          <Route path="/payment/failure" element={<PaymentResult />} />
          <Route path="/payment/pending" element={<PaymentResult />} />
          <Route path="/tienda/:slug/payment/success" element={<PaymentResult />} />
          <Route path="/tienda/:slug/payment/failure" element={<PaymentResult />} />
          <Route path="/tienda/:slug/payment/pending" element={<PaymentResult />} />

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
