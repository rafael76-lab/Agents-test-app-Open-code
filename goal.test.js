/**
 * Tests de la lógica pura del objetivo semanal (`goal.js`).
 *
 * A2 — Andamiaje. Este archivo fija el orden de carga que exige RFN-5 y deja
 * constancia de que ninguna fecha se obtiene del reloj del sistema (RFN-6). Los
 * bloques siguientes añaden los tests de cada tarea, escritos antes que la función
 * que comprueban.
 *
 * RFN-5: el orden de los `require` es contrato, no preferencia. `goal.js`
 * resuelve sus dependencias al cargarse y espera encontrar disponibles las de
 * `diary.js` y `heatmap.js`. Se escribe en ese orden y no se reordena.
 *
 * RFN-6: en todo este fichero las fechas son cadenas literales. No hay ni un
 * `new Date()` sin argumentos ni un `Date.now()`, aquí ni en los tests que se
 * añadan después. La única fuente de "hoy" es la constante `TODAY` de más abajo.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// Orden obligatorio (RFN-5).
const diary = require('./diary.js');
const heatmap = require('./heatmap.js');
const goal = require('./goal.js');

// Fechas de referencia del plan §11. Son cadenas, nunca fechas del reloj.
const TODAY = '2026-10-02'; // viernes
const WEEK_START = '2026-09-28'; // lunes de esa semana
const YEAR_CROSS_WEEK_START = '2025-12-29'; // lunes que cruza el 31 de diciembre

/**
 * A3 — Red de seguridad determinista (RFN-3, RFN-4).
 *
 * Mismo criterio que el test equivalente de `heatmap.test.js`: el archivo puro
 * no puede leer el reloj del sistema ni convertir fechas a UTC. Aquí se amplía
 * con `toISOString`, que en `goal.js` sería el mismo bug de huso que ya costó
 * tiempo en el mapa de calor.
 */

/**
 * Deja solo el código ejecutable de un fuente: borra comentarios de línea y de
 * bloque, y literales de cadena, plantilla y expresión regular, dejando un hueco
 * en su lugar para que los números de línea no cambien.
 *
 * `heatmap.test.js` quita únicamente los comentarios con dos `replace`. Eso
 * basta para no dar falsos positivos mientras los nombres prohibidos solo
 * aparezcan en prosa, pero en cuanto un texto legítimo los mencione —un mensaje
 * de la interfaz que explica la regla, o un literal de cadena que los contiene—
 * el test saltaría sin motivo. Aquí el criterio es *código*, no *texto*.
 *
 * Los literales de expresión regular se distinguen de una división por el carácter
 * anterior: un `/x/` solo puede empezar tras un signo que nunca precede a un
 * operando, así que la división se conserva intacta y el patrón se borra. Las
 * cadenas se limpian antes que los comentarios no hacen falta: el recorrido es de
 * izquierda a derecha y cada constructor consume su propio texto, de modo que un
 * `"//"` dentro de una cadena no se confunde con un comentario.
 */

// Caracteres tras los cuales una barra inicia una expresión regular, no una división.
const INICIA_REGEX = new Set([
  '=', '(', ',', ':', ';', '[', '!', '&', '|', '?', '{', '}', '+', '-', '*', '%',
  '^', '~', '<', '>', '=', '\n'
]);

/** Devuelve el último carácter no blanco ya escrito, o '' si no hay ninguno. */
function ultimoSignificativo(out) {
  for (let k = out.length - 1; k >= 0; k--) {
    if (!/\s/.test(out[k])) return out[k];
  }
  return '';
}

/** Consume una cadena con comillas simples o dobles, saltando escapes. */
function consumeCadena(source, i) {
  const cierre = source[i];
  i += 1;
  while (i < source.length) {
    if (source[i] === '\\') { i += 2; continue; }
    if (source[i] === cierre) return i + 1;
    i += 1;
  }
  return i;
}

/**
 * Consume una plantilla. Las interpolaciones `${...}` contienen código real, pero
 * no pueden construir una fecha del reloj sin las tres llamadas prohibidas en este
 * fichero, así que perderlas no abre un hueco de riesgo.
 */
function consumePlantilla(source, i) {
  i += 1;
  while (i < source.length) {
    if (source[i] === '\\') { i += 2; continue; }
    if (source[i] === '`') return i + 1;
    i += 1;
  }
  return i;
}

function soloCodigo(source) {
  let out = '';
  let i = 0;

  while (i < source.length) {
    const c = source[i];

    // Comentario de línea.
    if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }

    // Comentario de bloque.
    if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }

    if (c === '"' || c === "'") {
      i = consumeCadena(source, i);
      out += '""';
      continue;
    }

    if (c === '`') {
      i = consumePlantilla(source, i);
      out += '``';
      continue;
    }

    // Literal de expresión regular.
    if (c === '/' && INICIA_REGEX.has(ultimoSignificativo(out))) {
      let j = i + 1;
      let enClase = false;
      let cerrado = false;
      while (j < source.length) {
        const d = source[j];
        if (d === '\\') { j += 2; continue; }
        if (d === '\n') break;
        if (d === '[') enClase = true;
        else if (d === ']') enClase = false;
        else if (d === '/' && !enClase) { j += 1; cerrado = true; break; }
        j += 1;
      }
      if (cerrado) {
        while (j < source.length && /[a-z]/.test(source[j])) j += 1;
        i = j;
        out += '/regex/';
        continue;
      }
    }

    out += c;
    i += 1;
  }

  return out;
}

/** Los tres patrones prohibidos, con el mismo criterio que en `heatmap.test.js`. */
const PROHIBIDOS = [
  { nombre: 'toISOString', patron: /\btoISOString\b/ },
  { nombre: 'Date.now()', patron: /\bDate\s*\.\s*now\s*\(/ },
  { nombre: 'new Date() sin argumentos', patron: /\bnew\s+Date\s*\(\s*\)/ }
];

/**
 * Busca los patrones prohibidos en un fuente ya reducido a código.
 * Devuelve la lista de nombres encontrados, vacía si no hay ninguno.
 */
function encuentraProhibidos(source) {
  const codigo = soloCodigo(source);
  return PROHIBIDOS
    .filter(({ patron }) => patron.test(codigo))
    .map(({ nombre }) => nombre);
}

test('goal.js no usa toISOString, Date.now ni new Date() sin argumentos', () => {
  // Principio 3 de la constitución y RFN-3/RFN-4: `today` entra siempre como
  // parámetro. Si alguien introduce aquí una de estas tres llamadas, los tests
  // dejan de ser deterministas y este test lo detecta antes de que se note.
  const source = require('node:fs').readFileSync(require.resolve('./goal.js'), 'utf8');

  assert.deepEqual(encuentraProhibidos(source), []);
});

// Autocomprobación del detector: sin esto, un fallo en `soloCodigo` o en los
// patrones dejaría el test de arriba verde siempre, y verde sin comprobar nada.
test('el detector distingue el código prohibido del que solo se menciona', () => {
  const prohibido = [
    'const a = d.toISOString();',
    'const b = Date.now();',
    'const c = new Date();',
    'const d = new Date ( );',
    'const e = Date . now();'
  ];

  for (const linea of prohibido) {
    assert.ok(encuentraProhibidos(linea).length > 0, `debería detectar: ${linea}`);
  }

  const permitido = [
    'const a = toLocalDateString(date);',
    'const b = localDateFromKey(key);',
    'const c = new Date("2026-10-02");',
    'const d = addDays(date, 1);',
    // Menciones legítimas dentro de comentarios, cadenas y plantillas.
    '// nunca uses toISOString()',
    '/* Date.now() y new Date() están prohibidos aquí */',
    'const msg = "No se usa toISOString";',
    "const msg = 'Date.now()';",
    'const msg = `nunca new Date()`;',
    'const patron = /toISOString/'
  ];

  for (const linea of permitido) {
    assert.deepEqual(encuentraProhibidos(linea), [], `no debería detectar: ${linea}`);
  }
});

/**
 * B1 — Tests de `parseGoalInput`, escritos antes que la función (RF-3, RF-4).
 *
 * RF-4 fija el criterio: primero se eliminan los espacios periféricos y después
 * se exige que el resultado sea un entero finito dentro de [10, 10080]. Se
 * rechazan el resto de formatos. RF-3 depende de esta función pero no la
 * implementa: decide qué se acepta, el mensaje de error es cosa de `app.js`.
 *
 * Nota sobre "número" en la lista de casos de B1: se cubre con valores numéricos
 * que no son enteros escritos con cifras ocidentales (10.5, 600.5, NaN,
 * Infinity). Un `600` numérico caería en la parte de la regla que convierte a
 * texto y exige `/^\d+$/`, así que rechazarlo iría contra la propia B2. Los tests
 * no fijan por tanto una lectura que la implementación prescrita contradice.
 */

const MIN = goal.GOAL_MIN;
const MAX = goal.GOAL_MAX;

// ---------------------------------------------------------------------------
// Aceptados
// ---------------------------------------------------------------------------

test('parseGoalInput acepta el mínimo del rango', () => {
  assert.equal(goal.parseGoalInput(String(MIN)), MIN);
  assert.equal(goal.parseGoalInput(MIN), MIN);
});

test('parseGoalInput acepta un valor intermedio', () => {
  assert.equal(goal.parseGoalInput('600'), 600);
  assert.equal(goal.parseGoalInput(600), 600);
});

test('parseGoalInput acepta el máximo del rango', () => {
  assert.equal(goal.parseGoalInput(String(MAX)), MAX);
  assert.equal(goal.parseGoalInput(MAX), MAX);
});

test('parseGoalInput acepta texto con espacios periféricos', () => {
  assert.equal(goal.parseGoalInput(' 600 '), 600);
  assert.equal(goal.parseGoalInput('\t600\n'), 600);
});

// ---------------------------------------------------------------------------
// Rechazados: vacío, espacios y fuera de rango
// ---------------------------------------------------------------------------

test('parseGoalInput rechaza la cadena vacía', () => {
  assert.equal(goal.parseGoalInput(''), null);
});

test('parseGoalInput rechaza texto que solo contiene espacios', () => {
  assert.equal(goal.parseGoalInput('   '), null);
  assert.equal(goal.parseGoalInput('\t\n'), null);
});

test('parseGoalInput rechaza los valores por debajo del mínimo', () => {
  assert.equal(goal.parseGoalInput('0'), null);
  assert.equal(goal.parseGoalInput(0), null);
  assert.equal(goal.parseGoalInput('9'), null);
  assert.equal(goal.parseGoalInput(9), null);
});

test('parseGoalInput rechaza los negativos', () => {
  assert.equal(goal.parseGoalInput('-1'), null);
  assert.equal(goal.parseGoalInput('-600'), null);
  assert.equal(goal.parseGoalInput(-600), null);
});

test('parseGoalInput rechaza los valores por encima del máximo', () => {
  assert.equal(goal.parseGoalInput(String(MAX + 1)), null);
  assert.equal(goal.parseGoalInput(MAX + 1), null);
});

// ---------------------------------------------------------------------------
// Rechazados: formatos que no son un entero escrito con cifras
// ---------------------------------------------------------------------------

test('parseGoalInput rechaza el punto decimal', () => {
  assert.equal(goal.parseGoalInput('600.0'), null);
  assert.equal(goal.parseGoalInput('10.5'), null);
});

test('parseGoalInput rechaza la coma decimal', () => {
  assert.equal(goal.parseGoalInput('60,0'), null);
});

test('parseGoalInput rechaza el signo más', () => {
  assert.equal(goal.parseGoalInput('+600'), null);
});

test('parseGoalInput rechaza la notación científica', () => {
  assert.equal(goal.parseGoalInput('6e2'), null);
});

test('parseGoalInput rechaza texto con unidades o comentarios', () => {
  assert.equal(goal.parseGoalInput('600 min'), null);
  assert.equal(goal.parseGoalInput('600 minutos'), null);
  assert.equal(goal.parseGoalInput('sesenta'), null);
});

test('parseGoalInput rechaza números que no son enteros', () => {
  assert.equal(goal.parseGoalInput(10.5), null);
  assert.equal(goal.parseGoalInput(600.5), null);
  assert.equal(goal.parseGoalInput(NaN), null);
  assert.equal(goal.parseGoalInput(Infinity), null);
  assert.equal(goal.parseGoalInput(-Infinity), null);
});

// ---------------------------------------------------------------------------
// Rechazados: ausencia de valor
// ---------------------------------------------------------------------------

test('parseGoalInput rechaza null', () => {
  assert.equal(goal.parseGoalInput(null), null);
});

test('parseGoalInput rechaza undefined', () => {
  assert.equal(goal.parseGoalInput(undefined), null);
});

// ---------------------------------------------------------------------------
// Rechazados: dígitos no occidentales
// ---------------------------------------------------------------------------

test('parseGoalInput rechaza los dígitos no occidentales', () => {
  assert.equal(goal.parseGoalInput('６００'), null); // seiscientos de ancho completo
  assert.equal(goal.parseGoalInput('٦٠٠'), null); // seiscientos arábigo-índico
  assert.equal(goal.parseGoalInput('१००'), null); // cien devanagari
  assert.equal(goal.parseGoalInput('１０'), null); // diez de ancho completo
});

test('parseGoalInput rechaza las marcas de orden de cifra Unicode', () => {
  // La forma canónica NFKC de "600" con U+2066 es "600": el mismo número
  // escrito con caracteres distintos, y por tanto un formato distinto.
  assert.equal(goal.parseGoalInput('⁦600⁩'), null);
});

// ---------------------------------------------------------------------------
// Robustez del contrato, no del formato
// ---------------------------------------------------------------------------

test('parseGoalInput nunca lanza y siempre devuelve número entero o null', () => {
  const entradas = [
    '', '   ', '0', '9', '-600', '600.0', '60,0', '+600', '6e2', '600 min',
    String(MAX + 1), null, undefined, NaN, Infinity, {}, [], ['600'], () => 600,
    true, '600', MIN, MAX
  ];

  for (const entrada of entradas) {
    const resultado = goal.parseGoalInput(entrada);
    const mensaje = `con ${typeof entrada === 'symbol' ? 'symbol' : JSON.stringify(entrada)}`;

    assert.ok(resultado === null || Number.isInteger(resultado), `${mensaje} devolvió otro tipo`);
    if (resultado !== null) {
      assert.ok(resultado >= MIN && resultado <= MAX, `${mensaje} devolvió un valor fuera de rango`);
    }
  }
});

/**
 * B3 — Tests de `buildGoalRecord`, escritos antes que la función (RF-7, RF-35).
 *
 * RF-7 exige guardar la fecha local del día en que se fijó la meta, con
 * `toLocalDateString`, y el lunes de esa semana, con `getWeekStartMonday`. RF-35
 * fija la forma del registro que se persiste: `{ value, setAt, setAtWeekStart }`.
 *
 * El `today` entra como parámetro (RFN-3), así que estos tests son
 * deterministas: `TODAY` es la cadena literal de A2 y ningún caso consulta el
 * reloj del sistema.
 *
 * Los casos de día de la semana cubren los tres que cambian el lunes de
 * referencia —lunes, miércoles y domingo— más el 1 de enero de un año no
 * bisiesto, que es el cruce de año más fácil de leer mal.
 */

// El caso que fija la tarea: viernes, y el lunes de su semana no es el día anterior.
const LUNES = '2026-09-28';

// 1 de enero de 2025 es miércoles y 2025 no es bisiesto: su lunes cae en 2024.
const ANIO_NO_BISIESTO = '2025-01-01';
const LUNES_DE_ANO_NUEVO = '2024-12-30';

test('buildGoalRecord devuelve los tres campos con el today del viernes', () => {
  assert.deepEqual(goal.buildGoalRecord(600, TODAY), {
    value: 600,
    setAt: '2026-10-02',
    setAtWeekStart: '2026-09-28'
  });
});

test('buildGoalRecord con today de lunes devuelve ese mismo lunes', () => {
  assert.deepEqual(goal.buildGoalRecord(600, LUNES), {
    value: 600,
    setAt: '2026-09-28',
    setAtWeekStart: '2026-09-28'
  });
});

test('buildGoalRecord con today de miércoles devuelve el lunes dos días antes', () => {
  assert.deepEqual(goal.buildGoalRecord(600, '2026-09-30'), {
    value: 600,
    setAt: '2026-09-30',
    setAtWeekStart: '2026-09-28'
  });
});

test('buildGoalRecord con today de domingo devuelve el lunes seis días antes', () => {
  // El domingo es el caso que separa "la semana natural" de "la semana que
  // empieza en lunes": un `getDay()` sin la conversión de `weekdayIndex`
  // devolvería el domingo como inicio.
  assert.deepEqual(goal.buildGoalRecord(600, '2026-10-04'), {
    value: 600,
    setAt: '2026-10-04',
    setAtWeekStart: '2026-09-28'
  });
});

test('buildGoalRecord con el 1 de enero no bisiesto cruza el año correctamente', () => {
  assert.deepEqual(goal.buildGoalRecord(600, ANIO_NO_BISIESTO), {
    value: 600,
    setAt: '2025-01-01',
    setAtWeekStart: LUNES_DE_ANO_NUEVO
  });
});

test('buildGoalRecord conserva el value recibido sin recalcularlo', () => {
  // La validación es de `parseGoalInput`; aquí la meta solo se copia. Comprobar
  // los dos extremos del rango deja ver que no se trunca ni se reescala.
  assert.equal(goal.buildGoalRecord(MIN, TODAY).value, MIN);
  assert.equal(goal.buildGoalRecord(MAX, TODAY).value, MAX);
  assert.equal(goal.buildGoalRecord(7, TODAY).value, 7);
});

test('buildGoalRecord devuelve exactamente las tres claves de RF-35', () => {
  const registro = goal.buildGoalRecord(600, TODAY);

  assert.deepEqual(Object.keys(registro).sort(), ['setAt', 'setAtWeekStart', 'value']);
});

test('buildGoalRecord no modifica el today recibido', () => {
  // today es una cadena inmutable, pero la garantía útil es que dos llamadas
  // seguidas con la misma entrada dan estructuras iguales: nada de estado
  // acumulado ni de orden de ejecución (RFN-3, RFN-6).
  const primero = goal.buildGoalRecord(600, TODAY);
  const segundo = goal.buildGoalRecord(600, TODAY);

  assert.deepEqual(primero, segundo);
  assert.equal(TODAY, '2026-10-02');
});

test('buildGoalRecord devuelve el mismo registro para los siete días de una semana', () => {
  // Solo cambia el lunes de `setAtWeekStart`; `setAt` cambia cada día.
  const dias = [
    '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01',
    '2026-10-02', '2026-10-03', '2026-10-04'
  ];

  for (const dia of dias) {
    const registro = goal.buildGoalRecord(600, dia);

    assert.equal(registro.setAt, dia, `setAt debería ser el propio día para ${dia}`);
    assert.equal(registro.setAtWeekStart, LUNES, `setAtWeekStart debería ser el lunes para ${dia}`);
  }
});

// ---------------------------------------------------------------------------
// B4 — `isValidGoalRecord`
// ---------------------------------------------------------------------------

/**
 * B4 — Tests de `isValidGoalRecord`, escritos antes que la función (RF-38, RFN-4).
 *
 * RF-38: el registro se descarta si no es un objeto con `value` entero en
 * [10, 10080] y un `setAtWeekStart` que sea una fecha local existente.
 *
 * La parte que conviene leer dos veces es la segunda mitad de RF-38: "la ausencia
 * o el malformo de `setAt` no invalida el registro, porque de ese campo no
 * depende ningún cálculo". `setAt` es trazabilidad pura —`setAtWeekStart` es lo
 * único de lo que depende el sellado—, así que un registro al que solo le falta
 * `setAt`, e incluso uno que lo lleva malformado, son registros válidos. Estos
 * tests fijan esa asimetría a propósito: es el sentido fácil de invertir.
 *
 * La validación de `setAtWeekStart` no se reimplementa aquí. Delega en
 * `isValidDateKey` de `heatmap.js` a través de `GOAL_DEPS`, que ya aplica el
 * formato y el calendario, incluido el 29 de febrero (RFN-4, RFN-5).
 */

/** Registro base bien formado, para partir de él y romper un solo campo. */
function registroValido(extra) {
  return Object.assign(
    { value: 600, setAt: TODAY, setAtWeekStart: WEEK_START },
    extra
  );
}

test('isValidGoalRecord acepta un registro completo bien formado', () => {
  assert.equal(goal.isValidGoalRecord(registroValido()), true);
});

test('isValidGoalRecord acepta un registro al que solo le falta setAt', () => {
  // El caso que fija B4 y la segunda mitad de RF-38.
  assert.equal(goal.isValidGoalRecord({ value: 600, setAtWeekStart: WEEK_START }), true);
});

test('isValidGoalRecord acepta un registro con setAt malformado', () => {
  // No solo la ausencia: el malformo tampoco invalida, porque de `setAt` no
  // depende ningún cálculo.
  assert.equal(goal.isValidGoalRecord(registroValido({ setAt: 'ayer' })), true);
  assert.equal(goal.isValidGoalRecord(registroValido({ setAt: 1750000000000 })), true);
  assert.equal(goal.isValidGoalRecord(registroValido({ setAt: null })), true);
});

test('isValidGoalRecord acepta los extremos del rango de value', () => {
  assert.equal(goal.isValidGoalRecord(registroValido({ value: MIN })), true);
  assert.equal(goal.isValidGoalRecord(registroValido({ value: MAX })), true);
});

test('isValidGoalRecord rechaza los valores ausentes o no textuales', () => {
  assert.equal(goal.isValidGoalRecord(null), false);
  assert.equal(goal.isValidGoalRecord(undefined), false);
  assert.equal(goal.isValidGoalRecord({ setAtWeekStart: WEEK_START }), false);
});

test('isValidGoalRecord rechaza lo que no es un objeto', () => {
  assert.equal(goal.isValidGoalRecord('600'), false);
  assert.equal(goal.isValidGoalRecord(''), false);
  assert.equal(goal.isValidGoalRecord(600), false);
  assert.equal(goal.isValidGoalRecord(true), false);
  assert.equal(goal.isValidGoalRecord(() => 600), false);
});

test('isValidGoalRecord rechaza un array', () => {
  // Un array es typeof "object", así que un registro que solo compruebe el tipo
  // lo aceptaría. No hay ningún campo con el nombre esperado, así que debe caer
  // por la regla del campo, no por la del tipo.
  assert.equal(goal.isValidGoalRecord([]), false);
  assert.equal(goal.isValidGoalRecord(['600', WEEK_START]), false);
  assert.equal(goal.isValidGoalRecord([{ value: 600, setAtWeekStart: WEEK_START }]), false);
});

test('isValidGoalRecord rechaza un value decimal', () => {
  assert.equal(goal.isValidGoalRecord(registroValido({ value: 600.5 })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ value: 10.1 })), false);
});

