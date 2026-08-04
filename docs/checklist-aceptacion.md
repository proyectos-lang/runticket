# RunTicket — Checklist de aceptación

Recorrido punto por punto de la especificación operativa, para verificar en
navegador qué funciona, qué está a medias y qué falta.

**Leyenda**

| Marca | Significado |
|---|---|
| ✅ | Construido y verificable en la interfaz |
| ⚠️ | Parcial: la base de datos y la lógica existen, falta la interfaz |
| ❌ | No construido |
| 🚫 | Excluido a petición del cliente |

---

## 0. Preparación

1. `npm run dev` → http://localhost:3000
2. Migraciones 0001–0015 aplicadas en Supabase, y `npm run db:seed` para el
   catálogo geográfico de Honduras.

**Cuentas de prueba**

Este archivo está en un repositorio público: **aquí no van correos ni contraseñas
reales**. Los rastreadores encuentran una credencial publicada en cuestión de
minutos, y estas cuentas apuntan a una base de datos con datos de verdad.

Crea las tuyas desde la consola de plataforma (`/admin/usuarios` → «Crear
usuario»), que las deja utilizables en el acto sin pasar por el correo, y guarda
las claves fuera del repositorio.

| Rol | Para qué sirve en este recorrido |
|---|---|
| Super-admin | Da de alta empresas y usuarios; ve la bitácora de todas |
| Admin de empresa | Configura la carrera, cobra y publica |
| Operador | Solo día de carrera: entrega de kits y asistencia |
| Corredores (dorsales 1–4) | Se inscriben, pagan y recogen kit |

> La cámara del check-in solo funciona en `localhost` o HTTPS. Desde el celular
> por IP de red el navegador la bloquea; usa la búsqueda por dorsal.

---

## Módulo 1 — Administración de la plataforma (super-admin)

| # | Requisito | Estado | Cómo verificarlo |
|---|---|---|---|
| 1.1 | Alta de empresas organizadoras | ✅ | `/admin/empresas` → formulario de alta |
| 1.2 | Suspensión y reactivación | ✅ | Detalle de empresa → *Suspender / Reactivar* |
| 1.3 | Nombre comercial, contacto, RTN, estado | ✅ | Campos del formulario |
| 1.4 | Logo de la empresa | ⚠️ | La columna `logo_url` existe y el logo se muestra en la landing pública, pero **no hay pantalla para subirlo** |
| 1.5 | Colores de marca | ⚠️ | Columna `colores_marca` (jsonb) sin interfaz ni aplicación al tema |
| 1.6 | Usuario admin inicial por invitación | ✅ | Detalle de empresa → *Invitar administrador*. Envía el correo de invitación de Supabase Auth |
| 1.7 | Gestión global de usuarios y roles | ⚠️ | Se invita a `admin_empresa`; no hay pantalla para listar/editar todos los usuarios ni para nombrar otro super-admin |
| 1.8 | Panel global consolidado (empresas activas, eventos, inscripciones, ingresos, crecimiento) | ❌ | Las métricas existen por evento, no consolidadas a nivel plataforma |
| 1.9 | Parámetros globales (comisión, términos, privacidad) | ⚠️ | Tabla `configuracion_plataforma` lista, sin interfaz |
| 1.10 | Bitácora de auditoría | ⚠️ | Tabla `bitacora_auditoria` con RLS append-only; **la aplicación todavía no escribe en ella** ni hay pantalla de consulta |
| 1.11 | Aislamiento estricto entre empresas (RLS) | ✅ | Verificado: ver §7 |

---

## Módulo 2 — Panel de la empresa organizadora

