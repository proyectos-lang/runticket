# RunTicket — Inventario completo de pantallas

**Para quién es este documento.** Para diseñar la interfaz visual de toda la aplicación.
Describe **lo que existe y funciona hoy**, pantalla por pantalla, con lo que ve cada rol.
No es una lista de deseos: cada bloque descrito está construido y tiene datos reales
detrás. Donde algo todavía no existe, se dice explícitamente.

**Qué se espera de vuelta.** Un diseño por pantalla que respete el sistema visual de la
§2 y la estructura de contenido de cada ficha. Al final del documento (§10) está el
formato en el que conviene devolver el resultado para poder implementarlo directamente.

---

## 1. El producto en una frase

RunTicket es una plataforma web **multi-empresa** para gestionar carreras y eventos
deportivos en Honduras. Un administrador de plataforma habilita empresas organizadoras;
cada empresa gestiona sus carreras de forma aislada; y el corredor dispone de un portal
público donde descubre carreras, se inscribe, paga, retira su kit y consulta sus tiempos.

**Móvil primero.** La mayoría de corredores se inscribe desde el teléfono, y el día de la
carrera el personal del organizador trabaja con el móvil en la mano, de pie y con prisa.
Escritorio importa sobre todo en el panel de la empresa (tablas largas, métricas, carga
de resultados).

### Los cuatro roles

| Rol | Dónde vive | Qué puede hacer |
|---|---|---|
| **Super-administrador** | `/admin` | Crear y suspender empresas organizadoras, gestionar usuarios y roles globales, ver métricas consolidadas de toda la plataforma y la bitácora de auditoría. **No gestiona carreras.** |
| **Administrador de empresa** | `/panel` | Todo lo de su empresa: crear y publicar carreras, categorías, precios, tallas, inscritos, pagos, métricas, resultados. |
| **Operador de empresa** | `/panel` (reducido) | Solo día de carrera: consultar inscritos, entregar kits, control de asistencia, cargar resultados. **No ve nada financiero ni analítico, ni puede crear o editar carreras.** |
| **Corredor** | `/portal` + web pública | Descubrir carreras, inscribirse, pagar, ver su dorsal con QR, retirar el kit, consultar tiempos y descargar certificados. |

Hay además una **web pública sin sesión** que cualquiera ve.

---

## 2. Sistema visual ya implementado

El rediseño está aplicado. Lo que viene aquí **no hay que reinventarlo**; el diseño nuevo
debe encajar en ello o proponer cambios explícitos.

### Tokens de color
```
--fondo        #07080A   fondo base de toda la aplicación
--superficie   #0E1116   tarjetas, campos, filas de lista
--superficie-2 #141821   superficie elevada, paneles de métrica
--linea        rgba(255,255,255,.08)   bordes por defecto
--linea-fuerte rgba(255,255,255,.12)   bordes de campo
--texto        #F3F4F6
--atenuado     rgba(243,244,246,.55)   descripciones
--mudo         rgba(243,244,246,.42)   etiquetas mono
--naranja      #FF6A1A   ACCIÓN principal y urgencia
--naranja-suave #FF8A45  texto naranja sobre fondo oscuro
--azul         #2F6BFF   datos y series de gráfico
--cian         #3AD9FF   métricas, tiempos, fechas
--tinta        #0B0500   texto sobre la placa naranja
```

**Tema oscuro único.** No hay modo claro.

**Regla de oro del color**: el naranja es **solo** para la acción principal y la urgencia.
Azul y cian **solo** para datos, tiempos, fechas y estados neutros. Nunca compiten en el
mismo bloque. **Máximo un botón naranja visible por pantalla** (hay un aviso en consola
que lo detecta en desarrollo).

Verde/ámbar/rojo están reservados a estados (pagado / pendiente / rechazado) y nunca se
usan como color de acción.

**Validado**: el azul `#2F6BFF` pasa contraste y separación para daltonismo sobre las tres
superficies. El cian `#3AD9FF` **no puede ser una segunda serie de gráfico** (su
luminosidad domina al azul); si hiciera falta, el escalón validado es `#0FA5C9`.

### Tipografía
- **Archivo** (Google Fonts) para todo: pesos 400/500/600/700/800/900.
- **JetBrains Mono** para fechas, precios, tiempos, dorsales, etiquetas en versalitas y
  cualquier dato tabular. **Esto es obligatorio, no decorativo.**
- Titular de display: peso 900, VERSALITAS, `letter-spacing: -.05em`, interlineado 0.95.
- Etiqueta mono: 11px, versalitas, `letter-spacing: .12em`, color mudo.

### Forma y espacio
- Radios: **botones 6px**, tarjetas 10–12px, chips y píldoras 999px, avatar 50%.
- **Sin sombras.** La jerarquía se hace con fondo (superficie sobre fondo) y borde.
- Separación entre hermanos con `gap`, nunca con márgenes por elemento.
- **Área táctil mínima 44px** en todos los botones y campos.
- Chip de filtro activo = **placa blanca sobre negro**, no naranja.
- Estado seleccionado (radio, fila elegida) = borde naranja + fondo `rgba(255,106,26,.06)`.

