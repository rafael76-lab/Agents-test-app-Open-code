# F8 — Ejecución completa de `node --test` y mapa de los 33 criterios

Tarea F8 de `tasks.md`. Cubre el principio 4 de la constitución.

**Reescrito tras la corrección de @reviewer.** La versión anterior de esta nota
declaraba que "los 33 están cubiertos, ninguno se queda sin test". Eso era exacto para 31
y deshonesto para 2: los bullets 12 y 28 figuran en la spec como verificables con
`node --test`, pero son comportamiento de cableado en `app.js` y ningún test los cubre.
Esta versión distingue las tres situaciones reales: con test, con comprobación manual, y
cubierto de forma estructural por la ausencia de un mecanismo.

## 1. Recuento real

```
$ node --test
ℹ tests 289
ℹ pass  289
ℹ fail  0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Desglose por fichero:

| Fichero | Tests |
|---|---|
| `diary.test.js` | 23 |
| `heatmap.test.js` | 45 |
| `goal.test.js` | 221 |
| **Total** | **289** |

Los 221 de `goal.test.js` se declaran en el fichero con 221 llamadas `test(...)`. Las
primeras entradas del TAP son las de `diary.test.js` y `heatmap.test.js`.

El recuento ha subido en tres tramos: 266 en la primera pasada de F8, +10 con la
corrección de F7 (`isSameHistory`), y +13 con las correcciones de @reviewer
(`selectVisibleHistory` ×11 y el refuerzo de `GOAL_CARD_TITLE` ×2).

## 2. `diary.test.js` y `heatmap.test.js` intactos

| Fichero | Bytes | SHA-256 (16) |
|---|---|---|
| `diary.test.js` | 4861 | `C61CB0AC7A26A08C` |
| `heatmap.test.js` | 15760 | `E734A7538AA4D495` |

Idénticos a los que había en la primera pasada de F8: mismos bytes y mismo hash. No se
ha escrito en ellos en ningún momento. Sus 23 y 45 tests siguen en verde.

## 3. El test de A3 sigue verde

Es la puerta que protege RFN-3 y RFN-4, y la que más daño hizo cuando `GOAL_DEPS` le
faltaba una entrada:

```
✔ goal.js no usa toISOString, Date.now ni new Date() sin argumentos
✔ el detector distingue el código prohibido del que solo se menciona
```

El segundo es la autocomprobación del detector: sin él, el primero podría estar verde
siempre y verde sin comprobar nada.

## 4. Cómo se cubre cada uno de los 33 criterios

Antes de la corrección, esta nota decía "cada criterio tiene su test" y lo daba por
cumplido. El reparto correcto es el siguiente:

| Cómo se cubre | Nº de criterios | Qué significa |
|---|---|---|
| Con test de `node --test` | **31** | Hay al menos un test en `goal.test.js` que falla si el criterio se rompe |
| Por comprobación manual | **1** (el 12) | Comportamiento de `app.js`; no hay test que lo capturre |
| De forma estructural | **1** (el 28) | Se cumple por la **ausencia del mecanismo** que lo podría romper |

Ninguno de los 33 se queda sin cubrir, pero solo 31 tienen un test que lo proteja. La
diferencia importa: un test que falla es una alarma; una comprobación manual es una
mirada, y la ausencia de un temporizador es un argumento, no una prueba.

### Los 31 criterios con test

| # | Criterio de la spec | Test(s) que lo cubren |
|---|---|---|
| 1 | Parseo del campo de meta, regla de RF-4 | `parseGoalInput` ×21: acepta 10/600/10080/`" 600 "`; rechaza vacío, espacios, 0, 9, negativos, `"600.0"`, `"60,0"`, `"+600"`, `"6e2"`, `"600 min"`, 10081, no numéricos, dígitos no occidentales, `null`, `undefined`, marcas de cifra Unicode |
| 2 | RF-7: `setAt` y `setAtWeekStart` para lunes, miércoles, domingo y 1 de enero no bisiesto | `buildGoalRecord devuelve los tres campos con el today del viernes`, `… con today de lunes`, `… miércoles`, `… domingo`, `… con el 1 de enero no bisiesto` |
| 3 | RF-9: minutos válidos excluyen `NaN`, no numéricos, decimales, cero, negativos, ausentes y fechas inexistentes; el total nunca es `NaN` ni supera al de las válidas | `getValidMinutesForWeek nunca devuelve NaN`, `… excluye los minutos no numéricos`, `… los minutos decimales`, `… el cero y los negativos`, `… los minutos ausentes`, `… las fechas que no existen en el calendario`, `… nunca supera el total de las sesiones válidas` |
| 4 | RF-9 y RF-10: los minutos de una semana son la suma de sus sesiones válidas y las de otras semanas no cuentan | `getValidMinutesForWeek suma las sesiones válidas de la semana actual`, `… excluye lo que cae fuera de la semana` |
| 5 | RF-10: pasar el `weekStart` de una semana pasada devuelve sus minutos, no los de la actual | `getValidMinutesForWeek con el weekStart de una semana pasada suma esa semana`, `… con el weekStart pasado no arrastra la semana actual` |
| 6 | RF-10: frontera de domingo 23:59 y lunes 00:00 con la fecha desplazada un día | `getValidMinutesForWeek en el domingo a las 23:59 y en el lunes a las 00:00 separa semanas`, `… no pierde ni duplica minutos en la frontera de semana` |
| 7 | RF-11: meta superada, restantes cero y no negativos | `computeProgress al superar la meta corta al 100 y pone restantes en cero`, `… nunca devuelve un porcentaje mayor de 100` |
| 8 | RF-12 y RF-13: truncado 249→41, 599→99, 600→100, 650→100, y el relleno usa ese mismo entero | `computeProgress trunca hacia abajo en lugar de redondear`, `… no redondea el 99 al 100`, `… con los minutos justos`, `… al superar la meta`, `… devuelve el relleno de la barra igual a la proporción` |
| 9 | RF-12 y RF-13: meta 10080 con 20000 minutos, proporción y relleno sin pasar de 100 | `computeProgress con una meta de 10080 y 20000 minutos`, `… nunca devuelve un porcentaje mayor de 100` |
| 10 | RF-14, RF-15 y RF-16: meta igual, por debajo y por encima de los minutos | `computeProgress clasifica el objetivo según RF-14 y RF-15`, `… con los minutos justos`, `… al superar la meta` |
| 11 | RF-17: sin meta no hay restantes ni proporción | `computeProgress devuelve null si no hay meta`, `… tolera minutos no numéricos sin lanzar` |
| 12 | RF-18 y RF-19 | **Sin test.** Ver "Criterio 12" más abajo |
| 13 | RF-20: las sesiones anteriores a fijar la meta cuentan | `getValidMinutesForWeek cuenta los minutos anteriores a fijar la meta` |
| 14 | RF-21: se sellan las semanas posteriores a `setAtWeekStart`, no las anteriores ni la de la fijación | `listWeeksToSeal nunca sella la semana en la que se fijó la meta`, `… con un historial vacío sella todas las semanas cerradas`, `… corta a las 12 entradas más recientes` |
| 15 | RF-21: varias semanas transcurridas, todas y en orden de la más antigua a la más reciente | `listWeeksToSeal sella las semanas intermedias si el usuario no abre la app`, `… devuelve las semanas de la más antigua a la más reciente`, `sealWeeks sella varias semanas transcurridas` |
| 16 | RF-21 y RF-22: minutos válidos e inválidos mezclados, la entrada guarda solo los válidos | `sealWeeks guarda solo los minutos válidos de la semana` |
| 17 | RF-22: el historial sellado se devuelve normalizado y esa versión es la que se persiste | `sealWeeks con changed false normaliza el historial aunque no sello nada`, `… devuelve exactamente las dos claves del contrato`. La persistencia la cierra `isSameHistory`: `… detecta una lista guardada más larga que la normalizada`, `… dice que son la misma lista aunque sean objetos distintos` |
| 18 | RF-23: con `metaVigente` distinta de `entrada.met`, el resultado depende solo de `entrada.met` | `isWeekEntryMet no depende de la meta vigente, porque no la recibe`, `… compara minutes con met de la misma entrada`, `una semana sellada con meta 600 no cambia al sellar con una meta vigente de 800` |
| 19 | RF-24 y RF-25: orden descendente, deduplicación por `weekStart` conservando la primera, corte a 12 | `normalizeHistory ordena de la más reciente a la más antigua`, `… conserva una sola entrada de cada weekStart repetido`, `… corta a las 12 entradas más recientes`, `… corta después de deduplicar, no antes` |
| 20 | RF-25: orden arbitrario frente a inverso, con empate por `minutes` | `normalizeHistory no depende del orden guardado (R7)`, `… desata por más minutes cuando el weekStart es el mismo`, `normalizeHistory da el mismo resultado con el historial guardado en orden arbitrario` (D2) |
| 21 | RF-25: entradas sin `weekStart`, `minutes` o `met`, o no numéricas, se descartan y las demás sobreviven | `normalizeHistory descarta las entradas con weekStart ausente o inválido`, `… con minutes inválidos`, `… con met inválido`, `… conserva las entradas válidas entre las corruptas` |
| 22 | RF-26: sin meta no se sella ninguna semana **y no se muestra historial** | `listWeeksToSeal sin registro de meta devuelve vacío`, `sealWeeks sin nada que sellar devuelve changed false…`, y de la corrección de @reviewer: `selectVisibleHistory no muestra historial sin meta aunque haya semanas guardadas`, `… sin meta no sella y no se ve: las dos mitades de RF-26 leen lo mismo` |
| 23 | RF-27: añadir minutos a una semana sellada no modifica su entrada | `sealWeeks no sella las semanas que ya están anotadas`, `… no muta las sesiones ni el historial que recibe` |
| 24 | RF-34: formato exacto de la línea, con 0 minutos, 1200, meta 10080 y semana de enero | `composeWeekEntryLine con cero minutos…`, `… con la meta máxima y cuatro dígitos`, `… escribe los minutos sin punto ni separador de millares`, `… compone una semana de enero con el año correcto`, `… separa las partes con un guion largo`, `… nombra los doce meses sin Intl`, `… cruza el cambio de año sin perder el año` |
| 25 | RF-37: historial que no es una lista y entradas incompletas, sin lanzar | `normalizeHistory con una entrada que no es una lista devuelve vacío`, `… descarta las entradas que no son objetos`, `… descarta las entradas con weekStart ausente o inválido` |
| 26 | RF-38: `value` decimal, no numérico, fuera de rango o ausente; `setAtWeekStart` ausente o malformado; solo falta `setAt` es válido | `isValidGoalRecord rechaza un value decimal`, `… no numérico`, `… fuera de rango`, `… los valores ausentes`, `… un setAtWeekStart ausente`, `… que no es texto de fecha`, `… una fecha que no existe en el calendario`, `… acepta un registro al que solo le falta setAt`, `… acepta un registro con setAt malformado` |
| 27 | RF-42: cargar dos veces en la misma semana no sella por duplicado | `sealWeeks cargar dos veces en la misma semana no duplica entradas` |
| 28 | RF-43 | **Estructural, sin test.** Ver "Criterio 28" más abajo |
| 29 | RF-44: semana actual anterior o igual a la última entrada, no se sella | `listWeeksToSeal con el reloj atrasado no sella nada`, `… con el reloj en la misma semana de la última entrada no sella nada` |
| 30 | RF-45: cargar el lunes sella la semana anterior y la nueva está en cero | `sealWeeks abrir el lunes sella la anterior y deja la nueva en cero`, `… el lunes siguiente sella la semana que empezó ese día` |
| 31 | Cruce de año: la semana del 31 de diciembre se sella con su clave correcta y no con una repetida | `sealWeeks cruza el año y sella la semana del 31 de diciembre bajo su lunes de enero`, `composeWeekEntryLine cruza el cambio de año sin perder el año`, `normalizeHistory ordena cruzando meses y años`. **Ver la discrepancia señalada abajo** |
| 32 | Que ninguna función pura del archivo nuevo obtiene la fecha actual por su cuenta (RFN-3) | `goal.js no usa toISOString, Date.now ni new Date() sin argumentos`, más los tests de determinismo de las funciones puras (D7) |
| 33 | Que ninguna función pura usa `toISOString()` (RFN-4) | El mismo test de A3, que busca los tres patrones a la vez sobre el código reducido a código ejecutable |

### Criterio 12 (RF-18/RF-19) — comprobación manual, sin test

**Qué dice la spec:** que el manejador de sesiones repinta el objetivo, tanto al añadir
una sesión dentro de la semana actual como al añadir una fuera, y que el progreso refleja
solo la primera.

**Por qué no hay test:** no es una función pura. Es el cableado de `app.js`: el manejador
de `sessionForm` llama a `updateUI()`, que llama a `renderGoalCard(sessions)`, que calcula
los minutos con el `TODAY` congelado. `goal.test.js` no carga `app.js` —haría falta un
DOM—, así que la afirmación "el manejador llama a `renderGoalCard` y este a
`computeProgress`" no es comprobable desde el archivo puro.

**Lo que sí cubre `node --test`:** la parte pura del criterio. Que los minutos de una
sesión dentro de la semana cuenten y que los de una sesión fuera no, está en
`getValidMinutesForWeek cuenta los minutos anteriores a fijar la meta` y `… excluye lo que
cae fuera de la semana`. Eso es exactamente lo que `computeProgress` recibe después. Lo
que falta es el **enlace**, y el enlace es una línea de `app.js`.

**Evidencia manual:** `notas/F6-comprobaciones-tarjeta.md`, puntos 11 y 12 (la barra se
mueve en vivo al registrar sesión). PASS.

**Cómo se podría cubrir mejor, si hiciera falta:** un test de integración con un DOM
mínimo, o exponer el manejador. No lo he hecho porque el proyecto no tiene esa
infraestructura y que un cambio de ese tamaño lo justifique para un criterio que ya
está comprobado a mano.

### Criterio 28 (RF-43) — estructural, por ausencia de mecanismo

**Qué dice la spec:** que si el reloj cambia de día o de semana con la página abierta, no
se sella nada y el historial no se altera; solo se recalcula la semana actual.

**Por qué no hay test, y por qué es distinto del criterio 12:** el 12 es una omisión —falta
un enlace por cablear-. El 28 se cumple porque **no existe el mecanismo que podría
romperlo**. No es que esté comprobado y salga bien; es que no hay forma de que se dispare
mientras la página esté abierta. Eso lo hace un argumento, no un test.

**Los tres hechos que lo sostienen,** verificados sobre el código:

1. **No hay ningún temporizador.** `app.js` no contiene `setInterval`, `setTimeout` ni
   `requestAnimationFrame`. Nada programa una reejecución futura, así que no hay ningún
   momento en que el reloj pueda disparar un sellado.
2. **`TODAY` está congelado.** Se calcula una vez al cargar (`app.js:34`,
   `toLocalDateString(new Date())`) y no vuelve a cambiar. Aunque el reloj pase de día, la
   fecha que ve el resto de la aplicación es la de la carga.
3. **El sellado solo se llama al arrancar.** `sealAndPersistWeeks` —la única vía por la
   que se llama a `sealWeeks`— se invoca **exclusivamente** desde `initGoal`, en el
   arranque (`app.js:786`). El manejador de sesiones llama a `renderGoalCard`, que pinta
   pero nunca sella.

**Qué sí cubren `node --test`:** la parte pura, y es la importante. Que un reloj atrasado
no selle nada está en `listWeeksToSeal con el reloj atrasado no sella nada`, `… con el
reloj en la misma semana de la última entrada no sella nada` y `… con el reloj atrasado ni
siquiera sella la semana anterior`. Esos tres tests pasan `today` explícitamente para
simular el reloj movido, que es la forma de comprobarlo en lógica pura.

**Qué no cubren, y es la parte que el argumento estructural resuelve:** que la página no
vuelva a sellar. Eso no se puede pasar como parámetro a una función pura, porque no es una
función: es la ausencia de un `setInterval`. Ningún test de `node --test` lo capturaría,
porque no hay nada que ejecutar.

**Conclusión del criterio:** cubierto en su parte pura por tests, y en su parte de
comportamiento de forma estructural. Un test que lo protegiera de verdad sería un test que
afirmara "no existe ningún temporizador en `app.js`", es decir, un test sobre el código
fuente. No lo he escrito porque un test así se rompe al reformatar el fichero y no
comprueba comportamiento, pero **es la única forma de convertirlo en alarma**, y queda
anotado como decisión consciente, no como olvido.

### Otras notas del mapa

**Criterio 17 (RF-22), persistencia.** El retorno normalizado estaba cubierto por tests.
Lo que **no** se cumplía era la segunda mitad del enunciado, "que esa versión normalizada
es la que se persiste", cuando no había nada nuevo que sellar: se pintaban las 12 y se
guardaban las 15. **Corregido en F7** con `isSameHistory`, y ahora con test propio.

**Criterio 22 (RF-26), y por qué estaba a medias.** La primera mitad —"no se sella ninguna
semana"— se cumplía: `sealAndPersistWeeks` salía temprano sin meta. La segunda —"y no
muestra historial"— **no**, y durante casi toda la spec pasó desapercibida porque el
historial guardado solo existe si hubo una meta antes. Con meta borrada o descartada por
RF-38, `weeks` llegaba lleno y `paintGoalHistory` lo pintaba entero. Encontrado por
@reviewer. **Corregido** con `selectVisibleHistory`, que hace la regla pura y testeada; la
evidencia en el navegador está en `notas/F6-comprobaciones-tarjeta.md`.

**Criterio 31 (cruce de año) — discrepancia en el enunciado de la spec.** El bullet dice
que "la semana que contiene el 31 de diciembre se sella **con el lunes de enero como
clave**". Medido en la aplicación:

```
31 de diciembre de 2025 → lunes de su semana: 2025-12-29
                           domingo de su semana: 2026-01-04  (contiene el 31)