| # | Requisito | Estado | Cómo verificarlo |
|---|---|---|---|
| 2.1 | Crear y editar eventos | ✅ | `/panel/eventos` |
| 2.2 | Descripción con editor enriquecido | ⚠️ | Es un `textarea` de texto plano. El detalle público sí renderiza HTML si se guarda HTML |
| 2.3 | Fechas de inicio y límite de inscripción | ✅ | Formulario de evento |
| 2.4 | Ubicación: dirección | ✅ | Formulario de evento |
| 2.5 | Ubicación: coordenadas del mapa | ⚠️ | Las columnas `lat`/`lng` existen y el mapa las pinta, pero **no hay campo en el formulario** para fijarlas |
| 2.6 | Estados del evento (borrador→publicado→cerrado→finalizado→cancelado) | ✅ | Botones en el detalle del evento |
| 2.7 | Galería de imágenes con compresión | ❌ | Tabla `evento_imagenes` lista; sin pantalla de carga |
| 2.8 | Banner principal | ⚠️ | Columna `imagen_banner_url`, sin pantalla de carga |
| 2.9 | Mapa de ruta y punto de encuentro | ⚠️ | Se muestra en el detalle público (Leaflet + OpenStreetMap); falta la interfaz para capturarlos |
| 2.10 | Archivo GPX de la ruta | ⚠️ | El mapa dibuja el trazado si `ruta_gpx_url` tiene valor; sin pantalla de carga |
| 2.11 | Categorías con precio, cupo, rango de edad y hora de salida | ✅ | Detalle del evento → *Categorías* |
| 2.12 | Distancia por categoría | ✅ | Campo añadido; alimenta el filtro público |
| 2.13 | Tallas con inventario | ✅ | Detalle del evento → *Tallas* |
| 2.14 | Precios escalonados (early bird) | ⚠️ | Tabla `precios_escalonados` y el precio vigente ya se calcula y se cobra correctamente; **falta la pantalla para crearlos** |
| 2.15 | Consulta de inscritos con búsqueda y filtros | ✅ | *Inscritos*: filtros por categoría, talla, género y estado de pago |
| 2.16 | Marcar pagos recibidos manualmente | ✅ | `/panel/pagos` |
| 2.17 | Editar inscripción (cambiar categoría o talla) | ❌ | Sin interfaz |
| 2.18 | Anular inscripción | ⚠️ | RPC `anular_inscripcion` lista (devuelve la talla al inventario); sin botón |
| 2.19 | Inscripción manual en sitio | ❌ | Sin interfaz |

---

## Módulo 3 — Portal público e inscripción

### Portal público (sin sesión)

| # | Requisito | Estado | Cómo verificarlo |
|---|---|---|---|
| 3.1 | Home con próximos eventos de todas las empresas | ✅ | http://localhost:3000 |
| 3.2 | Buscador y filtros por ciudad, mes y distancia | ✅ | `/eventos` |
| 3.3 | Detalle: banner, galería, descripción, categorías con precio | ✅ | `/eventos/[slug]` |
| 3.4 | Cupos disponibles en tiempo real | ✅ | Se sirven con una función agregada; `inscripciones` nunca se expone a visitantes |
| 3.5 | Cuenta regresiva | ✅ | Detalle del evento |
| 3.6 | Mapa de la ruta | ✅ | Detalle del evento |
| 3.7 | Información del organizador | ✅ | Detalle del evento |
| 3.8 | URLs amigables por evento | ✅ | `/eventos/maraton-tgu-…` |
| 3.9 | Open Graph para compartir en WhatsApp/redes | ✅ | Ver código fuente: `og:title`, `og:image`, `twitter:card` |
| 3.10 | Agregar a calendario (Google, Outlook, `.ics`) | ✅ | Barra lateral del detalle |
| 3.11 | Landing por organizador | ✅ | `/organizadores/[slug]` |

### Registro del corredor

| # | Requisito | Estado |
|---|---|---|
| 3.12 | Nombres y apellidos por separado | ✅ |
| 3.13 | Correo y contraseña | ✅ |
| 3.14 | Inicio de sesión con Google | ❌ |
| 3.15 | Teléfono con código de país validado | ✅ |
| 3.16 | Fecha de nacimiento | ✅ |
| 3.17 | Sexo/género | ✅ |
| 3.18 | Documento de identidad | ✅ |
| 3.19 | País, departamento y ciudad (selects encadenados, Honduras precargada) | ✅ |
| 3.20 | Nacionalidad | ✅ |
| 3.21 | Talla predeterminada | ✅ |
| 3.22 | Tipo de sangre | ✅ |
| 3.23 | Contacto de emergencia (nombre, parentesco, teléfono) | ✅ |
| 3.24 | Ocupación | ✅ |
| 3.25 | Cómo se enteró | ✅ |
| 3.26 | Nivel de experiencia | ✅ |
| 3.27 | Aceptación de términos y consentimiento de datos | ✅ |
| 3.28 | Precarga en inscripciones posteriores | ✅ |