### Placeholders de imagen
Trama diagonal, nunca gris plano ni icono genérico:
```css
background: repeating-linear-gradient(135deg,#12151b 0 10px,#181c24 10px 20px);
/* cálida (running nocturno): #141018 / #1c1620 */
/* fría (ciclismo y mapas):   #101419 / #161b22 */
```
El texto interior describe qué va ahí: `foto: pelotón de salida`, `mapa de ruta`.

### Componentes que ya existen
`Boton` (primaria naranja / secundaria / fantasma / peligro), `BotonEnlace`, `Chip`,
`ChipEstado`, `Pildora`, `PildoraEnlace`, `Panel`, `Campo`, `Select`, `AreaTexto`,
`RadioFila`, `BarraPasos`, `TarjetaMetrica`, `EtiquetaMono`, `PlaceholderMedia`,
`PlacaLogo`, `TarjetaCarrera`, `FilaCarrera`, `HeroEvento`, `EstadoVacio`,
`CabeceraModulo`, `TarjetaModulo`, `AppShell`, `NavLateral`.

### Tres restricciones que no se pueden romper
1. **El QR va siempre en negro sobre placa blanca**, con zona de silencio. Un QR con
   módulos claros sobre fondo oscuro falla en buena parte de los lectores.
2. **Los logos de terceros** (patrocinadores, empresas) van sobre **placa clara**: un logo
   de tinta oscura con transparencia desaparece sobre el fondo del sistema.
3. **Los PDF generados** (dorsal, certificado, declaración firmada) son documentos claros
   para imprimir y quedan fuera del sistema oscuro. El lienzo de firma es blanco con trazo
   oscuro porque acaba dentro de un PDF.

---

## 3. Estructuras comunes

### 3.1 Cabecera pública (sin sesión)
Barra pegajosa arriba con desenfoque. Izquierda: wordmark `RUN` blanco + `TICKET` naranja,
peso 900. Derecha: enlace «Carreras», enlace «Entrar» y botón secundario «Crear cuenta».
Con sesión iniciada, los dos últimos se sustituyen por un botón secundario «Mi cuenta».

### 3.2 Pie público
Wordmark + «inscripciones para carreras y eventos deportivos», y a la derecha enlaces a
Carreras y Entrar. Todo en tono mudo.

### 3.3 Shell autenticado (las tres áreas privadas)
Se usa en `/admin`, `/panel` y `/portal`.

- **Escritorio**: barra lateral fija de 256px a la izquierda, con fondo `--fondo` y borde
  derecho. Arriba, la identidad (wordmark en portal y admin; nombre comercial de la
  empresa en el panel, con selector si el usuario pertenece a varias). Debajo, la
  navegación agrupada en secciones con título en mono versalitas. **El destino activo se
  marca con una barra naranja vertical de 2px a la izquierda y fondo `--superficie-2`**,
  no con una placa clara.
- Barra superior derecha con el correo del usuario y «Cerrar sesión».
- **Móvil**: la lateral se convierte en cajón; arriba una barra con botón de menú y la
  identidad. «Cerrar sesión» baja al pie.
- Contenido centrado con ancho máximo de 1024px.

### 3.4 Estado vacío (patrón repetido en todo el panel)
Caja de borde discontinuo, icono en placa `--superficie-2`, título, descripción de una o
dos líneas explicando **qué se podrá hacer aquí cuando haya datos**, y un botón naranja
con la acción que desbloquea el módulo. Se usa mucho: el panel se diseñó para que todos
los módulos sean visibles y comprensibles **aunque la empresa no tenga ni una carrera**.

---

## 4. Web pública (sin sesión) — la ve cualquiera

### 4.1 Portada — `/`
**Función:** captación. Un solo objetivo: llevar a la inscripción de la carrera destacada.

- **Héroe a sangre completa** sobre trama diagonal cerrada, con dos halos radiales
  (naranja arriba a la derecha, azul abajo a la izquierda) y una línea horizontal de
  «meta» en degradado naranja a media altura.
  - Píldora de estado: `● INSCRIPCIONES ABIERTAS`, borde y fondo naranja translúcido.
  - **Titular gigante** con el nombre de la carrera en display 900 versalitas; **el año va
    en naranja**.
  - Tira de datos mono con divisores verticales: `FECHA` (fecha + hora), `DISTANCIAS`
    (10 K · 21.1 km), `DESDE` (precio, en naranja).
  - Dos botones: «INSCRIBIRME AHORA» (naranja) y «Ver ruta y kit» (secundario). Al lado,
    contador de escasez en mono: `795 de 800 cupos disponibles`, con la cifra en naranja.
  - A la derecha, imagen de portada de la carrera (o placeholder cálido «foto: pelotón de
    salida»).
- **Sección «Próximas carreras»**: título display + fila de chips de filtro por disciplina
  (Todas / Ruta / Trail / Montaña / Ciclismo / Triatlón / Caminata) — solo se muestran las
  disciplinas que tienen carreras. Rejilla de 3 columnas de **tarjetas de carrera**.
