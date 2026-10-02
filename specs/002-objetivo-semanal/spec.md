# Spec 002 — Objetivo semanal de estudio

## Contexto y objetivo

El Diario de Estudio ya responde a "¿cómo voy hoy?": muestra la racha actual, la mejor racha, los
minutos de esta semana, los días del mes y el historial de sesiones. Todas esas cifras son
descriptivas: dicen lo que ha pasado, nunca lo que debería haber pasado.

Falta el otro lado de la motivación. Un estudiante que estudia con constancia no siempre falla por
falta de esfuerzo, sino porque no tiene una cifra con la que compararse. Sin cantidad objetivo, la
pregunta "¿voy bien?" se responde con una sensación, y las sensaciones no se sostienen un martes de
noviembre a las nueve de la noche.

El objetivo de esta spec es permitir que el usuario fije una cantidad de minutos que quiere estudiar
cada semana y ver, sin hacer cuentas, cuánto lleva de esa cantidad y en qué proporción. La misma cifra
de minutos semanales que hoy aparece como dato plano en las métricas pasa a ser un compromiso con un
progreso. Y, para que el compromiso no se evapore al terminar la semana, el resultado de las últimas
semanas queda anotado y se puede comparar de una de otra.

La aplicación ya calcula el total de minutos de la semana actual (`calculateWeeklyTotal`, semana de
lunes a domingo en hora local). Esta spec no redefine ese cálculo: se apoya en él y añade la capa de
compromiso.

## Alcance de la spec

Esta spec define únicamente el objetivo semanal, su progreso y el historial de las 12 semanas más
recientes. No modifica el comportamiento de la racha, de la mejor racha, de los recuentos mensuales,
del mapa de calor, del formulario de registro ni de la función `calculateWeeklyTotal` de `diary.js`.
La tarjeta de métricas "minutos esta semana" permanece exactamente igual: el objetivo vive en una
tarjeta propia (RF-30) y no se mezcla con ella. El total de minutos de la semana se trata en RF-9 a
RF-13 y las tres claves de almacenamiento, en RF-35 a RF-41.

## Usuarios / actores

- **Estudiante auto-gestionado**: la única persona que usa la aplicación. Registra sus sesiones, fija
  su propio objetivo una vez y consulta el progreso y el historial desde el móvil o desde el
  escritorio. Es la usuaria de todas las historias.
- No hay otros actores. No hay cuentas, ni roles, ni sincronización: los datos son personales y viven
  únicamente en el navegador.

## Definiciones

Estas definiciones son normativa y se usan en los requisitos.

- **Meta semanal**: la cantidad de minutos que el usuario se propone estudiar en cada semana. Es un
  único valor global, entero entre 10 y 10080, no una meta por semana ni por día.
- **Registro de la meta**: el valor guardado bajo la clave de la meta, con la forma
  `{ value, setAt, setAtWeekStart }`, donde `value` es la meta, `setAt` es la fecha local del día en que
  se fijó, en formato `AAAA-MM-DD`, y `setAtWeekStart` es el lunes de esa semana en el mismo formato.
  `setAt` se guarda solo por trazabilidad y no interviene en ningún cálculo; `setAtWeekStart` es el
  único campo del registro del que depende la aplicación.
- **Semana actual**: el intervalo de lunes a domingo, en hora local, que contiene a hoy (definido en
  `diary.js` como `getWeekRange`).
- **Inicio de semana**: la fecha local del lunes de una semana, en formato `AAAA-MM-DD` (calculado con
  `getWeekStartMonday` de `heatmap.js`). Es la clave que identifica una semana en el historial.
- **Sesión válida**: una sesión guardada cuyo campo de fecha es una fecha local existente
  (`isValidDateKey`) y cuyo campo de minutos es un entero mayor o igual que 1 (`isValidMinutes`),
  según la spec 001.
- **Minutos válidos de una semana**: la suma de los minutos de las sesiones válidas cuya fecha pertenece
  a esa semana, lunes a domingo en hora local. Es el mismo concepto que los minutos de la semana actual
  aplicado a cualquier otra semana: no hay una segunda definición de "semana", sino un mismo cálculo
  evaluado sobre fechas distintas.
- **Minutos llevados**: los minutos válidos de la semana actual. Es el valor que devuelve la función de
  esta spec, y coincide con `calculateWeeklyTotal` cuando todas las sesiones son válidas.
- **Minutos restantes**: la diferencia entre la meta semanal y los minutos llevados, expresada sin
  signo y con valor cero cuando la diferencia es negativa o nula.
- **Proporción**: el porcentaje entero que resulta de truncar hacia abajo el cociente entre los
  minutos llevados y la meta semanal multiplicado por cien, con un máximo de 100.
- **Objetivo cumplido**: el estado en el que los minutos llevados son mayores o iguales que la meta
  semanal. En la interfaz, una semana cumplida.
- **Objetivo pendiente**: el estado en el que los minutos llevados son menores que la meta semanal.
  En la interfaz, una semana pendiente.
- **Hoy**: la fecha local sobre la que se calcula el progreso. Se calcula una única vez, al cargar la
  página, y no cambia durante la sesión abierta (mismo criterio que RF-3 de la spec 001).
- **Sin objetivo**: el estado de la aplicación cuando el usuario todavía no ha fijado ninguna meta
  semanal, y también el estado al que se vuelve cuando la meta guardada resulta no interpretable.
- **Semana sellada**: una semana cerrada cuyo resultado ha quedado anotado en el historial. Solo se
  sellan semanas completas cuyo `weekStart` sea estrictamente posterior a `setAtWeekStart`, y solo
  semanas en las que ya existía una meta.
- **Entrada de historial**: el registro `{weekStart, minutes, met}` de una semana sellada, donde
  `weekStart` es el lunes de esa semana, `minutes` el total de minutos válidos de esa semana y `met` la
  meta vigente en el momento de sellarla.
- **Historial normalizado**: el resultado de descartar las entradas no interpretables, ordenar el
  historial de la más reciente a la más antigua, conservar de cada `weekStart` repetido la entrada que
  queda primera en ese orden y cortar a las 12 entradas más recientes.

## Historias de usuario

- **H1**: Como estudiante, quiero fijar una cantidad de minutos que quiero estudiar cada semana, para
  tener una referencia explícita de lo que me he propuesto.
- **H2**: Como estudiante, quiero ver cuántos minutos llevo de esa cantidad en la semana actual, para
  saber si voy por delante o por detrás sin tener que contar sesiones a mano.
- **H3**: Como estudiante, quiero ver el progreso en proporción, para entender de un vistazo lo que me
  falta y no solo una suma de minutos.
- **H4**: Como estudiante, quiero que mi objetivo siga ahí mañana, la semana que viene y después de
  cerrar el navegador, para no tener que volver a escribirlo cada vez.
- **H5**: Como estudiante, quiero recordar el resultado de las últimas semanas, para ver si lo que
  hago funciona y no solo juzgarme por la semana que estoy viviendo.
- **H6**: Como estudiante, quiero que la aplicación siga funcionando si todavía no he fijado ningún
  objetivo, para poder empezar a registrar sesiones antes de decidir cuánto quiero estudiar.
- **H7**: Como estudiante, quiero que el progreso se comunique con texto y no solo con una barra de
  color, para poder leerlo con lector de pantalla y entenderlo sin depender del color.
