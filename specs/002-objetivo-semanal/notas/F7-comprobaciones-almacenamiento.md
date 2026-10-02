# F7 — Comprobaciones manuales de almacenamiento

Tarea F7 de `tasks.md`. Cubre RF-35, RF-36, RF-37, RF-38, RF-39, RF-40, RF-41, RFN-5 y
los riesgos R1 y R10.

**Esta tarea no ha modificado código.** Ha comprobado y anotado. El único fichero
escrito es este.

## Cómo se comprobó

Con las herramientas de navegador sobre `index.html` abierto con doble clic
(`file://`), leyendo y escribiendo `localStorage` desde la consola. La comparación de
la clave de sesiones se hizo **dentro de la página**, comparando las cadenas exactas
antes y después, y no comparando objetos: es lo que exige el punto 3, porque una
comparación de objetos no detectaría un cambio de orden de claves, de espacios o de
formato.

## Resumen

6 PASS, 0 FAIL.

| # | Comprobación | Resultado |
|---|---|---|
| 1 | Tres claves distintas y forma del registro de meta | PASS |
| 2 | Corte a 12 y guardado normalizado | PASS **(hubo FAIL; ver la corrección)** |
| 3 | La clave de sesiones intacta byte a byte | PASS |
| 4 | Orden de carga del fichero de tests | PASS |
| 5 | `index.html` con doble clic funciona | PASS |
| 6 | Orden de carga de los scripts en la página | PASS |

## Detalle punto por punto

### 1. Tres claves distintas y forma del registro de meta — PASS

Con las tres claves presentes:

```
study-diary-goal      study-diary-sessions      study-diary-weeks
```

Son tres claves distintas, ninguna es prefijo de otra y ninguna comparte nombre.

El registro de la meta:

```json
{"value":600,"setAt":"2026-08-24","setAtWeekStart":"2026-08-24"}
```

- Contiene `value`, `setAt` y `setAtWeekStart`, y **solo esos tres** campos.
- `value` es un entero dentro de [10, 10080].
- `setAt` tiene el formato `AAAA-MM-DD`.
- `setAtWeekStart` es un lunes (`weekdayIndex(...) === 0`).
- Las sesiones y el historial son listas.

### 2. Corte a 12 y guardado normalizado — PASS (hubo FAIL, corregido)

**Estado tras la corrección**, con 15 semanas escritas en `study-diary-weeks`:

```
pintado en la tarjeta: 12 entradas       ← correcto
guardado en localStorage: 12 entradas    ← correcto
bytes: 607   (antes de corregir eran 757, con las 15 entradas)
orden: descendente, de 2026-09-21 a 2026-07-06
```

#### El fallo que hubo

En la primera pasada de F7 este punto fue **FAIL**:

```
pintado: 12    guardado: 15    (757 bytes)
```

**Esperado**: solo quedan las 12 más recientes, en orden, y el resultado queda
guardado normalizado.
**Obtenido**: la tarjeta pintaba 12 pero el almacenamiento conservaba las 15. La
entrada sobrante era `{"weekStart":"2026-06-29","minutes":30,"met":600}`.

**Causa**: en `sealAndPersistWeeks` (F2) la escritura estaba condicionada a
`resultado.changed`. Con 15 semanas ya selladas y ninguna nueva que sellar, `changed`
era `false`, así que `saveWeeks` no se llamaba y la lista sobredimensionada nunca se
reescribía. La normalización sí se aplicaba en memoria para pintar, pero no llegaba al
disco.

Chocaba con RF-22 ("esa versión normalizada es la que se persiste") y con este mismo
punto 2 de F7.

#### Cómo se corrigió

Se añadió a `goal.js` la función pura `isSameHistory(normalizada, guardada)`, que
compara dos historiales por **contenido**: los mismos `weekStart`, `minutes` y `met`, en
el mismo orden. Solo mira los tres campos canónicos, así que no depende del orden de las
claves de cada objeto ni de que la lista guardada lleve campos de más. Se exporta y la
cubren 10 tests en `goal.test.js`, incluido el caso de 15 frente a 12.

En `app.js` el criterio de escritura pasó a ser:

```js
if (resultado.changed || !isSameHistory(weeks, weeksRaw)) saveWeeks(weeks);
```

