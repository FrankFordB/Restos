-- Migration: Add tutorial videos configuration
-- Esta tabla almacena los videos de tutorial para cada sección del dashboard
-- Solo los super_admin pueden editar estos videos

-- Crear tabla de configuración de tutoriales
CREATE TABLE IF NOT EXISTS tutorial_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id text NOT NULL UNIQUE, -- ej: 'store-editor', 'orders', 'mobile-preview', 'extras'
  video_url text,
  video_type text DEFAULT 'youtube' CHECK (video_type IN ('youtube', 'local')),
  title text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear función para verificar si es super_admin (si no existe)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas RLS para tutorial_videos

-- Todos los usuarios autenticados pueden leer los videos de tutorial
ALTER TABLE tutorial_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tutorial videos"
  ON tutorial_videos
  FOR SELECT
  USING (true);

-- Solo super_admin puede insertar
CREATE POLICY "Super admin can insert tutorial videos"
  ON tutorial_videos
  FOR INSERT
  WITH CHECK (public.is_super_admin());

-- Solo super_admin puede actualizar
CREATE POLICY "Super admin can update tutorial videos"
  ON tutorial_videos
  FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Solo super_admin puede eliminar
CREATE POLICY "Super admin can delete tutorial videos"
  ON tutorial_videos
  FOR DELETE
  USING (public.is_super_admin());

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_tutorial_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tutorial_videos_timestamp
  BEFORE UPDATE ON tutorial_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_tutorial_videos_updated_at();

-- Insertar registros iniciales vacíos para las secciones principales
INSERT INTO tutorial_videos (section_id, title, description) VALUES
  ('store-editor', 'Tutorial: Editar mi tienda', 'Aprende a personalizar tu tienda'),
  ('orders', 'Tutorial: Gestión de Pedidos', 'Cómo gestionar pedidos de tus clientes'),
  ('mobile-preview', 'Tutorial: Vista Móvil', 'Optimiza la experiencia móvil de tu tienda'),
  ('extras', 'Tutorial: Extras y Toppings', 'Crea y gestiona opciones adicionales'),
  ('products', 'Tutorial: Gestión de Productos', 'Aprende a crear y administrar tu menú'),
  ('dashboard', 'Tutorial: Dashboard', 'Resumen general de tu tienda'),
  ('mercadopago', 'Tutorial: Configuración de MercadoPago', 'Configura los pagos para tu tienda'),
  ('sales-stats', 'Tutorial: Estadísticas de Ventas', 'Analiza el rendimiento de tu negocio')
ON CONFLICT (section_id) DO NOTHING;

-- Agregar columna first_login a profiles para el modal de bienvenida
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_login boolean DEFAULT true;

-- Comentarios
COMMENT ON TABLE tutorial_videos IS 'Almacena los videos de tutorial para cada sección del dashboard. Solo super_admin puede editar.';
COMMENT ON COLUMN tutorial_videos.section_id IS 'Identificador único de la sección (ej: store-editor, orders)';
COMMENT ON COLUMN tutorial_videos.video_type IS 'Tipo de video: youtube o local (almacenado en Supabase Storage)';
COMMENT ON COLUMN profiles.first_login IS 'Indica si es el primer inicio de sesión del usuario (para mostrar tutorial)';
