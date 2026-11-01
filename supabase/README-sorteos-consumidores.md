# MITOBICEL · Sorteos de compradores / consumidor final

## Separación total de vendedores

- **Vendedores:** `/sorteos` y `/admin/sorteos`, con códigos por compra y tablas `raffle_campaigns`, `raffle_entries`, etc. No se modifican.
- **Compradores:** `/sorteos/agradecimiento` y `/admin/sorteos/compradores`, inscripción directa desde el QR de cada producto, sin código de compra, y tablas `raffle_consumer_campaigns`, `raffle_consumer_entries`, `raffle_consumer_winners`.
- El superadministrador utiliza la misma cuenta, pero administra campañas independientes, fechas, premios, imágenes, videos, participantes, ganadores y entregas.
- Los compradores tienen una inscripción por DNI **por edición mensual**. Se solicitan nombre, apellido, DNI, teléfono y aceptación de las bases. El QR no es una prueba de compra.

## Activación obligatoria de base de datos

El push a GitHub / deploy de Vercel **no ejecuta cambios SQL en el proyecto Supabase de MITOBICEL**.
Entrá al SQL Editor de ese proyecto y ejecutá **el archivo entero**:

`supabase/sorteos_consumidores_independientes.sql`

No ejecutar en los proyectos conectados que pertenezcan a MESA o Pawwise.

1. Instalá el SQL del consumidor final en Supabase.
2. Abrí `/admin/sorteos/compradores`, creá una edición nueva, indicá período, horarios, premios reales y bases completas.
3. Guardá y publicá la edición. Podés subir las imágenes PNG de portada y del premio (depende del bucket `raffle-prizes` ya utilizado para sorteos de vendedores).
4. Descargá el QR PNG exclusivo para **consumidores** desde el panel. La URL dentro del QR debe ser `https://TU-DOMINIO/sorteos/agradecimiento`. El QR de vendedores apunta a `/sorteos`.
5. Si el QR **ya impreso** en un envase apunta a otra dirección, no cambia automáticamente; deberá actualizarse el destino si es un enlace redirigible bajo tu control, o reimprimirse el QR. Probar con un teléfono real antes de distribuir.
6. Inscribí un consumidor de prueba y verificá que aparezca únicamente en el panel de consumidores; no en el de vendedores. Repetir su DNI debe ser rechazado en la misma edición.
7. Tras las fechas de cierre y sorteo, elegí premio y seleccioná ganador; verificá los datos antes de la entrega y publicá resultados solo cuando corresponda.

## Comprobación SQL de instalación

```sql
select
 to_regclass('public.raffle_consumer_campaigns') is not null as campanas,
 to_regclass('public.raffle_consumer_entries') is not null as participantes,
 to_regclass('public.raffle_consumer_winners') is not null as ganadores,
 to_regprocedure('public.raffle_consumer_register(uuid,text,text,text,text,boolean)') is not null as registro,
 to_regprocedure('public.raffle_consumer_draw(uuid,text)') is not null as sorteo,
 to_regprocedure('public.raffle_consumer_public_winners(uuid)') is not null as resultados;
```

Todos deben devolver true.

## Seguridad y transparencia

- Un QR estático y una inscripción directa **no verifican la compra**; cualquier persona con el enlace puede inscribirse, incluso sin tener el producto. No afirmar que existe validación de compra.
- Una inscripción por DNI y período limita duplicados, pero no resuelve automatizaciones ni identidades falsas. Antes de escalar, colocar controles anti-bot y límites de API, además de políticas de privacidad y retención de datos.
- Si un sorteo está dirigido a consumidores, revisá requisitos regulatorios de sorteos promocionales, incluyendo la prohibición argentina de condicionar la participación a una compra (Decreto 274/2019, art. 14). Las bases deben reflejar la implementación real y evitar comunicaciones engañosas.
