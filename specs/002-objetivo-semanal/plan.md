# Plan de implementación — Spec 002: Objetivo semanal de estudio

Este plan es la traducción técnica de `specs/002-objetivo-semanal/spec.md`. Cada sección indica qué
requisitos de la spec cubre. Nada se implementa aquí: es solo el plan.

## 1. Archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `goal.js` | Nuevo | Toda la lógica pura del objetivo: parseo y validación de la meta, registro de la meta, minutos válidos de una semana, progreso, sellado de semanas, normalización del historial y textos exactos. Sin DOM, sin `localStorage`, sin reloj del sistema. Depende de `diary.js` y de `heatmap.js`. |
| `goal.test.js` | Nuevo | Tests de `node --test` de todo lo que hay en `goal.js`. Requiere `diary.js` y `heatmap.js` en ese orden (RFN-5). |
| `index.html` | Modificar | Añade la tarjeta de objetivo inmediatamente debajo de la tarjeta "minutos esta semana" (RF-30). Carga `goal.js` después de `diary.js` y de `heatmap.js`, y antes de `app.js` (RFN-5). |
| `styles.css` | Modificar | Estilos de la tarjeta, la barra de progreso y el historial, con equivalentes en modo oscuro y en `forced-colors`. |
| `app.js` | Modificar | Única capa que toca `localStorage` y el DOM: lectura y escritura de las dos claves nuevas, sellado al cargar, pintado de la tarjeta y eventos del formulario de meta. |

Ninguna modificación toca el mapa de calor, la racha, la mejor racha, los recuentos mensuales ni el
formulario de sesiones, tal como exige la sección *Alcance* de la spec. `heatmap.js` y `diary.js` no se
modifican: el objetivo solo los consume.

## 2. Claves de almacenamiento

Dos claves nuevas, distintas entre sí y de `study-diary-sessions` (RF-35, RF-36, RF-41).

| Clave | Contenido | Forma exacta |
|---|---|---|
| `study-diary-goal` | Registro de la meta | `{ "value": 600, "setAt": "2026-10-02", "setAtWeekStart": "2026-09-28" }` |
| `study-diary-weeks` | Historial sellado | `[{ "weekStart": "2026-09-21", "minutes": 480, "met": 600 }]`, de la más reciente a la más antigua, máximo 12 entradas |

`setAt` es trazabilidad y puede faltar sin invalidar el registro (RF-38). `setAtWeekStart` es el único
campo del que depende el sellado. `met` es la meta vigente en el momento de sellar, y es con la que se
compara la entrada (RF-23).

`localStorage.setItem('study-diary-sessions', ...)` y `removeItem` no se llaman nunca desde el código
del objetivo. La clave de sesiones solo se lee (RF-41).

## 3. Funciones puras de `goal.js`

Todas reciben `today` como cadena `AAAA-MM-DD` cuando lo necesitan. Ninguna toca el DOM, ni
`localStorage`, ni llama a `new Date()` sin argumentos, ni a `Date.now()`, ni usa `toISOString()`
(RFN-2, RFN-3, RFN-4).