test('isValidGoalRecord rechaza un value no numérico', () => {
  assert.equal(goal.isValidGoalRecord(registroValido({ value: '600' })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ value: null })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ value: true })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ value: NaN })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ value: Infinity })), false);
});

test('isValidGoalRecord rechaza un value fuera de rango', () => {
  assert.equal(goal.isValidGoalRecord(registroValido({ value: 0 })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ value: 9 })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ value: -600 })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ value: MAX + 1 })), false);
});

test('isValidGoalRecord rechaza un setAtWeekStart ausente', () => {
  assert.equal(goal.isValidGoalRecord({ value: 600 }), false);
  assert.equal(goal.isValidGoalRecord({ value: 600, setAt: TODAY }), false);
});

test('isValidGoalRecord rechaza un setAtWeekStart que no es texto de fecha', () => {
  assert.equal(goal.isValidGoalRecord(registroValido({ setAtWeekStart: '2026/09/28' })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ setAtWeekStart: '28-09-2026' })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ setAtWeekStart: '' })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ setAtWeekStart: null })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ setAtWeekStart: 1750000000000 })), false);
});

test('isValidGoalRecord rechaza una fecha que no existe en el calendario', () => {
  // Delega en `isValidDateKey` de `heatmap.js`, que ya aplica el calendario:
  // no hay que volver a comprobar meses ni días aquí.
  assert.equal(goal.isValidGoalRecord(registroValido({ setAtWeekStart: '2026-02-30' })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ setAtWeekStart: '2026-13-01' })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ setAtWeekStart: '2026-09-32' })), false);
  assert.equal(goal.isValidGoalRecord(registroValido({ setAtWeekStart: '2026-09-00' })), false);
});

test('isValidGoalRecord acepta un 29 de febrero de un año bisiesto', () => {
  // La mitad positiva del mismo caso: si la función aceptara cualquier fecha,
  // el test anterior pasaría sin comprobar nada.
  assert.equal(goal.isValidGoalRecord(registroValido({ setAtWeekStart: '2028-02-29' })), true);
});

test('isValidGoalRecord no acepta el setAtWeekStart en lugar de ningún campo', () => {
  // `setAt` no sustituye a `setAtWeekStart`: son cosas distintas y solo la
  // segunda es obligatoria. Sin este test, "acepta lo que le falte setAt" se
  // podría leer como "acepta lo que le falte cualquiera de los dos".
  assert.equal(goal.isValidGoalRecord({ value: 600, setAt: TODAY }), false);
});

test('isValidGoalRecord acepta un registro con campos extra', () => {
  // Un registro guardado por una versión futura del archivo no debe invalidarse
  // por llevar campos que esta versión no conoce. RF-38 solo exige los tres.
  assert.equal(goal.isValidGoalRecord(registroValido({ otroCampo: 'x' })), true);
});

test('isValidGoalRecord devuelve siempre un booleano y no lanza', () => {
  const entradas = [
    registroValido(), { value: 600, setAtWeekStart: WEEK_START }, null, undefined,
    [], {}, 'texto', 0, NaN, { value: {} }, { setAtWeekStart: {} }, Object.create(null),
    { value: 600, setAtWeekStart: WEEK_START, setAt: Symbol('x') }
  ];

  for (const entrada of entradas) {
    assert.equal(typeof goal.isValidGoalRecord(entrada), 'boolean');
  }
});

