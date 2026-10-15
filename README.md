# Safety Rounds · versión 2.2

Aplicación web para la gestión de cuestionarios, inspecciones y desviaciones de un
departamento de **Safety & Health**. Funciona sin conexión y se instala en el móvil
como una app: las inspecciones se guardan en el dispositivo y, con una cuenta
iniciada, **se sincronizan con el servidor** para compartirlas con el resto del
equipo y con la **WebApp de campo** (`/campo/`, ver el punto 11).

Desde la versión 2.1 hay además un pequeño servidor Node + PostgreSQL (pensado
para Railway) que añade dos cosas que no se pueden hacer solo con el dispositivo:
**enlaces para compartir el informe de una visita** y un **panel de accesos** con
usuarios de prueba para ver quién entra y cuánto tiempo está conectado. Todo lo
demás —cuestionarios, visitas, desviaciones, plan de acción— sigue funcionando
exactamente igual. Desde la versión 2.2 esos datos, además de vivir en el
dispositivo, se sincronizan con el servidor: ver el punto 11. Ver el punto 10
para el servidor en sí.

---

## Novedades de la versión 2

**Tipologías propias.** Ya no hay solo cuatro listas fijas: puedes crear las que
necesites (Responsables de departamento, Equipos, Contratas, Turnos…), con su color,
y borrarlas cuando sobren. Las cuatro originales —gravedad, categoría de riesgo,
centros y áreas— siguen ahí marcadas **de sistema**: se amplían y se renombran, pero
no se eliminan, porque el dashboard y el bloque de desviación dependen de ellas.

**Módulo «Selección de tipología».** Un módulo nuevo en el constructor que muestra
cualquiera de tus listas dentro de un cuestionario. Admite selección múltiple,
buscador cuando la lista es larga y alta de elementos sobre la marcha desde la propia
visita.

**Subtipologías en cascada.** Una lista puede colgar de otra. Si *Instalación 1*
agrupa Logística y Taller e *Instalación 2* agrupa Almacén de Químicos y Muelle de
carga, al elegir la instalación el segundo desplegable solo ofrece sus zonas. Se
aplica también a Centro / Área en la cabecera de cada visita.

**Datos por elemento.** Cada elemento de una lista admite cargo, correo, teléfono y
notas. Si activas el envío automático en el módulo, al elegir a una persona su correo
se propone como destinatario del informe.

**Dimensiones de análisis.** Marca una tipología como dimensión de análisis y aparece
como filtro en el Dashboard y como columna en las exportaciones: podrás ver, por
ejemplo, cuántas desviaciones se detectan acompañado de cada responsable. Los filtros
del Dashboard también van encadenados: al elegir un centro, el desplegable de área
solo ofrece las suyas.

**Cifras en formato español.** Millares con punto, decimales con coma, y porcentajes
y unidades con espacio irrompible (`74 %`, `82 dB`). Los CSV siguen exportándose con
`;` y UTF-8 con BOM para que Excel en español los abra bien.

### Actualizar desde la versión 1

Sustituye los archivos por los de esta versión: **no hay que hacer nada más**. Al
abrir la aplicación, las listas de sistema se crean solas y los centros, áreas,
gravedades y categorías que ya tuvieras se enganchan a ellas. Las visitas, las
desviaciones y el plan de acción se conservan intactos. Lo mismo ocurre al restaurar
una copia de seguridad hecha con la versión 1.

Si tenías la aplicación instalada en el móvil, la primera vez que la abras con
conexión se actualizará sola.

---

## 1. Puesta en marcha

La aplicación es HTML, CSS y JavaScript estáticos. **No hay que compilar nada.**
Las opciones A, B y C sirven solo la aplicación clásica: cuestionarios, visitas,
desviaciones… todo en el dispositivo. Si además quieres **enlaces para compartir
informes** y el **panel de accesos**, salta directamente al punto 10 (Railway).

### Opción A — Netlify o Vercel (recomendado, gratis, 2 minutos)