- **Estado vacío:** si solo hay una carrera publicada, un recuadro de borde discontinuo lo
  dice; si no hay ninguna, «Todavía no hay carreras publicadas».

**Tarjeta de carrera** (se repite en portada, listado y página de organizador): imagen
16:9 arriba con chip de disciplina superpuesto y, si aplica, chip de estado; debajo fecha
en mono cian versalitas, nombre en display, dirección, chips de distancia, y pie con
`DESDE` + precio a la izquierda y nombre del organizador a la derecha.

### 4.2 Listado de carreras — `/eventos`
**Función:** catálogo. El usuario llega con una intención y necesita acotar y comparar.

- **Barra lateral de filtros** de 264px con borde derecho:
  - `FILTROS` en mono.
  - Campo de búsqueda por nombre.
  - **Disciplina**: casillas cuadradas con contador a la derecha en mono (`Ruta 68`).
  - **Distancia**: chips cuadrados 5K / 10K / 21K / 42K / +50K.
  - **Precio**: deslizador con el valor en el título (`PRECIO — HASTA L 800`). En el tope
    el filtro se quita.
  - **Mes** y **Departamento**: selectores. El de departamento solo aparece si hay
    carreras con departamento asignado.
  - `Limpiar filtros` como botón fantasma de ancho completo, solo si hay filtros activos.
- **Contenido**: título display (o el nombre de la disciplina filtrada) + subtítulo mono
  `1 resultado · 2 filtros activos`. A la derecha, `ORDEN` con píldoras Fecha / Precio, y
  conmutador de vista lista (`☰`) / rejilla (`▦`).
- **Fila de resultado** (vista lista): imagen 170px a la izquierda; bloque central con
  chip de disciplina, chip de urgencia si aplica, línea mono cian con fecha · hora ·
  ciudad, nombre en display 22px, descripción de 2 líneas y chips de distancia; columna
  derecha de 170px separada por borde con `DESDE`, precio en display 24px y botón.
- **Solo una fila lleva borde y botón naranja**: la primera con urgencia (plazo de
  inscripción a menos de 7 días, o carrera a menos de 10). Esa dice «Inscribirme»; el
  resto, «Ver detalle».
- **Estado vacío:** «No encontramos carreras con esos filtros».

### 4.3 Ficha de carrera — `/eventos/[slug]`
**Función:** convertir. Toda la información existe para justificar el precio.
Es la pantalla más cargada del producto.

- **Foto a sangre de 360px** con degradado inferior que la funde con el fondo. Si no hay
  foto, placeholder cálido.
- El contenido **solapa** la foto 36px hacia arriba.
- Chip de disciplina en azul; chip de estado si las inscripciones están cerradas.
- **Titular display** con el nombre completo de la carrera. Debajo, la dirección.
- **Tira de datos** en tarjeta con divisores: `FECHA` (fecha mono + hora), `DESNIVEL` (en
  cian, o «Llano»), `CUPOS` (libres o «Abiertos»).
- Línea «Organiza {empresa}» enlazada a su página.
- **Cuenta regresiva** en bloques: días / horas / minutos.
- **Selector de distancia** (`ELIGE TU DISTANCIA`): filas tipo radio, una por categoría.
  Cada fila: nombre + distancia en mono cian, línea de condiciones (`Salida 06:30 ·
  +1,420 m · Edad 18–40 años · 298 plazas libres`) y precio a la derecha. La seleccionada
  lleva borde naranja y su precio en naranja. Las agotadas se muestran deshabilitadas.
- **Barra de compra** con `TOTAL` y el monto recalculado a la izquierda y botón naranja
  «INSCRIBIRME» a la derecha. **En móvil es pegajosa abajo**; en escritorio queda fija
  bajo la lista.
- **Ruta y punto de encuentro**: mapa Leaflet con tiles oscuros de CARTO, marcador naranja
  para salida/meta, azul para el punto de encuentro, y la ruta GPX trazada en cian.
- **Descripción** del organizador (texto enriquecido).
- **Tu inscripción incluye**: lista numerada `01–04` con el número en naranja.
- **Dónde y cuándo recoger el kit**: puntos de entrega con nombre, dirección, chip de
  horario en cian y enlace «Abrir en mapas».
- **Tallas disponibles**: chips; las agotadas van tachadas.
- **Galería** de imágenes en rejilla.
- **Patrocinadores**: logos sobre **placa clara**.
- **Barra lateral pegajosa** (escritorio) con: fecha límite de inscripción, «Agregar a mi
  calendario» (Google, Outlook, `.ics`) y contacto del organizador.

### 4.4 Resultados públicos — `/eventos/[slug]/resultados`
Buscador por nombre o dorsal, **podio por categoría** (tres primeros destacados) y tabla
completa con posición, dorsal, corredor, categoría, sexo y tiempo oficial. Todo lo
numérico en mono. Si el organizador no ha publicado, estado vacío.

### 4.5 Fotos del evento — `/eventos/[slug]/fotos`
Buscador por número de dorsal y rejilla de fotos. Las fotos son privadas: solo se
devuelven las asociadas al dorsal buscado.

