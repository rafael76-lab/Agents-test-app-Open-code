# Spec 001 — Mapa de calor de estudio

## Contexto y objetivo

El Diario de Estudio muestra hoy cómo va la motivación: la racha actual, los minutos de esta
semana y el historial de sesiones. Pero todas esas vistas responden a "¿cómo estoy hoy?", y una
motivación sostenida necesita además "¿he sido constante?".

Hoy el usuario solo puede responder a esa pregunta recorriendo el historial, sesión a sesión, y
contando los días a mano. Además, el historial es una lista: no distingue de un vistazo si una
semana fue de cuatro días seguidos o de cuatro días repartidos a lo largo de la semana.

Un mapa de calor tipo GitHub resuelve las dos cosas: convierte el historial en una textura visible
de constancia y hace que la intensidad de cada día sea proporcional a los minutos estudiados. El
objetivo es que el usuario abra la aplicación, mire el mapa y sepa en un segundo si está
construyendo un hábito o si se está estancando.

## Alcance de la spec

Esta spec define únicamente el mapa de calor. No modifica el comportamiento de la racha, de la
mejor racha, de los recuentos semanales y mensuales ni del formulario. El único punto de contacto
con funcionalidad existente es el historial, tratado de forma explícita en RF-21.

## Usuarios / actores

- **Estudiante auto-gestionado**: la única persona que usa la aplicación. Registra sus sesiones y
  las consulta desde el móvil, normalmente en ratos breves. Es la usuaria de todas las historias.
- No hay otros actores. No hay cuentas, ni roles, ni uso compartido: los datos son personales y
  viven únicamente en el navegador.

## Definiciones

Estas definiciones son normativa y se usan en los requisitos.

- **Sesión válida**: una sesión guardada cuyo campo de fecha es una fecha local existente y cuyo
  campo de minutos es un entero mayor o igual que 1. Cualquier otro caso es una **sesión
  inválida**.
- **Día con actividad**: un día del mapa cuyo total de minutos válidos es mayor que 0.
- **Día sin actividad**: un día del mapa que no es un día con actividad.
- **Hoy**: la fecha local sobre la que se construye el mapa. Se calcula una única vez, al cargar
  la página, y no cambia durante la sesión abierta (ver RF-3).
- **Ventana del mapa**: el conjunto de fechas que el mapa representa, desde el lunes de hace 26
  semanas hasta hoy, ambas incluidas.

## Historias de usuario

- **H1**: Como estudiante, quiero ver un mapa de los últimos meses coloreado por minutos
  estudiados, para detectar de un vistazo si mantengo la constancia y dónde se me corta el hábito.
- **H2**: Como estudiante, quiero que el color del día refleje la cantidad real de minutos y no un
  relativo al mejor día, para poder comparar mi rendimiento entre semanas sin que el mapa me engañe.
- **H3**: Como estudiante, quiero consultar la fecha y los minutos de un día concreto al pasar por
  encima, al tocarlo o al recorrerlo con el teclado, para no tener que abrir el historial para
  recordar cuánto estudié un día.
- **H4**: Como estudiante, quiero saber si un hueco en el mapa significa que no estudié o que el
  mapa todavía no llega hasta ese día, para no interpretar mal lo que veo.
- **H5**: Como estudiante, quiero que la aplicación me avise si encuentra sesiones guardadas que no
  puede interpretar, para saber por qué un número no me cuadra.
- **H6**: Como estudiante, quiero seguir viendo en el historial las sesiones que no puede
  interpretar, para no perderlas y poder corregirlas por mi cuenta si quiero.
- **H7**: Como estudiante, quiero que la aplicación siga funcionando aunque no pueda guardar nada,
  para poder consultar lo ya registrado aunque mi navegador me bloquee el almacenamiento.

## Requisitos funcionales

### Estructura del mapa

- **RF-1**: CUANDO el usuario abre la aplicación, EL SISTEMA muestra un mapa de 27 columnas por 7
  filas.
