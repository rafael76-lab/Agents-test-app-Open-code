/**
 * Lógica pura del objetivo semanal de estudio.
 *
 * Principios que respeta este archivo:
 * - No toca el DOM ni el almacenamiento local.
 * - No llama al reloj del sistema: `today` entra siempre como parámetro.
 * - Consume `diary.js` y `heatmap.js`, que no se modifican.
 *
 * Se carga con `<script>` en el navegador y con `require()` en los tests.
 */

/**
 * Decisión T1 del plan: las dependencias se resuelven una sola vez en un objeto
 * con espacio de nombres propio, en vez de declarar identificadores sueltos.
 *
 * En Node, `require('./diary.js')` no crea globales, así que el archivo tiene que
 * resolver lo suyo. En el navegador los dos scripts clásicos ya son globales. La
 * alternativa de declarar `const calculateWeeklyTotal = ...` en este archivo para
 * igualar ambas rutas redeclararía un nombre global existente en el navegador y el
 * `SyntaxError` impediría cargar la página entera.
 *
 * Regla dura que se deduce: ningún `const`, `let`, `class` ni declaración de este
 * archivo repite un nombre ya declarado en `diary.js`, `heatmap.js` o `app.js`. Por
 * eso las constantes y las tablas llevan prefijo `GOAL_`.
 */
const GOAL_DEPS = (function () {
  if (typeof module !== 'undefined' && module.exports) {
    return {
      diary: require('./diary.js'),
      heatmap: require('./heatmap.js')
    };
  }

  return {
    diary: {
      calculateWeeklyTotal,
      toLocalDateString,
      localDateFromKey
    },
    heatmap: {
      partitionSessions,
      getWeekStartMonday,
      isValidMinutes,
      isValidDateKey,
      weekdayIndex,
      addDays,
      // La usa `composeWeekEntryLine` para leer el día y el mes del lunes de una
      // entrada. Se declara aquí porque en Node el `require` ya la traía y solo
      // faltaba en la rama del navegador, donde este objeto se escribe a mano.
      localDateFromKey
    }
  };
})();

/** Meta mínima en minutos: 10 minutos (RF-4). */
const GOAL_MIN = 10;

/** Meta máxima en minutos: 10080, es decir, siete días completos (RF-4). */
const GOAL_MAX = 10080;

/** Nº máximo de semanas selladas que se conservan en el historial (RF-25). */
const HISTORY_LIMIT = 12;

/**
 * Tablas de nombres en español, literales y no `Intl`.
 *
 * Decisión T2 del plan: se duplican aquí con prefijo `GOAL_` en vez de
 * reutilizar `WEEKDAY_NAMES` y `MONTH_NAMES` de `heatmap.js`. Reutilizarlas
 * funciona en el navegador, donde son globales, pero `heatmap.js` no las exporta,
 * así que `goal.test.js` no podría comprobarlas; y exportarlas exigiría tocar un
 * archivo que la sección *Alcance* de la spec prohíbe modificar.
 */
const GOAL_WEEKDAY_NAMES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo'
];

const GOAL_MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre'
];

/**
 * Única forma admitida de escribir la meta: una o más cifras y nada más.
 *
 * Sin la bandera `u`, `\d` ya se limita a los dígitos ASCII 0-9, así que esta
 * expresión rechaza por sí sola "600.0", "60,0", "+600", "6e2", "600 min" y
 * cualquier representación con dígitos no occidentales, como "６００" o "٦٠٠".
 * Es también lo que rechaza las marcas de orden de cifra Unicode: el carácter es
 * invisible pero el resultado sigue sin ser solo cifras.
 *
 * Constante con prefijo `GOAL_` por la regla de nombres de este archivo.
 */
const GOAL_SOLO_DIGITOS = /^\d+$/;

/**
 * Interpreta el texto escrito en el formulario de meta y devuelve los minutos
 * de la meta, o `null` si el texto no cumple la regla de RF-4.
 *
 * RF-4 fija el orden de las comprobaciones y no admite atajos: primero se
 * eliminan los espacios periféricos y después se exige que el resultado sea un
 * entero escrito sin separador dentro de [GOAL_MIN, GOAL_MAX].
 *
 * Sobre el tipo de entrada: el formulario aporta siempre una cadena (RF-4 habla
 * de "el texto escrito"), así que `String()` solo normaliza lo que llegue de
 * otra ruta. Un entero numérico se convierte a cadena y se acepta si cae en
 * rango, porque representa el mismo valor que el usuario habría escrito. Lo que
 * no se acepta es el número que no es un entero escrito con cifras: `600.5`,
 * `NaN` e `Infinity` quedan fuera en cuanto su forma escrita falla `GOAL_SOLO_DIGITOS`.
 *
 * La función no lanza en ningún caso, ni siquiera con valores exóticos. El
 * `try`/`catch` no protege solo de `String()`: un objeto con `toString` o
 * `valueOf` que lance fallaría antes de llegar al patrón, y RF-3 exige que un
 * valor inválido produzca un mensaje de error, nunca una excepción sin capturar.
 *
 * @param {*} text Texto escrito en el campo de meta.
 * @returns {number|null} Minutos de la meta, o `null` si el texto no es válido.
 */
function parseGoalInput(text) {
  try {
    const limpio = String(text).trim();
    if (!GOAL_SOLO_DIGITOS.test(limpio)) return null;

    const minutos = Number(limpio);
    if (!Number.isInteger(minutos)) return null;
    if (minutos < GOAL_MIN || minutos > GOAL_MAX) return null;

    return minutos;
  } catch (error) {
    return null;
  }
}

