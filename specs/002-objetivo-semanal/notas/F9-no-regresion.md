# F9 — Revisión de no regresión

Tarea F9 de `tasks.md`. Cubre el alcance de la spec 002, RF-30, RFN-12 y la tarea A4.

**Esta tarea no ha modificado código.** Ha comprobado y anotado. El único fichero
escrito es este.

## Qué se compara

Contra la nota `A4-posicion-secciones.md`, que es la línea base. Esa nota dice que el
único cambio estructural previsto en toda la spec es insertar `section.goal-card`
inmediatamente después de `.weekly-card`, y el `<script src="goal.js">` entre
`heatmap.js` y `app.js`. Todo lo demás tenía que quedarse igual.

## Datos de la comprobación

Un conjunto determinista de 7 sesiones: 5 válidas repartidas en varios días y **2
deliberadamente inválidas** (una con fecha inexistente `2025-02-30` y otra con minutos
`"muchos"`), para poder comprobar tanto el camino limpio como el de los avisos.

## Resumen

**12 PASS, 0 FAIL.**

| # | Comprobación | Resultado |
|---|---|---|
| 1 | Orden de las secciones | PASS |
| 2 | Las cuatro tarjetas de métricas | PASS |
| 3 | Formulario de sesiones | PASS |
| 4 | Mapa de calor: estructura y escala de color | PASS |
| 5 | Mapa de calor: línea de detalle | PASS |
| 6 | Mapa de calor: navegación por teclado y bordes | PASS |
| 7 | Mapa de calor: roving tabindex | PASS |
| 8 | Mapa de calor: aviso de datos no válidos | PASS |
| 9 | Historial de sesiones | PASS |
| 10 | Las tres claves de almacenamiento | PASS |
| 11 | Estilos de las secciones existentes | PASS |
| 12 | Orden de carga de los scripts | PASS |

## Detalle punto por punto

### 1. Orden de las secciones — PASS

```
streak-card → best-streak-card → weekly-card → goal-card → monthly-card
→ form-section → heatmap-section → sessions-section
```

Coincide con el orden 1–8 que anticipaba A4. `.goal-card` va en la posición 4,
inmediatamente después de `.weekly-card`, que es lo previsto, y **el orden relativo de
las siete secciones que ya existían no ha cambiado**.

### 2. Las cuatro tarjetas de métricas — PASS

Con el conjunto de datos de arriba:

```
racha: 4        mejor racha: 4        minutos esta semana: 135muchos      días este mes: 2
```

`racha 4` y `mejor racha 4` son correctos: hay una racha de 4 días consecutivos.

**Sobre `"135muchos"`**: no es una regresión. La tarjeta de "minutos esta semana" usa
`calculateWeeklyTotal` de `diary.js` **sin filtrar**, que es exactamente lo que hacía en
la spec 001; las cuatro líneas de `updateUI` que pintan las métricas no se han tocado en
esta spec:

```js
streakValue.textContent   = calculateStreak(sessions, TODAY);
bestStreakValue.textContent = calculateBestStreak(sessions);
weeklyValue.textContent   = calculateWeeklyTotal(sessions, TODAY);
monthlyValue.textContent  = calculateMonthlyDays(sessions, TODAY);
```

Es la divergencia **declarada y aceptada** en la decisión T4/D3 del plan: con datos
corruptos la tarjeta de minutos semanales y el objetivo muestran números distintos, y
el objetivo descarta la sesión inválida en lugar de heredar el `NaN`. Comprobado que el
objetivo, con los mismos datos, sí cuenta solo los válidos.

### 3. Formulario de sesiones — PASS

`#date` con la fecha de hoy por defecto, los tres campos (`#date`, `#topic`,
`#minutes`) presentes, y el botón "Guardar sesión". Igual que en A4.

### 4. Mapa de calor: estructura y escala de color — PASS

- **189 celdas** en **7 filas**, como en A4 (27 columnas × 7 días).
- Todas con `role="gridcell"`.
- Escala medida sobre el conjunto de datos, contra los umbrales de la spec 001:

| Fecha | Minutos | Nivel calculado | Umbral de la spec 001 |
|---|---|---|---|
| 2026-09-23 | 15 | 1 | 1–29 → 1 |
| 2026-09-24 | 90 | 3 | 60–119 → 3 |
| 2026-09-29 | 60 | 3 | 60–119 → 3 |
| 2026-10-01 | 45 | 2 | 30–59 → 2 |
| 2026-10-02 (hoy) | 30 | 2 | 30–59 → 2 |