### 4.6 Página de organizador — `/organizadores/[slug]`
Logo de la empresa **sobre placa clara**, nombre comercial, datos de contacto, y dos
bloques de tarjetas de carrera: próximas y pasadas.

### 4.7 Descargas públicas
- `/eventos/[slug]/calendario.ics` — archivo de calendario.

---

## 5. Autenticación — `/(auth)`

Maquetación centrada, ancho máximo 384px, wordmark grande arriba centrado.

| Pantalla | Ruta | Contenido |
|---|---|---|
| **Entrar** | `/login` | Correo, contraseña, botón naranja «ENTRAR», enlaces a crear cuenta y recuperar contraseña. |
| **Crear cuenta** | `/registro` | Título «Crea tu cuenta» + línea «Podrás completar tu perfil de corredor al inscribirte a tu primera carrera». Campos: Nombres, Apellidos, Correo, Contraseña. Botón naranja «CREAR CUENTA». |
| **Recuperar contraseña** | `/recuperar-password` | Correo + botón. Mensaje de confirmación tras enviar. |
| **Nueva contraseña** | `/actualizar-password` | Contraseña nueva + confirmación. |

**Estados que hay que diseñar en todas:** error de credenciales (caja roja translúcida
sobre el formulario), botón en estado «Entrando…» deshabilitado, y límite de intentos
alcanzado.

---

## 6. Portal del corredor — `/portal`

**Función global:** retención. Es la única parte que da valor **entre** carreras.

Navegación lateral: Perfil e historial · Mis inscripciones · Certificados ·
Notificaciones · **Cuenta**: Perfil deportivo · Ajustes de cuenta.

### 6.1 Perfil e historial — `/portal` *(pantalla raíz)*
- **Cabecera de identidad**: avatar circular de 64px con **borde naranja de 2px** (sin
  foto, placeholder rayado con la palabra `FOTO`), nombre en 21px peso 800, línea mono
  versalitas `TEGUCIGALPA · DESDE 2026`, y **píldora de club** naranja translúcida. Si no
  hay club, la píldora desaparece sin dejar hueco. El avatar enlaza a editar perfil.
- **Tira de tres métricas** con divisores verticales, sobre borde superior e inferior:
  `14 CARRERAS` · `312 KM TOTALES` (en cian) · `1:47:22 MEJOR 21K` (la etiqueta nombra la
  distancia, es dinámica). **Todo el bloque desaparece si el corredor no ha corrido
  ninguna carrera** — tres guiones no motivan.
- **PRÓXIMAS**: filas con la fecha en bloque a la izquierda (día grande en naranja, mes en
  mono debajo), nombre de la carrera + categoría, línea mono de estado
  (`DORSAL #1284 · PAGADO`, con «PAGO PENDIENTE» en naranja y «EN LISTA DE ESPERA» en
  cian) y chevron. **Solo la más cercana lleva borde naranja.** Toca y va al kit si el
  pago está confirmado y hay dorsal; si no, a la ficha, donde se resuelve.
  - Sin próximas: fila fantasma de borde discontinuo `＋ Buscar mi próxima carrera`.
- **HISTORIAL Y TIEMPOS**: tarjeta por carrera con nombre + distancia a la izquierda y
  tiempo en mono a la derecha (**en cian solo si es su mejor marca de esa distancia**);
  línea meta mono con `NOV 2026 · Puesto 34/612` y, a la derecha, el ritmo `4:49 /km` o
  `▲ RÉCORD PERSONAL` en naranja; y **barra de percentil** de 5px con degradado
  azul→cian cuyo ancho representa lo bien que quedó. Se listan 5 y luego «Ver todas mis
  carreras».
  - Si el organizador no publicó resultados: tiempo `—:—:—` en tono apagado, meta
    «Resultados en revisión» y **sin barra de percentil**.
- **Estado vacío (0 carreras corridas)**: tarjeta centrada «Aún no tienes carreras» / «Tu
  primer tiempo aparecerá aquí» / botón naranja «EXPLORAR CARRERAS».
- **Pie**: dos botones fantasma de ancho completo, «Descargar certificados (PDF)» y
  «Ajustes de cuenta».

### 6.2 Mis inscripciones — `/portal/inscripciones`
Tres píldoras de pestaña con contador: **Próximas · Finalizadas · Canceladas**.
Fila por inscripción: fecha en bloque, nombre + categoría, línea mono con dorsal y
precio, y **badge de estado** a la derecha (`PAGADO` neutro · `PENDIENTE` naranja
translúcido · `LISTA DE ESPERA` cian · `CANCELADO` apagado). Las canceladas van al 60% de
opacidad **sin tachar el texto**.
Si el pago está pendiente, la fila crece con una línea inferior: «Falta coordinar el pago»
en naranja y un botón naranja compacto «Completar L 400.00».

### 6.3 Ficha de inscripción — `/portal/inscripciones/[id]`
- **Al recién inscribirse** (`?nueva=1`): bloque de confirmación con halo naranja radial,
  círculo naranja de 56px con un check, titular display «ESTÁS INSCRITO» y nota
  explicando que el organizador contactará para el pago.
