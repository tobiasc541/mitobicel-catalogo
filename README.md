# MITOBICEL — Catálogo mayorista

Sitio completo de catálogo público y administración privada, construido con **Next.js 15, Supabase y CSS responsivo**. Preparado para Vercel, sin registro ni contraseña para visitantes.

## Funciones
- Portada pública en `/`: categorías, medidas, presentación y **dos precios por medida** (retiro en fábrica y con envío).
- Secciones mayoristas: pedidos desde **50 bultos**, envíos desde **100 bultos**, visitas a **Av. San Martín 249, Burzaco** y WhatsApp **11 6219 0702**.
- Ofertas semanales configurables; film Munsmawa 45 cm × 350 m, caja de 9 unidades, precio inicial de retiro **$46.725**.
- Panel privado en `/admin`: ingresar con email/contraseña, editar precios, títulos, subtítulos, cantidad de paquetes/bulto, bolsas/rollito, unidades/caja, medidas, promociones y visibilidad.
- Agregar nuevas medidas, descargar el **QR de la URL permanente**, actualizaciones automáticas desde Supabase.
- Imagen fija principal: subí tu imagen original a `public/mitobicel-fabrica.png`; temporalmente usa `public/fabrica.svg` si todavía no está. Logo: `public/logo-mitobicel.png`. Favicon: `app/icon.png` (incluimos `app/icon.svg` como fallback). Las imágenes de productos se suben desde `/admin`.

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

## Actualización de marca: subir tus PNG a GitHub
Abrí https://github.com/tobiasc541/mitobicel-catalogo y en la carpeta correspondiente usá **Add file → Upload files**. Estos son los nombres exactos:
- `public/mitobicel-fabrica.png`: imagen original grande del domicilio, horarios y WhatsApp. Reemplaza automáticamente el dibujo anterior.
- `public/logo-mitobicel.png`: logo para la barra superior. Se utiliza automáticamente al subirlo.
- `app/icon.png`: favicon cuadrado (256×256 recomendado). Dejá `app/icon.svg` como alternativa, o borralo luego de subir el favicon definitivo.

**No necesitas cambiar código** al subir estos nombres. GitHub publica el cambio automáticamente en Vercel.

## Imágenes de productos desde el superadministrador
Ya existe un botón **Elegir imagen** en cada categoría del panel privado. Permite cargar PNG, JPG o WebP de hasta 3 MB. La imagen se asocia con todas las medidas de esa categoría, y se muestra al lado del título en la web pública.

- Con una instalación **nueva** de Supabase ejecutá `supabase/schema.sql`.
- Si ya ejecutaste antes `schema.sql`, no lo repitas: ejecutá solamente `supabase/upgrade.sql` en SQL Editor para crear el bucket y añadir la columna de fotos sin borrar tus precios.
- Solo el superadmin autorizado en `admin_users` puede subir las imágenes.

## Acceso privado
La web pública ya no muestra ningún enlace a administrador. Para ingresar, visitá `https://TU_DOMINIO/admin` y accedé con email y contraseña de Supabase Auth. Ocultar ese enlace **no** reemplaza la autenticación, que sigue protegida por Supabase RLS.

## Promociones combinadas y video
Una vez instalado el esquema base, ejecutá **supabase/campaigns.sql** desde SQL Editor en el proyecto de MITOBICEL. Este paso crea las tablas `combo_promotions` y `site_settings` con RLS: el público solo puede leer, el admin autorizado puede editar.
En `/admin` aparecerá el editor de combos: elegí dos productos, cantidades en bultos, precio total de retiro, precio total con envío y activación. El formulario también acepta la URL de un video alojado en YouTube o Vimeo para el VSL de fábrica, y una frase de confianza. Solo indicá un número de clientes si podés respaldarlo. El enlace a Google Maps abre una búsqueda de la dirección declarada, no una ficha empresarial verificada.