1. Entra en [app.netlify.com/drop](https://app.netlify.com/drop).
2. Arrastra la carpeta `safety-rounds` completa sobre la ventana.
3. Listo: obtienes una URL `https://…netlify.app` que ya funciona.

En Vercel es equivalente desde *Add New → Project → Deploy without Git*.

### Opción B — Tu propio hosting

Sube el contenido de la carpeta a cualquier alojamiento web por FTP o panel de
control (Hostinger, IONOS, Plesk, cPanel, un IIS o un Apache interno…). No requiere
PHP, Node ni base de datos.

### Opción C — Servidor interno de la empresa

Copia la carpeta al directorio público de tu servidor web. Si quieres probarlo en
local antes:

```bash
npx serve safety-rounds -l 4173
```

> **Importante:** para que funcionen la instalación en el móvil y el modo sin
> conexión, la aplicación tiene que servirse por **HTTPS** (o desde `localhost`).
> Netlify y Vercel dan HTTPS automáticamente.

---

## 2. Instalación en el móvil o la tablet

- **Android / Chrome:** abre la URL → menú ⋮ → *Instalar aplicación*.
- **iPhone / iPad / Safari:** abre la URL → botón Compartir → *Añadir a pantalla de inicio*.

A partir de ahí se abre a pantalla completa, con su icono propio, y **funciona sin
cobertura**: las inspecciones se guardan en el dispositivo y siguen ahí al recuperar
la conexión.

---

## 3. Cómo se organiza la aplicación

| Apartado | Para qué sirve |
|---|---|
| **Dashboard** | Indicadores, evolución mensual, desglose por cuestionario y control del plan de acción, con filtros por periodo, cuestionario, centro, área, gravedad y categoría. |
| **Cuestionarios** | Las plantillas disponibles, agrupadas en carpetas. Desde aquí se lanza una nueva visita. |
| **Visitas realizadas** | El archivo de inspecciones. Consulta, edición posterior, descarga en PDF, envío por correo y borrado. |
| **Desviaciones** | Todas las no conformidades detectadas, con sus fotos, filtrables y con cierre/reapertura. |
| **Plan de acción** | Seguimiento de las acciones correctoras: responsable, fecha límite, estado y avisos de vencidas. |
| **Configuración cuestionarios** | El constructor de formularios (solo administración). |
| **Ajustes y datos** | Identidad y logotipo, tipologías, centros, áreas y copias de seguridad. |

---

## 4. El constructor de cuestionarios

Tres columnas: **módulos** a la izquierda, **formulario** en el centro, **propiedades**
a la derecha. Arrastra un módulo al formulario, o púlsalo para añadirlo al final.

**Módulos disponibles**

- *Respuestas*: Punto de inspección, **Selección de tipología**, Selector único, Multi selección, Lista desplegable
- *Datos*: Nombre y apellidos, Fecha, Descripción corta, Descripción larga, Valor numérico
- *Evidencias*: Realizar foto, Adjuntar archivo, Firmar con el dedo
- *Estructura*: Título, Subtítulo, Texto informativo, Separador

### Selección de tipología

Muestra una de tus listas dentro del cuestionario, en lugar de obligar al inspector a
escribir el mismo nombre una y otra vez. En sus propiedades eliges:

| Opción | Qué hace |
|---|---|
| **Lista de origen** | Qué tipología se ofrece. |
| **Mostrar la subtipología en cascada** | Al elegir un elemento, aparece un segundo desplegable con solo los que le pertenecen. |
| **Permitir seleccionar varios** | Para casos como «personas presentes en la ronda». No se combina con la cascada. |
| **Permitir crear elementos desde la visita** | El inspector puede dar de alta uno nuevo en campo, sin pasar por Ajustes. |
| **Añadir su correo a los destinatarios** | Al elegir a alguien con correo registrado, su dirección se propone al enviar el informe. |

El selector va plegado: cerrado ocupa una línea y muestra lo elegido, y se despliega
al pulsarlo. A partir de ocho elementos incorpora un buscador. En selección múltiple
el panel se mantiene abierto para poder marcar varios seguidos y el selector cerrado
resume «3 seleccionados» con los nombres debajo.

### En el móvil

La aplicación es responsiva y el selector está pensado para el dedo: cada opción mide
unos 58 px de alto, la lista se desplaza dentro de su propio panel sin mover la página
y las casillas de selección múltiple son cuadradas para distinguirlas de las redondas
de opción única. En pantallas estrechas la barra superior deja solo el título y la
acción principal; *Guardar borrador* y *Salir* pasan al final del formulario, y en el
constructor aparecen dos botones fijos abajo para abrir los módulos y las propiedades.

### El punto de inspección

Es el módulo clave: presenta **Correcto / No correcto / No aplica**. Al marcar
*No correcto* se despliega automáticamente el bloque de desviación con descripción,
gravedad, categoría de riesgo, fotografías y acción correctora. **Es lo que alimenta
el dashboard**: cada «No correcto» genera una desviación y, si tiene acción asignada,
una entrada en el plan de acción.

### Lógica condicional (IF)

Cualquier módulo puede mostrarse solo cuando se cumplan ciertas condiciones sobre
respuestas anteriores. En el panel de propiedades: *Añadir condición* → elige la
pregunta de origen, el operador (*es igual a*, *es distinto de*, *incluye*, *está
contestado*, *mayor que*…) y el valor. Se pueden encadenar varias condiciones con
lógica **Y** / **O**.

El cuestionario de ejemplo incluye un caso montado: si el estado de los EPIs es
*Deficiente*, aparecen un cuadro de texto y un campo de fotografía que en otro caso
permanecen ocultos.

---

## 5. Informes PDF y envío por correo

Cada visita finalizada genera su informe PDF con portada, ficha de datos, resumen de
conformidad, todas las respuestas, las desviaciones con sus fotos, el plan de acción
y las firmas. Se genera al momento desde **Visitas realizadas**, siempre a partir de
los datos guardados, de forma que refleja cualquier edición posterior.

**Envío por correo** — al no haber servidor, el envío se apoya en el dispositivo:

- En **móvil y tablet** se abre la hoja de compartir del sistema con el PDF ya
  adjunto: eliges Mail, Gmail, WhatsApp o lo que uses.
- En **escritorio** se descarga el PDF y se abre el correo ya redactado, con
  destinatarios y cuerpo rellenados, para que solo tengas que adjuntar el archivo.

Los destinatarios por defecto de cada cuestionario se configuran en el constructor,
en *Ajustes del cuestionario → Correos destinatarios*.

**El Dashboard también se puede descargar en PDF** — el botón **Descargar PDF**
de la cabecera genera un informe con todo lo que se ve en pantalla en ese
momento (respeta los filtros activos: periodo, cuestionario, centro, área,
gravedad, categoría…): los indicadores clave, la evolución mensual, el nivel
de conformidad, el desglose por cuestionario, los puntos que más fallan, la
tipología de las desviaciones y el control del plan de acción. Pensado para
poder adjuntarlo a un correo o guardarlo como reporte periódico, sin tener
que hacer capturas de pantalla.

---

## 6. Dónde se guardan los datos

Los cuestionarios, visitas, desviaciones y el plan de acción se guardan en el
navegador del dispositivo, en **IndexedDB** (con reserva automática a
`localStorage` si el navegador la bloquea). Eso es lo que permite trabajar sin
cobertura, pero implica dos cosas importantes:

1. **Los datos viven primero en el dispositivo.** Con una cuenta de administración,
   supervisor o inspector se sincronizan además con el servidor (punto 11), así que
   se comparten con el resto de dispositivos y con la WebApp de campo. Las cuentas
   de demostración no sincronizan: cada navegador conserva su copia.
2. **Conviene descargar copias de seguridad.** En *Ajustes y datos → Descargar copia*
   se genera un `.json` con absolutamente todo. Ese mismo archivo se restaura en otro
   equipo con *Restaurar copia*, en modo **Reemplazar** o **Fusionar**.

> Recomendación práctica: exportar una copia al final de cada semana y guardarla en
> la carpeta de red del departamento o en el Drive de la empresa.

Las fotografías se redimensionan y recomprimen a JPEG antes de guardarse (máximo
1400 px, calidad 72 %), de modo que una inspección con evidencias ocupa del orden de
cientos de kilobytes y no varios megas. El indicador del menú lateral muestra en todo
momento cuánto ocupan los datos de la aplicación.

Cada visita guarda además una copia de la plantilla tal y como estaba al realizarla.
Ocupa algo más, pero garantiza que **una inspección antigua nunca se rompe ni cambia
de sentido** aunque después edites o borres el cuestionario.

> Con una cuenta sincronizada (punto 11), las visitas, desviaciones, acciones,
> cuestionarios y tipologías se copian también en PostgreSQL. Los borradores en
> curso no: solo viajan cuando pulsas «Guardar borrador» o finalizas la visita.

---

## 7. Estructura de archivos

```
safety-rounds/
├── index.html              Esqueleto de la aplicación
├── login.html              Inicio de sesión
├── admin.html              Panel de accesos (usuarios ficticios y sesiones)
├── report.html             Visor del informe compartido (/r/<id>)
├── reset-password.html     Elegir contraseña nueva desde el enlace del correo
├── manifest.webmanifest    Metadatos de instalación (PWA)
├── sw.js                   Service worker: funcionamiento sin conexión
├── package.json            Dependencias del servidor (solo para Railway/Node)
├── railway.json            Configuración de build/deploy en Railway
├── .env.example            Variables de entorno de ejemplo
├── README.md
├── css/
│   └── app.css             Sistema de diseño completo
├── js/
│   ├── icons.js            Set de iconos
│   ├── store.js            Capa de datos (IndexedDB + respaldo)
│   ├── ui.js               Utilidades de interfaz: modales, avisos, formatos
│   ├── seed.js             Plantilla inicial y generador de datos de ejemplo
│   ├── builder.js          Constructor drag & drop y motor de lógica IF
│   ├── runner.js           Ejecución de visitas, fotos y firma táctil
│   ├── pdf.js              Maquetación del informe PDF
│   ├── dashboard.js        Indicadores y gráficos
│   ├── lists.js            Cuestionarios, visitas, desviaciones y acciones
│   ├── settings.js         Ajustes, tipologías y copias de seguridad
│   ├── share.js            Genera el enlace compartido de una visita
│   ├── auth.js             Sesión dentro de la aplicación (latido, cierre de sesión)
│   ├── login.js            Lógica de login.html
│   ├── admin.js            Lógica de admin.html
│   ├── report-viewer.js    Lógica de report.html
│   ├── reset-password.js   Lógica de reset-password.html
│   └── app.js              Navegación y arranque
├── vendor/
│   └── jspdf.umd.min.js    Generación de PDF (única dependencia externa)
├── icons/                  Iconos de la aplicación instalada
└── server/                 Servidor Node (enlaces compartidos y accesos)
    ├── index.js            Punto de entrada: estáticos + API
    ├── db.js               Conexión a PostgreSQL y esquema
    ├── auth.js             Sesiones, contraseñas y permisos
    ├── mail.js             Envío del correo de recuperación (SMTP)
    ├── seed.js             Administrador real + usuarios ficticios de prueba
    └── routes/
        ├── auth.js         Login, logout, latido de conexión, recuperación de contraseña
        ├── admin.js        Usuarios y sesiones para el panel de accesos
        └── share.js        Crear y leer enlaces compartidos
```

La aplicación en sí (`index.html`, `css/`, `js/`, `vendor/`, `icons/`) sigue sin
compilación ni dependencias: lo único externo es la tipografía Space Grotesk de
Google Fonts, y sin conexión el navegador usa la tipografía del sistema sin
romper nada. El servidor de `server/` es lo único que necesita `npm install`,
y solo hace falta si vas a desplegar en Railway (punto 10).

---

## 8. Primeros pasos recomendados

1. **Ajustes y datos** → pon el nombre de la empresa y sube el logotipo (saldrá en los PDF).
2. **Ajustes y datos** → rellena las tipologías de sistema: *niveles de gravedad*,
   *categorías de riesgo* y *centros*. Las **áreas** se añaden dentro de cada centro,
   así que crea primero los centros. También puedes crearlo todo sobre la marcha desde
   una visita.
3. **Ajustes y datos → Nueva tipología** → crea las tuyas. Por ejemplo *Responsables
   de departamento*, con el correo de cada persona y marcada como dimensión de
   análisis para poder filtrar por ella en el Dashboard.
4. **Configuración cuestionarios** → abre la plantilla de ejemplo para ver cómo están
   montadas la lógica IF y la selección de tipología, y después créate la tuya.
5. **Cuestionarios** → *Nueva visita* y a inspeccionar.

### Cómo montar una jerarquía

Para reproducir el caso «cada instalación tiene sus propias zonas»:

1. Crea la tipología madre (*Instalaciones*) y la hija (*Zonas*) como dos tipologías
   independientes.
2. Abre la madre con su botón de configuración y, en **Subtipología**, elige *Zonas*.
3. A partir de ese momento la tarjeta de *Instalaciones* muestra las zonas agrupadas
   por instalación, cada grupo con su propio campo para añadir.

*Centros e instalaciones → Áreas y zonas* ya viene enlazado de fábrica.

Si quieres ver el dashboard con datos antes de empezar de verdad, en *Ajustes y datos*
tienes **Cargar datos de ejemplo**: genera seis meses de inspecciones ficticias que
después puedes borrar con *Borrar visitas y desviaciones*.

---

## 9. Navegadores

Chrome, Edge, Safari y Firefox en sus versiones actuales, tanto en escritorio como en
móvil. La firma táctil, la cámara y la instalación como aplicación requieren un
navegador moderno y HTTPS.

---

## 10. Railway: enlaces compartidos y panel de accesos

Esta parte es opcional. Si solo quieres la aplicación de siempre, quédate en el
punto 1. Si además quieres que se pueda **compartir el enlace de una visita
realizada** y llevar un **registro de quién entra y cuánto tiempo está
conectado**, sigue estos pasos en tu proyecto de Railway.

### 10.1 Añadir PostgreSQL

1. En el proyecto de Railway, **New → Database → Add PostgreSQL**.
2. No hay que hacer nada más: Railway inyecta sola la variable `DATABASE_URL`
   en el servicio de la aplicación. Este servidor crea las tablas que necesita
   solo, al arrancar (no hay migraciones que ejecutar a mano).
3. Si el servicio de la aplicación ya estaba desplegado, Railway lo reinicia
   solo al detectar la nueva variable; si no, vuelve a desplegar.

### 10.2 Variables de entorno

En el servicio de la aplicación, pestaña **Variables**:

| Variable | Para qué sirve | Obligatoria |
|---|---|---|
| `DATABASE_URL` | Conexión a Postgres. Ver aviso justo debajo — es la causa más habitual de que el login no funcione. | Sí |
| `PGSSL` | Déjala sin definir (o en `false`): la URL interna de Railway entre servicios del mismo proyecto no usa SSL. Ponla a `true` solo si `DATABASE_URL` apunta a un Postgres externo (Supabase, RDS…) que sí lo exija. | No |
| `ADMIN_EMAIL` | Usuario (y correo) del administrador real. Por defecto `mou5nch@gmail.com`. | No |
| `ADMIN_PASSWORD` | Contraseña de ese administrador. Si no la defines, el servidor genera una al azar en el primer arranque **y la escribe una sola vez en los logs de Railway** (pestaña *Deployments → View logs*): apúntala ahí. | Recomendable |
| `SEED_USERS_PASSWORD` | Contraseña compartida por los usuarios ficticios de prueba (por defecto `Rondas2026!`). | No |
| `NODE_ENV` | Ponla a `production`; hace que la cookie de sesión exija HTTPS. | Recomendable |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Servidor de correo para enviar los enlaces de «Recuperar contraseña». Sin esto, esa opción no envía nada (ver 10.3). | Recomendable |
| `SMTP_SECURE` | Ponla a `true` solo si tu proveedor usa SSL directo (normalmente el puerto 465). Con el 587 habitual, déjala sin definir. | No |
| `MAIL_FROM` | Dirección que aparece como remitente. Si no la defines, se usa `SMTP_USER`. | No |

Con `package.json` y `railway.json` ya en el repositorio, Railway detecta que
ahora hay un servidor Node y pasa a ejecutar `npm install` + `npm start` en vez
de servir los archivos como sitio estático: no hace falta tocar nada más en la
configuración de build.

> ⚠️ **El fallo más habitual: `DATABASE_URL` con el valor de ejemplo.**
> Cuando Railway detecta variables en `.env.example`, las ofrece en una sección
> **"Suggested Variables"** con sus valores *literales* del archivo — no una
> conexión real. Si guardas `DATABASE_URL` tal cual (`postgres://usuario:contrasena@localhost…`),
> el login y todo lo demás fallan siempre, por mucho que reintentes.
> El valor correcto es una referencia al servicio de Postgres: haz clic en el
> campo de `DATABASE_URL`, bórralo y escribe `${{Postgres.DATABASE_URL}}`
> (al teclear `${{` Railway sugiere las variables de tus otros servicios;
> elige Postgres → `DATABASE_URL`). Guarda y espera al reinicio automático.
> Para comprobar que ha quedado bien sin bucear en los logs, abre
> `https://tu-app.up.railway.app/api/health` en el navegador: debe responder
> `{"db":"ok","users":N}`. Si da `{"db":"error","reason":"..."}`, ese mensaje
> dice exactamente qué falla.

**Configurar el correo con Gmail** (la vía más rápida, ya que `mou5nch@gmail.com`
es una cuenta de Gmail):

1. Activa la verificación en dos pasos en esa cuenta de Google, si no la tienes ya.
2. Ve a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
   y crea una «contraseña de aplicación» (no uses la contraseña normal de la cuenta).
3. En Railway, define:
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `587`
   - `SMTP_USER` = `mou5nch@gmail.com`
   - `SMTP_PASS` = la contraseña de aplicación de 16 caracteres que te dio Google

Cualquier otro proveedor (Resend, SendGrid, Mailgun, Amazon SES…) también vale:
solo hace falta su host, puerto y credenciales SMTP en las mismas variables.

### 10.3 Iniciar sesión

Al abrir la aplicación pedirá usuario y contraseña. Cuentas disponibles nada
más desplegar:

- **`mou5nch@gmail.com`** (o el valor de `ADMIN_EMAIL`) — administrador real,
  con acceso al panel de accesos. Contraseña: la que hayas puesto en
  `ADMIN_PASSWORD`, o la generada automáticamente (mira los logs).
- **`ana.garcia`**, **`carlos.ruiz`**, **`maria.lopez`** — usuarios ficticios
  de prueba, misma contraseña para los tres (`SEED_USERS_PASSWORD`, por
  defecto `Rondas2026!`). Sirven para ver cómo queda el registro de accesos
  sin comprometer una cuenta real.

Desde el panel de accesos (menú **Panel de accesos**, solo visible para el
administrador) se pueden crear más usuarios ficticios, restablecerles la
contraseña o borrar los que sobren.

**¿Y si alguien olvida la contraseña?** En `login.html` hay un enlace
*¿Has olvidado tu contraseña?*: se pide el usuario o correo y, si esa cuenta
tiene una dirección de correo asociada, se envía un enlace de un solo uso
(caduca en 1 hora) para elegir una contraseña nueva en `reset-password.html`.
Para que esto funcione hace falta tener configuradas las variables SMTP de
más arriba; si no lo están, la petición no da error (por seguridad, la
respuesta es la misma exista o no la cuenta) pero no se envía nada — el
servidor deja constancia en los logs de Railway.

El administrador real ya tiene correo por defecto (su propio usuario). Para
que un usuario ficticio también pueda recuperar su contraseña por este medio,
indícale un correo al crearlo desde el panel de accesos; si no tiene uno
asociado, la única vía es que el administrador se lo restablezca a mano
(botón ↻ junto a cada usuario en el panel), que genera una contraseña al azar
para copiarla y pasársela por un canal seguro. Como último recurso —por
ejemplo si el correo del administrador deja de funcionar—, cambiar
`ADMIN_PASSWORD` en Railway y volver a desplegar también recupera el acceso:
la contraseña se sincroniza sola en el arranque siguiente.

### 10.4 Cómo se sigue el acceso

Cada inicio de sesión abre una fila en el registro de sesiones con la hora de
entrada. Mientras la aplicación sigue abierta manda un latido cada minuto, así
que el panel sabe si alguien sigue conectado o si la pestaña se cerró sin
avisar (más de 3 minutos sin latido = desconectado). Al pulsar «Cerrar
sesión» se cierra al momento. El panel muestra, por usuario, el número de
sesiones, la última conexión y el tiempo total conectado.

### 10.5 Mapa de actividad por usuario

En el panel de accesos, cada usuario tiene un botón **Ver actividad** (icono
de pulso, junto a los de restablecer contraseña y eliminar). Muestra, para
esa cuenta, cuánto tiempo ha pasado en cada pantalla del menú (Dashboard,
Cuestionarios, Visitas realizadas, Desviaciones, Plan de acción,
Configuración, Ajustes) desde que empezó a usar la aplicación:

- Un **mapa de calor**: una tarjeta por pantalla, más intensa cuanto más
  tiempo se ha pasado en ella, con el tiempo total y el número de veces que
  se ha entrado.
- Una **lista ordenada** de más a menos tiempo, con el porcentaje que
  representa cada pantalla sobre el total.

El seguimiento es automático: la aplicación manda al servidor cuánto tiempo
ha estado abierta cada pantalla al cambiar de sección, al ocultar la pestaña
o al cerrarla (con `navigator.sendBeacon`, para que no se pierda el dato
aunque se cierre de golpe). Solo cuenta tiempo con la pestaña visible: en
segundo plano el contador se pausa. Los datos se guardan por usuario en
PostgreSQL (tabla `nav_events`) y no se pueden ver por pantalla individual
más allá de lo que ya vive en tu dispositivo (respuestas, fotos…): solo el
tiempo y el número de visitas a cada sección.

Como con el resto del seguimiento de acceso, solo hay datos desde que se
desplegó esta función: no hay manera de reconstruir la actividad anterior.

### 10.6 Compartir una visita

En **Visitas realizadas**, cualquier visita finalizada tiene un botón
**Compartir enlace** junto a los de PDF y correo. Al pulsarlo:

1. La aplicación arma una instantánea de la visita (respuestas, desviaciones,
   fotos, firmas…) con los nombres de tipología ya resueltos —quien abra el
   enlace no tiene tu IndexedDB, así que no puede resolverlos por su cuenta.
2. La sube al servidor, que le asigna un identificador corto y la guarda en
   PostgreSQL.
3. Aparece un enlace del tipo `https://tu-app.up.railway.app/r/AbCdEf1234`,
   listo para copiar o abrir.

Cualquiera con ese enlace ve el informe en una página de solo lectura, sin
necesidad de instalar la aplicación ni tener cuenta. El enlace no caduca por sí
solo; si quieres retirarlo, bórralo con una petición
`DELETE /api/share/<id>` (solo puede hacerlo quien lo creó, o un
administrador).

### 10.7 Si no añades PostgreSQL

Importante: en cuanto despliegas con `package.json` (es decir, en cuanto
Railway pasa a ejecutar este servidor), la aplicación empieza a pedir inicio
de sesión, y eso necesita base de datos. Sin `DATABASE_URL` el servidor arranca
igualmente y sirve los archivos estáticos, pero nadie puede pasar de la
pantalla de login: añade el plugin PostgreSQL (10.1) antes de dar la URL a
nadie. Si lo que quieres es la aplicación de siempre sin ningún inicio de
sesión, despliega sin `package.json`/`server/` (opciones A-C del punto 1) en
vez de en este servidor.

### 10.8 Registro de cuentas de demostración

En `login.html`, junto al formulario de acceso, hay un enlace **¿No tienes
cuenta? Regístrate**. Es un alta pública pensada para que cualquiera pueda
probar la aplicación sin que el administrador tenga que crearle una cuenta a
mano:

- Solo pide nombre, correo y contraseña (el propio correo hace de nombre de
  usuario, no hay que inventarse uno aparte). La contraseña la elige la
  persona que se registra; el único requisito es que tenga 8 caracteres o
  más.
- Toda cuenta creada por esta vía queda con el rol **`usuario`**, distinto de
  administrador, supervisor o inspector. En el panel de accesos aparece
  etiquetada como *Usuario (autorregistrado)* con una marca de color propia,
  para distinguirla a simple vista de las cuentas que ha dado de alta el
  administrador. Queda igualmente en la base de datos del administrador, con
  su propio registro de sesiones y tiempo conectado.
- **Solo la primera vez** que la cuenta entra en la aplicación **en cada
  dispositivo**, se le cargan los datos de ejemplo de
  [`demo-data.json`](demo-data.json) (cuestionarios, visitas, desviaciones y
  acciones ya resueltas, para que se vea la aplicación en uso desde el primer
  momento). Los accesos siguientes con esa misma cuenta en ese mismo
  navegador —incluido cerrar sesión y volver a entrar— no repiten esa carga
  ni borran lo que la persona haya ido creando o modificando: al ser una
  demo, se parte de un mismo punto de partida una sola vez, pero después la
  cuenta funciona con normalidad. Como todos los datos de trabajo viven en el
  dispositivo (ver punto 6) y no en el servidor, si la misma cuenta se abre
  en otro navegador o dispositivo, ahí también se le cargan los datos de
  ejemplo la primera vez: es justamente lo que hace que «cada acceso» tenga
  siempre algo que enseñar, en vez de depender de una marca de una sola vez
  que solo valdría para el navegador donde se registró.
  Aplica igual a las cuentas con rol `usuario` que cree el propio
  administrador desde el panel de accesos (opción «Usuario (demo)» del
  formulario), no solo a las autorregistradas.
- Si por lo que sea la primera carga falla (por ejemplo, sin conexión en ese
  instante), la propia cuenta tiene en **Ajustes y datos → Borrar datos** un
  botón **Restaurar datos de demostración** que vuelve a traer la copia sin
  tener que borrar ni volver a crear la cuenta. Solo aparece para cuentas con
  rol `usuario`.
- Como cualquier otra cuenta ficticia, el administrador puede restablecerle
  la contraseña o borrarla desde el panel de accesos si hace falta.

Para renovar el contenido de ejemplo (por ejemplo, para que las fechas de las
visitas no queden muy desfasadas) basta con generar una copia de seguridad
nueva desde **Ajustes y datos → Descargar copia** con una cuenta de prueba y
sustituir el archivo `demo-data.json` del repositorio por esa exportación.

---

## 11. WebApp de campo y sincronización (versión 2.2)

La **WebApp de campo** es la herramienta para el trabajo en planta: la misma
información que la APP principal, pero pensada para usarla de pie, con una mano y
sin cobertura. Se abre en **`/campo/`** (por ejemplo
`https://tu-app.up.railway.app/campo/`) con **el mismo usuario y contraseña** que la
APP principal, y se instala en el móvil o la tablet igual que ella
(*Añadir a pantalla de inicio*).

### 11.1 Qué incluye

| Pantalla | Para qué sirve |
|---|---|
| **Inicio** | Qué toca hoy, cifras de desviaciones abiertas y acciones vencidas, visitas sin terminar. |
| **Calendario** | Vista mensual y agenda con las rondas previstas (periodicidad de cada cuestionario, proyectada a todo el mes), las visitas realizadas y los vencimientos del plan de acción. |
| **Cuestionarios** | Empezar una visita, retomar borradores y consultar las realizadas (PDF, compartir, enviar por correo). No incluye la configuración de cuestionarios: esa sigue siendo de la APP principal. |
| **Desviaciones** | Listado filtrable y ficha completa: descripción, gravedad, categoría, fotos, estado y acción correctora. |
| **Acciones** | Plan de acción: pendientes, vencidas y cerradas, con cierre en un toque (pide confirmación). |

**Filtro de planta.** El botón de arriba («Planta») filtra calendario,
cuestionarios, desviaciones y acciones por centro de trabajo. Cada opción muestra
sus pendientes. Se recuerda en el dispositivo y, al empezar una visita, la deja ya
situada en esa planta. Las plantas son los *Centros e instalaciones* de la APP
principal.

**Tarjetas o lista.** Desviaciones, Acciones y los tres apartados de Cuestionarios
(*Nueva*, *Sin terminar* y *Realizadas*) se pueden ver en **tarjetas** o en **lista**
con el conmutador que hay junto al buscador. La elección se recuerda por apartado en
el dispositivo. En el móvil la lista son filas compactas con una franja del color de
la gravedad o del plazo; en tablet y pantallas anchas es una tabla con cabecera y
columnas (gravedad, planta, fecha, plazo, estado…). Las acciones rápidas (cerrar,
reabrir, seguir, descartar) están también en cada fila.

**Adaptación a móvil y tablet.** Navegación inferior en móvil y lateral en tablet
horizontal; objetivos táctiles de 48 px o más; tipografía de 16 px en los campos
(evita el zoom automático de iOS); ventanas que suben desde abajo; zonas seguras
de muesca y barra de inicio; selector de fechas, cámara y listas nativos del
sistema.

### 11.2 Cómo se sincroniza

Cada dispositivo trabaja contra su copia local —por eso funciona sin cobertura— y
se pone al día con el servidor cuando hay red: al abrir, al recuperar la conexión,
cada 30 segundos con la pantalla visible y 2,5 segundos después de cada cambio. El
icono de la nube de la barra superior (y el recuadro del menú lateral en la APP
principal) muestra el estado y cuántos cambios quedan por subir.

- **Conflictos.** Se resuelven campo a campo. Si un técnico cierra una desviación
  desde la tablet sin cobertura mientras el administrador cambia su gravedad desde
  el ordenador, al sincronizar se conservan las dos cosas. Solo si ambos modifican
  el mismo campo gana el último en subirlo.
- **Borradores.** El autoguardado se queda en el dispositivo; el borrador viaja
  solo si pulsas «Guardar borrador» (así puedes seguir en otro dispositivo) o al
  finalizar la visita.
- **Edición de desviaciones y acciones.** Lo que se cambia desde campo (descripción,
  gravedad, fotos, acción) se escribe también en la visita de origen, para que
  reabrir esa visita en la APP principal no lo revierta.
- **Códigos de visita.** Con sincronización cada cuenta numera sus visitas con sus
  iniciales (`V2026-CR-0007`), de modo que dos personas trabajando a la vez o sin
  cobertura no repiten referencia.
- **Sesión.** La sesión de campo caduca a las 24 horas sin actividad (la de la APP
  principal, a los 30 minutos). Si caduca con cambios sin subir, se pide la
  contraseña en la propia pantalla y **no se pierde nada**.
- **Permisos.** Administración y supervisor pueden modificar todo. El inspector
  realiza visitas y gestiona desviaciones y acciones, y puede dar de alta elementos
  de una lista desde la visita, pero no configura cuestionarios ni ajustes (el
  servidor lo impide). Las cuentas de demostración no sincronizan.

### 11.3 Primera vez en un dispositivo que ya tenía datos

Si el navegador ya tenía datos de la versión sin servidor (pruebas o demostración),
la primera sincronización **guarda una copia previa en el propio dispositivo**, lo
deja limpio y descarga lo que haya en el servidor. La copia se recupera desde
*Ajustes y datos → Sincronización → Datos anteriores a la sincronización*. Un
dispositivo nuevo, en cambio, sube lo poco que tenga.

### 11.4 Envío de informes por correo desde el servidor

Al finalizar una visita se ofrece **Enviar por correo** (con los destinatarios del
cuestionario ya rellenados) o, si el cuestionario tiene activado *Enviar el PDF
automáticamente al cerrar la visita*, se envía solo. El PDF se genera en el
dispositivo y lo envía el servidor; sin cobertura queda en cola y sale al volver.
Cada visita muestra si el envío está *Enviado*, *En cola* o *Fallido*, tanto en
campo como en la APP principal.

Hay dos proveedores y se elige solo según las variables definidas (Resend tiene
prioridad):

| Variable | Para qué sirve |
|---|---|
| `RESEND_API_KEY` | Clave de [Resend](https://resend.com). **Recomendado en Railway**, que bloquea el SMTP saliente en los planes Free/Hobby. |
| `MAIL_FROM` | Remitente: `informes@tudominio.com` o `Safety Rounds <informes@tudominio.com>`. Con Resend el dominio debe estar verificado en su panel. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Alternativa SMTP (ver 10.2). |

Sin ningún proveedor configurado, el botón sigue funcionando con la hoja de
compartir del móvil (o descarga del PDF + `mailto:` en escritorio), como antes.
Límites: 10 destinatarios por envío, PDF de hasta 12 MB y 40 envíos por hora y usuario.

### 11.4 bis Datos de demostración compartidos

Para tener algo que gestionar desde el primer momento, la WebApp de campo y la APP
principal pueden cargar **la misma demostración que ven las cuentas de demostración**
(`demo-data.json`: 4 cuestionarios, 4 plantas, visitas con desviaciones y fotos, y
plan de acción) en los datos compartidos:

- **Automática**: la primera vez que un administrador o supervisor entra con los
  datos compartidos en blanco (sin visitas, desviaciones ni acciones, y a lo sumo el
  cuestionario de bienvenida), se carga sola. No se repite si ya se cargó una vez
  (queda anotado en los ajustes compartidos) ni si ya hay datos propios.
- **A mano**: *Ajustes y datos → Datos y copias de seguridad → Cargar la demostración
  completa* (APP principal) o *Mi cuenta → Cargar la demostración* (campo).
  **Sustituye todos los datos compartidos**; la identidad del departamento (nombre,
  logotipo) no se toca.

Al cargarla, las fechas se reparten en las últimas semanas (la copia original es de
agosto y todo saldría vencido), de modo que hay desviaciones y acciones vencidas y
otras por vencer, y se activa la periodicidad en tres cuestionarios para que el
calendario tenga rondas previstas.

### 11.5 Instalar y desplegar

No hay nada nuevo que configurar salvo, si se quiere, el correo (11.4). Al
desplegar, el servidor crea las tablas `docs` y `email_log`. `/campo/` se sirve
desde el mismo servicio que la APP principal, así que comparte dominio, sesión y
HTTPS.

### 11.6 Archivos nuevos

```
campo/                      WebApp de campo
├── index.html              Estructura, navegación y carga de scripts
├── manifest.webmanifest    Instalación como app (ámbito /campo/)
├── sw.js                   Service worker propio (funciona sin conexión)
├── css/campo.css           Estilos adaptados a móvil y tablet
└── js/
    ├── core.js             Filtro de planta, hojas inferiores, visor de fotos
    ├── records.js          Edición de desviaciones/acciones (escribe también en la visita)
    ├── home.js · calendar.js · forms.js · deviations.js · actions.js
    └── shell.js            Navegación, cabecera, cuenta y arranque
js/sync.js                  Motor de sincronización (compartido con la APP principal)
js/mailer.js                Cola de envío de informes por correo
server/routes/sync.js       API de sincronización: /api/sync/push · pull · head
server/routes/email.js      API de correo: /api/email/report · status
tests/sync-api.test.mjs     Prueba de integración de la API (npm run test:api)
```

La WebApp de campo reutiliza el motor de visitas, la lógica condicional y el
generador de PDF de la APP principal (`js/runner.js`, `js/builder.js`,
`js/pdf.js`): una visita hecha en campo es idéntica a una hecha en el ordenador.

### 11.7 Pruebas

```bash
# servidor contra una base de datos de PRUEBA (no la de producción)
DATABASE_URL=postgres://localhost/safety_test PORT=3100 \
ADMIN_PASSWORD=admin-local node server/index.js

# en otra terminal
BASE_URL=http://localhost:3100 ADMIN_PASSWORD=admin-local npm run test:api
```

