const STORAGE_KEY = 'study-diary-sessions';

const form = document.getElementById('sessionForm');
const dateInput = document.getElementById('date');
const topicInput = document.getElementById('topic');
const minutesInput = document.getElementById('minutes');
const streakValue = document.getElementById('streakValue');
const bestStreakValue = document.getElementById('bestStreakValue');
const weeklyValue = document.getElementById('weeklyValue');
const monthlyValue = document.getElementById('monthlyValue');
const sessionsList = document.getElementById('sessionsList');
const emptyMessage = document.getElementById('emptyMessage');

const heatmapGrid = document.getElementById('heatmap');
const heatmapDetail = document.getElementById('heatmapDetail');
const heatmapWarning = document.getElementById('heatmapWarning');

// Claves del objetivo. Son independientes entre sí y de la de las sesiones: la meta
// es un valor global, el historial son las semanas ya selladas, y las sesiones son
// los datos del usuario. Ninguna se escribe desde el código del objetivo (RF-41).
const GOAL_KEY = 'study-diary-goal';
const WEEKS_KEY = 'study-diary-weeks';

const goalStatus = document.getElementById('goalStatus');
const goalForm = document.getElementById('goalForm');
const goalWarning = document.getElementById('goalWarning');
const goalValueInput = document.getElementById('goalValue');
const goalCardTitle = document.querySelector('.goal-card h2');
const goalHistoryTitle = document.querySelector('.goal-history-title');

/*
 * "Hoy" se calcula una sola vez al cargar la página y no vuelve a cambiar durante
 * la sesión. Así el mapa no se recolorea a mitad de la lectura si el reloj del
 * sistema cambia de día, y el texto del detalle nunca mezcla dos fechas distintas.
 */
const TODAY = toLocalDateString(new Date());

let storageAvailable = true;
let currentMap = null;
let focusedCellIndex = 0;

/*
 * Estado del objetivo, resuelto una vez al cargar. F1 solo deja los datos
 * accesibles y decide qué estados son posibles; pintarlos es de F3 y manejarlos, de
 * F4. `goalRecord` es `null` cuando no hay meta, que es el estado sin objetivo de
 * RF-40, y `weeks` es el historial ya normalizado (RF-37).
 */
let goalRecord = null;
let weeks = [];

/*
 * El historial tal y como estaba guardado, sin normalizar. Se guarda aparte porque
 * hace falta para decidir si hay que reescribirlo: comparar la lista normalizada con
 * `weeks` no serviría, porque `loadWeeks` ya normaliza al leer y las dos serían
 * siempre iguales. La lista sobredimensionada, con 15 entradas, solo se detecta
 * comparando contra el dato crudo.
 */
let weeksRaw = null;
let goalRecordWasInvalid = false;

/* ------------------------------------------------------- Almacenamiento */

function loadSessions() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    // El almacenamiento puede estar bloqueado, lleno o corrupto. La aplicación
    // sigue funcionando: se muestran los valores que se puedan calcular.
    storageAvailable = false;
    return [];
  }
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch (error) {
    storageAvailable = false;
    return false;
  }
}

/* --------------------------------------------- Objetivo semanal: claves */

/*
 * Lectura de una de las dos claves nuevas.
 *
 * Devuelve un descriptor con tres campos porque la spec distingue tres situaciones
 * que `loadSessions` puede tratar igual y aquí no:
 *
 * - `estado: 'ok'`: la clave existe y es JSON interpretable. `valor` es lo que hay.
 * - `estado: 'vacio'`: la clave no existe. No hay dato, así que no hay nada que
 *   juzgar ni que avisar: es el estado sin objetivo de RF-40.
 * - `estado: 'formato'`: la clave existe pero su contenido no es JSON. El dato está
 *   corrupto, que es cosa distinta de que el almacenamiento no funcione, así que NO
 *   se marca `storageAvailable` como falso. Es el caso de RF-38, y salta el aviso.
 *
 * Solo el fallo de acceso al almacenamiento marca `storageAvailable = false`
 * (RF-39), igual que hace `loadSessions`.
 */
function readJsonKey(key) {
  let data;
  try {
    data = localStorage.getItem(key);
  } catch (error) {
    // El almacenamiento no está disponible: la aplicación sigue funcionando y no
    // hay dato que juzgar, así que no se muestra ningún aviso (RF-39).
    storageAvailable = false;
    return { estado: 'vacio', valor: null };
  }

  if (!data) return { estado: 'vacio', valor: null };

  try {
    return { estado: 'ok', valor: JSON.parse(data) };
  } catch (error) {
    return { estado: 'formato', valor: null };
  }
}