**Importante:** si la web muestra `Invalid path specified in request URL`, revisar en Vercel los valores de `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. La URL debe ser el Project URL exacto de ese proyecto Supabase (no una URL del dashboard ni una API key en lugar de URL). Volver a desplegar tras cambiarlas. 


## MITOBICEL B2B v3: activación

- En el proyecto de MITOBICEL ejecutar en Supabase SQL Editor el archivo **supabase/mitobicel_b2b_v3.sql**. Es una migración aditiva, no borra precios ni administradores. No usar en otras bases.
- Admin: /admin. Iniciar sesión con el correo y la contraseña creados en Supabase Authentication > Users. No hay una contraseña hardcodeada en el código.
- Ofertas de uno o dos productos, cantidades y precio total/por unidad, precio anterior opcional y promoción activa.
- VSL editable desde admin: URL YouTube/Vimeo/MP4 o subir MP4 <= 45 MB, imagen portada, título y descripción.
- Foto de cada categoría editable por administrador en el bucket catalog-images. Los logos originales están en public.
- Prueba social: cargar cantidad de clientes y calificación solo si existe evidencia comprobable y marcar la casilla de verificación.
- Cada presentación dispone de Cotizar/Agregar; el carrito flotante arma un único mensaje de WhatsApp con todas las cantidades.
- En móvil 360–414 px las tablas cambian a fichas individuales. Validar en Chrome DevTools antes de imprimir el QR.
- Los porcentajes concretos de ahorro y las cifras de satisfacción no deben afirmarse sin medición real.


## Solución si aparece «Catálogo en modo demostración» con Supabase configurado
1. En Vercel → Settings → Environment Variables confirmá que `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` están en **Production**. La URL tiene que ser la Project URL (https://PROJECT_REF.supabase.co), sin `/rest/v1`, comillas ni espacios.
2. **IMPORTANTE:** al añadir o editar variables `NEXT_PUBLIC_` tenés que crear un nuevo despliegue Production (Deployments → último deployment → ⋯ → Redeploy); el estado final debe ser **Ready**. Las variables se insertan en el bundle del navegador durante la compilación.
3. Recargá la página publicada con Cmd+Shift+R. Si sigue en demo, la banda muestra cuál variable o formato es incorrecto; no muestra claves ni tokens.
4. Una vez que las variables son válidas, si la consulta falla, la web mostrará el error de la API. En ese caso revisá en Supabase `catalog_items` y las políticas RLS.
5. La contraseña del superadmin es la que configuraste en Supabase Authentication > Users, no está guardada en código.


## B2B Premium v4 (octubre 2026)

- Nuevo sistema tipográfico: Plus Jakarta Sans para titulares y texto, Playfair Display para promesas en cursiva, JetBrains Mono para especificaciones/precios, mediante Google Fonts.
- Barra de operación mayorista con Maps; el contador muestra únicamente un vencimiento de promoción **real** establecido desde el panel en el campo `promo_deadline`. Si no existe fecha, no fabrica escasez.
- El catálogo se divide en dos columnas independientes para que una tarjeta corta no deje un hueco bajo ella; en móvil pasa a una sola columna.
- El reproductor 16:9 conserva la carga por Superadmin y ahora incluye tres capítulos de información clicables; son explicaciones, no certificaciones ni garantías técnicas.
- La comparación directa con intermediarios usa diferencias comerciales descriptivas, sin inventar un ahorro porcentual o defectos de terceros.
- Sección de consultas WhatsApp y FAQ interactiva. Para testimonios auténticos, ingresá en admin los campos `review_1_text`, `review_1_city`, etc. y marcá la autorización. Sin testimonios reales, se muestran ejemplos rotulados como ejemplos, no reseñas falsas.
- Se conservan las condiciones mayoristas de 50 bultos mínimo y envío desde 100 bultos; confirmar disponibilidad por WhatsApp.
- **Supabase:** no hace falta ejecutar otro SQL si `site_settings` de B2B v3 ya existe; las claves adicionales se crean automáticamente cuando guardás la sección de Marketing en /admin.
- Se respetan Auth, las políticas RLS, `catalog_items`, `catalog_offers`, fotografías, video, precios, carrito y enlaces a WhatsApp.


## Videos de 400–500 MB y promociones con precios separados (2026-10-28)

Ejecutá en **Supabase SQL Editor** el archivo [`supabase/mitobicel_precios_video_v4.sql`](supabase/mitobicel_precios_video_v4.sql). Agrega cuatro columnas de precios por producto A/B, no elimina ofertas anteriores. En el superadmin, al seleccionar dos productos combinados se muestran precio de retiro y envío para **cada producto**, y se calculan los precios totales (cantidad × precio unitario) automáticamente.

El campo de bolsas de arranque ahora aparece como **Rollos/bulto** (el valor se almacena en la columna existente `packages`, para no perder cantidades ya cargadas). Bolsa camiseta sigue diciendo **Paquetes/bulto**.

La carga de MP4 ahora admite selección de archivos de hasta **500 MB** y usa **TUS reanudable** con fragmentos de 6 MB. **Supabase Free tiene límite máximo de 50 MB por archivo**; para 500 MB necesitás un proyecto Supabase Pro, fijar el límite global en Storage Settings y aumentar el límite de `factory-media` a 500 MB. El SQL tiene la sentencia correspondiente **comentada** para que no falle en Free. Para proyectos Free podés seguir pegando un link de YouTube o Vimeo, incluso para videos grandes.

El video se sube directamente del navegador a Supabase Storage (sin pasar por los servidores de Vercel). No refresques ni cierres el navegador durante una carga grande; el progreso aparece en el panel. Los videos grandes pueden consumir tráfico de salida, por lo que conviene publicar una versión comprimida para clientes móviles.

## Catálogo 2 · Catálogo completo para clientes mayoristas

La ruta pública **/catalogo-clientes** es la copia visual del catálogo de MITOBICEL: misma identidad, Hero, video de fábrica, promociones, búsqueda por medida, carrito con totales, WhatsApp y footer.

La dirección **/** permanece sin cambios; no modificar el QR ya impreso ni el contenido/precios de `public.catalog_items`. No se agregó ningún enlace a `/catalogo-clientes` en la página pública del QR ni se indexa en buscadores.

**Configuración:** ejecutar `supabase/catalogo_2.sql` en **el proyecto Supabase de MITOBICEL**. Crea la nueva tabla `public.catalog_full_items` con lectura pública solo de filas visibles y escrituras limitadas a miembros de `public.admin_users`. Copia una sola vez los registros iniciales del catálogo pequeño (incluidas fotos y precios), pero a partir de ese momento **las ediciones son independientes**. Es aditivo y repetible; `ON CONFLICT DO NOTHING` respeta filas ya cargadas.

**Administración:** entrar en **/admin/catalogo-2** con las mismas credenciales de `/admin`. El panel muestra **Catálogo 2** y permite crear líneas nuevas, agregar medidas, cambiar precios, presentación, unidades, imagen y visibilidad, ordenar filas y eliminar productos solo de ese catálogo. El panel original `/admin` ofrece una pestaña a la segunda gestión. El nuevo catálogo público no muestra el acceso administrador.

**PDF:** el catálogo completo todavía no se puede cargar hasta que el usuario proporcione el PDF. Después de recibirlo, extraer sus líneas y presentaciones, revisar aquellas con datos faltantes y cargarlas solo en `public.catalog_full_items`. No reemplazar `catalog_items` ni alterar el QR.

**Nota de privacidad:** la ruta para clientes se distribuye por enlace y no se anuncia en la página del QR, pero no es un espacio protegido por contraseña. Cualquier persona con el URL puede visualizarla; RLS protege exclusivamente la edición.

## Catálogo 2 - Provincias 26/10/2026 - 176 presentaciones

El Catálogo 1 / con QR no cambia. La lista completa está en **data/catalogo2.provincias.26-10.json** como fuente estática de respaldo. La página /catalogo-clientes muestra las 176 variantes aunque todavía no se haya creado la tabla Supabase. Cuando catalog_full_items contiene una fila con el mismo ID prov26-***, la versión editada desde admin prevalece.

Los precios de lista ARS iguales o mayores a 4.000 recibieron un descuento fijo de ARS 4.000 (**144** importes). Los **14** precios ARS por kilo, unidad o paquete suelto (inferiores a $4.000) se conservan exactamente como aparecen en el PDF, sin descuento. Los **18** precios en USD conservan su valor original, sin conversión ni descuento en pesos. source_original_price y source_page mantienen la referencia del PDF. price_list almacena el valor visible; price_pickup y price_delivery quedan vacíos porque el PDF no indica retiro o envío.

Para instalar en Supabase MITOBICEL: ejecutar **supabase/catalogo_2_setup_y_carga.sql** una sola vez en SQL Editor. Crea tabla y columnas y carga 176 artículos con ON CONFLICT DO NOTHING sin borrar ediciones previas ni tocar catalog_items. Alternativamente ejecutar supabase/catalogo_2.sql y luego presionar Importar productos faltantes a Supabase desde /admin/catalogo-2.

Las 176 variantes tienen precio de lista. El carrito calcula subtotales de lista ARS y USD por separado. El importe por kilo no equivale al precio final de la bobina, cuyo peso es aproximado. Se confirman retiro, envío y precio final por WhatsApp.

El proyecto Supabase MITOBICEL no figura entre los proyectos conectados a ChatGPT; hasta ejecutar el SQL o la importación desde el panel no hay garantía de que la base remota esté sincronizada.


### Corrección de unidades (30/10/2026)
- En el PDF original, página 66, bobina importada: ARS $2.870/kg (sin descuento). Página 67: bobina Brown: ARS $2.550/kg (sin descuento).
- En páginas 65 y 68, bultos de 10 kg: ARS $28.700 - $4.000 = ARS $24.700/bulto.
- En páginas 80-81, los carteles estallidos por paquete suelto de 10/20 unidades conservan su precio original. Los atados de 10 paquetes por bulto siguen con $4.000 descontados.
- En páginas 58 y 75, cinta confitera por unidad y paquete de bolsas de escombro también conservan el precio suelto original.
- `supabase/catalogo_2_correccion_precios_unidad_kg_sueltos.sql` corrige exclusivamente las 14 filas importadas antes como precio NULL y solo si no fueron modificadas; el superadmin incorpora el mismo ajuste con el botón de sincronización.