| Función | Firma | Responsabilidad | Cubre |
|---|---|---|---|
| `parseGoalInput(text)` | `string` → `number \| null` | Limpia espacios periféricos y exige un entero escrito sin separador dentro de [10, 10080]. Devuelve `null` si no cumple. | RF-3, RF-4 |
| `buildGoalRecord(value, today)` | → `{ value, setAt, setAtWeekStart }` | Calcula `setAt` con `toLocalDateString` y `setAtWeekStart` con `getWeekStartMonday`. | RF-7, RF-35 |
| `isValidGoalRecord(record)` | `any` → `boolean` | Exige objeto, `value` entero en rango y `setAtWeekStart` que sea fecha local existente. `setAt` no interviene. | RF-38 |
| `getValidMinutesForWeek(sessions, today)` | → `number` | `calculateWeeklyTotal(partitionSessions(sessions).valid, today)`. Para una semana pasada se le pasa su `weekStart` como `today`. | RF-9, RF-10, RF-13 |
| `computeProgress(minutes, goalValue)` | → `{ remaining, percent, met }` o `null` | `remaining` sin signo, `percent` entero truncado con tope 100, `met` booleano. Con `goalValue` nulo devuelve `null`. | RF-11 a RF-17 |
| `listWeeksToSeal(history, goalRecord, today)` | → `string[]` de lunes | Semanas cerradas con `weekStart` estrictamente posterior a `setAtWeekStart` y no anotadas. Devuelve `[]` si el reloj retrocede. | RF-21, RF-26, RF-44 |
| `buildHistoryEntry(sessions, weekStart, goalValue)` | → `{ weekStart, minutes, met }` | Minutos válidos de esa semana más la meta vigente. | RF-22 |
| `sealWeeks(sessions, history, goalRecord, today)` | → `{ history, changed }` | Sella en orden de la más antigua a la más reciente y normaliza el resultado. Con `goalRecord` nulo devuelve el historial normalizado sin tocarlo. | RF-21, RF-22, RF-26, RF-44 |
| `normalizeHistory(raw)` | `any` → `entry[]` | Descarta no interpretables, ordena de más reciente a menos, conserva la primera de cada `weekStart` repetido con desempate por más `minutes`, y corta a 12. | RF-24, RF-25, RF-37 |
| `isWeekEntryMet(entry)` | → `boolean` | `entry.minutes >= entry.met`. No recibe la meta vigente. | RF-23 |
| `composeWeekEntryLine(entry)` | → `string` | `"lunes, 29 de septiembre de 2025 — 650 de 600 min — cumplida"`. | RF-34 |
| `composeGoalLines(state)` | → `{ status, progress, remaining, met, valueText }` | Los literales exactos de la tabla de RF-28 y el `aria-valuetext`. Con `state.hasGoal` falso devuelve solo `status`. | RF-28, RF-29, RFN-8 |

`composeGoalLines` es la única fuente de los textos visibles y accesibles, igual que
`composeCellText` lo es en `heatmap.js`: así el número que anuncia el lector de pantalla y el que ve
la vista no pueden divergir.

## 4. Resolución de dependencias en `goal.js` (decisión T1)

`goal.js` necesita funciones de `diary.js` y de `heatmap.js`, y debe funcionar con `<script>` en el
navegador y con `require()` en Node. En Node, `require('./diary.js')` no expone las funciones como
globales de `goal.js`; en el navegador sí. La resolución se hace una sola vez, al principio del archivo,
en un objeto con espacio de nombres propio:

```
GOAL_DEPS = (function () {
    si existe module.exports:
        return { diary: require('./diary.js'), heatmap: require('./heatmap.js') }
    si no:
        return {
            diary: { calculateWeeklyTotal, toLocalDateString, localDateFromKey },
            heatmap: { partitionSessions, getWeekStartMonday, isValidMinutes, weekdayIndex, addDays }
        }
})()
```

Regla dura que se deduce de esto: **`goal.js` no declara ninguna constante ni función cuyo nombre ya
exista como declaración global en `diary.js` o `heatmap.js`**. Dos scripts clásicos comparten el
ámbito global léxico, así que un `const` repetido lanza `SyntaxError` y rompe la página entera. Por eso
las tablas de nombres van como `GOAL_WEEKDAY_NAMES` y `GOAL_MONTH_NAMES`, y no como `WEEKDAY_NAMES`.

`goal.test.js` requiere `diary.js`, luego `heatmap.js`, luego `goal.js`, en ese orden (RFN-5).

## 5. Algoritmos clave en pseudocódigo

### 5.1 Minutos válidos de una semana (RF-9, RF-10)

