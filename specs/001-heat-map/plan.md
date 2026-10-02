# Plan de implementación — Spec 001: Mapa de calor de estudio

Este plan es la traducción técnica de `specs/001-heat-map/spec.md`. Cada sección indica qué
requisitos de la spec cubre. Nada se implementa aquí: es solo el plan.

## 1. Archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `heatmap.js` | Nuevo | Toda la lógica pura del mapa: validación de sesiones, ventana, intensidad, texto del detalle y navegación por teclado. Sin DOM, sin localStorage, sin reloj del sistema. Exporta sus funciones para que Node pueda cargarlas en los tests. |
| `heatmap.test.js` | Nuevo | Tests de `node --test` de todo lo que hay en `heatmap.js`. |
| `index.html` | Modificar | Añade la sección del mapa entre el formulario y el historial (D3). Carga `heatmap.js` antes de `app.js`. |
| `styles.css` | Modificar | Estilos de la rejilla, los seis estados de color, la línea de detalle, el aviso, la leyenda y el modo de alto contraste. |
| `app.js` | Modificar | Lee el almacenamiento, llama a las funciones puras de `heatmap.js` y pinta el resultado. Gestiona eventos de puntero, tacto y teclado. Refactor opcional de las métricas existentes (ver §7, decisión T7). |

Ninguna de las modificaciones toca la racha, la mejor racha, los recuentos semanales y mensuales ni
el comportamiento del formulario, tal como exige la sección *Alcance* de la spec.

## 2. Funciones puras de lógica

Todas viven en `heatmap.js`. Ninguna toca el DOM, ni el almacenamiento, ni llama a `new Date()` sin
argumentos, ni a `Date.now()`. Reciben la fecha actual por parámetro (`today` es siempre una cadena
`AAAA-MM-DD`), según el principio 3 de la constitución y RFN-3.

| Función | Firma resumida | Cubre |
|---|---|---|
| `toLocalDateKey(date)` | `Date` → `AAAA-MM-DD` | RFN-3, constitución 5 |
| `isValidDateKey(text)` | `any` → `booleano` | RF-22 |
| `isValidMinutes(value)` | `any` → `booleano` | RF-23 |
| `addDays(dateKey, n)` | → `AAAA-MM-DD` | RF-4, RF-5, casos límite de bisiesto y de cambio de hora |
| `weekdayIndex(dateKey)` | → `0..6` con lunes en 0 | RF-4 |
| `getWeekStartMonday(dateKey)` | → `AAAA-MM-DD` | RF-5, RF-2 |
| `getWindowBounds(today)` | → `{ startKey, endKey }` | RF-1, RF-5 |
| `getIntensityLevel(totalMinutes)` | → `0..5` | RF-8, RF-10, tabla de umbrales |
| `partitionSessions(sessions)` | → `{ valid, invalidTotal, invalidByReason }` | RF-19, RF-22, RF-23 |
| `buildHeatmap(sessions, today)` | → objeto con rejilla y celdas | RF-1 a RF-15, RF-28 |
| `formatCellDetail(cell)` | → `string` | RF-16, tabla de formatos |
| `getCellLabel(cell)` | → `string` (texto accesible) | RFN-6, RFN-8 |
| `moveFocusCell(index, key, shape)` | → `índice` o `null` | RF-29, RF-31 |

La rejilla siempre tiene la misma forma: 27 columnas × 7 filas = 189 celdas, de la más antigua a la
más reciente. `shape` es `{ columns: 27, rows: 7 }`.

`getCellLabel` y `formatCellDetail` comparten una única función interna de composición de texto, para
que el texto accesible y el visual no puedan divergir (RFN-6).

## 3. Algoritmo del mapa en pseudocódigo

### 3.1 Validación de una sesión (RF-22, RF-23)

