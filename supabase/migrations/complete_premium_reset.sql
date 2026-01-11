-- ============================================================================
-- RESET COMPLETO DE CONFIGURACIONES PREMIUM
-- ============================================================================
-- Ejecutar en Supabase SQL Editor
-- Este script resetea TODAS las configuraciones premium cuando un tenant
-- baja a plan FREE
-- ============================================================================

-- 1. FUNCIÓN MEJORADA: Ejecutar downgrade automático con RESET COMPLETO
DROP FUNCTION IF EXISTS public.execute_subscription_downgrade(UUID);

CREATE OR REPLACE FUNCTION public.execute_subscription_downgrade(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant RECORD;
  v_old_tier TEXT;
BEGIN
  -- Obtener tenant
  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tenant not found');
  END IF;

  v_old_tier := v_tenant.subscription_tier;

  -- Si ya es free, no hacer nada
  IF v_old_tier = 'free' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already on free tier');
  END IF;

  -- ========================================
  -- ACTUALIZAR TENANT A FREE
  -- ========================================
  UPDATE public.tenants SET
    subscription_tier = 'free',
    subscription_status = 'active',
    premium_until = NULL,
    auto_renew = FALSE,
    orders_limit = 15,
    orders_remaining = 15,
    scheduled_tier = NULL,
    scheduled_at = NULL,
    -- Reset mobile settings
    mobile_header_design = 'centered',
    mobile_card_design = 'stackedFull',
    mobile_spacing_option = 'balanced',
    mobile_typography_option = 'standard',
    mobile_carousel_options = '{"showTitle": true, "showSubtitle": true, "showCta": true}'::jsonb,
    -- Reset welcome modal
    welcome_modal_features_design = 'simple'
  WHERE id = p_tenant_id;

  -- ========================================
  -- RESET COMPLETO DE TEMA (tenant_themes)
  -- ========================================
  UPDATE public.tenant_themes SET
    -- Reset card layout a classic (único permitido en FREE)
    product_card_layout = 'classic',
    
    -- Reset font a default (sin custom fonts en FREE)
    font_family = NULL,
    
    -- Reset card style a glass (default)
    card_style = 'glass',
    
    -- Reset button style
    button_style = 'rounded',
    
    -- Reset layout style
    layout_style = 'modern',
    
    -- Reset hero style a static (único permitido en FREE)
    hero_style = 'static',
    
    -- LIMPIAR SLIDES DEL CARRUSEL (sin imágenes en FREE)
    hero_slides = NULL,
    
    -- Reset posición de título
    hero_title_position = 'center',
    
    -- Reset overlay
    hero_overlay_opacity = 50,
    
    -- Reset visibilidad hero
    hero_show_title = true,
    hero_show_subtitle = true,
    hero_show_cta = true,
    
    -- Limpiar estilo de botones del carrusel
    hero_carousel_button_style = NULL,
    
    -- Limpiar colores custom de cards (volver a defaults)
    card_bg = NULL,
    card_text = NULL,
    card_desc = NULL,
    card_price = NULL,
    card_button = NULL,
    
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  -- ========================================
  -- RESET FOOTER SETTINGS (si existen features premium)
  -- ========================================
  UPDATE public.store_footer_settings SET
    footer_style = 'simple',
    custom_links = '[]'::jsonb
  WHERE tenant_id = p_tenant_id;

  -- ========================================
  -- LOG DEL CAMBIO
  -- ========================================
  INSERT INTO public.subscription_logs (
    tenant_id,
    event_type,
    old_tier,
    new_tier,
    description,
    metadata,
    created_at
  ) VALUES (
    p_tenant_id,
    'auto_downgrade',
    v_old_tier,
    'free',
    'Downgrade automático - Reset completo de configuraciones premium',
    jsonb_build_object(
      'reset_theme', true,
      'reset_hero_slides', true,
      'reset_mobile_settings', true,
      'reset_footer', true
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'old_tier', v_old_tier,
    'new_tier', 'free',
    'message', 'Downgrade ejecutado correctamente - Todas las configuraciones premium fueron reseteadas'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_subscription_downgrade TO service_role;


-- ========================================
-- 2. TRIGGER: Validar y corregir al guardar tema
-- ========================================
DROP TRIGGER IF EXISTS validate_theme_changes_trigger ON public.tenant_themes;
DROP FUNCTION IF EXISTS public.validate_theme_changes();

CREATE OR REPLACE FUNCTION public.validate_theme_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_effective_tier TEXT;
BEGIN
  -- Obtener tier efectivo del tenant
  v_effective_tier := public.get_effective_tier(NEW.tenant_id);

  -- ========================================
  -- RESTRICCIONES PARA FREE
  -- ========================================
  IF v_effective_tier = 'free' THEN
    -- Solo layout 'classic' permitido
    NEW.product_card_layout := 'classic';
    
    -- Sin custom fonts
    NEW.font_family := NULL;
    
    -- Solo hero 'static'
    NEW.hero_style := 'static';
    
    -- Sin slides de carrusel
    NEW.hero_slides := NULL;
    
    -- Sin estilo de botón de carrusel
    NEW.hero_carousel_button_style := NULL;
    
    -- Resetear card style a default
    NEW.card_style := 'glass';
    
    -- Resetear button style a default
    NEW.button_style := 'rounded';
    
    -- Resetear layout style a default
    NEW.layout_style := 'modern';
  END IF;

  -- ========================================
  -- RESTRICCIONES PARA PREMIUM (no PRO)
  -- ========================================
  IF v_effective_tier = 'premium' THEN
    -- Layouts exclusivos de PRO
    IF NEW.product_card_layout IN ('magazine', 'minimal', 'polaroid', 'banner') THEN
      NEW.product_card_layout := 'horizontal';
    END IF;
    
    -- Hero styles exclusivos de PRO
    IF NEW.hero_style IN ('parallax_depth', 'cube_rotate', 'reveal_wipe', 'zoom_blur') THEN
      NEW.hero_style := 'slide_fade';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_theme_changes_trigger
  BEFORE INSERT OR UPDATE ON public.tenant_themes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_theme_changes();


-- ========================================
-- 3. FUNCIÓN: Forzar reset de configuraciones premium para un tenant
-- (Para usar manualmente si es necesario)
-- ========================================
CREATE OR REPLACE FUNCTION public.force_reset_premium_settings(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Forzar update en tenant_themes (activará el trigger)
  UPDATE public.tenant_themes SET
    updated_at = NOW()
  WHERE tenant_id = p_tenant_id;

  -- Limpiar slides del carrusel
  UPDATE public.tenant_themes SET
    hero_slides = NULL,
    product_card_layout = 'classic',
    hero_style = 'static',
    font_family = NULL,
    hero_carousel_button_style = NULL
  WHERE tenant_id = p_tenant_id;

  -- Limpiar mobile settings en tenant
  UPDATE public.tenants SET
    mobile_header_design = 'centered',
    mobile_card_design = 'stackedFull',
    mobile_spacing_option = 'balanced',
    mobile_typography_option = 'standard',
    mobile_carousel_options = '{"showTitle": true, "showSubtitle": true, "showCta": true}'::jsonb
  WHERE id = p_tenant_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Configuraciones premium reseteadas'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_reset_premium_settings TO service_role;


-- ========================================
-- 4. Ejecutar reset para tenants FREE que tienen config premium
-- (Limpiar datos inconsistentes existentes)
-- ========================================
DO $$
DECLARE
  v_tenant RECORD;
BEGIN
  -- Buscar tenants FREE con configuraciones premium
  FOR v_tenant IN
    SELECT t.id, t.name
    FROM public.tenants t
    JOIN public.tenant_themes th ON t.id = th.tenant_id
    WHERE t.subscription_tier = 'free'
      AND (
        th.product_card_layout != 'classic'
        OR th.hero_style NOT IN ('static', 'simple')
        OR th.hero_slides IS NOT NULL
        OR th.font_family IS NOT NULL
        OR th.hero_carousel_button_style IS NOT NULL
      )
  LOOP
    RAISE NOTICE 'Reseteando configuraciones premium para tenant: %', v_tenant.name;
    PERFORM public.force_reset_premium_settings(v_tenant.id);
  END LOOP;
END;
$$;

-- ========================================
-- Verificar tenants afectados
-- ========================================
SELECT 
  t.name,
  t.subscription_tier,
  th.product_card_layout,
  th.hero_style,
  th.hero_slides IS NOT NULL as has_slides,
  th.font_family
FROM public.tenants t
LEFT JOIN public.tenant_themes th ON t.id = th.tenant_id
WHERE t.subscription_tier = 'free'
ORDER BY t.name;