```
function minutosValidosDeLaSemana(sesiones, hoy):
    // El filtro de validez va ANTES de la suma (D3)
    validas = GOAL_DEPS.heatmap.partitionSessions(sesiones).valid
    // calculateWeeklyTotal deriva la semana de "hoy"; para una semana cerrada
    // se le pasa su propio weekStart
    return GOAL_DEPS.diary.calculateWeeklyTotal(validas, hoy)
```

`calculateWeeklyTotal` solo filtra por rango de fechas y puede devolver `NaN` con minutos no numéricos.
El filtro previo es lo que impide que un `NaN` llegue al progreso, al porcentaje, a la barra o a una
entrada del historial. Corregir `calculateWeeklyTotal` de raíz es trabajo de otra spec.

### 5.2 Progreso (RF-11 a RF-17)

```
function calcularProgreso(minutos, meta):
    si meta es null o undefined: return null          // RF-17
    restantes = meta - minutos
    si restantes < 0: restantes = 0                   // sin signo (RF-11)
    porcentaje = min(100, floor(minutos * 100 / meta)) // truncado (RF-12)
    return { restantes, porcentaje, cumplido: minutos >= meta }
```

El entero truncado es el mismo para el texto, para el relleno de la barra y para el `aria-valuenow`
(RF-13, RFN-8), así que los tres no pueden desincronizarse.

### 5.3 Qué semanas se sellan (RF-21, RF-26, RF-44)

```
function listarSemanasParaSellar(historial, registroMeta, hoy):
    si registroMeta es null: return []                 // RF-26
    semanaActual = getWeekStartMonday(hoy)
    ultima = entrada más reciente del historial, o null
    si ultima no es null y semanaActual <= ultima.weekStart:
        return []                                       // RF-44: el reloj retrocedió
    ultimaSellar = ultima no es null ? ultima.weekStart : registroMeta.setAtWeekStart
    pendientes = []
    cursor = addDays(ultimaSellar, 7)
    mientras cursor < semanaActual:
        pendientes.append(cursor)
        cursor = addDays(cursor, 7)
    return pendientes
```

El bucle no puede ser infinito porque `addDays` siempre avanza 7 días y la condición exige `cursor <
semanaActual`. La semana en la que se fijó la meta nunca se sella: su `weekStart` es igual a
`setAtWeekStart` y el bucle arranca en `setAtWeekStart + 7` (RF-21, D5).

### 5.4 Normalización del historial (RF-25, RF-37)

```
function normalizarHistorial(bruto):
    si bruto no es una lista: bruto = []
    entradas = []
    para cada elemento de bruto:
        si no es objeto: continuar
        si weekStart no es fecha válida: continuar
        si minutes no es entero >= 0: continuar
        si met no es entero dentro de [10, 10080]: continuar
        entradas.append({ weekStart, minutes, met })
    // Ordenar ANTES de deduplicar: la más reciente primero
    entradas.sort((a, b) => b.weekStart.localeCompare(a.weekStart))
    // Desempate determinista: con el mismo weekStart gana más minutes
    entradas.sort((a, b) => b.minutes - a.minutes)
    únicas = []
    vistas = conjunto vacío
    para cada entrada de entradas:
        si vistas tiene entrada.weekStart: continuar
        vistas.add(entrada.weekStart)
        únicas.append(entrada)
    return únicas.slice(0, 12)
```

El segundo `sort` solo desempata dentro de cada `weekStart`, porque `Array.prototype.sort` es estable:
el desempate por `minutes` convierte el empate en un resultado que no depende del orden guardado. Sin
él, la normalización heredaría el orden en que quedaron las entradas (D12).

### 5.5 Texto del historial (RF-34)

Las tablas `GOAL_WEEKDAY_NAMES` y `GOAL_MONTH_NAMES` son literales en español, nunca `Intl` (mismo
motivo que en `heatmap.js`: RF-34 fija cadenas exactas y los tests las comprueban). El guion largo es
`—` y los minutos no llevan separador de millares.