```
function esFechaValida(valor):
    si typeof valor != "string": return FALSO
    si valor no coincide con /^\d{4}-\d{2}-\d{2}$/: return FALSO
    anio, mes, dia = partes de valor
    si mes < 1 o mes > 12: return FALSO
    // La longitud real del mes la da el calendario, no una suposición (caso límite año bisiesto)
    diasDelMes = new Date(anio, mes, 0).getDate()
    si dia < 1 o dia > diasDelMes: return FALSO
    return VERDADERO

function sonMinutosValidos(valor):
    si valor es undefined o null: return FALSO
    si typeof valor != "number": return FALSO
    si no es entero: return FALSO            // los decimales son inválidos (RF-23)
    si valor < 1: return FALSO              // cero y negativos son inválidos
    return VERDADERO

function motivoInvalidez(sesion):
    si no esFechaValida(sesion.date): return "fecha"
    si no sonMinutosValidos(sesion.minutes): return "minutos"
    return null
```

### 3.2 Reparto de sesiones (RF-19, RF-22, RF-23)

```
function repartirSesiones(sesiones):
    validas = []
    contadores = { fecha: 0, minutos: 0 }
    para cada sesion de sesiones:
        motivo = motivoInvalidez(sesion)
        si motivo es null:
            validas.append(sesion)          // RF-21: se conservan, no se tocan
        si no:
            contadores[motivo] += 1
    return {
        validas: validas,
        invalidasTotal: contadores.fecha + contadores.minutos,
        invalidasPorMotivo: contadores
    }
```

Una sesión inválida **nunca** se borra ni se modifica. El reparto solo decide quién participa en el
cálculo del mapa (RF-21, principio 5 de la constitución).

### 3.3 Ventana (RF-1, RF-2, RF-5, RF-28)

```
function obtenerLimitesVentana(hoy):
    lunesHoy = getWeekStartMonday(hoy)        // retrocede hasta el lunes de la semana de "hoy"
    inicio = addDays(lunesHoy, -26 * 7)       // lunes de hace 26 semanas
    fin = addDays(lunesHoy, 6)                // domingo de la semana en curso
    return { inicio: inicio, fin: fin }
```

`hoy` entra siempre como parámetro. En ningún punto se llama al reloj del sistema, de modo que el
resultado es idéntico se ejecute cuando se ejecute (RFN-3, RF-26).

### 3.4 Intensidad (RF-8, RF-9, RF-10)

```
function obtenerNivel(minutosTotales):
    si minutosTotales >= 240: return 5
    si minutosTotales >= 120: return 4
    si minutosTotales >= 60:  return 3
    si minutosTotales >= 30:  return 2
    si minutosTotales >= 1:   return 1
    return 0                                    // gris de inactividad
```

Las comparaciones son descendentes y la última es un `return` sin condición, así que ningún total
puede producir un estado por encima del 5 (RF-10).

### 3.5 Construcción de la rejilla (RF-1 a RF-15, RF-28)

```
function construirMapa(sesiones, hoy):
    { inicio, fin } = obtenerLimitesVentana(hoy)
    { validas, invalidasTotal, invalidasPorMotivo } = repartirSesiones(sesiones)

    // 1. Acumular minutos por fecha, solo con sesiones válidas y dentro de la ventana
    minutosPorFecha = mapa vacío
    para cada sesion de validas:
        si sesion.date >= inicio y sesion.date <= fin:
            minutosPorFecha[sesion.date] += sesion.minutes   // RF-9 suma, no promedia

    // 2. Recorrer las 27 columnas × 7 filas
    columnas = []
    celdas = []
    para semana de 0 a 26:
        columna = []
        para fila de 0 a 6:
            fecha = addDays(addDays(inicio, semana * 7), fila)
            minutos = minutosPorFecha[fecha] ?? 0
            nivel = obtenerNivel(minutos)                    // RF-8, RF-14
            celda = {
                fecha: fecha,
                fila: fila,
                minutos: minutos,
                nivel: nivel,
                conActividad: minutos > 0,                  // definición normativa de la spec
                esFutura: fecha > hoy
            }
            columna.append(celda)
            celdas.append(celda)
        columnas.append(columna)                              // RF-2: antigua → reciente

    // 3. Fuera de ventana: se guardan y se muestran en el historial, no se representan (RF-28)
    fueraDeVentana = contar sesiones válidas con fecha < inicio o fecha > hoy

    return {
        hoy: hoy,
        inicio: inicio,
        fin: fin,
        columnas: columnas,                                   // 27 columnas de 7 celdas
        celdas: celdas,                                       // 189 celdas
        invalidasTotal: invalidasTotal,
        invalidasPorMotivo: invalidasPorMotivo,
        fueraDeVentana: fueraDeVentana
    }
```

