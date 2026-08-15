# Guía de Setup — Supabase + Next.js

## 1. Crear proyecto en Supabase

1. Ir a https://supabase.com → "New project"
2. Nombre: `siembra-nativa`
3. Región: South America (São Paulo) → más cercano a Argentina
4. Contraseña de DB: generá una segura y guardala
5. Esperar ~2 minutos que se levante

---

## 2. Ejecutar el esquema SQL

En Supabase Dashboard → **SQL Editor** → "New query":

1. Pegar el contenido de `supabase/schema.sql` → Run
2. Pegar el contenido de `supabase/storage-policies.sql` → Run

Verificar que no haya errores en el panel de resultados.

---

## 3. Configurar el bucket de Storage

El script `storage-policies.sql` crea el bucket automáticamente.  
Para verificar: ir a **Storage** en el Dashboard → debe aparecer `certificados-reprocann` con el candado cerrado (privado).

---

## 4. Obtener las keys de tu proyecto

En Supabase Dashboard → **Settings → API**:

| Variable | Dónde encontrarla |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | "Project URL" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "anon public" |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role" (nunca exponer al cliente) |

---

## 5. Crear `.env.local`

En la raíz del proyecto:

```bash
cp .env.local.example .env.local
```

Completar con los valores del paso 4.

---

## 6. Instalar dependencias y correr el proyecto

```bash
# En la carpeta siembra-nativa/
npm install
npm run dev
```

Abrir http://localhost:3000

---

## 7. Crear tu primer admin

Después de registrarte con tu email en la app:

1. Ir a Supabase → **Table Editor → profiles**
2. Encontrar tu fila (buscá por email en auth.users)
3. Cambiar `rol` de `socio` a `admin`

O por SQL Editor:
```sql
UPDATE profiles SET rol = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'tu@email.com');
```

---

## 8. Configurar autenticación

En Supabase Dashboard → **Authentication → Settings**:

- **Site URL**: `http://localhost:3000` (development) / tu dominio en prod
- **Redirect URLs**: `http://localhost:3000/auth/callback`
- En producción agregar: `https://tu-dominio.com/auth/callback`

---

## 9. (Opcional) Cron job para REPROCANN vencidos

En Supabase → **Database → Extensions**, activar `pg_cron`.

Luego en SQL Editor:
```sql
SELECT cron.schedule(
  'marcar-reprocann-vencidos',
  '0 0 * * *',  -- Cada día a medianoche
  'SELECT marcar_reprocann_vencidos()'
);
```

---

## 10. Deploy en Vercel

```bash
npx vercel
```

En el dashboard de Vercel → **Settings → Environment Variables**, agregar:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` = `https://tu-dominio.vercel.app`

Actualizar en Supabase las URLs de redirect con el dominio de Vercel.

---

## Estructura de archivos clave

```
siembra-nativa/
├── supabase/
│   ├── schema.sql              ← Ejecutar primero
│   └── storage-policies.sql    ← Ejecutar segundo
├── lib/
│   ├── supabase/
│   │   ├── client.ts           ← Para componentes cliente
│   │   ├── server.ts           ← Para Server Components
│   │   └── middleware.ts       ← Para middleware.ts
│   ├── types/database.ts       ← Todos los tipos TypeScript
│   └── utils/index.ts          ← Helpers (cn, formatFecha, etc.)
├── middleware.ts                ← Auth + redirección por rol
├── app/
│   ├── page.tsx                ← Landing
│   ├── (auth)/login/           ← Login
│   ├── (auth)/registro/        ← Registro
│   ├── socio/                  ← Área de socio
│   └── admin/                  ← Área de admin
└── public/
    ├── fonts/                  ← Colocar Avigea.woff2 y CenturyGothic.woff2 acá
    └── images/
        ├── logo.png            ← Logo badge
        └── logo-text.png       ← Logo texto
```

---

## Fuentes personalizadas

Colocar los archivos de fuentes en `public/fonts/`:
- `Avigea.woff2` / `Avigea.woff`
- `CenturyGothic.woff2` / `CenturyGothic.woff`
- `CenturyGothic-Bold.woff2` / `CenturyGothic-Bold.woff`

Las fuentes están declaradas en `app/globals.css` con `@font-face`.  
Si no tenés los archivos, el sistema usa fallbacks (Georgia para Avigea, Trebuchet MS para Gothic).
