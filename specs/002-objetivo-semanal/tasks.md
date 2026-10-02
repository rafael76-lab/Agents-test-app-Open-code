# Tareas — Spec 002: Objetivo semanal de estudio

Derivado de `spec.md` y `plan.md`. Tareas de 20 a 30 minutos, en orden de dependencia: cada una solo
depende de las anteriores. La puerta del principio 4 de la constitución sigue en pie en cada bloque: no
se pasa al siguiente grupo con `node --test` en rojo.

Leyenda de bloques:

- **Bloque A** — Andamiaje del archivo puro y red de seguridad
- **Bloque B** — Meta: parseo, registro y validación
- **Bloque C** — Progreso de la semana actual
- **Bloque D** — Histórico de semanas
- **Bloque E** — Marcado y estilos
- **Bloque F** — Cableado, almacenamiento y cierre

Los bloques B, C y D son **tests primero**: cada tarea escribe sus tests antes de la implementación y
no se da por terminada hasta que pasan.

---

## Bloque A — Andamiaje del archivo puro y red de seguridad

- [x] **A1. Crear `goal.js` con la resolución de dependencias y la exportación dual**
  Cubre: RFN-2, RFN-5, principio 1 y 3 de la constitución, decisión T1 del plan.
  Un IIFE `GOAL_DEPS` que devuelve `{ diary, heatmap }` con `require` en Node y con los globales
  existentes en el navegador, más `const GOAL_MIN = 10`, `const GOAL_MAX = 10080`,
  `const HISTORY_LIMIT = 12`, `const GOAL_WEEKDAY_NAMES` y `const GOAL_MONTH_NAMES`. Termina con la
  guarda `if (typeof module !== "undefined") module.exports = {...}`.
  Ninguna declaración repite un nombre de `diary.js` o `heatmap.js`.
  **Hecho cuando:** `node -e "const g=require('./goal.js'); console.log(g.GOAL_MAX)"` imprime `10080`,
  y abrir `index.html` con el `<script>` todavía ausente no produce ningún error en consola.

- [x] **A2. Crear `goal.test.js` con el orden de carga del contrato**
  Cubre: RFN-5, RFN-6.
  Las tres líneas de `require` en este orden: `./diary.js`, `./heatmap.js`, `./goal.js`. Ninguna
  fecha obtenida del reloj del sistema en todo el fichero.
  **Hecho cuando:** `node --test goal.test.js` se ejecuta y termina con cero tests, sin errores, y
  `node --test` sigue en verde con `diary.test.js` y `heatmap.test.js` intactos.

- [x] **A3. Test determinista de ausencia de reloj del sistema y de `toISOString`**
  Cubre: RFN-3, RFN-4.
  Un test que lee `goal.js` como texto y falla si encuentra `toISOString`, `Date.now` o `new Date()`
  sin argumentos, replicando el criterio que ya usa `heatmap.test.js`.
  **Hecho cuando:** el test existe y pasa con el `goal.js` de A1.

- [x] **A4. Anotar la posición de las secciones antes de tocar nada**
  Cubre: alcance de la spec, RF-30.
  Una captura o nota de la posición actual de `.streak-card`, `.best-streak-card`, `.weekly-card`,
  `.monthly-card`, `.form-section`, `.heatmap-section` y `.sessions-section`.
  **Hecho cuando:** existe la nota, para poder compararla en F9.
  → Nota en `notas/A4-posicion-secciones.md`.

## Bloque B — Meta: parseo, registro y validación

- [x] **B1. Tests de `parseGoalInput`**
  Cubre: RF-3, RF-4.
  Casos: acepta 10, 600, 10080 y `" 600 "`; rechaza cadena vacía, solo espacios, 0, 9, negativos,
  `"600.0"`, `"60,0"`, `"+600"`, `"6e2"`, `"600 min"`, 10081, `null`, `undefined`, número y dígitos no
  occidentales.
  **Hecho cuando:** los tests existen y fallan, porque `parseGoalInput` todavía no está implementado.