/**
 * Construye el registro de meta semanal que RF-35 persiste.
 *
 * RF-7 exige dos fechas: el día local en que se fijó la meta y el lunes de esa
 * semana. Las dos se calculan con funciones que ya existen, sin reimplementar
 * ninguna regla de fecha:
 *
 * - `setAt` sale de `toLocalDateString(localDateFromKey(today))`. La clave
 *   `today` es una cadena, y `toLocalDateString` espera un `Date`, así que el
 *   paso intermedio es inevitable; `localDateFromKey` construye la fecha a
 *   mediodía, que es lo que impide que un huso de offset negativo desplace el
 *   día (RFN-4). Sin ese intermedio, `toISOString()` habría corrido ese mismo
 *   bug de huso.
 * - `setAtWeekStart` sale de `getWeekStartMonday(today)`, que ya recibe una
 *   clave y ya aplica la conversión de `weekdayIndex` que hace que el domingo
 *   dé el lunes anterior y no el mismo domingo.
 *
 * `value` se copia tal cual. Validarlo es cosa de `parseGoalInput`, que decide
 * qué se acepta antes de llegar aquí; esta función no vuelve a decidir, y así
 * el registro que se guarda es exactamente el entero que el usuario confirmó.
 *
 * No usa el reloj del sistema (RFN-3): `today` entra siempre como parámetro.
 * `setAt` es trazabilidad, y RF-35 admite que falte sin invalidar el registro;
 * por eso `isValidGoalRecord` no lo exige. Aquí siempre está, porque con un
 * `today` válido no hay motivo para omitirlo.
 *
 * @param {number} value Meta semanal en minutos, ya validada.
 * @param {string} today Clave del día local en que se fija la meta.
 * @returns {{value: number, setAt: string, setAtWeekStart: string}}
 */
function buildGoalRecord(value, today) {
  return {
    value,
    setAt: GOAL_DEPS.diary.toLocalDateString(GOAL_DEPS.diary.localDateFromKey(today)),
    setAtWeekStart: GOAL_DEPS.heatmap.getWeekStartMonday(today)
  };
}

/**
 * Decide si el registro de meta leído del almacenamiento sirve (RF-38).
 *
 * Es la frontera entre lo que el usuario confirmó en su momento y lo que llega
 * hoy desde `localStorage`, que es texto JSON controlado por cualquier versión
 * anterior o posterior del archivo. Por eso es más defensiva que
 * `parseGoalInput`, que solo ve lo que el usuario escribe ahora mismo.
 *
 * Dos campos obligatorios, y ninguno más:
 *
 * - `value` entero dentro de [GOAL_MIN, GOAL_MAX]. El rango se toma de las
 *   mismas constantes que usa `parseGoalInput`, para que el número que se
 *   acepta al escribir y el que se acepta al releer no puedan divergir.
 * - `setAtWeekStart` que sea una fecha local existente. La comprobación no se
 *   reimplementa: se delega en `isValidDateKey` de `heatmap.js` a través de
 *   `GOAL_DEPS`, que ya aplica el formato `AAAA-MM-DD` y el calendario real,
 *   incluido el 29 de febrero (RFN-4, RFN-5).
 *
 * `setAt` no se mira. RF-38 dice explícitamente que su ausencia o su malformo
 * no invalidan el registro, porque de ese campo no depende ningún cálculo: es
 * trazabilidad. De los dos, solo `setAtWeekStart` manda, porque es el que usa el
 * sellado de semanas (D4). Ignorarlo del todo, y no "validarlo si está
 * presente", es lo que hace que un registro válido no se pierda por un campo que
 * nadie lee.
 *
 * Los campos extra no invalidan nada. RF-38 exige que existan los tres, no que
 * sean los únicos, así que un registro guardado por otra versión del archivo
 * sigue siendo utilizable en vez de obligar al usuario a fijar la meta otra vez.
 *
 * El orden de las comprobaciones va de lo barato a lo caro y de lo más probable
 * a lo menos, pero ninguna decisión depende de él.
 *
 * @param {*} record Registro leído del almacenamiento, sin confirmar.
 * @returns {boolean} `true` si hay una meta válida guardada.
 */
function isValidGoalRecord(record) {
  if (record === null || typeof record !== 'object') return false;

  // Un array es `typeof "object"` y no tiene ningún campo con el nombre
  // esperado, así que cae por la regla del campo. No hace falta —ni conviene—
  // una comprobación de array explícita.
  if (!Number.isInteger(record.value)) return false;
  if (record.value < GOAL_MIN || record.value > GOAL_MAX) return false;

  return GOAL_DEPS.heatmap.isValidDateKey(record.setAtWeekStart);
}

