const test = require('node:test');
const assert = require('node:assert/strict');

const heatmap = require('./heatmap.js');

const {
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
  moveFocusCell
} = heatmap;

// 2026-10-02 es viernes. Ningún test usa el reloj del sistema.
const TODAY = '2026-10-02';
const TODAY_CELL_INDEX = 26 * 7 + 4; // última columna, fila del viernes
const SHAPE = { columns: 27, rows: 7 };

const session = (date, minutes = 30) => ({ date, topic: 'Tema', minutes });
const cellAt = (map, date) => map.cells.find((cell) => cell.date === date);

/* ---------------------------------------------------------------- RF-22 */

test('isValidDateKey acepta una fecha real en formato AAAA-MM-DD', () => {
  assert.equal(isValidDateKey('2026-10-02'), true);
  assert.equal(isValidDateKey('2026-01-31'), true);
});

test('isValidDateKey rechaza formato incorrecto', () => {
  assert.equal(isValidDateKey('02-10-2026'), false);
  assert.equal(isValidDateKey('2026/10/02'), false);
  assert.equal(isValidDateKey('2026-10-2'), false);
  assert.equal(isValidDateKey('ayer'), false);
});

test('isValidDateKey rechaza cadena vacía y valores no textuales', () => {
  assert.equal(isValidDateKey(''), false);
  assert.equal(isValidDateKey(null), false);
  assert.equal(isValidDateKey(undefined), false);
  assert.equal(isValidDateKey(1750000000000), false);
  assert.equal(isValidDateKey({}), false);
});

test('isValidDateKey rechaza mes fuera de 1 a 12', () => {
  assert.equal(isValidDateKey('2026-00-15'), false);
  assert.equal(isValidDateKey('2026-13-15'), false);
});

test('isValidDateKey rechaza día fuera del rango del mes', () => {
  assert.equal(isValidDateKey('2026-01-32'), false);
  assert.equal(isValidDateKey('2026-01-00'), false);
  assert.equal(isValidDateKey('2026-04-31'), false);
});

test('isValidDateKey aplica el calendario al 29 de febrero', () => {
  assert.equal(isValidDateKey('2028-02-29'), true); // bisiesto
  assert.equal(isValidDateKey('2026-02-29'), false); // no bisiesto
});

/* ---------------------------------------------------------------- RF-23 */

test('isValidMinutes acepta enteros mayores o iguales que 1', () => {
  assert.equal(isValidMinutes(1), true);
  assert.equal(isValidMinutes(45), true);
  assert.equal(isValidMinutes(100000), true);
});

test('isValidMinutes rechaza ausentes, no numéricos y decimales', () => {
  assert.equal(isValidMinutes(undefined), false);
  assert.equal(isValidMinutes(null), false);
  assert.equal(isValidMinutes('45'), false);
  assert.equal(isValidMinutes(45.7), false);
  assert.equal(isValidMinutes(0.5), false);
});

test('isValidMinutes rechaza cero y negativos', () => {
  assert.equal(isValidMinutes(0), false);
  assert.equal(isValidMinutes(-1), false);
  assert.equal(isValidMinutes(-45.5), false);
});

test('getInvalidReason distingue los dos motivos', () => {
  assert.equal(getInvalidReason(session('2026-10-02', 30)), null);
  assert.equal(getInvalidReason(session('nope', 30)), 'fecha');
  assert.equal(getInvalidReason(session('2026-10-02', 0)), 'minutos');
  // La fecha tiene prioridad: si ambas fallan, se informa de la fecha.
  assert.equal(getInvalidReason(session('nope', 0)), 'fecha');
});

/* ------------------------------------------- RF-4, RF-5, RF-28, helpers */

test('addDays suma y resta cruzando meses y años', () => {
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-10-01', -1), '2026-09-30');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
});

test('weekdayIndex usa 0 para lunes y 6 para domingo', () => {
  assert.equal(weekdayIndex('2026-09-28'), 0); // lunes
  assert.equal(weekdayIndex('2026-10-02'), 4); // viernes
  assert.equal(weekdayIndex('2026-10-04'), 6); // domingo
});

test('getWeekStartMonday retrocede hasta el lunes de la semana', () => {
  assert.equal(getWeekStartMonday('2026-09-28'), '2026-09-28'); // ya es lunes
  assert.equal(getWeekStartMonday('2026-10-02'), '2026-09-28'); // viernes
  assert.equal(getWeekStartMonday('2026-10-04'), '2026-09-28'); // domingo
});

