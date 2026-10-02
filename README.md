# Diario de Estudio

Una aplicación web para llevar el registro de las sesiones de estudio, ver si mantienes la
constancia y saber cuánto llevas de la meta que te hayas fijado para la semana.

No hay cuentas, ni servidor, ni registro: abres `index.html` con doble clic y funciona. Todo se
guarda en tu navegador y no sale nunca de tu equipo.

---

## Qué hace

Cuatro cosas, en una sola pantalla:

1. **Registrar sesiones.** Anotas la fecha, el tema y los minutos, y la sesión aparece en el
   historial.
2. **Ver cómo vas hoy.** Cuatro tarjetas: días seguidos, mejor racha, minutos de esta semana y
   días con actividad este mes.
3. **Fijar un objetivo semanal.** Eliges cuántos minutos quieres estudiar cada semana y ves una
   barra con lo que llevas: *"Esta semana: 240 de 600 min (40%) — Quedan 360 min"*.
4. **Mirar atrás.** Un mapa de calor de las últimas 27 semanas y el historial de las últimas
   12 semanas selladas con su resultado.

### El objetivo semanal en detalle

- La meta se fija **una sola vez** y **no se puede cambiar ni borrar**. Es deliberado: poder
  bajarla en caliente sería una tentación para "cumplir" sin estudiar.
- Admite de **10 a 10080 minutos** (10080 = siete días completos).
- Cada vez que abres la aplicación, las semanas que ya se han cerrado se anotan solas en el
  historial. No hay que hacer nada.
- La semana en la que fijaste la meta **no** aparece en el historial: ese día todavía no tenías
  objetivo. Las siguientes, sí.
- Cada línea del historial dice lo que pasó: *"lunes, 21 de septiembre de 2026 — 400 de 600 min —
  pendiente"*.

---

## Cómo usarlo

```
1. Abre index.html con doble clic.
2. Registra una sesión de hoy  →  la racha pasa a 1.
3. Registra una de ayer        →  la racha pasa a 2.
4. Recarga la página           →  los datos siguen ahí.
5. Fija tu objetivo semanal    →  el formulario desaparece y aparece la barra.
6. Registra una sesión         →  la barra se mueve sin recargar nada. Eso es deliberado.
```

---

## Stack tecnológico

| | |
|---|---|
| Lenguaje | HTML5, CSS3 y JavaScript ES2020, sin frameworks |
| Persistencia | `localStorage` del navegador |
| Tests | `node:test` y `node:assert/strict`, los que trae Node |
| Dependencias | **0** |
| Paquetes | **0** (`package.json` no existe) |
| Compilación | **No hay paso de compilación** |
| Servidor | **No hay servidor** |
| Red | **Ninguna petición**. Todo funciona sin conexión |

**Requisitos:** un navegador moderno y Node 18 o superior, solo para ejecutar los tests. No hace
falta instalar nada.

### Por qué sin dependencias

Un archivo que se abre haciendo doble clic no puede depender de nada externo, porque el
navegador bloquearía los imports con la política de origen único de `file://`. Toda la lógica
está en ficheros JavaScript clásicos cargados con `<script>`, con una guarda
`if (typeof module !== "undefined")` que permite que Node los cargue también para los tests. Por
eso los ficheros puros **no son módulos ES**: convertirlos rompería el doble clic.

---

## Qué contiene la carpeta

```
.
├── index.html            Estructura de la página y orden de carga de los scripts
├── styles.css            Estilos: responsive, modo oscuro y alto contraste
├── diary.js              Lógica pura: fechas, rachas y totales
├── diary.test.js         Tests de diary.js
├── heatmap.js            Lógica pura: mapa de calor
├── heatmap.test.js       Tests de heatmap.js
├── goal.js               Lógica pura: objetivo semanal e historial
├── goal.test.js          Tests de goal.js
├── app.js                Almacenamiento, pintado y eventos del DOM
├── AGENTS.md             Documentación de arquitectura para agentes
├── MEMORY.md             Estado del proyecto en pocas líneas
├── docs/
│   └── constitution.md   Los 6 principios que gobiernan el proyecto
└── specs/
    ├── 001-heat-map/    Especificación, plan, tareas y notas de revisión
    └── 002-objetivo-semanal/
```