- **RF-2**: MIENTRAS el mapa se muestra, EL SISTEMA ordena las columnas de izquierda a derecha de
  más antigua a más reciente, de modo que la última columna contiene a hoy.
- **RF-3**: CUANDO la aplicación se carga, EL SISTEMA calcula la definición de "hoy" una única vez
  y la mantiene inalterada durante toda la sesión de la página.
- **RF-4**: MIENTRAS el mapa se muestra, EL SISTEMA coloca cada celda en la fila correspondiente a
  su día de la semana, con el lunes en la fila superior y el domingo en la inferior, de modo que
  la alineación vertical sea constante entre columnas.
- **RF-5**: CUANDO el mapa se construye, EL SISTEMA incluye en la ventana exactamente los días
  desde el lunes de la semana de hoy situada 26 semanas antes, hasta hoy, ambas fechas incluidas,
  y representa como celda el resto de días de esa última semana hasta el domingo.
- **RF-6**: SI no existen sesiones válidas en ninguna fecha de la ventana, ENTONCES EL SISTEMA
  muestra el mapa completo en gris, con las 27 columnas y las 7 filas presentes, y sin aviso de
  datos inválidos si tampoco hay sesiones inválidas.
- **RF-7**: SI existen sesiones pero ninguna es válida, ENTONCES EL SISTEMA muestra el mapa completo
  en gris, con las 27 columnas y las 7 filas presentes, y muestra el aviso de RF-20.

### Intensidad del color

Los umbrales son absolutos y fijos: el color de un día no depende de qué más haya ocurrido en la
ventana. La escala completa tiene seis estados:

| Minutos válidos del día | Estado |
|---|---|
| 0 | Gris de inactividad |
| 1 – 29 | Nivel 1 |
| 30 – 59 | Nivel 2 |
| 60 – 119 | Nivel 3 |
| 120 – 239 | Nivel 4 |
| 240 o más | Nivel 5 |

- **RF-8**: CUANDO se calcula el mapa, EL SISTEMA obtiene el estado de cada celda sumando los
  minutos de todas las sesiones válidas con esa fecha, con independencia de cuántas haya.
- **RF-9**: SI una fecha acumula minutos repartidos en dos o más sesiones válidas, ENTONCES EL
  SISTEMA los suma y clasifica la celda según el total, no según ninguna de las sesiones
  individuales.
- **RF-10**: CUANDO los minutos válidos de un día superan el último umbral, EL SISTEMA muestra el
  nivel 5 y no un nivel superior, aunque los minutos sigan aumentando.
- **RF-11**: SI una fecha tiene al menos una sesión válida y todas sus sesiones inválidas, ENTONCES
  EL SISTEMA clasifica la celda con el total de las sesiones válidas, excluye las inválidas del
  total y las cuenta en el aviso de RF-20.
- **RF-12**: CUANDO el mapa se recalcula tras registrar una sesión, EL SISTEMA vuelve a clasificar
  todas las celdas de la ventana con la escala absoluta, sin conservar estados previos.
- **RF-13**: SI una fecha de la ventana tiene una o más sesiones inválidas y ninguna válida, ENTONCES
  EL SISTEMA muestra esa celda con el gris de inactividad, la clasifica como día sin actividad y
  cuenta esas sesiones en el aviso de RF-20.

### Fechas de la ventana

- **RF-14**: CUANDO se representa una celda cuya fecha es posterior a hoy, EL SISTEMA le aplica el
  mismo criterio de color que cualquier otra fecha de la ventana: si tiene sesiones válidas, muestra
  la intensidad que le corresponde; si no, muestra el gris de inactividad.
- **RF-15**: CUANDO se representa una celda cuya fecha es posterior a hoy y no tiene ninguna sesión
  válida, EL SISTEMA la muestra con el gris de inactividad y la clasifica como día sin actividad.

### Detalle de un día

El mapa dispone de una única línea de detalle, situada inmediatamente debajo del mapa. Su
contenido depende del tipo de celda sobre la que se actúa:

