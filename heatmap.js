/**
 * Lógica pura del mapa de calor de estudio.
 *
 * Principios que respeta este archivo:
 * - No toca el DOM ni el almacenamiento local.
 * - No llama al reloj del sistema: `today` entra siempre como parámetro.
 * - Devuelve números de nivel (0 a 5), nunca colores. De eso se encarga el CSS.
 *
 * Se carga con `<script>` en el navegador y con `require()` en los tests.
 */

const WEEKS = 26;
const ROWS = 7;
const COLUMNS = WEEKS + 1; // 26 semanas completas más la semana en curso

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const WEEKDAY_NAMES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo'
];

const MONTH_NAMES = [
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
 * Convierte un `Date` en clave de día local `AAAA-MM-DD`.
 * @param {Date} date
 * @returns {string}
 */
function toLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Construye un `Date` local a mediodía. El mediodía evita que un ajuste de huso
 * mueva la fecha al día anterior o siguiente.
 * @param {string} dateKey
 * @returns {Date}
 */
function localDateFromKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Una fecha guardada es válida si es texto con formato `AAAA-MM-DD` y existe
 * realmente en el calendario (mes 1-12 y día dentro del mes, año bisiesto incluido).
 * @param {*} value
 * @returns {boolean}
 */
function isValidDateKey(value) {
  if (typeof value !== 'string') return false;
  if (!DATE_KEY_PATTERN.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12) return false;

  // El último día del mes lo decide el calendario, no una suposición de 30.
  const daysInMonth = new Date(year, month, 0).getDate();
  return day >= 1 && day <= daysInMonth;
}

/**
 * Los minutos son válidos si son un entero mayor o igual que 1.
 * Los decimales, el cero, los negativos y los valores no numéricos no lo son.
 * @param {*} value
 * @returns {boolean}
 */
function isValidMinutes(value) {
  if (typeof value !== 'number') return false;
  if (!Number.isInteger(value)) return false;
  return value >= 1;
}

/**
 * Devuelve el motivo por el que una sesión es inválida, o `null` si es válida.
 * @param {{date: *, minutes: *}} session
 * @returns {'fecha' | 'minutos' | null}
 */
function getInvalidReason(session) {
  if (!isValidDateKey(session.date)) return 'fecha';
  if (!isValidMinutes(session.minutes)) return 'minutos';
  return null;
}

/**
 * Suma o resta días a una clave de fecha sin pasar por UTC.
 * @param {string} dateKey
 * @param {number} days
 * @returns {string}
 */
function addDays(dateKey, days) {
  const date = localDateFromKey(dateKey);
  date.setDate(date.getDate() + days);
  return toLocalDateKey(date);
}

/**
 * Día de la semana con 0 en lunes y 6 en domingo.
 * @param {string} dateKey
 * @returns {number}
 */
function weekdayIndex(dateKey) {
  return (localDateFromKey(dateKey).getDay() + 6) % 7;
}

/**
 * Clave del lunes de la semana a la que pertenece `dateKey`.
 * @param {string} dateKey
 * @returns {string}
 */
function getWeekStartMonday(dateKey) {
  return addDays(dateKey, -weekdayIndex(dateKey));
}

/**
 * Límites de la ventana: del lunes de hace 26 semanas al domingo de la semana en curso.
 * @param {string} today
 * @returns {{start: string, end: string}}
 */
function getWindowBounds(today) {
  const thisMonday = getWeekStartMonday(today);
  return {
    start: addDays(thisMonday, -WEEKS * 7),
    end: addDays(thisMonday, 6)
  };
}

/**
 * Estado de intensidad de un día a partir de sus minutos válidos acumulados.
 * Las comparaciones son descendentes y el último `return` no tiene condición,
 * así que ningún total puede producir un estado por encima del 5.
 * @param {number} totalMinutes
 * @returns {number} 0 a 5
 */
function getIntensityLevel(totalMinutes) {
  if (totalMinutes >= 240) return 5;
  if (totalMinutes >= 120) return 4;
  if (totalMinutes >= 60) return 3;
  if (totalMinutes >= 30) return 2;
  if (totalMinutes >= 1) return 1;
  return 0;
}

/**
 * Separa las sesiones válidas de las inválidas y cuenta los motivos.
 * Ninguna sesión se modifica ni se descarta: solo se decide quién participa
 * en el cálculo del mapa.
 * @param {Array<{date: *, minutes: *}>} sessions
 * @returns {{valid: Array, invalidTotal: number, invalidByReason: {fecha: number, minutos: number}}}
 */
function partitionSessions(sessions) {
  const valid = [];
  const invalidByReason = { fecha: 0, minutos: 0 };

  sessions.forEach((session) => {
    const reason = getInvalidReason(session);
    if (reason === null) {
      valid.push(session);
    } else {
      invalidByReason[reason] += 1;
    }
  });

  return {
    valid,
    invalidTotal: invalidByReason.fecha + invalidByReason.minutos,
    invalidByReason
  };
}

/**
 * Construye el mapa completo: 27 columnas de 7 celdas, de la más antigua a la
 * más reciente, con la última columna conteniendo hoy.
 * @param {Array<{date: *, minutes: *}>} sessions
 * @param {string} today
 */
function buildHeatmap(sessions, today) {
  const { start, end } = getWindowBounds(today);
  const { valid, invalidTotal, invalidByReason } = partitionSessions(sessions);

  const minutesByDate = new Map();
  let outsideWindow = 0;

  valid.forEach((session) => {
    if (session.date < start || session.date > end) {
      outsideWindow += 1;
      return;
    }
    minutesByDate.set(
      session.date,
      (minutesByDate.get(session.date) || 0) + session.minutes
    );
  });

  const columns = [];
  const cells = [];

  for (let week = 0; week < COLUMNS; week++) {
    const column = [];
    for (let row = 0; row < ROWS; row++) {
      const date = addDays(addDays(start, week * ROWS), row);
      const minutes = minutesByDate.get(date) || 0;
      const cell = {
        date,
        row,
        column: week,
        index: cells.length,
        minutes,
        level: getIntensityLevel(minutes),
        hasActivity: minutes > 0,
        isFuture: date > today
      };
      column.push(cell);
      cells.push(cell);
    }
    columns.push(column);
  }

  return {
    today,
    start,
    end,
    columns,
    cells,
    shape: { columns: COLUMNS, rows: ROWS },
    invalidTotal,
    invalidByReason,
    outsideWindow
  };
}

/**
 * Única fuente del texto de una celda. La comparten el detalle visible y el
 * texto accesible, así que no pueden divergir.
 * @param {object} cell
 * @returns {string}
 */
function composeCellText(cell) {
  const date = localDateFromKey(cell.date);
  const readable =
    WEEKDAY_NAMES[weekdayIndex(cell.date)] +
    ', ' +
    date.getDate() +
    ' de ' +
    MONTH_NAMES[date.getMonth()];

  if (cell.hasActivity) return `${readable} — ${cell.minutes} min`;
  if (cell.isFuture) return `${readable} — aún no ha llegado`;
  return `${readable} — sin sesiones`;
}

/**
 * Texto de la línea de detalle visible bajo el mapa.
 * @param {object} cell
 * @returns {string}
 */
function formatCellDetail(cell) {
  return composeCellText(cell);
}

/**
 * Texto accesible de la celda. Idéntico al detalle por diseño (RFN-6).
 * @param {object} cell
 * @returns {string}
 */
function getCellLabel(cell) {
  return composeCellText(cell);
}

/**
 * Índice de la celda siguiente al pulsar una flecha, o `null` si el foco ya está
 * en el borde y no debe moverse.
 * @param {number} currentIndex
 * @param {string} key
 * @param {{columns: number, rows: number}} shape
 * @returns {number | null}
 */
function moveFocusCell(currentIndex, key, shape) {
  const { columns, rows } = shape;
  let column = Math.floor(currentIndex / rows);
  let row = currentIndex % rows;

  if (key === 'ArrowRight') column = Math.min(column + 1, columns - 1);
  else if (key === 'ArrowLeft') column = Math.max(column - 1, 0);
  else if (key === 'ArrowDown') row = Math.min(row + 1, rows - 1);
  else if (key === 'ArrowUp') row = Math.max(row - 1, 0);
  else return null;

  const next = column * rows + row;
  return next === currentIndex ? null : next;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WEEKS,
    ROWS,
    COLUMNS,
    toLocalDateKey,
    localDateFromKey,
    isValidDateKey,
    isValidMinutes,
    getInvalidReason,
    addDays,
    weekdayIndex,
    getWeekStartMonday,
    getWindowBounds,
    getIntensityLevel,
    partitionSessions,
    buildHeatmap,
    formatCellDetail,
    getCellLabel,
    composeCellText,
    moveFocusCell
  };
}