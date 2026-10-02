/**
 * Lógica pura del Diario de Estudio: fechas locales, rachas y recuentos.
 *
 * Principios que respeta este archivo:
 * - No toca el DOM ni el almacenamiento local.
 * - Toda función que necesita saber qué día es hoy lo recibe como parámetro `today`
 *   (cadena `AAAA-MM-DD`) y nunca consulta el reloj del sistema por su cuenta.
 * - Las fechas se construyen con setters locales, nunca con `toISOString()`, que
 *   convierte a UTC y desplaza el día en husos horarios negativos.
 *
 * Se carga con `<script>` en el navegador y con `require()` en los tests, por eso
 * la exportación final está guardada.
 */

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Convierte un `Date` en su clave de día local `AAAA-MM-DD`.
 * @param {Date} date
 * @returns {string}
 */
function toLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Construye un `Date` local a mediodía a partir de una clave `AAAA-MM-DD`.
 * El mediodía evita que un ajuste de huso mueva la fecha al día anterior o siguiente.
 * @param {string} dateKey
 * @returns {Date}
 */
function localDateFromKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Clave del día anterior a `today`.
 * @param {string} today
 * @returns {string}
 */
function getYesterdayString(today) {
  return shiftDateString(today, -1);
}

/**
 * Suma (o resta) días a una clave de fecha sin pasar por UTC.
 * @param {string} dateKey
 * @param {number} days
 * @returns {string}
 */
function shiftDateString(dateKey, days) {
  const date = localDateFromKey(dateKey);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

/**
 * Días transcurridos entre `today` y `dateKey`, ambos a mediodía local.
 * Positivo si `dateKey` es anterior a `today`.
 * @param {string} today
 * @param {string} dateKey
 * @returns {number}
 */
function getDaysFromToday(today, dateKey) {
  return Math.round((localDateFromKey(today) - localDateFromKey(dateKey)) / DAY_MS);
}

/**
 * Días hace respecto a `today`.
 * @param {string} today
 * @param {number} daysAgo
 * @returns {string}
 */
function getDateStringMinusDays(today, daysAgo) {
  return shiftDateString(today, -daysAgo);
}

/**
 * Fechas únicas con sesión, ordenadas de más antigua a más reciente.
 * @param {Array<{date: string}>} sessions
 * @returns {string[]}
 */
function getUniqueDatesWithSessions(sessions) {
  const dates = new Set();
  sessions.forEach((session) => dates.add(session.date));
  return Array.from(dates).sort();
}

/**
 * Racha más larga de toda la historia, sin importar si sigue viva hoy.
 * @param {Array<{date: string}>} sessions
 * @returns {number}
 */
function calculateBestStreak(sessions) {
  if (sessions.length === 0) return 0;

  const dates = getUniqueDatesWithSessions(sessions);
  let best = 1;
  let run = 1;

  for (let i = 1; i < dates.length; i++) {
    if (dates[i] === shiftDateString(dates[i - 1], 1)) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  return best;
}

/**
 * Racha actual: días consecutivos con sesión que terminan hoy.
 * Si hoy no hay sesión pero ayer sí, la racha sigue viva con valor 1.
 * @param {Array<{date: string}>} sessions
 * @param {string} today
 * @returns {number}
 */
function calculateStreak(sessions, today) {
  if (sessions.length === 0) return 0;

  const datesWithSessions = new Set(getUniqueDatesWithSessions(sessions));
  const yesterday = getYesterdayString(today);

  let streak = 0;
  let currentDate;

  if (datesWithSessions.has(today)) {
    streak = 1;
    currentDate = yesterday;
  } else if (datesWithSessions.has(yesterday)) {
    streak = 1;
    currentDate = getDateStringMinusDays(today, 2);
  } else {
    return 0;
  }

  while (datesWithSessions.has(currentDate)) {
    streak++;
    currentDate = shiftDateString(currentDate, -1);
  }

  return streak;
}

/**
 * Semana ISO actual: de lunes a domingo, en hora local.
 * @param {string} today
 * @returns {{start: string, end: string}}
 */
function getWeekRange(today) {
  const weekdayIndex = (localDateFromKey(today).getDay() + 6) % 7; // 0 = lunes
  const monday = shiftDateString(today, -weekdayIndex);
  return { start: monday, end: shiftDateString(monday, 6) };
}

/**
 * Minutos estudiados en la semana actual.
 * @param {Array<{date: string, minutes: number}>} sessions
 * @param {string} today
 * @returns {number}
 */
function calculateWeeklyTotal(sessions, today) {
  const { start, end } = getWeekRange(today);
  return sessions
    .filter((s) => s.date >= start && s.date <= end)
    .reduce((sum, s) => sum + s.minutes, 0);
}

/**
 * Mes natural actual, del día 1 al último día, en hora local.
 * @param {string} today
 * @returns {{start: string, end: string}}
 */
function getMonthRange(today) {
  const date = localDateFromKey(today);
  const year = date.getFullYear();
  const month = date.getMonth();
  return {
    start: toLocalDateString(new Date(year, month, 1, 12, 0, 0, 0)),
    end: toLocalDateString(new Date(year, month + 1, 0, 12, 0, 0, 0))
  };
}

/**
 * Días distintos con sesión dentro del mes actual.
 * @param {Array<{date: string}>} sessions
 * @param {string} today
 * @returns {number}
 */
function calculateMonthlyDays(sessions, today) {
  const { start, end } = getMonthRange(today);
  const dates = new Set(
    sessions.filter((s) => s.date >= start && s.date <= end).map((s) => s.date)
  );
  return dates.size;
}

/**
 * Fecha legible para el historial. No es normativa: la línea de detalle del mapa
 * usa su propio formateo determinista.
 * @param {string} dateKey
 * @returns {string}
 */
function formatDate(dateKey) {
  return localDateFromKey(dateKey).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    toLocalDateString,
    localDateFromKey,
    getYesterdayString,
    shiftDateString,
    getDaysFromToday,
    getDateStringMinusDays,
    getUniqueDatesWithSessions,
    calculateBestStreak,
    calculateStreak,
    getWeekRange,
    calculateWeeklyTotal,
    getMonthRange,
    calculateMonthlyDays,
    formatDate
  };
}