- **Tarjeta de dorsal digital** (solo con dorsal asignado): fondo en degradado
  naranja→azul, borde naranja. Izquierda: etiqueta `DORSAL DIGITAL`, **número en 60px
  peso 900**, nombre de la carrera en naranja suave, línea mono con categoría y talla.
  Derecha: **QR de 130px en negro sobre placa blanca** con pie «ESCANEA PARA TU KIT».
- **Datos de la carrera**: nombre, fecha, dirección, y rejilla con Categoría, estado de
  Inscripción, Referencia (uuid en mono) y estado del Kit.
- **Cambio de talla**: selector + botón, solo mientras se pueda.
- **Retiro del kit**: puntos de entrega, contenido del kit numerado y aviso azul sobre
  autorizar a otra persona.
- **Documentos**: declaración de salud firmada (PDF) y dorsal con QR (PDF).
- **Bloque de pago**: importe grande, chip de estado, y las vías reales:
  - *Opción 1 · Coordinar por WhatsApp*: botón que abre WhatsApp del organizador con el
    mensaje ya escrito (referencia, evento, categoría, monto).
  - *Opción 2 · Subir comprobante de transferencia*: selector de archivo, campo de
    referencia y botón «Enviar comprobante».
  - Cuando está pagado: caja verde «El organizador confirmó tu pago. Tu plaza está
    asegurada».

### 6.4 Entrega de kit — `/portal/inscripciones/[id]/kit`
**Función:** logística del día previo. Se abre **en la tienda, con poca luz y con prisa**:
el código debe ser lo primero y lo más grande.

- Cabecera `‹ ENTREGA DE KIT`.
- Titular display en dos líneas: «RECOGE TU KIT Y DORSAL».
- **Tarjeta de código**: fondo en degradado naranja→azul, borde naranja. Etiqueta
  `CÓDIGO DE RETIRO`, **QR de 150px en negro sobre placa blanca** con zona de silencio,
  código legible `RT-2` en mono 20px peso 800, línea de apoyo «si el código no lee, di tu
  dorsal: 2», y línea mono con talla · categoría.
- **DÓNDE Y CUÁNDO**: tarjeta con mapa de 120px (placeholder frío), nombre del punto,
  dirección, chip de horario en cian y botón naranja de ancho completo «ABRIR EN MAPAS».
  Con varios puntos, **solo el primero lleva el botón naranja**.
- **TU KIT INCLUYE**: filas numeradas `01–04`, número en naranja.
- **Aviso azul** de delegación, con la frase «compartiendo este código» **accionable**:
  abre la hoja de compartir del sistema con el código y el punto de entrega.
- La pantalla **no se apaga** mientras el código está a la vista.
- **Estado «kit ya retirado»**: la tarjeta pierde el degradado, el QR baja al 35% de
  opacidad y aparece encima una píldora cian `RETIRADO · 20 AGO 14:32`. Los bloques de
  logística y delegación se ocultan.

### 6.5 Resultado de una carrera — `/portal/inscripciones/[id]/resultado`
**Función:** el premio. Es la pantalla que el corredor comparte; debe verse bien en captura.
- Foto de 200px con degradado inferior y botón de volver flotante.
- Nombre de la carrera en display, línea mono con fecha · categoría · dorsal.
- **Bloque de resultado**: tiempo oficial centrado en **mono 54px peso 900**; debajo, tres
  celdas con divisores: `PUESTO GENERAL 34/612` · `CATEGORÍA 4` · `RITMO 4:49 /km`.
- **Barra de percentil** con leyenda «Mejor que el 82 % de la 21K».
- Acciones: «DESCARGAR CERTIFICADO» (naranja), «Ver clasificación completa» (secundario),
  «Fotos del evento» (fantasma).
- **Estado sin resultados**: bloque centrado con `—:—:—` y la explicación de si están en
  revisión o el organizador aún no los cargó.

### 6.6 Certificados — `/portal/certificados`
Lista de carreras finalizadas. Cada fila: nombre + distancia, fecha en mono, y a la
derecha chip `PDF` con flecha de descarga en naranja. Si el certificado aún no existe, la
fila va al 60% con «Pendiente de publicación» **y sin enlace** — no se ofrece una descarga
que va a fallar.

### 6.7 Notificaciones — `/portal/notificaciones`
Lista de avisos con título, mensaje, fecha y enlace. Los no leídos se distinguen con
borde de acento. Contador de no leídos en la cabecera.

### 6.8 Perfil deportivo — `/portal/perfil`
Formulario largo agrupado en secciones con título:
- **Datos personales**: Nombres, Apellidos, Fecha de nacimiento, Sexo, Teléfono (con
  código de país), Documento de identidad, Nacionalidad.
- **Residencia**: País, Departamento, Ciudad (selectores encadenados con catálogo de
  Honduras).
