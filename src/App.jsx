import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useNavigate, useLocation } from 'react-router-dom'

import AppLayout from './components/layout/AppLayout/AppLayout'
import RequireAuth from './shared/guards/RequireAuth'
import RequireRole from './shared/guards/RequireRole'
import RedirectIfAuth from './shared/guards/RedirectIfAuth'
import { ROLES } from './shared/constants'

import HomePage from './pages/Home/HomePage'
import LoginPage from './pages/Auth/LoginPage'
import RegisterPage from './pages/Auth/RegisterPage'
import VerifyEmailPage from './pages/Auth/VerifyEmailPage'
import AuthCallbackPage from './pages/Auth/AuthCallbackPage'
import TwoFactorSetup from './pages/Auth/TwoFactorSetup'
import StorefrontPage from './pages/Storefront/StorefrontPage'
import StoreTermsPage from './pages/Storefront/StoreTermsPage'
import TenantHomePage from './pages/TenantHome/TenantHomePage'
import DirectoryPage from './pages/Directory/DirectoryPage'
import UserDashboardPage from './pages/Dashboard/UserDashboardPage'
import AdminDashboardPage from './pages/Dashboard/AdminDashboardPage'
import SuperAdminDashboard from './pages/System/SuperAdminDashboard'
import AdminSubscriptionsPage from './pages/System/AdminSubscriptionsPage'
import UnauthorizedPage from './pages/System/UnauthorizedPage'
import NotFoundPage from './pages/System/NotFoundPage'
import PaymentResult from './pages/Payment/PaymentResult'
import { TermsPage, PrivacyPage, CookiesPage, ReturnsPage, FaqPage } from './pages/Legal'

// Componente para detectar tokens OAuth en el hash y redirigir
function OAuthHashHandler() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    // Si hay un access_token en el hash y no estamos en /auth/callback
    const hash = window.location.hash
    if (hash && hash.includes('access_token=') && location.pathname !== '/auth/callback') {
      // Redirigir a /auth/callback manteniendo el hash
      navigate('/auth/callback' + hash, { replace: true })
    }
  }, [location.pathname, navigate])

  return null
}

function AppRoutes() {
  return (
    <>
      <OAuthHashHandler />
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/restaurantes" element={<DirectoryPage />} />
          <Route path="/login" element={<RedirectIfAuth><LoginPage /></RedirectIfAuth>} />
          <Route path="/register" element={<RedirectIfAuth><RegisterPage /></RedirectIfAuth>} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/verify" element={<VerifyEmailPage />} />
          
          {/* 2FA Setup - requiere autenticación */}
          <Route element={<RequireAuth />}>
            <Route path="/security/2fa" element={<TwoFactorSetup />} />
          </Route>
          
          {/* Páginas legales */}
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/terminos" element={<TermsPage />} />
          <Route path="/privacidad" element={<PrivacyPage />} />
          <Route path="/cookies" element={<CookiesPage />} />
          <Route path="/devoluciones" element={<ReturnsPage />} />

          <Route path="/r/:slug" element={<TenantHomePage />} />
          <Route path="/store/:slug" element={<StorefrontPage />} />
          <Route path="/tienda/:slug" element={<StorefrontPage />} />
          <Route path="/tienda/:slug/terminos" element={<StoreTermsPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Páginas de resultado de pago de MercadoPago - Suscripciones */}
          <Route path="/payment/success" element={<PaymentResult />} />
          <Route path="/payment/failure" element={<PaymentResult />} />
          <Route path="/payment/pending" element={<PaymentResult />} />
          
          {/* Páginas de resultado de pago - Tiendas (compras de clientes) */}
          <Route path="/tienda/:slug/payment/success" element={<PaymentResult />} />
          <Route path="/tienda/:slug/payment/failure" element={<PaymentResult />} />
          <Route path="/tienda/:slug/payment/pending" element={<PaymentResult />} />
          <Route path="/tienda/:slug/checkout/success" element={<PaymentResult />} />
          <Route path="/tienda/:slug/checkout/failure" element={<PaymentResult />} />
          <Route path="/tienda/:slug/checkout/pending" element={<PaymentResult />} />

          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<UserDashboardPage />} />

            <Route element={<RequireRole allow={[ROLES.SUPER_ADMIN]} />}>
              <Route path="/admin" element={<SuperAdminDashboard />} />
              <Route path="/admin/legacy" element={<AdminDashboardPage />} />
              <Route path="/admin/subscriptions" element={<AdminSubscriptionsPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