/*
 * Escritura de una de las dos claves nuevas.
 *
 * La clave llega como argumento y se llama solo con `GOAL_KEY` y `WEEKS_KEY`. Es la
 * mitigación que el plan fija para R1: como `saveSessions` es la única función de
 * este archivo que nombra `STORAGE_KEY`, el código del objetivo no tiene forma de
 * llegar a la clave de las sesiones. `removeItem` no se usa en ninguna parte (RF-41).
 */
function writeJsonKey(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    storageAvailable = false;
    return false;
  }
}

/* ------------------------------------------------- Objetivo semanal: estado */

/**
 * Lee el registro de meta guardado (RF-35, RF-38).
 *
 * Distingue tres casos que la spec separa y que no pueden confundirse:
 *
 * - No hay ninguna clave: no hay meta y no hay dato. Se devuelve `null` sin marcar
 *   nada, que es el estado sin objetivo de RF-40.
 * - Hay dato pero `isValidGoalRecord` lo rechaza: se descarta, vuelve el estado sin
 *   objetivo y se marca `goalRecordWasInvalid` para que aparezca el aviso de RF-38 y
 *   el formulario vuelva a estar disponible.
 * - Hay dato válido: se devuelve tal cual.
 */
function loadGoal() {
  const lectura = readJsonKey(GOAL_KEY);

  if (lectura.estado === 'vacio') return null;

  if (lectura.estado === 'formato' || !isValidGoalRecord(lectura.valor)) {
    goalRecordWasInvalid = true;
    return null;
  }

  return lectura.valor;
}

/**
 * Lee el historial de semanas guardado (RF-36, RF-37).
 *
 * Se normaliza siempre, incluso sin meta y aunque la lista no sea válida: la
 * normalización descarta lo no interpretable y deja el resto en orden, y devuelver
 * `[]` cuando el dato no es una lista evita que el resto del archivo tenga que
 * comprobarlo otra vez. No muestra aviso por datos malos: RF-37 es explícito en que no
 * debe interruptor nada.
 */
function loadWeeks() {
  const lectura = readJsonKey(WEEKS_KEY);
  weeksRaw = lectura.valor;
  return normalizeHistory(lectura.valor);
}

/**
 * Guarda el registro de meta con la forma `{ value, setAt, setAtWeekStart }` que
 * produce `buildGoalRecord` (RF-35).
 *
 * Devuelve `true` o `false` para que F4 pueda distinguir un guardado correcto de uno
 * que falló, y en ese último caso la aplicación vuelve al estado sin objetivo sin
 * tocar nada más.
 */
function saveGoal(record) {
  return writeJsonKey(GOAL_KEY, record);
}

/**
 * Guarda el historial ya normalizado (RF-36, D12).
 *
 * Se persiste lo que sale de `normalizeHistory`, de modo que lo guardado y lo visto
 * son siempre la misma lista.
 */
function saveWeeks(nextWeeks) {
  return writeJsonKey(WEEKS_KEY, nextWeeks);
}

/**
 * Avisa de que el objetivo guardado no era válido (RF-38).
 *
 * El aviso depende de dos cosas independientes, igual que el del mapa de calor: que
 * hubiera un dato que resultara inválido y que el almacenamiento se pueda leer. Si no
 * hay almacenamiento no se ha leído nada, así que no hay nada que avisar (RF-39).
 */
function renderGoalWarning() {
  if (!storageAvailable || !goalRecordWasInvalid) {
    goalWarning.hidden = true;
    goalWarning.textContent = '';
    return;
  }

  goalWarning.textContent =
    'El objetivo guardado no era válido y se ha descartado. Fija uno nuevo para empezar a contar.';
  goalWarning.hidden = false;
}