- **Datos de carrera y seguridad**: Talla de prenda, Tipo de sangre, Nivel de experiencia.
- **Contacto de emergencia**: Nombre, Parentesco, Teléfono.
- **Otros datos**: Ocupación, ¿Cómo te enteraste de RunTicket?
- Botón naranja «GUARDAR PERFIL».

Los campos obligatorios llevan asterisco naranja. **Falta por diseñar** (no existe hoy):
foto de perfil, campo de club, y la categoría calculada de solo lectura en azul.

### 6.9 Ajustes de cuenta — `/portal/cuenta`
Listas de filas con divisores, agrupadas bajo encabezados mono:
- **CUENTA**: Correo electrónico (solo lectura), Teléfono, Contraseña, Idioma.
- **ACTIVIDAD**: Notificaciones (con contador), Mis inscripciones, Certificados.
- **DATOS PERSONALES**: Perfil deportivo + párrafo explicando el uso de los datos.
- Botón secundario de ancho completo «Cerrar sesión».

**No existe todavía** (y no se ha dibujado a propósito, para no prometer lo que no hay):
métodos de pago guardados, interruptores de preferencias de notificación, descarga de
datos y eliminación de cuenta.

### 6.10 Descargas del corredor
- `/portal/inscripciones/[id]/dorsal.pdf` — dorsal imprimible con QR.
- `/portal/inscripciones/[id]/certificado.pdf` — diploma de participación.

Ambos son **documentos claros para imprimir**, fuera del tema oscuro.

---

## 7. Flujo de inscripción — `/eventos/[slug]/inscripcion`

**El flujo crítico de conversión.** Tres pasos, un solo botón naranja por paso.

Cabecera: enlace «← VOLVER AL EVENTO», titular display «INSCRIPCIÓN» y nombre de la
carrera. Debajo, **barra de 3 segmentos**: completados y actual en naranja, pendientes en
línea fuerte; cada segmento con su número en mono y su nombre en versalitas.

- **Paso 1 · Tu carrera** — selector de categoría en filas tipo radio, idéntico al de la
  ficha: nombre + distancia en cian, plazas libres o motivo de no elegibilidad, precio a
  la derecha (en naranja el seleccionado). Las categorías fuera del rango de edad
  aparecen deshabilitadas con el motivo.
- **Paso 2 · Tus datos** — tarjeta con el nombre y correo ya cargados del perfil y enlace
  «Editar mis datos →» en cian; selector de talla con inventario disponible entre
  paréntesis; y campos opcionales Club, Equipo y Alergias.
- **Paso 3 · Firma** — texto completo de la declaración de salud en caja con scroll y su
  número de versión; si el corredor es menor, bloque ámbar con los datos del tutor;
  **lienzo de firma blanco** con trazo oscuro y enlace «Borrar»; casilla de aceptación; y
  **resumen** con campo de cupón + botón «Aplicar», y el total en display 24px.
- Pie de navegación: «← Atrás» fantasma a la izquierda y a la derecha «CONTINUAR» o, en el
  último paso, **«CONFIRMAR · L 300.00»** con el monto dentro del botón.
- **Estado de cupo agotado**: en vez del formulario, el bloque de lista de espera con su
  propio formulario.

---

## 8. Panel de la empresa organizadora — `/panel`

Navegación lateral en tres grupos. **El operador ve un subconjunto**: se le ocultan
Inventario, Lista de espera, Cupones, Fotos y todo el grupo «Análisis y administración».

```
Resumen · Carreras · Inscritos [· Inventario de prendas · Lista de espera · Cupones]
DÍA DE CARRERA
  Control de asistencia · Entrega de kits · Resultados [· Fotos]
ANÁLISIS Y ADMINISTRACIÓN            (solo administrador)
  Métricas · Pagos · Mi empresa
ESTA CARRERA                          (aparece al entrar en una carrera)
  Resumen · Datos · Ubicación y ruta · Imágenes · Categorías · Precios por fecha ·
  Tallas · Patrocinadores · Declaración de salud · Inscribir en mesa ·
  Transferir inscripción · Inscritos · Todos los eventos
```

### 8.1 Resumen — `/panel`
Cinco tarjetas de métrica (`PUBLICADAS`, `INSCRIPCIONES`, `RECAUDADO`,
`PAGOS POR VERIFICAR`, `CORREDORES`), tarjeta de la próxima carrera con medidor de
ocupación, gráfico de inscripciones por mes y tabla de carreras con más inscritos.
**Estado vacío:** «Empieza creando tu primera carrera», explicando que todos los módulos
ya están listos y solo necesitan una carrera sobre la que trabajar.

### 8.2 Carreras — `/panel/eventos`
Lista de carreras con nombre, fecha, chip de estado (Borrador / Publicado / Inscripciones
cerradas / Finalizado / Cancelado) y número de inscritos. Arriba, formulario de creación
rápida: Nombre del evento, Identificador de URL, Fecha y hora de inicio, Fecha límite de
inscripción, Moneda, Zona horaria.