> Verificar en `/portal/perfil`. El perfil incompleto **bloquea la inscripción** y
> redirige aquí conservando el destino.

### Formulario de inscripción

| # | Requisito | Estado | Cómo verificarlo |
|---|---|---|---|
| 3.29 | Selección de categoría validando edad | ✅ | Categorías fuera de rango salen deshabilitadas con el motivo |
| 3.30 | Talla validando inventario | ✅ | Las tallas agotadas no aparecen |
| 3.31 | Datos precargados del perfil | ✅ | Bloque *Tus datos* |
| 3.32 | Campos adicionales del organizador | ⚠️ | Hay club, equipo y alergias, pero son **fijos**; el organizador no puede definir los suyos |
| 3.33 | Declaración de salud versionable | ✅ | Se guarda qué versión firmó cada inscrito |
| 3.34 | Firma digital en pantalla | ✅ | Canvas táctil |
| 3.35 | Registro de fecha, hora, IP y dispositivo | ✅ | Tabla `inscripcion_firmas` |
| 3.36 | PDF de la declaración firmada en Storage | ✅ | Descargable por corredor y organizador |
| 3.37 | Resumen con desglose de precio | ✅ | Paso 4 del formulario |
| 3.38 | Control de cupos en tiempo real | ✅ | Transacción con bloqueo por categoría |
| 3.39 | Oferta de lista de espera al agotarse | ⚠️ | Tabla y RPC de notificación listas; **sin interfaz** |
| 3.40 | Flujo de tutor para menores de edad | ✅ | Aparece automáticamente si el corredor es menor el día del evento |

### Portal del corredor

| # | Requisito | Estado |
|---|---|---|
| 3.41 | Historial de inscripciones (próximas y pasadas) | ✅ |
| 3.42 | Estado de pago de cada inscripción | ✅ |
| 3.43 | Descarga de comprobante de pago | ✅ |
| 3.44 | Descarga de la declaración firmada | ✅ |
| 3.45 | Dorsal con código QR | ✅ |
| 3.46 | Certificado de participación | ✅ |
| 3.47 | Edición del perfil | ✅ |

---

## Módulo 4 — Pagos

| # | Requisito | Estado | Cómo verificarlo |
|---|---|---|---|
| 4.1 | Redirección a WhatsApp con mensaje precargado | ✅ | Detalle de la inscripción → *Escribir al organizador* |
| 4.2 | Pasarela bancaria con patrón adaptador | 🚫 | Excluido a petición del cliente |
| 4.3 | Carga de comprobante de transferencia | ✅ | Imagen o PDF, máx. 5 MB |
| 4.4 | Aprobación/rechazo por el organizador | ✅ | `/panel/pagos` → *Por verificar* |
| 4.5 | Notificación automática al corredor | ⚠️ | El motivo del rechazo se ve en su pantalla; **no hay correo** |
| 4.6 | Estados: pendiente, en verificación, pagado, rechazado, reembolsado, anulado | ✅ | Todos implementados |
| 4.7 | Cada cambio de estado con fecha y responsable | ✅ | Tabla `pagos_historial`, append-only |
| 4.8 | Conciliación por evento, método y día | ✅ | `/panel/pagos` |
| 4.9 | Exportable | ✅ | *Exportar CSV* |
| 4.10 | Webhooks de la pasarela | 🚫 | Excluido junto con la pasarela |

---

## Módulo 5 — Gestión de carrera