Puntos donde la spec es estricta y el algoritmo la respeta:

- La suma es de **minutos válidos**. Una sesión inválida en la misma fecha no suma (RF-11) pero sí se
  contabiliza en el aviso (RF-20), porque `repartirSesiones` ya la contabilizó antes.
- Una fecha con solo sesiones inválidas no llega a `minutosPorFecha`, así que su celda cae en nivel 0
  y `conActividad` es `FALSO` (RF-13).
- Una fecha futura con sesiones válida entra en `minutosPorFecha` igual que una pasada, así que
  recibe su intensidad real (RF-14). Si no tiene sesiones, queda en nivel 0 (RF-15). No hay ninguna
  rama especial para el futuro en el color, solo en el texto (RF-16).
- La ventana siempre produce exactamente 189 celdas porque va de lunes a domingo: 26 semanas
  completas más los 7 días de la semana en curso. Por eso la rejilla nunca queda a medias
  ni sus filas desalineadas (RF-1, RF-4, RF-5).

### 3.6 Texto del detalle y texto accesible (RF-16, RFN-6)

```
const DIAS_SEMANA = ["lunes","martes","miércoles","jueves","viernes","sábado","domingo"]
const MESES = ["enero","febrero","marzo","abril","mayo","junio",
               "julio","agosto","septiembre","octubre","noviembre","diciembre"]

function componerTextoCelda(celda):                       // única fuente del texto
    fecha = parsearFechaLocal(celda.fecha)                 // a mediodía, para no cruzar husos
    diaSemana = DIAS_SEMANA[weekdayIndex(celda.fecha)]
    fechaLegible = diaSemana + ", " + fecha.getDate() + " de " + MESES[fecha.getMonth()]
    si celda.conActividad:
        return fechaLegible + " — " + celda.minutos + " min"
    si celda.esFutura:
        return fechaLegible + " — aún no ha llegado"
    return fechaLegible + " — sin sesiones"

function formatCellDetail(celda):    return componerTextoCelda(celda)   // línea visible
function getCellLabel(celda):        return componerTextoCelda(celda)   // texto accesible
```

Ambas funciones delegan en la misma, así que no pueden discrepar (RFN-6). La fecha se parsea a las
12:00 para que ningún ajuste de huso pueda desplazarla al día anterior o siguiente.

### 3.7 Navegación por teclado (RF-29, RF-30, RF-31, RF-32)

```
function moverFocoCelda(indiceActual, tecla, forma):
    { columnas, filas } = forma
    total = columnas * filas
    columna = floor(indiceActual / filas)
    fila    = indiceActual % filas

    si tecla == "ArrowRight": columna = min(columna + 1, columnas - 1)
    si tecla == "ArrowLeft":  columna = max(columna - 1, 0)
    si tecla == "ArrowDown":  fila    = min(fila + 1, filas - 1)
    si tecla == "ArrowUp":    fila    = max(fila - 1, 0)

    nuevo = columna * filas + fila
    si nuevo == indiceActual:
        return null            // borde alcanzado: el foco no se mueve (RF-31)
    return nuevo
```

El recorte con `min` y `max`, en lugar de calcular un salto, es lo que garantiza RF-31: en el borde la
función devuelve `null` y quien llama deja el foco donde estaba.

## 4. Pintado en la interfaz

### 4.1 Estructura en `index.html` (D3, RF-1, RFN-6)