| Situación | Contenido exacto de la línea de detalle |
|---|---|
| Día con actividad | "martes, 15 de septiembre — 90 min" |
| Día sin actividad, fecha anterior o igual a hoy | "lunes, 13 de septiembre — sin sesiones" |
| Día sin actividad, fecha posterior a hoy | "sábado, 4 de octubre — aún no ha llegado" |

La fecha se escribe con el día de la semana en minúsculas, seguido de día y mes en español, sin
año, y los minutos se escriben como número entero seguido de "min", sin separador de millares.

- **RF-16**: CUANDO el puntero, el dedo o el foco se sitúa sobre una celda, EL SISTEMA muestra en la
  línea de detalle el texto que corresponde a esa celda según la tabla anterior.
- **RF-17**: CUANDO el puntero, el dedo o el foco abandona una celda, EL SISTEMA vacía la línea de
  detalle.
- **RF-18**: SI la línea de detalle ya muestra el contenido de una celda y el usuario actúa sobre
  otra celda, ENTONCES EL SISTEMA sustituye el contenido anterior por el de la nueva celda.

### Datos inválidos

- **RF-19**: SI existe al menos una sesión inválida, EL SISTEMA muestra, en una línea situada
  inmediatamente debajo de la línea de detalle, un aviso que indica el número total de sesiones
  inválidas y el número de sesiones inválidas por cada motivo: fecha no interpretable y minutos no
  válidos.
- **RF-20**: MIENTRAS exista al menos una sesión inválida, EL SISTEMA mantiene el aviso visible con
  independencia de sobre qué celda se actúa y con independencia de si la línea de detalle está
  vacía o rellena.
- **RF-21**: CUANDO una sesión es inválida, EL SISTEMA la conserva almacenada sin modificarla y la
  mantiene visible en el historial, marcada de forma visible como "datos no válidos".
- **RF-22**: SI una fecha guardada no es una fecha local existente, ENTONCES EL SISTEMA la trata como
  sesión inválida por fecha no interpretable. Se consideran no interpretables, entre otros, las
  cadenas vacías, las que no siguen el formato `AAAA-MM-DD`, las que contienen un mes fuera de 1 a
  12 o un día fuera del rango válido de su mes, y las que no son texto.
- **RF-23**: SI los minutos guardados no son un entero mayor o igual que 1, ENTONCES EL SISTEMA
  trata la sesión como inválida por minutos no válidos. Se consideran no válidos la ausencia del
  campo, los valores no numéricos, los decimales, el cero y los negativos.
- **RF-24**: CUANDO el almacenamiento local no está disponible, no se puede leer o no se puede
  escribir, EL SISTEMA muestra el mapa completo en gris, omite el aviso de RF-19, no interrumpe el
  resto de la aplicación y no lanza ningún error.

### Comportamiento con el tiempo

- **RF-25**: CUANDO han pasado días desde la última vez que el usuario abrió la aplicación, EL
  SISTEMA recalcula la ventana al abrirla, de modo que aparezcan las celdas nuevas y desaparezcan
  las que salen por el extremo más antiguo.
- **RF-26**: SI el reloj del sistema cambia de día mientras la página está abierta, ENTONCES EL
  SISTEMA no modifica la ventana ni recolorea las celdas hasta la siguiente carga de la página.
- **RF-27**: SI el usuario registra una sesión con una fecha anterior a hoy que pertenece a la
  ventana, ENTONCES EL SISTEMA recolorea esa celda inmediatamente, aunque hoy no haya cambiado.
- **RF-28**: SI el usuario registra una sesión con una fecha anterior al inicio de la ventana o
  posterior a hoy, ENTONCES EL SISTEMA la guarda y la muestra en el historial, no la representa en
  el mapa y no muestra ningún aviso.

### Acceso por teclado

- **RF-29**: MIENTRAS el mapa se muestra, EL SISTEMA expone las celdas como un único grupo
  navegable: el conjunto es una sola parada de tabulación y dentro de él se recorre con las flechas
  del teclado.
- **RF-30**: CUANDO una celda recibe el foco por teclado, EL SISTEMA muestra la línea de detalle
  correspondiente y la mantiene visible mientras conserve el foco.