- **H8**: Como estudiante, quiero que la aplicación me avise si el objetivo guardado no es válido y me
  permita volver a fijarlo, para saber por qué ha desaparecido mi meta.
- **H9**: Como estudiante, quiero que la aplicación no falle si el almacenamiento no está disponible,
  para poder consultar lo ya registrado aunque mi navegador me bloquee el almacenamiento.

## Requisitos funcionales

### Fijar la meta

- **RF-1**: SI no existe una meta semanal guardada, ENTONCES EL SISTEMA muestra el estado sin objetivo
  con el texto "Objetivo semanal: sin fijar" y ofrece un formulario para fijarla.
- **RF-2**: CUANDO se representa la tarjeta de objetivo, EL SISTEMA muestra como encabezado visible el
  texto "Objetivo semanal".
- **RF-3**: CUANDO el usuario envía el formulario de meta con un valor que no cumple la regla de
  parseo de RF-4, ENTONCES EL SISTEMA muestra un mensaje de error en español que indique que la meta
  debe ser un número entero entre 10 y 10080, no guarda ningún cambio y deja el campo con exactamente
  lo que el usuario había escrito, para que pueda corregirlo.
- **RF-4**: CUANDO se interpreta el texto escrito en el formulario de meta, EL SISTEMA sigue el criterio
  de `isValidMinutes` de la spec 001, con la restricción adicional del rango: primero elimina los
  espacios periféricos y después exige que el resultado sea un entero finito dentro del intervalo
  [10, 10080]. Se rechazan el resto de formatos, incluidos la cadena vacía, las que solo contienen
  espacios, "+600", "6e2", "600 min", "600.0", "60,0" y cualquier representación con dígitos no
  occidentales. La meta debe escribirse como un número entero sin punto decimal.
- **RF-5**: CUANDO existe una meta semanal válida, EL SISTEMA retira el formulario de fijar la meta de
  la pantalla y no ofrece ninguna forma de modificarla ni de eliminarla.
- **RF-6**: CUANDO el usuario no ha fijado ninguna meta, EL SISTEMA permite registrar sesiones con
  normalidad, no le deduce ni le propone una meta y le mantiene disponible el resto de la aplicación.
- **RF-7**: CUANDO se guarda una meta semanal, EL SISTEMA calcula y guarda la fecha local del día en que
  se fijó, con `toLocalDateString`, y el lunes de esa semana, con `getWeekStartMonday`. Esa misma meta
  sigue vigente en la semana siguiente y en todas las posteriores, y no se aplica a semanas anteriores.
- **RF-8**: SI la escritura de la meta en el almacenamiento local falla, ENTONCES EL SISTEMA no muestra
  el estado con meta, no muestra el aviso de meta no válida de RF-38, no guarda nada y mantiene el
  formulario disponible con lo que el usuario había escrito en el campo.

### Cálculo del progreso

- **RF-9**: CUANDO se calculan los minutos de una semana, EL SISTEMA excluye toda sesión que no cumpla
  la definición de sesión válida, reutilizando `partitionSessions` de `heatmap.js`, y excluye toda
  sesión cuya fecha caiga fuera del intervalo de esa semana, reutilizando `getWeekRange` de
  `diary.js`.
- **RF-10**: CUANDO se calculan los minutos válidos de una semana, EL SISTEMA reutiliza
  `calculateWeeklyTotal` de `diary.js` aplicándolo a las sesiones ya filtradas por RF-9. Como esa
  función deriva la semana de su parámetro `today`, para una semana cerrada el sistema le pasa como
  `today` una fecha cualquiera de esa semana, y en particular su propio `weekStart`, de modo que
  `getWeekRange` resuelva exactamente el rango lunes a domingo de esa semana. Para la semana actual le
  pasa el valor de hoy capturado en la carga. El rango de semana tiene así una sola definición en toda
  la aplicación.
- **RF-11**: CUANDO existe una meta semanal, EL SISTEMA devuelve los minutos restantes como la
  diferencia entre la meta y los minutos llevados, y como cero cuando esa diferencia es negativa o
  nula.
- **RF-12**: CUANDO existe una meta semanal, EL SISTEMA devuelve la proporción como el porcentaje entero
  que resulta de truncar hacia abajo el cociente entre los minutos llevados y la meta multiplicado por
  cien, y como máximo 100.
- **RF-13**: CUANDO existe una meta semanal, EL SISTEMA calcula el relleno de la barra de progreso con
  ese mismo entero truncado de RF-12, no con el cociente exacto, de modo que la barra nunca muestra un
  relleno que el porcentaje redondeado no sostenga.
- **RF-14**: SI los minutos llevados son mayores o iguales que la meta semanal, ENTONCES EL SISTEMA
  clasifica el progreso como objetivo cumplido.
- **RF-15**: SI los minutos llevados son menores que la meta semanal, ENTONCES EL SISTEMA clasifica el
  progreso como objetivo pendiente.
- **RF-16**: SI los minutos llevados superan la meta semanal, ENTONCES EL SISTEMA muestra el total real
  de la semana, sin truncarlo ni ajustarlo a la meta.
- **RF-17**: SI no existe meta semanal, ENTONCES EL SISTEMA no calcula minutos restantes ni proporción,
  no muestra barra de progreso y muestra el estado sin objetivo.
- **RF-18**: CUANDO el usuario registra una sesión con fecha de la semana actual, EL SISTEMA recalcula
  el progreso de esa semana inmediatamente, sin recargar la página y usando el valor de hoy capturado
  en la carga.
- **RF-19**: CUANDO el usuario registra una sesión con fecha de otra semana, ENTONCES EL SISTEMA deja
  el progreso intacto, porque esa semana no es la actual.
- **RF-20**: CUANDO el usuario fija la meta en un momento de la semana que no es su inicio, ENTONCES
  EL SISTEMA cuenta para el progreso todos los minutos válidos de la semana actual, incluidas las
  sesiones registradas antes de fijar la meta, porque el progreso se mide contra la semana completa y
  no contra el momento en que se fijó el objetivo.

### Histórico de semanas

- **RF-21**: CUANDO la aplicación se carga y hay semanas cerradas sin anotar, EL SISTEMA sella, en
  orden de la más antigua a la más reciente, toda semana cerrada cuyo `weekStart` sea estrictamente
  posterior al `setAtWeekStart` del registro de la meta vigente y que todavía no figure en el
  historial. Cada entrada guarda el lunes de esa semana, sus minutos válidos y la meta vigente. La
  semana en la que se fijó la meta nunca se sella, porque su `weekStart` es igual al `setAtWeekStart` y
  el sellado exige ser estrictamente posterior.
- **RF-22**: CUANDO se sellan semanas al cargar, EL SISTEMA normaliza el historial según RF-25, persiste
  el resultado y lo muestra en esa misma carga, sin esperar a que el usuario registre una sesión.
- **RF-23**: CUANDO se muestra una entrada del historial, EL SISTEMA la compara con `met` de esa misma
  entrada, nunca con la meta vigente, de modo que la entrada es intelligible por sí sola y el
  resultado de una semana no cambia nunca retroactivamente.
- **RF-24**: MIENTRAS exista una meta semanal, EL SISTEMA muestra en la tarjeta de objetivo las 12
  entradas más recientes del historial, ordenadas de la más reciente a la más antigua.