Los ficheros `*.test.js` **no** se cargan en la página: son solo para ejecutar los tests.

---

## Arquitectura

La idea que ordena todo el proyecto está en `docs/constitution.md`:

> Todo lo que calcula una fecha, una racha, un total, un color o un progreso **va en un fichero
> puro** que recibe "hoy" como parámetro. `app.js` es el único que toca el almacenamiento y el DOM.

```
index.html
   │
   ├── diary.js    ─┐
   ├── heatmap.js  ─┼─→  lógica pura: sin DOM, sin localStorage, con `today` como parámetro
   ├── goal.js     ─┘
   │
   └── app.js         →  localStorage, DOM y eventos. Nada más.
```

Esa frontera permite que casi todo el código se pruebe sin navegador. `goal.js` **reutiliza**
funciones de `diary.js` y `heatmap.js` en lugar de duplicarlas, y por eso el orden de carga
—`diary.js` → `heatmap.js` → `goal.js` → `app.js`— es un contrato, no una preferencia.

`AGENTS.md` explica esta frontera, las reglas de nombres y las trampas del proyecto con más
detalle.

### Fechas: dos reglas que no se negocian

- **Siempre en hora local.** `toISOString()` convierte a UTC y desplaza el día en husos con
  offset negativo, así que está prohibido en la lógica pura. Hay un test que falla si aparece.
- **"Hoy" se calcula una sola vez**, al cargar la página, y no cambia aunque el reloj del sistema
  cambie con la pestaña abierta.

---

## Las funciones

### `diary.js` — lógica pura: fechas y rachas

| Función | Qué hace |
|---|---|
| `toLocalDateString(date)` | Convierte un `Date` en `"AAAA-MM-DD"` en hora local. |
| `localDateFromKey(dateKey)` | Convierte `"AAAA-MM-DD"` en un `Date` **a mediodía**, para que ningún huso mueva el día. |
| `getYesterdayString(today)` | La clave de fecha de ayer. |
| `shiftDateString(dateKey, days)` | Suma o resta días a una clave de fecha. |
| `getDaysFromToday(today, dateKey)` | Días de distancia entre dos fechas, positivo si es pasado. |
| `getDateStringMinusDays(today, daysAgo)` | La clave de fecha de hace N días. |
| `getUniqueDatesWithSessions(sessions)` | Fechas sin repetir que tienen alguna sesión. |
| `calculateBestStreak(sessions)` | La racha más larga de **toda** la historia. |
| `calculateStreak(sessions, today)` | La racha actual. Vive si estudiaste ayer, aunque hoy no hayas estudiado todavía. |
| `getWeekRange(today)` | Lunes y domingo de la semana de `today`. |
| `calculateWeeklyTotal(sessions, today)` | Suma los minutos de la semana actual. |
| `getMonthRange(today)` | Primer y último día del mes de `today`. |
| `calculateMonthlyDays(sessions, today)` | Días distintos con sesiones este mes. |
| `formatDate(dateKey)` | Fecha en formato largo en español, para el historial. |

### `heatmap.js` — lógica pura: mapa de calor

| Función | Qué hace |
|---|---|
| `isValidDateKey(value)` | ¿Es una fecha local existente en formato `AAAA-MM-DD`? |
| `isValidMinutes(value)` | ¿Son minutos válidos? Un entero ≥ 1, sin decimales. |
| `getInvalidReason(session)` | Por qué una sesión es inválida: fecha o minutos. |
| `addDays(dateKey, days)` | Suma días a una clave de fecha. |
| `weekdayIndex(dateKey)` | 0 = lunes … 6 = domingo. |
| `getWeekStartMonday(dateKey)` | El lunes de la semana de esa fecha. |
| `getWindowBounds(today)` | Primer y último día de la ventana de 27 semanas. |
| `getIntensityLevel(minutes)` | Nivel de color 0–5 según minutos. |
| `partitionSessions(sessions)` | Separa las sesiones en `valid` e `invalid`. |
| `buildHeatmap(sessions, today)` | Construye la rejilla completa de 27 × 7 celdas. |
| `composeCellText(cell)` | El texto de una celda, compartido por la línea de detalle y su `aria-label`. |
| `formatCellDetail(cell)` | Formatea ese texto para la línea visible. |
| `getCellLabel(cell)` | Devuelve el mismo texto como `aria-label`. |
| `moveFocusCell(currentIndex, key, shape)` | Mueve el foco con las flechas; en los bordes devuelve `null` y el foco no se mueve. |