/**
 * Minutos válidos de estudio de una semana (RF-9, RF-10).
 *
 * El orden de las dos operaciones es el contenido de la función, no un detalle
 * (decisión T4 del plan):
 *
 * 1. `partitionSessions` decide qué sesiones son válidas, con la misma
 *    definición de fecha real y de minutos enteros que usa el mapa de calor. Filtra
 *    ANTES de que ninguna suma ocurra.
 * 2. `calculateWeeklyTotal` suma las que han pasado, aplicando el rango
 *    lunes-domingo con `getWeekRange`.
 *
 * El filtro tiene que ir primero porque `calculateWeeklyTotal` de `diary.js` solo
 * comprueba el rango de fechas y después suma `s.minutes` a ciegas: con minutos
 * no numéricos devuelve `NaN` y con negativos resta de verdad (riesgo R2).
 * Arreglar esa función está fuera de alcance —cambiaría también la tarjeta de
 * "minutos esta semana" y la racha, y pertenece a otra spec—, así que el
 * objetivo no hereda su comportamiento filtrando antes (decisión D3).
 *
 * La consecuencia asumida de esa decisión, declarada en el plan, es que con
 * datos corruptos la tarjeta de "minutos esta semana" y el objetivo pueden
 * mostrar números distintos. Es deliberado: el objetivo prefiere descartar la
 * sesión que mostrar un `NaN` en una barra de progreso.
 *
 * Dos detalles sobre el alcance de esta función:
 *
 * - `today` decide qué semana se cuenta, y por eso una semana cerrada se le pasa
 *   con su propio `weekStart` como `today`, según fija RF-10. Aquí no hay ningún
 *   caso especial para semanas pasadas: es la misma suma sobre otro rango.
 * - No se filtra por `setAt` de la meta. RF-20 cuenta para el progreso todos los
 *   minutos válidos de la semana, incluidas las sesiones anteriores a fijar la
 *   meta, porque el objetivo se mide contra la semana completa. Por eso esta
 *   función ni siquiera recibe el registro de meta: no tiene nada que filtrar con
 *   él, y aceptarlo sería invitar a usarlo mal en C3.
 *
 * Las sesiones no se modifican ni se reordenan. `partitionSessions` construye
 * una lista nueva y `calculateWeeklyTotal` filtra sin mutar, así que quien llama
 * conserva su array intacto (RFN-12, RF-41).
 *
 * @param {Array<{date: *, minutes: *}>} sessions Sesiones guardadas, sin filtrar.
 * @param {string} today Clave de un día de la semana que se quiere contar.
 * @returns {number} Suma de los minutos válidos de esa semana, cero si no hay.
 */
function getValidMinutesForWeek(sessions, today) {
  const validas = GOAL_DEPS.heatmap.partitionSessions(sessions).valid;
  return GOAL_DEPS.diary.calculateWeeklyTotal(validas, today);
}

/**
 * Estado del progreso de la semana actual frente a la meta (RF-11 a RF-17).
 *
 * Devuelve `{ remaining, percent, met }`, o `null` si no hay meta. Los tres campos
 * son exactamente los que necesitan las dos cosas que los consumen: C4 para
 * compose los textos visibles y F3 para pintar la barra y sus atributos. No hay un
 * cuarto campo porque no hay un cuarto dato que pintar:
 *
 * - `remaining`: minutos que faltan, sin signo. Es la diferencia entre la meta y
 *   los minutos llevados, en cero cuando la diferencia es negativa o nula, así
 *   que al superar la meta es 0 y nunca un número negativo (RF-11).
 * - `percent`: la proporción de RF-12, un entero dentro de [0, 100]. Es también
 *   el relleno de la barra, porque RF-13 exige que ambos sean el mismo entero y
 *   no el cociente exacto: no hay campo aparte para el relleno, hay una sola
 *   cifra que los dos usan (RFN-8).
 * - `met`: si los minutos llevados son mayores o iguales que la meta (RF-14).
 *
 * Sin meta devuelve `null` y no un objeto con ceros (RF-17). La diferencia es que
 * un objeto con ceros se parece a una semana sin progreso con objetivo fijado, y
 * F3 lo pintaría como una barra en cero. Con `null` no hay nada que pintar.
 *
 * El truncado hacia abajo es lo que fija RF-12 y lo que separan 249/600 de 42: un
 * redondeo prometería más progreso del que hay. El tope de 100 se aplica después
 * del truncado, así que 650/600 da 100 y no 331, y los minutos restantes siguen
 * siendo los reales para el texto de RF-16: el tope afecta solo a la proporción.
 *
 * No recibe fechas ni consulta el reloj (RFN-3): solo los minutos ya sumados por
 * `getValidMinutesForWeek` y el valor de la meta. `minutes` viene de una suma que
 * solo suma enteros válidos, pero un total ausente se trata como cero en lugar de
 * propagar un `NaN` a la barra.
 *
 * @param {number} minutes Minutos válidos de la semana actual.
 * @param {number|null} goalValue Meta semanal en minutos, o `null` si no hay meta.
 * @returns {{remaining: number, percent: number, met: boolean}|null}
 */
function computeProgress(minutes, goalValue) {
  if (goalValue === null || goalValue === undefined) return null;

  const llevados = Number.isFinite(minutes) ? minutes : 0;
  const restante = Math.max(0, goalValue - llevados);

  // Truncado hacia abajo, y después el tope de 100. Sin el `Math.min`, una
  // semana de 20000 minutos sobre una meta de 10080 daría 198.
  const proporcion = Math.min(100, Math.max(0, Math.floor((llevados / goalValue) * 100)));

  return {
    remaining: restante,
    percent: proporcion,
    met: llevados >= goalValue
  };
}

/**
 * Encabezado visible de la tarjeta de objetivo, siempre el mismo (RF-28).
 *
 * Va aquí y no en el texto de `status` porque es un elemento distinto de la
 * tabla de RF-28: el encabezado no depende de si hay meta, mientras que la línea
 * de estado sí. Si fuera una cadena dentro de `composeGoalLines`, F3 tendría que
 * adivinar de dónde sacarlo, y el título de la tarjeta acabaría en `index.html`
 * con un criterio distinto del de los demás textos.
 */