- **RF-25**: CUANDO se normaliza un historial, EL SISTEMA descarta las entradas no interpretables,
  ordena el resultado de la más reciente a la más antigua, conserva de cada `weekStart` repetido la
  entrada que queda primera en ese orden y corta a las 12 entradas más recientes. Cuando dos entradas
  comparten el mismo `weekStart` y el orden por fecha no las distingue, se desata por la de más
  `minutes`, de modo que el resultado no dependa del orden guardado. El orden en que las entradas
  estaban guardadas no interviene en el resultado.
- **RF-26**: SI no existe meta semanal, ENTONCES EL SISTEMA no sella ninguna semana y no muestra
  historial, porque las semanas anteriores a la semana en la que se fijó el objetivo no hubo un
  compromiso que medir, y las posteriores no tienen una meta contra la que medirla.
- **RF-27**: CUANDO el usuario registra una sesión con fecha de una semana ya sellada, ENTONCES EL
  SISTEMA deja el historial intacto, porque una semana sellada es un resultado ya anotado.

### Presentación

- **RF-28**: CUANDO se representa la tarjeta de objetivo, EL SISTEMA muestra el encabezado, la línea de
  estado y, según el caso, una de las dos líneas de progreso de la tabla siguiente:

| Elemento | Situación | Texto exacto |
|---|---|---|
| Encabezado de la tarjeta | siempre | "Objetivo semanal" |
| Línea de estado, sin meta | sin meta | "Objetivo semanal: sin fijar" |
| Línea de estado, con meta | con meta, pendiente o cumplida | "Objetivo semanal: 600 min" |
| Línea de progreso | solo con el objetivo pendiente | "Esta semana: 240 de 600 min (40%)" |
| Línea de minutos restantes | solo con el objetivo pendiente | "Quedan 360 min" |
| Línea de cumplimiento | solo con el objetivo cumplido | "¡Objetivo cumplido! 650 de 600 min" |

- **RF-29**: CUANDO el objetivo está cumplido, EL SISTEMA muestra la línea de cumplimiento y la barra al
  100 % y no muestra ni la línea de progreso con porcentaje ni la línea de minutos restantes.
- **RF-30**: CUANDO se representa la tarjeta de objetivo, EL SISTEMA la sitúa inmediatamente debajo de
  la tarjeta de métricas "minutos esta semana", dentro del mismo grupo de métricas.
- **RF-31**: CUANDO existe una meta semanal, EL SISTEMA muestra dentro de la misma tarjeta una barra de
  progreso cuyo relleno es la proporción de RF-13, y el historial de RF-24 por debajo de la barra.
- **RF-32**: CUANDO los minutos llevados alcanzan la meta semanal, EL SISTEMA muestra la línea de
  cumplimiento de la tabla de RF-28 con los minutos reales y la meta, muestra la barra al 100 % y
  mantiene ambas visibles mientras dure la semana. No añade ningún mensaje adicional.
- **RF-33**: CUANDO existe una meta semanal, EL SISTEMA no añade avisos destacados, destellos ni
  animaciones especiales al alcanzar la meta.
- **RF-34**: CUANDO existe una meta semanal, EL SISTEMA muestra cada entrada del historial con el día
  de la semana, el día, el mes y el año del lunes de esa semana, sus minutos y `met` de la entrada, en
  el formato exacto "lunes, 29 de septiembre de 2025 — 450 de 600 min — pendiente" o
  "lunes, 29 de septiembre de 2025 — 650 de 600 min — cumplida". Los nombres de días y meses son tablas
  fijas en español, nunca `Intl`. Los minutos llevan "min" sin punto ni separador de millares.

### Almacenamiento

- **RF-35**: CUANDO se guarda la meta semanal, EL SISTEMA la persiste en el almacenamiento local bajo
  una clave propia, distinta de la clave de las sesiones y de la del historial, con la forma
  `{ value, setAt, setAtWeekStart }` de RF-7. Si no puede guardar `setAt` por el motivo que sea, guarda
  igualmente `value` y `setAtWeekStart`: la meta no se pierde por un campo que no se usa.
- **RF-36**: CUANDO se sella una semana, EL SISTEMA persiste el historial en el almacenamiento local
  bajo una clave propia, distinta de la clave de las sesiones y de la de la meta, como una lista de
  entradas `{ weekStart, minutes, met }`.
- **RF-37**: SI el historial guardado no es una lista, o alguna de sus entradas no tiene los tres
  campos con los valores esperados, EL SISTEMA la descarta y conserva el resto de entradas válidas,
  según la normalización de RF-25, sin interrumpir la aplicación y sin mostrar ningún aviso.
- **RF-38**: SI el registro de la meta guardado no es un objeto con `value` entero dentro de [10, 10080]
  y un `setAtWeekStart` que sea una fecha local existente, ENTONCES EL SISTEMA lo descarta, vuelve al
  estado sin objetivo, muestra un aviso en español que indique que el objetivo guardado no era válido y
  vuelve a ofrecer el formulario para fijar la meta. La ausencia o el malformo de `setAt` no invalida el
  registro, porque de ese campo no depende ningún cálculo.
- **RF-39**: SI el almacenamiento local no está disponible, no se puede leer o no se puede escribir,
  ENTONCES EL SISTEMA muestra el estado sin objetivo, no muestra el aviso de RF-38, no interrumpe el
  resto de la aplicación y no lanza ningún error.
- **RF-40**: SI no existe una meta guardada, ENTONCES EL SISTEMA funciona con normalidad, muestra el
  estado sin objetivo y no crea ninguna meta por su cuenta.
- **RF-41**: MIENTRAS se muestren el objetivo o su historial, ENTONCES EL SISTEMA nunca escribe ni borra
  la clave de las sesiones. Solo la lee, y únicamente en memoria, para calcular los minutos válidos.

### Comportamiento con el tiempo

- **RF-42**: CUANDO han pasado días desde la última vez que el usuario abrió la aplicación, EL SISTEMA
  sella al cargar las semanas cerradas que han pasado desde entonces, cada una con su propio total de
  minutos válidos, y muestra el progreso de la semana actual.
- **RF-43**: SI el reloj del sistema cambia de semana mientras la página está abierta, ENTONCES EL
  SISTEMA no sella ninguna semana, no cambia el historial y no modifica el valor de hoy. La única
  excepción es el recálculo del total de la semana actual provocado por RF-18, que no incluye sellado
  ni cambio de hoy.
- **RF-44**: SI la semana actual de hoy es anterior o igual a la semana de la entrada más reciente del
  historial, ENTONCES EL SISTEMA no sella ninguna semana y calcula el progreso sobre la semana actual
  tal cual.
- **RF-45**: CUANDO el usuario abre la aplicación el mismo día en que empieza la semana, ENTONCES EL
  SISTEMA sella la semana anterior con los minutos que tenga, siempre que su `weekStart` sea
  estrictamente posterior al `setAtWeekStart` de la meta, y el progreso de la nueva semana comienza en
  cero minutos.

## Requisitos no funcionales

- **RFN-1 Simplicidad**: La funcionalidad se implementa con HTML, CSS y JavaScript puros, sin
  dependencias, sin paquetes y sin paso de compilación. Sigue funcionando abriendo `index.html` con
  doble clic.