```
function componerLineaEntrada(entrada):
    dia = weekdayIndex(entrada.weekStart)
    fecha = localDateFromKey(entrada.weekStart)          // a mediodía, sin cruzar husos
    legible = GOAL_WEEKDAY_NAMES[dia] + ", " + fecha.getDate()
              + " de " + GOAL_MONTH_NAMES[fecha.getMonth()]
              + " de " + fecha.getFullYear()
    estado = isWeekEntryMet(entrada) ? "cumplida" : "pendiente"
    return legible + " — " + entrada.minutes + " de " + entrada.met + " min — " + estado
```

## 6. Orden de operaciones en `app.js`

Este es el punto más delicado de la implementación, porque el sellado muta dos claves y no puede
escribirse la de sesiones por accidente.

### 6.1 Al cargar la página

```
hoy = toLocalDateString(new Date())          // ya existe como TODAY, una sola vez (RFN-3)
sesiones = loadSessions()                    // try/catch, igual que hoy (RF-39)

meta = leerMetaSegura()                      // try/catch → null si falla o no hay dato
historialBruto = leerHistorialSeguro()       // try/catch → [] si falla

if (meta no es null y !isValidGoalRecord(meta)):
    // Meta corrupta: se descarta, se avisa y vuelve el formulario (RF-38)
    meta = null
    mostrarAvisoMetaInvalida()

if (meta es null y almacenamientoDisponible):
    // Sin meta no hay aviso de datos corruptos, solo el estado normal sin objetivo (RF-40)
    pass

historial = normalizeHistory(historialBruto)       // siempre, incluso sin meta (RF-37)

if (meta no es null):
    { historial, changed } = sealWeeks(sesiones, historial, meta, hoy)
    if (changed): escribirHistorial(historial)     // normalizado y sellado, ya persistido (RF-22)

// estado de la semana actual, con el hoy congelado
minutos = getValidMinutesForWeek(sesiones, hoy)    // null si no hay meta
progreso = calcularProgreso(minutos, meta ? meta.value : null)

pintarTarjetaObjetivo(...)                         // incluye el historial ya sellado (RF-22)
updateUI()                                          // métricas, historial y mapa, sin cambios
```

El orden importa: normalizar antes de sellar evita duplicar claves, y sellar antes de pintar evita que
la pantalla muestre un historial distinto del que queda guardado.

### 6.2 Al enviar el formulario de sesiones

Solo se recalcula el progreso de la semana actual con el `hoy` congelado. **No se sella nada**: el
sellado ocurre al cargar y solo al cargar (RF-43), y una sesión retroactiva no toca una semana ya
sellada (RF-27). La clave de sesiones la escribe el manejador que ya existe, sin cambios.

### 6.3 Orden de carga en `index.html`

```html
<script src="diary.js"></script>
<script src="heatmap.js"></script>
<script src="goal.js"></script>
<script src="app.js"></script>
```

`goal.js` después de los dos que usa y antes de `app.js`, que lo necesita al pintar. Este orden es
contrato, no preferencia (RFN-5, D6).

## 7. Marcado y estilos

La tarjeta va dentro del grupo de métricas, inmediatamente después de `.weekly-card` (RF-30), con este
esqueleto:

```html
<section class="goal-card" id="goalCard">
  <h2 class="goal-title">Objetivo semanal</h2>
  <p class="goal-status" id="goalStatus"></p>

  <form id="goalForm" hidden>
    <label for="goalMinutes">Minutos por semana</label>
    <input type="number" id="goalMinutes" name="goalMinutes" min="10" max="10080" required>
    <button type="submit" class="btn-primary">Fijar objetivo</button>
    <p class="goal-error" id="goalError" role="alert" aria-describedby="goalMinutes" hidden></p>
  </form>

  <div class="goal-bar" id="goalBar"
       role="progressbar"
       aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"
       aria-label="Progreso del objetivo semanal" hidden>
    <div class="goal-bar-fill" id="goalBarFill"></div>
  </div>

  <p class="goal-progress" id="goalProgress" hidden></p>
  <p class="goal-remaining" id="goalRemaining" hidden></p>
  <p class="goal-met" id="goalMet" hidden></p>
  <p class="goal-warning" id="goalWarning" role="status" hidden></p>

  <ul class="goal-history" id="goalHistory"></ul>
</section>
```

