# MEMORY.md — Diario de Estudio
Memoria del proyecto entre sesiones. Máximo ~50 líneas: resume o elimina lo que ya no
aporte.
## Estado actual
- v6 funcionando: registrar sesiones, racha, mejor racha, total semanal, días del mes,
  mapa de 26 semanas, historial y **objetivo semanal** con progreso e historial de semanas.
- Objetivo: meta de 10–10080 min, barra que se mueve en vivo al registrar sesión, y
  semanas cerradas que se sellan al arrancar y se pintan en la misma carga.
- Lógica pura en `diary.js`, `heatmap.js` y `goal.js`; `app.js` solo pinta, escucha y
  guarda en `localStorage`. 276 tests con `node --test`, en verde.
## Decisiones (y por qué)
- Sin backend ni dependencias: cualquiera debe poder abrirlo con doble clic.
- Fecha editable: permite registrar días pasados y ver la racha crecer.
- Mapa de 26 semanas (no 52): 26 es múltiplo de 7, así las columnas se alinean al día de
  la semana real, y cabe en 375 px sin scroll horizontal.
- Escala de color absoluta, no relativa al mejor día: una semana floja no puede verse más
  "verde" que una excelente.
- Los nombres de día y mes son tablas escritas a mano, no `Intl`: la spec fija cadenas
  exactas y los tests las comprueban, y `Intl` varía según los datos de idioma de Node.
- Sesión inválida nunca se borra ni se oculta: se excluye del mapa, se avisa y sigue
  visible en el historial marcada.
- El mapa va después del formulario: en móvil queda bajo el pliegue, aceptado a conciencia.
- **La meta se juzga contra su propio `met` guardado**, no contra la meta vigente: así cada
  semana es intelligible sola. La firma de `isWeekEntryMet(entry)` lo hace estructural: no
  hay segundo argumento por el que pasar la meta actual.
- **`setAt` no invalida la meta**, solo `setAtWeekStart`: `setAt` es trazabilidad y de él no
  depende ningún cálculo.
- El objetivo filtra ANTES de sumar: `calculateWeeklyTotal` suma a ciegas y devuelve `NaN`
  con minutos no numéricos. Consecuencia aceptada: con datos corruptos la tarjeta de
  minutos y el objetivo muestran números distintos.
- El porcentaje se **trunca**, no se redondea (249/600 → 41), y relleno de barra y
  `aria-valuenow` son el mismo entero.
- Historial: 12 semanas más recientes; empate de `weekStart` por más `minutes`, para que
  el resultado no dependa del orden guardado.
## Aprendizajes y errores a evitar
- `toISOString()` convierte a UTC y desplaza el día en husos negativos. Para fechas locales
  usar siempre `toLocalDateString()`.
- **Nunca escribir ficheros del proyecto con PowerShell** (`Out-File`, `Set-Content`,
  `Add-Content`, redirecciones) ni con scripts de Node: leen y escriben como ANSI y
  corrompen el UTF-8 en silencio. Destruyó `goal.test.js` entero. Usar solo las
  herramientas de escritura/edición.
- Módulos ES (`import`/`export`) rompen `file://`. La lógica pura se carga con `<script>` y
  con `require()` gracias a la guarda `if (typeof module !== "undefined")`.
- En `goal.js` **ningún nombre puede repetir uno de `diary.js`, `heatmap.js` o `app.js`**: en
  el navegador son globales y redeclarar uno es un `SyntaxError` que tumba la página
  entera. De ahí el prefijo `GOAL_` y el objeto `GOAL_DEPS`.
- `GOAL_DEPS` lista sus miembros a mano: una dependencia nueva que no se añada ahí funciona
  con `require()` y **falla en el navegador**. Pasó con `localDateFromKey`.
- Verificar con la herramienta antes de escribir una expectativa: una vez calculé mal el
  inicio de la ventana del mapa y el test falló por mi error, no por el código.
- En la rejilla, índice = `columna * 7 + fila`. `ArrowDown` suma 1, `ArrowRight` suma 7: lo
  contrario de lo que parece al leerlo deprisa. Y la fila es el día de la semana, no la
  semana.
- El pseudocódigo del plan §5.4 (dos `sort` seguidos para normalizar) era **incorrecto**:
  el segundo `sort` reordena el array entero por minutos. Un solo `sort` con comparador
  compuesto.
- Comparar la lista normalizada contra la lectura normalizada siempre da igual: para detectar
  un historial guardado sobredimensionado hay que comparar contra el dato crudo.
## Próximos pasos
- Revisión no bloqueante de la spec 002, cuando haya uso real: si el usuario consulta
  semanas más allá de las 12 últimas, subir `HISTORY_LIMIT`.
- Revisión de umbrales de la escala del mapa, tras 4 semanas de uso real: si casi todos los
  días caen en un único nivel, replantearlos como spec nueva.