- **RFN-2 Lógica pura**: Todo el cálculo del progreso, del sellado de semanas y de la normalización del
  historial se resuelve con funciones puras, sin acceso al DOM ni al almacenamiento local, en un
  archivo puro nuevo, separado de `diary.js` y de `heatmap.js`, con su propio fichero de tests en
  `node --test`. La comprobación de si un texto es una meta válida también es pura: el mensaje de error
  de RF-3 se muestra en la interfaz, pero la regla que decide si un valor se acepta pertenece al
  archivo puro. `app.js` es el único archivo que toca almacenamiento y DOM.
- **RFN-3 Fecha actual por parámetro**: Toda función pura que necesite saber qué día es hoy recibe esa
  fecha como parámetro explícito y no la obtiene por su cuenta del reloj del sistema. Los valores que
  devuelve no dependen del momento en que se ejecuten.
- **RFN-4 Hora local**: Toda comparación de fechas y todo cálculo de semana se hace en hora local. No
  se usa `toISOString()` para construir ni comparar cadenas de fecha, porque convierte a UTC y desplaza
  el día en husos de offset negativo. Las funciones de fecha son las existentes:
  `toLocalDateString` y `localDateFromKey` de `diary.js`, `localDateFromKey` y `getWeekStartMonday` de
  `heatmap.js`, que construyen la fecha a mediodía para que ningún desplazamiento pueda llevarla al día
  anterior o al siguiente.
- **RFN-5 Reutilización y orden de carga**: El archivo puro nuevo reutiliza `partitionSessions`,
  `getWeekStartMonday` e `isValidMinutes` de `heatmap.js`, y `getWeekRange` y `calculateWeeklyTotal` de
  `diary.js`, en lugar de duplicar ninguna de esas reglas. Se carga en `index.html` después de
  `diary.js` y de `heatmap.js`, y su fichero de tests carga los tres en ese mismo orden, de modo que
  las dependencias existen cuando el archivo se evalúa.
- **RFN-6 Pruebas**: La lógica se cubre con `node --test`, sin instalar nada. Ningún test usa el reloj
  del sistema para obtener la fecha actual.
- **RFN-7 Móvil**: La tarjeta de objetivo se ve sin desplazamiento horizontal a 375 px de ancho de CSS
  con la tipografía por defecto del navegador.
- **RFN-8 Accesibilidad**: El progreso no se transmite solo con color. La barra de progreso expone
  `role="progressbar"` con `aria-valuemin="0"`, `aria-valuemax="100"` y `aria-valuenow` igual al entero
  de RF-12, y un `aria-valuetext` con el total real y la meta, de modo que el valor accesible y el
  relleno de la barra son el mismo número. Los mismos datos existen como texto visible en las líneas de
  RF-28. El mensaje de error de RF-3 se anuncia con `role="alert"` y se asocia al campo del formulario
  con `aria-describedby`. El color y la longitud de la barra son decorativos.
- **RFN-9 Contraste**: La tarjeta de objetivo y el historial son legibles en modo claro y en modo
  oscuro, y sus estados siguen siendo distinguibles con escala de grises o alto contraste activos.
- **RFN-10 Privacidad**: Los datos no salen del navegador. No hay peticiones de red ni terceros.
- **RFN-11 Idioma**: Toda la interfaz y esta documentación están en español. El código se escribe en
  inglés.
- **RFN-12 No perder datos**: Ninguna operación sobre el objetivo o su historial puede borrar,
  modificar ni reordenar las sesiones guardadas.

## Casos límite

- **Usuario nuevo sin sesiones y sin objetivo**: el estado sin objetivo es visible con su formulario, los
  minutos de la semana son 0 y no hay historial. Fijar la meta no requiere antes tener sesiones.
- **Usuario con muchas sesiones que fija la meta a mitad de semana**: el progreso cuenta los minutos
  válidos de toda la semana, incluidas las sesiones anteriores a la meta, porque el objetivo se mide
  contra la semana completa. Esa semana no se sella nunca en el historial: su `weekStart` es igual al
  `setAtWeekStart` y el sellado exige ser estrictamente posterior. Es una semana en la que el usuario
  todavía no tenía un objetivo fijado, y su primer día sin objetivo no se registra como un día de
  suspenso ni de aprobado.
- **Meta en el límite inferior**: 10 minutos es una meta válida y produce una barra con progreso real.
  9 minutos se rechazan con el mensaje de error.
- **Meta en el límite superior**: 10080 minutos es una meta válida y equivale a estudiar la semana
  entera. 10081 minutos se rechazan.
- **Meta de 10080 con semanas muy cargadas**: una semana con 10080 minutos está cumplida y muestra
  "¡Objetivo cumplido! 10080 de 10080 min" con la barra al 100 %. Una semana con 20000 minutos también
  está cumplida, muestra el total real y nunca un porcentaje ni un relleno por encima de 100.
- **Minutos de cuatro cifras o más**: una semana de 1200 minutos sobre una meta de 1500 muestra "Esta
  semana: 1200 de 1500 min (80%)" y "Quedan 300 min", sin separador de millares. En el historial, "1500
  de 1500 min — cumplida".
- **Truncado del porcentaje**: 249 minutos sobre una meta de 600 muestran 41 %, no 42 %. Con una meta de
  10 minutos, 9 minutos muestran 90 %. El relleno de la barra usa ese mismo entero.
- **Superación de la meta**: una semana con 650 minutos sobre una meta de 600 muestra "¡Objetivo
  cumplido! 650 de 600 min", con barra al 100 % y proporción 100 %. El total real nunca se sustituye por
  la meta.
- **Alcanzar la meta exactamente**: una semana con exactamente los minutos de la meta está cumplida y
  muestra "¡Objetivo cumplido! 600 de 600 min" con la barra al 100 %. No muestra porcentaje ni línea de
  minutos restantes.
- **Minutos inválidos junto a minutos válidos**: una fecha con una sesión válida y otra con minutos
  decimales, cero, negativos o no numéricos suma solo la sesión válida. Los minutos inválidos no pueden
  producir `NaN`, ni un progreso inflado, ni un porcentaje por encima de 100.
- **Sesión con fecha inexistente**: una sesión con fecha `2025-02-30` no cuenta en el progreso ni en el
  sellado de su semana, aunque su texto tenga el formato de una fecha.
- **Solo sesiones inválidas**: con cero sesiones válidas, el progreso es 0 de la meta, la proporción 0 y
  el objetivo queda pendiente. Las sesiones inválidas siguen en el historial de sesiones y no se tocan.
- **Cambio de semana abriendo la aplicación el mismo día**: al abrir el lunes, la semana anterior queda
  sellada con sus minutos y la nueva muestra cero minutos.
- **Salto del reloj hacia atrás**: si el reloj del sistema vuelve a una semana anterior, no se sella
  ninguna semana y el progreso se calcula sobre esa semana. Al avanzar de nuevo, el sellado retoma desde
  la última entrada anotada.
- **Semanas sin actividad**: una semana cerrada con cero minutos se sella igualmente y aparece en el
  historial como pendiente con "0 de 600 min". Una semana sin sesiones no es una ausencia de dato.
- **Dos semanas seguidas cumplidas y dos seguidas sin cumplir**: el historial las muestra en orden y cada
  entrada conserva su propio resultado, sin que el estado de una semana contamine a la otra.