lunes de enero siguiente:  2026-01-05   → es OTRA semana, no la misma
```

La semana que contiene el 31 de diciembre de 2025 va del **29 de diciembre** al 4 de
enero, así que su lunes es el **29 de diciembre**, no un lunes de enero. El test de D5
comprueba `2025-12-29`, que es lo correcto según `plan.md` (la entrada se clave por el
lunes de su semana) y según el propio RF-34, cuyo literal es "lunes, 29 de diciembre de
2025". **El enunciado del bullet contiene un error**; no he cambiado ni la spec ni el
test.

## 5. Conclusión

`node --test` en verde con **289 tests**, `diary.test.js` y `heatmap.test.js` sin
modificar —mismos bytes y mismo hash que en la primera pasada— y en verde, y el test de
A3 protegiendo RFN-3 y RFN-4.

**31 de los 33 criterios tienen un test que falla si se rompen.** El 12 se cubre a mano, con
la evidencia en la nota de F6. El 28 se cubre en su parte pura por tests y en su parte de
comportamiento **de forma estructural**, por la ausencia de temporizadores y porque
`sealAndPersistWeeks` solo se llama al arrancar.

Corrección de este recuento frente a la versión anterior de la nota: la afirmación de que
"los 33 están cubiertos, ninguno se queda sin test" era inexacta para el 12 y el 28. No
falta cobertura, pero **no toda la cobertura es del mismo tipo**, y decirlo de otra forma
oculta que dos criterios no tienen ninguna alarma que los proteja.

Dos cosas que no son fallos de código sino inconsistencias de la propia spec, y que
corresponden a @planner:

1. El bullet 31 pide "el lunes de enero" para la semana del 31 de diciembre, cuando su
   lunes es el 29 de diciembre.
2. Los bullets 12 y 28 figuran entre los verificables con `node --test`, pero el 12 es
   cableado en `app.js` y el 28 se cumple por la ausencia de un mecanismo. Ninguno de los
   dos puede cubrirse con un test del archivo puro, tal y como están redactados.