```html
<section class="heatmap-section">
  <h2>Actividad reciente</h2>

  <div class="heatmap" id="heatmap"
       role="grid"
       aria-label="Días estudiados en las últimas 26 semanas"
       aria-rowcount="7" aria-colcount="27"></div>

  <p class="heatmap-detail" id="heatmapDetail" aria-hidden="true"></p>
  <p class="heatmap-warning" id="heatmapWarning" role="status" hidden></p>

  <div class="heatmap-legend" aria-hidden="true">
    <span>menos</span>
    <span class="heatmap-swatch" data-level="0"></span>
    <span class="heatmap-swatch" data-level="1"></span>
    <span class="heatmap-swatch" data-level="2"></span>
    <span class="heatmap-swatch" data-level="3"></span>
    <span class="heatmap-swatch" data-level="4"></span>
    <span class="heatmap-swatch" data-level="5"></span>
    <span>más</span>
  </div>
</section>
```

La rejilla es un `role="grid"` con `role="row"` por columna y `role="gridcell"` por celda. El
contenedor lleva `role="grid"` y las celdas llevan el texto accesible de `getCellLabel`, que es la
misma cadena que muestra la línea de detalle.

La línea de detalle lleva `aria-hidden="true"` a propósito. Si no, un lector de pantalla anunciaría
el mismo texto dos veces: una al situarse sobre la celda y otra al leer la línea. El texto existe
una sola vez para la tecnología de asistencia, en la celda, y la línea es el refuerzo visual para
 quien ve colores.

### 4.2 Estilos en `styles.css` (RFN-5, RFN-7, RFN-8)

- La rejilla es un `display: grid` con `grid-template-columns: repeat(27, 1fr)` y
  `grid-auto-flow: column`, de modo que el orden de las celdas coincide con el orden de columnas de
  más antigua a más reciente (RF-2, RF-4).
- Cada celda es un cuadrado con `aspect-ratio: 1` y `gap` de 2 o 3 px. Con 27 columnas en 375 px de
  ancho útil cada celda queda alrededor de 11 px, y la rejilla entra sin desplazamiento horizontal
  (RFN-5). El mapa es siempre de ancho completo, así que no necesita media queries propias.
- Los seis estados se declaran como clases `.heatmap-cell[data-level="0"]` a `[data-level="5"]`, con
  seis colores distintos derivados de las variables CSS ya existentes, y sus equivalentes en el
  bloque `prefers-color-scheme: dark` (RFN-7). Los mismos colores los usa la leyenda, con
  `data-level`, para que no puedan desincronizarse.
- Bajo `forced-colors: active` (RFN-8), cada nivel recibe un estilo de borde distinto: nivel 1
  sólido fino, nivel 2 discontinuo, nivel 3 punteado, nivel 4 doble, nivel 5 sólido grueso; el nivel
  0 no lleva borde. Así los seis estados siguen siendo distinguibles con escala de grises o alto
  contraste, y no solo por color.

### 4.3 Pintado desde `app.js` (RF-12, RF-16, RF-19, RF-24, RF-27)

```
al cargar la página:
    hoy = toLocalDateKey(new Date())        // se calcula UNA vez (RF-3) y se guarda en una variable
    sesiones = leerSesionesDeFormaSegura()  // try/catch; si falla, lista vacía y bandera de aviso
    pintarMapa(sesiones, hoy)

al enviar el formulario:
    ... guardar sesión como hasta ahora ...
    hoy = la MISMA variable congelada, no una nueva    // RF-26
    pintarMapa(sesiones, hoy)                          // recolorea esa celda al instante (RF-27)
```

`pintarMapa` es la única función de `app.js` que toca el mapa:

1. Llama a `buildHeatmap(sesiones, hoy)` (función pura).
2. Construye 189 celdas en orden y les asigna `dataset.level` y el texto accesible.
3. Deja todas las celdas con `tabindex="-1"` y una sola con `tabindex="0"`: la de la celda de hoy.
   Eso convierte el conjunto en una única parada de tabulación (RF-29).
