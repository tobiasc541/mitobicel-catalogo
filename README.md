# MITOBICEL · Catálogo mayorista con administrador

Sitio Next.js con **catálogo público sin contraseña**, imagen original de fábrica, WhatsApp y **administrador privado** para cambiar precios, promociones, medidas, visibilidad y textos. Base de datos Supabase con control de acceso mediante Row Level Security (RLS). Apto para Vercel.

## Qué ya trae

- Página pública en `/` que **no exige login** a ningún cliente.
- Imagen original `public/mitobicel-fabrica.png` como **única imagen fija** de la interfaz; sin fotos inventadas.
- Categorías: camiseta (32×40, 40×50, 45×60); arranque (15×20, 15×25, 20×30, 25×35, 30×40); residuos en rollito fondo estrella y paquete (45×60, 50×70); Folex (14×14, 14×28, 20×25); film adherente para cajones de frutas y verduras (medidas a consultar); film Munsmawa (45 cm × 350 m, caja de 9).
- 2 importes **por medida**: retirando en fábrica y con envío. El único importe precargado es **$46.725** para el film Munsmawa retirando por fábrica, tal como se indicó. Los demás quedan vacíos como "Consultar precio".
- Promociones semanales editables y control de productos visibles.
- Compra mínima 50 bultos (medio pallet), envíos desde 100 bultos, venta exclusivamente mayorista, visita a fábrica y consultas por WhatsApp `11 6219-0702`.
- Generador de **QR descargable en PNG** dentro de `/admin`: escribís el dominio estable y generás el QR permanente para tus tarjetas.
- Panel `/admin` con usuario+contraseña de Supabase Auth; solo los UUID incluidos en `admin_users` pueden modificar los datos.
- Actualización en tiempo real por Supabase Realtime y respaldo por consulta automática cada 15 segundos (pestaña visible), sin re-deploy de Vercel.
- El QR que imprimas debe dirigirse a la **URL estable de producción** (`https://TUDOMINIO/...`), NO a una preview `-git-...vercel.app` ni a una IP ni a un archivo PDF. El QR no contiene precios, y por eso permanece válido con cada cambio de datos.

## 1. Crear repositorio en GitHub

1. Abrí https://github.com/new, usuario propietario, nombre `mitobicel-catalogo`, seleccioná **Private** o **Public**.
2. Creá el repositorio **vacío** (sin README ni .gitignore generado por GitHub).
3. Descomprimí este ZIP y ejecutá estos comandos **desde la carpeta extraída** (con Git instalado):

```bash
git init
git add .
git commit -m "Catálogo mayorista Mitobicel con superadmin"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/mitobicel-catalogo.git
git push -u origin main
```

Si el enlace de GitHub requiere autenticación, usá el acceso de GitHub en el navegador o un método de autenticación de Git (no pongas contraseñas en comandos ni código).

## 2. Crear base de datos independiente

1. En https://supabase.com/dashboard creá **un proyecto nuevo** para este catálogo (no mezclar con otras aplicaciones). Seleccioná región cercana a Argentina cuando esté disponible. El plan que elijas puede tener costo; revisalo antes de confirmar.
2. En **SQL Editor**, pegá y ejecutá `supabase/schema.sql` una vez. Se crean las 4 tablas, todas las medidas y políticas de seguridad.
3. En **Authentication → Providers → Email**, desactivá los registros públicos (`Allow new users to sign up`) para que terceros no creen cuentas de administrador.
4. En **Authentication → Users → Add user**, creá tu usuario con **tu correo y una contraseña segura**. No pongas esa contraseña en GitHub ni en el archivo `.env`.
5. Desde SQL Editor, ejecutá (reemplazá únicamente el correo):

```sql
insert into public.admin_users (user_id)
select id from auth.users where lower(email) = lower('TU_EMAIL_REAL');
```

6. Confirmá que la consulta añadió `1 row`. No registres otros usuarios como administradores salvo que lo decidas expresamente.

## 3. Configurar Vercel

1. Abrí https://vercel.com/new, importá `mitobicel-catalogo` desde tu GitHub; framework **Next.js** y carpeta raíz `/`.
2. En el proyecto Supabase, buscá **Project URL** y **publishable key** (o **anon** legacy si fuese tu única opción). Usá únicamente la clave pública; NUNCA la `service_role`/secret.
3. En Vercel → Project Settings → Environment Variables agregá:

```text
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE
```

4. Aplicá a **Production** (y a Preview si querés) y **Redeploy** para incorporar las variables. No es necesario ninguna variable `SUPABASE_SERVICE_ROLE_KEY`.
5. Abrí el dominio estable de producción y verificá catálogo + WhatsApp. En `/admin`, iniciá sesión con el usuario de Supabase que creaste.
6. Probá cambiar un precio, presionar `Guardar medida` y revisar en otra pestaña pública que se refleje sin hacer un nuevo deploy.

## 4. QR permanente

Entrá a `/admin` y en el bloque **QR único para las tarjetas** escribí la URL de producción y descargá el PNG; luego usá el dominio propio que vayas a mantener (`https://catalogo.tudominio.com/`) o el dominio permanente que Vercel asigna a **Production**. Al cambiar precios, NO cambiás QR ni URL. Si cambiás el dominio en el futuro, puede dejar de funcionar el QR impreso; elegí el definitivo **antes de imprimir las tarjetas**.

## 5. Ejecutar localmente

```bash
npm install
cp .env.example .env.local
# Editá .env.local con URL y publishable key reales
npm run dev
```

Navegá a http://localhost:3000 y http://localhost:3000/admin.

## 6. Seguridad y mantenimiento

- Los precios públicos se leen sin login desde Supabase. Todas las **escrituras** se restringen en la **base de datos** a usuarios listados en `admin_users`; ocultar botones no es un mecanismo de seguridad.
- No hay registro público ni restablecimiento de contraseñas propio: se gestiona desde Supabase Auth. Verificá que esté desactivado el signup público.
- Los códigos SQL son para proyecto nuevo; no deben ejecutarse sobre otros esquemas de producción.
- Se recomienda activar 2FA en las cuentas de GitHub, Supabase y Vercel, y usar claves fuertes para administrador.
- El precio "con envío" solo es válido a partir del mínimo indicado de 100 bultos; importes vacíos aparecen como "Consultar precio".
- Si Vercel solicita actualizar paquetes por seguridad, actualizá Next.js y React a una versión parcheada y comprobá el build. Este proyecto usa Next.js `15.5.28` y React `19.2.9`, versiones de mantenimiento publicadas en octubre de 2026.

**Nota sobre validación:** si recibiste únicamente el ZIP, el repositorio GitHub, proyecto Supabase y despliegue Vercel deben ser creados/conectados siguiendo los pasos anteriores; la edición efectiva de datos no funciona hasta completar esa conexión.