test('getWindowBounds va del lunes de hace 26 semanas al domingo de la semana en curso', () => {
  assert.deepEqual(getWindowBounds(TODAY), { start: '2026-03-30', end: '2026-10-04' });
});

/* ------------------------------------------------------ RF-8, RF-10 */

test('getIntensityLevel clasifica los once valores límite', () => {
  assert.equal(getIntensityLevel(0), 0);
  assert.equal(getIntensityLevel(1), 1);
  assert.equal(getIntensityLevel(29), 1);
  assert.equal(getIntensityLevel(30), 2);
  assert.equal(getIntensityLevel(59), 2);
  assert.equal(getIntensityLevel(60), 3);
  assert.equal(getIntensityLevel(119), 3);
  assert.equal(getIntensityLevel(120), 4);
  assert.equal(getIntensityLevel(239), 4);
  assert.equal(getIntensityLevel(240), 5);
  assert.equal(getIntensityLevel(99999), 5);
});

test('getIntensityLevel nunca devuelve un estado por encima del 5', () => {
  for (const minutes of [240, 241, 1000, 99999, 10 ** 9]) {
    assert.ok(getIntensityLevel(minutes) <= 5);
  }
});

test('getIntensityLevel con negativos cae en el gris de inactividad', () => {
  assert.equal(getIntensityLevel(-30), 0);
});

/* ------------------------------------------ RF-19, RF-21, RF-22, RF-23 */

test('partitionSessions separa válidas e inválidas y cuenta por motivo', () => {
  const input = [
    session('2026-10-02', 30),
    session('2026-10-01', 0),
    session('2026-13-01', 30),
    session('2026-10-01', 45)
  ];
  const result = partitionSessions(input);

  assert.equal(result.valid.length, 2);
  assert.equal(result.invalidTotal, 2);
  assert.deepEqual(result.invalidByReason, { fecha: 1, minutos: 1 });
});

test('partitionSessions no modifica ni descarta ninguna sesión de la entrada', () => {
  const invalid = session('2026-13-01', -5);
  const input = [session('2026-10-02', 30), invalid];
  const copia = JSON.parse(JSON.stringify(input));

  partitionSessions(input);

  assert.deepEqual(input, copia);
  assert.equal(input[1], invalid);
});

/* ------------------------------------- RF-1, RF-2, RF-4, RF-5, RF-8 */

test('buildHeatmap produce 27 columnas de 7 celdas, 189 en total', () => {
  const map = buildHeatmap([], TODAY);

  assert.equal(map.columns.length, 27);
  assert.equal(map.cells.length, 189);
  map.columns.forEach((column) => assert.equal(column.length, 7));
});

test('buildHeatmap mantiene la alineación vertical: cada celda cae en la fila de su día', () => {
  const map = buildHeatmap([], TODAY);

  map.cells.forEach((cell) => {
    assert.equal(cell.row, weekdayIndex(cell.date));
  });
});

test('buildHeatmap ordena las columnas de más antigua a más reciente', () => {
  const map = buildHeatmap([], TODAY);

  assert.equal(map.columns[0][0].date, '2026-03-30'); // lunes más antiguo
  assert.equal(map.columns[0][0].row, 0);

  const lastColumn = map.columns[26];
  assert.equal(lastColumn[4].date, TODAY); // hoy, viernes
  assert.equal(lastColumn[4].row, 4);
  assert.equal(lastColumn[4].index, TODAY_CELL_INDEX);
});

test('buildHeatmap termina el rango en el domingo de la semana en curso', () => {
  const map = buildHeatmap([], TODAY);

  assert.equal(map.cells[map.cells.length - 1].date, '2026-10-04');
  assert.equal(map.cells[map.cells.length - 1].row, 6);
});

test('buildHeatmap suma los minutos de varias sesiones del mismo día (RF-9)', () => {
  const map = buildHeatmap(
    [session(TODAY, 20), session(TODAY, 15), session(TODAY, 10)],
    TODAY
  );
  const cell = cellAt(map, TODAY);

  assert.equal(cell.minutes, 45);
  assert.equal(cell.level, 2); // 45 minutos es nivel 2, no el nivel de 20 ni el de 15
});

