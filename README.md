# MITOBICEL — Catálogo mayorista

Sitio completo de catálogo público y administración privada, construido con **Next.js 15, Supabase y CSS responsivo**. Preparado para Vercel, sin registro ni contraseña para visitantes.

## Funciones
- Portada pública en `/`: categorías, medidas, presentación y **dos precios por medida** (retiro en fábrica y con envío).
- Secciones mayoristas: pedidos desde **50 bultos**, envíos desde **100 bultos**, visitas a **Av. San Martín 249, Burzaco** y WhatsApp **11 6219 0702**.
- Ofertas semanales configurables; film Munsmawa 45 cm × 350 m, caja de 9 unidades, precio inicial de retiro **$46.725**.
- Panel privado en `/admin`: ingresar con email/contraseña, editar precios, títulos, subtítulos, cantidad de paquetes/bulto, bolsas/rollito, unidades/caja, medidas, promociones y visibilidad.
- Agregar nuevas medidas, descargar el **QR de la URL permanente**, actualizaciones automáticas desde Supabase.
- Única imagen fija de la interfaz: `public/fabrica.svg`, una recreación vectorial de la placa de fábrica provista. Para utilizar el PNG original exacto, sustituí ese archivo y la referencia correspondiente en `components/Store.tsx`.

## Configuración de Supabase (antes del lanzamiento)
1. Creá un **proyecto Supabase nuevo** e independiente de tus otras aplicaciones. No ejecutes este SQL en las bases existentes.
2. En SQL Editor, ejecutá el archivo `supabase/schema.sql`, que crea **admin_users** y **catalog_items**, activa RLS y carga las medidas iniciales.
3. En Authentication > Providers > Email, desactivá los registros públicos; en Authentication > Users, creá solamente el usuario administrador autorizado con email y contraseña segura.
4. En SQL Editor, ejecutá, reemplazando el correo por el tuyo real:

```sql
insert into public.admin_users(user_id)
select id from auth.users where lower(email)=lower('TU_CORREO_REAL');
```

5. La consulta debe insertar una fila. Asegurate de usar una contraseña fuerte. **Nunca la subas a GitHub.**

## Variables de Vercel
En Vercel > Project Settings > Environment Variables, agregá en Production:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_TU_CLAVE_PUBLICA
```

Usá únicamente la **publishable key**, nunca la clave service_role o secret en variables `NEXT_PUBLIC_`.

La carpeta raíz del proyecto Vercel debe ser **/** (raíz GitHub) y Framework **Next.js**.
Conectá el repo GitHub `tobiasc541/mitobicel-catalogo` y Vercel hará deployments automáticos en cada commit de main.

**Sin configurar Supabase**, el catálogo muestra datos de demostración, pero el admin no permite guardar precios. No imprimás tarjetas ni QR hasta que el sistema esté conectado y probado.

## Uso
- Visitantes: `/`, acceso libre, sin iniciar sesión.
- Administrador: `/admin`; email y contraseña de Supabase Auth autorizados en `admin_users`.
- Actualizar: editar una fila y pulsar **Guardar medida**; se reflejará en otras sesiones mediante Realtime y, como respaldo, consulta cada 15 segundos.
- QR: desde `/admin`, cargar la URL definitiva HTTPS (dominio propio o estable de Vercel) y descargar PNG. No utilizar URLs de preview; el código QR seguirá siendo válido aunque modifiques los precios.
- Medidas no publicadas: cada producto permite consultas por WhatsApp.

## Desarrollo local
```bash
npm install
cp .env.example .env.local
npm run dev
```

Visitar http://localhost:3000 y http://localhost:3000/admin.

## Seguridad
- RLS en ambas tablas: público lee únicamente el catálogo visible, no puede modificar nada.
- Solo usuarios autenticados con UUID en `admin_users` tienen permisos de escritura.
- El cliente nunca utiliza una clave secreta y el alta pública está desactivada.