4. Pinta la línea de detalle vacía (RF-17 en el estado inicial).
5. Pinta el aviso solo si `invalidasTotal > 0` y el almacenamiento estuvo disponible (RF-19, RF-20,
   RF-24).

Los eventos se registran por delegación sobre el contenedor de la rejilla, no celda a celda, porque
así el marcado no depende de cuántas celdas haya:

| Evento | Efecto | Cubre |
|---|---|---|
| `pointerover` | `componerTextoCelda` en la línea de detalle | RF-16 |
| `pointerleave` sobre la rejilla | Vacía la línea | RF-17 |
| `pointerdown` | `componerTextoCelda` en la línea de detalle | RF-16 (táctil) |
| `focusin` | `componerTextoCelda` en la línea de detalle | RF-30 |
| `focusout` | Vacía la línea | RF-17 |
| `keydown` con flechas | `moverFocoCelda`, mueve el foco y actualiza `tabindex` | RF-29, RF-31 |
| `keydown` con `Home` o `End` | Primer o último elemento del grupo | RF-29 |

El mismo manejador de teclado sirve para el puntero y para el foco porque ambos terminan llamando a
la misma función, así que no hay dos rutas que puedan divergir.

`pintarMapa` también marca en el historial las sesiones inválidas, añadiéndoles una clase y una
etiqueta "datos no válidos" (RF-21). Es el único punto en el que el mapa toca funcionalidad
existente, y está autorizado por la sección *Alcance* de la spec.

## 5. Decisiones técnicas y alternativas descartadas

### T1. `heatmap.js` como script clásico con exportación dual

**Elegido**: un archivo `.js` plano que define funciones globales y termina con una guarda
`if (typeof module !== "undefined") module.exports = {...}`.

**Por qué**: `node --test` usa CommonJS y los navegadores no. Los módulos ES (`import`/`export`)
no funcionan al abrir `index.html` con `file://` porque el navegador los bloquea por CORS. La guarda
permite que el mismo archivo se cargue con `<script>` en el navegador y con `require()` en los tests,
sin build ni configuración (principio 1).

**Descartado**: módulos ES nativos, porque rompen el requisito de doble clic. Descartado también un
`package.json` con `"type": "module"`, porque es un archivo de configuración añadido solo para
tests.

### T2. Los tests van en un archivo `.test.js` aparte

**Elegido**: `heatmap.test.js`, ejecutado con `node --test`.

**Por qué**: es lo que el principio 4 de la constitución exige y lo que `AGENTS.md` ya documenta.
Además permite que `heatmap.js` no contenga nada de lógica de pruebas.

**Descartado**: incrustar los tests en `app.js`, porque entonces `node --test` cargaría lógica con
`document` y fallaría, y porque mezclar producción y pruebas hinders la lectura.

### T3. Fechas como cadenas `AAAA-MM-DD`, nunca objetos `Date` en la interfaz

**Elegido**: la lógica pura trabaja con cadenas `AAAA-MM-DD`; los `Date` solo se usan dentro de los
helpers de parseo.

**Por qué**: las claves de `minutosPorFecha` y las comparaciones de la ventana son comparaciones de
cadena, que son exactas y no requieren parseo. Un `Date` a medianoche puede saltar de día por un
ajuste de huso, y ya sabemos que eso causó un bug real con `toISOString`.

**Descartado**: guardar `Date` en las celdas, porque el estado del mapa quedaría acoplado a la zona
horaria del momento en que se construyó.

### T4. Nombres de día y mes escritos a mano en vez de `Intl`

**Elegido**: dos tablas constantes `DIAS_SEMANA` y `MESES` en `heatmap.js`, y
`componerTextoCelda` las usa.

**Por qué**: RF-16 fija una cadena exacta ("martes, 15 de septiembre — 90 min") y los criterios de
finalización exigen tests sobre ella. `Intl.DateTimeFormat` depende de los datos de idioma
disponibles en la instalación de Node, que pueden faltar o variar, con lo que el test sería
inestable. Las tablas dan salida determinista en cualquier máquina.

