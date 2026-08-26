# Safety Rounds · versión 2.1

Aplicación web para la gestión de cuestionarios, inspecciones y desviaciones de un
departamento de **Safety & Health**. Funciona sin conexión y se instala en el móvil
como una app: las inspecciones se guardan en el dispositivo, igual que siempre.

Desde la versión 2.1 hay además un pequeño servidor Node + PostgreSQL (pensado
para Railway) que añade dos cosas que no se pueden hacer solo con el dispositivo:
**enlaces para compartir el informe de una visita** y un **panel de accesos** con
usuarios de prueba para ver quién entra y cuánto tiempo está conectado. Todo lo
demás —cuestionarios, visitas, desviaciones, plan de acción— sigue funcionando
exactamente igual y sigue viviendo en el dispositivo. Ver el punto 10.

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

---

## 6. Dónde se guardan los datos

Los cuestionarios, visitas, desviaciones y el plan de acción se guardan en el
navegador del dispositivo, en **IndexedDB** (con reserva automática a
`localStorage` si el navegador la bloquea). Eso es lo que permite trabajar sin
cobertura, pero implica dos cosas importantes:

1. **Los datos no se comparten entre dispositivos.** Cada móvil, tablet u ordenador
   tiene su propia base.
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

> Cuando se usa el servidor de Railway (punto 10), lo único que sale del
> dispositivo es lo que decides compartir: el informe puntual de una visita, al
> pulsar «Compartir enlace». Ese informe se guarda en PostgreSQL para que el
> enlace funcione desde cualquier sitio. El resto de datos de trabajo sigue
> siendo solo del dispositivo, igual que siempre.

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
| `DATABASE_URL` | La inyecta Railway al añadir PostgreSQL. | Sí (la pone Railway) |
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

### 10.5 Compartir una visita

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

### 10.6 Si no añades PostgreSQL

Importante: en cuanto despliegas con `package.json` (es decir, en cuanto
Railway pasa a ejecutar este servidor), la aplicación empieza a pedir inicio
de sesión, y eso necesita base de datos. Sin `DATABASE_URL` el servidor arranca
igualmente y sirve los archivos estáticos, pero nadie puede pasar de la
pantalla de login: añade el plugin PostgreSQL (10.1) antes de dar la URL a
nadie. Si lo que quieres es la aplicación de siempre sin ningún inicio de
sesión, despliega sin `package.json`/`server/` (opciones A-C del punto 1) en
vez de en este servidor.