### `goal.js` — lógica pura: objetivo semanal

| Función | Qué hace |
|---|---|
| `parseGoalInput(text)` | Valida lo escrito en el campo: recorta, exige dígitos y el rango [10, 10080]. Devuelve `null` si algo falla. |
| `buildGoalRecord(value, today)` | Construye el registro `{ value, setAt, setAtWeekStart }`. |
| `isValidGoalRecord(record)` | ¿Es un registro de meta válido? `setAt` no cuenta: es solo de trazabilidad. |
| `getValidMinutesForWeek(sessions, today)` | Minutos **válidos** de una semana. Filtra antes de sumar, porque `calculateWeeklyTotal` suma a ciegas y devuelve `NaN` con datos raros. |
| `computeProgress(minutes, goalValue)` | `{ remaining, percent, met }` o `null` sin meta. El porcentaje se **trunca** (249/600 → 41) y se corta al 100. |
| `composeGoalLines(state)` | Compone los textos visibles de la tarjeta. Si el objetivo está cumplido, solo devuelve la línea de cumplimiento. |
| `normalizeHistory(raw)` | Limpia el historial: descarta lo ilegible, ordena de más reciente a más antigua, quita duplicados y corta a las 12 últimas. |
| `buildHistoryEntry(sessions, weekStart, goalValue)` | Construye la anotación de una semana cerrada. |
| `isWeekEntryMet(entry)` | ¿Se cumplió esa semana? Solo mira **su propia** `met` guardada. |
| `listWeeksToSeal(history, goalRecord, today)` | Qué semanas cerradas hay que anotar. Nunca la semana en la que se fijó la meta, ni ninguna anterior. |
| `sealWeeks(sessions, history, goalRecord, today)` | Anota esas semanas. Devuelve `{ history, changed }` con el historial ya normalizado. |
| `composeWeekEntryLine(entry)` | La línea de texto del historial: fecha, resultado y "cumplida" o "pendiente". |
| `isSameHistory(a, b)` | ¿Es la misma lista de semanas? Decide si hace falta reescribir el historial guardado. |
| `selectVisibleHistory(goalRecord, history)` | Sin objetivo no hay historial en pantalla. |

### `app.js` — almacenamiento, DOM y eventos

Único fichero con acceso a `localStorage` y al DOM.

| Función | Qué hace |
|---|---|
| `loadSessions()` | Lee las sesiones guardadas. |
| `saveSessions(sessions)` | Guarda las sesiones. |
| `readJsonKey(key)` | Lee una clave JSON distinguiendo tres casos: vacío, dato corrupto y error de almacenamiento. |
| `writeJsonKey(key, value)` | Escribe una clave JSON. |
| `loadGoal()` | Lee y valida la meta semanal. |
| `loadWeeks()` | Lee y normaliza el historial. |
| `saveGoal(record)` | Guarda la meta. Devuelve si tuvo éxito. |
| `saveWeeks(weeks)` | Guarda el historial ya normalizado. |
| `renderGoalWarning()` | Muestra el aviso de meta guardada no válida. |
| `sealAndPersistWeeks(sessions)` | Al arrancar: sella en memoria y escribe una sola vez si hace falta. |
| `paintGoalLine(element, text)` | Pinta una línea de texto, u la oculta si no aplica. |
| `paintGoalBar(progress, valueText)` | Pinta la barra: el relleno y `aria-valuenow` salen del mismo número. |
| `paintGoalHistory()` | Pinta la lista de semanas, o la oculta si no hay objetivo. |
| `renderGoalCard(sessions)` | Pinta la tarjeta de objetivo completa. |
| `initGoal(sessions)` | El arranque del objetivo: leer, sellar, escribir, pintar. |
| `escapeHtml(text)` | Escapa texto antes de insertarlo en el DOM. |
| `renderSessions(sessions)` | Pinta el historial de sesiones. |
| `renderHeatmap(sessions)` | Pinta el mapa de calor. |
| `createHeatmapCell(cell)` | Crea una celda del mapa, con su `aria-label`. |
| `renderHeatmapWarning()` | Muestra el aviso de sesiones que no se pueden interpretar. |
| `showCellDetail(cell)` | Muestra la línea de detalle de una celda. |
| `clearCellDetail()` | La vacía. |
| `cellFromEvent(event)` | Deduce la celda a partir del evento. |
| `setFocusedCell(index, moveFocus)` | Mueve el foco del mapa y actualiza el `tabindex`. |
| `updateUI()` | Repinta las métricas, el mapa y el historial. |
| `showGoalError()` / `hideGoalError()` | Muestra u oculta el error de validación del objetivo. |