/**
 * Sella las semanas cerradas y persiste el resultado (RF-21, RF-22, RF-42, RF-45).
 *
 * El sellado no lo hace esta función: lo hace `sealWeeks` de `goal.js`, que decide qué
 * semanas se sellan, construye cada entrada y devuelve el historial YA normalizado
 * junto con un `changed` que dice si ha añadido algo. Aquí solo se le pasa lo
 * necesario y se decide si persistirlo.
 *
 * Se escribe UNA sola vez y solo si `changed` es `true` (decisión T3 del plan): sin
 * cambios no se toca el almacenamiento, que es el caso más común al cargar. Y lo que
 * se guarda es el historial que devuelve `sealWeeks`, no el que había al leer, de
 * forma que lo persistido y lo que se ve son la misma lista, también en la carga en que
 * se sella (RF-22, R3).
 *
 * Sin meta no se sella ni se escribe nada (RF-26): no hay compromiso hacia atrás ni
 * meta con la que medir hacia delante. Con el almacenamiento caído, `saveWeeks` no
 * intenta escribir y baja la bandera, sin lanzar nada (RF-39).
 *
 * `TODAY` es el mismo valor congelado al cargar que usa el resto de la aplicación: no
 * se calcula ninguna fecha nueva aquí (RFN-3, y el criterio de RF-3 de la spec 001).
 */
function sealAndPersistWeeks(sessions) {
  // Sin meta no hay nada que sellar, y tampoco nada que escribir (RF-26).
  if (goalRecord === null) return;

  const resultado = sealWeeks(sessions, weeks, goalRecord, TODAY);

  // El historial disponible para pintar es el devuelto por `sealWeeks`, tanto si ha
  // cambiado como si no: en ambos casos ya viene normalizado.
  weeks = resultado.history;

  // Hay que escribir si se ha sellado algo nuevo O si lo guardado no era la versión
  // normalizada. Lo segundo cubre el caso de un historial sobredimensionado o sin
  // podar que quedó de una carga anterior: sin esto se pintaba las 12 más recientes
  // pero el almacenamiento se quedaba con todas (RF-22, y el punto 2 de F7).
  //
  // `isSameHistory` compara contra `weeksRaw`, el dato crudo, y no contra `weeks`.
  // Comparar contra `weeks` no serviría: `loadWeeks` ya normaliza al leer, así que las
  // dos serían siempre iguales y el historial sobredimensionado nunca se detectaría.
  //
  // Cuando no hay nada que sellar y lo guardado ya es la versión normalizada —el caso
  // común, y el que T3 quiere optimizar— no se escribe nada.
  if (resultado.changed || !isSameHistory(weeks, weeksRaw)) saveWeeks(weeks);
}

/**
 * Pinta una línea de la tarjeta: escribe el texto y decide si se ve.
 *
 * Las claves que `composeGoalLines` no devuelve no llegan aquí, así que pintar una
 * línea ausente es ocultarla. Es lo que hace que con el objetivo cumplido no quede
 * ninguna línea de progreso ni de restantes a la vista (RF-29, RF-32).
 *
 * Se vacía el `textContent` además de ocultar, para que el elemento nunca conserve el
 * texto del estado anterior: si la tarjeta se pintara primero pendiente y luego
 * cumplida, las líneas que sobren tienen que quedar limpias, no solo invisibles.
 */
function paintGoalLine(element, text) {
  if (text === undefined) {
    element.hidden = true;
    element.textContent = '';
    return;
  }

  element.textContent = text;
  element.hidden = false;
}

/**
 * Pinta la barra de progreso (RF-13, RF-31, RFN-8).
 *
 * `aria-valuenow` y el ancho del relleno salen del MISMO entero, `progress.percent`,
 * así que no pueden desincronizarse: el valor que anuncia el lector de pantalla y el
 * relleno que ve la vista son el mismo número. El porcentaje se limita a 100 aunque
 * `percent` ya venga acotado, para que el relleno nunca pueda salirse de la pista.
 *
 * `aria-valuetext` lleva el total real y la meta, que es lo que compone
 * `composeGoalLines`: el color del relleno es decorativo y el dato no depende de él
 * (RFN-8).
 */
function paintGoalBar(progress, valueText) {
  const visible = progress !== null;

  goalBar.hidden = !visible;
  if (!visible) {
    goalBarFill.style.width = '0%';
    goalBar.removeAttribute('aria-valuenow');
    goalBar.removeAttribute('aria-valuetext');
    return;
  }

  const percent = Math.max(0, Math.min(100, progress.percent));

  goalBar.setAttribute('aria-valuenow', String(percent));
  if (valueText !== undefined) goalBar.setAttribute('aria-valuetext', valueText);
  goalBarFill.style.width = percent + '%';
}