**Descartado**: `toLocaleDateString('es-ES', ...)`, que es lo que usa hoy `formatDate` en `app.js`
para el historial, por el mismo motivo de determinismo. La diferencia con el historial es
deliberada: aquí la cadena es normativa y testeada.

### T5. Los seis estados viajan como `data-level`

**Elegido**: cada celda lleva `data-level="0"` a `data-level="5"` y el color lo decide CSS.

**Por qué**: la lógica pura devuelve un número y la capa visual lo traduce. Así el mismo
`data-level` sirve a la celda y a la leyenda, y los colores no se pueden desincronizar entre ambos
sitios. También permite que el modo de alto contraste reescriba el estilo sin tocar JavaScript.

**Descartado**: devolver una cadena con el color desde la lógica, porque mezclaría presentación en
una función pura y rompería RFN-2.

### T6. Detalle por `pointerover` en lugar de tooltip flotante

**Elegido**: una sola línea de texto fija bajo la rejilla.

**Por qué**: la decisión D5 de la spec, y además evita el posicionamiento de un tooltip en móvil y
el problema de que se salga por los bordes. También evita el problema clásico de que en táctil no
exista "salir del elemento".

**Descartado**: tooltip flotante, ya rechazado en la fase de especificación.

### T7. Refactor de las métricas existentes de `app.js` a funciones puras

**Elegido**: sí, refactorizar `calculateStreak`, `calculateWeeklyTotal`, `calculateMonthlyDays` y
`calculateBestStreak` para que reciban `today` por parámetro, sin cambiar ningún resultado.

**Por qué**: el principio 3 de la constitución dice que **los cálculos** son funciones puras, y hoy
`app.js` llama a `new Date()` dentro de `getTodayString()`, lo que hace que esas funciones pur den
resultados distintos según la hora en que se ejecuten. Es el mismo tipo de defecto que ya corrigimos
con `toISOString`. El refactor no cambia comportamiento: los mismos valores con la misma fecha.

**Precaución**: el riesgo real aquí no es lógico sino de regresión. Por eso el primer paso del
refactor es escribir tests que **fijan el comportamiento actual** de esas cuatro funciones antes de
tocarlas. Si un test falla antes de tocar el código, es que mi lectura de su comportamiento actual
era incorrecta.

**Descartado**: dejar `app.js` como está. Descartado también crear un `dates.js` compartido, porque
obligaría a los tests a cargar dos archivos y a la página a declarar tres scripts, a cambio de
compartir unas pocas líneas de helpers de fecha.

### T8. `loadSessions` con try/catch y bandera de disponibilidad

**Elegido**: envolver la lectura y la escritura del almacenamiento; si fallan, devolver lista vacía
y marcar `almacenamientoDisponible = false`, que impide mostrar el aviso.

**Por qué**: hoy `loadSessions` haría `JSON.parse` de lo que encuentre sin protección, y un
almacenamiento corrupto rompería la página entera. RF-24 y H7 exigen que la aplicación siga
funcionando. Además, con la bandera, el caso "no hay datos" y el caso "no puedo leer datos" se
comportan de forma distinguible en cuanto al aviso, que es justo lo que RF-24 pide.

**Descartado**: borrar los datos corruptos para "empezar limpio", porque el principio 5 prohíbe
perder sesiones.

## 6. Estrategia de tests con `node --test`

Un solo archivo, `heatmap.test.js`, con `node:test` y `node:assert/strict`. Todas las fechas de los
tests son cadenas literales, nunca `new Date()` (RFN-4). La fecha de referencia es `2026-10-02`, un
viernes, para que los bordes de semana queden exercising.