---

## Los datos

| Clave | Contenido |
|---|---|
| `study-diary-sessions` | Lista de `{ id, date, topic, minutes }` |
| `study-diary-goal` | `{ value, setAt, setAtWeekStart }` |
| `study-diary-weeks` | Hasta 12 `{ weekStart, minutes, met }` |

Las tres son independientes. El código del objetivo **nunca escribe ni borra** las sesiones: solo
las lee. Ninguna sesión se pierde nunca: los datos que no se pueden interpretar se conservan, se
marcan como "datos no válidos" y se avisa en pantalla.

---

## Tests

```bash
node --test                      # todo: 289 tests
node --test heatmap.test.js      # solo un fichero
```

Los tests usan **solo** `node:test` y `node:assert/strict`. Ninguna fecha viene del reloj del
sistema: todas son cadenas literales, para que los resultados no dependan del día en que los
ejecutes.

---

## Accesibilidad

- El color **nunca** es el único medio de transmitir información. La barra de progreso lleva
  `role="progressbar"` con su valor y su texto; el mapa de calor, su `aria-label`.
- El mapa de calor se recorre entero con el teclado y es **una sola parada** de tabulación.
- Modo oscuro automático y estilos propios para **alto contraste**.
- Sin desplazamiento horizontal a 375 px.

---

## Cómo se trabaja en este proyecto

En `specs/` está el rastro de cómo se construyó cada funcionalidad: la **spec** (qué tiene que
hacer y con qué palabras exactas), el **plan**, las **tareas** y las **notas** de las revisiones
manuales. La spec 001 es el mapa de calor y la 002, el objetivo semanal.

El flujo es: spec → revisión de clarificación → plan y tareas → implementación → validación
requisito por requisito. Nada se implementa sin estar escrito antes.

---

## Hecho con inteligencia artificial

**Este proyecto fue desarrollado íntegramente con agentes de IA** (OpenCode, con modelos de
OpenAI y Google), bajo un proceso estructurado en cuatro fases —especificación, revisión,
planificación e implementación con validación— en el que los requisitos se escribían y se
comprobaban antes de programar, y un validador independiente revisaba la implementación
requisito por requisito antes de darla por buena.

Lo que eso significa en la práctica:

- La especificación de cada funcionalidad se redactó **antes** de escribir una línea de código, y
  pasó cuatro revisiones de clarificación antes de aprobarse.
- Hay **289 tests** que se escribieron antes de las implementaciones, y siguen en verde.
- Dos requisitos se corrigieron por haber sido detectados en la validación, no durante la
  programación.
- `docs/constitution.md` recoge los principios que gobiernan el código, y un test falla si la
  lógica pura accede al reloj del sistema o convierte fechas a UTC.

Conviene saber también lo contrario: el código ha sido revisado y validado por un agente
separado del que lo escribió, pero **sigue sin haber sido probado por una persona que lo use en su
vida diaria**. Si algo no te cuadra, ábrelo y corrígelo tú: el código está escrito para leerse.

---

## Licencia

Sin licencia declarada. Puedes leerlo, ejecutarlo y modificarlo. Los datos son tuyos y se quedan
en tu navegador.
