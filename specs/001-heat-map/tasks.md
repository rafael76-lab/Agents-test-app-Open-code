# Tareas — Spec 001: Mapa de calor de estudio

Derivado de `spec.md` y `plan.md`. Tareas de 20 a 30 minutos, en orden de dependencia: cada una solo
depende de las anteriores. La puerta del principio 4 de la constitución sigue en pie en cada bloque:
no se pasa al siguiente grupo con `node --test` en rojo.

Leyenda de bloques:

- **Bloque A** — Red de seguridad de lo que ya existe
- **Bloque B** — Lógica pura del mapa
- **Bloque C** — Marcado y estilos
- **Bloque D** — Cableado e interacción
- **Bloque E** — Refactor de lo existente y cierre

---

## Bloque A — Red de seguridad de lo que ya existe

- [ ] **A1. Crear `app.test.js` con tests que fijan el comportamiento actual de las métricas**
  Cubre: alcance de la spec (no cambiar racha, mejor racha, minutos semanales ni días del mes).
  Escribe tests para `calculateStreak`, `calculateBestStreak`, `calculateWeeklyTotal` y
  `calculateMonthlyDays` con fechas explícitas, replicando los casos que ya se verificaron a mano:
  racha de 3, mejor racha de 5 con racha actual de 2, días sueltos, lista vacía, semana ISO
  lunes-domingo, cruce de mes.
  **Hecho cuando:** `node --test` pasa en verde sin haber modificado todavía `app.js`.

- [ ] **A2. Añadir a `app.test.js` el test que fija los datos de referencia del mapa**
  Cubre: RF-6, RF-7.
  Fija que con cero sesiones las tres métricas dan 0 y con solo sesiones inválidas el resto de la
  aplicación no lanza error.
  **Hecho cuando:** existen esos casos en `app.test.js` y `node --test` sigue en verde.

## Bloque B — Lógica pura del mapa

- [ ] **B1. Crear `heatmap.js` con los helpers de fecha y la exportación dual**
  Cubre: RFN-3, RFN-4, principio 1 y 3 de la constitución.
  `toLocalDateKey`, `addDays`, `weekdayIndex`, `getWeekStartMonday` y `isValidDateKey`, terminando
  con la guarda `if (typeof module !== "undefined") module.exports = {...}`.
  `weekdayIndex` devuelve 0 para lunes y 6 para domingo.
  **Hecho cuando:** `node -e "const h=require('./heatmap.js'); console.log(h.weekdayIndex('2026-10-02'))"` imprime `4`, y el archivo se puede cargar con `<script>` sin error en el navegador.

- [ ] **B2. Escribir los tests de los helpers de fecha**
  Cubre: RF-4, RF-5, RFN-3.
  Casos límite de bisiesto, cruce de mes y de año, y que `addDays` con valores negativos retrocede.
  **Hecho cuando:** los tests de B2 pasan y `node --test` está en verde.

- [ ] **B3. Implementar en `heatmap.js` los tests de validez de datos y sus tests**
  Cubre: RF-22, RF-23.
  `isValidMinutes` y `motivoInvalidez`, que devuelve `"fecha"`, `"minutos"` o `null`.
  **Hecho cuando:** los tests cubren los nueve casos de RF-23 (ausente, `null`, texto, decimal, cero,
  negativo, entero válido, número grande) y los de RF-22, y pasan.

- [ ] **B4. Implementar `partitionSessions` y sus tests**
  Cubre: RF-19, RF-21, RF-22, RF-23.
  Devuelve `{ valid, invalidTotal, invalidByReason }`. Ninguna sesión se modifica ni se descarta de
  la entrada.
  **Hecho cuando:** un test verifica el total y el desglose por motivo, y otro verifica que la sesión
  inválida sigue presente sin cambios.

- [ ] **B5. Implementar `getWindowBounds` y sus tests**
  Cubre: RF-1, RF-5, RF-28.
  Devuelve el lunes de hace 26 semanas y el domingo de la semana en curso, con `today` por
  parámetro.
  **Hecho cuando:** con `today = "2026-10-02"` devuelve inicio `"2026-03-30"` y fin `"2026-10-04"`,
  y el test pasa.

- [ ] **B6. Implementar `getIntensityLevel` y sus tests de los once valores límite**
  Cubre: RF-8, RF-10.
  Comparaciones descendentes y `return` final sin condición.
  **Hecho cuando:** los tests cubren 0, 1, 29, 30, 59, 60, 119, 120, 239, 240 y 99999, con el nivel
  5 como máximo posible, y pasan.

- [ ] **B7. Implementar `buildHeatmap` y sus tests de estructura**
  Cubre: RF-1, RF-2, RF-4, RF-5, RF-8, RF-9, RF-28.
  Acumula minutos por fecha y recorre 27 columnas × 7 filas en orden de más antigua a más
  reciente.
  **Hecho cuando:** los tests verifican 27 columnas, 7 filas, 189 celdas, que cada fila tiene siete
  celdas, que una fecha cae en la fila de su día de la semana y que la última columna contiene a hoy.