test('buildHeatmap excluye del total una sesión inválida de la misma fecha (RF-11)', () => {
  const map = buildHeatmap(
    [session(TODAY, 40), { date: TODAY, topic: 'X', minutes: 0 }],
    TODAY
  );
  const cell = cellAt(map, TODAY);

  assert.equal(cell.minutes, 40);
  assert.equal(cell.level, 2);
  assert.equal(map.invalidTotal, 1);
  assert.equal(map.invalidByReason.minutos, 1);
});

test('una fecha con solo sesiones inválidas queda gris y sin actividad (RF-13)', () => {
  const map = buildHeatmap(
    [{ date: '2026-09-29', topic: 'X', minutes: 0 }],
    TODAY
  );
  const cell = cellAt(map, '2026-09-29');

  assert.equal(cell.minutes, 0);
  assert.equal(cell.level, 0);
  assert.equal(cell.hasActivity, false);
  assert.equal(map.invalidTotal, 1);
});

/* ------------------------------------------------------ RF-14, RF-15 */

test('una fecha futura con sesión válida recibe su intensidad real (RF-14)', () => {
  const map = buildHeatmap([session('2026-10-03', 90)], TODAY);
  const cell = cellAt(map, '2026-10-03');

  assert.equal(cell.isFuture, true);
  assert.equal(cell.minutes, 90);
  assert.equal(cell.level, 3);
  assert.equal(cell.hasActivity, true);
});

test('una fecha futura sin sesión válida queda gris (RF-15)', () => {
  const map = buildHeatmap([], TODAY);
  const cell = cellAt(map, '2026-10-03');

  assert.equal(cell.isFuture, true);
  assert.equal(cell.level, 0);
  assert.equal(cell.hasActivity, false);
});

/* --------------------------------------------------------- RF-28 */

test('las sesiones fuera de la ventana no se representan ni generan aviso (RF-28)', () => {
  const map = buildHeatmap(
    [session('2026-03-29', 60), session('2026-10-10', 60), session(TODAY, 60)],
    TODAY
  );

  assert.equal(map.cells.find((c) => c.date === '2026-03-29'), undefined);
  assert.equal(map.cells.find((c) => c.date === '2026-10-10'), undefined);
  assert.equal(map.outsideWindow, 2);
  assert.equal(map.invalidTotal, 0); // no son datos inválidos, solo fuera de rango
});

/* ------------------------------------------------------ RF-6, RF-7 */

test('sin sesiones el mapa está vacío y sin aviso (RF-6)', () => {
  const map = buildHeatmap([], TODAY);

  assert.equal(map.cells.length, 189);
  assert.ok(map.cells.every((cell) => cell.level === 0));
  assert.ok(map.cells.every((cell) => cell.hasActivity === false));
  assert.equal(map.invalidTotal, 0);
});

test('solo con sesiones inválidas el mapa está vacío pero con aviso (RF-7)', () => {
  const map = buildHeatmap(
    [{ date: 'x', minutes: 1 }, { date: TODAY, minutes: -3 }],
    TODAY
  );

  assert.equal(map.cells.length, 189);
  assert.ok(map.cells.every((cell) => cell.level === 0));
  assert.equal(map.invalidTotal, 2);
  assert.deepEqual(map.invalidByReason, { fecha: 1, minutos: 1 });
});

/* ------------------------------------------- RF-16, RFN-6, RFN-8 */

test('el texto de detalle distingue los tres casos de la tabla de la spec', () => {
  const map = buildHeatmap([session('2026-09-15', 90)], TODAY);

  assert.equal(
    formatCellDetail(cellAt(map, '2026-09-15')),
    'martes, 15 de septiembre — 90 min'
  );
  assert.equal(
    formatCellDetail(cellAt(map, '2026-09-28')),
    'lunes, 28 de septiembre — sin sesiones'
  );
  assert.equal(
    formatCellDetail(cellAt(map, '2026-10-03')),
    'sábado, 3 de octubre — aún no ha llegado'
  );
});

test('el detalle de hoy sin sesiones dice "sin sesiones", no "aún no ha llegado"', () => {
  const map = buildHeatmap([], TODAY);
  assert.equal(
    formatCellDetail(cellAt(map, TODAY)),
    'viernes, 2 de octubre — sin sesiones'
  );
});

test('los minutos se escriben como entero sin separador de millares', () => {
  const map = buildHeatmap([session('2026-09-15', 1440)], TODAY);
  assert.equal(
    formatCellDetail(cellAt(map, '2026-09-15')),
    'martes, 15 de septiembre — 1440 min'
  );
});