- **Salto de año**: la semana que cruza el 31 de diciembre se sella con el lunes de esa semana como
  clave, de modo que dos semanas consecutivas nunca comparten clave ni se pisan.
- **Cruce de mes**: los minutos del día 31 que caen en la semana siguiente se cuentan en la semana
  siguiente, sin alterar el total de la anterior.
- **Año bisiesto**: el 29 de febrero se cuenta como cualquier otro día de su semana, y la semana que lo
  contiene se sella con su lunes como clave.
- **Más de 12 semanas de uso**: tras trece semanas cerradas, el historial conserva las 12 entradas más
  recientes y descarta la más antigua. El descarte no afecta a ninguna semana que siga abierta.
- **Semana repetida en el historial guardado**: dos entradas con el mismo `weekStart` se reducen a la
  que queda primera tras ordenar de la más reciente a la más antigua, y el historial ya normalizado se
  persiste.
- **Historial desordenado**: un guardado con las entradas en orden arbitrario se muestra de la más
  reciente a la más antigua, no en el orden en que se guardaron, y la deduplicación de un `weekStart`
  repetido da siempre la misma entrada con independencia del orden guardado.
- **Meta fijada después de muchas semanas de uso**: no hay entradas anteriores a la meta, ni de las
  semanas anteriores ni de la propia semana en que se fijó. El historial empieza en la primera semana
  cerrada con `weekStart` estrictamente posterior a `setAtWeekStart`.
- **Salto de zona horaria**: las entradas del historial conservan el lunes que se les asignó al
  sellarse y no se reubican si el usuario cambia de huso.
- **Meta corrupta**: un registro guardado con `value` decimal, no numérico, fuera de rango o ausente, o
  sin `setAtWeekStart`, hace que la aplicación vuelva al estado sin objetivo, muestre el aviso de RF-38
  y vuelva a ofrecer el formulario. Fijar de nuevo la meta funciona con normalidad.
- **Historial corrupto**: un historial que no es una lista, o cuyas entradas están incompletas, se
  descarta parcialmente o en su totalidad sin romper nada y sin aviso, porque el objetivo sigue siendo
  legible y utilizable sin él.
- **Fallo al guardar la meta**: si el navegador no permite escribir la meta, la aplicación no muestra el
  estado con meta, no muestra ningún aviso de datos corruptos y el formulario sigue disponible con lo
  que el usuario había escrito.
- **El usuario borra los datos del navegador**: la aplicación vuelve al estado sin objetivo, sin
  historial y sin ningún aviso. Se comporta como un usuario nuevo, con el formulario disponible.
- **Almacenamiento no disponible**: sin almacenamiento local la aplicación muestra el estado sin
  objetivo, no muestra ningún aviso de datos corruptos y el resto de la aplicación sigue funcionando.
- **Semana ya sellada que recibe una sesión retroactiva**: añadir minutos a una semana cerrada no
  modifica la entrada anotada, porque una semana sellada es un resultado ya registrado.
- **Volumen alto**: un usuario con cientos de sesiones ve el progreso y el historial sin degradarse ni
  mostrar un aviso de rendimiento.
- **Zoom y tipografía**: con zoom al 200 % o con tipografía ampliada, la tarjeta de objetivo sigue siendo
  legible y usable, aunque la ausencia de desplazamiento horizontal de RFN-7 se evalúa únicamente en
  los supuestos que RFN-7 define.
- **Coexistencia con el mapa de calor**: el objetivo y el mapa de calor son capas independientes. La
  tarjeta de objetivo no cambia ningún estado del mapa, ni su escala de color, ni su línea de detalle, ni
  sus avisos, ni su navegación por teclado.
- **Coexistencia con las métricas**: la tarjeta "minutos esta semana" conserva su contenido, su formato y
  su comportamiento. La tarjeta de objetivo no la sustituye ni la modifica.

## Fuera de alcance

- Editar o borrar una meta ya fijada, y cualquier forma de cambiar el objetivo desde la interfaz.
- Metas por semana, por día de la semana, por tema o por periodo. La meta es un único valor global.
- Varias metas simultáneas, metas por perfil o comparación entre objetivos distintos.
- Objetivos de días, de meses o de duración total del hábito.
- Sellar la semana en la que se fijó la meta, o cualquier semana anterior a ella, aunque tengan
  minutos. Solo se sellan semanas con `weekStart` estrictamente posterior a `setAtWeekStart`.
- Ampliar el historial más allá de las 12 entradas más recientes, aunque exista información anterior
  disponible.
- Cualquier métrica derivada del objetivo que no esté en el alcance: media de minutos por día, ritmo
  necesario para llegar a la meta, proyección de final de semana, minutos por encima de la meta.
- Gráficas, tendencias o estadísticas agregadas sobre el historial, más allá de listar las 12 entradas
  más recientes.
- Mostrar el objetivo o el progreso en el mapa de calor, en la tarjeta de "minutos esta semana" o en
  cualquier otra vista de la aplicación.
- Corregir `calculateWeeklyTotal` de `diary.js` para que filtre por sí mismo las sesiones no válidas. La
  spec 002 no modifica ese archivo: el filtro se aplica en el archivo puro nuevo, según RF-9 y RF-10.
  Arreglar la función de raíz es trabajo de otra spec.
- Automatización, recordatorios, notificaciones o integración con el calendario del sistema.
- Sincronización entre dispositivos, cuentas, exportación o importación del objetivo.
- Cualquier modificación del mapa de calor, de la racha, de la mejor racha, de los recuentos mensuales o
  del formulario de registro.
- Recalcular el sellado de semanas mientras la página está abierta, según RF-43.

## Criterios de finalización

Los criterios se separan en los verificables automáticamente y los que exigen comprobación manual,
porque no todos los requisitos pueden comprobarse con `node --test`. Cada requisito tiene exactamente
un criterio: los automatizables se comprueban con `node --test` y los que dependen del DOM, del
almacenamiento o de la vista se comprueban a mano.

Verificables con `node --test` (31 tests, más una comprobación final de que todo queda en verde):

- Un test de parseo del campo de la meta, con la regla de RF-4: acepta 10, 600, 10080 y " 600 "; rechaza
  la cadena vacía, los espacios, 0, 9, negativos, decimales escritos con punto como "600.0" o con coma
  como "60,0", "+600", "6e2", "600 min", 10081, valores no numéricos, dígitos no occidentales y ausencia
  de valor.
- Un test de RF-7 del cálculo de las dos fechas de la meta: con un `today` dado, `setAt` es ese día en
  `AAAA-MM-DD` y `setAtWeekStart` es su lunes, para un `today` de lunes, de miércoles y de domingo, y
  para un `today` del 1 de enero de un año no bisiesto.
- Un test de RF-9 que verifique que los minutos válidos excluyen, con y sin impacto en el total: minutos
  `NaN`, no numéricos, decimales, cero, negativos y ausentes, y fechas inexistentes como "2025-02-30" o
  "2025-13-01". El total resultante nunca es `NaN` y nunca supera al de las sesiones válidas.
- Un test de RF-9 y RF-10 que verifique que los minutos de una semana son la suma de las sesiones válidas
  de esa semana y que las sesiones de otras semanas no cuentan.
- Un test de RF-10 que verifique que pasar como `today` el `weekStart` de una semana pasada devuelve los
  minutos de esa semana y no los de la semana actual.