Los cinco niveles salen correctos. Las 6 muestras de la leyenda siguen presentes.

### 5. Mapa de calor: línea de detalle — PASS

Los tres casos, con eventos `pointerover` reales:

```
celda con actividad:  "martes, 29 de septiembre — 60 min"
celda vacía:          "lunes, 30 de marzo — sin sesiones"
celda futura:         "sábado, 3 de octubre — aún no ha llegado"
pointerleave:         ""   (se limpia)
```

El texto de la celda actual y su `aria-label` salen de la misma función
(`composeCellText`), así que no pueden divergir.

### 6. Mapa de calor: navegación por teclado y bordes — PASS

Índice de celda = `columna * 7 + fila`, así que `ArrowRight` es +7 y `ArrowDown` es +1.
Medido desde una celda central:

```
flecha derecha: 73 → 80   (+7)
flecha izquierda: 80 → 73  (−7)
flecha abajo: 73 → 74      (+1)
flecha arriba: 74 → 73     (−1)
Home: → 0      End: → 188
```

**Parada en los bordes**, que es donde un fallo se escondería mejor: desde la celda del
índice 0 (esquina superior izquierda), `ArrowUp` **no mueve el foco** y se queda en el
índice 0. En el borde derecho tampoco: llegando a la última columna, `ArrowRight` dos
veces seguidas dejó el foco donde estaba.

### 7. Mapa de calor: roving tabindex — PASS

- Exactamente **una** celda con `tabindex="0"` en toda la rejilla.
- Es **la de hoy** (`data-date` = `2026-10-02`).
- Al navegar con flechas, el `tabindex="0"` **se traslada** a la celda enfocada: tras
  varios movimientos quedó en `2026-09-25`, y las demás volvieron a `-1`.

### 8. Mapa de calor: aviso de datos no válidos — PASS

Con las 2 sesiones inválidas, el aviso se muestra y su texto es el de la spec 001:

```
"2 sesiones con datos no válidos no se han incluido en el mapa
 (1 con fecha no válida y 1 con minutos no válidos).
 Siguen guardadas y visibles en el historial."
```

Desglosa correctamente por motivo, y confirma que las sesiones **siguen guardadas**.

### 9. Historial de sesiones — PASS

Las 7 sesiones aparecen, la más reciente primero, con las 2 inválidas marcadas con
`.is-invalid` y su distintivo. El mensaje de vacío está oculto porque hay sesiones. El
tema se renderiza escapado.

### 10. Las tres claves de almacenamiento — PASS

`study-diary-goal`, `study-diary-sessions` y `study-diary-weeks`, tres claves distintas.
El trabajo del objetivo no escribe ni borra la de sesiones: es la comprobación de F7
punto 3, repetida aquí con los mismos datos y **179 bytes idénticos** antes y después de
usar el objetivo.

### 11. Estilos de las secciones existentes — PASS

Estilos calculados de las siete secciones de la spec 001, todos iguales entre sí y sin
alteración: fondo `rgb(255,255,255)`, borde `rgb(231,229,228)`, radio `12px`, sombra
`0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.06)`. `.streak-value` conserva su
`64px` y peso `800`, y `.streak-card` su `padding` de `32px 24px` (las demás, `24px`),
que es la única diferencia que ya existía entre ellas en la spec 001.

Los estilos nuevos de la tarjeta de objetivo **no sefiltran** sobre las secciones
antiguas.

### 12. Orden de carga de los scripts — PASS

```
diary.js → heatmap.js → goal.js → app.js
```

`goal.js` en su sitio, entre `heatmap.js` y `app.js`, como anticipaba A4.

## Nota sobre la posición en pantalla

Como la tarjeta de objetivo se ha insertado en mitad del grupo de métricas, **la
posición vertical de todo lo que va después se ha desplazado**: el formulario, el mapa de
calor y el historial están más abajo que antes. Es lo previsto y lo único aceptable en
una inserción de este tipo; el mapa se ha comprobado por comportamiento y no por
coordenadas de pantalla.

## Fallos de no regresión encontrados

**Ninguno.** Los doce puntos pasan.

Lo único que merece registro, y que **no es una regresión**, es el `"135muchos"` de la
tarjeta de "minutos esta semana" con datos corruptos: es el comportamiento heredado de
la spec 001 y la divergencia que el plan declara de forma expresa en T4/D3. Se anota
para que no se interprete como un defecto nuevo si alguien lo ve con datos inválidos.