/**
 * Pinta el historial de semanas (RF-24, RF-26, RF-27, RF-34).
 *
 * Qué semanas se muestran NO lo decide esta función: lo decide `selectVisibleHistory`
 * de `goal.js`, que devuelve una lista vacía cuando no hay meta. RF-26 dice que sin meta
 * "no sella ninguna semana y no muestra historial", y el `return` temprano de
 * `sealAndPersistWeeks` solo cubría la primera mitad: con semanas ya guardadas de cargas
 * anteriores, `weeks` llegaba lleno y esta función las pintaba igual.
 *
 * Por eso la condición de visibilidad es la de `selectVisibleHistory` y no un
 * `weeks.length === 0`: el caso que faltaba era lista NO vacía con meta ausente, y
 * comprobar la longitud no lo distingue del caso normal. Con la regla en `goal.js` queda
 * cubierta por `node --test` en vez de depender de que alguien mire la pantalla.
 *
 * El título `h3` se oculta con la lista. Sin objetivo no hay historial en pantalla, y un
 * "Semanas anteriores" suelto sobre un vacío sería un encabezado de algo que no está.
 *
 * Una línea por entrada, en el orden que ya trae la lista, de más reciente a más
 * antigua. El texto de cada línea lo compone `composeWeekEntryLine`, así que el
 * formato exacto de RF-34 no se reimplementa aquí: la línea entera del literal, y de
 * ella se separa la parte de la fecha de la de las cifras, porque el marcado las
 * distingue para poder alinearlas en columna.
 *
 * El texto se construye en un `DocumentFragment` y se mete de una vez, igual que hace
 * `renderSessions`: insertar nodo a nodo provoca un repintado por cada uno. Una semana
 * ya sellada no se toca al registrar sesiones, porque esto solo se llama al pintar la
 * tarjeta (RF-27).
 */
function paintGoalHistory() {
  goalHistoryList.innerHTML = '';

  const visibles = selectVisibleHistory(goalRecord, weeks);

  if (visibles.length === 0) {
    goalHistoryList.hidden = true;
    goalHistoryTitle.hidden = true;
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const entry of visibles) {
    const partes = composeWeekEntryLine(entry).split(' — ');

    const li = document.createElement('li');
    li.className = isWeekEntryMet(entry) ? 'goal-history-item is-met' : 'goal-history-item';

    const date = document.createElement('span');
    date.className = 'goal-history-date';
    date.textContent = partes[0];

    const minutes = document.createElement('span');
    minutes.className = 'goal-history-minutes';
    minutes.textContent = partes[1] + ' — ' + partes[2];

    li.appendChild(date);
    li.appendChild(minutes);
    fragment.appendChild(li);
  }

  goalHistoryList.appendChild(fragment);
  goalHistoryList.hidden = false;
  goalHistoryTitle.hidden = false;
}

/**
 * Pinta la tarjeta de objetivo completa (RF-1, RF-16, RF-17, RF-28, RF-29, RF-32).
 *
 * Los textos salen todos de `composeGoalLines` y `composeWeekEntryLine`, que son la
 * única fuente de literales de la tarjeta. Aquí no se escribe ninguna cadena de texto:
 * si un literal cambia, cambia en `goal.js` y en todas partes a la vez.
 *
 * Sin meta, `computeProgress` devuelve `null` y no hay barra que pintar, que es el
 * estado sin objetivo de RF-1 y RF-17. Con meta, la barra y el texto cuentan lo mismo,
 * y el objetivo cumplido se pinta solo con su línea, sin porcentaje ni restantes
 * (RF-32, y RF-33: ningún aviso ni animación añadida).
 *
 * Los minutos y el progreso se calculan aquí con el `TODAY` congelado de la carga y se
 * le pasan ya hechos a `composeGoalLines`, que no recibe fechas.
 */
function renderGoalCard(sessions) {
  // Sin meta no se calculan minutos ni progreso: no hay contra qué medirlos (RF-17).
  const minutes = goalRecord === null ? null : getValidMinutesForWeek(sessions, TODAY);
  const progress = goalRecord === null ? null : computeProgress(minutes, goalRecord.value);

  const state = {
    hasGoal: goalRecord !== null,
    goalValue: goalRecord === null ? null : goalRecord.value,
    minutes,
    progress
  };

  const lineas = composeGoalLines(state);

  goalStatus.textContent = lineas.status;
  goalForm.hidden = goalRecord !== null;

  paintGoalBar(progress, lineas.valueText);
  paintGoalLine(goalProgress, lineas.progress);
  paintGoalLine(goalRemaining, lineas.remaining);
  paintGoalLine(goalMet, lineas.met);

  paintGoalHistory();
  renderGoalWarning();
}

