# Setup Supabase (paso a paso)

Este proyecto puede correr en:

- **Modo MOCK** (sin backend): guarda datos en `localStorage`.
- **Modo Supabase**: usa **PostgreSQL + Auth + (opcional) Storage** en la nube.

La app detecta Supabase automáticamente si existen `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

## Checklist rápido (lo mínimo para que funcione)

1. Crear proyecto en Supabase.
2. Poner `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` en el `.env` del proyecto.
3. Ejecutar SQL: `schema.sql` → `rls.sql` → `triggers.sql`.
4. Registrar un usuario desde la app (`/register`) y entrar al dashboard.

## 1) Crear el proyecto en Supabase

1. En Supabase, crea un **New project** (elige nombre, región y password de DB).
2. Espera a que termine de provisionar (puede tardar 1–3 minutos).
3. Ve a **Project Settings → API** y copia:
   - **Project URL**
   - **anon public key** (IMPORTANTE: usa `anon`, no `service_role`)

## 2) Variables de entorno (en tu PC)

1. En la raíz del proyecto (misma carpeta donde está `package.json`), duplica `.env.example` como `.env`.
2. Completa:

```bash
VITE_SUPABASE_URL=TU_PROJECT_URL
VITE_SUPABASE_ANON_KEY=TU_ANON_KEY
```

Notas:

- Si ya tenías `npm run dev` corriendo, **reinicia el servidor** después de editar `.env`.
- El archivo correcto es el `.env` de la **raíz del proyecto** (no uno dentro de `supabase/`).

## 3) Ejecutar SQL (tablas + seguridad + trigger)

En Supabase → **SQL Editor** ejecuta, en este orden:

1. [supabase/schema.sql](schema.sql) (tablas)
2. [supabase/rls.sql](rls.sql) (seguridad / multi-tenant)
3. [supabase/triggers.sql](triggers.sql) (crea perfil al registrar usuario)

Si quieres **subir fotos de productos**, estos SQL también crean/configuran:

- Bucket de Storage `product-images` (público)
- Policies de `storage.objects` para permitir subir imágenes por tenant

Al finalizar, deberías ver estas tablas en **Table Editor**:

- `profiles`
- `tenants`
- `products`
- `tenant_themes`
- `orders`
- `order_items`

Nota: el archivo [supabase/schema.sql](supabase/schema.sql) incluye la columna `products.image_url` (para fotos por producto). Si tu proyecto ya existía antes, vuelve a ejecutar `schema.sql` para aplicar el `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

### Nota sobre tienda pública

Las políticas en [supabase/rls.sql](rls.sql) permiten lectura pública (`anon`) para:

- `tenants`
- `tenant_themes`
- `products` (solo `active = true`)

Esto hace que `/store/:slug` pueda verse sin iniciar sesión.

## 4) Auth (para no trabarte en desarrollo)

Si en `/register` te aparece que se creó el usuario pero no te inicia sesión, casi siempre es porque Supabase tiene activada la confirmación por email.

Para desarrollo:

- En Supabase → **Authentication → Providers → Email** desactiva “**Confirm email**”.

Si lo dejas activado:

- Registra el usuario y **confirma el email** antes de poder entrar.

## 5) Primer uso recomendado (que coincida con esta app)

### Opción A (la más simple): crear un restaurante desde la app

1. Corre el proyecto:

```bash
npm install
npm run dev
```

2. Ve a `/register` y crea un restaurante.
   - Esto crea el usuario en `auth.users`.
   - Crea el tenant en `tenants`.
   - Actualiza tu `profiles.tenant_id` para que el RLS te deje crear productos/tema/pedidos.

### Opción B: crear un super_admin (para entrar a /admin)

1. Primero crea un usuario (por `/register` o en Supabase → **Authentication → Users**).
2. Copia su UUID (en Supabase → Authentication → Users).
3. En SQL Editor ejecuta:

```sql
update public.profiles
set role = 'super_admin'
where user_id = 'UUID_DEL_USUARIO';
```

4. Cierra sesión y vuelve a iniciar sesión: ahora te enviará a `/admin`.

## 6) Verificación rápida (para saber que quedó bien)

- Entra a `/dashboard`: si ves “No hay tenant asignado.”, tu `profiles.tenant_id` quedó en `null`.
  - Solución: registra el restaurante desde `/register` (opción A) o actualiza el perfil manualmente.
- Entra a `/store/<slug>`: debería cargar el tenant y mostrar productos activos.

## 7) Importante sobre “Pagar” (pedidos)

En modo Supabase, **crear pedidos requiere sesión** (por RLS):

- Si estás en `/store/:slug` sin login, puedes ver el menú.
- Para que el botón **Pagar** guarde el pedido en la DB, primero inicia sesión (tenant_admin o super_admin) en el mismo navegador.

Si quieres, dime qué pantalla/error te sale (por ejemplo el mensaje exacto del login/registro) y te guío con el caso exacto.
