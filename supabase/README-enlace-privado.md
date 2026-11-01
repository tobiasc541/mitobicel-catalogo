# MITOBICEL | Acceso por enlace privado y DNI para personal

Este sistema reemplaza el registro de empleados por correo, contraseña y habilitación individual.

## Instalación en Supabase (obligatoria una sola vez)

El proyecto GitHub **no puede ejecutar el SQL de Supabase** simplemente con un push.

1. Abrí el **Supabase de MITOBICEL**, el que está enlazado a la web (NO el de MESA ni Pawwise).
2. En **SQL Editor**, ejecutá íntegramente el archivo:
   `supabase/sorteos_enlace_privado_dni.sql`
3. La actualización requiere las tablas de `sorteos_mensuales.sql` y conserva las inscripciones anteriores. También incluye el RPC de cuatro números para el superadministrador.
4. Desde `/admin/sorteos`, buscá **Enlace privado de personal** y pulsá **Crear / renovar enlace privado**. Copiá el enlace completo; se mostrará solo al crearlo.
5. Enviá ese enlace solamente al empleado. La pantalla muestra **Ingresá tu DNI** y después el botón de generación de códigos.
6. Si filtraron o perdieron el enlace, pulsá **Crear / renovar** para revocar el anterior. El enlace nuevo dura 90 días. **Revocar enlace** bloquea la emisión.

## Seguridad

- El DNI **no es una contraseña ni verifica por sí solo la identidad del empleado**. Quien conozca el enlace puede ingresar cualquier DNI. Solo la clave larga e impredecible incluida en el fragmento `#clave=...` da acceso.
- El secreto se guarda en Supabase únicamente como huella SHA-256. Su valor en claro aparece una sola vez al crear el enlace.
- Los DNI declarados por empleados no se guardan en texto claro en la tabla de auditoría; se guardan como huellas derivadas del secreto del enlace.
- Se limita a **20 códigos por minuto, 300 códigos por 24 h por enlace**, y 12/minuto para cada DNI declarado.
- Solo existe **un enlace activo a la vez**, revocable y con caducidad a los 90 días.
- Los códigos de cuatro dígitos solo tienen 10.000 combinaciones por sorteo: no son secretos de autenticación robustos. La inscripción pública debe tener protecciones antiabuso y una revisión legal apropiada.

## Verificación (solo lectura)

Ejecutar después de instalar:

```sql
select
  to_regprocedure('public.raffle_staff_link_create()') is not null as crear_enlace,
  to_regprocedure('public.raffle_staff_link_revoke()') is not null as revocar_enlace,
  to_regprocedure('public.raffle_staff_issue_code(text,text)') is not null as emitir_codigo,
  to_regprocedure('public.raffle_issue_purchase_code(uuid)') is not null as emitir_admin;
```

Deberían aparecer los cuatro campos en `true`. Luego crear un enlace desde el admin, abrirlo en una ventana privada, ingresar un DNI de prueba y generar un código durante una edición publicada. Verificar que se registre en `raffle_codes`, sea canjeable una sola vez y que tras revocar el enlace no permita emitir nuevos códigos.

**Normativa:** el artículo 14 del Decreto 274/2019 prohíbe condicionar sorteos promocionales a la compra. Es necesario revisar las bases y una vía gratuita conforme al marco legal aplicable antes del lanzamiento real.