/**
 * Resuelve una vez el estado del objetivo al cargar (RF-21, RF-22, RF-26, RF-38, RF-39,
 * RF-40).
 *
 * Es el orden exacto que fija el plan §6.1, y el orden es el contenido:
 *
 * 1. Leer y validar la meta, descartando la que no serve (RF-38).
 * 2. Leer el historial, ya normalizado al leer (RF-37).
 * 3. Sellar las semanas cerradas, en memoria.
 * 4. Escribir, una sola vez y solo si ha cambiado.
 * 5. Pintar, con el historial ya sellado y guardado (RF-22).
 *
 * Sellar antes de pintar es lo que hace que en la misma carga en que se sella el
 * historial esté visible y guardado. Al revés, el usuario vería una lista sin las
 * semanas nuevas hasta la siguiente recarga.
 */
function initGoal(sessions) {
  goalRecord = loadGoal();
  weeks = loadWeeks();

  // El sellado va después de leer y validar, y antes de que nada se pinte.
  sealAndPersistWeeks(sessions);

  renderGoalCard(sessions);
}

/* ------------------------------------------------------ Presentación */

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderSessions(sessions) {
  sessionsList.innerHTML = '';

  if (sessions.length === 0) {
    emptyMessage.hidden = false;
    return;
  }

  emptyMessage.hidden = true;

  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return b.id - a.id;
  });

  sortedSessions.forEach((session) => {
    // La sesión inválida se conserva y se muestra marcada, nunca se oculta ni se borra.
    const reason = getInvalidReason(session);
    const li = document.createElement('li');
    li.className = reason ? 'session-item is-invalid' : 'session-item';

    const meta = isValidDateKey(session.date)
      ? formatDate(session.date)
      : 'Fecha no válida';
    const minutes = isValidMinutes(session.minutes)
      ? session.minutes + ' min'
      : '— min';

    li.innerHTML = `
      <div class="session-info">
        <span class="session-topic">${escapeHtml(session.topic || '(sin tema)')}</span>
        <span class="session-meta">${escapeHtml(meta)}</span>
        ${reason ? '<span class="session-invalid-flag">datos no válidos</span>' : ''}
      </div>
      <span class="session-minutes">${escapeHtml(minutes)}</span>
    `;
    sessionsList.appendChild(li);
  });
}

/* --------------------------------------------------------- Mapa de calor */

function renderHeatmap(sessions) {
  currentMap = buildHeatmap(sessions, TODAY);

  heatmapGrid.innerHTML = '';

  // Siete filas: una por día de la semana, de lunes a domingo.
  // Cada fila contiene las 27 columnas, de la semana más antigua a la más reciente.
  for (let rowIndex = 0; rowIndex < 7; rowIndex++) {
    const row = document.createElement('div');
    row.className = 'heatmap-row';
    row.setAttribute('role', 'row');

    for (let columnIndex = 0; columnIndex < 27; columnIndex++) {
      row.appendChild(createHeatmapCell(currentMap.columns[columnIndex][rowIndex]));
    }

    heatmapGrid.appendChild(row);
  }

  heatmapDetail.textContent = '';
  renderHeatmapWarning();
}

function createHeatmapCell(cell) {
  const element = document.createElement('div');
  element.className = 'heatmap-cell';
  element.setAttribute('role', 'gridcell');
  element.dataset.level = String(cell.level);
  element.dataset.date = cell.date;
  element.dataset.index = String(cell.index);
  element.tabIndex = -1;

  // Una sola celda es alcanzable con Tab: el resto se recorre con las flechas.
  if (cell.date === TODAY) {
    element.tabIndex = 0;
    focusedCellIndex = cell.index;
  }

  element.setAttribute('aria-label', getCellLabel(cell));
  return element;
}