- [x] **B2. Implementar `parseGoalInput`**
  Cubre: RF-3, RF-4.
  `String(text).trim()`, después exige `/^\d+$/`, `Number.isInteger` y el rango [10, 10080]. Devuelve
  `null` si algo falla, sin lanzar.
  **Hecho cuando:** B1 pasa y `node --test` está en verde.

- [x] **B3. Tests e implementación de `buildGoalRecord`**
  Cubre: RF-7, RF-35.
  `setAt` con `GOAL_DEPS.diary.toLocalDateString` a partir de una fecha dada y `setAtWeekStart` con
  `GOAL_DEPS.heatmap.getWeekStartMonday`. Casos: `today` de lunes, de miércoles y de domingo, y el
  1 de enero de un año no bisiesto.
  **Hecho cuando:** con `today = "2026-10-02"` devuelve `{ value, setAt: "2026-10-02",
  setAtWeekStart: "2026-09-28" }`, y el test pasa.

- [x] **B4. Tests e implementación de `isValidGoalRecord`**
  Cubre: RF-38, RFN-4.
  Rechaza `null`, array, texto, `value` decimal, no numérico, 0, 9, 10081 o ausente, y `setAtWeekStart`
  ausente o con fecha inexistente. Acepta un registro al que solo le falta `setAt`.
  **Hecho cuando:** los tests cubren los dos sentidos y pasan.

## Bloque C — Progreso de la semana actual

- [x] **C1. Tests e implementación de `getValidMinutesForWeek`**
  Cubre: RF-9, RF-10, RF-13, RF-20, D3 del plan, riesgo R2.
  `calculateWeeklyTotal(partitionSessions(sessions).valid, today)`. Tests con minutos `NaN`, no
  numéricos, decimales, cero, negativos y ausentes, y con fechas `"2025-02-30"` y `"2025-13-01"`:
  el total nunca es `NaN` ni supera al de las sesiones válidas.
  **Hecho cuando:** esos tests pasan y el total de una semana con una sesión válida y otra inválida en
  la misma fecha es solo el de la válida.

- [x] **C2. Test del rango de semana con `weekStart` como `today`**
  Cubre: RF-10, RF-9, D7.
  Verifica que pasar el `weekStart` de una semana pasada como `today` devuelve los minutos de esa
  semana y no los de la actual, y el caso de frontera de domingo a las 23:59 y lunes a las 00:00 con
  `today` desplazado un día.
  **Hecho cuando:** los dos tests pasan.

- [x] **C3. Tests e implementación de `computeProgress`**
  Cubre: RF-11 a RF-17.
  Casos: 249/600 → 41, 599/600 → 99, 600/600 → 100, 650/600 → 100; meta 10080 con 20000 minutos;
  restantes 0 y nunca negativo al superar; `goalValue` nulo devuelve `null`; relleno igual al entero
  truncado.
  **Hecho cuando:** todos los casos pasan y ningún resultado devuelve más de 100.

- [x] **C4. Tests e implementación de `composeGoalLines`**
  Cubre: RF-28, RF-29, RF-32, RFN-8.
  Los seis literales de la tabla de RF-28, incluido el encabezado "Objetivo semanal". Sin meta devuelve
  solo `status`. Con el objetivo cumplido devuelve `status` y `met`, y no `progress` ni `remaining`.
  **Hecho cuando:** los tests comparan cadenas exactas y pasan.

## Bloque D — Histórico de semanas

- [x] **D1. Tests e implementación de `normalizeHistory`**
  Cubre: RF-25, RF-37, D12, riesgo R7.
  Orden de más reciente a menos, deduplicación conservando la primera de cada `weekStart` con
  desempate por más `minutes`, corte a 12, descarte de entradas incompletas o con valores no numéricos,
  y entrada que no es una lista.
  **Hecho cuando:** existen los tests de orden, de deduplicación, de desempate, de corte a 12 y de
  entrada corrupta, y pasan.