- **RF-31**: CUANDO el foco se mueve entre celdas con las flechas y llega al final de una fila o de
  la rejilla, EL SISTEMA detiene el recorrido en ese borde y no salta a otra zona de la página.
- **RF-32**: CUANDO el mapa está formado por celdas sin actividad y el usuario las recorre con el
  teclado, EL SISTEMA muestra igualmente la línea de detalle con el texto "sin sesiones" o "aún no
  ha llegado" que corresponda.

## Requisitos no funcionales

- **RFN-1 Simplicidad**: La funcionalidad se implementa con HTML, CSS y JavaScript puros, sin
  dependencias, sin paquetes y sin paso de compilación. Sigue funcionando abriendo `index.html`
  con doble clic.
- **RFN-2 Lógica pura**: Todo el cálculo del estado de color y de la estructura de la rejilla se
  resuelve con funciones puras, sin acceso al DOM ni al almacenamiento local.
- **RFN-3 Fecha actual por parámetro**: Toda función pura que necesite saber qué día es hoy recibe
  esa fecha como parámetro explícito y no la obtiene por su cuenta del reloj del sistema. Los
  valores que devuelve no dependen del momento en que se ejecuten.
- **RFN-4 Pruebas**: La lógica se cubre con `node --test`, sin instalar nada. Ningún test se
  escribe usando el reloj del sistema para obtener la fecha actual.
- **RFN-5 Móvil**: El mapa completo se ve sin desplazamiento horizontal a 375 px de ancho de CSS y
  con la tipografía por defecto del navegador.
- **RFN-6 Accesibilidad**: El color nunca es el único medio de transmitir información. Cada celda
  expone como texto accesible el mismo contenido que la línea de detalle muestra para ella, de
  modo que la información existe una sola vez y es legible con lector de pantalla, con teclado y
  con tecnologías de asistencia que no reproducen color.
- **RFN-7 Contraste**: Los seis estados de la escala son distinguibles entre sí y legibles tanto en
  modo claro como en modo oscuro.
- **RFN-8 Color forzado**: Si el usuario activa un modo de alto contraste o de escala de grises en
  su sistema, los estados siguen siendo distinguibles por su forma y por el texto accesible, no
  únicamente por el color.
- **RFN-9 Privacidad**: Los datos no salen del navegador. No hay peticiones de red ni terceros.
- **RFN-10 Idioma**: Toda la interfaz y esta documentación están en español. El código se escribe en
  inglés.

## Casos límite

- **Usuario nuevo**: sin ninguna sesión, el mapa aparece con 27 columnas y 7 celdas en gris, sin
  aviso, y la línea de detalle vacía. El mapa es navegable con teclado desde el primer uso.
- **Poca historia**: las columnas anteriores a la primera sesión del usuario se muestran en gris
  como cualquier otro día sin actividad. El mapa no se recorta ni se reordena.
- **Sesiones muy antiguas**: las sesiones con fecha anterior al inicio de la ventana no se
  representan en el mapa. No se muestra ningún aviso por ello, no son un error y siguen visibles en
  el historial.
- **Frontera de semana**: el lunes a las 00:00 y el domingo a las 23:59 se sitúan en columnas
  distintas; una semana completa nunca se reparte entre dos columnas.
- **Cruce de mes y de año**: los días de diciembre que caen en la semana siguiente entran en la
  columna de enero sin alterar el cálculo de las intensidades.
- **Año bisiesto**: el 29 de febrero se representa como cualquier otro día. Si la ventana incluye el
  29 de febrero como último día de una columna, la columna siguiente muestra el 1 de marzo en su
  fila correcta.
- **Cambio de hora dentro del mismo huso**: si la hora oficial se ajusta o cambia la hora de verano,
  los días locales que se repiten o se acortan se representan una sola vez y las fechas ya
  registradas siguen mostrándose en el día local que se interpretaron al guardarlas.
- **Salto de zona horaria**: las fechas ya registradas se muestran en el día local que se
  interpretaron al guardarlas, sin reubicarlas por el cambio de huso.
