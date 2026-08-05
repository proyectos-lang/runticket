# Plantillas de correo de RunTicket HN

Los tres correos de autenticación. Se editan **aquí**, no en el panel de Supabase:
`generar.mjs` contiene la estructura una sola vez y produce los `.html`. El panel
de Supabase guarda una copia, pero el original es este.

```bash
node supabase/plantillas/generar.mjs
```

| Archivo | Plantilla de Supabase | Asunto |
|---|---|---|
| `confirmacion.html` | **Confirm signup** | Confirma tu cuenta en RunTicket HN |
| `recuperacion.html` | **Reset password** | Recupera tu contraseña de RunTicket HN |
| `invitacion.html` | **Invite user** | Te invitaron a organizar carreras en RunTicket HN |

## Cómo se aplican

En el panel de Supabase, **Authentication → Emails**. Para cada una:

1. Abre la pestaña de la plantilla que toque.
2. Copia el asunto de la tabla de arriba en el campo **Subject heading**.
3. Pega el contenido del `.html` completo en el cuerpo, sustituyendo lo que haya.
4. Guarda.

Después, en **Authentication → URL Configuration**, comprueba que **Site URL**
apunta al dominio bueno. De ahí sale `{{ .SiteURL }}`, que es la base tanto del
enlace de confirmación como de la imagen del logotipo.

## Dos cosas que conviene saber antes de abrir inscripciones

**El remitente seguirá siendo «Supabase Auth».** El nombre y la dirección del
remitente solo se pueden cambiar configurando un SMTP propio; con el servicio
incluido no hay ajuste que valga. Por eso estas plantillas cuidan el **asunto** y
el **preencabezado** (el texto que acompaña al asunto en la bandeja): es lo único
que dice de quién viene el correo antes de abrirlo.

**El servicio incluido envía 2 correos por hora.** Es un límite del plan, no una
configuración. La propia documentación de Supabase dice que no está pensado para
producción y que no hay garantía de entrega. Con tres corredores registrándose en
la misma hora, el tercero no recibe nada. Cuando se abran inscripciones de verdad
hay que poner un SMTP propio (Resend, Postmark, SendGrid…), y de paso se arregla
lo del remitente.

## Por qué el enlace no usa `{{ .ConfirmationURL }}`

El enlace por defecto de Supabase termina en un intercambio que **depende de una
cookie del navegador donde se originó la acción**. Quien se registra en el
portátil y abre el correo en el móvil —lo más habitual— se encontraba con un
error. Estas plantillas usan `{{ .TokenHash }}`, que se verifica contra el
servidor y funciona desde cualquier dispositivo.

`src/app/auth/confirmar/route.ts` acepta las dos formas, así que los enlaces ya
enviados con el formato anterior siguen funcionando hasta que caduquen.

## El logotipo

`public/logo-correo.png`, 720×119, sin canal alfa (Outlook trata mal la
transparencia). Se sirve desde `{{ .SiteURL }}/logo-correo.png`.

Mientras el sitio no esté desplegado en un dominio público, la imagen no cargará
en ningún cliente de correo y se verá su texto alternativo, «RunTicket HN». La
franja naranja bajo la cabecera está justo para eso: que el correo siga
pareciendo de la marca aunque el cliente bloquee las imágenes, cosa que Gmail
hace por defecto con remitentes desconocidos.
