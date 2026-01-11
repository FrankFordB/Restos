/**
 * Componente para proteger features por nivel de suscripción
 * 
 * Uso:
 * <SubscriptionGuard requiredTier="premium">
 *   <PremiumFeature />
 * </SubscriptionGuard>
 * 
 * <SubscriptionGuard 
 *   feature="page_builder"
 *   fallback={<UpgradePrompt />}
 * >
 *   <PageBuilder />
 * </SubscriptionGuard>
 */

import React from 'react';
import { useSubscription } from '../../shared/useSubscription';
import { Lock, Crown, Sparkles } from 'lucide-react';
import './SubscriptionGuard.css';

// Componente de fallback por defecto
function DefaultFallback({ requiredTier, currentTier, feature }) {
  const tierLabels = {
    free: 'Gratis',
    premium: 'Premium',
    premium_pro: 'Premium Pro'
  };

  return (
    <div className="subscription-guard__fallback">
      <div className="subscription-guard__icon">
        <Lock size={32} />
      </div>
      <h3 className="subscription-guard__title">
        Función Premium
      </h3>
      <p className="subscription-guard__description">
        {feature 
          ? `Esta función requiere ${tierLabels[requiredTier] || 'Premium'}.`
          : `Actualiza a ${tierLabels[requiredTier] || 'Premium'} para acceder.`
        }
      </p>
      <p className="subscription-guard__current">
        Tu plan actual: <strong>{tierLabels[currentTier] || 'Gratis'}</strong>
      </p>
      <a href="/dashboard/subscription" className="subscription-guard__cta">
        <Crown size={16} />
        Ver planes
      </a>
    </div>
  );
}

// Badge de premium para overlays
function PremiumBadge({ tier }) {
  if (tier === 'premium_pro') {
    return (
      <span className="subscription-guard__badge subscription-guard__badge--pro">
        <Sparkles size={12} />
        PRO
      </span>
    );
  }
  return (
    <span className="subscription-guard__badge subscription-guard__badge--premium">
      <Crown size={12} />
      Premium
    </span>
  );
}

/**
 * Componente principal de guard
 */
export default function SubscriptionGuard({
  children,
  requiredTier,
  feature,
  fallback,
  showOverlay = false,
  overlayMessage,
  validateOnRender = false,
}) {
  const { 
    hasFeature, 
    hasTierAccess, 
    tier, 
    loading, 
    validateAction,
    isPremium,
    isPremiumPro 
  } = useSubscription();

  // Determinar si tiene acceso
  const hasAccess = feature 
    ? hasFeature(feature) 
    : hasTierAccess(requiredTier || 'premium');

  // Validación extra contra backend si se requiere
  const [backendValidated, setBackendValidated] = React.useState(!validateOnRender);
  const [validating, setValidating] = React.useState(validateOnRender);

  React.useEffect(() => {
    if (validateOnRender && hasAccess) {
      setValidating(true);
      validateAction(feature || 'premium_access', requiredTier || 'premium')
        .then(result => {
          setBackendValidated(result.allowed);
        })
        .finally(() => {
          setValidating(false);
        });
    }
  }, [validateOnRender, hasAccess, feature, requiredTier, validateAction]);

  // Loading
  if (loading || validating) {
    return (
      <div className="subscription-guard__loading">
        <div className="subscription-guard__spinner" />
      </div>
    );
  }

  // Sin acceso
  if (!hasAccess || !backendValidated) {
    // Mostrar overlay sobre el contenido
    if (showOverlay) {
      return (
        <div className="subscription-guard__overlay-container">
          <div className="subscription-guard__overlay">
            <PremiumBadge tier={requiredTier || 'premium'} />
            <Lock size={24} />
            <p>{overlayMessage || 'Requiere plan Premium'}</p>
            <a href="/dashboard/subscription" className="subscription-guard__overlay-cta">
              Desbloquear
            </a>
          </div>
          <div className="subscription-guard__blurred">
            {children}
          </div>
        </div>
      );
    }

    // Fallback personalizado
    if (fallback) {
      return fallback;
    }

    // Fallback por defecto
    return (
      <DefaultFallback 
        requiredTier={requiredTier || 'premium'} 
        currentTier={tier}
        feature={feature}
      />
    );
  }

  // Con acceso - renderizar children
  return children;
}

// Exportar componentes auxiliares
export { PremiumBadge, DefaultFallback };