| # | Requisito | Estado | Cómo verificarlo |
|---|---|---|---|
| 5.1 | Dorsal automático al confirmarse el pago | ✅ | Un trigger lo asigna venga el pago de donde venga |
| 5.2 | Numeración secuencial por evento | ✅ | Serializada con bloqueo: dos inscripciones simultáneas no colisionan |
| 5.3 | Numeración por categoría, configurable | ❌ | Solo secuencial por evento |
| 5.4 | QR único por inscripción | ✅ | 122 bits de entropía |
| 5.5 | Dorsal imprimible en PDF | ✅ | `/portal/inscripciones/[id]/dorsal.pdf` |
| 5.6 | Check-in escaneando QR con la cámara | ✅ | *Entrega de kits* |
| 5.7 | Muestra datos, talla y estado | ✅ | Ficha grande, pensada para usar de pie |
| 5.8 | Previene entregas duplicadas | ✅ | Avisa si el kit ya se entregó |
| 5.9 | Registra fecha, hora y operador | ✅ | Columnas `kit_entregado_*` |
| 5.10 | Alternativa por número de dorsal | ✅ | Añadido: la cámara falla o el corredor no trae el teléfono |
| 5.11 | Lista de espera al agotarse el cupo | ⚠️ | RPC lista (notifica al primero, ventana de 24 h); **sin interfaz** |
| 5.12 | Inventario de tallas en tiempo real | ⚠️ | La función `inventario_tallas` existe y las métricas muestran la demanda; falta la pantalla dedicada con alerta de agotamiento |
| 5.13 | Certificados en PDF | ✅ | Con tiempo y posiciones si hubo cronometraje |
| 5.14 | Generación masiva de certificados | ❌ | Solo individual, bajo demanda |
| 5.15 | Carga de resultados por CSV | ✅ | *Resultados*. Acepta `01:23:45`, `83:45` o segundos |
| 5.16 | Publicación de resultados | ✅ | Publicar / despublicar |
| 5.17 | Buscador público por nombre o dorsal | ✅ | `/eventos/[slug]/resultados` |
| 5.18 | Podio por categoría | ✅ | Misma página |
| 5.19 | Cálculo de posiciones | ✅ | General y por categoría, automático |

---

## Módulo 6 — Métricas y reportería

| # | Requisito | Estado |
|---|---|---|
| 6.1 | Total de inscritos y desglose | ✅ |
| 6.2 | Tasa de conversión de pago | ✅ |
| 6.3 | Distribución por rango de edad | ✅ |
| 6.4 | Por género | ✅ |
| 6.5 | Por ciudad/departamento | ✅ |
| 6.6 | Por nacionalidad | ❌ |
| 6.7 | Por nivel de experiencia | ✅ |
| 6.8 | Origen (cómo se enteró) | ✅ |
| 6.9 | Ocupación de cupos por categoría | ✅ |
| 6.10 | Demanda por talla | ✅ |
| 6.11 | Ingresos por evento, método y día | ✅ |
| 6.12 | Corredores recurrentes | ❌ |
| 6.13 | Exportación a Excel/CSV | ✅ |
| 6.14 | Acceso directo a la base para Power BI | ✅ |
| 6.15 | Filtro por rango de fechas | ⚠️ Filtra por evento, no por rango libre |

> `/panel/eventos/[id]/metricas`. Todos los gráficos llevan su **tabla
> equivalente** desplegable, y se validó el contraste en modo claro y oscuro.

---

## Notificaciones

| # | Requisito | Estado |
|---|---|---|
| 7.1 | Correos transaccionales | 🚫 Excluidos a petición del cliente |
| 7.2 | Plantillas por empresa | ⚠️ Tabla `plantillas_correo` lista, sin interfaz |
| 7.3 | Campana de notificaciones in-app | ⚠️ La tabla se escribe (lista de espera); falta la campana |

---

## Requisitos no funcionales