La barra lleva `aria-valuenow` con el entero truncado y `aria-valuetext` con el total real y la meta
(RFN-8). El mensaje de error lleva `role="alert"` y se anuncia con `aria-describedby` apuntando al
campo. El color y la longitud de la barra son decorativos: los números están en el texto visible.

## 8. Decisiones técnicas y alternativas descartadas

### T1. Dependencias resueltas en un objeto `GOAL_DEPS`, no en identificadores sueltos

**Elegido**: un IIFE al principio de `goal.js` que devuelve `{ diary, heatmap }` con `require` en Node y
con los globales existentes en el navegador.

**Por qué**: en Node los `require` no crean globales, así que el archivo necesita resolver sus
dependencias él mismo. Y la alternativa de declarar `const calculateWeeklyTotal = ...` en `goal.js`
para igualar ambas rutas es peligrosa: en el navegador eso redeclara un nombre que ya existe como
declaración global en otro script clásico, y el `SyntaxError` impide que cargue la página.

**Descartado**: módulos ES, que rompen el doble clic sobre `index.html`. Descartado también un
`package.json` con `"type": "module"`, que es un archivo de configuración añadido solo para tests.

### T2. Tablas de nombres con prefijo `GOAL_`

**Elegido**: `GOAL_WEEKDAY_NAMES` y `GOAL_MONTH_NAMES` en `goal.js`, en vez de reutilizar
`WEEKDAY_NAMES` y `MONTH_NAMES` de `heatmap.js`.

**Por qué**: reutilizar las de `heatmap.js` funciona en el navegador, donde son globales, pero en Node
`heatmap.js` no las exporta, así que `goal.test.js` no podría comprobarlas. Duplicarlas con prefijo es
un coste de siete y doce cadenas que evita dos fallos: un `SyntaxError` en la página y un test que no
puede ejecutarse.

**Descartado**: exportarlas desde `heatmap.js`, porque tocar ese archivo va contra la sección *Alcance*
de la spec, y porque la spec 001 no obliga a que ese archivo sea reutilizable.

### T3. Sin política de escritura coalescente: una escritura por carga

**Elegido**: si `sealWeeks` devuelve `changed`, se escribe el historial una vez, ya normalizado.

**Por qué**: evita una escritura cuando no hay nada que guardar, que es el caso más común al cargar. Y
como lo que se persiste es el resultado de normalizar, lo guardado y lo visto son siempre lo mismo
(RF-22, D12).

**Descartado**: comparar el historial normalizado con el bruto carácter a carácter antes de escribir.
Complica el código para ahorrar una escritura que no tiene coste apreciable.

### T4. El filtro de validez se aplica en `goal.js`, no en `calculateWeeklyTotal`

**Elegido**: `calculateWeeklyTotal(partitionSessions(sessions).valid, today)`.

**Por qué**: es la única forma de que el objetivo no herede el `NaN` que `calculateWeeklyTotal` produce
con minutos no numéricos, sin tocar `diary.js`, cuyo cambio de comportamiento afecta a la racha y a
las métricas y pertenece a otra spec (D3).

**Consecuencia asumida**: con datos corruptos, la tarjeta "minutos esta semana" y el objetivo pueden
mostrar números distintos. Es deliberado y está declarado en D3.

### T5. La comprobación del reloj atrás vive en la lógica pura

**Elegido**: `listWeeksToSeal` devuelve `[]` cuando `semanaActual <= ultimaEntrada.weekStart`.