const GOAL_CARD_TITLE = 'Objetivo semanal';

/**
 * Encabezado de la línea de estado con meta (RF-28).
 * "Objetivo semanal: 600 min". El nombre del objetivo va una sola vez, en el
 * encabezado de la tarjeta; aquí solo lo acompaña el valor.
 */
const GOAL_STATUS_PREFIX = 'Objetivo semanal: ';

/**
 * Sufijo de "sin fijar" en la línea de estado sin meta (RF-28).
 * Sin espacio inicial: `GOAL_STATUS_PREFIX` ya lo trae, y un segundo espacio
 * produciría "Objetivo semanal:  sin fijar", que no es el literal de RF-28.
 */
const GOAL_STATUS_SIN_FIJAR = 'sin fijar';

/**
 * Composiciones de las líneas de progreso (RF-28).
 *
 * Los minutos van como enteros pelados: sin `toLocaleString` y sin separador de
 * millares, igual que en RF-34. Interpolarlos con `${}` los deja como el entero
 * que ya son, y evita que un formato regional los convierta en "1.500".
 */
const GOAL_STATUS_SUFIJO = ' min';
const GOAL_PROGRESO_ETIQUETA = 'Esta semana: ';
const GOAL_PROGRESO_ENTRE = ' de ';
const GOAL_PROGRESO_PORCENTAJE = '%)';
const GOAL_RESTANTES_ETIQUETA = 'Quedan ';
const GOAL_CUMPLIDA_ETIQUETA = '¡Objetivo cumplido! ';

/**
 * Una única fuente para los textos de la tarjeta de objetivo (RF-28, RF-29,
 * RF-32, RFN-8).
 *
 * Devuelve las líneas de la tarjeta ya escritas, y F3 se limita a poner cada
 * cadena en su elemento. Que el texto se componga una sola vez es lo que impide
 * que lo que ve la vista y lo que anuncia el lector de pantalla diverjan, igual
 * que `composeCellText` en el mapa de calor.
 *
 * Qué clave sale en cada caso, según la tabla de RF-28:
 *
 * - Sin meta: solo `status`, con "Objetivo semanal: sin fijar". No hay progreso,
 *   ni restantes, ni cumplimiento, ni `aria-valuetext`, porque no hay barra que
 *   anunciar (RF-17).
 * - Con meta pendiente: `status`, `progress` y `remaining`. El porcentaje del
 *   texto es el entero truncado de RF-12, el mismo que usa el relleno de la barra,
 *   así que el texto nunca promete más progreso del que la barra muestra (RF-13).
 * - Con meta cumplida: `status` y `met`. Sin `progress` ni `remaining`: RF-29 pide
 *   que con el objetivo cumplido no se muestre ni el porcentaje ni los restantes,
 *   y RF-32 que no se añada ningún mensaje más.
 *
 * Las claves que no aplican **no se incluyen** en el objeto, en vez de venir con
 * cadena vacía. Es lo que permite a F3 decidir si pinta una línea mirando si su
 * clave existe, sin tener que comprobar además que la cadena no está vacía. Un
 * `progress: ''` sería indistinguible de un texto que se compuso y resultó vacío.
 *
 * `state.progress` es lo que devuelve `computeProgress` para la semana actual, y
 * `state.minutes` el total real. Los minutos no se recalculan aquí: quien compone
 * los textos no vuelve a sumar nada, y el total que aparece es siempre el que dio
 * `getValidMinutesForWeek`, con sus minutos válidos y solo ellos.
 *
 * No recibe ni deriva ninguna fecha. No hay `today` en la firma porque ninguno de
 * los seis literales contiene un día (RFN-3).
 *
 * @param {{hasGoal: boolean, goalValue: number|null, minutes: number,
 *          progress: {remaining: number, percent: number, met: boolean}|null}} state
 * @returns {{status: string, progress?: string, remaining?: string, met?: string,
 *            valueText?: string}}
 */
function composeGoalLines(state) {
  if (!state.hasGoal) {
    return { status: GOAL_STATUS_PREFIX + GOAL_STATUS_SIN_FIJAR };
  }

  const meta = state.goalValue;
  const minutos = state.minutes;
  const progreso = state.progress;

  const lineas = {
    status: GOAL_STATUS_PREFIX + meta + GOAL_STATUS_SUFIJO,
    // El valor accesible lleva el total real y la meta, en el mismo orden que el
    // texto visible (RFN-8).
    valueText: minutos + GOAL_PROGRESO_ENTRE + meta + GOAL_STATUS_SUFIJO
  };

  if (progreso.met) {
    // El total real, nunca la meta en su lugar (RF-16, RF-32).
    lineas.met = GOAL_CUMPLIDA_ETIQUETA + minutos + GOAL_PROGRESO_ENTRE + meta + GOAL_STATUS_SUFIJO;
    return lineas;
  }

  lineas.progress =
    GOAL_PROGRESO_ETIQUETA +
    minutos +
    GOAL_PROGRESO_ENTRE +
    meta +
    GOAL_STATUS_SUFIJO +
    ' (' +
    progreso.percent +
    GOAL_PROGRESO_PORCENTAJE;

  lineas.remaining = GOAL_RESTANTES_ETIQUETA + progreso.remaining + GOAL_STATUS_SUFIJO;

  return lineas;
}