function renderHeatmapWarning() {
  // El aviso depende de dos cosas independientes: que haya datos ilegibles y que
  // el almacenamiento se pueda leer. Sin almacenamiento no hay aviso que dar.
  if (!storageAvailable || currentMap.invalidTotal === 0) {
    heatmapWarning.hidden = true;
    heatmapWarning.textContent = '';
    return;
  }

  const { fecha, minutos } = currentMap.invalidByReason;
  const partes = [];
  if (fecha > 0) partes.push(fecha + ' con fecha no válida');
  if (minutos > 0) partes.push(minutos + ' con minutos no válidos');

  const total = currentMap.invalidTotal;
  const encabezado =
    total === 1
      ? '1 sesión con datos no válidos no se ha incluido en el mapa ('
      : total + ' sesiones con datos no válidos no se han incluido en el mapa (';

  heatmapWarning.textContent =
    encabezado + partes.join(' y ') + '). Siguen guardadas y visibles en el historial.';
  heatmapWarning.hidden = false;
}

function showCellDetail(cell) {
  heatmapDetail.textContent = formatCellDetail(cell);
}

function clearCellDetail() {
  heatmapDetail.textContent = '';
}

function cellFromEvent(event) {
  const target = event.target.closest('.heatmap-cell');
  if (!target || !heatmapGrid.contains(target)) return null;
  const index = Number(target.dataset.index);
  return currentMap && currentMap.cells[index] ? currentMap.cells[index] : null;
}

function setFocusedCell(index, moveFocus) {
  const previous = heatmapGrid.querySelector('.heatmap-cell[tabindex="0"]');
  if (previous) previous.tabIndex = -1;

  const next = heatmapGrid.querySelector('.heatmap-cell[data-index="' + index + '"]');
  if (!next) return;

  next.tabIndex = 0;
  focusedCellIndex = index;
  if (moveFocus) next.focus();
}

/* ---------------------------------------------------------- Ciclo de UI */

function updateUI() {
  const sessions = loadSessions();

  streakValue.textContent = calculateStreak(sessions, TODAY);
  bestStreakValue.textContent = calculateBestStreak(sessions);
  weeklyValue.textContent = calculateWeeklyTotal(sessions, TODAY);
  monthlyValue.textContent = calculateMonthlyDays(sessions, TODAY);

  renderSessions(sessions);
  renderHeatmap(sessions);
}

/**
 * Muestra u oculta el mensaje de error del formulario de meta (RF-3).
 *
 * El elemento ya tiene `role="alert"` y está asociado al campo con
 * `aria-describedby`, así que aquí solo se escribe el texto y se decide si se ve. Como
 * es `alert`, un lector de pantalla lo anuncia en cuanto aparece, sin necesidad de
 * otraLive region (RFN-8).
 */
function showGoalError() {
  goalError.textContent =
    'La meta debe ser un número entero entre 10 y 10080.';
  goalError.hidden = false;
}

function hideGoalError() {
  goalError.textContent = '';
  goalError.hidden = true;
}

/**
 * Manejador del formulario de meta (RF-2, RF-3, RF-4, RF-5, RF-7, RF-8).
 *
 * Tres caminos, y solo tres:
 *
 * - El texto no cumple RF-4: se muestra el mensaje, no se guarda nada y el campo se
 *   queda con EXACTAMENTE lo que el usuario escribió, para que pueda corregirlo. No se
 *   limpia ni se normaliza el campo.
 * - El texto cumple pero la escritura falla: no se muestra el estado con meta, no se
 *   muestra el aviso de RF-38 y el formulario sigue visible con lo escrito. Por eso no
 *   se llama a `renderGoalCard` en ese caso: el estado guardado sigue siendo "sin
 *   meta", así que pintarlo mentiría.
 * - El texto cumple y se guarda: se pinta la tarjeta, que retira el formulario (RF-5).
 *
 * Con la meta ya fijada el formulario no vuelve a salir: `renderGoalCard` lo deja
 * oculto siempre que `goalRecord` exista, y `goalRecord` solo se rellena al leer del
 * almacenamiento o al guardar bien.
 *
 * `parseGoalInput` no lanza y devuelve `null` ante cualquier formato inválido, así que
 * no hace falta envolverlo. El criterio de qué es válido vive entero en `goal.js`
 * (RFN-2).
 */