### 8.3 Centro de mando de una carrera — `/panel/eventos/[id]`
Cabecera con nombre de la carrera, su URL pública, chip de estado y enlace «Ver página
pública».
- Cuatro cifras: `INSCRITOS`, `PRESENTES`, `KITS ENTREGADOS`, `EN LISTA DE ESPERA`.
- **Aviso ámbar de publicación**: si la carrera está en borrador y le falta algo, dice
  exactamente qué (categorías, portada, ubicación).
- Panel «Cuándo y dónde» con inicio, cierre de inscripciones y dirección.
- **Tres rejillas de tarjetas de módulo**, cada tarjeta con icono, título y una línea de
  detalle que **refleja el estado real** («Sin portada: se verá vacía al compartir»,
  «2 configuradas», «0 de 4 entregados»), en verde si está resuelto y ámbar si falta:
  - *Configuración de la carrera*: Datos · Imágenes · Ubicación y ruta · Categorías ·
    Precios por fecha · Tallas e inventario · Patrocinadores · Declaración de salud.
  - *Participantes y día de carrera*: Inscritos · Inscribir en mesa · Transferir
    inscripción · Control de asistencia · Entrega de kits · Lista de espera.
  - *Después de la carrera*: Resultados · Métricas · Pagos · Exportar para cronometraje.
- Pie con las transiciones de estado disponibles: «Publicar evento» (naranja),
  «Cerrar inscripciones», «Cancelar evento» (peligro).

### 8.4 Sub-pantallas de una carrera

| Pantalla | Ruta | Contenido |
|---|---|---|
| **Datos** | `…/editar` | Nombre, Slug, Descripción (**editor de texto enriquecido** con barra de negrita, cursiva, título, subtítulo, listas y cita), Fecha y hora, Fecha límite, Dirección, Moneda, Zona horaria. Al final, **«Zona peligrosa»** con el borrado del evento. |
| **Ubicación y ruta** | `…/ubicacion` | Campo de dirección; conmutador de píldoras «Colocando: Salida y meta / Punto de encuentro / Usar mi ubicación»; **mapa Leaflet oscuro** clicable con marcadores arrastrables; campos de latitud y longitud por marcador; y subida de archivo GPX. |
| **Imágenes** | `…/imagenes` | Subida de portada y galería con compresión automática en el navegador, reordenación y borrado. |
| **Categorías** | `…/categorias` | Formulario (Nombre, Distancia en km, Precio, Cupo máximo, Edad mínima, Edad máxima, Hora de salida) y lista de categorías con sus cupos ocupados. |
| **Precios por fecha** | `…/precios` | Tramos de precio escalonado (preventa, regular, último momento) por categoría, con fecha de inicio y fin. |
| **Tallas** | `…/tallas` | Alta de tallas con inventario, y **tabla de inventario** con comprometidas, disponibles y aviso en ámbar/rojo cuando una talla se está agotando. |
| **Patrocinadores** | `…/patrocinadores` | Alta de logo, nombre y URL. Los logos se muestran **sobre placa clara**. |
| **Declaración de salud** | `…/declaracion` | Editor del texto legal que firma cada corredor, con número de versión. |
| **Inscritos** | `…/inscritos` | Filtros (búsqueda, categoría, talla, género, estado de pago) y tabla: Dorsal · Corredor (nombre + correo) · Categoría · Talla · Género · Inscrito · Pago (chip + monto) · Kit · Gestionar. Botón «Exportar CSV». |
| **Inscribir en mesa** | `…/inscribir` | Alta presencial el día del evento: datos mínimos del corredor, categoría, talla y método de cobro. |
| **Transferir inscripción** | `…/transferir` | Ceder la plaza de un corredor a otra persona, con firma de la nueva declaración. |
| **Entrega de kits** | `…/checkin` | **Escáner de QR con la cámara** en recuadro cuadrado, búsqueda alternativa por número de dorsal, y **ficha grande del corredor** al leer: dorsal enorme, nombre, categoría, **talla en bloque destacado**, y botón de confirmación. Avisa si el kit ya se entregó (ámbar) o si la inscripción está anulada (rojo). |
| **Lista de espera** | `…/lista-espera` | Tabla con posición, corredor, categoría, cuándo se apuntó, estado y acciones (notificar / expirar). |
| **Resultados** | `…/resultados` | Carga de CSV del cronometraje y tabla: Pos. · Dorsal · Corredor · Categoría · Pos. cat. · Tiempo. Botón de publicar. |
| **Métricas** | `…/metricas` | Cuatro cifras (Inscritos, Conversión de pago, Recaudado, Kits entregados), **medidores de ocupación por categoría**, gráfico de área de inscripciones por día, y seis gráficos de barras: Rango de edad, Género, Demanda por talla, Nivel de experiencia, Cómo se enteraron, Ciudad de residencia. Cada gráfico tiene un `<details>` «Ver como tabla» para accesibilidad. |

### 8.5 Módulos de primer nivel (funcionan sin entrar en una carrera)
Todos comparten el patrón: **cabecera de módulo** (título + descripción larga explicando
para qué sirve) + **selector de carrera** + contenido. Y todos tienen estado vacío propio
cuando la empresa no tiene carreras.

