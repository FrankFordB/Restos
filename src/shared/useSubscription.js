/**
 * Hook centralizado para manejo de suscripciones
 * 
 * IMPORTANTE: Este hook valida SIEMPRE contra el backend.
 * Nunca confiar en flags del frontend para decisiones de permisos.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { supabase } from '../lib/supabaseClient';
import { SUBSCRIPTION_TIERS } from './subscriptions';

// Orden de tiers para comparación
const TIER_ORDER = {
  free: 0,
  premium: 1,
  premium_pro: 2
};

// Features por tier
const TIER_FEATURES = {
  free: [
    'basic_widgets',
    'basic_theme',
    'basic_products',
  ],
  premium: [
    'basic_widgets',
    'basic_theme',
    'basic_products',
    'carousel_widget',
    'gallery_widget',
    'map_widget',
    'custom_cards',
    'custom_fonts',
    'extra_categories',
    'priority_support',
  ],
  premium_pro: [
    'basic_widgets',
    'basic_theme',
    'basic_products',
    'carousel_widget',
    'gallery_widget',
    'map_widget',
    'custom_cards',
    'custom_fonts',
    'extra_categories',
    'priority_support',
    'page_builder',
    'unlimited_orders',
    'advanced_analytics',
    'video_widget',
    'advanced_hero',
    'api_access',
  ]
};

// Cache local (solo para UI, NO para decisiones de seguridad)
const subscriptionCache = new Map();
const CACHE_TTL = 60000; // 1 minuto

/**
 * Hook principal de suscripciones
 */
export function useSubscription() {
  const tenant = useSelector((state) => state.tenants?.currentTenant);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Obtener estado actualizado del backend
  const refreshStatus = useCallback(async () => {
    if (!tenant?.id) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Llamar a función del backend
      const { data, error: rpcError } = await supabase.rpc('get_subscription_status', {
        p_tenant_id: tenant.id
      });

      if (rpcError) throw rpcError;

      setStatus(data);
      
      // Actualizar cache
      subscriptionCache.set(tenant.id, {
        data,
        timestamp: Date.now()
      });

    } catch (err) {
      console.error('Error fetching subscription status:', err);
      setError(err.message);
      
      // Fallback: usar datos del tenant en Redux (menos confiable)
      setStatus({
        tenant_id: tenant.id,
        stored_tier: tenant.subscription_tier || 'free',
        effective_tier: tenant.subscription_tier || 'free',
        subscription_status: tenant.subscription_status || 'active',
        premium_until: tenant.premium_until,
        is_expired: false,
        days_remaining: 0,
        auto_renew: tenant.auto_renew || false,
        orders_limit: tenant.orders_limit || 15,
        orders_remaining: tenant.orders_remaining || 15,
      });
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  // Cargar estado inicial y cuando cambie tenant
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Suscribirse a cambios en tiempo real
  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`tenant-subscription-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `id=eq.${tenant.id}`
        },
        (payload) => {
          // Refrescar cuando cambie el tenant
          refreshStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, refreshStatus]);

  // Tier efectivo (considerando vencimiento)
  const effectiveTier = useMemo(() => {
    return status?.effective_tier || 'free';
  }, [status?.effective_tier]);

  // Verificar si tiene acceso a una feature
  const hasFeature = useCallback((featureName) => {
    const tierFeatures = TIER_FEATURES[effectiveTier] || TIER_FEATURES.free;
    return tierFeatures.includes(featureName);
  }, [effectiveTier]);

  // Verificar si puede usar un tier específico
  const hasTierAccess = useCallback((requiredTier) => {
    const currentOrder = TIER_ORDER[effectiveTier] ?? 0;
    const requiredOrder = TIER_ORDER[requiredTier] ?? 0;
    return currentOrder >= requiredOrder;
  }, [effectiveTier]);

  // Validar acción contra el backend (para acciones sensibles)
  const validateAction = useCallback(async (action, requiredTier = 'premium') => {
    if (!tenant?.id) {
      return {
        allowed: false,
        message: 'No tenant found',
        current_tier: 'free'
      };
    }

    try {
      const { data, error: rpcError } = await supabase.rpc('validate_premium_action', {
        p_tenant_id: tenant.id,
        p_action: action,
        p_required_tier: requiredTier
      });

      if (rpcError) throw rpcError;
      return data;
    } catch (err) {
      console.error('Error validating action:', err);
      // En caso de error, denegar por seguridad
      return {
        allowed: false,
        message: 'Error de validación. Intenta nuevamente.',
        current_tier: effectiveTier
      };
    }
  }, [tenant?.id, effectiveTier]);

  // Verificar si está vencido
  const isExpired = useMemo(() => {
    return status?.is_expired || false;
  }, [status?.is_expired]);

  // Días restantes
  const daysRemaining = useMemo(() => {
    return status?.days_remaining || 0;
  }, [status?.days_remaining]);

  // ¿Está por vencer? (menos de 7 días)
  const isExpiringSoon = useMemo(() => {
    return daysRemaining > 0 && daysRemaining <= 7;
  }, [daysRemaining]);

  // Límites de órdenes
  const orderLimits = useMemo(() => ({
    limit: status?.orders_limit,
    remaining: status?.orders_remaining,
    isUnlimited: status?.orders_limit === null,
    percentage: status?.orders_limit 
      ? Math.round((status.orders_remaining / status.orders_limit) * 100) 
      : 100
  }), [status?.orders_limit, status?.orders_remaining]);

  return {
    // Estado
    status,
    loading,
    error,
    
    // Tier
    tier: effectiveTier,
    storedTier: status?.stored_tier || 'free',
    
    // Permisos
    hasFeature,
    hasTierAccess,
    validateAction,
    
    // Estado de suscripción
    isExpired,
    isExpiringSoon,
    daysRemaining,
    subscriptionStatus: status?.subscription_status || 'active',
    autoRenew: status?.auto_renew || false,
    premiumUntil: status?.premium_until,
    
    // Órdenes
    orderLimits,
    
    // Tier programado
    scheduledTier: status?.scheduled_tier,
    scheduledAt: status?.scheduled_at,
    
    // Acciones
    refresh: refreshStatus,
    
    // Helpers
    isPremium: effectiveTier === 'premium' || effectiveTier === 'premium_pro',
    isPremiumPro: effectiveTier === 'premium_pro',
    isFree: effectiveTier === 'free',
  };
}

/**
 * Hook para verificar una feature específica
 */
export function useHasFeature(featureName) {
  const { hasFeature, loading } = useSubscription();
  return {
    hasAccess: hasFeature(featureName),
    loading
  };
}

/**
 * Hook para verificar tier específico
 */
export function useHasTier(requiredTier) {
  const { hasTierAccess, tier, loading } = useSubscription();
  return {
    hasAccess: hasTierAccess(requiredTier),
    currentTier: tier,
    loading
  };
}

/**
 * HOC para proteger componentes por tier
 */
export function withSubscriptionGuard(Component, requiredTier, FallbackComponent = null) {
  return function SubscriptionGuardedComponent(props) {
    const { hasTierAccess, loading, tier } = useSubscription();
    
    if (loading) {
      return <div className="subscription-guard-loading">Verificando suscripción...</div>;
    }
    
    if (!hasTierAccess(requiredTier)) {
      if (FallbackComponent) {
        return <FallbackComponent requiredTier={requiredTier} currentTier={tier} {...props} />;
      }
      return null;
    }
    
    return <Component {...props} />;
  };
}

export default useSubscription;