test('el texto accesible y el detalle visible son idénticos (RFN-6)', () => {
  const map = buildHeatmap([session('2026-09-15', 90)], TODAY);
  map.cells.forEach((cell) => {
    assert.equal(getCellLabel(cell), formatCellDetail(cell));
  });
});

/* ------------------------------------------- RF-29, RF-31 */

// Las celdas se indexan como columna * 7 + fila: avanzar de fila suma 1,
// avanzar de columna suma 7.
test('las flechas abajo y arriba se mueven dentro de la misma columna', () => {
  assert.equal(moveFocusCell(0, 'ArrowDown', SHAPE), 1);
  assert.equal(moveFocusCell(9, 'ArrowUp', SHAPE), 8);
});

test('las flechas derecha e izquierda se mueven dentro de la misma fila', () => {
  assert.equal(moveFocusCell(0, 'ArrowRight', SHAPE), 7);
  assert.equal(moveFocusCell(7, 'ArrowLeft', SHAPE), 0);
});

test('en los cuatro bordes el foco no se mueve y se devuelve null (RF-31)', () => {
  assert.equal(moveFocusCell(0, 'ArrowLeft', SHAPE), null); // primera columna
  assert.equal(moveFocusCell(6, 'ArrowLeft', SHAPE), null); // primera columna, última fila
  assert.equal(moveFocusCell(182, 'ArrowRight', SHAPE), null); // última columna
  assert.equal(moveFocusCell(188, 'ArrowRight', SHAPE), null); // última columna, última fila
  assert.equal(moveFocusCell(0, 'ArrowUp', SHAPE), null); // primera fila
  assert.equal(moveFocusCell(182, 'ArrowUp', SHAPE), null); // primera fila, última columna
  assert.equal(moveFocusCell(6, 'ArrowDown', SHAPE), null); // última fila
  assert.equal(moveFocusCell(188, 'ArrowDown', SHAPE), null); // última fila, última columna
});

test('una tecla que no es una flecha devuelve null', () => {
  assert.equal(moveFocusCell(10, 'Enter', SHAPE), null);
  assert.equal(moveFocusCell(10, 'a', SHAPE), null);
});

test('veintiséis flechas a la derecha llevan de la primera a la última columna', () => {
  let index = 0;
  for (let step = 0; step < 26; step++) {
    index = moveFocusCell(index, 'ArrowRight', SHAPE);
  }
  assert.equal(index, 26 * 7); // columna 26, fila 0
});

test('bajar seis veces desde la fila 0 se detiene en la última celda de la columna', () => {
  let index = 0;
  for (let step = 0; step < 6; step++) {
    index = moveFocusCell(index, 'ArrowDown', SHAPE);
  }
  assert.equal(index, 6); // columna 0, fila 6
});

/* ----------------------------------------- RFN-3, RFN-4, RF-26 */

test('dos llamadas seguidas con la misma entrada dan la misma estructura', () => {
  const sessions = [session(TODAY, 45), session('2026-09-15', 300)];
  assert.deepEqual(buildHeatmap(sessions, TODAY), buildHeatmap(sessions, TODAY));
});

test('la ventana no depende del momento en que se ejecuta', () => {
  const dias = [];
  for (let i = 0; i < 5; i++) {
    dias.push(buildHeatmap([], TODAY).start);
  }
  assert.equal(new Set(dias).size, 1);
});

test('cambiar el today de parámetro cambia la ventana sin tocar las sesiones', () => {
  const sessions = [session('2026-10-03', 60)];
  const antes = buildHeatmap(sessions, TODAY);
  const despues = buildHeatmap(sessions, '2026-10-09');

  assert.equal(cellAt(antes, '2026-10-03').isFuture, true);
  assert.equal(cellAt(despues, '2026-10-03').isFuture, false);
  assert.equal(antes.end, '2026-10-04');
  assert.equal(despues.end, '2026-10-11');
});

test('las funciones puras de heatmap.js no contienen llamadas al reloj del sistema', () => {
  // La spec lo exige en RFN-3 y en el principio 3 de la constitución: si alguien
  // introduce new Date() sin argumentos o Date.now() dentro de la lógica pura,
  // los tests dejan de ser deterministas y este test lo detecta.
  const source = require('node:fs').readFileSync(require.resolve('./heatmap.js'), 'utf8');
  const sinComentarios = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  assert.equal(/\bnew Date\s*\(\s*\)/.test(sinComentarios), false);
  assert.equal(/\bDate\.now\s*\(\s*\)/.test(sinComentarios), false);
});