- [ ] **B8. Añadir a los tests de `buildHeatmap` los casos de color y de celdas mixtas**
  Cubre: RF-9, RF-11, RF-13, RF-14, RF-15.
  **Hecho cuando:** existen tests de dos y tres sesiones en la misma fecha, de día mixto válido más
  inválido, de fecha con solo inválidas, y de fecha futura con y sin sesión válida.

- [ ] **B9. Implementar `componerTextoCelda`, `formatCellDetail`, `getCellLabel` y sus tests**
  Cubre: RF-16, RFN-6, H4.
  Tablas `DIAS_SEMANA` y `MESES` escritas a mano, fecha parseada a las 12:00, guion largo `—`.
  **Hecho cuando:** los tests verifican las tres cadenas exactas de la tabla de la spec y que
  `getCellLabel` y `formatCellDetail` devuelven lo mismo para la misma celda.

- [ ] **B10. Implementar `moveFocusCell` y sus tests**
  Cubre: RF-29, RF-31.
  Recorte con `min` y `max`, y `null` en los cuatro bordes.
  **Hecho cuando:** los tests cubren las cuatro direcciones y los cuatro bordes devuelven `null`.

- [ ] **B11. Test de determinismo y de ausencia de reloj del sistema**
  Cubre: RFN-3, RFN-4, RF-26.
  **Hecho cuando:** dos llamadas seguidas con la misma entrada devuelven estructuras iguales, y existe
  un test que falla si alguna función pura de `heatmap.js` obtiene la fecha por su cuenta.

## Bloque C — Marcado y estilos

- [ ] **C1. Añadir la sección del mapa en `index.html`**
  Cubre: D3 de la spec, RF-1, RFN-6.
  Sección entre el formulario y el historial, con `role="grid"`, `aria-rowcount="7"`,
  `aria-colcount="27"`, la línea de detalle con `aria-hidden="true"`, el aviso con `role="status"`
  oculto por defecto, y la leyenda. Cargar `heatmap.js` antes de `app.js`.
  **Hecho cuando:** la sección aparece en la posición correcta del documento y el mapa se ve vacío,
  sin error en consola.

- [ ] **C2. Estilos de la rejilla y los seis estados de color en `styles.css`**
  Cubre: RF-2, RF-4, RFN-5, RFN-7.
  `grid-auto-flow: column`, `aspect-ratio: 1`, y clases por `data-level="0"` a `[data-level="5"]`
  con sus equivalentes en modo oscuro. La leyenda usa el mismo `data-level` para no desincronizarse.
  **Hecho cuando:** la rejilla se ve en 27 columnas y 7 filas, y los seis estados tienen color
  distinto en modo claro y en modo oscuro.

- [ ] **C3. Estilos de la línea de detalle, el aviso y la leyenda**
  Cubre: RF-19, RF-20.
  **Hecho cuando:** la línea de detalle reserva altura para que el aviso no salte de sitio al
  aparecer, y el aviso queda inmediatamente debajo de ella.

- [ ] **C4. Estilos bajo `forced-colors: active`**
  Cubre: RFN-8.
  Borde sólido fino, discontinuo, punteado, doble y sólido grueso para los niveles 1 a 5; el nivel 0
  sin borde.
  **Hecho cuando:** con escala de grises del sistema activa, los seis estados siguen siendo
  distinguibles sin depender del color de relleno.

## Bloque D — Cableado e interacción

- [ ] **D1. Lectura segura del almacenamiento en `app.js`**
  Cubre: RF-24, H7.
  `try`/`catch` en lectura y escritura, lista vacía si falla y bandera
  `almacenamientoDisponible` que impide mostrar el aviso.
  **Hecho cuando:** con el almacenamiento deshabilitado la aplicación carga sin errores y sin aviso,
  y el resto de la aplicación sigue respondiendo.

- [ ] **D2. Congelar "hoy" al cargar la página**
  Cubre: RF-3, RF-26, RF-27.
  Una sola variable calculada al cargar, reutilizada por el pintado y por el manejador del
  formulario.
  **Hecho cuando:** el manejador del formulario no vuelve a llamar a `new Date()`, y la ventana no
  cambia si el reloj del sistema cambia de día con la página abierta.

- [ ] **D3. `renderHeatmap` pinta las 189 celdas**
  Cubre: RF-6, RF-7, RF-12, RF-14, RF-15.
  Construye las celdas en orden, asigna `data-level` y el texto accesible de `getCellLabel`, y pinta
  línea de detalle vacía y aviso solo si `invalidTotal > 0` y el almacenamiento está disponible.
  **Hecho cuando:** con cero sesiones se pintan 189 celdas en nivel 0 sin aviso, y con solo sesiones
  inválidas se pintan igual pero con aviso.

