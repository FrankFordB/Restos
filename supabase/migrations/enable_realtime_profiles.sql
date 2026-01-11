-- ============================================================================
-- Habilitar Realtime para la tabla profiles
-- Esto permite detectar cambios en tiempo real (ej: cuando un admin suspende una cuenta)
-- Ejecutar en Supabase SQL Editor
-- ============================================================================

-- Habilitar Realtime para la tabla profiles
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Nota: Si aparece error "relation already exists", significa que ya está habilitado.
-- En ese caso, puedes ignorar el error.
