-- Fix: Crear la función get_order_limit_for_tier si no existe
-- Esta función es necesaria para los triggers de suscripción

CREATE OR REPLACE FUNCTION public.get_order_limit_for_tier(tier text)
RETURNS integer AS $$
BEGIN
  RETURN CASE 
    WHEN tier = 'free' THEN 15
    WHEN tier = 'premium' THEN 80
    WHEN tier = 'premium_pro' THEN NULL -- NULL = ilimitado
    ELSE 15
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Dar permisos de ejecución
GRANT EXECUTE ON FUNCTION public.get_order_limit_for_tier(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_limit_for_tier(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_limit_for_tier(text) TO service_role;
