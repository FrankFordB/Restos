# Resto Proyect (React + Vite)

Proyecto escalable para venta de comida (hamburguesas/restaurantes) con:

- Roles: `super_admin` (control total) y `tenant_admin` (restaurante).
- Dashboard por rol.
- Personalización por restaurante (diseño via CSS variables) + CRUD de productos (nombre, precio, activo).
- Tienda pública por restaurante: `/store/:slug`.
- Estado ordenado con Redux Toolkit (por features) y persistencia en `localStorage`.

## Ejecutar

```bash
npm install
npm run dev
```

## Credenciales demo (modo MOCK)

- Usuario restaurante: `demo@resto.local` / `demo123`
- Super usuario: `admin@resto.local` / `admin123`

## Base de datos recomendada

Recomendación: **Supabase (PostgreSQL)** por escalabilidad y velocidad de desarrollo:

- Auth (usuarios/roles)
- Base de datos relacional (ideal para productos, pedidos, categorías)
- Storage (imágenes de productos)

Para preparar la integración, usa `.env.example` y crea un `.env` con:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Nota: la app ya funciona sin backend (modo MOCK). Para producción, se reemplaza el mock por llamadas reales a Supabase.

## Configurar Supabase

- Guía paso a paso: [supabase/SETUP.md](supabase/SETUP.md)
- SQL listo para pegar en Supabase:
	- [supabase/schema.sql](supabase/schema.sql)
	- [supabase/rls.sql](supabase/rls.sql)
	- [supabase/triggers.sql](supabase/triggers.sql)