- [ ] **D4. `tabindex` rodante y foco inicial en la celda de hoy**
  Cubre: RF-29.
  Todas las celdas con `tabindex="-1"` y una sola con `tabindex="0"`.
  **Hecho cuando:** el mapa es una única parada de tabulación y entrar con Tab deja el foco en la
  celda de hoy.

- [ ] **D5. Eventos de puntero y foco, por delegación**
  Cubre: RF-16, RF-17, RF-18, RF-30, RF-32.
  `pointerover`, `pointerleave` sobre la rejilla, `focusin` y `focusout`. Un solo manejador llama a
  `componerTextoCelda`.
  **Hecho cuando:** pasar el puntero por una celda muestra su texto, al salir se vacía, y al recorrer
  con Tab la línea sigue a la celda con foco.

- [ ] **D6. Evento táctil**
  Cubre: RF-16 en táctil, H3.
  `pointerdown` sobre la rejilla.
  **Hecho cuando:** un toque sobre una celda muestra el detalle correspondiente.

- [ ] **D7. Navegación con flechas, `Home` y `End`**
  Cubre: RF-29, RF-31.
  Llama a `moveFocusCell`, mueve el foco y actualiza el `tabindex` rodante. En los bordes deja el
  foco donde está.
  **Hecho cuando:** las cuatro flechas mueven el foco dentro de la rejilla y en los cuatro bordes el
  foco no se mueve ni salta a otra zona de la página.

- [ ] **D8. Marcar las sesiones inválidas en el historial**
  Cubre: RF-21, H6.
  Añade clase y etiqueta visible "datos no válidos".
  **Hecho cuando:** una sesión inválida aparece en el historial marcada, no se borra del
  almacenamiento y `localStorage` sigue conteniéndola sin modificar.

- [ ] **D9. Coloreado inmediato al registrar una sesión dentro de la ventana**
  Cubre: RF-12, RF-27, RF-28.
  El manejador del formulario vuelve a pintar el mapa con el `today` congelado.
  **Hecho cuando:** registrar una sesión de hoy cambia la celda correspondiente sin recargar, y una
  sesión con fecha fuera de la ventana no aparece en el mapa ni genera aviso.

## Bloque E — Refactor de lo existente y cierre

- [ ] **E1. Refactorizar las métricas de `app.js` para recibir `today` por parámetro**
  Cubre: principio 3 de la constitución, RFN-3, y el alcance de la spec.
  `calculateStreak`, `calculateBestStreak`, `calculateWeeklyTotal` y `calculateMonthlyDays` dejan de
  llamar a `getTodayString()` por su cuenta.
  **Hecho cuando:** `node --test` sigue en verde sin cambiar ninguna aserción de `app.test.js`.

- [ ] **E2. Extraer las funciones puras de `app.js` a un archivo testeable**
  Cubre: principio 4, RFN-4.
  Sin cambiar comportamiento, igual que en E1.
  **Hecho cuando:** los tests de A1 y A2 se ejecutan sin tocar el DOM y sin alterar sus resultados.

- [ ] **E3. Ejecución completa de `node --test`**
  Cubre: principio 4 de la constitución y todos los criterios verificables de la spec.
  **Hecho cuando:** `node --test` está en verde y cubre los once valores límite, los nueve motivos
  de sesión inválida, la forma de la rejilla, el orden de columnas, las tres cadenas de texto, los
  cuatro bordes de navegación y el determinismo.

- [ ] **E4. Comprobaciones manuales de la spec**
  Cubre: RFN-5, RFN-7, RFN-8, RF-29, RF-31, RF-24, H3.
  Lista exacta de la sección *Comprobaciones manuales* de la spec: 375 px sin scroll, los seis
  estados en claro, oscuro y escala de grises, teclado, táctil, zoom al 200 %, almacenamiento
  deshabilitado y consola limpia.
  **Hecho cuando:** cada punto de esa lista está comprobado y anotado, con captura a 375 px y a
  ancho de escritorio.

- [ ] **E5. Revisión de no regresión de lo demás**
  Cubre: alcance de la spec.
  **Hecho cuando:** racha, mejor racha, minutos semanales, días del mes y el formulario se comportan
  exactamente igual que antes de añadir el mapa, comprobado con las mismas sesiones de la prueba
  manual.

- [ ] **E6. Actualizar `AGENTS.md`**
  Cubre: principio 2 de la constitución.
  Documentar la lógica del mapa junto a la existente: ventana de 26 semanas, escala absoluta de seis
  estados, criterio de sesión válida, `heatmap.js` sin DOM y la prohibición de `toISOString`.
  **Hecho cuando:** `AGENTS.md` permite a alguien que no ha visto esta conversación entender la
  lógica del mapa y dónde vive cada cosa.

- [ ] **E7. Actualizar `MEMORY.md`**
  Cubre: continuidad entre sesiones.
  Estado actual a v5, decisiones D1 a D3 de la spec, y el aprendizaje de `toISOString` si sigue
  siendo relevante.
  **Hecho cuando:** `MEMORY.md` está por debajo de 50 líneas y resume el estado sin detalles
  eliminables.