**Por qué**: la regla depende solo de fechas, no del DOM ni del almacenamiento, así que puede probarse
con dos llamadas y fechas literales. Y evita que un reloj mal ajustado meta entradas con `weekStart` en
el futuro que bloqueen el sellado de todas las semanas siguientes (RF-44, D15).

**Descartado**: comprobarlo en `app.js` al Pintar, porque entonces el mismo criterio existiría en dos
sitios y podrían divergir entre sí.

## 9. Riesgos y puntos delicados

| # | Riesgo | Cómo se evita |
|---|---|---|
| R1 | Escribir o borrar `study-diary-sessions` desde el código del objetivo (RF-41) | `goal.js` no sabe qué es `localStorage`. En `app.js` las dos funciones nuevas de escritura reciben el nombre de la clave como argumento y solo se llaman con `GOAL_KEY` y `WEEKS_KEY`. La comprobación manual con inspector de almacenamiento es obligatoria. |
| R2 | `calculateWeeklyTotal` devuelve `NaN` con minutos no numéricos | `partitionSessions` filtra antes de sumar (T4). Test con `NaN`, decimales, cero, negativos y fechas inexistentes. |
| R3 | El sellado se ejecuta en el orden equivocado y duplica claves | Normalizar antes de sellar, sellar antes de pintar (§6.1). |
| R4 | `setAt` ausente invalida una meta válida | `isValidGoalRecord` no mira `setAt` (RF-38). Test explícito de un registro sin `setAt`. |
| R5 | El aviso de meta corrupta aparece sin almacenamiento | La bandera `storageAvailable` existente ya lo impide; `renderGoalWarning` la consulta igual que el aviso del mapa (RF-39). |
| R6 | Un `SyntaxError` en `goal.js` por nombre global repetido | Ninguna declaración de `goal.js` repite un nombre de `diary.js` o `heatmap.js` (T1, T2). La página se abre sin errores en consola tras cada bloque. |
| R7 | El empate de dos entradas con el mismo `weekStart` depende del orden guardado | Segundo `sort` por `minutes` descendente dentro de `normalizeHistory` (§5.4, RF-25, D12). |
| R8 | La tarjeta desplaza el mapa de calor o el historial de sesiones | Va dentro del grupo de métricas, después de `.weekly-card` (RF-30). La revisión de no regresión compara la posición de las secciones antes y después. |
| R9 | La barra muestra un relleno que el porcentaje redondeado no sostiene | Relleno, texto y `aria-valuenow` usan el mismo entero truncado (RF-13). |
| R10 | La página se rompe al abrirla con doble clic por el orden de los scripts | `goal.js` se carga después de `diary.js` y `heatmap.js` (§6.3). Se verifica abriendo el archivo, no solo con `node --test`. |

## 10. Fuera de esta implementación

Queda expresamente fuera, tal como declara la sección *Fuera de alcance* de la spec:

- Corregir `calculateWeeklyTotal` de `diary.js` para que filtre por sí mismo las sesiones no válidas.
- Editar o borrar una meta ya fijada, y cualquier control para hacerlo (RF-5).
- Sellar la semana en la que se fijó la meta, o cualquier semana anterior (RF-21, D5).
- Ampliar el historial más allá de las 12 entradas más recientes.
- Mostrar el objetivo o el progreso en el mapa de calor, en la tarjeta "minutos esta semana" o en
  cualquier otra vista (RFN y alcance de la spec).
- Gráficas, tendencias, medias por día, ritmo necesario o proyección de fin de semana.
- Automatizaciones, recordatorios, notificaciones o integración con el calendario.
- Sincronización entre dispositivos, cuentas, exportación o importación.
- Cualquier modificación de `heatmap.js`, `diary.js` o del formulario de sesiones.

## 11. Estrategia de tests con `node --test`