- [x] **D2. Test de independencia del orden guardado**
  Cubre: RF-25, D12.
  Un historial guardado en orden arbitrario y el mismo guardado en orden inverso producen exactamente
  la misma lista normalizada, incluidas dos entradas con el mismo `weekStart` y distinto `minutes`.
  **Hecho cuando:** el test pasa con las dos variantes en el mismo fichero.

- [x] **D3. Tests e implementación de `buildHistoryEntry` y `isWeekEntryMet`**
  Cubre: RF-22, RF-23.
  La entrada guarda `weekStart`, minutos válidos de esa semana y `met`. El cumplimiento depende solo de
  `entry.met`, nunca de una meta vigente pasada por separado.
  **Hecho cuando:** con `metaVigente` distinta de `entry.met`, el resultado no cambia, y el test pasa.

- [x] **D4. Tests e implementación de `listWeeksToSeal`**
  Cubre: RF-21, RF-26, RF-44, D5, D15.
  Solo semanas con `weekStart` estrictamente posterior a `setAtWeekStart`; nunca la semana de la
  fijación; sin registro de meta devuelve `[]`; si la semana actual es anterior o igual a la última
  entrada devuelve `[]`.
  **Hecho cuando:** esos cuatro tests pasan, incluido el del reloj hacia atrás.

- [x] **D5. Tests e implementación de `sealWeeks`**
  Cubre: RF-21, RF-22, RF-42, RF-45, riesgo R3.
  Sella de la más antigua a la más reciente, devuelve `{ history, changed }`, y el historial devuelto
  sale normalizado. Casos: varias semanas transcurridas, cargar dos veces en la misma semana sin
  duplicar, abrir el lunes sella la anterior con la nueva en cero, cruce de año con la semana que
  contiene el 31 de diciembre sellada bajo el lunes de enero, y semana con minutos válidos e inválidos
  mezclados que guarda solo los válidos.
  **Hecho cuando:** los cinco casos pasan y `changed` es `false` cuando no hay nada que sellar.

- [x] **D6. Tests e implementación de `composeWeekEntryLine`**
  Cubre: RF-34, RFN-4.
  `"lunes, 29 de septiembre de 2025 — 650 de 600 min — cumplida"` y su variante "pendiente". Casos con
  0 minutos, con 1200 minutos, con la meta de 10080 y con una semana de enero.
  **Hecho cuando:** los tests comparan cadenas exactas, incluido el guion largo, el año y la ausencia
  de separador de millares.

- [x] **D7. Test de determinismo del archivo puro completo**
  Cubre: RFN-3, RFN-6.
  Dos llamadas seguidas con la misma entrada y el mismo `today` devuelven estructuras iguales en todas
  las funciones puras.
  **Hecho cuando:** el test pasa.

## Bloque E — Marcado y estilos

- [x] **E1. Añadir la tarjeta de objetivo en `index.html` y el orden de carga de los scripts**
  Cubre: RF-2, RF-30, RF-31, RF-34, RFN-5, RFN-7, RFN-8.
  Sección `.goal-card` inmediatamente después de `.weekly-card`, con el encabezado, la línea de estado,
  el formulario oculto por defecto, la barra con `role="progressbar"`, las tres líneas de progreso
  ocultas, el aviso y la lista del historial. Añadir `<script src="goal.js"></script>` entre
  `heatmap.js` y `app.js`.
  **Hecho cuando:** la tarjeta aparece en la posición correcta, la página no muestra errores en
  consola y el mapa de calor y el historial de sesiones siguen en su sitio.