| # | Requisito | Estado | Nota |
|---|---|---|---|
| 8.1 | HTTPS en tránsito | ✅ | Al desplegar en Vercel |
| 8.2 | Cifrado en reposo | ✅ | Nativo de Supabase |
| 8.3 | RLS en todas las tablas | ✅ | Ver §7 de verificación |
| 8.4 | Validación en servidor con Zod | ✅ | Todas las Server Actions |
| 8.5 | Rate limiting en endpoints públicos | ❌ | **Pendiente** para registro e inscripción |
| 8.6 | Backup diario automático | ⚠️ | Requiere plan Pro de Supabase: acción del cliente |
| 8.7 | Renderizado estático/ISR para SEO | ⚠️ | Todo es dinámico hoy. Conviene pasar el detalle de evento a ISR |
| 8.8 | Imágenes optimizadas | ✅ | `next/image` |
| 8.9 | Responsive mobile-first | ✅ | Revisar en celular real |
| 8.10 | Interfaz en español | ✅ | |
| 8.11 | Textos centralizados para un 2.º idioma | ❌ | Los textos están en los componentes |
| 8.12 | Zona horaria América/Tegucigalpa configurable | ✅ | Por empresa y por evento |
| 8.13 | Moneda HNL configurable por evento | ✅ | |
| 8.14 | `created_at`, `updated_at`, `created_by` | ✅ | En todas las tablas |

---

## Funcionalidades adicionales recomendadas

Todas tienen su **tabla y reglas de seguridad creadas**; lo que falta es interfaz.

| # | Funcionalidad | Estado |
|---|---|---|
| 9.1 | Códigos de descuento y cupones | ⚠️ Tabla + función `validar_cupon`; sin interfaz |
| 9.2 | Inscripción por equipos o grupos | ⚠️ Tabla `grupos_inscripcion`; sin interfaz |
| 9.3 | Transferencia de inscripción | ⚠️ RPC `transferir_inscripcion`; sin interfaz |
| 9.4 | Patrocinadores por evento | ⚠️ Se muestran en el detalle público, el dorsal y el certificado; falta la pantalla de alta |
| 9.5 | Encuesta post-evento (NPS) | ⚠️ Tabla; sin interfaz |
| 9.6 | Programa de fidelidad e insignias | ⚠️ Tablas; sin interfaz |
| 9.7 | Verificación de edad para categorías infantiles | ✅ Flujo de tutor completo |
| 9.8 | Modo PWA instalable | ❌ |
| 9.9 | Política de reembolsos configurable | ⚠️ Tabla `eventos_politica_reembolso`; no se aplica automáticamente |
| 9.10 | Galería de fotos con búsqueda por dorsal | ⚠️ Tabla `fotos_evento` con índice por dorsal; sin interfaz |
| 9.11 | Landing por organizador | ✅ |
| 9.12 | Exportación para cronometraje | ⚠️ Vista `vista_exportacion_cronometraje`; sin botón de descarga |

---

## Verificación de seguridad (hacerla explícitamente)

Estas pruebas confirman el aislamiento multiempresa, que es el requisito más
crítico de toda la especificación.

1. **Una empresa no ve datos de otra.** Crea una segunda empresa con su admin.
   Entra con ese admin: no debe ver los eventos, inscritos ni pagos de la primera.
2. **El operador no ve dinero.** Cambia el rol de un miembro a `operador` en
   `empresa_miembros`. Al entrar no debe aparecer el enlace *Pagos*; entrar a
   `/panel/pagos` a mano debe redirigir; la columna de pago desaparece del listado
   de inscritos; y `/panel/pagos/exportar.csv` debe responder 403.
3. **Un corredor no ve inscripciones de otro.** Con la sesión de `corredor1`,
   abre la URL de la inscripción de `corredor2`: debe dar *no encontrado*.
4. **El QR no se puede enumerar.** No existe consulta abierta por `codigo_qr`; se
   resuelve con una función que exige ser staff del evento.
5. **Un corredor no puede marcarse como pagado.** No tiene permiso de escritura
   sobre `pagos`; solo puede declarar método y subir comprobante.

---

## Cerrado tras la reescritura del panel

Las cinco brechas «bloqueantes» de la lista original ya no lo son:

| Antes bloqueante | Dónde está ahora |
|---|---|
| Subida de imágenes (2.7, 2.8, 1.4) | `/panel/eventos/[id]/imagenes` y logo en `/admin/empresas/[id]` |
| Coordenadas y GPX (2.5, 2.9, 2.10) | `/panel/eventos/[id]/ubicacion`, con mapa editable |
| Precios escalonados (2.14) | `/panel/eventos/[id]/precios`, con rechazo de tramos solapados |
| Patrocinadores (9.4) | `/panel/eventos/[id]/patrocinadores` |
| Anular inscripción (2.18) | Columna «Gestionar» en `/panel/eventos/[id]/inscritos` |