Un archivo nuevo, `goal.test.js`, con `node:test` y `node:assert/strict`, que requiere `diary.js`,
`heatmap.js` y `goal.js` en ese orden. Todas las fechas son cadenas literales; `today` nunca se saca
del reloj del sistema (RFN-6). Las fechas de referencia son `2026-10-02` (viernes), `2026-09-28` (lunes
de esa semana) y `2025-12-29` (lunes que cruza el 31 de diciembre).

| Grupo | Qué cubre | RF |
|---|---|---|
| Parseo de la meta | Acepta 10, 600, 10080 y `" 600 "`; rechaza vacío, espacios, 0, 9, negativos, `"600.0"`, `"60,0"`, `"+600"`, `"6e2"`, `"600 min"`, 10081, no numéricos, dígitos no occidentales, ausencia | RF-4 |
| Fechas de la meta | `setAt` y `setAtWeekStart` para `today` de lunes, miércoles y domingo, y para el 1 de enero | RF-7 |
| Validez del registro | `value` y `setAtWeekStart` inválidos invalidan; la ausencia de `setAt` no | RF-38 |
| Minutos válidos | Excluye `NaN`, no numéricos, decimales, cero, negativos y ausentes, y fechas inexistentes; nunca devuelve `NaN` | RF-9 |
| Rango de semana | Las sesiones de otras semanas no cuentan; pasar `weekStart` como `today` recupera esa semana; frontera de domingo y lunes | RF-9, RF-10, RF-20 |
| Progreso | Restantes sin signo, truncado 249/600=41, 599/600=99, 600/600=100, 650/600=100, relleno igual al entero, 10080 con 20000 minutos, sin meta devuelve `null` | RF-11 a RF-17 |
| Sellado | Solo semanas posteriores a `setAtWeekStart`, nunca la semana de fijación, varias semanas en orden, sin meta no sella, reloj atrás no sella, cargar dos veces en la misma semana no duplica, abrir el lunes sella la anterior, cruce de año | RF-21, RF-22, RF-26, RF-42, RF-44, RF-45 |
| Normalización | Orden, deduplicación con desempate por `minutes`, equivalencia entre guardado en orden arbitrario e inverso, entradas inválidas, corte a 12, historial que no es lista | RF-24, RF-25, RF-37 |
| Cumplimiento de la entrada | El resultado depende solo de `entrada.met`, no de la meta vigente | RF-23 |
| Texto | La línea de historial con 0 minutos, con 1200, con 10080 y con una semana de enero; los literales de la tabla de RF-28 | RF-28, RF-34 |
| Determinismo | Ninguna función pura obtiene la fecha por su cuenta; ninguna usa `toISOString()`; dos llamadas seguidas dan resultados iguales | RFN-3, RFN-4, RF-6 |

La puerta del principio 4 se respeta de forma literal: no se pasa al siguiente bloque con `node --test`
en rojo, y los tests de `diary.test.js` y `heatmap.test.js` deben seguir en verde sin modificarlos.

## 12. Orden de ejecución

1. Crear `goal.js` con la resolución de dependencias y la exportación dual, sin lógica todavía.
2. Escribir los tests de parseo y de registro de la meta, ponerlos en rojo, implementar, ponerlos en
   verde.
3. Implementar los minutos válidos y el progreso con sus tests.
4. Implementar el historial: normalización, sellado, cumplimiento y texto, con sus tests.
5. Escribir los tests deterministas de RFN-3 y RFN-4.
6. Añadir el marcado a `index.html` en la posición correcta y el orden de carga.
7. Añadir los estilos a `styles.css`.
8. Cablear `app.js`: lectura segura, sellado al cargar, pintado, formulario de meta.
9. Ejecutar las 24 comprobaciones manuales de la spec.
10. Ejecutar `node --test` completo, revisar no regresión y actualizar `AGENTS.md` y `MEMORY.md`.

Los pasos 2 a 5 no tocan la interfaz, así que la lógica entera se valida antes de pintar nada. Los
pasos 6 a 8 tocan la vista y el cableado, y van últimos.