| Grupo | Qué cubre | RF |
|---|---|---|
| Validez de fecha | Formato incorrecto, mes 0, mes 13, día 0, 32 de enero, 30 de febrero, 29 de febrero en año bisiesto, 29 de febrero en año no bisiesto, vacío, número, `null` | RF-22 |
| Validez de minutos | Ausente, `null`, texto, decimal, cero, negativo, entero válido, número muy grande | RF-23 |
| Reparto | Una sesión inválida por cada motivo; recuento total y desglose por motivo; que la sesión inválida no se modifica ni desaparece del resultado de entrada | RF-19, RF-21 |
| Intensidad | Los once valores límite de los criterios: 0, 1, 29, 30, 59, 60, 119, 120, 239, 240 y un valor enorme; que ningún total supere el nivel 5 | RF-8, RF-10 |
| Suma del mismo día | Dos y tres sesiones en la misma fecha clasifican por el total | RF-9 |
| Día mixto | Una válida y una inválida en la misma fecha: nivel por la válida, inválida contabilizada en el aviso | RF-11 |
| Solo inválidas | Una fecha con solo inválidas cae en nivel 0 y `conActividad` es `false` | RF-13 |
| Ventana | Que el rango va del lunes de hace 26 semanas al domingo de la semana en curso; que una fecha en el borde pertenece y otra un día fuera no | RF-5, RF-28 |
| Forma de la rejilla | 27 columnas, 7 filas, 189 celdas; cada fila tiene siete celdas; una fecha dada cae en la fila de su día de la semana; columnas ordenadas de más antigua a más reciente, con hoy en la última | RF-1, RF-2, RF-4 |
| Bordes de semana | Lunes y domingo consecutivos en columnas distintas; cruce de mes y de año; 29 de febrero seguido de 1 de marzo en su fila correcta | Casos límite |
| Fechas futuras | Con sesión válida recibe su intensidad; sin sesión válida queda en nivel 0 y `conActividad` es `false` | RF-14, RF-15 |
| Estados vacíos | Cero sesiones produce 189 celdas en nivel 0 y `invalidasTotal` 0; solo inválidas produce 189 celdas en nivel 0 y `invalidasTotal` mayor que 0 | RF-6, RF-7 |
| Texto | Las tres cadenas exactas de la tabla de la spec, y que `getCellLabel` y `formatCellDetail` devuelven lo mismo para la misma celda | RF-16, RFN-6 |
| Navegación | Derecha e izquierda sobre una fila; abajo y arriba sobre una columna; los cuatro bordes devuelven `null`; `Home` y `End` van al primer y último elemento | RF-29, RF-31 |
| Determinismo | La misma entrada con la misma `today` devuelve estructuras iguales; ninguna función pura cambia de resultado entre dos llamadas seguidas | RFN-3, RF-26 |
| Regresión de lo existente | Tests que fijan el comportamiento actual de racha, mejor racha, minutos semanales y días del mes, escritos **antes** de aplicar el refactor T7 | Alcance, T7 |

Un test comprueba además que el conjunto de argumentos de las funciones puras no contiene ninguna
llamada al reloj del sistema, para que RFN-3 sea verificable y no una promesa.

La puerta del principio 4 se respeta de forma literal: no se continúa si `node --test` no está en
verde.

## 7. Orden de ejecución

1. Escribir primero los tests de regresión de las métricas actuales y ejecutarlos en verde. Sirven
   de red de seguridad para el refactor T7.
2. Crear `heatmap.js` con la lógica pura, sin DOM.
3. Escribir `heatmap.test.js` y ponerlo en verde.
4. Añadir el marcado del mapa a `index.html` y los estilos a `styles.css`.
5. Conectar en `app.js`: lectura segura, pintado, eventos de puntero, tacto y teclado, aviso.
6. Aplicar el refactor T7 con la red de seguridad del paso 1 puesta.
7. Ejecutar `node --test` y las comprobaciones manuales de la spec.
8. Actualizar `AGENTS.md` y `MEMORY.md` con la lógica nueva, en línea con lo que ya se hace en este
   proyecto.

Los pasos 2 y 3 no tocan la interfaz, así que el mapa se puede validar por completo antes de
pintar nada. Los pasos 5 y 6 tocan funcionalidad existente, y por eso van los últimos.