test('buildGoalRecord devuelve siempre un registro que isValidGoalRecord acepta', () => {
  // Las dos funciones tienen que estar de acuerdo: si el registro que produce
  // el propio `goal.js` no pasara su propio validador, la meta se perdería al
  // releerla del almacenamiento (RF-7 con RF-38).
  const dias = [
    '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01',
    '2026-10-02', '2026-10-03', '2026-10-04', '2025-01-01'
  ];

  for (const dia of dias) {
    for (const value of [MIN, 600, MAX]) {
      const registro = goal.buildGoalRecord(value, dia);

      assert.equal(
        goal.isValidGoalRecord(registro), true,
        `el registro de ${dia} con value ${value} debería ser válido`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// C1 — `getValidMinutesForWeek`
// ---------------------------------------------------------------------------

/**
 * C1 — Tests de `getValidMinutesForWeek`, escritos antes que la función
 * (RF-9, RF-10, RF-13, RF-20, decisión T4/D3 del plan y riesgo R2).
 *
 * RF-9 filtra con `partitionSessions` de `heatmap.js` y, para el rango, con
 * `getWeekRange` de `diary.js` a través de `calculateWeeklyTotal`. RF-10 reusa
 * esa última función en vez de reimplementar la semana, así que la semana tiene
 * una sola definición en toda la aplicación.
 *
 * R2 es el motivo de la tarea: `calculateWeeklyTotal` de `diary.js` solo filtra
 * por rango de fechas y suma `s.minutes` a ciegas, de modo que con minutos no
 * numéricos devuelve `NaN`, y con negativos resta. Arreglar eso está fuera de
 * alcance —afectaría a la racha y a las métricas y pertenece a otra spec—, así
 * que la decisión T4 es filtrar ANTES de sumar. Estos tests son los que
 * comprueban que el filtro está antes y no después: si alguien invirtiera el
 * orden, casi todos seguirían dando el total correcto y solo estos fallarían.
 *
 * El total de una sesión válida nunca se ve afectado por una inválida, ni
 * siquiera en la misma fecha: ese es el criterio que comparten todos los casos de
 * dato corrupto de aquí abajo.
 */

/** Construye una sesión con la forma que espera `partitionSessions`. */
function sesion(date, minutes) {
  return { date, minutes };
}

test('getValidMinutesForWeek suma las sesiones válidas de la semana actual', () => {
  const sesiones = [
    sesion('2026-09-28', 30),
    sesion('2026-10-02', 45),
    sesion('2026-10-04', 25)
  ];

  assert.equal(goal.getValidMinutesForWeek(sesiones, TODAY), 100);
});

test('getValidMinutesForWeek excluye lo que cae fuera de la semana', () => {
  // Del lunes anterior y del domingo siguiente: los dos extremos que una
  // comparación mal hecha dejaría pasar.
  const sesiones = [
    sesion('2026-09-21', 500),
    sesion('2026-09-28', 30),
    sesion('2026-10-04', 25),
    sesion('2026-10-05', 500)
  ];

  assert.equal(goal.getValidMinutesForWeek(sesiones, TODAY), 55);
});

test('getValidMinutesForWeek con una sesión válida y otra inválida en la misma fecha', () => {
  // El caso que fija C1. Las dos sesiones comparten fecha, así que ninguna
  // comprobación de rango las puede separar: solo el filtro de validez.
  const sesiones = [
    sesion('2026-10-02', 40),
    sesion('2026-10-02', NaN)
  ];

  assert.equal(goal.getValidMinutesForWeek(sesiones, TODAY), 40);
});

test('getValidMinutesForWeek nunca devuelve NaN', () => {
  // R2: si el filtro no va antes de la suma, cualquiera de estas entradas
  // devuelve NaN y el progreso se pinta roto.
  const sesiones = [
    sesion('2026-10-02', NaN),
    sesion('2026-10-02', '60'),
    sesion('2026-10-02', null),
    sesion('2026-10-02', undefined),
    sesion('2026-10-02', {}),
    sesion('2026-10-02', 60.5)
  ];

  const total = goal.getValidMinutesForWeek(sesiones, TODAY);

  assert.ok(Number.isFinite(total), `el total debería ser finito, fue ${total}`);
});

test('getValidMinutesForWeek excluye los minutos no numéricos', () => {
  const valores = ['60', null, undefined, {}, [], true, false, Infinity, -Infinity];

  for (const valor of valores) {
    const total = goal.getValidMinutesForWeek(
      [sesion('2026-10-02', valor), sesion('2026-10-02', 40)],
      TODAY
    );

    assert.equal(total, 40, `con minutes = ${String(valor)}`);
  }
});

test('getValidMinutesForWeek excluye los minutos decimales', () => {
  // `isValidMinutes` exige entero: 60.5 no vale, aunque se pueda redondear.
  const total = goal.getValidMinutesForWeek(
    [sesion('2026-10-02', 60.5), sesion('2026-10-02', 40)],
    TODAY
  );

  assert.equal(total, 40);
});

test('getValidMinutesForWeek excluye el cero y los negativos', () => {
  // El cero y los negativos no son minutos válidos según `isValidMinutes`. Sin el
  // filtro, un -30 restaría de verdad al total de la semana.
  const total = goal.getValidMinutesForWeek(
    [
      sesion('2026-10-02', 0),
      sesion('2026-10-02', -30),
      sesion('2026-10-02', -1),
      sesion('2026-10-02', 40)
    ],
    TODAY
  );

  assert.equal(total, 40);
});

test('getValidMinutesForWeek excluye los minutos ausentes', () => {
  const total = goal.getValidMinutesForWeek(
    [{ date: '2026-10-02' }, { date: '2026-10-02', minutes: undefined }, sesion('2026-10-02', 40)],
    TODAY
  );

  assert.equal(total, 40);
});

test('getValidMinutesForWeek excluye las fechas que no existen en el calendario', () => {
  // R2 nombra este caso. `isValidDateKey` ya aplica el calendario real, así que
  // "2025-02-30" (febrero de 28) y "2025-13-01" (mes 13) se descartan.
  const total = goal.getValidMinutesForWeek(
    [
      sesion('2025-02-30', 300),
      sesion('2025-13-01', 300),
      sesion('2026-10-02', 40)
    ],
    TODAY
  );

  assert.equal(total, 40);
});

test('getValidMinutesForWeek nunca supera el total de las sesiones válidas', () => {
  // El criterio que comparten los casos de dato corrupto: añadir una sesión
  // inválida nunca puede hacer subir el total, solo dejarlo igual o bajarlo.
  const validas = [sesion('2026-10-01', 30), sesion('2026-10-02', 40)];
  const corruptas = [
    sesion('2026-10-02', NaN),
    sesion('2026-10-02', '60'),
    sesion('2026-10-02', -100),
    sesion('2026-10-02', 0),
    sesion('2026-10-02', 60.5),
    sesion('2025-02-30', 300),
    sesion('2025-13-01', 300),
    sesion('2026-10-02', null)
  ];

  const referencia = goal.getValidMinutesForWeek(validas, TODAY);
  assert.equal(referencia, 70);

  for (const corrupta of corruptas) {
    const total = goal.getValidMinutesForWeek(validas.concat([corrupta]), TODAY);

    assert.ok(Number.isFinite(total), `total no finito con ${JSON.stringify(corrupta)}`);
    assert.ok(
      total <= referencia,
      `${JSON.stringify(corrupta)} subió el total a ${total}, por encima de ${referencia}`
    );
  }
});

test('getValidMinutesForWeek no baja de cero con una mezcla de datos corruptos', () => {
  // El peor caso de R2: si el filtro no estuviera antes de la suma, los negativos
  // arrastrarían el total por debajo de cero y los no numéricos lo convertirían
  // en NaN.
  const sesiones = [
    sesion('2026-10-02', NaN),
    sesion('2026-10-02', -500),
    sesion('2026-10-02', 0),
    sesion('2026-10-02', '60'),
    sesion('2025-02-30', -300),
    sesion('2026-10-02', 40)
  ];

  const total = goal.getValidMinutesForWeek(sesiones, TODAY);

  assert.equal(total, 40);
  assert.ok(total >= 0);
});

test('getValidMinutesForWeek no modifica la lista de sesiones recibida', () => {
  // RFN-12 y RF-41: la función solo lee. Si mutara el array, las sesiones
  // guardadas podrían reordenarse o perder campos, que es justo lo prohibido.
  const sesiones = [
    sesion('2026-10-02', NaN),
    sesion('2026-10-02', 40),
    sesion('2025-02-30', 300)
  ];
  // Copia campo a campo en vez de con JSON: `JSON.stringify` convierte `NaN` en
  // `null`, y comparar contra esa copia no comprobaría nada sobre el `NaN`.
  const copia = sesiones.map((s) => ({ date: s.date, minutes: s.minutes }));
  const objetosOriginales = sesiones.slice();

  goal.getValidMinutesForWeek(sesiones, TODAY);

  assert.equal(sesiones.length, 3);
  assert.equal(sesiones.length, copia.length);
  for (let i = 0; i < copia.length; i++) {
    assert.equal(sesiones[i].date, copia[i].date, `fecha en la posición ${i}`);
    // `assert.deepEqual` trata `NaN` como igual a sí mismo, así que el `NaN`
    // original se compara bien contra su copia.
    assert.deepEqual(sesiones[i].minutes, copia[i].minutes, `minutos en la posición ${i}`);
  }
  // Además, los mismos objetos: que no se hayan sustituido por copias.
  for (let i = 0; i < objetosOriginales.length; i++) {
    assert.equal(sesiones[i], objetosOriginales[i], `identidad en la posición ${i}`);
  }
});

test('getValidMinutesForWeek con lista vacía devuelve cero', () => {
  assert.equal(goal.getValidMinutesForWeek([], TODAY), 0);
});

test('getValidMinutesForWeek con solo sesiones inválidas devuelve cero', () => {
  assert.equal(
    goal.getValidMinutesForWeek([sesion('2026-10-02', NaN), sesion('2026-10-02', -1)], TODAY),
    0
  );
});

test('getValidMinutesForWeek cuenta los minutos anteriores a fijar la meta', () => {
  // RF-20: el progreso se mide contra la semana completa, no contra el momento
  // en que se fijó la meta. Un goalRecord con `setAt` a mitad de semana no debe
  // entrar en el cálculo; la función ni siquiera lo recibe.
  const meta = goal.buildGoalRecord(600, TODAY);
  const sesiones = [
    sesion('2026-09-28', 30), // antes de fijar la meta
    sesion('2026-10-01', 20), // antes de fijar la meta
    sesion('2026-10-03', 10)  // después
  ];

  assert.equal(meta.setAt, '2026-10-02');
  assert.equal(goal.getValidMinutesForWeek(sesiones, TODAY), 60);
});

test('getValidMinutesForWeek suma las sesiones de los siete días de la semana', () => {
  // La semana completa, lunes a domingo, con `today` en cada uno de los siete
  // días. Todas dan el mismo total porque el total depende de la semana, no del
  // día en que se pregunta.
  const dias = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01',
    '2026-10-02', '2026-10-03', '2026-10-04'];
  const sesiones = dias.map((dia) => sesion(dia, 10));

  assert.equal(sesiones.length, 7);

  for (const dia of dias) {
    assert.equal(goal.getValidMinutesForWeek(sesiones, dia), 70, `con today = ${dia}`);
  }
});

test('getValidMinutesForWeek es determinista con la misma entrada', () => {
  const sesiones = [sesion('2026-10-02', NaN), sesion('2026-10-02', 40), sesion('2026-10-01', 20)];

  assert.equal(
    goal.getValidMinutesForWeek(sesiones, TODAY),
    goal.getValidMinutesForWeek(sesiones, TODAY)
  );
});

// ---------------------------------------------------------------------------
// C2 — El rango de semana con `weekStart` como `today` (RF-10, RF-9)
// ---------------------------------------------------------------------------

/**
 * C2 — Tests del rango de semana (RF-10, RF-9).
 *
 * `calculateWeeklyTotal` de `diary.js` deriva el rango de su parámetro `today`,
 * así que la misma lista de sesiones da totales distintos según qué día se le
 * pase. RF-10 lo resuelve por contrato: para una semana cerrada se le pasa su
 * propio `weekStart` como `today`, de modo que `getWeekRange` resuelva el lunes a
 * domingo de esa semana y ni una sola más. Para la semana actual se le pasa el
 * hoy de la carga.
 *
 * Estos tests fijan ese contrato desde el lado de quien suma. No hace falta
 * ninguna función nueva: `getValidMinutesForWeek` de C1 ya es la que recibe el
 * `today`, y lo que se comprueba aquí es que obeyezca lo que RF-10 le pide.
 *
 * La semana se define solo por la clave de fecha, no por la hora (RFN-4), así que
 * el caso de frontera de las 23:59 y las 00:00 se expresa desplazando la clave un
 * día, nunca construyendo un `Date` con horas. Las 23:59 del domingo y las 00:00
 * del lunes pertenecen a días cuya clave es exactamente la que usa el test.
 */

/** Semana anterior a la del `TODAY` del plan: lunes 2026-09-21 a domingo 2026-09-27. */
const SEMANA_PASADA_LUNES = '2026-09-21';
const SEMANA_PASADA_DOMINGO = '2026-09-27';

test('getValidMinutesForWeek con el weekStart de una semana pasada suma esa semana', () => {
  // El caso que fija C2: el mismo `sessions` con el `weekStart` de la semana
  // pasada como `today` devuelve los minutos de esa semana, no los de la actual.
  const sesiones = [
    sesion(SEMANA_PASADA_LUNES, 30),
    sesion(SEMANA_PASADA_DOMINGO, 45),
    sesion(WEEK_START, 20), // lunes de la semana actual
    sesion(TODAY, 60) // viernes de la semana actual
  ];

  assert.equal(goal.getValidMinutesForWeek(sesiones, SEMANA_PASADA_LUNES), 75);
});

test('getValidMinutesForWeek con el weekStart pasado no arrastra la semana actual', () => {
  // El reverso del anterior: los minutos de la semana actual no se cuelan en el
  // total de la pasada, ni siquiera siendo el primer y el último elemento.
  const sesiones = [
    sesion(TODAY, 60),
    sesion('2026-10-04', 25), // domingo de la semana actual
    sesion('2026-09-21', 30)
  ];

  const total = goal.getValidMinutesForWeek(sesiones, SEMANA_PASADA_LUNES);

  assert.equal(total, 30);
  assert.ok(total < goal.getValidMinutesForWeek(sesiones, TODAY));
});

test('getValidMinutesForWeek da el mismo total para los siete días de la semana pasada', () => {
  // RF-10 dice "una fecha cualquiera de esa semana, y en particular su propio
  // weekStart". Los siete días tienen que dar el mismo total, y ese total es el
  // de la semana pasada pase lo que pase.
  const dias = [
    '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
    '2026-09-25', '2026-09-26', '2026-09-27'
  ];
  const sesiones = dias.map((dia) => sesion(dia, 10)).concat([sesion(TODAY, 99)]);

  for (const dia of dias) {
    assert.equal(
      goal.getValidMinutesForWeek(sesiones, dia), 70,
      `con today = ${dia}, que pertenece a la semana pasada`
    );
  }
});

test('getValidMinutesForWeek en el domingo a las 23:59 y en el lunes a las 00:00 separa semanas', () => {
  // La frontera de semana, que es donde un rango mal hecho mete un día de más o
  // deja uno fuera. El domingo a las 23:59 todavía es domingo: sus minutos van
  // con la semana que termina. El lunes a las 00:00 ya es la semana siguiente: esa
  // misma sesión no cuenta allí.
  //
  // Las dos horas no se construyen con un `Date`: la lógica es por clave de
  // fecha, así que 23:59 del domingo es la clave del domingo y 00:00 del lunes es
  // la clave del lunes. El desplazamiento de un día es la clave desplazada.
  const domingo = '2026-10-04'; // domingo de la semana del WEEK_START
  const lunes = '2026-10-05'; // lunes de la semana siguiente

  const sesiones = [
    sesion(domingo, 25), // cuenta en la semana del 2026-09-28
    sesion(lunes, 10)
  ];

  // Domingo a las 23:59: `today` sigue siendo el domingo, la semana del LUNES.
  assert.equal(goal.getValidMinutesForWeek(sesiones, domingo), 25);

  // Lunes a las 00:00, con la fecha desplazada un día: la semana nueva empieza en
  // cero y solo cuenta lo suyo. Los 25 del domingo ya no están.
  assert.equal(goal.getValidMinutesForWeek(sesiones, lunes), 10);
});

test('getValidMinutesForWeek no pierde ni duplica minutos en la frontera de semana', () => {
  // Dos semanas consecutivas, con el total repartido entre los dos lados de la
  // frontera. Lo que se cuenta en una semana tiene que estar en la otra o en
  // ninguna, nunca en las dos: un rango solapado duplicaría, uno con hueco
  // perdería.
  const diasSemanaActual = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01',
    '2026-10-02', '2026-10-03', '2026-10-04'];
  const diasSemanaSiguiente = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
    '2026-10-09', '2026-10-10', '2026-10-11'];

  const sesiones = diasSemanaActual.map((dia) => sesion(dia, 10))
    .concat(diasSemanaSiguiente.map((dia) => sesion(dia, 10)));

  const actual = goal.getValidMinutesForWeek(sesiones, WEEK_START);
  const siguiente = goal.getValidMinutesForWeek(sesiones, diasSemanaSiguiente[0]);
  const totalDeLasDos = actual + siguiente;

  assert.equal(actual, 70);
  assert.equal(siguiente, 70);
  assert.equal(totalDeLasDos, 140);
});

test('getValidMinutesForWeek con una semana antigua sigue contando esa semana', () => {
  // El mismo contrato con una semana mucho más atrás, para que la prueba no
  // dependa de que el caso sea "la semana inmediatamente anterior". Cruza además
  // el cambio de año.
  const sesiones = [
    sesion(YEAR_CROSS_WEEK_START, 30), // lunes 2025-12-29
    sesion('2026-01-04', 40), // domingo de esa semana
    sesion(TODAY, 60)
  ];

  assert.equal(goal.getValidMinutesForWeek(sesiones, YEAR_CROSS_WEEK_START), 70);
});

test('getValidMinutesForWeek filtra el rango también en semanas cerradas', () => {
  // RF-9 pide excluir lo que cae fuera del intervalo de la semana. Con
  // `weekStart` como `today` el intervalo es el de la semana cerrada, así que el
  // filtro tiene que excluir el lunes siguiente de esa semana.
  const sesiones = [
    sesion(SEMANA_PASADA_LUNES, 30),
    sesion(SEMANA_PASADA_DOMINGO, 45),
    sesion(WEEK_START, 20) // el lunes siguiente: el primer día fuera de la semana
  ];

  assert.equal(goal.getValidMinutesForWeek(sesiones, SEMANA_PASADA_LUNES), 75);
});

// ---------------------------------------------------------------------------
// C3 — `computeProgress`
// ---------------------------------------------------------------------------

/**
 * C3 — Tests de `computeProgress`, escritos antes que la función (RF-11 a RF-17).
 *
 * Devuelve `{ remaining, percent, met }`, o `null` si no hay meta (RF-17). La
 * forma exacta la fija la tabla de `plan.md` §3; aquí se queda fijada con tests,
 * porque C4 y F3 van a consumirla y una forma que se pare después obliga a tocar
 * las tres tareas.
 *
 * Las definiciones normativas están en *Definiciones* de `spec.md`: "minutos
 * restantes" es la diferencia entre meta y llevados, sin signo y cero cuando es
 * negativa o nula; "proporción" es el porcentaje entero que resulta de truncar
 * hacia abajo el cociente por cien, con máximo de 100.
 *
 * Los casos que más información dan son los de truncado. 249/600 da 41, no 42, y
 * un redondeo en lugar de un truncado pasaría casi todos los demás. 599/600 da
 * 99, y no 100: es el caso donde un `Math.round` se delata. Y 650/600 da 100, con
 * lo que el tope de 100 queda comprobado por un valor que de verdad lo supera.
 *
 * `computeProgress` no recibe fechas: solo minutos y meta. No hay `today` en esta
 * función y no hay ningún reloj al que consultar (RFN-3).
 */

/** Atajo de lectura: los tres campos van bien en casi todos los casos. */
function progreso(minutes, goalValue) {
  return goal.computeProgress(minutes, goalValue);
}

test('computeProgress trunca hacia abajo en lugar de redondear', () => {
  // El caso que fija C3: 249/600 = 41.5, y 41.5 trunca a 41.
  assert.equal(progreso(249, 600).percent, 41);
});

test('computeProgress no redondea el 99 al 100', () => {
  // 599/600 = 99.83: redondeado daría 100 y marcaría el objetivo como cumplido
  // una semana antes de tiempo.
  assert.equal(progreso(599, 600).percent, 99);
});

test('computeProgress con los minutos justos da 100 y objetivo cumplido', () => {
  assert.deepEqual(progreso(600, 600), { remaining: 0, percent: 100, met: true });
});

test('computeProgress al superar la meta corta al 100 y pone restantes en cero', () => {
  // RF-11 y RF-16: los restantes nunca son negativos y el porcentaje nunca pasa
  // de 100 aunque los minutos sí.
  assert.deepEqual(progreso(650, 600), { remaining: 0, percent: 100, met: true });
  assert.ok(progreso(650, 600).remaining >= 0);
});

test('computeProgress con una meta de 10080 y 20000 minutos', () => {
  // Caso límite de la spec: una semana muy cargada sigue dando 100 y cero
  // restantes, y nunca un porcentaje por encima de 100.
  const resultado = progreso(20000, 10080);

  assert.deepEqual(resultado, { remaining: 0, percent: 100, met: true });
  assert.ok(resultado.percent <= 100);
});

test('computeProgress con los minutos restantes correctos cuando no se supera', () => {
  // 249 llevados sobre 600: faltan 351.
  assert.equal(progreso(249, 600).remaining, 351);
  assert.equal(progreso(0, 600).remaining, 600);
  assert.equal(progreso(300, 600).remaining, 300);
  assert.equal(progreso(1000, 1500).remaining, 500);
  assert.equal(progreso(1200, 1500).remaining, 300);
});

test('computeProgress clasifica el objetivo según RF-14 y RF-15', () => {
  assert.equal(progreso(299, 600).met, false);
  assert.equal(progreso(600, 600).met, true);
  assert.equal(progreso(601, 600).met, true);
  assert.equal(progreso(0, 600).met, false);
});

test('computeProgress con cero minutos deja el objetivo pendiente', () => {
  // Una semana sin sesiones es el estado inicial real de la aplicación.
  assert.deepEqual(progreso(0, 600), { remaining: 600, percent: 0, met: false });
});

test('computeProgress con la meta mínima y nueve minutos da 90', () => {
  // Caso de la tabla de bordes de la spec: con meta 10, nueve minutos son 90 %.
  assert.equal(progreso(9, MIN).percent, 90);
  assert.equal(progreso(9, MIN).remaining, 1);
  assert.equal(progreso(9, MIN).met, false);
});

test('computeProgress con la meta máxima y la semana entera da 100', () => {
  // 10080 minutos sobre una meta de 10080 es exactamente la semana cumplida.
  assert.deepEqual(progreso(MAX, MAX), { remaining: 0, percent: 100, met: true });
});

test('computeProgress devuelve null si no hay meta', () => {
  // RF-17: sin meta no hay restantes, ni proporción, ni estado. `null` y no un
  // objeto con ceros, que se pintaría como una barra en cero.
  assert.equal(progreso(600, null), null);
  assert.equal(progreso(600, undefined), null);
  assert.equal(progreso(0, null), null);
});

test('computeProgress nunca devuelve un porcentaje mayor de 100', () => {
  // El invariante que C3 declara, comprobado con muchos valores y no solo con
  // los casos concretos de la tabla.
  const goals = [MIN, 15, 100, 600, 1500, 5000, MAX];
  const cargas = [0, 1, 9, 10, 99, 100, 249, 599, 600, 601, 650, 1200, 5000, 20000, 99999];

  for (const goalValue of goals) {
    for (const carried of cargas) {
      const resultado = progreso(carried, goalValue);

      assert.ok(resultado !== null, `con meta ${goalValue} y ${carried} minutos`);
      assert.ok(
        resultado.percent <= 100,
        `con meta ${goalValue} y ${carried} minutos el porcentaje fue ${resultado.percent}`
      );
      assert.ok(
        resultado.percent >= 0,
        `con meta ${goalValue} y ${carried} minutos el porcentaje fue ${resultado.percent}`
      );
      assert.ok(Number.isInteger(resultado.percent), 'el porcentaje debe ser entero');
      assert.ok(resultado.remaining >= 0, `restantes negativos con meta ${goalValue} y ${carried}`);
      assert.equal(typeof resultado.met, 'boolean');
    }
  }
});

test('computeProgress trunca hacia abajo en todos los casos, nunca redondea', () => {
  // El cociente exacto de cada par, para comprobar que `percent` es su suelo y
  // no su redondeo. Con 249/600 = 41.5 basta para delatar un `Math.round`, pero
  // este caso cubre cualquier otro error de redondeo.
  const goals = [MIN, 100, 600, 1500, MAX];
  const minutos = [1, 7, 9, 199, 249, 599, 601, 1234, 1200, 4999];

  for (const goalValue of goals) {
    for (const minutes of minutos) {
      const exacto = (minutes / goalValue) * 100;
      const esperado = Math.max(0, Math.min(100, Math.floor(exacto)));
      const resultado = progreso(minutes, goalValue);

      assert.equal(
        resultado.percent, esperado,
        `con ${minutes} minutos y meta ${goalValue}, el exacto es ${exacto}`
      );
    }
  }
});

test('computeProgress con minutos negativos no produce un porcentaje negativo', () => {
  // `getValidMinutesForWeek` nunca devuelve negativos, pero un total corrupto no
  // puede hacer que la barra se pinte al revés.
  const resultado = progreso(-50, 600);

  assert.ok(resultado.percent >= 0);
  assert.ok(resultado.percent <= 100);
  assert.ok(resultado.remaining >= 0);
});

test('computeProgress devuelve el relleno de la barra igual a la proporción', () => {
  // RF-13 y RFN-8: el relleno usa el mismo entero truncado de RF-12, no el
  // cociente exacto, de modo que la barra nunca muestra un relleno que el
  // porcentaje redondeado no sostenga. Aquí `percent` ES ese entero: si algún día
  // hay un campo de relleno aparte, este es el que dice que tienen que coincidir.
  const casos = [
    [249, 600, 41],
    [599, 600, 99],
    [600, 600, 100],
    [650, 600, 100],
    [1200, 1500, 80],
    [9, 10, 90]
  ];

  for (const [minutes, goalValue, esperado] of casos) {
    const resultado = progreso(minutes, goalValue);

    assert.equal(resultado.percent, esperado, `${minutes} de ${goalValue}`);
    // El relleno de la barra se pinta con este entero, así que tiene que servir
    // directamente como porcentaje CSS.
    assert.equal(String(resultado.percent) + '%', `${esperado}%`);
  }
});

test('computeProgress devuelve exactamente las tres claves de la firma', () => {
  assert.deepEqual(Object.keys(progreso(249, 600)).sort(), ['met', 'percent', 'remaining']);
});

test('computeProgress es determinista con la misma entrada', () => {
  assert.deepEqual(progreso(249, 600), progreso(249, 600));
  assert.deepEqual(progreso(650, 600), progreso(650, 600));
});

test('computeProgress devuelve remaining coherente con percent y met', () => {
  // Coherencia interna: el que va cumplido tiene cero restantes y el pendiente
  // tiene la diferencia exacta, así que `remaining === 0` y `met` no pueden
  // contradecirse.
  const goals = [MIN, 100, 600, 1500, MAX];
  const minutos = [0, 9, 249, 599, 600, 650, 1200, 20000];

  for (const goalValue of goals) {
    for (const carried of minutos) {
      const resultado = progreso(carried, goalValue);

      assert.equal(resultado.met, carried >= goalValue, `met con ${carried}/${goalValue}`);
      assert.equal(
        resultado.remaining, Math.max(0, goalValue - carried),
        `remaining con ${carried}/${goalValue}`
      );
      assert.equal(
        resultado.remaining === 0, resultado.met,
        `remaining y met no coinciden con ${carried}/${goalValue}`
      );
    }
  }
});

test('computeProgress tolera minutos no numéricos sin lanzar', () => {
  // El total viene de `getValidMinutesForWeek`, que ya garantiza un entero, pero
  // un total ausente se trata como cero minutos y no como una excepción que rompa
  // la página entera.
  for (const minutos of [null, undefined, NaN, '600', {}]) {
    const resultado = progreso(minutos, 600);

    assert.ok(resultado === null || typeof resultado === 'object', `con ${String(minutos)}`);
    if (resultado !== null) {
      assert.ok(Number.isInteger(resultado.percent), `percent entero con ${String(minutos)}`);
      assert.ok(resultado.remaining >= 0, `remaining >= 0 con ${String(minutos)}`);
    }
  }
});

// ---------------------------------------------------------------------------
// C4 — `composeGoalLines`
// ---------------------------------------------------------------------------

/**
 * C4 — Tests de `composeGoalLines`, escritos antes que la función
 * (RF-28, RF-29, RF-32, RFN-8).
 *
 * Esta es la única fuente de los textos visibles y accesibles de la tarjeta de
 * objetivo, igual que `composeCellText` lo es del mapa de calor: si el detalle
 * visible y el `aria-label` compusieran por separado, no podrían divergir, y en
 * esta spec el mismo texto se pinta y se anuncia.
 *
 * Los literales son comparados carácter a carácter contra la tabla de RF-28, sin
 * construir el esperado a partir de las mismas piezas que usa la función: si el
 * test compusiera el literal con concatenaciones, cambiar el orden de un segmento
 * en la función cambiaría el test y los dos quedarían de acuerdo en lo equivocado.
 * Por eso los seis textos esperados están escritos enteros dentro de los tests.
 *
 * `state` es lo que F3 ensambla: `hasGoal`, la meta, los minutos y el resultado de
 * `computeProgress` para esa semana. La función no recibe sesiones ni una lista de
 * sesiones, así que el total ya viene filtrado y no puede volver a sumar nada.
 */

/**
 * Estado de la tarjeta, como lo pasará a componer F3.
 *
 * `goalValue` es la meta y `minutes` los minutos válidos de la semana. `progress`
 * es lo que devuelve `computeProgress`; se calcula aquí con la función de verdad
 * para que los tests no fijen a mano un `{ remaining, percent, met }` que se
 * podría desincronizar de ella.
 */
function estadoDe(minutes, goalValue) {
  return {
    hasGoal: goalValue !== null && goalValue !== undefined,
    goalValue,
    minutes,
    progress: goal.computeProgress(minutes, goalValue)
  };
}

/** Estado sin meta, el estado inicial real de la aplicación. */
function estadoSinMeta() {
  return { hasGoal: false, goalValue: null, minutes: 0, progress: null };
}

// ---------------------------------------------------------------------------
// Los seis literales de la tabla de RF-28
// ---------------------------------------------------------------------------

test('composeGoalLines compone la línea de estado sin meta', () => {
  assert.equal(goal.composeGoalLines(estadoSinMeta()).status, 'Objetivo semanal: sin fijar');
});

test('composeGoalLines compone la línea de estado con meta', () => {
  assert.equal(goal.composeGoalLines(estadoDe(240, 600)).status, 'Objetivo semanal: 600 min');
});

test('composeGoalLines compone la línea de progreso con el objetivo pendiente', () => {
  assert.equal(goal.composeGoalLines(estadoDe(240, 600)).progress, 'Esta semana: 240 de 600 min (40%)');
});

test('composeGoalLines compone la línea de minutos restantes', () => {
  assert.equal(goal.composeGoalLines(estadoDe(240, 600)).remaining, 'Quedan 360 min');
});

test('composeGoalLines compone la línea de cumplimiento', () => {
  // Con el total real, nunca sustituido por la meta (RF-32).
  assert.equal(
    goal.composeGoalLines(estadoDe(650, 600)).met,
    '¡Objetivo cumplido! 650 de 600 min'
  );
});

// El encabezado no es un texto compuesto: es un literal fijo de la tarjeta, igual
// que el de otras secciones de la página. Se fija aquí para que RF-28 lo tenga
// comprobado en el archivo puro.
test('el encabezado de la tarjeta es el literal de RF-28', () => {
  assert.equal(goal.GOAL_CARD_TITLE, 'Objetivo semanal');
});

// ---------------------------------------------------------------------------
// Qué líneas existen en cada caso (RF-29)
// ---------------------------------------------------------------------------

test('composeGoalLines sin meta devuelve solo status', () => {
  // RF-17 y la tabla de RF-28: sin meta no hay progreso, ni restantes, ni
  // cumplimiento. Las claves ausentes, y no con cadena vacía: F3 tiene que poder
  // decidir si pinta la línea mirando si la clave existe.
  const lineas = goal.composeGoalLines(estadoSinMeta());

  assert.deepEqual(Object.keys(lineas).sort(), ['status']);
  assert.equal(lineas.progress, undefined);
  assert.equal(lineas.remaining, undefined);
  assert.equal(lineas.met, undefined);
  assert.equal(lineas.valueText, undefined);
});

test('composeGoalLines con el objetivo cumplido omite progress y remaining', () => {
  // RF-29 y RF-32: con el objetivo cumplido no hay porcentaje en el texto ni línea
  // de restantes, y ningún mensaje adicional.
  const lineas = goal.composeGoalLines(estadoDe(650, 600));

  assert.equal(lineas.progress, undefined);
  assert.equal(lineas.remaining, undefined);
  assert.equal(lineas.met, '¡Objetivo cumplido! 650 de 600 min');
  // La línea de estado sigue estando: RF-28 la muestra con meta, pendiente o
  // cumplida.
  assert.equal(lineas.status, 'Objetivo semanal: 600 min');
});

test('composeGoalLines con el objetivo cumplido en el límite da el texto exacto', () => {
  // 600 de 600 está cumplido, y el texto lleva el 600 dos veces: los llevados y
  // la meta. No "600 de 600 min (100%)": el porcentaje no va en el texto.
  const lineas = goal.composeGoalLines(estadoDe(600, 600));

  assert.equal(lineas.met, '¡Objetivo cumplido! 600 de 600 min');
  assert.equal(lineas.progress, undefined);
  assert.equal(lineas.remaining, undefined);
});

test('composeGoalLines con el objetivo pendiente omite la línea de cumplimiento', () => {
  const lineas = goal.composeGoalLines(estadoDe(240, 600));

  assert.equal(lineas.met, undefined);
  assert.equal(lineas.progress, 'Esta semana: 240 de 600 min (40%)');
  assert.equal(lineas.remaining, 'Quedan 360 min');
});

// ---------------------------------------------------------------------------
// El total real nunca se sustituye por la meta (RF-16, RF-32)
// ---------------------------------------------------------------------------

test('composeGoalLines muestra el total real al superar la meta', () => {
  // El caso donde sustituir el total por la meta pasaría desapercibido: los dos
  // números coinciden en el límite, y solo se ven distintos al superarla.
  assert.equal(
    goal.composeGoalLines(estadoDe(650, 600)).met,
    '¡Objetivo cumplido! 650 de 600 min'
  );
  assert.equal(
    goal.composeGoalLines(estadoDe(20000, 10080)).met,
    '¡Objetivo cumplido! 20000 de 10080 min'
  );
});

test('composeGoalLines con cero minutos muestra el cero y la meta entera', () => {
  const lineas = goal.composeGoalLines(estadoDe(0, 600));

  assert.equal(lineas.progress, 'Esta semana: 0 de 600 min (0%)');
  assert.equal(lineas.remaining, 'Quedan 600 min');
});

// ---------------------------------------------------------------------------
// Formato de los números (RF-28, y el mismo criterio que RF-34)
// ---------------------------------------------------------------------------

test('composeGoalLines escribe los minutos sin punto ni separador de millares', () => {
  // Los minutos van como enteros pelados: sin "1.500" y sin "1 500".
  const lineas = goal.composeGoalLines(estadoDe(1200, 1500));

  assert.equal(lineas.progress, 'Esta semana: 1200 de 1500 min (80%)');
  assert.equal(lineas.remaining, 'Quedan 300 min');
  assert.ok(!lineas.progress.includes('.'), 'sin punto decimal');
  // El texto sí lleva espacios, como los de la tabla de RF-28; lo que no debe
  // llevar es un separador dentro de los números, ni de miles ni de miles con
  // punto. La comparación exacta de arriba ya lo cubre, y estos dos lo dejan
  // explícito para que el motivo quede a la vista.
  assert.ok(!/\d\s\d/.test(lineas.progress), 'sin separador de millares en la línea de progreso');
  assert.ok(!/\d\s\d/.test(lineas.remaining), 'sin separador de millares en los restantes');
});

test('composeGoalLines compone los cuatro dígitos de minutos', () => {
  const lineas = goal.composeGoalLines(estadoDe(20000, 10080));

  assert.ok(!lineas.met.includes('.'), 'sin punto decimal en el texto de cumplimiento');
  // El texto lleva espacios por los literales de RF-28; lo que no puede llevar es
  // un separador DENTRO de los números. "20.000" o "20 000" fallarían aquí.
  assert.ok(!/\d\s\d/.test(lineas.met), 'sin separador de millares en el texto');
  assert.ok(!/\d\.\d/.test(lineas.met), 'sin punto de millares en el texto');
  assert.ok(lineas.met.includes('20000'), 'el total real aparece tal cual');
});

test('composeGoalLines trunca el porcentaje que muestra el texto', () => {
  // El texto lleva el entero de RF-12, no el cociente: 249 de 600 es 41.5 y se
  // muestra 41 %.
  assert.equal(
    goal.composeGoalLines(estadoDe(249, 600)).progress,
    'Esta semana: 249 de 600 min (41%)'
  );
});

// ---------------------------------------------------------------------------
// RFN-8: el texto que anuncia el lector de pantalla
// ---------------------------------------------------------------------------

test('composeGoalLines compone el aria-valuetext con el total real y la meta', () => {
  // RFN-8 pide un `aria-valuetext` con el total real y la meta. Sale de aquí para
  // que el valor accesible y el visible no puedan divergir.
  const lineas = goal.composeGoalLines(estadoDe(240, 600));

  assert.equal(typeof lineas.valueText, 'string');
  assert.ok(lineas.valueText.includes('240'), 'el total real aparece');
  assert.ok(lineas.valueText.includes('600'), 'la meta aparece');
});

test('composeGoalLines sin meta no compone aria-valuetext', () => {
  // Sin meta no hay barra, así que no hay valor accesible que anunciar (RF-17).
  assert.equal(goal.composeGoalLines(estadoSinMeta()).valueText, undefined);
});

// ---------------------------------------------------------------------------
// Determinismo y contrato de la forma
// ---------------------------------------------------------------------------

test('composeGoalLines devuelve las mismas líneas con la misma entrada', () => {
  const state = estadoDe(240, 600);

  assert.deepEqual(goal.composeGoalLines(state), goal.composeGoalLines(state));
});

test('composeGoalLines no necesita fechas y es determinista entre llamadas', () => {
  // Esta función no recibe ni deriva ninguna fecha: los minutos y la meta no la
  // llevan. Dos llamadas seguidas, con el mismo estado, dan lo mismo.
  const state = estadoDe(240, 600);
  const primero = goal.composeGoalLines(state);
  const segundo = goal.composeGoalLines(state);

  assert.deepEqual(primero, segundo);
  assert.equal(primero.status, segundo.status);
});

test('composeGoalLines no muta el estado recibido', () => {
  const state = estadoDe(240, 600);
  const copia = JSON.parse(JSON.stringify(state));

  goal.composeGoalLines(state);

  assert.deepEqual(JSON.parse(JSON.stringify(state)), copia);
});

test('composeGoalLines con meta nunca devuelve más de una línea de progreso', () => {
  // Un solo sitio decide qué línea va: `progress` y `remaining` o `met`, nunca los
  // tres a la vez ni una mezcla.
  const pendientes = [0, 1, 240, 599];
  const cumplidos = [600, 601, 650, 20000];

  for (const minutes of pendientes) {
    const lineas = goal.composeGoalLines(estadoDe(minutes, 600));

    assert.equal(lineas.met, undefined, `con ${minutes} minutos`);
    assert.equal(typeof lineas.progress, 'string', `con ${minutes} minutos`);
    assert.equal(typeof lineas.remaining, 'string', `con ${minutes} minutos`);
  }

  for (const minutes of cumplidos) {
    const lineas = goal.composeGoalLines(estadoDe(minutes, 600));

    assert.equal(typeof lineas.met, 'string', `con ${minutes} minutos`);
    assert.equal(lineas.progress, undefined, `con ${minutes} minutos`);
    assert.equal(lineas.remaining, undefined, `con ${minutes} minutos`);
  }
});

// ---------------------------------------------------------------------------
// D1 — `normalizeHistory`
// ---------------------------------------------------------------------------

/**
 * D1 — Tests de `normalizeHistory`, escritos antes de la función
 * (RF-25, RF-37, decisión D12 del plan y riesgo R7).
 *
 * `normalizeHistory` es la puerta por la que pasa todo el historial guardado, que
 * es texto JSON que puede haber escrito cualquier versión del archivo. Su trabajo
 * es dejar siempre la misma lista a partir de la misma información, sin importar
 * cómo viniera guardada.
 *
 * Las reglas de RF-25, en orden: descartar lo no interpretable, ordenar de más
 * reciente a más antigua, quedarse con la primera entrada de cada `weekStart`
 * repetido y cortar a `HISTORY_LIMIT`. La quinta, el desempate por `minutes`, no es
 * un adorno: sin ella el resultado heredaría el orden guardado, que es justo lo
 * que R7 avisa (D12).
 *
 * `weekStart` se valida con `isValidDateKey` de `heatmap.js` a través de
 * `GOAL_DEPS`, así que aquí no se comprueban meses ni días. `minutes` y `met` usan
 * las mismas reglas de rango que el resto del archivo: minutos enteros de 0 en
 * adelante, y una `met` entera dentro de [GOAL_MIN, GOAL_MAX].
 *
 * Las fechas de lunes de estos tests son reales a propósito: una constante con un
 * día imposible se descartaría ella sola antes de llegar al caso que se quiere
 * probar.
 */

/** Entrada de historial bien formada, con la `met` por defecto más habitual. */
function entrada(weekStart, minutes, met) {
  return { weekStart, minutes, met: met === undefined ? 600 : met };
}

/** Lunes consecutivos reales, para construir historiales largos sin escribir 20 fechas. */
function serieDeLunes(cuantas, desde) {
  const salida = [];
  let clave = desde;
  for (let i = 0; i < cuantas; i++) {
    salida.push(clave);
    clave = heatmap.addDays(clave, 7);
  }
  return salida;
}

const LUNES_ENERO = '2026-01-05'; // un lunes
const LUNES_MARZO = '2026-03-02';
const LUNES_MARZO_2 = '2026-03-09';
const LUNES_MARZO_3 = '2026-03-16';
const LUNES_MARZO_4 = '2026-03-23';

// ---------------------------------------------------------------------------
// Entrada que no es una lista (RF-37)
// ---------------------------------------------------------------------------

test('normalizeHistory con una entrada que no es una lista devuelve vacío', () => {
  // RF-37: si lo guardado no es una lista, se descarta entero. La aplicación sigue
  // funcionando sin historial y sin aviso.
  const noListas = [
    null, undefined, 600, 'texto', '', true, { weekStart: LUNES_MARZO },
    () => [], new Set([entrada(LUNES_MARZO, 100)])
  ];

  for (const valor of noListas) {
    assert.deepEqual(goal.normalizeHistory(valor), [], `con ${String(valor)}`);
  }
});

test('normalizeHistory con una lista vacía devuelve vacío', () => {
  assert.deepEqual(goal.normalizeHistory([]), []);
});

// ---------------------------------------------------------------------------
// Descarte de entradas no interpretables (RF-25, RF-37)
// ---------------------------------------------------------------------------

test('normalizeHistory descarta las entradas que no son objetos', () => {
  const crudas = [entrada(LUNES_MARZO, 100), null, 'texto', 42, true, undefined,
    entrada(LUNES_MARZO_2, 200)];

  assert.deepEqual(goal.normalizeHistory(crudas), [
    entrada(LUNES_MARZO_2, 200),
    entrada(LUNES_MARZO, 100)
  ]);
});

test('normalizeHistory descarta las entradas con weekStart ausente o inválido', () => {
  const invalidas = [
    { minutes: 100, met: 600 }, // sin weekStart
    { weekStart: '', minutes: 100, met: 600 },
    { weekStart: 'ayer', minutes: 100, met: 600 },
    { weekStart: '2026/03/02', minutes: 100, met: 600 },
    { weekStart: '02-03-2026', minutes: 100, met: 600 },
    { weekStart: 20260302, minutes: 100, met: 600 },
    { weekStart: null, minutes: 100, met: 600 },
    // Fechas que no existen en el calendario, para que se vea que delega en
    // `isValidDateKey` en vez de comprobar solo el formato.
    { weekStart: '2026-02-30', minutes: 100, met: 600 },
    { weekStart: '2026-13-01', minutes: 100, met: 600 }
  ];

  const crudas = invalidas.concat([entrada(LUNES_MARZO, 100)]);

  assert.deepEqual(goal.normalizeHistory(crudas), [entrada(LUNES_MARZO, 100)]);
});

test('normalizeHistory descarta las entradas con minutes inválidos', () => {
  const invalidos = [undefined, null, '600', NaN, Infinity, -1, 10.5, {}, []];

  for (const minutes of invalidos) {
    const crudas = [{ weekStart: LUNES_MARZO, minutes, met: 600 }];
    const resultado = goal.normalizeHistory(crudas);

    assert.deepEqual(resultado, [], `con minutes = ${String(minutes)}`);
  }
});

test('normalizeHistory acepta minutes cero', () => {
  // Una semana sellada sin minutos válidos es "0 de 600 min — pendiente", una
  // entrada legítima. El cero es un valor, no una ausencia.
  assert.deepEqual(goal.normalizeHistory([entrada(LUNES_MARZO, 0)]), [entrada(LUNES_MARZO, 0)]);
});

test('normalizeHistory descarta las entradas con met inválido', () => {
  const invalidos = [undefined, null, '600', NaN, Infinity, MIN - 1, MAX + 1, 600.5, {}];

  for (const met of invalidos) {
    const crudas = [{ weekStart: LUNES_MARZO, minutes: 100, met }];
    const resultado = goal.normalizeHistory(crudas);

    assert.deepEqual(resultado, [], `con met = ${String(met)}`);
  }
});

test('normalizeHistory acepta met en los extremos del rango', () => {
  assert.deepEqual(goal.normalizeHistory([entrada(LUNES_MARZO, 100, MIN)]),
    [entrada(LUNES_MARZO, 100, MIN)]);
  assert.deepEqual(goal.normalizeHistory([entrada(LUNES_MARZO, 100, MAX)]),
    [entrada(LUNES_MARZO, 100, MAX)]);
});

test('normalizeHistory conserva las entradas válidas entre las corruptas', () => {
  // RF-37 pide descartar la entrada mala y conservar el resto sin interrumpir
  // nada: el historial se degrada, no desaparece.
  const crudas = [
    null,
    entrada(LUNES_MARZO, 100),
    { weekStart: 'no-es-fecha', minutes: 300, met: 600 },
    entrada(LUNES_MARZO_2, 200),
    { weekStart: LUNES_MARZO_3, minutes: 'muchos', met: 600 },
    entrada(LUNES_MARZO_4, 0)
  ];

  assert.deepEqual(goal.normalizeHistory(crudas), [
    entrada(LUNES_MARZO_4, 0),
    entrada(LUNES_MARZO_2, 200),
    entrada(LUNES_MARZO, 100)
  ]);
});

// ---------------------------------------------------------------------------
// Orden de más reciente a más antigua (RF-24, RF-25)
// ---------------------------------------------------------------------------

test('normalizeHistory ordena de la más reciente a la más antigua', () => {
  const crudas = [
    entrada(LUNES_MARZO, 100),
    entrada(LUNES_MARZO_4, 400),
    entrada(LUNES_MARZO_2, 200),
    entrada(LUNES_MARZO_3, 300)
  ];

  assert.deepEqual(goal.normalizeHistory(crudas), [
    entrada(LUNES_MARZO_4, 400),
    entrada(LUNES_MARZO_3, 300),
    entrada(LUNES_MARZO_2, 200),
    entrada(LUNES_MARZO, 100)
  ]);
});

test('normalizeHistory ordena cruzando meses y años', () => {
  // El orden no puede ser una comparación por mes y día: "2025-12-29" es anterior a
  // "2026-01-05" aunque su mes sea mayor, y el cruce de año es donde una
  // comparación por mes fallaría.
  const crudas = [
    entrada(YEAR_CROSS_WEEK_START, 30),
    entrada('2026-01-05', 40),
    entrada('2025-09-01', 50)
  ];

  assert.deepEqual(goal.normalizeHistory(crudas), [
    entrada('2026-01-05', 40),
    entrada(YEAR_CROSS_WEEK_START, 30),
    entrada('2025-09-01', 50)
  ]);
});

test('normalizeHistory no muta la lista recibida', () => {
  // F2 persiste el resultado, así que si la normalización mutara su entrada el
  // historial guardado quedaría reordenado sin que nadie lo decidiera (RFN-12).
  const crudas = [entrada(LUNES_MARZO, 100), entrada(LUNES_MARZO_4, 400),
    entrada(LUNES_MARZO_2, 200)];
  const copia = crudas.map((e) => Object.assign({}, e));

  goal.normalizeHistory(crudas);

  assert.deepEqual(crudas, copia);
  assert.deepEqual(crudas.map((e) => e.weekStart), [LUNES_MARZO, LUNES_MARZO_4, LUNES_MARZO_2]);
});

// ---------------------------------------------------------------------------
// Deduplicación y desempate (RF-25, D12, R7)
// ---------------------------------------------------------------------------

test('normalizeHistory conserva una sola entrada de cada weekStart repetido', () => {
  const crudas = [
    entrada(LUNES_MARZO, 100),
    entrada(LUNES_MARZO, 250),
    entrada(LUNES_MARZO_2, 200)
  ];

  const resultado = goal.normalizeHistory(crudas);

  assert.equal(resultado.length, 2);
  assert.deepEqual(resultado, [entrada(LUNES_MARZO_2, 200), entrada(LUNES_MARZO, 250)]);
});

test('normalizeHistory desata por más minutes cuando el weekStart es el mismo', () => {
  // La regla de desempate de RF-25, que es la que cierra R7: con dos entradas de
  // la misma semana gana la de más minutos, se guarden en el orden que se guarden.
  const resultado = goal.normalizeHistory([
    entrada(LUNES_MARZO, 100),
    entrada(LUNES_MARZO, 250)
  ]);

  assert.deepEqual(resultado, [entrada(LUNES_MARZO, 250)]);
});

test('normalizeHistory no depende del orden guardado (R7)', () => {
  // El riesgo completo: el mismo historial en órdenes distintos produce la misma
  // lista, incluidas dos entradas del mismo `weekStart` con `minutes` distintos.
  const base = [
    entrada(LUNES_MARZO, 100),
    entrada(LUNES_MARZO, 250),
    entrada(LUNES_MARZO_2, 200),
    entrada(LUNES_MARZO_3, 300),
    entrada(LUNES_MARZO_4, 50)
  ];

  const esperado = [
    entrada(LUNES_MARZO_4, 50),
    entrada(LUNES_MARZO_3, 300),
    entrada(LUNES_MARZO_2, 200),
    entrada(LUNES_MARZO, 250)
  ];

  assert.deepEqual(goal.normalizeHistory(base), esperado);
  assert.deepEqual(goal.normalizeHistory(base.slice().reverse()), esperado);
  assert.deepEqual(goal.normalizeHistory([base[2], base[0], base[4], base[1], base[3]]), esperado);
});

test('normalizeHistory con muchas semanas duplicadas deja una por semana', () => {
  // Un historial con tres versiones de cada semana: una entrada por `weekStart`, y
  // la de más minutos de cada una.
  const crudas = [];
  for (const [weekStart, valores] of [
    [LUNES_MARZO, [10, 90, 50]],
    [LUNES_MARZO_2, [80, 20]],
    [LUNES_MARZO_3, [40, 40]]
  ]) {
    for (const minutes of valores) crudas.push(entrada(weekStart, minutes));
  }

  const resultado = goal.normalizeHistory(crudas);

  assert.equal(resultado.length, 3);
  assert.deepEqual(resultado, [
    entrada(LUNES_MARZO_3, 40),
    entrada(LUNES_MARZO_2, 80),
    entrada(LUNES_MARZO, 90)
  ]);
});

test('normalizeHistory ordena por fecha aunque los minutos sean todos distintos', () => {
  // El caso que delata un desempate mal puesto: si el orden por `minutes` se
  // aplicara a la lista entera en lugar de solo a los empates de `weekStart`, el
  // resultado saldría ordenado por minutos y estas cuatro semanas se leerían al
  // revés.
  const crudas = [
    entrada(LUNES_MARZO, 600),
    entrada(LUNES_MARZO_2, 999),
    entrada(LUNES_MARZO_3, 10),
    entrada(LUNES_MARZO_4, 400)
  ];

  assert.deepEqual(goal.normalizeHistory(crudas), [
    entrada(LUNES_MARZO_4, 400),
    entrada(LUNES_MARZO_3, 10),
    entrada(LUNES_MARZO_2, 999),
    entrada(LUNES_MARZO, 600)
  ]);
});

// ---------------------------------------------------------------------------
// Corte a las 12 más recientes (RF-24, RF-25)
// ---------------------------------------------------------------------------

test('normalizeHistory corta a las 12 entradas más recientes', () => {
  // 15 lunes consecutivos: solo quedan los 12 más recientes.
  const lunes = serieDeLunes(15, LUNES_ENERO);
  const crudas = lunes.map((clave, i) => entrada(clave, (i + 1) * 10));

  const resultado = goal.normalizeHistory(crudas);

  assert.equal(resultado.length, 12);
  // La lista va de más reciente a más antigua, así que la primera es la última
  // semana y la última es la primera que entra. De 15 lunes se conservan los
  // índices 14 a 3: quedan fuera el 0, el 1 y el 2.
  assert.equal(resultado[0].weekStart, lunes[14]);
  assert.equal(resultado[11].weekStart, lunes[3]);
  assert.ok(!resultado.some((e) => e.weekStart === lunes[2]));
});

test('normalizeHistory corta después de deduplicar, no antes', () => {
  // Si cortara antes de deduplicar, un historial con muchas copias de la misma
  // semana se quedaría corto de semanas distintas.
  const crudas = [];
  for (let i = 0; i < 20; i++) crudas.push(entrada(LUNES_MARZO, i));
  for (let i = 0; i < 15; i++) crudas.push(entrada(LUNES_MARZO_2, i));

  const resultado = goal.normalizeHistory(crudas);

  assert.equal(resultado.length, 2);
  assert.deepEqual(resultado, [entrada(LUNES_MARZO_2, 14), entrada(LUNES_MARZO, 19)]);
});

test('normalizeHistory con exactamente 12 entradas las conserva todas', () => {
  const crudas = serieDeLunes(12, LUNES_ENERO).map((clave, i) => entrada(clave, (i + 1) * 10));

  assert.equal(goal.normalizeHistory(crudas).length, 12);
});

test('normalizeHistory con 13 entradas descarta la más antigua', () => {
  const crudas = serieDeLunes(13, LUNES_ENERO).map((clave, i) => entrada(clave, (i + 1) * 10));

  const resultado = goal.normalizeHistory(crudas);

  assert.equal(resultado.length, 12);
  // La semana 0 es la más antigua y se queda fuera; la 1 es la más antigua que entra.
  assert.equal(resultado[11].weekStart, serieDeLunes(13, LUNES_ENERO)[1]);
  assert.ok(!resultado.some((e) => e.weekStart === LUNES_ENERO));
});

// ---------------------------------------------------------------------------
// Forma de la salida y determinismo (RFN-3, D7)
// ---------------------------------------------------------------------------

test('normalizeHistory devuelve entradas con exactamente los tres campos', () => {
  // Ni uno más, ni uno menos: `sealWeeks` persiste lo que sale de aquí, y un campo
  // de más se acabaría guardando en `localStorage` para siempre.
  const crudas = [{ weekStart: LUNES_MARZO, minutes: 100, met: 600, extra: 'no' }];

  assert.deepEqual(goal.normalizeHistory(crudas), [entrada(LUNES_MARZO, 100)]);
});

test('normalizeHistory es determinista con la misma entrada', () => {
  const crudas = [
    entrada(LUNES_MARZO, 100),
    entrada(LUNES_MARZO, 250),
    entrada(LUNES_MARZO_2, 200)
  ];

  assert.deepEqual(goal.normalizeHistory(crudas), goal.normalizeHistory(crudas));
});

// ---------------------------------------------------------------------------
// D2 — Independencia del orden guardado (RF-25, D12)
// ---------------------------------------------------------------------------

/**
 * D2 — El orden guardado no interviene en el resultado (RF-25, D12).
 *
 * RF-25 lo dice en la última frase: "El orden en que las entradas estaban
 * guardadas no interviene en el resultado". Con lo guardado en `localStorage` eso
 * no es una casualidad: las entradas las escriben `sealWeeks` y F2 en momentos
 * distintos, y una lista reordenada entre dos cargas tiene que llevar a la misma
 * tarjeta y a la misma clave guardada.
 *
 * D1 comprobó el caso pequeño, tres entradas y un empate. Este lo hace fuerte,
 * porque es el test que convierte la regla en algo comprobable de verdad:
 *
 * - Muchas semanas, más de `HISTORY_LIMIT`, para que el corte a 12 también tenga
 *   que ser independiente del orden.
 * - Cruce de meses y de años, con `YEAR_CROSS_WEEK_START`, porque un orden por mes
 *   en vez de por fecha solo se delata ahí.
 * - Varias parejas con el mismo `weekStart` y `minutes` distintos, repartidas por
 *   el historial y no agrupadas al principio, que es como las dejaría un guardado
 *   real.
 * - Entradas corruptas intercaladas, para que el descarte tampoco dependa del
 *   orden en que aparecen las entradas buenas.
 *
 * Las cuatro variantes del historial se construyen con `heatmap.addDays` a partir
 * de fechas lunes reales, y las permutaciones son fijas y escritas a mano en vez
 * de aleatorias: un test con `Math.random` que falla una vez de cada cien no sirve
 * para nada, y una permutación escrita a mano se puede leer y revisar.
 */

test('normalizeHistory da el mismo resultado con el historial guardado en orden arbitrario', () => {
  // El historial base: 16 lunes desde 2025-11-24, que cruza el cambio de año y pasa
  // de 16 a 12 con el corte. Los lunes van en orden ASCENDENTE para que la
  // permutación "natural" del almacenamiento sea la menosrecent-primero, que es
  // justo el orden en el que no debería quedar.
  const lunes = serieDeLunes(16, '2025-11-24');

  // El historial guardado: cada lunes con sus minutos, más tres parejas repetidas
  // con minutos distintos y tres entradas corruptas intercaladas.
  const historial = [
    entrada(lunes[0], 120),              // 2025-11-24
    entrada(lunes[1], 60),               // 2025-12-01
    entrada(lunes[1], 480),              // misma semana, más minutos
    entrada(lunes[2], 0),                // 2025-12-08, cero minutos
    null,                                // corrupta
    entrada(lunes[3], 240),              // 2025-12-15
    { weekStart: 'no-es-fecha', minutes: 999, met: 600 }, // corrupta
    entrada(lunes[4], 30),               // 2025-12-22
    entrada(lunes[7], 90),               // 2026-01-12, cruce de año
    entrada(lunes[7], 700),              // misma semana, más minutos
    entrada(lunes[8], 45),               // 2026-01-19
    entrada(lunes[10], 600),             // 2026-02-02
    entrada(lunes[10], 150),             // misma semana, menos minutos
    { weekStart: LUNES_MARZO, minutes: 'muchos', met: 600 }, // corrupta
    entrada(lunes[12], 510),             // 2026-02-16
    entrada(lunes[14], 75)               // 2026-03-02
  ];

  // El orden que RF-25 exige: más reciente primero, una entrada por semana con los
  // minutos más altos de cada empate, y solo las 12 más recientes.
  const esperado = [
    entrada(lunes[14], 75),
    entrada(lunes[12], 510),
    entrada(lunes[10], 600),
    entrada(lunes[8], 45),
    entrada(lunes[7], 700),
    entrada(lunes[4], 30),
    entrada(lunes[3], 240),
    entrada(lunes[2], 0),
    entrada(lunes[1], 480),
    entrada(lunes[0], 120)
  ];

  // Las cuatro permutaciones. Todas tienen que dar exactamente `esperado`.
  //
  // Al permutar hay que tratar la entrada `null` a propósito: se comprueba con un
  // predicado que no lee `minutes` sin comprobar antes que la entrada es objeto,
  // que es justo lo que hace `normalizeHistory` con la suya.
  const minutosDe = (e) => (e && typeof e === 'object' ? e.minutes : -1);

  const variantes = {
    'como está escrito': historial,
    'al revés': historial.slice().reverse(),
    'ordenado por minutos de mayor a menor': historial.slice().sort((a, b) =>
      minutosDe(b) - minutosDe(a)),
    'las semanas primero y los empates al final': historial.concat(
      historial.filter((e) => e && e.minutes === 480)).reverse()
  };

  for (const [nombre, variante] of Object.entries(variantes)) {
    assert.deepEqual(
      goal.normalizeHistory(variante), esperado,
      `el resultado cambia con el historial ${nombre}`
    );
  }
});

// ---------------------------------------------------------------------------
// D3 — `buildHistoryEntry` e `isWeekEntryMet`
// ---------------------------------------------------------------------------

/**
 * D3 — Tests de `buildHistoryEntry` e `isWeekEntryMet`, escritos antes que las
 * funciones (RF-22, RF-23 y decisión D14).
 *
 * La entrada de historial es `{ weekStart, minutes, met }`, con `met` siendo "la
 * meta vigente en el momento de sellarla". El nombre `met` no es un adorno: es el
 * dato que permite que cada semana se juzgue por sí sola.
 *
 * D14 es la razón de que `isWeekEntryMet` reciba SOLO la entrada. Comparar los
 * minutos con la meta vigente actual daría el mismo resultado mientras la meta sea
 * inmutable, así que la diferencia no se ve; pero en cuanto la meta cambiara, un
 * historial sellado con la meta antigua se reinterpretaría entero y las semanas
 * anotadas cambiarían de couleur retroactivamente. Con la firma de un solo
 * argumento eso no se puede expresar, que es justo lo que hace la firma mejor que un
 * comentario: la regla es estructural, no una promesa.
 *
 * Por eso el test de abajo no llama a `isWeekEntryMet` con dos metas: no hay
 * segundo argumento que pasar. Lo que se comprueba es que `buildHistoryEntry` sella
 * con la meta que recibe, y que la entrada resultante juzga bien por sí sola.
 */

/** Una sesión con la forma que espera `partitionSessions`. */
test('buildHistoryEntry guarda el weekStart, los minutos y la meta', () => {
  // El caso nominal: una semana con dos sesiones válidas y una meta de 600.
  const sesiones = [
    sesion(SEMANA_PASADA_LUNES, 30),
    sesion(SEMANA_PASADA_DOMINGO, 45),
    sesion(TODAY, 900) // otra semana: no cuenta
  ];

  assert.deepEqual(
    goal.buildHistoryEntry(sesiones, SEMANA_PASADA_LUNES, 600),
    { weekStart: SEMANA_PASADA_LUNES, minutes: 75, met: 600 }
  );
});

test('buildHistoryEntry devuelve exactamente las tres claves de la definición', () => {
  // Ni una más: `normalizeHistory` y `localStorage` trabajan con esta forma.
  const entradaNueva = goal.buildHistoryEntry([], SEMANA_PASADA_LUNES, 600);

  assert.deepEqual(Object.keys(entradaNueva).sort(), ['met', 'minutes', 'weekStart']);
});

test('buildHistoryEntry suma solo los minutos válidos de esa semana', () => {
  // Las tres cosas que `getValidMinutesForWeek` excluye: sesión de otra semana,
  // minutos no numéricos y fecha inexistente.
  const sesiones = [
    sesion(SEMANA_PASADA_LUNES, 100),
    sesion(SEMANA_PASADA_LUNES, 'muchos'),
    sesion(SEMANA_PASADA_DOMINGO, 50),
    sesion('2025-02-30', 999), // fecha que no existe
    sesion(TODAY, 888), // semana actual, no es la que se sella
    sesion(SEMANA_PASADA_LUNES, 20)
  ];

  const entradaNueva = goal.buildHistoryEntry(sesiones, SEMANA_PASADA_LUNES, 600);

  assert.equal(entradaNueva.minutes, 170);
});

test('buildHistoryEntry con una semana sin sesiones la sella en cero', () => {
  // Una semana cerrada sin actividad es una entrada legítima, no una ausencia.
  assert.deepEqual(
    goal.buildHistoryEntry([], SEMANA_PASADA_LUNES, 600),
    { weekStart: SEMANA_PASADA_LUNES, minutes: 0, met: 600 }
  );
});

test('buildHistoryEntry pasa su propio weekStart como today', () => {
  // RF-10: los minutos de una semana cerrada se cuentan pasando el `weekStart` de
  // esa semana como `today`, de modo que el rango sea ese lunes y ese domingo.
  // Aquí las sesiones están en la semana pasada y la meta no tiene nada que ver con
  // el rango: si la función usara otra semana, el total saldría cero o mezclado.
  const sesiones = [
    sesion(SEMANA_PASADA_LUNES, 40),
    sesion(SEMANA_PASADA_DOMINGO, 60),
    sesion('2026-09-14', 500), // semana anterior a la sellada
    sesion(WEEK_START, 500) // semana siguiente
  ];

  assert.equal(
    goal.buildHistoryEntry(sesiones, SEMANA_PASADA_LUNES, 600).minutes, 100
  );
});

test('buildHistoryEntry no muta la lista de sesiones recibida', () => {
  // F2 persiste el historial; si el sellado reordenara las sesiones, el dato del
  // usuario cambiaría de sitio (RFN-12, RF-41).
  const sesiones = [
    sesion(SEMANA_PASADA_DOMINGO, 45),
    sesion(SEMANA_PASADA_LUNES, 30),
    sesion(TODAY, 900)
  ];
  const copia = sesiones.map((s) => Object.assign({}, s));

  goal.buildHistoryEntry(sesiones, SEMANA_PASADA_LUNES, 600);

  assert.deepEqual(sesiones, copia);
  assert.deepEqual(sesiones.map((s) => s.date),
    [SEMANA_PASADA_DOMINGO, SEMANA_PASADA_LUNES, TODAY]);
});

test('buildHistoryEntry guarda la meta que recibe, no otra', () => {
  // La `met` de la entrada es la meta vigente en el momento de sellar (definición
  // de "Entrada de historial"). Aquí se comprueba con los dos extremos del rango.
  assert.equal(goal.buildHistoryEntry([], SEMANA_PASADA_LUNES, MIN).met, MIN);
  assert.equal(goal.buildHistoryEntry([], SEMANA_PASADA_LUNES, MAX).met, MAX);
  assert.equal(goal.buildHistoryEntry([], SEMANA_PASADA_LUNES, 1500).met, 1500);
});

// ---------------------------------------------------------------------------
// El cumplimiento se juzga contra la propia `met` de la entrada (RF-23, D14)
// ---------------------------------------------------------------------------

test('isWeekEntryMet dice que sí cuando los minutos alcanzan su propia met', () => {
  assert.equal(goal.isWeekEntryMet({ weekStart: SEMANA_PASADA_LUNES, minutes: 600, met: 600 }), true);
  assert.equal(goal.isWeekEntryMet({ weekStart: SEMANA_PASADA_LUNES, minutes: 650, met: 600 }), true);
  assert.equal(goal.isWeekEntryMet({ weekStart: SEMANA_PASADA_LUNES, minutes: 20000, met: MAX }), true);
});

test('isWeekEntryMet dice que no cuando los minutos se quedan cortos', () => {
  assert.equal(goal.isWeekEntryMet({ weekStart: SEMANA_PASADA_LUNES, minutes: 599, met: 600 }), false);
  assert.equal(goal.isWeekEntryMet({ weekStart: SEMANA_PASADA_LUNES, minutes: 0, met: 600 }), false);
  assert.equal(goal.isWeekEntryMet({ weekStart: SEMANA_PASADA_LUNES, minutes: 9, met: MIN }), false);
});

test('isWeekEntryMet compara minutes con met de la misma entrada', () => {
  // El par que demuestra que usa la `met` de la entrada: 700 minutos parecen
  // pendientes contra una meta de 600, pero cumplidos contra una de 800. La
  // entrada decide.
  const entradaCon700 = { weekStart: SEMANA_PASADA_LUNES, minutes: 700, met: 600 };
  const entradaCon700YMeta800 = { weekStart: SEMANA_PASADA_LUNES, minutes: 700, met: 800 };

  assert.equal(goal.isWeekEntryMet(entradaCon700), true);
  assert.equal(goal.isWeekEntryMet(entradaCon700YMeta800), false);
});

test('isWeekEntryMet no depende de la meta vigente, porque no la recibe', () => {
  // D14 y el "hecho cuando" de D3: la firma tiene un solo argumento, así que no hay
  // forma de pasarle una meta vigente. Este test deja el motivo explícito: si algún
  // día la firma cresciera, la regla se habría roto y este test lo delataría al
  // tener que cambiar.
  assert.equal(goal.isWeekEntryMet.length, 1);

  // Y el resultado depende solo de la entrada, no de nada de fuera.
  const entradaNueva = goal.buildHistoryEntry(
    [sesion(SEMANA_PASADA_LUNES, 700)], SEMANA_PASADA_LUNES, 600
  );

  assert.equal(entradaNueva.met, 600);
  assert.equal(goal.isWeekEntryMet(entradaNueva), true);
});

test('una semana sellada con meta 600 no cambia al sellar con una meta vigente de 800', () => {
  // El caso concreto que el "hecho cuando" pide: la meta vigente cambia entre el
  // sellado y la lectura, y el resultado de la semana no se mueve.
  //
  // La entrada se sella una vez con la meta de entonces (600). Después se sella otra
  // semana con la meta vigente ya cambiada (800). La primera entrada se juzga
  // igual que antes, y la segunda con la suya. Ninguna se reinterpreta.
  const sesiones = [sesion(SEMANA_PASADA_LUNES, 700)];

  const selladaEnSuMomento = goal.buildHistoryEntry(sesiones, SEMANA_PASADA_LUNES, 600);
  const selladaConMetaVigenteNueva = goal.buildHistoryEntry(sesiones, LUNES_MARZO, 800);

  assert.equal(selladaEnSuMomento.met, 600);
  assert.equal(goal.isWeekEntryMet(selladaEnSuMomento), true);

  assert.equal(selladaConMetaVigenteNueva.met, 800);
  // 700 minutos contra su propia meta de 800: pendiente. La meta vigente de 800 no
  // ha reinterpretado la semana anterior, que sigue cumplida con 700 de 600.
  assert.equal(goal.isWeekEntryMet(selladaConMetaVigenteNueva), false);
  assert.equal(goal.isWeekEntryMet(selladaEnSuMomento), true);
});

test('isWeekEntryMet coincide con lo que dice la entrada después de normalizar', () => {
  // El punto donde las tres funciones se juntan: una entrada construida y
  // normalizada tiene que conservar su `met`, y su cumplimiento se decide con ella.
  //
  // Las tres semanas tienen que ser DISTINTAS: `LUNES_MARZO` es 2026-03-02 y
  // `SEMANA_PASADA_DOMINGO` es 2026-09-27, que caen en la misma semana, así que
  // `normalizeHistory` rightly las deduplicaría y este test mediría otra cosa.
  const sesiones = [sesion(SEMANA_PASADA_LUNES, 450)];

  const crudas = [
    goal.buildHistoryEntry(sesiones, SEMANA_PASADA_LUNES, 600),
    goal.buildHistoryEntry(sesiones, LUNES_MARZO, 600),
    goal.buildHistoryEntry(sesiones, LUNES_MARZO_4, 1500)
  ];

  const historial = goal.normalizeHistory(crudas);

  assert.equal(historial.length, 3);
  // De más reciente a más antigua. `SEMANA_PASADA_LUNES` es 2026-09-21, la más
  // reciente de las tres, y las de marzo van detrás.
  assert.deepEqual(historial.map((e) => e.weekStart),
    [SEMANA_PASADA_LUNES, LUNES_MARZO_4, LUNES_MARZO]);
  assert.deepEqual(historial.map((e) => e.met), [600, 1500, 600]);
  // Los 450 minutos de la sesión están en la semana de 2026-09-21, así que esa
  // entrada vale 450 y las dos de marzo valen 0.
  assert.deepEqual(historial.map((e) => e.minutes), [450, 0, 0]);
  // 0 contra 1500 y contra 600: pendiente. 450 contra 600: pendiente.
  assert.deepEqual(historial.map((e) => goal.isWeekEntryMet(e)), [false, false, false]);
});

test('isWeekEntryMet coincide con el cumplimiento tras normalizar cuando una sí llega', () => {
  // El mismo recorrido con una semana cumplida, para que el `true` también pase por
  // la normalización y no solo el `false`.
  const sesiones = [sesion(LUNES_MARZO, 700)];

  const historial = goal.normalizeHistory([
    goal.buildHistoryEntry(sesiones, LUNES_MARZO, 600),
    goal.buildHistoryEntry(sesiones, LUNES_MARZO_2, 1500)
  ]);

  assert.deepEqual(historial.map((e) => e.minutes), [0, 700]);
  // 700 contra su propia meta de 600: cumplida, aunque la otra semana tenga meta
  // 1500. El `met` de cada entrada manda.
  assert.deepEqual(historial.map((e) => goal.isWeekEntryMet(e)), [false, true]);
});

test('buildHistoryEntry es determinista con la misma entrada', () => {
  const sesiones = [sesion(SEMANA_PASADA_LUNES, 45), sesion(TODAY, 900)];

  assert.deepEqual(
    goal.buildHistoryEntry(sesiones, SEMANA_PASADA_LUNES, 600),
    goal.buildHistoryEntry(sesiones, SEMANA_PASADA_LUNES, 600)
  );
});

// ---------------------------------------------------------------------------
// D4 — `listWeeksToSeal`
// ---------------------------------------------------------------------------

/**
 * D4 — Tests de `listWeeksToSeal`, escritos antes que la función
 * (RF-21, RF-26, RF-44, decisiones D5 y D15 del plan).
 *
 * Esta función decide QUÉ semanas se sellan; `sealWeeks` de D5 se ocupará de
 * escribirlas. Devuelve solo las claves de lunes, porque el sellado de D5 va de la más
 * antigua a la más reciente y esa lista es la que lo recorre en orden.
 *
 * Las cuatro reglas, ya resueltas en las revisiones de la spec:
 *
 * 1. Una semana se sella si su `weekStart` es ESTRICTAMENTE posterior a
 *    `setAtWeekStart`. Por eso la semana de la fijación nunca se sella: su
 *    `weekStart` es igual a `setAtWeekStart`, no posterior (D5).
 * 2. Solo semanas cerradas. La semana actual todavía no ha terminado, así que su
 *    resultado no se anota (RF-21).
 * 3. Sin registro de meta no se sella nada, ni una semana (RF-26). Y sin historial,
 *    la semana actual es igual a la última entrada.
 * 4. Si la semana actual es anterior o igual a la de la entrada más reciente, no se
 *    sella nada (RF-44, D15). Sin esto, un reloj atrasado produciría entradas con
 *    `weekStart` en el futuro que bloquearían el sellado posterior.
 *
 * Y un caso que no es una regla sino una consecuencia: si el usuario no abre la app
 * durante varias semanas, se sellan TODAS las intermedias. Una lista que devolviera
 * solo la semana anterior perdería el historial de esas semanas.
 */

/** Registro de meta válido, con la semana de fijación indicada. */
function metaFijadaEn(setAtWeekStart, value) {
  return {
    value: value === undefined ? 600 : value,
    setAt: heatmap.addDays(setAtWeekStart, 4), // un jueves de esa semana
    setAtWeekStart
  };
}

/** Historial con entradas de las semanas indicadas, de más reciente a menos. */
function historialDe(semanas, goalValue) {
  return semanas.map((weekStart) =>
    goal.buildHistoryEntry([], weekStart, goalValue === undefined ? 600 : goalValue));
}

test('listWeeksToSeal sella las semanas cerradas y no la actual', () => {
  // El caso nominal. La meta se fijó en la semana del 2026-09-28 y `TODAY` es un
  // viernes de ESA MISMA semana, así que todavía no ha pasado ninguna semana
  // completa: no hay nada que sellar.
  assert.deepEqual(goal.listWeeksToSeal([], metaFijadaEn('2026-09-28'), TODAY), []);

  // Durante toda la semana del 2026-10-05 no se sella nada: esa semana es la que está
  // en curso, y la única candidata es ella misma. La semana de la fijación, el
  // 2026-09-28, no se sella por ser igual a `setAtWeekStart`.
  assert.deepEqual(goal.listWeeksToSeal([], metaFijadaEn('2026-09-28'), '2026-10-05'), []);
  assert.deepEqual(goal.listWeeksToSeal([], metaFijadaEn('2026-09-28'), '2026-10-06'), []);
  assert.deepEqual(goal.listWeeksToSeal([], metaFijadaEn('2026-09-28'), '2026-10-09'), []);

  // La del 2026-10-05 se sella cuando ya hay una semana completa después: el lunes
  // 2026-10-12 abre una semana nueva y la del 10-05 queda cerrada.
  assert.deepEqual(
    goal.listWeeksToSeal([], metaFijadaEn('2026-09-28'), '2026-10-12'),
    ['2026-10-05']
  );

  // Y el viernes de esa semana sigue sellada solo esa: la del 10-12 está en curso.
  assert.deepEqual(
    goal.listWeeksToSeal([], metaFijadaEn('2026-09-28'), '2026-10-16'),
    ['2026-10-05']
  );

  // El lunes siguiente ya se sella la segunda.
  assert.deepEqual(
    goal.listWeeksToSeal([], metaFijadaEn('2026-09-28'), '2026-10-19'),
    ['2026-10-05', '2026-10-12']
  );
});

test('listWeeksToSeal nunca sella la semana en la que se fijó la meta', () => {
  // D5: la semana de la fijación tiene `weekStart` igual a `setAtWeekStart`, y el
  // sellado exige ser estrictamente posterior. Por eso la primera semana del
  // recorrido es la SIGUIENTE.
  const meta = metaFijadaEn('2026-09-28');

  assert.deepEqual(
    goal.listWeeksToSeal([], meta, '2026-10-30'),
    ['2026-10-05', '2026-10-12', '2026-10-19']
  );
  // Ni una sola vez aparece el propio `setAtWeekStart` en el resultado, por muchas
  // semanas que pasen.
  for (const semana of goal.listWeeksToSeal([], meta, '2026-12-31')) {
    assert.ok(semana > '2026-09-28', `${semana} debería ser posterior a la semana de la fijación`);
  }
});

test('listWeeksToSeal sin registro de meta devuelve vacío', () => {
  // RF-26: sin meta no hay semanas anteriores con compromiso ni posteriores con
  // meta contra la que medirlas.
  assert.deepEqual(goal.listWeeksToSeal([], null, TODAY), []);
  assert.deepEqual(goal.listWeeksToSeal([], undefined, TODAY), []);

  // Tampoco con un historial lleno y con semanas que sí serían sellables: sin meta
  // no se sella ni una semana.
  const historial = historialDe(['2026-09-28', '2026-09-21']);

  assert.deepEqual(goal.listWeeksToSeal(historial, null, '2026-10-23'), []);
  assert.deepEqual(goal.listWeeksToSeal(historial, undefined, '2026-10-23'), []);
});

test('listWeeksToSeal con un historial vacío sella todas las semanas cerradas', () => {
  // Sin historial, la última entrada no existe: solo mandan `setAtWeekStart` y la
  // semana actual. Con la meta fijada en septiembre y hoy en la semana del 10-26, son
  // tres semanas cerradas.
  assert.deepEqual(
    goal.listWeeksToSeal([], metaFijadaEn('2026-09-28'), '2026-10-30'),
    ['2026-10-05', '2026-10-12', '2026-10-19']
  );
});

test('listWeeksToSeal no sella las semanas que ya están anotadas', () => {
  // El historial va de más reciente a menos. Con la semana del 2026-10-19 ya
  // anotada, de las tres candidatas solo quedan dos.
  const meta = metaFijadaEn('2026-09-28');
  const historial = historialDe(['2026-10-19', '2026-10-12']);

  assert.deepEqual(
    goal.listWeeksToSeal(historial, meta, '2026-10-30'),
    ['2026-10-05']
  );

  // Con las tres anotadas, no queda ninguna por sellar.
  const completo = historialDe(['2026-10-19', '2026-10-12', '2026-10-05']);

  assert.deepEqual(goal.listWeeksToSeal(completo, meta, '2026-10-30'), []);
});

test('listWeeksToSeal sella las semanas intermedias si el usuario no abre la app', () => {
  // El caso de varias semanas sin uso. Entre la fijación y hoy hay cuatro semanas
  // cerradas y solo una entrada anotada, así que hay tres por sellar. Devolver solo
  // la más reciente perdería el historial de dos semanas.
  const meta = metaFijadaEn('2026-09-28');
  const historial = historialDe(['2026-09-28']); // solo la semana de la fijación
  const hoy = '2026-10-30'; // viernes de la semana del 2026-10-26, que sigue en curso

  assert.deepEqual(goal.listWeeksToSeal(historial, meta, hoy), [
    '2026-10-05',
    '2026-10-12',
    '2026-10-19'
  ]);

  // Y una semana después se sella la cuarta también, sin salto: la semana del
  // 2026-10-26 pasa a estar cerrada.
  assert.deepEqual(goal.listWeeksToSeal(historial, meta, '2026-11-06'), [
    '2026-10-05',
    '2026-10-12',
    '2026-10-19',
    '2026-10-26'
  ]);
});

test('listWeeksToSeal devuelve las semanas de la más antigua a la más reciente', () => {
  // D5 sella en ese orden, así que la lista viene en ese orden y `sealWeeks` la
  // recorre tal cual. Una lista descendente obligaría a darle la vuelta.
  const meta = metaFijadaEn('2026-09-28');
  const semanas = goal.listWeeksToSeal(historialDe(['2026-09-28']), meta, '2026-11-06');

  assert.equal(semanas.length, 4);
  assert.deepEqual(semanas, semanas.slice().sort());
  assert.equal(semanas[0], '2026-10-05');
  assert.equal(semanas[semanas.length - 1], '2026-10-26');
});

test('listWeeksToSeal salta de lunes a lunes sin meterse en las horas', () => {
  // El salto es sobre claves de fecha. Cualquier `weekStart` devuelto tiene que
  // ser un lunes real, y entre dos devueltos hay exactamente siete días.
  const meta = metaFijadaEn('2026-09-28');
  const semanas = goal.listWeeksToSeal([], meta, '2026-12-18'); // un viernes de diciembre

  assert.ok(semanas.length > 3, 'debería sellar varias semanas');

  for (const weekStart of semanas) {
    assert.equal(heatmap.weekdayIndex(weekStart), 0, `${weekStart} debería ser un lunes`);
  }
  for (let i = 1; i < semanas.length; i++) {
    assert.equal(
      heatmap.addDays(semanas[i], -7), semanas[i - 1],
      `entre ${semanas[i - 1]} y ${semanas[i]} hay exactamente una semana`
    );
  }
});

test('listWeeksToSeal con el reloj atrasado no sella nada', () => {
  // RF-44 y D15: la semana actual es anterior a la de la última entrada. Es un dato
  // de reloj, no de estudio, y no justifica una entrada.
  const meta = metaFijadaEn('2026-09-28');
  const historial = historialDe(['2026-10-12', '2026-10-05']);

  // "Hoy" es de una semana anterior a la entrada más reciente.
  assert.deepEqual(goal.listWeeksToSeal(historial, meta, '2026-09-25'), []);
  // Y también cuando es de varias semanas anterior.
  assert.deepEqual(goal.listWeeksToSeal(historial, meta, '2026-08-14'), []);
});

test('listWeeksToSeal con el reloj en la misma semana de la última entrada no sella nada', () => {
  // El caso igual, que es el otro extremo de RF-44: la semana actual ES la de la
  // última entrada. Ya está anotada y además no ha terminado.
  const meta = metaFijadaEn('2026-09-28');
  const historial = historialDe(['2026-10-05']);

  assert.deepEqual(goal.listWeeksToSeal(historial, meta, '2026-10-07'), []);
  assert.deepEqual(goal.listWeeksToSeal(historial, meta, '2026-10-11'), []);
});

test('listWeeksToSeal con el reloj atrasado ni siquiera sella la semana anterior', () => {
  // El reloj atrás se comprueba ANTES de mirar qué semanas quedan sin anotar. Si se
  // comprobara después, la semana del 2026-10-12 y la siguiente se sellarían y el
  // historial quedaría con entradas en el futuro (D15).
  const meta = metaFijadaEn('2026-09-28');
  const historial = historialDe(['2026-10-05']);

  assert.deepEqual(goal.listWeeksToSeal(historial, meta, '2026-09-28'), []);
});

test('listWeeksToSeal con la semana actual ya anotada devuelve vacío', () => {
  // El caso límite bueno: la última entrada es la semana actual, que no se sella de
  // todos modos. La comprobación del reloj atrás da `[]` por la razón correcta.
  const meta = metaFijadaEn('2026-09-28');
  const historial = historialDe(['2026-10-05', '2026-09-28']);

  assert.deepEqual(goal.listWeeksToSeal(historial, meta, TODAY), []);
});

test('listWeeksToSeal ignora las entradas corruptas del historial al mirar la última', () => {
  // RF-37 quiere que las entradas malas se descarten. La última entrada válida manda,
  // no la última posición de la lista.
  const meta = metaFijadaEn('2026-09-28');
  const historial = [
    entrada('2026-10-05', 100, 600),
    null,
    { weekStart: 'no-es-fecha', minutes: 1, met: 600 },
    entrada(LUNES_MARZO, 50, 600) // 2026-03-02, mucho más antigua
  ];

  // La última entrada válida es la del 2026-10-05. Con `today` en esa misma semana no
  // se sella nada por RF-44, aunque el rango daría semanas por delante.
  assert.deepEqual(goal.listWeeksToSeal(historial, meta, '2026-10-09'), []);
  assert.deepEqual(goal.listWeeksToSeal(historial, meta, '2026-10-12'), []);

  // Y en la semana siguiente, la del 2026-10-19, la del 10-12 ya está cerrada y se
  // sella. Sin la normalización previa, la entrada corrupta `null` o la de
  // `weekStart: 'no-es-fecha'` habrían cambiado qué se considera la última entrada.
  assert.deepEqual(goal.listWeeksToSeal(historial, meta, '2026-10-23'), ['2026-10-12']);
});

test('listWeeksToSeal no sella más de lo que el rango permite con muchas semanas', () => {
  // Un año entero sin abrir la app: entre la semana de la fijación y la semana actual
  // hay casi 52 lunes, y todas menos la semana en curso se sellan. El límite aquí lo
  // pone `today`, no el historial, así que todavía no hay tope de 12: ese lo aplica
  // `normalizeHistory` sobre el resultado.
  const meta = metaFijadaEn('2026-01-05');
  const semanas = goal.listWeeksToSeal([], meta, '2026-12-25');

  // La semana en curso es la del 2026-12-21 y no se sella.
  assert.equal(semanas.length, 49);
  assert.equal(semanas[0], '2026-01-12');
  assert.equal(semanas[48], '2026-12-14');
  assert.ok(!semanas.includes('2026-12-21'), 'la semana en curso no se sella');
});

test('listWeeksToSeal no muta el historial que recibe', () => {
  // F2 persiste el historial: si esta función lo reordenara, el orden guardado
  // cambiaría por una decisión que no es de RF-25 (RFN-12).
  const historial = historialDe(['2026-09-28', '2026-09-21']);
  const copia = historial.map((e) => Object.assign({}, e));

  goal.listWeeksToSeal(historial, metaFijadaEn('2026-09-28'), TODAY);

  assert.deepEqual(historial, copia);
  assert.deepEqual(historial.map((e) => e.weekStart), ['2026-09-28', '2026-09-21']);
});

test('listWeeksToSeal es determinista con la misma entrada', () => {
  const meta = metaFijadaEn('2026-09-28');
  const historial = historialDe(['2026-09-28']);

  assert.deepEqual(
    goal.listWeeksToSeal(historial, meta, '2026-10-23'),
    goal.listWeeksToSeal(historial, meta, '2026-10-23')
  );
});

// ---------------------------------------------------------------------------
// D5 — `sealWeeks`
// ---------------------------------------------------------------------------

/**
 * D5 — Tests de `sealWeeks`, escritos antes que la función
 * (RF-21, RF-22, RF-42, RF-45, decisiones D5 y R3 del plan).
 *
 * `sealWeeks` es el momento en que una semana deja de ser "en curso" y pasa a ser un
 * dato anotado. Devuelve `{ history, changed }`:
 *
 * - `history`: el historial resultante, YA NORMALIZADO. Es lo que F2 persiste y lo
 *   que se pinta, y RF-22 quiere que sean lo mismo en la misma carga. Por eso
 *   normaliza después de sellar, no antes: si normalizara antes, añadir las entradas
 *   nuevas podría dejarlas sin podar o sin ordenar.
 * - `changed`: si de verdad se añadió alguna semana. F2 escribe el historial solo si
 *   `changed` es `true`, y eso evita una escritura en cada carga, que es el caso más
 *   común (T3).
 *
 * Decide QUÉ sellar con `listWeeksToSeal` de D4 y construye cada entrada con
 * `buildHistoryEntry` de D3. Ninguna de las dos reglas se reimplementa aquí: el
 * criterio de "semana cerrada" y el de "semana de la fijación" son de D4, y el de
 * "minutos válidos de esa semana" es de D3.
 */

/** Historial con las entradas de las semanas dadas, selladas con una meta. */
function historialSellado(semanas, goalValue) {
  return semanas.map((weekStart) =>
    goal.buildHistoryEntry([], weekStart, goalValue === undefined ? 600 : goalValue));
}

test('sealWeeks sella varias semanas transcurridas, de la más antigua a la más reciente', () => {
  // El caso de RF-42: el usuario no abrió la app durante varias semanas. La meta se
  // fijó el 2026-09-28 y hoy es un viernes de la semana del 2026-10-19, así que hay
  // dos semanas cerradas por detrás. La del 2026-10-19 es la semana en curso y no se
  // sella, aunque tenga sesiones.
  const meta = metaFijadaEn('2026-09-28');
  const sesiones = [
    sesion('2026-10-05', 100), // semana del 2026-10-05
    sesion('2026-10-13', 200), // semana del 2026-10-12
    sesion('2026-10-20', 300) // semana del 2026-10-19, en curso: NO se sella
  ];

  const { history, changed } = goal.sealWeeks(sesiones, [], meta, '2026-10-23');

  assert.equal(changed, true);
  // De más reciente a más antigua, que es como sale de `normalizeHistory`.
  assert.deepEqual(history, [
    { weekStart: '2026-10-12', minutes: 200, met: 600 },
    { weekStart: '2026-10-05', minutes: 100, met: 600 }
  ]);
  // Los 300 minutos de la semana en curso no aparecen en ninguna entrada.
  assert.ok(!history.some((e) => e.minutes === 300));
});

test('sealWeeks sella cada semana con sus propios minutos', () => {
  // Cada entrada lleva el total de SU semana, no un acumulado. Un total compartido
  // entre las dos semanas del historial sería el error más caro de esta función,
  // porque los números crecerían y todo seguiría pareciendo razonable.
  const meta = metaFijadaEn('2026-09-28');
  const sesiones = [
    sesion('2026-10-05', 100),
    sesion('2026-10-06', 20),
    sesion('2026-10-12', 200),
    sesion('2026-10-13', 30)
  ];

  const { history } = goal.sealWeeks(sesiones, [], meta, '2026-10-23');

  assert.deepEqual(history.map((e) => [e.weekStart, e.minutes]), [
    ['2026-10-12', 230],
    ['2026-10-05', 120]
  ]);
});

test('sealWeeks cargar dos veces en la misma semana no duplica entradas', () => {
  // El caso que fija D5 y que evita R3: la primera carga sella y devuelve `changed:
  // true`; la segunda, con el historial ya devuelto, no sella nada y dice `false`.
  const meta = metaFijadaEn('2026-09-28');
  const sesiones = [sesion('2026-10-05', 100), sesion('2026-10-12', 200)];
  const hoy = '2026-10-23';

  const primera = goal.sealWeeks(sesiones, [], meta, hoy);
  assert.equal(primera.changed, true);
  assert.equal(primera.history.length, 2);

  const segunda = goal.sealWeeks(sesiones, primera.history, meta, hoy);
  assert.equal(segunda.changed, false);
  assert.equal(segunda.history.length, 2);
  // Y el historial es idéntico, no solo igual de largo.
  assert.deepEqual(segunda.history, primera.history);

  // Una tercera vez, por si dos sellados parciales se acumulasen.
  const tercera = goal.sealWeeks(sesiones, segunda.history, meta, hoy);

  assert.equal(tercera.changed, false);
  assert.deepEqual(tercera.history, primera.history);
});

test('sealWeeks sin nada que sellar devuelve changed false y el historial normalizado', () => {
  // Sin meta no se sella nada (RF-26), pero el historial de entrada se devuelve
  // normalizado igualmente: F2 lo persiste y eso no depende de que se sella algo.
  const meta = metaFijadaEn('2026-09-28');
  const desordenado = historialSellado(['2026-09-21', '2026-09-28']);

  const sinMeta = goal.sealWeeks([], desordenado, null, '2026-10-23');
  assert.equal(sinMeta.changed, false);
  assert.deepEqual(sinMeta.history, [
    { weekStart: '2026-09-28', minutes: 0, met: 600 },
    { weekStart: '2026-09-21', minutes: 0, met: 600 }
  ]);

  // Con la semana actual ya anotada tampoco hay nada que sellar, y tampoco con el
  // reloj atrás.
  const yaSellado = historialSellado(['2026-10-19', '2026-10-12', '2026-10-05']);

  assert.equal(goal.sealWeeks([], yaSellado, meta, '2026-10-23').changed, false);
  assert.equal(goal.sealWeeks([], yaSellado, meta, '2026-09-01').changed, false);
});

test('sealWeeks con changed false normaliza el historial aunque no sello nada', () => {
  // El historial corrupto o desordenado se limpia igual, y eso es independiente de
  // si se ha sellado algo: F2 persiste lo que sale, y tiene que salir limpio.
  const meta = metaFijadaEn('2026-09-28');
  const conBasura = [
    entrada('2026-10-19', 100),
    null,
    { weekStart: 'no-es-fecha', minutes: 5, met: 600 },
    entrada('2026-09-21', 50),
    entrada('2026-10-19', 900) // duplicada: gana la de más minutos
  ];

  const { history, changed } = goal.sealWeeks([], conBasura, meta, '2026-10-23');

  assert.equal(changed, false);
  assert.deepEqual(history, [
    { weekStart: '2026-10-19', minutes: 900, met: 600 },
    { weekStart: '2026-09-21', minutes: 50, met: 600 }
  ]);
});

test('sealWeeks abrir el lunes sella la anterior y deja la nueva en cero', () => {
  // RF-45: hoy es lunes 2026-10-12, el día en que empieza la semana. La semana
  // anterior, la del 2026-10-05, está cerrada y se sella con lo que tuviera; la
  // nueva, la del 2026-10-12, acaba de empezar y no se toca.
  const meta = metaFijadaEn('2026-09-28');
  const sesiones = [
    sesion('2026-10-05', 100),
    sesion('2026-10-06', 20),
    sesion('2026-10-12', 30) // ya en la semana nueva: no cuenta en la anterior
  ];

  const { history, changed } = goal.sealWeeks(sesiones, [], meta, '2026-10-12');

  assert.equal(changed, true);
  assert.deepEqual(history, [
    { weekStart: '2026-10-05', minutes: 120, met: 600 }
  ]);

  // Y el progreso de la semana nueva no se ha sellado: no aparece en el historial.
  assert.ok(!history.some((e) => e.weekStart === '2026-10-12'));
});

test('sealWeeks el lunes siguiente sella la semana que empezó ese día', () => {
  // La otra mitad de RF-45: la semana que estaba "en curso" el lunes pasado se sella
  // en la carga siguiente. Aquí hoy es lunes 2026-10-19, así que se sellan la del
  // 2026-10-05 y la del 2026-10-12; la del 2026-10-19 acaba de empezar y no se toca.
  const meta = metaFijadaEn('2026-09-28');
  const sesiones = [
    sesion('2026-10-12', 300),
    sesion('2026-10-19', 40) // semana en curso, no se sella
  ];

  const { history } = goal.sealWeeks(sesiones, [], meta, '2026-10-19');

  assert.deepEqual(history, [
    { weekStart: '2026-10-12', minutes: 300, met: 600 },
    { weekStart: '2026-10-05', minutes: 0, met: 600 }
  ]);
  assert.ok(!history.some((e) => e.weekStart === '2026-10-19'));
});

test('sealWeeks cruza el año y sella la semana del 31 de diciembre bajo su lunes de enero', () => {
  // El cruce de año. La semana que contiene el 2025-12-31 tiene su lunes el
  // 2025-12-29, no en enero: sellarla bajo un lunes de enero cambiaría su
  // `weekStart` y la semana aparecería dos veces si hubiera otra de enero.
  const meta = metaFijadaEn('2025-12-22');
  const sesiones = [
    sesion('2025-12-31', 500), // semana del 2025-12-29
    sesion('2025-12-29', 100), // misma semana
    sesion('2026-01-05', 200), // semana del 2026-01-05
    sesion('2026-01-12', 50) // semana en curso si hoy es 2026-01-13
  ];

  const { history } = goal.sealWeeks(sesiones, [], meta, '2026-01-13');

  assert.deepEqual(history, [
    { weekStart: '2026-01-05', minutes: 200, met: 600 },
    { weekStart: YEAR_CROSS_WEEK_START, minutes: 600, met: 600 }
  ]);
  // El 31 de diciembre se guarda bajo el lunes de SU semana, que es 2025-12-29.
  assert.equal(YEAR_CROSS_WEEK_START, '2025-12-29');
  assert.ok(!history.some((e) => e.weekStart === '2026-01-05' && e.minutes === 600));
});

test('sealWeeks guarda solo los minutos válidos de la semana', () => {
  // Las cuatro formas de sesión inválida que `getValidMinutesForWeek` excluye,
  // mezcladas con las válidas de esa misma semana.
  const meta = metaFijadaEn('2026-09-28');
  const sesiones = [
    sesion('2026-10-05', 100),
    sesion('2026-10-05', NaN),
    sesion('2026-10-05', '60'),
    sesion('2026-10-05', 60.5),
    sesion('2026-10-05', -30),
    sesion('2026-10-06', 20),
    sesion('2025-02-30', 999), // fecha inexistente
    sesion('2026-10-19', 777) // semana en curso, no entra en la anterior
  ];

  const { history } = goal.sealWeeks(sesiones, [], meta, '2026-10-23');

  assert.deepEqual(history, [
    { weekStart: '2026-10-12', minutes: 0, met: 600 },
    { weekStart: '2026-10-05', minutes: 120, met: 600 }
  ]);
  // 120 y no NaN ni un total inflado por los negativos.
  assert.ok(Number.isInteger(history[1].minutes));
});

test('sealWeeks no sella la semana en la que se fijó la meta', () => {
  // D5: la semana de la fijación tiene `weekStart` igual a `setAtWeekStart`. Aquí hay
  // sesiones de esa semana a propósito, para comprobar que no se anotan.
  const meta = metaFijadaEn('2026-09-28');
  const sesiones = [sesion('2026-09-28', 500), sesion('2026-10-05', 100)];

  const { history } = goal.sealWeeks(sesiones, [], meta, '2026-10-23');

  assert.deepEqual(history, [
    { weekStart: '2026-10-12', minutes: 0, met: 600 },
    { weekStart: '2026-10-05', minutes: 100, met: 600 }
  ]);
  assert.ok(!history.some((e) => e.weekStart === '2026-09-28'));
});

test('sealWeeks no sella las semanas que ya están anotadas', () => {
  // Con parte del historial ya escrito, solo se sella lo que falta: queda la del
  // 2026-10-05, y la del 2026-10-12 conserva SUS minutos guardados, no los de ahora.
  const meta = metaFijadaEn('2026-09-28');
  const sesiones = [sesion('2026-10-05', 100), sesion('2026-10-12', 200)];
  const previo = historialSellado(['2026-10-12'], 600);

  const { history, changed } = goal.sealWeeks(sesiones, previo, meta, '2026-10-23');

  assert.equal(changed, true);
  assert.deepEqual(history, [
    { weekStart: '2026-10-12', minutes: 0, met: 600 },
    { weekStart: '2026-10-05', minutes: 100, met: 600 }
  ]);
});

test('sealWeeks podra el historial al historial devuelto', () => {
  // Un año entero de semanas cerradas: el historial devuelto sale podado a
  // `HISTORY_LIMIT`, y por tanto es también lo que F2 persiste.
  const meta = metaFijadaEn('2025-01-06');
  const { history, changed } = goal.sealWeeks([], [], meta, '2026-01-05');

  assert.equal(changed, true);
  assert.equal(history.length, goal.HISTORY_LIMIT);
  // Las 12 más recientes, de más nueva a más antigua.
  assert.equal(history[0].weekStart, '2025-12-29');
  assert.equal(history[history.length - 1].weekStart, '2025-10-13');
});

test('sealWeeks no muta las sesiones ni el historial que recibe', () => {
  // F2 persiste el historial y las sesiones son datos del usuario: el sellado solo
  // lee (RFN-12, RF-41).
  const meta = metaFijadaEn('2026-09-28');
  const sesiones = [sesion('2026-10-12', 200), sesion('2026-10-05', 100)];
  const historial = historialSellado(['2026-09-28']);
  const copiaSesiones = sesiones.map((s) => Object.assign({}, s));
  const copiaHistorial = historial.map((e) => Object.assign({}, e));

  goal.sealWeeks(sesiones, historial, meta, '2026-10-23');

  assert.deepEqual(sesiones, copiaSesiones);
  assert.deepEqual(historial, copiaHistorial);
  assert.deepEqual(historial.map((e) => e.weekStart), ['2026-09-28']);
});

test('sealWeeks es determinista con la misma entrada', () => {
  const meta = metaFijadaEn('2026-09-28');
  const sesiones = [sesion('2026-10-05', 100), sesion('2026-10-12', 200)];

  assert.deepEqual(
    goal.sealWeeks(sesiones, [], meta, '2026-10-23'),
    goal.sealWeeks(sesiones, [], meta, '2026-10-23')
  );
});

test('sealWeeks devuelve exactamente las dos claves del contrato', () => {
  const meta = metaFijadaEn('2026-09-28');
  const conCambio = goal.sealWeeks([], [], meta, '2026-10-23');
  const sinCambio = goal.sealWeeks([], [], null, '2026-10-23');

  assert.deepEqual(Object.keys(conCambio).sort(), ['changed', 'history']);
  assert.deepEqual(Object.keys(sinCambio).sort(), ['changed', 'history']);
  assert.equal(typeof conCambio.changed, 'boolean');
  assert.ok(Array.isArray(conCambio.history));
});

// ---------------------------------------------------------------------------
// Corrección de F7 — `isSameHistory`
// ---------------------------------------------------------------------------

/**
 * `isSameHistory` decide si hay que reescribir el historial guardado (F7, punto 2).
 *
 * El fallo que motivó la función: con más de `HISTORY_LIMIT` semanas ya guardadas y
 * sin ninguna nueva que sellar, `sealWeeks` devolvía `changed: false` y no se
 * escribía nada. La tarjeta pintaba las 12 más recientes porque la normalización se
 * aplica en memoria, pero el almacenamiento seguía con las 15. RF-22 pide que la
 * versión normalizada sea la que se persiste, y el punto 2 de F7 lo comprueba.
 *
 * La comparación mira **el contenido**, no la identidad: dos listas con las mismas
 * entradas en el mismo orden son la misma lista aunque sean objetos distintos. Solo se
 * miran los tres campos canónicos de una entrada, así que el resultado no depende del
 * orden de las claves de cada objeto ni de que la lista guardada lleve campos de más.
 *
 * El caso que tiene que detectar es justamente el de distinta longitud: 15 guardadas
 * frente a 12 normalizadas.
 */

test('isSameHistory dice que dos listas iguales son la misma lista', () => {
  const lista = [entrada(LUNES_MARZO, 100), entrada(LUNES_MARZO_2, 200)];

  assert.equal(goal.isSameHistory(lista, lista), true);
});

test('isSameHistory dice que son la misma lista aunque sean objetos distintos', () => {
  // Contenido, no identidad: dos arrays y objetos recién construidos.
  const uno = [entrada(LUNES_MARZO, 100), entrada(LUNES_MARZO_2, 200)];
  const otro = [entrada(LUNES_MARZO, 100), entrada(LUNES_MARZO_2, 200)];

  assert.notEqual(uno[0], otro[0]);
  assert.equal(goal.isSameHistory(uno, otro), true);
});

test('isSameHistory no depende del orden de las claves de cada entrada', () => {
  // Una lista guardada por otra versión puede llevar las claves en otro orden. Eso
  // no es un cambio de contenido y no debe provocar una escritura.
  const guardado = [
    { met: 600, minutes: 100, weekStart: LUNES_MARZO },
    { weekStart: LUNES_MARZO_2, met: 600, minutes: 200 }
  ];
  const normalizado = [entrada(LUNES_MARZO, 100), entrada(LUNES_MARZO_2, 200)];

  assert.equal(goal.isSameHistory(normalizado, guardado), true);
});

test('isSameHistory no depende de que la lista guardada lleve campos de más', () => {
  const guardado = [
    { weekStart: LUNES_MARZO, minutes: 100, met: 600, otroCampo: 'x' }
  ];

  assert.equal(goal.isSameHistory([entrada(LUNES_MARZO, 100)], guardado), true);
});

test('isSameHistory detecta una lista guardada más larga que la normalizada', () => {
  // El caso de F7: 15 semanas guardadas frente a las 12 que deja la normalización.
  const quince = serieDeLunes(15, LUNES_ENERO).map((clave) => entrada(clave, 100));
  const doce = goal.normalizeHistory(quince);

  assert.equal(quince.length, 15);
  assert.equal(doce.length, goal.HISTORY_LIMIT);
  assert.equal(goal.isSameHistory(doce, quince), false);
});

test('isSameHistory detecta entradas distintas en contenido', () => {
  const uno = [entrada(LUNES_MARZO, 100)];

  assert.equal(goal.isSameHistory(uno, [entrada(LUNES_MARZO, 101)]), false);
  assert.equal(goal.isSameHistory(uno, [entrada(LUNES_MARZO, 100, 1500)]), false);
  assert.equal(goal.isSameHistory(uno, [entrada(LUNES_MARZO_2, 100)]), false);
});

test('isSameHistory detecta el mismo contenido en otro orden', () => {
  const uno = [entrada(LUNES_MARZO, 100), entrada(LUNES_MARZO_2, 200)];
  const otro = [entrada(LUNES_MARZO_2, 200), entrada(LUNES_MARZO, 100)];

  assert.equal(goal.isSameHistory(uno, otro), false);
});

test('isSameHistory trata las listas vacías como iguales', () => {
  assert.equal(goal.isSameHistory([], []), true);
});

test('isSameHistory dice que no cuando algo no es una lista', () => {
  assert.equal(goal.isSameHistory(null, []), false);
  assert.equal(goal.isSameHistory([], null), false);
  assert.equal(goal.isSameHistory('texto', []), false);
  assert.equal(goal.isSameHistory([], {}), false);
});

test('isSameHistory no lanza con entradas mal formadas', () => {
  const guardado = [null, 'texto', { weekStart: LUNES_MARZO }, entrada(LUNES_MARZO, 100)];

  // No debe lanzar aunque la lista guardada tenga basura: la comparación se hace
  // solo con lo que se puede leer.
  assert.equal(typeof goal.isSameHistory([entrada(LUNES_MARZO, 100)], guardado), 'boolean');
  assert.equal(goal.isSameHistory([entrada(LUNES_MARZO, 100)], guardado), false);
});

// ---------------------------------------------------------------------------
// D6 — `composeWeekEntryLine`
// ---------------------------------------------------------------------------

/**
 * D6 — Tests de `composeWeekEntryLine`, escritos antes que la función (RF-34, RFN-4).
 *
 * La línea de una entrada del historial, en el formato exacto de RF-34:
 *
 *     "lunes, 29 de septiembre de 2025 — 650 de 600 min — cumplida"
 *
 * Tres cosas de ese formato se cuelan mal con facilidad y los tests las separan:
 *
 * - El guion largo `—` (U+2014), no el guion corto `-` ni la raya `-`. Se compara
 *   el carácter, y los tests lo comprueban explícitamente.
 * - El estado es exactamente "cumplida" o "pendiente", y sale de `isWeekEntryMet`, que
 *   juzga la entrada contra SU `met`. No se vuelve a decidir aquí.
 * - Los minutos van como enteros pelados: `1200`, nunca `1.200`. Interpolar con
 *   `${}` ya lo garantiza, porque un entero no lleva punto ni separador.
 *
 * Los nombres de día y de mes salen de `GOAL_WEEKDAY_NAMES` y `GOAL_MONTH_NAMES`, que
 * son tablas literales y no `Intl`. Es la misma decisión que en `heatmap.js`, y el
 * motivo es que RF-34 fija cadenas exactas y un `Intl` dependería del locale del
 * navegador (RFN-4).
 *
 * La fecha se construye a mediodía con `localDateFromKey`, para que ningún huso la
 * mueva al día anterior o siguiente (RFN-4).
 */

test('composeWeekEntryLine compone la línea de una semana cumplida', () => {
  // El literal de RF-34, carácter a carácter, incluido el guion largo.
  assert.equal(
    goal.composeWeekEntryLine({ weekStart: '2025-09-29', minutes: 650, met: 600 }),
    'lunes, 29 de septiembre de 2025 — 650 de 600 min — cumplida'
  );
});

test('composeWeekEntryLine compone la línea de una semana pendiente', () => {
  // El segundo literal de RF-34, con los mismos 450 minutos del ejemplo de la spec.
  assert.equal(
    goal.composeWeekEntryLine({ weekStart: '2025-09-29', minutes: 450, met: 600 }),
    'lunes, 29 de septiembre de 2025 — 450 de 600 min — pendiente'
  );
});

test('composeWeekEntryLine separa las partes con un guion largo', () => {
  // El guion tiene que ser el largo U+2014. Con un guion corto la línea parecería
  // correcta al leerla deprisa, así que se compara el código del carácter.
  const linea = goal.composeWeekEntryLine({ weekStart: '2025-09-29', minutes: 650, met: 600 });

  assert.ok(linea.includes(' — '), 'los dos separadores son " guion largo "');
  assert.equal((linea.match(/—/g) || []).length, 2, 'exactamente dos guiones largos');
  assert.ok(!linea.includes(' - '), 'ningún guion corto con espacios');
  assert.equal(linea.charCodeAt(linea.indexOf('—')), 0x2014);
});

test('composeWeekEntryLine con cero minutos la marca pendiente', () => {
  // Una semana sellada sin sesiones es "0 de 600 min — pendiente", no un caso raro.
  assert.equal(
    goal.composeWeekEntryLine({ weekStart: '2025-09-29', minutes: 0, met: 600 }),
    'lunes, 29 de septiembre de 2025 — 0 de 600 min — pendiente'
  );
});

test('composeWeekEntryLine con la meta máxima y cuatro dígitos', () => {
  // Los dos extremos numéricos juntos: meta de 10080 y 12000 minutos, sin separador
  // de millares en ninguno de los dos.
  assert.equal(
    goal.composeWeekEntryLine({ weekStart: '2025-09-29', minutes: 12000, met: 10080 }),
    'lunes, 29 de septiembre de 2025 — 12000 de 10080 min — cumplida'
  );
  assert.equal(
    goal.composeWeekEntryLine({ weekStart: '2025-09-29', minutes: 1200, met: 1500 }),
    'lunes, 29 de septiembre de 2025 — 1200 de 1500 min — pendiente'
  );
});

test('composeWeekEntryLine escribe los minutos sin punto ni separador de millares', () => {
  const linea = goal.composeWeekEntryLine({ weekStart: '2025-09-29', minutes: 12000, met: 10080 });

  assert.ok(!linea.includes('.'), 'sin punto decimal ni de millares');
  // El texto sí lleva espacios, como el literal de RF-34; lo que no puede llevar es
  // un separador DENTRO de los números. "12.000" o "12 000" fallarían aquí.
  assert.ok(!/\d\s\d/.test(linea), 'sin separador de millares dentro del número');
  assert.ok(linea.includes('12000'), 'el total aparece tal cual');
  assert.ok(linea.includes('10080'), 'la meta aparece tal cual');
});

test('composeWeekEntryLine compone una semana de enero con el año correcto', () => {
  // Enero: el mes con menos días y donde un `getMonth()` sin corregir daría
  // "diciembre". El año va siempre, porque el historial cruza años.
  assert.equal(
    goal.composeWeekEntryLine({ weekStart: '2026-01-05', minutes: 300, met: 600 }),
    'lunes, 5 de enero de 2026 — 300 de 600 min — pendiente'
  );
});

test('composeWeekEntryLine nombra cada día de la semana en minúsculas', () => {
  // Los siete lunes consecutivos, para los siete nombres de `GOAL_WEEKDAY_NAMES`.
  const lunes = serieDeLunes(7, '2026-03-02');
  const esperados = [
    'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'
  ];

  for (let i = 0; i < 7; i++) {
    // Cada día de la semana, con su lunes como `weekStart`.
    const weekStart = heatmap.addDays(lunes[0], i);
    const linea = goal.composeWeekEntryLine({ weekStart, minutes: 100, met: 600 });

    assert.ok(
      linea.startsWith(esperados[i] + ', '),
      `esperaba "${esperados[i]}" y la línea empezaba por "${linea.split(',')[0]}"`
    );
    // Y en minúsculas: las tablas ya lo están y no hay que pasarlas por `toLowerCase`.
    assert.equal(linea.split(',')[0], esperados[i]);
  }
});

test('composeWeekEntryLine nombra los doce meses sin Intl', () => {
  // Un lunes de cada mes de 2026, para los doce nombres de `GOAL_MONTH_NAMES`.
  const lunesPorMes = [
    '2026-01-05', '2026-02-02', '2026-03-02', '2026-04-06', '2026-05-04',
    '2026-06-01', '2026-07-06', '2026-08-03', '2026-09-07', '2026-10-05',
    '2026-11-02', '2026-12-07'
  ];
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];

  for (let i = 0; i < 12; i++) {
    const linea = goal.composeWeekEntryLine({
      weekStart: lunesPorMes[i], minutes: 100, met: 600
    });

    assert.ok(
      linea.includes(' de ' + meses[i] + ' de 2026 — '),
      `esperaba el mes "${meses[i]}" y la línea era "${linea}"`
    );
  }
});

test('composeWeekEntryLine cruza el cambio de año sin perder el año', () => {
  // La semana del lunes 2025-12-29: el día es 29 y el año 2025, aunque la semana
  // termine en enero de 2026.
  assert.equal(
    goal.composeWeekEntryLine({ weekStart: YEAR_CROSS_WEEK_START, minutes: 500, met: 600 }),
    'lunes, 29 de diciembre de 2025 — 500 de 600 min — pendiente'
  );

  // Y la primera semana de enero siguiente, con su propio año.
  assert.equal(
    goal.composeWeekEntryLine({ weekStart: '2026-01-05', minutes: 500, met: 600 }),
    'lunes, 5 de enero de 2026 — 500 de 600 min — pendiente'
  );
});

test('composeWeekEntryLine decide el estado con la met de su propia entrada', () => {
  // La misma línea con minutos y metas distintas: el estado sale de `isWeekEntryMet`,
  // que juzga contra la `met` guardada. Con la meta inmutable de la spec 001 da igual,
  // pero la regla es que mande la de la entrada.
  const con650 = goal.composeWeekEntryLine({ weekStart: '2025-09-29', minutes: 650, met: 600 });
  const con450 = goal.composeWeekEntryLine({ weekStart: '2025-09-29', minutes: 450, met: 600 });
  const mismoMinutoOtraMeta = goal.composeWeekEntryLine({
    weekStart: '2025-09-29', minutes: 650, met: 800
  });

  assert.ok(con650.endsWith('cumplida'));
  assert.ok(con450.endsWith('pendiente'));
  // 650 minutos contra una meta de 800: pendiente, aunque los minutos sean los mismos.
  assert.ok(mismoMinutoOtraMeta.endsWith('pendiente'));
  assert.equal(goal.isWeekEntryMet({ weekStart: '2025-09-29', minutes: 650, met: 600 }), true);
});

test('composeWeekEntryLine es determinista con la misma entrada', () => {
  const entradaNueva = { weekStart: '2025-09-29', minutes: 650, met: 600 };

  assert.equal(
    goal.composeWeekEntryLine(entradaNueva),
    goal.composeWeekEntryLine(entradaNueva)
  );
});

// ---------------------------------------------------------------------------
// D7 — Determinismo de todo el archivo puro (RFN-3, RFN-6)
// ---------------------------------------------------------------------------

/**
 * D7 — Determinismo de todas las funciones puras de `goal.js` (RFN-3, RFN-6).
 *
 * Los tests anteriores comprueban cada función por separado, contra lo que la spec
 * dice que tiene que devolver. Este hace otra cosa: comprueba que ninguna depende del
 * momento en que se ejecuta.
 *
 * Es la comprobación que RFN-3 pide en abstracto ("los valores que devuelve no dependen
 * del momento en que se ejecuten") y que ninguna prueba aislada puede dar. Cada test
 * pasa aunque la función consultara el reloj, siempre que en ese instante saliera el
 * valor esperado; aquí se ejecutan dos veces seguidas y se comparan las estructuras
 * enteras, así que un reloj —o un `Math.random`, o un contador interno— lo delata.
 *
 * Las entradas son REALISTAS a propósito. Un test de determinismo con la entrada vacía
 * o con un caso degenerado pasa siempre, incluso con una función que tenga estado
 * interno, porque no hay nada que comparara de más. Aquí hay varias semanas, sesiones
 * de varias fechas, duplicados y alguna entrada corrupta, de modo que dos ejecuciones
 * que difieran en cualquier campo se ven.
 *
 * Solo de test: no hace falta ninguna función nueva.
 */

test('todas las funciones puras de goal.js devuelven lo mismo en dos llamadas seguidas', () => {
  // Un conjunto de entradas compartidas, con datos de verdad: varias semanas,
  // sesiones repartidas y sesión inválidas. Se declaran una sola vez y se pasan a las
  // dos llamadas.
  const sesiones = [
    sesion('2026-09-21', 100),
    sesion('2026-09-22', 55),
    sesion('2026-09-28', 30),
    sesion('2026-10-02', NaN), // inválida: minutos no numéricos
    sesion('2026-10-05', 120),
    sesion('2026-10-06', 80),
    sesion('2026-10-12', 200),
    sesion('2026-10-20', 300), // semana en curso respecto de 2026-10-23
    sesion('2025-02-30', 999) // fecha inexistente
  ];

  const meta = metaFijadaEn('2026-09-28');
  const historialSucio = [
    entrada('2026-10-12', 200, 600),
    null, // corrupta
    entrada('2026-10-12', 50, 600), // duplicada con minutos distintos
    { weekStart: 'no-es-fecha', minutes: 10, met: 600 }, // corrupta
    entrada('2026-09-28', 0, 600)
  ];

  const registro = goal.buildGoalRecord(600, TODAY);
  const entradaHistorial = { weekStart: '2025-09-29', minutes: 650, met: 600 };
  const estadoProgreso = {
    hasGoal: true, goalValue: 600, minutes: 240, progress: goal.computeProgress(240, 600)
  };

  /**
   * Ejecuta las doce funciones puras y devuelve sus resultados. Es una función
   * normal, no un test: el test la llama dos veces y compara.
   */
  function ejecutarTodo() {
    return {
      parseGoalInputAcepta: goal.parseGoalInput(' 600 '),
      parseGoalInputRechaza: goal.parseGoalInput('6e2'),
      parseGoalInputVacio: goal.parseGoalInput(''),
      buildGoalRecord: goal.buildGoalRecord(600, TODAY),
      buildGoalRecordLunes: goal.buildGoalRecord(1500, SEMANA_PASADA_LUNES),
      isValidGoalRecord: goal.isValidGoalRecord(registro),
      isValidGoalRecordSinSetAt: goal.isValidGoalRecord({ value: 600, setAtWeekStart: WEEK_START }),
      isValidGoalRecordMalo: goal.isValidGoalRecord({ value: 9, setAtWeekStart: 'nope' }),
      getValidMinutesActual: goal.getValidMinutesForWeek(sesiones, TODAY),
      getValidMinutesPasada: goal.getValidMinutesForWeek(sesiones, SEMANA_PASADA_LUNES),
      getValidMinutesCerrada: goal.getValidMinutesForWeek(sesiones, '2026-10-19'),
      computeProgress: goal.computeProgress(240, 600),
      computeProgressCumplido: goal.computeProgress(650, 600),
      computeProgressSinMeta: goal.computeProgress(240, null),
      composeGoalLines: goal.composeGoalLines(estadoProgreso),
      composeGoalLinesCumplida: goal.composeGoalLines({
        hasGoal: true, goalValue: 600, minutes: 650, progress: goal.computeProgress(650, 600)
      }),
      composeGoalLinesSinMeta: goal.composeGoalLines(estadoSinMeta()),
      normalizeHistory: goal.normalizeHistory(historialSucio),
      normalizeHistoryVacio: goal.normalizeHistory([]),
      normalizeHistoryNoLista: goal.normalizeHistory('no es una lista'),
      buildHistoryEntry: goal.buildHistoryEntry(sesiones, SEMANA_PASADA_LUNES, 600),
      buildHistoryEntryVacia: goal.buildHistoryEntry([], '2026-10-12', MAX),
      isWeekEntryMet: goal.isWeekEntryMet(entradaHistorial),
      isWeekEntryMetPendiente: goal.isWeekEntryMet({ weekStart: '2025-09-29', minutes: 100, met: 600 }),
      listWeeksToSeal: goal.listWeeksToSeal(historialSucio, meta, TODAY),
      listWeeksToSealVacias: goal.listWeeksToSeal([], meta, TODAY),
      // Con una fecha posterior la entrada más reciente deja de ser la semana en
      // curso, así que hay algo que sellar. Las dos ramas entran en la comparación.
      listWeeksToSealMasAdelante: goal.listWeeksToSeal(historialSucio, meta, '2026-10-23'),
      sealWeeks: goal.sealWeeks(sesiones, historialSucio, meta, '2026-10-23'),
      sealWeeksRepetido: goal.sealWeeks(
        sesiones,
        goal.sealWeeks(sesiones, historialSucio, meta, '2026-10-23').history,
        meta,
        '2026-10-23'
      ),
      composeWeekEntryLine: goal.composeWeekEntryLine(entradaHistorial),
      composeWeekEntryLineCero: goal.composeWeekEntryLine({
        weekStart: YEAR_CROSS_WEEK_START, minutes: 0, met: MAX
      })
    };
  }

  const primera = ejecutarTodo();
  const segunda = ejecutarTodo();

  assert.deepEqual(segunda, primera);

  // Y no vale que el resultado sea vacío o degenerado: si todo devolviera `null`, el
  // `deepEqual` de arriba también pasaría. Se comprueba que hay datos de verdad en las
  // estructuras que tienen que tenerlos.
  assert.ok(primera.buildGoalRecord.setAtWeekStart.length > 0);
  assert.ok(primera.getValidMinutesActual > 0, 'el total de la semana actual no puede ser cero');
  assert.ok(primera.getValidMinutesPasada > 0, 'el total de la semana pasada no puede ser cero');
  assert.equal(primera.normalizeHistory.length, 2, 'el historial sucio debe dar dos entradas');
  // Con `TODAY` la última entrada es la semana en curso y no se sella nada: ese `[]`
  // es el resultado correcto de RF-44, no un caso degenerado.
  assert.deepEqual(primera.listWeeksToSeal, [], 'sin semanas que sellar en la semana en curso');
  // Con una fecha posterior sí hay algo, y el sellado devuelve historial con entradas.
  assert.ok(primera.listWeeksToSealMasAdelante.length > 0, 'debe haber semanas por sellar');
  assert.ok(primera.sealWeeks.history.length > 0, 'el sellado debe devolver historial');
  assert.equal(primera.sealWeeks.changed, true);
  // Y el segundo sellado, sobre el resultado del primero, ya no cambia nada: ese par
  // `changed: true` / `changed: false` es lo que D5 fija.
  assert.equal(primera.sealWeeksRepetido.changed, false);
  assert.ok(primera.composeGoalLines.progress.length > 0);
  assert.ok(primera.composeWeekEntryLine.includes('cumplida'));
});

test('las funciones puras no dependen del orden en que se las llama', () => {
  // El determinismo no es solo "dos veces iguales", también es "igual aunque se llame
  // antes o después que otras". Si alguna dejara estado interno, el orden de llamada
  // lo delataría. Se mide una función en dos posiciones distintas del recorrido.
  const sesiones = [sesion('2026-10-12', 200), sesion('2026-10-05', 100)];
  const meta = metaFijadaEn('2026-09-28');

  // Primero se ejercita todo lo demás, y luego la que se mide.
  goal.normalizeHistory([entrada('2026-09-28', 5)]);
  goal.parseGoalInput('600');
  goal.computeProgress(100, 600);
  const despues = goal.sealWeeks(sesiones, [], meta, TODAY);

  // Ahora la misma llamada sin nada delante.
  const sola = goal.sealWeeks(sesiones, [], meta, TODAY);

  assert.deepEqual(sola, despues);
});

test('normalizeHistory es idempotente sobre su propia salida', () => {
  // Normalizar dos veces seguidas da la misma lista, que es lo que necesita F2:
  // escribir lo ya normalizado no puede volver a cambiarlo.
  const crudas = [
    entrada(LUNES_MARZO_3, 300),
    entrada(LUNES_MARZO, 100),
    entrada(LUNES_MARZO_3, 900),
    entrada(LUNES_MARZO_2, 200)
  ];

  const una = goal.normalizeHistory(crudas);
  const dos = goal.normalizeHistory(una);

  assert.deepEqual(dos, una);
});

// ---------------------------------------------------------------------------
// Corrección de @reviewer — RF-26: sin meta no se muestra historial
// ---------------------------------------------------------------------------

/**
 * Corrección de @reviewer — tests de `selectVisibleHistory`, escritos antes que la
 * función (RF-26).
 *
 * El defecto que motivó la función: `sealAndPersistWeeks` salía temprano sin meta, así
 * que no se SELLABA ninguna semana, pero `paintGoalHistory` solo miraba
 * `weeks.length === 0` y las pintaba igualmente. Con semanas ya guardadas de cargas
 * anteriores y sin meta, la tarjeta pintaba la lista. RF-26 dice las dos cosas —
 * "no sella ninguna semana Y no muestra historial"— y solo se cumplía la primera.
 *
 * La regla se deja aquí, en lógica pura, y no en `app.js`, precisamente por esto: es un
 * criterio de aceptación y queda cubierto por `node --test` en lugar de depender de que
 * alguien mire la pantalla. `app.js` se limita a pintar lo que esta función devuelve.
 *
 * El detalle que hace que el defecto pasara desapercibido es que el historial guardado
 * solo existe si hubo una meta antes. Por eso los tests de aquí SIEMPRE pasan semanas
 * guardadas: una lista vacía pasaría con cualquier implementación, porque
 * `weeks.length === 0` ya la ocultaba. Lo que se comprueba es el caso que la versión
 * anterior no cubría, el de lista NO vacía con meta ausente.
 */

/** Un historial de varias semanas, todas interpretables y dentro de rango. */
function historialVariasSemanas() {
  return [
    entrada('2026-10-12', 700, 600),
    entrada('2026-10-05', 200, 600),
    entrada('2026-09-28', 450, 600)
  ];
}

test('selectVisibleHistory no muestra historial sin meta aunque haya semanas guardadas', () => {
  // El defecto de @reviewer, caso A: `study-diary-weeks` con entradas y
  // `study-diary-goal` ausente. Salía la lista en pantalla.
  const historial = historialVariasSemanas();

  assert.equal(historial.length, 3, 'el historial guardado tiene entradas de verdad');
  assert.deepEqual(goal.selectVisibleHistory(null, historial), []);
});

test('selectVisibleHistory sin meta ignora hasta el historial más largo posible', () => {
  // El mismo caso con el historial ya podado a `HISTORY_LIMIT`, que es lo que llega
  // desde `loadWeeks`. Que devuelva vacío no depende de cuántas semanas haya.
  const quince = serieDeLunes(15, LUNES_ENERO).map((clave) => entrada(clave, 100, 600));
  const historial = goal.normalizeHistory(quince);

  assert.equal(historial.length, goal.HISTORY_LIMIT);
  assert.deepEqual(goal.selectVisibleHistory(null, historial), []);
});

test('selectVisibleHistory sí muestra el historial cuando hay meta', () => {
  // El caso que no debe romperse (RF-24): con meta, las 12 entradas se muestran.
  const historial = historialVariasSemanas();

  assert.deepEqual(goal.selectVisibleHistory(metaFijadaEn('2026-09-28'), historial), historial);
});

test('selectVisibleHistory con meta devuelve el historial sin filtrar ni reordenar', () => {
  // No decide qué semanas se pintan: eso es de `normalizeHistory` y de `sealWeeks`.
  // Solo la condición de visibilidad. Por eso sale la lista TAL CUAL, en el mismo
  // orden y con las mismas entradas, sin copiar, podar ni deduplicar.
  const historial = historialVariasSemanas();

  const visible = goal.selectVisibleHistory(metaFijadaEn('2026-09-28'), historial);

  assert.equal(visible, historial, 'con meta devuelve la misma lista, sin copiarla');
  assert.deepEqual(visible.map((e) => e.weekStart), [
    '2026-10-12', '2026-10-05', '2026-09-28'
  ]);
});

test('selectVisibleHistory con meta devuelve vacío si no hay nada guardado', () => {
  // El estado "meta fijada, todavía no se ha cerrado ninguna semana": la lista se
  // oculta y el título también, que es lo que hace `paintGoalHistory`.
  assert.deepEqual(goal.selectVisibleHistory(metaFijadaEn('2026-09-28'), []), []);
});

test('selectVisibleHistory trata meta ausente igual que meta nula', () => {
  // `goalRecord` vale `null` en la app, pero una llamada con la variable sin definir
  // tiene que dar el mismo resultado y no lanzar.
  const historial = historialVariasSemanas();

  assert.deepEqual(goal.selectVisibleHistory(undefined, historial), []);
});

test('selectVisibleHistory no lanza con un historial que no es una lista', () => {
  // El almacenamiento puede traer cualquier cosa. Con meta, algo ilegible se trata
  // como "no hay nada que mostrar", igual que `normalizeHistory` devuelve `[]`.
  const meta = metaFijadaEn('2026-09-28');

  assert.deepEqual(goal.selectVisibleHistory(meta, null), []);
  assert.deepEqual(goal.selectVisibleHistory(meta, undefined), []);
  assert.deepEqual(goal.selectVisibleHistory(meta, 'texto'), []);
  assert.deepEqual(goal.selectVisibleHistory(meta, {}), []);
  assert.deepEqual(goal.selectVisibleHistory(meta, 42), []);
});

test('selectVisibleHistory sin meta no muta el historial que recibe', () => {
  // RFN-12. Devuelve un array NUEVO vacío, no la lista recibida: quien la llama vacía
  // el DOM con ella y la referencia no debe quedar sensible.
  const historial = historialVariasSemanas();
  const copia = historial.map((e) => Object.assign({}, e));

  const visible = goal.selectVisibleHistory(null, historial);
  visible.push(entrada('2026-09-21', 999, 600));

  assert.deepEqual(historial, copia);
  assert.equal(historial.length, 3, 'el historial recibido no crece');
  assert.notEqual(visible, historial, 'devuelve una lista distinta de la recibida');
});

test('selectVisibleHistory es determinista y no depende del reloj ni del orden', () => {
  // Lo mismo que comprueba D7 para el resto del archivo, aplicado a esta función: dos
  // llamadas seguidas dan el mismo resultado, y no cambia por llamarla antes o después
  // que las demás (RFN-3, RFN-6).
  const historial = historialVariasSemanas();
  const meta = metaFijadaEn('2026-09-28');

  function medir() {
    return {
      sinMeta: goal.selectVisibleHistory(null, historial),
      sinMetaVacio: goal.selectVisibleHistory(null, []),
      conMeta: goal.selectVisibleHistory(meta, historial),
      conMetaVacio: goal.selectVisibleHistory(meta, []),
      ilegible: goal.selectVisibleHistory(meta, 'no es una lista')
    };
  }

  assert.deepEqual(medir(), medir());

  // Con otras funciones delante, para que se note si esta guardara estado.
  goal.normalizeHistory(historial);
  goal.computeProgress(240, 600);
  goal.parseGoalInput('600');

  assert.deepEqual(medir(), {
    sinMeta: [],
    sinMetaVacio: [],
    conMeta: historial,
    conMetaVacio: [],
    ilegible: []
  });
});

test('sin meta no se sella y no se ve: las dos mitades de RF-26 leen lo mismo', () => {
  // RF-26 dice "no sella ninguna semana y no muestra historial". `sealWeeks` devuelve un
  // historial vacío sin meta (la mitad de no sellar) y `selectVisibleHistory` devuelve
  // una lista vacía (la de no mostrar). Los dos caminos se comprueban sobre el mismo
  // estado: semanas ya guardadas y ninguna meta.
  const semanasGuardadas = historialVariasSemanas();
  const meta = null;

  const sellado = goal.sealWeeks([], semanasGuardadas, meta, '2026-10-23');

  // Lo guardado no se toca: sin meta no se escribe, y lo que había sigue ahí para una
  // futura carga con meta.
  assert.deepEqual(sellado.history, semanasGuardadas);
  assert.equal(sellado.changed, false, 'sin meta no se sella ni se cambia nada');
  // Pero de lo guardado no se muestra nada.
  assert.deepEqual(goal.selectVisibleHistory(meta, sellado.history), []);
});

test('con meta se sellan las semanas que falten y se muestran todas', () => {
  // El reverso del anterior: el caso normal, con meta vigente.
  //
  // La fecha es posterior a varias semanas ya registradas a propósito. Con `2026-10-23`
  // no habría nada que sellar —las tres semanas posteriores a la meta ya están
  // anotadas— y el test mediría solo que `changed` es `false`. Con `2026-11-09`
  // sí quedan por cerrar cuatro semanas, que es lo que de verdad se quiere comprobar:
  // el sellado añade lo que falta y lo añadido se muestra.
  const meta = metaFijadaEn('2026-09-28');
  const previas = historialVariasSemanas();

  const sellado = goal.sealWeeks([], previas, meta, '2026-11-09');

  assert.equal(sellado.changed, true);
  // Se muestra lo que hay, ya normalizado y podado.
  const visible = goal.selectVisibleHistory(meta, sellado.history);

  assert.equal(visible, sellado.history);
  assert.ok(visible.length > previas.length, 'el sellado ha añadido semanas');
  assert.ok(visible.length <= goal.HISTORY_LIMIT, 'y nunca por encima del límite');
  // Lo ya anotado conserva SUS minutos, no los de ahora: aquí no hay sesiones, así que
  // las nuevas semanas salen con 0 y las viejas siguen con lo suyo.
  assert.equal(visible.find((e) => e.weekStart === '2026-10-12').minutes, 700);
  assert.equal(visible.find((e) => e.weekStart === '2026-10-19').minutes, 0);
});

// ---------------------------------------------------------------------------
// Corrección de @reviewer — `GOAL_CARD_TITLE` deja de ser código muerto
// ---------------------------------------------------------------------------

/**
 * `GOAL_CARD_TITLE` era una constante exportada y testeada que NO usaba nadie: el
 * encabezado real de la página era el literal de `index.html`, así que el test daba
 * verde aunque el `<h2>` dijera otra cosa. Era un criterio de aceptación más débil de lo
 * que parecía.
 *
 * La salida elegida es que `app.js` pinte el encabezado desde la constante, con
 * `textContent`, que sustituye en vez de añadir. Aquí no se puede comprobar el DOM, pero
 * sí se puede fijar lo que el otro extremo necesita: que la constante existe, que no
 * está vacía y que es el mismo texto que el prefijo de la línea de estado. Ese último
 * punto es el que hace útil el test: RF-28 dice que el nombre del objetivo va una sola
 * vez, en el encabezado, y que la línea de estado solo lo acompaña con el valor. Si las
 * dos cadenas se desincronizasen, la tarjeta repetiría el nombre.
 *
 * La coherencia con el marcado —que el `<h2>` de `index.html` diga lo mismo— se comprueba
 * en el navegador, no aquí: `goal.test.js` no lee ficheros.
 */

test('GOAL_CARD_TITLE no está vacía', () => {
  // Si la constante se vaciara, el encabezado de la página se quedaría en blanco.
  assert.equal(typeof goal.GOAL_CARD_TITLE, 'string');
  assert.ok(goal.GOAL_CARD_TITLE.length > 0, 'el encabezado no puede estar vacío');
  assert.equal(goal.GOAL_CARD_TITLE, goal.GOAL_CARD_TITLE.trim(), 'sin espacios sobrantes');
});

test('el encabezado y el prefijo de estado comparten el nombre del objetivo', () => {
  // RF-28: el nombre va una sola vez, en el encabezado, y el estado solo lo acompaña
  // con el valor ("Objetivo semanal: 600 min"). Si el nombre se escribiera dos veces con
  // distinta forma, la tarjeta lo repetiría y el test de la constante no lo detectaría.
  const estadoConMeta = goal.composeGoalLines({
    hasGoal: true, goalValue: 600, minutes: 240, progress: goal.computeProgress(240, 600)
  });

  assert.ok(
    estadoConMeta.status.startsWith(goal.GOAL_CARD_TITLE),
    `el estado "${estadoConMeta.status}" debería empezar por el encabezado "${goal.GOAL_CARD_TITLE}"`
  );
  // Y el estado sin meta también lo lleva, con el mismo nombre.
  assert.ok(
    goal.composeGoalLines(estadoSinMeta()).status.startsWith(goal.GOAL_CARD_TITLE),
    'el estado sin meta también lleva el nombre del encabezado'
  );
});