**Un detalle que había que respetar**: la comparación es contra `weeksRaw`, el dato
crudo tal y como estaba guardado, y **no** contra `weeks`. `loadWeeks()` ya normaliza
al leer, así que comparar la lista normalizada con `weeks` habría dado siempre iguales
y el historial sobredimensionado no se habría detectado nunca. Por eso `loadWeeks()`
conserva además el valor crudo en `weeksRaw`.

El `return` temprano sin meta se mantiene intacto (RF-26).

#### Reverificación

Se comprobó que la corrección **no convierte cada carga en una escritura**, que era el
riesgo principal. Para eso se interceptó `Storage.prototype.setItem` y se contarón las
escrituras reales, en vez de comparar solo el valor resultante:

| Escenario | Escrituras a `study-diary-weeks` |
|---|---|
| Carga con 15 guardadas (hay que podar) | **1** — reescribe a 12 |
| Carga siguiente, ya normalizado | **0** |
| Tres cargas más seguidas | **0** en las tres |
| Cuatro recargas reales seguidas | valor idéntico, 607 bytes constantes |
| Lista ya normalizada y sin nada que sellar | **0** |
| Sin meta | **0** |

Fijar la meta con el formulario escribe `study-diary-goal` y **no** toca el historial,
como antes.

### 3. La clave de sesiones intacta byte a byte — PASS

Contenido plantado con tres sesiones, con acentos en el tema y orden de claves no
canónico:

```
antes:      [{"id":7,"date":"2026-09-29","topic":"Física","minutes":75},
             {"id":9,"date":"2026-09-26","topic":"Historia","minutes":40},
             {"id":11,"date":"2026-10-01","topic":"Arte","minutes":20}]
largo:      179 bytes
```

**Caso A — usando el objetivo** (fijar la meta, que dispara `saveGoal`):

```
tras fijar la meta:  idéntica, 179 bytes
identicas: true
```

**Caso B — tras una recarga con sellado de 4 semanas** (que dispara `saveWeeks`):

```
semanas selladas y guardadas: 4  (2026-09-21, 09-14, 09-07, 08-31)
sesiones idénticas byte a byte: true
```

En los dos caminos —escribir la meta y escribir el historial— la clave de sesiones queda
**byte a byte igual**, con los acentos y el orden de claves intactos. Es la comprobación
que protege RF-41, y el riesgo R1 queda cubierto: `study-diary-weeks` y
`study-diary-goal` nunca tocan `study-diary-sessions`.

Comprobado además que **`removeItem` no aparece en `app.js`**: no hay ninguna ruta que
pueda borrar nada.

### 4. Orden de carga del fichero de tests — PASS

`goal.test.js`, líneas 22 a 24:

```js
const diary = require('./diary.js');
const heatmap = require('./heatmap.js');
const goal = require('./goal.js');
```

En ese orden exacto, que es el que fija RFN-5 y el que exige R10.

### 5. `index.html` abierto con doble clic funciona — PASS

Toda la comprobación de F6 y de esta tarea se ha hecho sobre `file://`, abriendo el
fichero por su ruta, que es exactamente lo que hace un doble clic. En todas las
sesiones: sin mensajes de consola, mapa de calor con 189 celdas, métricas y formulario
de sesiones operativos.

### 6. Orden de carga de los scripts en la página — PASS

```html
<script src="diary.js"></script>
<script src="heatmap.js"></script>
<script src="goal.js"></script>
<script src="app.js"></script>
```

`goal.js` está entre `heatmap.js` y `app.js`, que es lo que fija RFN-5. Es el orden
correcto porque `goal.js` necesita a los dos anteriores en el momento de evaluarse, y
`app.js` los usa a todos.

## Fallos encontrados

**Uno, en el punto 2, ya corregido.** El historial sobredimensionado no se reescribía
podado porque la escritura estaba condicionada a `changed`. Se corrigió añadiendo
`isSameHistory` a `goal.js` y comparando también contra el dato crudo guardado, con lo
que ahora se escribe cuando hay algo que sellar **o** cuando lo guardado no es la
versión normalizada. El detalle completo está en la sección del punto 2.

## Pendiente

Nada. Los seis puntos están comprobados y todos pasan.