/**
 * Normaliza el historial de semanas guardado (RF-25, RF-37).
 *
 * Es la frontera con `localStorage`: lo que sale de aquí es exactamente lo que se
 * persiste, se pinta y se usa para sellar. Por eso devuelve una lista nueva de
 * entradas nuevas y no toca la que recibe.
 *
 * Las reglas de RF-25, en el orden en que se aplican:
 *
 * 1. Descartar lo no interpretable. `weekStart` se valida con `isValidDateKey` de
 *    `heatmap.js`, que ya aplica el formato y el calendario real; `minutes` tiene
 *    que ser un entero de 0 en adelante, y `met` un entero dentro del rango de
 *    metas. Un historial corrupto se degrada, no se pierde entero (RF-37).
 * 2. Ordenar de la más reciente a la más antigua, por `weekStart`.
 * 3. Quedarse con la primera entrada de cada `weekStart` repetido.
 * 4. Cortar a `HISTORY_LIMIT` entradas, que ya es la más reciente.
 *
 * Sobre el determinismo (D12, riesgo R7). El comparador del `sort` es uno solo que
 * desempata por `minutes` dentro de cada `weekStart`:
 *
 *     (a, b) => b.weekStart.localeCompare(a.weekStart) || (b.minutes - a.minutes)
 *
 * El segundo término solo llega a evaluarse cuando las dos entradas tienen el
 * mismo `weekStart`, así que el desempate no puede desplazar el orden por fecha. Y
 * como las claves son fechas `AAAA-MM-DD` de ancho fijo, compararlas como texto da
 * el mismo resultado que compararlas como fecha, y sigue funcionando en el cruce
 * de año sin casos especiales.
 *
 * El plan §5.4 propone dos `sort` consecutivos, uno por fecha y otro por `minutes`.
 * Eso no es equivalente: el segundo `sort` reordena el array ENTERO por minutos, y
 * el resultado sale ordenado por minutos en lugar de por fecha. Se puede comprobar
 * con tres entradas de marzo de 2026, donde la propuesta del plan devuelve
 * 09-999, 02-600, 23-10 y este comparador devuelve 23-10, 09-999, 02-600. Un solo
 * `sort` compuesto da el resultado correcto y cumple lo mismo que RF-25 pide: que
 * el resultado no dependa del orden guardado.
 *
 * Que dos entradas compartan `weekStart` y `minutes` sigue siendo un empate
 * completo, y entonces RF-25 dice que gana "la que queda primera en ese orden". Si
 * además coinciden en `met` son la misma entrada y da igual cuál salga. El test
 * `es idempotente sobre su propia salida` fija que normalizar dos veces no cambia
 * nada, que es lo que necesita F2 al persistir lo ya normalizado.
 *
 * No usa el reloj del sistema (RFN-3): no recibe ni deriva ninguna fecha, solo
 * ordena y filtra lo que viene de fuera.
 *
 * @param {*} raw Historial leído del almacenamiento, sin confirmar.
 * @returns {Array<{weekStart: string, minutes: number, met: number}>}
 */
function normalizeHistory(raw) {
  if (!Array.isArray(raw)) return [];

  const interpretables = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) continue;
    if (!GOAL_DEPS.heatmap.isValidDateKey(item.weekStart)) continue;
    if (!Number.isInteger(item.minutes) || item.minutes < 0) continue;
    if (!Number.isInteger(item.met) || item.met < GOAL_MIN || item.met > GOAL_MAX) continue;

    interpretables.push({ weekStart: item.weekStart, minutes: item.minutes, met: item.met });
  }

  // Un solo `sort`, con el desempate de `minutes` como segundo término del
  // comparador. Se ordena SOBRE una lista nueva, así que la del llamante no se
  // reordena (RFN-12).
  interpretables.sort((a, b) =>
    b.weekStart.localeCompare(a.weekStart) || (b.minutes - a.minutes));

  const unicas = [];
  const vistas = new Set();
  for (const item of interpretables) {
    if (vistas.has(item.weekStart)) continue;
    vistas.add(item.weekStart);
    unicas.push(item);
  }

  return unicas.slice(0, HISTORY_LIMIT);
}

/**
 * Construye la entrada de historial de una semana cerrada (RF-22).
 *
 * La entrada es `{ weekStart, minutes, met }`, con `met` siendo "la meta vigente en
 * el momento de sellarla". Que el campo se guarde es lo que luego permite que la
 * semana se juzgue por sí sola, sin mirar la meta que haya ahora (RF-23, D14).
 *
 * Los minutos se cuentan con `getValidMinutesForWeek` pasándole como `today` el
 * propio `weekStart`, que es lo que RF-10 fija para una semana cerrada: el rango
 * sale de `getWeekRange` y es ese lunes y ese domingo, ni una sesión más. La función
 * no vuelve a filtrar ni a sumar nada, de modo que el total sale con la misma
 * definición de "minutos válidos" que la tarjeta de progreso.
 *
 * No muta la lista de sesiones: `getValidMinutesForWeek` ya devuelve un número y no
 * toca el array, así que las sesiones del llamante quedan intactas (RFN-12, RF-41).
 *
 * @param {Array<{date: *, minutes: *}>} sessions Sesiones guardadas, sin filtrar.
 * @param {string} weekStart Lunes de la semana que se sella.
 * @param {number} goalValue Meta vigente en este momento, que se guarda en la entrada.
 * @returns {{weekStart: string, minutes: number, met: number}}
 */
function buildHistoryEntry(sessions, weekStart, goalValue) {
  return {
    weekStart,
    minutes: getValidMinutesForWeek(sessions, weekStart),
    met: goalValue
  };
}