- [x] **E2. Estilos de la tarjeta y de la barra en `styles.css`**
  Cubre: RF-13, RF-28, RF-31, RFN-7, RFN-9.
  `.goal-bar` con relleno proporcional al entero de `aria-valuenow`, equivalentes en
  `prefers-color-scheme: dark`, y estilos bajo `forced-colors: active` en los que la barra sigue siendo
  legible sin depender del color de relleno.
  **Hecho cuando:** la barra se ve con relleno proporcional al porcentaje y es legible en modo claro y
  en modo oscuro.

- [x] **E3. Estilos de la línea de error y del historial**
  Cubre: RF-3, RFN-8, RF-34.
  La línea de error con `role="alert"` visible en claro y en oscuro, y la lista del historial con el
  mismo tratamiento tipográfico.
  **Hecho cuando:** el mensaje de error se lee con contraste suficiente en los dos modos.

## Bloque F — Cableado, almacenamiento y cierre

- [x] **F1. Lectura y escritura seguras de las dos claves nuevas en `app.js`**
  Cubre: RF-35, RF-36, RF-37, RF-38, RF-39, RF-40, RF-41, H9, riesgos R1, R4, R5.
  `GOAL_KEY = 'study-diary-goal'` y `WEEKS_KEY = 'study-diary-weeks'`. Lectura y escritura en
  `try`/`catch`, con la bandera `storageAvailable` ya existente. Ninguna función escribe ni borra
  `study-diary-sessions`. `isValidGoalRecord` decide si hay meta; si no la hay pero había dato, se
  muestra el aviso de RF-38.
  **Hecho cuando:** con el almacenamiento deshabilitado la aplicación carga sin errores y sin aviso de
  meta corrupta, y con la meta corrupta aparece el aviso y vuelve el formulario.

- [x] **F2. Secuencia de sellado al cargar la página**
  Cubre: RF-21, RF-22, RF-26, RF-39, RF-40, RF-42, RF-43, RF-44, RF-45, plan §6.1, riesgo R3.
  El orden exacto del plan: leer meta, validar, leer historial, normalizar, sellar, escribir solo si
  `changed`, y después pintar. La escritura persiste el historial ya normalizado.
  **Hecho cuando:** en la misma carga en que se sella, el historial sale visible y guardado; con la
  semana actual igual a la última entrada no se sella nada; y con el reloj atrasado tampoco.

- [x] **F3. `renderGoalCard` pinta estado, barra, líneas e historial**
  Cubre: RF-1, RF-16, RF-17, RF-22, RF-27, RF-28, RF-29, RF-31, RF-32, RF-33, RF-34, RFN-8.
  Llama a `composeGoalLines` y `composeWeekEntryLine`. Escribe `aria-valuenow` con el entero truncado y
  `aria-valuetext` con el total real. Con el objetivo cumplido pinta la barra al 100 % y no añade
  ningún otro mensaje.
  **Hecho cuando:** los tres estados de la tarjeta se ven correctos y los literales coinciden con la
  tabla de RF-28.

- [x] **F4. Manejador del formulario de meta**
  Cubre: RF-2, RF-3, RF-4, RF-5, RF-7, RF-8, RFN-8.
  Valida con `parseGoalInput`. Si falla, muestra el mensaje de error, no guarda nada y deja el campo con
  exactamente lo que el usuario había escrito. Si pasa, guarda con `buildGoalRecord`, retira el
  formulario y vuelve a pintar. Si la escritura falla, no muestra estado con meta ni aviso y conserva el
  formulario con el valor escrito.
  **Hecho cuando:** con el almacenamiento bloqueado en escritura, enviar una meta válida deja el
  formulario visible con lo escrito y sin aviso; y con una meta ya fijada el formulario no vuelve a
  aparecer.

- [x] **F5. Recálculo del progreso al registrar una sesión**
  Cubre: RF-18, RF-19, RF-20, RF-27, RF-43.
  El manejador existente de sesiones llama a `renderGoalCard` con el `TODAY` congelado. No sella nada.
  **Hecho cuando:** registrar una sesión de esta semana actualiza el progreso sin recargar, una sesión
  de otra semana no lo cambia, y una sesión retroactiva no altera una semana ya sellada.