- **Día mixto**: una fecha con una sesión válida y otra inválida muestra la intensidad del total
  válido, no cuenta la inválida en el total y sí la contabiliza en el aviso.
- **Solo sesiones inválidas**: un mapa completamente gris acompañado de aviso es un estado
  distinguible del mapa de usuario nuevo, precisamente porque el aviso está presente.
- **Aviso persistente**: el aviso de datos inválidos permanece visible aunque la línea de detalle se
  vacíe, porque ambas son capas independientes.
- **Volumen alto**: un usuario con cientos de sesiones ve el mapa completo sin degradarse ni
  mostrar un aviso de rendimiento.
- **Aviso extenso**: el aviso muestra un número total y un número por motivo, nunca una lista por
  sesión, de modo que su longitud no depende del número de datos corruptos.
- **Días idénticos**: dos días con exactamente los mismos minutos válidos reciben exactamente el
  mismo estado.
- **Aviso y mapa con actividad**: un aviso convive sin conflicto con celdas que tienen color de
  actividad.
- **Zoom y tipografía**: con zoom al 200 % o con tipografía ampliada, la rejilla sigue siendo
  navegable y ninguna información queda inaccesible, aunque la ausencia de desplazamiento
  horizontal de RFN-5 se evalúa únicamente en los supuestos que RFN-5 define.
- **Alta contraste o escala de grises**: los estados siguen siendo distinguibles por forma y por
  texto accesible, según RFN-8.

## Fuera de alcance

- Cualquier forma de editar, corregir o eliminar sesiones inválidas. El aviso informa; no repara.
- Ocultar del historial las sesiones inválidas. Se muestran y se marcan, según RF-21.
- Persistir la mejor racha como un récord histórico que sobreviva al borrado de sesiones.
- Exportar o compartir el mapa como imagen o archivo.
- Filtros por tema, por semana concreta o por rango de fechas personalizado.
- Mapa interactivo con zoom, desplazamiento o selección de periodos.
- Heatmaps anuales de 52 semanas o de ventana variable según el uso.
- Escalas de color relativas al máximo de la ventana o con umbrales configurables.
- Cualquier indicación de objetivo, meta o cantidad objetivo, y cualquier aviso motivacional sobre
  el rendimiento.
- Mostrar la distribución por temas o el desglose de minutos por semana más allá de lo que ya
  ofrece el resto de la aplicación.
- Recargar la ventana del mapa mientras la página está abierta, según RF-26.

## Criterios de finalización

Los criterios se separan en los verificables automáticamente y los que exigen comprobación manual,
porque no todos los requisitos pueden comprobarse con `node --test`.

Verificables con `node --test`:

- Un test por cada uno de los seis estados de la escala, con los valores límite 0, 1, 29, 30, 59,
  60, 119, 120, 239, 240 y un valor muy superior.
- Un test de RF-9 con dos o más sesiones en la misma fecha, y un test de RF-11 con una sesión válida
  y otra inválida en la misma fecha.
- Un test de RF-10 que verifique que ningún total produce un estado por encima del nivel 5.
- Un test de RF-24 con sesiones inválidas de cada motivo: fecha con formato incorrecto, mes fuera de
  rango, día fuera de rango, fecha no textual, minutos ausentes, minutos no numéricos, minutos
  decimales, minutos cero y minutos negativos.
- Un test de RF-19 y RF-20 que verifique el número total de sesiones inválidas y el desglose por
  motivo.
- Un test de RF-21 que verifique que la sesión inválida ni se modifica ni desaparece.
- Un test de RF-4 y RF-5 que verifique que la ventana contiene exactamente los días esperados, que
  cada fila tiene siete celdas y que cada fecha cae en la fila de su día de la semana.
- Un test de RF-6 y RF-7 que verifique el estado del mapa con cero sesiones y con solo sesiones
  inválidas.