| Módulo | Ruta | Contenido |
|---|---|---|
| **Inscritos** | `/panel/inscritos` | El padrón consolidado con selector de carrera. |
| **Inventario de prendas** | `/panel/inventario` | Cuántas camisetas se comprometieron por talla y cuántas quedan, con alerta al agotarse. |
| **Lista de espera** | `/panel/lista-espera` | La cola de todas las carreras. |
| **Cupones** | `/panel/cupones` | Alta de códigos (porcentaje o monto fijo, caducidad, tope de usos) y lista con chip de estado calculado: Activo / Aún no empieza / Caducado / Agotado / Desactivado. |
| **Control de asistencia** | `/panel/asistencia` | Escáner para registrar quién llegó de verdad a correr. Es distinto de la entrega del kit. |
| **Entrega de kits** | `/panel/checkin` | Escáner de kits sobre la carrera elegida. |
| **Resultados** | `/panel/resultados` | Carga de tiempos por carrera. |
| **Fotos** | `/panel/fotos` | Galería del evento con búsqueda por dorsal. |
| **Métricas** | `/panel/metricas` | Indicadores por carrera. |
| **Pagos** | `/panel/pagos` | Filtro por evento; **tres tarjetas de totales** (Recaudado en verde, En verificación en ámbar, Pendiente neutro); desglose por método y por día; lista de comprobantes subidos con vista previa y botones aprobar/rechazar; y tabla «Todos los pagos»: Fecha · Corredor · Evento · Método · Monto · Estado · Acciones. Botón «Exportar CSV». |
| **Mi empresa** | `/panel/configuracion` | Ficha con nombre comercial, chip de estado, página pública, RTN, correo y teléfono de contacto; y tabla de **Equipo**: Persona · Rol · Estado. Nota de que el operador solo entrega kits y consulta inscritos. |

---

## 9. Panel de plataforma (super-administrador) — `/admin`

Navegación: Resumen · Empresas · Usuarios · Bitácora.

| Pantalla | Ruta | Contenido |
|---|---|---|
| **Resumen** | `/admin` | Cuatro cifras consolidadas de **toda la plataforma**: Empresas activas, Eventos publicados, Inscripciones activas, Recaudado. Gráfico de inscripciones por mes y gráfico de barras horizontales «Empresas con más inscripciones». Pie con accesos a Gestionar empresas, Usuarios y Bitácora. |
| **Empresas** | `/admin/empresas` | Formulario de alta (Nombre comercial, Identificador de URL, Correo de contacto, Teléfono) y lista de empresas con chip de estado (Activa / Suspendida / En prueba). |
| **Ficha de empresa** | `/admin/empresas/[id]` | Bloques: **Identidad** (logo sobre placa clara, colores de marca primario y secundario), **Datos de la empresa** (nombre, slug, RTN, correo, teléfono, estado), **Invitar al equipo** (correo + rol) y tabla de **Equipo**: Persona · Rol · Estado · Acciones. |
| **Usuarios** | `/admin/usuarios` | Tabla global: Persona · Empresas a las que pertenece · Rol de plataforma · Alta. |
| **Bitácora** | `/admin/auditoria` | Registro inmutable de acciones sensibles. Fila de píldoras de filtro por tipo de acción (Todo · Inscripción creada · Inscripción anulada · Pago confirmado · Pago rechazado · Pago reembolsado · Pago anulado · Pago en verificación · Pago pendiente) y tabla: Cuándo · Quién · Acción · Empresa · Detalle. Estado vacío «Sin registros todavía». |

---

## 10. Qué necesito de vuelta

Para poder implementar el resultado directamente sobre el código, conviene que el diseño
venga acompañado de un texto con esta estructura **por pantalla**:

1. **Ruta** exacta (`/panel/eventos/[id]/inscritos`) y **rol** que la ve.
2. **Orden de bloques** de arriba abajo, con el nombre del bloque.
3. Por bloque: **medidas** (alturas, anchos de columna, separaciones), **tipografía**
   (peso, tamaño, tracking, si es mono o Archivo) y **color por token** (`--naranja`,
   `--atenuado`…), no en hex suelto.
4. **Estados** de cada bloque: vacío, cargando, error, y las variantes que dependan del
   dato (pagado / pendiente, con foto / sin foto, publicado / borrador).
5. Qué **componente existente** reutiliza (`Boton`, `Chip`, `RadioFila`…) y cuál es nuevo.
6. Comportamiento **responsive**: qué cambia por debajo de 1024px y de 720px.

Tres avisos para quien diseñe:

- **Respetar la regla de un solo botón naranja por pantalla.** Es la restricción que más
  fácil se rompe al diseñar pantalla por pantalla, porque en aislamiento cada acción
  parece la principal.
- **No inventar pantallas de funciones que no existen** (pasarela de pago con tarjetas
  guardadas, entrenamientos, chat). Si se proponen, marcarlas claramente como nuevas: hay
  que construir el backend antes.
- **El QR, los logos de terceros y los PDF** tienen restricciones técnicas descritas en la
  §2 que no son negociables por estética.
