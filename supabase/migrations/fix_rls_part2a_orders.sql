-- ============================================================================
-- PARTE 2: REPLICA IDENTITY + Realtime Publication (ejecutar SEGUNDO)
-- ============================================================================

-- Ejecutar cada ALTER TABLE por separado para evitar deadlocks
ALTER TABLE public.orders REPLICA IDENTITY FULL;