/**
 * Dice si una entrada del historial quedó cumplida (RF-23, D14).
 *
 * Solo recibe la entrada, y esa es la decisión de diseño de esta función. El
 * cumplimiento se decide con el `met` que la entrada guarda, nunca con la meta
 * vigente: así cada semana es intelligible por sí sola y un resultado anotado no
 * cambia retroactivamente si algún día la meta fuese editable. Que la firma no
 * admita un segundo argumento hace la regla estructural: no se puede escribir la
 * versión que compara con la meta vigente porque no hay dónde pasarle el valor.
 *
 * La meta es inmutable en esta spec, así que comparar con una o con otra daría hoy el
 * mismo resultado. La regla se fija igualmente para que el criterio sea explícito y no
 * heredado del orden en que se llame.
 *
 * Devuelve un booleano con `>=`, igual que RF-14: una semana que llega justo a su
 * meta está cumplida.
 *
 * @param {{weekStart: string, minutes: number, met: number}} entry Entrada del historial.
 * @returns {boolean}
 */
function isWeekEntryMet(entry) {
  return entry.minutes >= entry.met;
}

/**
 * Qué semanas hay que sellar, de la más antigua a la más reciente
 * (RF-21, RF-26, RF-44, decisiones D5 y D15).
 *
 * Devuelve solo las claves de lunes. El orden es ASCENDENTE porque `sealWeeks` de D5
 * sella en ese orden y así puede recorrer la lista tal cual; devolverla al revés
 * obligaría a darle la vuelta y a obtener la inversa, que es la clase de detalle que
 * luego alguien se equivoca al escribir.
 *
 * Las reglas, en el orden en que se aplican. El orden importa: la comprobación del
 * reloj va la primera porque es la única que puede vaciar la lista entera.
 *
 * 1. Sin registro de meta no se sella nada (RF-26). No hay compromiso hacia atrás ni
 *    meta con la que medir hacia delante.
 * 2. Si la semana actual es anterior o igual a la de la entrada más reciente, no se
 *    sella nada (RF-44, D15). Sin esta comprobación, un reloj atrasado produciría
 *    entradas con `weekStart` en el futuro que quedarían en cabeza del historial y
 *    bloquearían el sellado de todas las semanas siguientes. Va antes que el recorrido
 *    porque comprobarlo después ya no sirve: una semana "futura" que se sello primero se
 *    convierte en la última entrada y deja el historial igual de estropeado.
 * 3. Se recorre desde `setAtWeekStart` en pasos de siete días, y cada semana se toma si
 *    su `weekStart` es estrictamente posterior a `setAtWeekStart` (D5) y anterior a la
 *    semana actual, y si no está ya anotada.
 *
 * El salto de semana usa `addDays` de `heatmap.js` sobre las claves de fecha: no hay
 * horas ni DST en el medio, porque las claves son de ancho fijo y se suman como días de
 * calendario (RFN-4).
 *
 * Que la semana en la que se fijó la meta no se sella no necesita una regla aparte:
 * su `weekStart` es igual a `setAtWeekStart`, y la comparación es estrictamente
 * posterior. Lo mismo explica por qué las semanas anteriores tampoco entran, que es lo
 * que D5 quiere: el historial empieza donde empieza el compromiso, y anotar esas
 * semanas sería una acusación inventada.
 *
 * El historial se normaliza antes de mirarse, de modo que una entrada corrupta no
 * llegue a decidir cuál es la última semana anotada. No se muta: `normalizeHistory`
 * devuelve una lista nueva.
 *
 * @param {Array} history Historial guardado, sin normalizar.
 * @param {{value: number, setAtWeekStart: string}|null} goalRecord Registro de meta, o `null`.
 * @param {string} today Clave del día de hoy.
 * @returns {string[]} Lunes a sellar, de la más antigua a la más reciente.
 */
function listWeeksToSeal(history, goalRecord, today) {
  if (!goalRecord || goalRecord.setAtWeekStart === null || goalRecord.setAtWeekStart === undefined) {
    return [];
  }

  const historial = normalizeHistory(history);
  const semanaActual = GOAL_DEPS.heatmap.getWeekStartMonday(today);

  // La entrada más reciente es la primera, porque `normalizeHistory` deja la lista
  // ordenada de más reciente a más antigua. El reloj atrás se comprueba antes de
  // cualquier recorrido (RF-44, D15).
  if (historial.length > 0 && semanaActual <= historial[0].weekStart) return [];

  const anotadas = new Set(historial.map((e) => e.weekStart));
  const semanas = [];

  // El recorrido empieza en la semana SIGUIENTE a la de la fijación: la de la
  // fijación no se sella porque el criterio es estrictamente posterior.
  let semana = GOAL_DEPS.heatmap.addDays(goalRecord.setAtWeekStart, 7);
  while (semana < semanaActual) {
    if (!anotadas.has(semana)) semanas.push(semana);
    semana = GOAL_DEPS.heatmap.addDays(semana, 7);
  }

  return semanas;
}