- Un test de RF-2 que verifique el orden de las columnas, de más antigua a más reciente.
- Un test de RF-14 y RF-15 con una fecha posterior a hoy, con y sin sesiones.
- Un test de RF-28 con una fecha fuera de la ventana por ambos extremos.
- Un test que verifique que ninguna función pura obtiene la fecha actual por su cuenta, tal como
  exige RFN-3.
- Todos los tests en verde.

Comprobaciones manuales:

- Demo del flujo principal: registrar una sesión y comprobar que la celda del día correspondiente
  cambia de estado sin recargar, y que el aviso y la línea de detalle se comportan según RF-19 y
  RF-20.
- Comprobación a 375 px de ancho de CSS sin desplazamiento horizontal.
- Comprobación de los seis estados distinguibles en modo claro y en modo oscuro.
- Comprobación de los seis estados distinguibles con escala de grises del sistema activa.
- Comprobación con teclado: recorrer la rejilla con las flechas, confirmar que la línea de detalle
  sigue a la celda con foco, que el recorrido se detiene en los bordes y que el conjunto es una sola
  parada de tabulación.
- Comprobación táctil: confirmar que un toque sobre una celda muestra el detalle.
- Comprobación con zoom al 200 % de que la rejilla sigue siendo navegable.
- Comprobación con el almacenamiento local deshabilitado de que la aplicación no muestra errores.
- Consola del navegador sin errores ni advertencias.
- Revisión de que ningún otro requisito de la aplicación (racha, mejor racha, minutos semanales,
  días del mes, formulario) cambia de comportamiento al añadir el mapa.
- **Revisión posterior, no bloqueante**: una vez en uso con al menos cuatro semanas de datos reales,
  se comprueba si la distribución de las celdas usa varios niveles de la escala. Si la práctica
  totalidad de los días cae en un único estado, los umbrales se consideran inadecuados y su ajuste
  se plantea como spec nueva. Esta revisión no bloquea la entrega de esta versión.

## Decisiones adoptadas

Estas decisiones se tomaron por delegación del usuario, sin validación de uso real. Se registran
aquí para que consten como parte del alcance acordado.

### D1. Umbrales absolutos de la escala

Se mantienen los cortes 0 / 1–29 / 30–59 / 60–119 / 120–239 / 240+.

**Por qué**: 30, 60, 120 y 240 minutos son los puntos naturales del lenguaje habitual ("un rato",
"una hora", "dos horas", "medio día"). Un usuario que estudia 15 minutos diarios verá todos sus
días en el mismo nivel bajo, y uno que estudia varias horas los verá todos en el máximo, pero en
ambos casos el mapa sigue comunicando la constancia, que es el objetivo de la funcionalidad.

**Cómo se mitiga el riesgo**: RF-10 garantiza que superar el máximo no genera estados inventados,
de modo que el peor caso es "muchos días iguales en el extremo", nunca una escala falsa. Y existe
un criterio de revisión posterior con datos reales que no bloquea la entrega.

### D2. Mismo gris para días sin actividad y para fechas futuras

Las celdas sin sesiones válidas se muestran con el mismo gris, tanto si su fecha es pasada como
futura. Una señalización distinta para el futuro sería información sin valor accionable: no se
puede estudiar un día que no ha llegado, y el gris de esa esquina es inevitable por la forma de la
rejilla.

**Cómo se resuelve la ambigüedad de H4**: no por color, sino por contenido. La línea de detalle
distingue explícitamente "sin sesiones" de "aún no ha llegado", que es donde el usuario lee el
detalle.

### D3. Posición del mapa en la pantalla

El mapa va después del formulario y antes del historial.

**Por qué**: el orden cuenta una historia en tres tiempos. Primero las métricas, que responden a
"¿cómo voy hoy?". Después el formulario, que es la acción inmediata. Y después el mapa y el
historial, que son material de reflexión.

**Consecuencia asumida**: en móvil el mapa queda por debajo del pliegue y no se ve de inmediato al
abrir. Se acepta porque el objetivo declarado de la aplicación sigue siendo registrar la sesión
del día. Si en el futuro se quisiera que el mapa fuese lo primero visible, sería un cambio de
orden, no una funcionalidad nueva.