- Un test de RF-10 con el total en un domingo a las 23:59 y en un lunes a las 00:00, con la fecha de hoy
  desplazada un día, para verificar la frontera de semana.
- Un test de RF-11 con la meta superada que verifique que los minutos restantes son cero y no un número
  negativo.
- Un test de RF-12 y RF-13 con los casos de truncado: 249 de 600 da 41, 599 de 600 da 99, 600 de 600 da
  100 y 650 de 600 da 100, y que el relleno de la barra usa ese mismo entero en los cuatro casos.
- Un test de RF-12 y RF-13 con la meta de 10080 y minutos de 20000 que verifique que la proporción y el
  relleno no superan 100.
- Un test de RF-14, RF-15 y RF-16 con la meta igual a los minutos llevados, por debajo y por encima.
- Un test de RF-17 que verifique que sin meta no se devuelven minutos restantes ni proporción.
- Un test de RF-20 que verifique que las sesiones registradas antes de fijar la meta cuentan en el
  progreso de esa semana.
- Un test de RF-21 que verifique que se sellan todas las semanas cerradas cuyo `weekStart` es
  estrictamente posterior a `setAtWeekStart`, y que no se sella ninguna anterior ni la propia semana de
  fijación.
- Un test de RF-21 con varias semanas transcurridas que verifique que se sellan todas y en orden de la
  más antigua a la más reciente.
- Un test de RF-21 y RF-22 con una semana con minutos válidos e inválidos mezclados que verifique que la
  entrada sellada guarda solo los válidos.
- Un test de RF-22 que verifique que el historial sellado en una carga se devuelve normalizado y que esa
  versión normalizada es la que se persiste.
- Un test de RF-23 que invoque la función pura con una `metaVigente` distinta de `entrada.met` y
  compruebe que el resultado de la entrada depende solo de `entrada.met`.
- Un test de RF-24 y RF-25 que verifique el orden de la más reciente a la más antigua, la deduplicación
  por `weekStart` conservando la entrada que queda primera en ese orden y el corte a las 12 entradas más
  recientes descartando la más antigua.
- Un test de RF-25 que verifique que un historial guardado en orden arbitrario produce exactamente la
  misma lista normalizada que el mismo historial guardado en orden inverso, incluidas dos entradas con
  el mismo `weekStart` y distinto `minutes` guardadas en ambos órdenes, que deben resolverse siempre a la
  misma entrada, la de más `minutes`.
- Un test de RF-25 que verifique que una entrada sin `weekStart`, `minutes` o `met`, o con valores no
  numéricos, se descarta y las demás sobreviven.
- Un test de RF-26 que verifique que sin meta no se sella ninguna semana, ni la anterior ni ninguna otra,
  aunque haya minutos en el historial de sesiones.
- Un test de RF-27 que verifique que añadir minutos a una semana sellada no modifica su entrada.
- Un test de RF-34 del formato exacto de la línea de historial, con 0 minutos, con 1200 minutos, con la
  meta de 10080 y con una semana de enero, que verifique el día de la semana, el día, el mes, el año, las
  palabras "pendiente" y "cumplida" y la ausencia de separador de millares.
- Un test de RF-37 con un historial que no es una lista y con entradas incompletas, que verifique que se
  descartan sin lanzar errores y que las entradas válidas sobreviven.
- Un test de RF-38 con un registro de meta de `value` decimal, no numérico, fuera de rango o ausente, y con
  un registro al que le falte o malforme `setAtWeekStart`, y que verifique que un registro al que solo le
  falte `setAt` se considera válido.
- Un test de RF-42 que verifique que cargar dos veces dentro de la misma semana no sella ninguna semana
  por duplicado.
- Un test de RF-44 que verifique que con la semana actual anterior o igual a la última entrada del
  historial no se sella ninguna semana y el progreso se calcula sobre la semana actual.
- Un test de RF-45 que verifique que cargar el lunes sella la semana anterior y que el progreso de la
  nueva semana es cero.
- Un test del cruce de año que verifique que la semana que contiene el 31 de diciembre, la que va del
  lunes 29 de diciembre de 2025 al domingo 4 de enero de 2026, se sella bajo su propio lunes, `2025-12-29`,
  y que la semana siguiente, la del lunes `2026-01-05`, se sella aparte y con clave propia.
- Un test que verifique que ninguna función pura del archivo nuevo obtiene la fecha actual por su cuenta,
  tal como exige RFN-3.
- Un test que verifique que ninguna función pura del archivo nuevo usa `toISOString()`, tal como exige
  RFN-4.
- Todos los tests en verde, incluidos los existentes de `diary.test.js` y `heatmap.test.js`.

Comprobaciones manuales (26):

- Demo del flujo principal: estado sin objetivo, fijar la meta, comprobar que el formulario desaparece,
  registrar una sesión de esta semana y ver el progreso actualizarse sin recargar.
- Comprobación de RF-18 y RF-19: registrar una sesión con fecha de la semana actual repinta la tarjeta de
  objetivo con el `today` congelado en la carga, sin recargar, y una sesión con fecha de otra semana deja
  el progreso intacto. No puede ser un test porque `goal.test.js` no carga `app.js`: el enlace que hay que
  comprobar es el del manejador de sesiones con la tarjeta, y lo puro que recibe ya está cubierto por los
  tests de RF-9 y RF-10. Registrado en `notas/F6-comprobaciones-tarjeta.md`.
- Comprobación de RF-43: con la página abierta, cambiar el reloj del sistema de día no altera ni el
  historial ni el progreso, y el sellado solo ocurre en la siguiente carga. Se cubre de forma estructural,
  por la ausencia del mecanismo que lo causaría, no por un test: `goal.test.js` no puede observar un
  cambio de reloj porque no hay ningún temporizador en el archivo puro, `TODAY` se calcula una sola vez al
  cargar y el sellado solo se invoca en el arranque. La comprobación es doble: que `app.js` no contiene
  ningún `setInterval` ni `setTimeout` que vuelva a pintar, y que al mover el reloj del sistema con la
  pestaña abierta el texto de la tarjeta no cambia.
- Comprobación de que la tarjeta de objetivo está situada inmediatamente debajo de "minutos esta semana"
  y de que el historial se ve dentro de esa misma tarjeta.
- Comprobación de RF-8: con el almacenamiento bloqueado en escritura, enviar una meta válida no muestra
  el estado con meta, no muestra ningún aviso de meta no válida y deja el formulario con lo que el
  usuario había escrito.
- Comprobación con lector de pantalla de que la barra se anuncia con su valor, de que el texto visible
  dice los mismos números y de que el mensaje de error se anuncia al enviar una entrada no válida.
- Comprobación de que la meta sobrevive a recargar la página y a cerrar y reabrir el navegador.
- Comprobación con un inspector de almacenamiento de que las tres claves —sesiones, meta e historial— son
  distintas entre sí, y de que la de la meta contiene `value`, `setAt` y `setAtWeekStart`.
- Comprobación del sellado: preparar un historial de más de 12 semanas y verificar que solo quedan las
  12 entradas más recientes, en orden de la más reciente a la más antigua, y que el resultado queda
  guardado normalizado.
- Comprobación del cambio de semana abriendo la aplicación el lunes y verificando que la semana anterior
  aparece en el historial con su total y que la nueva empieza en cero.