goalForm.addEventListener('submit', (e) => {
  e.preventDefault();

  // Se lee el campo tal cual, sin recortar: es lo que el usuario escribió.
  const value = parseGoalInput(goalValueInput.value);

  if (value === null) {
    showGoalError();
    return;
  }

  hideGoalError();

  // `buildGoalRecord` calcula `setAt` con el hoy congelado de la carga y
  // `setAtWeekStart` con el lunes de esa semana (RF-7).
  const record = buildGoalRecord(value, TODAY);

  if (!saveGoal(record)) {
    // La escritura falló: el almacenamiento guardado sigue sin meta. El formulario
    // se queda visible con lo escrito y no se toca el resto de la interfaz (RF-8).
    return;
  }

  // Solo ahora la meta existe de verdad, así que sí se repinta y el formulario se
  // retira. No hay forma de modificar ni de borrar la meta (RF-5).
  goalRecord = record;
  goalValueInput.value = '';
  renderGoalCard(loadSessions());
});

/* ------------------------------------------------------------ Eventos */

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const date = dateInput.value;
  const topic = topicInput.value.trim();
  const minutes = parseInt(minutesInput.value, 10);

  if (!date || !topic || !minutes || minutes <= 0) return;

  const sessions = loadSessions();
  sessions.push({
    id: Date.now(),
    date,
    topic,
    minutes
  });
  saveSessions(sessions);

  form.reset();
  dateInput.value = TODAY;

  updateUI();

  // La tarjeta de objetivo se repinta con la MISMA lista de sesiones que acaba de
  // guardar y leer `updateUI`, sin una segunda lectura del almacenamiento: una sesión
  // nueva cambia los minutos de su semana y con ellos la barra y los textos.
  //
  // Solo repinta. NO sella: una semana cerrada ya tiene su anotación, y sellar aquí
  // convertiría en un dato lo que aún es la semana en curso. El sellado es trabajo del
  // arranque, en `initGoal` (RF-27, RF-43).
  //
  // `renderGoalCard` recalcula los minutos de la semana actual desde cero con el
  // `TODAY` congelado en la carga, así que una sesión de otra semana deja la tarjeta
  // igual de contenido (RF-19) y una de esta semana la mueve sin recargar (RF-18).
  // Una sesión retroactiva de esta semana cuenta igual, porque el progreso se mide
  // contra la semana completa y no desde el momento de fijar la meta (RF-20).
  renderGoalCard(sessions);
});

// Puntero y foco comparten el mismo manejador: no hay dos rutas que puedan divergir.
heatmapGrid.addEventListener('pointerover', (e) => {
  const cell = cellFromEvent(e);
  if (cell) showCellDetail(cell);
});

heatmapGrid.addEventListener('pointerleave', clearCellDetail);

heatmapGrid.addEventListener('pointerdown', (e) => {
  const cell = cellFromEvent(e);
  if (!cell) return;
  setFocusedCell(cell.index, false);
  showCellDetail(cell);
});

heatmapGrid.addEventListener('focusin', (e) => {
  const cell = cellFromEvent(e);
  if (!cell) return;
  setFocusedCell(cell.index, false);
  showCellDetail(cell);
});

heatmapGrid.addEventListener('focusout', clearCellDetail);

heatmapGrid.addEventListener('keydown', (e) => {
  const cell = cellFromEvent(e);
  if (!cell) return;

  if (e.key === 'Home') {
    e.preventDefault();
    setFocusedCell(0, true);
    return;
  }

  if (e.key === 'End') {
    e.preventDefault();
    setFocusedCell(currentMap.cells.length - 1, true);
    return;
  }

  const next = moveFocusCell(cell.index, e.key, currentMap.shape);
  if (next === null) return; // borde alcanzado: el foco se queda donde está

  e.preventDefault();
  setFocusedCell(next, true);
});

/* --------------------------------------------------------- Arranque */

dateInput.value = TODAY;

// El encabezado de la tarjeta se pinta desde `GOAL_CARD_TITLE` para que el literal de
// RF-28 tenga una sola fuente y el test del archivo puro compruebe de verdad lo que se
// ve. `textContent` sustituye el texto del `<h2>`, no lo añade, así que no puede quedar
// duplicado en pantalla, y el `<h2>` no está dentro de ninguna región `aria-live`, así que
// tampoco se anuncia dos veces. El literal sigue estando en el marcado: si el script no
// llegara a ejecutarse, el encabezado se vería igual.
goalCardTitle.textContent = GOAL_CARD_TITLE;

// El objetivo se resuelve con las mismas sesiones que pintan las métricas, y con el
// mismo `TODAY` congelado: una sola lectura y una sola fecha para toda la carga.
initGoal(loadSessions());
updateUI();