/**
 * Sella las semanas cerradas que han pasado y devuelve el historial resultante
 * (RF-21, RF-22, RF-42, RF-45, decisiones D5 y R3).
 *
 * Es la única función que escribe entradas nuevas en el historial, y por eso lleva
 * la regla completa en tres pasos que se apoyan en las funciones anteriores:
 *
 * 1. `listWeeksToSeal` decide QUÉ semanas se sellan: las cerradas con `weekStart`
 *    estrictamente posterior a `setAtWeekStart` y que no estén anotadas. Esa regla
 *    no se reimplementa aquí, porque está en D4 con sus casos de reloj atrás y de
 *    semana de la fijación.
 * 2. `buildHistoryEntry` construye cada entrada con los minutos válidos de ESA
 *    semana, contando con su propio `weekStart` como `today` (RF-10).
 * 3. `normalizeHistory` normaliza el resultado entero.
 *
 * El paso 3 va AL FINAL y no al principio, y el orden importa. Normalizar antes de
 * sellar y devolver la concatenación sin normalizar dejaría el historial sin podar y
 * sin ordenar; normalizar al final garantiza que lo que F2 persiste y lo que se
 * pinta son la misma lista, cosa que RF-22 exige. También cierra el riesgo R3, que
 * era duplicar claves: como `normalizeHistory` deduplica por `weekStart` y el
 * sellado no puede añadir una semana que `listWeeksToSeal` ya descartó, cargar dos
 * veces no puede dejar dos entradas de la misma semana.
 *
 * `changed` dice si de verdad se añadió algo, y se calcula con la longitud de la
 * lista de semanas a sellar, no comparando el historial: si no hay nada que sellar,
 * no se ha escrito nada y `changed` es `false`. Eso permite que F2 escriba una sola
 * vez, solo cuando hay algo nuevo (T3).
 *
 * Con `goalRecord` nulo no se sella ninguna semana, pero el historial de entrada se
 * devuelve igualmente normalizado: la normalización no depende de si se ha sellado
 * algo, y F2 persiste lo que sale de aquí (RF-26, RF-22).
 *
 * Ni las sesiones ni el historial de entrada se tocan: las dos reglas son de solo
 * lectura y el usuario no pierde datos (RFN-12, RF-41).
 *
 * @param {Array<{date: *, minutes: *}>} sessions Sesiones guardadas, sin filtrar.
 * @param {Array} history Historial guardado, sin normalizar.
 * @param {{value: number, setAtWeekStart: string}|null} goalRecord Registro de meta, o `null`.
 * @param {string} today Clave del día de hoy, capturada al cargar.
 * @returns {{history: Array<{weekStart: string, minutes: number, met: number}>,
 *            changed: boolean}}
 */
function sealWeeks(sessions, history, goalRecord, today) {
  const semanas = listWeeksToSeal(history, goalRecord, today);

  if (semanas.length === 0) {
    // No hay nada nuevo que anotar, pero el historial se normaliza igual: es lo que
    // se persiste y lo que se pinta, y tiene que ser la misma lista.
    return { history: normalizeHistory(history), changed: false };
  }

  const selladas = semanas.map((weekStart) =>
    buildHistoryEntry(sessions, weekStart, goalRecord.value));

  return {
    history: normalizeHistory(history.concat(selladas)),
    changed: true
  };
}

/**
 * Separador de las tres partes de la línea del historial: guion largo U+2014
 * (RF-34). Es una constante y no un literal suelto porque el guion corto se parece
 * mucho al leerlo y porque tiene que ser EXACTAMENTE el largo: los tests comparan el
 * carácter.
 */
const GOAL_SEPARADOR_LINEA = ' — ';

/** Sufijo de "min" en las líneas del historial (RF-34). */
const GOAL_SUFIJO_MIN = ' min';

/** Los dos estados posibles de una entrada del historial (RF-34). */
const GOAL_ESTADO_CUMPLIDA = 'cumplida';
const GOAL_ESTADO_PENDIENTE = 'pendiente';

/**
 * Compone la línea visible de una entrada del historial (RF-34, RFN-4).
 *
 *     "lunes, 29 de septiembre de 2025 — 650 de 600 min — cumplida"
 *
 * Tres decisiones, todas fijadas por RF-34:
 *
 * - Los nombres de día y de mes salen de `GOAL_WEEKDAY_NAMES` y `GOAL_MONTH_NAMES`,
 *   que son tablas literales, nunca de `Intl`. Un `Intl` depende del locale del
 *   navegador y devolvería "septiembre" en un equipo y "September" en otro, y RF-34
 *   fija cadenas exactas. Es la misma razón por la que `heatmap.js` tiene las suyas
 *   (T2).
 * - La fecha se construye con `localDateFromKey`, que la pone a mediodía, para que
 *   ningún huso la mueva al día anterior o siguiente (RFN-4). Con `toISOString` el
 *   día se desplazaría en husos de offset negativo, y el día del lunes es el que da
 *   nombre a la semana.
 * - El estado sale de `isWeekEntryMet`, que juzga la entrada contra SU `met` (RF-23,
 *   D14). Aquí no se vuelve a decidir si se cumplió: si esta función calculara el
 *   estado por su cuenta, habría dos criterios de cumplimiento en el archivo y
 *   podrían divergir.
 *
 * Los minutos se interpolan como enteros, sin `toLocaleString`: `1200` sale
 * "1200" y no "1.200" (RF-34).
 *
 * No recibe fechas ni consulta el reloj (RFN-3): la fecha sale del `weekStart` que ya
 * trae la entrada.
 *
 * @param {{weekStart: string, minutes: number, met: number}} entry Entrada del historial.
 * @returns {string}
 */