- Comprobación de que la semana en la que se fijó la meta no aparece en el historial, y de que sí
  aparece la siguiente.
- Comprobación de RF-33: al alcanzar la meta no aparece ningún aviso destacado, destello ni animación,
  solo la línea de cumplimiento y la barra al 100 %.
- Comprobación de RF-41: con un historial de sesiones con contenido conocido, usar el objetivo, sellar
  semanas y rellenar el historial deja esa clave de sesiones exactamente igual, byte a byte.
- Comprobación de RFN-5: la página funciona con `index.html` sin errores de consola, y el fichero de
  tests carga `diary.js`, `heatmap.js` y el archivo puro nuevo en ese orden antes de ejecutar los tests.
- Comprobación de que el historial sellado aparece en la misma carga en que se sella, sin registrar
  ninguna sesión.
- Comprobación de que la aplicación sin objetivo permite registrar sesiones y muestra el resto de
  métricas sin cambios.
- Comprobación de los textos de RF-28 y RF-34 tal cual, sin desviaciones de mayúsculas, espacios ni
  puntos.
- Comprobación de que el objetivo solo aparece en su tarjeta y de que el mapa de calor y la tarjeta de
  "minutos esta semana" no cambian.
- Comprobación a 375 px de ancho de CSS sin desplazamiento horizontal.
- Comprobación de legibilidad en modo claro y en modo oscuro, y con escala de grises del sistema activa.
- Comprobación con el almacenamiento local deshabilitado de que la aplicación no muestra errores.
- Comprobación con la meta almacenada corrupta de que aparece el aviso y vuelve el formulario.
- Comprobación de que borrar los datos del navegador devuelve al estado sin objetivo, sin historial y sin
  aviso.
- Consola del navegador sin errores ni advertencias.
- Revisión de que ningún otro requisito de la aplicación (racha, mejor racha, días del mes, formulario,
  mapa de calor, `calculateWeeklyTotal`) cambia de comportamiento al añadir el objetivo.
- **Revisión posterior, no bloqueante**: una vez en uso con al menos 12 semanas de historial real, se
  comprueba si las 12 entradas más recientes son suficientes para el usuario. Si no lo son, ampliar el
  historial se plantea como spec nueva. Esta revisión no bloquea la entrega de esta versión.

## Decisiones adoptadas

Estas decisiones se tomaron por delegación del usuario, sin validación de uso real. Se registran aquí
para que consten como parte del alcance acordado.

### D1. Un único objetivo global, fijado una sola vez

La meta se fija una vez y rige para todas las semanas siguientes. Una vez fijada, no se puede cambiar ni
eliminar desde la interfaz.

**Por qué**: una meta por semana multiplica por una aplicación que sigue siendo una lista y un
formulario, y pedir una decisión cada lunes convierte el compromiso en una tarea. La inmutabilidad va
más allá: una meta que se puede bajar elimina la única tensión que da sentido a la función, que es la
tentación de bajar el listón para poder decir que se cumplió.

**Consecuencia asumida**: el objetivo no puede reajustarse a una realidad que cambió. Un usuario cuyo
plan de estudio cambia de 600 a 900 minutos semanales se queda con una meta que ya no describe lo que
quiere hacer, y no tiene forma de corregirlo sin borrar los datos del navegador. Se acepta porque un
objetivo equivocado pero constante informa con honestidad, mientras que un objetivo ajustable pierde su
valor de referencia.

### D2. Rango de la meta entre 10 y 10080 minutos

La meta es un entero entre 10 y 10080, ambos incluidos. 10080 es el total de minutos de una semana
completa.

**Por qué**: el mínimo descarta metas simbólicas que no resisten el primer día malo, y el máximo impide
fijar un objetivo imposible que solo puede producir semanas de fracaso permanente. Ambos extremos son
defendibles por sí mismos, lo cual evita tener que justificar cada uno con el caso del usuario.

**Cómo se mitiga el riesgo**: una entrada fuera de rango se rechaza con un mensaje explícito y el campo
conserva lo que el usuario había escrito, de modo que el error es corregible en el momento en que
ocurre y no desaparece en silencio.

### D3. El progreso filtra las sesiones no válidas antes de sumar

Los minutos que alimentan el progreso y el sellado son solo los de las sesiones válidas. El filtro se
aplica en el archivo puro nuevo, reutilizando `partitionSessions` de `heatmap.js`, y el rango de semana
se resuelve reutilizando `getWeekRange` y `calculateWeeklyTotal` de `diary.js`.

**Por qué**: `calculateWeeklyTotal` hoy solo filtra por rango de fechas y no comprueba la validez de la
sesión, de modo que con minutos no numéricos puede devolver `NaN`. Un `NaN` en el progreso se propaga al
porcentaje, a la barra y a la entrada sellada, y un progreso contaminado queda anotado de forma
permanente en el historial. No es un error de redondeo: es un dato falso.

**Consecuencia asumida**: el total del objetivo puede no coincidir con el número que muestra hoy la
tarjeta de métricas, que sigue usando `calculateWeeklyTotal` sin filtrar. Esa divergencia es
deliberada y temporal: la tarjeta de métricas es correcta cuando los datos son correctos, y el objetivo
es correcto incluso cuando no lo son. Arreglar `calculateWeeklyTotal` de raíz cambia el
comportamiento de la racha y de las métricas y queda expresamente fuera de esta spec.

### D4. La meta y el historial viven en claves de almacenamiento propias

La meta se guarda en una clave propia y el historial en otra, ambas distintas de la clave de las
sesiones. La clave de las sesiones nunca se escribe ni se borra desde esta funcionalidad.

**Por qué**: es el principio 5 de la constitución. Un objetivo es una preferencia del usuario y el
historial de cumplimiento es un dato derivado; ninguno de los dos es una sesión de estudio. Separar las
claves hace imposible que un error al guardar o al normalizar el historial borre las sesiones.

### D5. El registro de la meta guarda cuándo se fijó, y el sellado empieza en la semana siguiente

El registro guarda la fecha de fijación y el lunes de esa semana. Solo se sellan semanas cerradas con
`weekStart` estrictamente posterior a ese lunes. La semana en la que se fija la meta no se sella nunca.

**Por qué**: sin esa fecha, el primer sellado tras un uso largo del diario anotaría semanas anteriores a
fijar la meta como si el usuario las hubiera incumplido, lo que convertiría el historial en una acusación
inventada. Con la fecha, el historial empieza donde empieza el compromiso. Y la semana de la fijación
queda fuera porque es la semana en la que el usuario todavía no tenía un objetivo: anotarla como
"cumplida" atribuiría a ese objetivo semanas anteriores a su existencia, y anotarla como "pendiente" le
reprocharía un objetivo que aún no existía. Ninguno de los dos reproches es verdad.

### D6. El cálculo del progreso vive en un archivo puro nuevo

La lógica del objetivo no se mezcla con `diary.js` ni con `heatmap.js`: va en un archivo puro nuevo, con
`today` como parámetro y su propio fichero de tests en `node --test`.

**Por qué**: son tres capas distintas —fechas y rachas, rejilla e intensidad, y compromiso— y mantenerlas
separadas es lo que permite que cada una se pruebe sin DOM. Añadirlo a `diary.js` significaría que una
parte de ese archivo depende de la existencia de una clave de almacenamiento, y `diary.js` no sabe nada
del almacenamiento.

