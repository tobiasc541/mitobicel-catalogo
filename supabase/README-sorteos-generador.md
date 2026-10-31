# MITOBICEL · Generador de códigos para personal

## Qué cambia

- URL para el empleado: `/sorteos/personal`
- Cuenta de empleado con email y contraseña propia, separada del superadmin.
- En una edición publicada y abierta: tocar **Generar código de 4 números**.
- No se ingresa DNI al emitir. El participante carga sus propios datos al registrar el código.
- Códigos aleatorios guardados en Supabase, de un solo uso, con auditoría del usuario emisor.
- Límite: 30 por minuto y 300 por día por operador. Máximo 10.000 combinaciones distintas por edición.
- El administrador puede habilitar o revocar operadores desde `/admin/sorteos`.

## Instalación obligatoria en la base real de MITOBICEL

**La publicación de GitHub/Vercel no ejecuta SQL automáticamente.** Sin este paso la página mostrará el error PGRST202.

1. Ingresá al proyecto Supabase que usa MITOBICEL (el que está configurado como `NEXT_PUBLIC_SUPABASE_URL` en Vercel).
2. Abrí **SQL Editor**.
3. Ejecutá el archivo completo `supabase/sorteos_codigos_sin_dni_y_empleados.sql` (una única vez). Requiere las tablas de `sorteos_mensuales.sql`. Conserva registros anteriores.
4. En `/sorteos/personal`, el empleado crea una cuenta con **su propio correo y contraseña**. Si Auth no permite el registro, invitalo desde Supabase Authentication > Users. Confirmá su email.
5. El administrador entra a `/admin/sorteos`, sección **Acceso del empleado**, coloca su correo y pulsa **Habilitar empleado**.
6. El empleado entra con su propia cuenta y genera códigos sin DNI.

## Verificación en Supabase SQL Editor (no crea códigos ni modifica datos)

```sql
select
  to_regprocedure('public.raffle_issue_purchase_code(uuid)') is not null as emision_instalada,
  to_regprocedure('public.raffle_code_operator_authorized()') is not null as acceso_instalado,
  to_regprocedure('public.raffle_code_operator_manage(text,boolean)') is not null as gestion_instalada;
```

Todos deben devolver `true`. Después, probar con una edición abierta, un código real emitido por el empleado y una inscripción de prueba con ese código. El estado `used_at` debe cargarse y el segundo intento con el mismo código debe ser rechazado.

## Seguridad y cumplimiento

- No compartir una contraseña general entre vendedores: cada uno usa su cuenta, que puede revocarse.
- Evitar mostrar los códigos en redes; cuatro dígitos permiten solo 10.000 combinaciones y son adivinables. Considerar seis u ocho dígitos o validación adicional para campañas de gran alcance.
- El backend mantiene la participación gratuita heredada para facilitar un esquema conforme a normativa; **no publicar sorteos exclusivamente condicionados a compras** sin revisión legal. El Decreto 274/2019, art. 14, prohíbe condicionar la participación a la adquisición de bienes o servicios.