function composeWeekEntryLine(entry) {
  const fecha = GOAL_DEPS.heatmap.localDateFromKey(entry.weekStart);
  const dia = GOAL_WEEKDAY_NAMES[GOAL_DEPS.heatmap.weekdayIndex(entry.weekStart)];
  const mes = GOAL_MONTH_NAMES[fecha.getMonth()];

  const legible = dia + ', ' + fecha.getDate() + ' de ' + mes + ' de ' + fecha.getFullYear();
  const parte = entry.minutes + ' de ' + entry.met + GOAL_SUFIJO_MIN;
  const estado = isWeekEntryMet(entry) ? GOAL_ESTADO_CUMPLIDA : GOAL_ESTADO_PENDIENTE;

  return legible + GOAL_SEPARADOR_LINEA + parte + GOAL_SEPARADOR_LINEA + estado;
}

/**
 * Dice si dos historiales contienen exactamente lo mismo (F7, punto 2).
 *
 * Es el criterio que decide si el historial guardado hay que reescribirlo, y por eso
 * compara **contenido**, no identidad: dos listas con las mismas entradas en el mismo
 * orden son la misma lista aunque sus objetos sean distintos. Solo se miran los tres
 * campos canónicos de una entrada, así que el resultado no depende del orden de las
 * claves de cada objeto ni de que la lista guardada lleve campos de más.
 *
 * El caso que tiene que detectar es el de distinta longitud: una lista guardada con más
 * de `HISTORY_LIMIT` frente a la que deja la normalización. Con 15 guardadas y 12
 * normalizadas son listas distintas, y eso es lo que obliga a reescribir.
 *
 * `normalizada` y `guardada` no tienen por qué estar normalizadas: la primera suele
 * serlo y la segunda es lo que había en el almacenamiento. Solo se comparan, y lo que
 * no se puede leer cuenta como distinto en vez de romper la comparación.
 *
 * @param {*} normalizada Lista normalizada que se va a guardar.
 * @param {*} guardada Lista tal y como estaba guardada.
 * @returns {boolean}
 */
function isSameHistory(normalizada, guardada) {
  if (!Array.isArray(normalizada) || !Array.isArray(guardada)) return false;
  if (normalizada.length !== guardada.length) return false;

  return normalizada.every((entrada, i) => {
    const otra = guardada[i];
    if (otra === null || typeof otra !== 'object') return false;

    return entrada.weekStart === otra.weekStart
      && entrada.minutes === otra.minutes
      && entrada.met === otra.met;
  });
}

/**
 * Qué historial se pinta en la tarjeta (RF-26).
 *
 * RF-26 dice que sin meta semanal "no sella ninguna semana y no muestra historial". Las
 * dos mitades las cumple esta función la segunda y `sealAndPersistWeeks` la primera, y
 * conviene que las dos lean la misma condición para que no puedan separarse: sin meta no
 * se sella Y no se ve.
 *
 * La regla es "sin meta no hay historial que mostrar", no "sin historial no hay meta": el
 * almacenamiento puede guardar semanas selladas de cargas anteriores —una meta que se
 * borró, un meta que RF-38 descartó— y ninguna de las dos cosas invalida al otra. Por eso
 * la función devuelve una lista vacía en vez de `null`: quien la llama tiene un caso
 * normal y trata igual "no hay nada" que "no hay objetivo".
 *
 * Lo que NO decide es qué semanas sellar, ni cuáles son interpretables, ni cuántas caben.
 * Eso lo decide `sealWeeks` y `normalizeHistory`, y esta función recibe la lista ya
 * normalizada y la devuelve intacta. Así el corte a `HISTORY_LIMIT`, el orden y el
 * filtrado siguen teniendo una sola fuente, que es `normalizeHistory`, y lo único que
 * añade esta es la condición de visibilidad.
 *
 * Sin meta devuelve un array NUEVO vacío, no la lista recibida: quien la llama vacía el
 * DOM con ella, y devolver la referencia compartida dejaría el mismo array sensible a que
 * alguien la vacíe por su cuenta (RFN-12, no mutar la entrada).
 *
 * Con meta devuelve la lista tal cual, también sin copiar. Es solo lectura y quien la
 * recibe ya la tiene; copiarla costaría memoria sin ganar nada.
 *
 * No usa el reloj del sistema (RFN-3): no recibe ni deriva ninguna fecha.
 *
 * @param {*} goalRecord Meta validada, o `null` si no hay meta (RF-38 ya aplicada).
 * @param {Array<{weekStart: string, minutes: number, met: number}>} history Historial
 *   normalizado, o `[]` si no hay nada guardado.
 * @returns {Array<{weekStart: string, minutes: number, met: number}>} Las entradas que
 *   se pintan: las mismas con meta, ninguna sin ella.
 */
function selectVisibleHistory(goalRecord, history) {
  const lista = Array.isArray(history) ? history : [];

  // Sin meta no se muestra historial (RF-26), aunque haya semanas guardadas.
  if (goalRecord === null || goalRecord === undefined) return [];

  return lista;
}

if (typeof module !== 'undefined') module.exports = {
  GOAL_DEPS,
  GOAL_MIN,
  GOAL_MAX,
  HISTORY_LIMIT,
  GOAL_WEEKDAY_NAMES,
  GOAL_MONTH_NAMES,
  GOAL_CARD_TITLE,
  parseGoalInput,
  buildGoalRecord,
  isValidGoalRecord,
  getValidMinutesForWeek,
  computeProgress,
  composeGoalLines,
  normalizeHistory,
  buildHistoryEntry,
  isWeekEntryMet,
  listWeeksToSeal,
  sealWeeks,
  composeWeekEntryLine,
  isSameHistory,
  selectVisibleHistory
};