**Consecuencia asumida**: el archivo nuevo depende de los otros dos, así que el orden de carga deja de ser
indiferente: `index.html` lo carga después de `diary.js` y de `heatmap.js`, y el fichero de tests los
carga en ese mismo orden. Es la primera vez que la arquitectura tiene esa direccionalidad, y el orden
pasa a ser parte del contrato.

### D7. El objetivo reutiliza el total semanal que ya existe, también para semanas pasadas

El objetivo no define un cálculo nuevo de rango de semana: reutiliza `getWeekRange` y
`calculateWeeklyTotal` de `diary.js`. Como esa función deriva la semana de su parámetro `today`, para
sumar una semana cerrada se le pasa como `today` el `weekStart` de esa semana. Mostrar "450 min" en las
métricas y "450 de 600 min" en el objetivo con dos definiciones distintas de "minutos de la semana" es
una fuente clásica de descuadres que el usuario percibe como un fallo. Una sola definición de semana,
dos representaciones.

### D8. El estado sin objetivo es un estado de primera clase

La aplicación funciona, registra sesiones y muestra todas sus métricas aunque el usuario no haya fijado
nunca una meta.

**Por qué**: exigir una meta para usar la aplicación invierte el orden natural. Se empieza registrando y
se decide el objetivo cuando ya se sabe lo que se estudia; además, bloquear el formulario de sesiones
detrás de una decisión de compromiso sería una forma de coerción.

### D9. El progreso se comunica con texto, no solo con color ni con longitud de barra

El estado del progreso existe siempre como texto legible, y la barra expone su valor mediante
`role="progressbar"` con `aria-valuenow`, `aria-valuemin` y `aria-valuemax`.

**Por qué**: es el requisito de accesibilidad que la spec 001 ya fijó para el mapa de calor y no tiene
motivo para relajarse aquí. Un porcentaje es un dato numérico; el color de una barra es una
aproximación visual de ese dato, y una barra al 60 % no significa lo mismo para todo el mundo. El
`aria-valuenow` usa el entero truncado y no el cociente exacto, para que el número que anuncia el
lector de pantalla sea el mismo que el relleno que ve la vista.

### D10. Porcentaje truncado y barra topada al 100 %

La proporción se muestra como porcentaje entero truncado hacia abajo, y ni el porcentaje ni la barra
superan 100 aunque los minutos superen la meta. El total real de minutos se muestra siempre sin ajustar.

**Por qué**: truncar nunca promete más de lo cumplido: 249 de 600 muestran 41 % y no 42 %, porque un
porcentaje redondeado al alza puede mostrar un objetivo cumplido antes de tiempo. Topar la barra evita una
barra desbordada que no significaría nada, y mantener el total real visible evita perder la información
más valiosa cuando se supera la meta, que es cuánto se ha estudiado de más.

### D11. Historial de las 12 entradas más recientes, sellado al cargar la página

Al cargar, toda semana cerrada con `weekStart` estrictamente posterior al `setAtWeekStart` de la meta y
no anotada en el historial se sella con su total de minutos y su meta. El sellado ocurre al cargar la
página, nunca con un temporizador mientras la página está abierta, y el resultado se muestra en esa
misma carga.

**Por qué**: sellar al cargar es coherente con el criterio de la spec 001 de no recalcular nada con el
reloj en caliente, y evita la clase de errores en la que una pestaña abierta toda la noche produce un
historial distinto del que produce la misma pestaña abierta un minuto después. Mostrar el resultado en la
misma carga evita el absurdo de tener una semana anotada en el almacenamiento y no visible en pantalla.
Doce entradas cubren un trimestre: suficiente para ver una tendencia sin convertir la tarjeta en una
tabla.

**Consecuencia asumida**: si el usuario no abre la aplicación durante varias semanas, todas las semanas
transcurridas se sellan en esa misma carga y el total es correcto, pero si el navegador permanece cerrado
más de 12 semanas, las semanas selladas en esa carga se descartan de inmediato al superar el límite y el
historial empieza de nuevo con las más recientes. Es coherente con el límite y no afecta a las sesiones.

### D12. El historial se normaliza siempre antes de usarse o guardarse

El historial se normaliza siempre antes de usarse o guardarse: se descartan las entradas no
interpretables, se ordena de la más reciente a la más antigua, y de cada `weekStart` repetido se conserva
la entrada que queda primera en ese orden, con desempate por más `minutes` cuando el orden por fecha no
distingue dos entradas del mismo `weekStart`.

**Por qué**: sin normalizar, el orden guardado depende del orden en que se selló cada semana, y una misma
clave puede aparecer dos veces con resultados distintos, lo que produce un historial que cambia cada vez
que se guarda. Normalizar en un único sitio hace que lo que se ve, lo que se guarda y lo que se compara
sean siempre lo mismo. Ordenar antes de deduplicar es lo que hace la regla determinista: el resultado no
depende del orden en que quedaron las entradas, así que un historial desordenado y el mismo historial
ordenado producen exactamente la misma lista. El desempate por más `minutes` cierra el único caso en el
que dos entradas siguen siendo indistinguibles, porque comparten `weekStart`: sin él, un `sort` estable
las dejaría en el orden en que estaban guardadas y la normalización dependería de ese orden.

### D13. El historial corrupto se descarta en silencio, la meta corrupta avisa

Un historial no interpretable se descarta o se poda sin mostrar ningún aviso. Un registro de meta no
interpretable, en cambio, hace que la aplicación vuelva al estado sin objetivo, muestre un aviso y vuelva a
ofrecer el formulario.

**Por qué**: una entrada de historial puede contener datos ilegibles y su ausencia no impide hacer falta
nada. El objetivo es recuperable y el usuario puede volver a escribirlo. Silenciar el primer caso evita un
aviso que el usuario no puede actuar; avisar del segundo evita que el usuario crea que tiene una meta fijada
cuando en realidad no la tiene, y le da una forma de recuperarla.

### D14. Cada entrada del historial se juzga contra su propia meta

Una entrada sellada se muestra como cumplida o pendiente comparando sus minutos con el `met` que se guardó
al sellarla, nunca con la meta vigente.

**Por qué**: hace que el campo `met` tenga un uso observable en lugar de decorativo, deja cada entrada
intelligible por sí sola y garantiza que un resultado anotado no cambia nunca por un cambio posterior de la
meta. Con la meta inmutable de D1 las dos cosas coinciden siempre, de modo que la regla no tiene efecto
observable hoy; se fija igualmente para que el criterio sea explícito y no heredado. El precio es que, si
algún día la meta fuera editable, las semanas selladas con una meta anterior se mostrarían con el objetivo
de entonces, que es el dato que el usuario puede reconstruir aunque ya no recuerde la cifra.

### D15. Un salto del reloj hacia atrás no sella nada

Si la semana actual es anterior o igual a la de la última entrada del historial, no se sella ninguna semana
y el progreso se calcula sobre la semana actual tal cual.

**Por qué**: sin esta regla, un reloj mal ajustado o un viaje en el tiempo del sistema produciría entradas
con `weekStart` en el futuro, que se quedarían en cabeza de la lista y bloquearían el sellado de todas las
semanas siguientes hasta que el reloj alcanzara esa fecha. Es un dato de reloj, no de estudio, y no
justifica una entrada.