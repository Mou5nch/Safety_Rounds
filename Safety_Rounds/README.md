# Safety Rounds · versión 2.0

Aplicación web para la gestión de cuestionarios, inspecciones y desviaciones de un
departamento de **Safety & Health**. Funciona sin conexión, se instala en el móvil
como una app y no necesita servidor de aplicaciones ni base de datos.

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

Todo se guarda en el navegador del dispositivo, en **IndexedDB** (con reserva
automática a `localStorage` si el navegador la bloquea). Eso es lo que permite
trabajar sin cobertura, pero implica dos cosas importantes:

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

---

## 7. Estructura de archivos

```
safety-rounds/
├── index.html              Esqueleto de la aplicación
├── manifest.webmanifest    Metadatos de instalación (PWA)
├── sw.js                   Service worker: funcionamiento sin conexión
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
│   └── app.js              Navegación y arranque
├── vendor/
│   └── jspdf.umd.min.js    Generación de PDF (única dependencia externa)
└── icons/                  Iconos de la aplicación instalada
```

Sin `npm install`, sin proceso de compilación y sin llamadas a servicios externos:
lo único que se descarga de fuera es la tipografía Space Grotesk de Google Fonts, y
si no hay conexión el navegador usa la tipografía del sistema sin romper nada.

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