- [x] **F6. Comprobaciones manuales de la tarjeta**
  Cubre: RF-8, RF-30, RF-32, RF-33, RFN-7, RFN-8, RFN-9.
  Demo del flujo principal; posición de la tarjeta bajo "minutos esta semana" con el historial dentro;
  lector de pantalla anunciando la barra, el texto y el mensaje de error; 375 px sin desplazamiento
  horizontal; legible en claro, oscuro y con escala de grises; consola sin errores; la meta sobrevive
  a recargar y a reabrir el navegador; el objetivo solo aparece en su tarjeta; sin objetivo la aplicación
  sigue registrando sesiones; los literales coinciden con RF-28 y RF-34; el historial sale en la misma
  carga en que se sella; abrir el lunes muestra la semana anterior sellada y la nueva en cero; la semana
  en la que se fijó la meta no aparece en el historial y la siguiente sí; borrar los datos del
  navegador devuelve al estado sin objetivo, sin historial y sin aviso.
  **Hecho cuando:** los catorce puntos están comprobados y anotados.

- [x] **F7. Comprobaciones manuales de almacenamiento**
  Cubre: RF-35, RF-36, RF-37, RF-38, RF-39, RF-40, RF-41, RFN-5, riesgos R1, R10.
  Con inspector de almacenamiento: las tres claves —sesiones, meta e historial— son distintas entre
  sí y el registro de la meta contiene `value`, `setAt` y `setAtWeekStart`. Con más de 12 semanas
  selladas, solo quedan las 12 más recientes en orden y el resultado queda guardado normalizado. Con
  contenido de sesiones conocido, usar el objetivo deja la clave de sesiones idéntica byte a byte.
  Verificar que el fichero de tests carga `diary.js`, `heatmap.js` y `goal.js` en ese orden, y que
  `index.html` abierto con doble clic funciona.
  **Hecho cuando:** los seis puntos están comprobados y anotados.

- [x] **F8. Ejecución completa de `node --test`**
  Cubre: principio 4 de la constitución y los 33 tests de la spec.
  **Hecho cuando:** `node --test` está en verde, cubre los 33 tests de la spec, y
  `diary.test.js` y `heatmap.test.js` siguen en verde sin haberlos modificado.

- [x] **F9. Revisión de no regresión**
  Cubre: alcance de la spec, RF-30, RFN-12, plan A4.
  Comparar contra la nota de A4. Racha, mejor racha, minutos semanales, días del mes, formulario de
  sesiones, mapa de calor —incluida su escala de color, su línea de detalle, sus avisos y su navegación
  por teclado— y las tres claves de almacenamiento.
  **Hecho cuando:** cada sección está en su sitio anterior y se comporta igual con las mismas sesiones.
  → `notas/F9-no-regresion.md`, 12 PASS / 0 FAIL.

- [x] **F10. Revisión posterior no bloqueante**
  Cubre: revisión posterior de la spec.
  Con al menos 12 semanas de historial real, comprobar si las 12 entradas más recientes bastan.
  **Hecho cuando:** está anotado el resultado. No bloquea la entrega.
  → `notas/F10-revision-posterior.md`, queda PENDIENTE y no simulada.

- [x] **F11. Actualizar `AGENTS.md` y `MEMORY.md`**
  Cubre: principio 2 de la constitución, continuidad entre sesiones.
  Documentar `goal.js` sin DOM y sin almacenamiento, las dos claves nuevas, el orden de carga, el
  criterio de "minutos válidos" y la prohibición de `toISOString`.
  **Hecho cuando:** `AGENTS.md` permite entender la lógica del objetivo sin leer esta conversación, y
  `MEMORY.md` resume el estado por debajo de 50 líneas.