También quedaron resueltos: editar evento (2.1), editar categorías y tallas
(2.11, 2.13), editar inscripción (2.17), gestión de miembros y roles (1.7),
lista de espera (3.39, 5.11), inventario de tallas (5.12) y la campana de
notificaciones (7.3), ahora en `/portal/notificaciones`.

**Correcciones de fondo hechas por el camino**

- **Zona horaria**: las fechas se interpretaban en la zona del servidor (UTC en
  producción), así que la hora se guardaba desplazada seis horas y cada guardado
  la habría movido otra vez.
- **Borrado de eventos**: `inscripciones` cuelga con `on delete cascade`, así que
  un borrado se habría llevado las declaraciones de salud firmadas. Ahora hay
  guarda en la aplicación y trigger en la base de datos.
- **Lista de espera**: nada hacía cumplir la ventana de 24 h, y se notificaba a
  varias personas por el mismo cupo.
- **Buckets sin límites**: se crearon sin `file_size_limit` ni tipos permitidos.

## Cerrado en la reestructuración del panel

El panel de empresa pasó de «módulo dentro de evento» a **13 módulos de primer
nivel siempre visibles**, cada uno con selector de carrera y estado vacío
explicativo. Se cerraron además:

| Requisito | Dónde |
|---|---|
| Inscripción manual en sitio (2.19) | `/panel/eventos/[id]/inscribir` |
| Rate limiting (8.5) | Registro, login, recuperación, inscripción y cupones |
| Panel consolidado del super-admin (1.8) | `/admin` |
| Bitácora de auditoría (1.10) | Se escribe en pagos, anulaciones e inscripciones; se consulta en `/admin/auditoria` |
| Editor enriquecido (2.2) | Tiptap en los datos del evento |
| Cupones (9.1) | `/panel/cupones` + aplicación en la inscripción |
| Transferencia (9.3) | `/panel/eventos/[id]/transferir`, con firma del nuevo titular |
| Fotos por dorsal (9.10) | `/eventos/[slug]/fotos` |
| Exportación de cronometraje (9.12) | `cronometraje.csv` |
| Declaración de salud editable | `/panel/eventos/[id]/declaracion`, versionada |
| Control de asistencia | Nuevo, separado de la entrega de kits |

**Fallos de seguridad corregidos por el camino**

- **XSS activo**: la descripción del evento se pintaba como HTML sin sanear.
  Cualquier organizador podía ejecutar código en el navegador de los corredores.
- **Escalada de privilegios**: las acciones de resultados validaban la empresa de
  la cookie, no la dueña del evento.
- **Empresa activa no determinista**: sin `ORDER BY`, el rol efectivo cambiaba
  entre sesiones y hacía desaparecer módulos.
- **Transferencia sin declaración firmada**: el nuevo corredor quedaba sin deslinde.
- **Fotos enumerables**: la tabla exponía el mapa dorsal→fotos, cruzable con los
  resultados para identificar a cualquier participante.

## Resumen de brechas restantes

1. **Equipos** (9.2): la tabla existe y se puede mostrar como columna, pero el
   flujo público de inscripción en grupo necesita otra migración.
2. **Encuesta NPS** (9.5): sin correos la tasa de respuesta sería mínima.
3. **Insignias** (9.6): la tabla es global, sin `empresa_id` ni motor de concesión.
4. **Certificados masivos** (5.14): generar N PDF en una acción agota el tiempo de
   ejecución; se mantienen bajo demanda.
5. **ISR en páginas públicas** (8.7) para SEO y velocidad.
6. **PWA** (9.8).
7. **Carga masiva de fotos** desde el panel (el buscador público ya funciona).

**Acciones del cliente, no del código**

- Revisión legal del texto de la declaración de salud (`src/lib/declaraciones.ts`)
- Contratar plan Pro de Supabase para el backup diario
- Decidir el banco para la pasarela de pago
- Proveer proveedor de correo si se reactivan las notificaciones
