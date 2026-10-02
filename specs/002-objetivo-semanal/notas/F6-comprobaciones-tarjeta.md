# F6 — Comprobaciones manuales de la tarjeta de objetivo

Tarea F6 de `tasks.md`. Cubre RF-1, RF-16, RF-17, RF-22, RF-27, RF-28, RF-29, RF-31,
RF-32, RF-33, RF-34 y RFN-8.

**Esta tarea no ha modificado código.** Ha comprobado y anotado. El único fichero
escrito es este.

## Cómo se comprobó

Con las herramientas de navegador sobre `index.html` abierto con doble clic
(`file://`), que es el escenario de RFN-1 y R10. Los escenarios se construyeron
manipulando `localStorage` desde la consola y recargando, y el flujo de usuario se
condujo con los formularios reales mediante `requestSubmit()`, sin escribir código de
aplicación. Al terminar se dejó `localStorage` vacío.

Contraste medido con la fórmula de WCAG sobre los colores calculados, no a ojo. Los
elementos se inspeccionaron con `getComputedStyle` y con el árbol de accesibilidad.

## Resumen

13 PASS, 1 PASS PARCIAL. **Ningún FAIL.** Más la comprobación 15, añadida tras la
corrección de @reviewer: PASS.

| # | Comprobación | Resultado |
|---|---|---|
| 1 | Flujo principal | PASS |
| 2 | Posición de la tarjeta e historial dentro | PASS |
| 3 | Lector de pantalla | PASS |
| 4 | 375 px sin desplazamiento horizontal | PASS |
| 5 | Legible en claro, oscuro y escala de grises | PASS PARCIAL |
| 6 | Consola sin errores | PASS |
| 7 | La meta sobrevive a recargar y reabrir | PASS |
| 8 | El objetivo solo aparece en su tarjeta | PASS |
| 9 | Sin objetivo la app sigue registrando sesiones | PASS |
| 10 | Literales de RF-28 y RF-34 | PASS |
| 11 | El historial sale en la misma carga en que se sella | PASS |
| 12 | Abrir el lunes sella la anterior y la nueva en cero | PASS (por equivalencia) |
| 13 | La semana de la meta no aparece; la siguiente sí | PASS |
| 14 | Borrar los datos devuelve al estado sin objetivo | PASS |
| 15 | Sin meta no se muestra historial (RF-26, corrección) | PASS tras la corrección |

## Detalle punto por punto

### 1. Flujo principal — PASS

Estado inicial `"Objetivo semanal: sin fijar"` con el formulario visible. Al enviar
`600` y con una sesión de 150 minutos en el día de hoy:

```
tras fijar meta:  "Objetivo semanal: 600 min"   formulario oculto   barra 0
tras registrar:   "Esta semana: 150 de 600 min (25%)"
                  "Quedan 450 min"   aria-valuenow="25"   relleno 25%
```

El progreso se movió sin recargar la página.

### 2. Posición de la tarjeta e historial dentro — PASS

Orden real de las secciones dentro de `main.container`:

```
streak-card → best-streak-card → weekly-card → goal-card → monthly-card
→ form-section → heatmap-section → sessions-section
```

`.goal-card` va inmediatamente después de `.weekly-card`, que es lo que fija RF-30 y
lo que anticipaba la nota de A4. `#goalHistoryList` y el `h3.goal-history-title`
("Semanas anteriores") están **dentro** de `.goal-card`, como pide RF-31.

### 3. Lector de pantalla — PASS

Árbol de accesibilidad:

```
heading "Objetivo semanal" level="2"
  StaticText "Objetivo semanal: 600 min"
StaticText "Esta semana: 150 de 600 min (25%)"
StaticText "Quedan 450 min"
heading "Semanas anteriores" level="3"
```

- **Barra**: `role="progressbar"` con `aria-valuemin="0"`, `aria-valuemax="100"`,
  `aria-valuenow="25"` y `aria-valuetext="150 de 600 min"` (total real y meta).
- **Mensaje de error**: `role="alert"`, y el campo lleva `aria-describedby="goalError"`
  apuntando a ese id. Al escribir un formato inválido el mensaje pasa de oculto a
  visible con el texto `"La meta debe ser un número entero entre 10 y 10080."`, de modo
  que se anuncia sin necesidad de otra región viva (RFN-8).
- **Línea de estado**: `aria-live="polite"`.

El `role="progressbar"` no aparece en el volcado textual del árbol pero sí está en el
DOM y con sus cuatro atributos; se comprobó directamente sobre el elemento.

### 4. 375 px sin desplazamiento horizontal — PASS

Con emulación de `375x720`:

```
scrollWidth 375 = clientWidth 375    → sin scroll horizontal
elementos que desbordan el ancho: ninguno
ancho de la tarjeta: 343 px
```

### 5. Legible en claro, oscuro y escala de grises — PASS PARCIAL

Contraste calculado sobre una tarjeta con barra al 60 %:

| Elemento | Claro | Oscuro |
|---|---|---|
| Línea de estado | 17.49 | 14.52 |
| Línea de progreso | 17.49 | 14.52 |
| Texto del historial | 4.80 | 6.01 |
| Cifras del historial | 17.49 | 14.52 |
| Título del historial | 4.80 | 6.01 |
| Relleno sobre la pista | 6.54 | 10.04 |

Todos por encima del mínimo AA de 4.5:1.

**Escala de grises**: se aplicó `filter: grayscale(1)` a la página. La barra sigue
visible con su relleno al 60 %, el relleno sigue distinguiéndose de la pista y el texto
—"Esta semana: 360 de 600 min (60%)", "Quedan 240 min" y la línea del historial— se
sigue leyendo. Es decir, **el progreso no depende del color**: el relleno y las cifras
lo transmiten por longitud y por texto.

**PARCIAL — lo que no se pudo comprobar**: la media `forced-colors: active`
(alto contraste del sistema) **no se ha verificado en el navegador**. Las herramientas
de las que dispongo no permiten activarla; solo se llega a comprobar que la regla
existe en el fichero. Es el único punto de la lista que queda pendiente de una
comprobación manual real en un sistema con alto contraste activado, y conviene
hacerlo antes de dar la spec por cerrada.

Lo que sí se puede afirmar del código: `styles.css` tiene un bloque
`@media (forced-colors: active)` que da a `.goal-bar` un borde `1px solid CanvasText` y
a `.goal-bar-fill` un `background: Highlight` con `forced-color-adjust: none`. Con eso
la pista muestra dónde acaba el recorrido y el relleno conserva su color aunque el
sistema lo imponga.

### 6. Consola sin errores — PASS

Sin un solo mensaje en todos los escenarios: arranque limpio, flujo principal, error de
formato, meta guardada, recarga y borrado de datos. La consola se comprobó después de
cada interacción, no solo al cargar.

### 7. La meta sobrevive a recargar y a reabrir el navegador — PASS

Tras recargar con la caché invalidada, la meta, la barra al 60 % y las 4 líneas del
historial siguen ahí.

Para simular **reabrir el navegador** se abrió la página en una pestaña nueva, que
crea un documento nuevo sin estado en memoria. Allí se recoveringó todo:
`"Objetivo semanal: 600 min"`, `aria-valuenow="60"`, 4 entradas de historial y el
registro guardado `{value:600, setAt, setAtWeekStart}`.

*Nota*: esa segunda pestaña muestra un error propio de Chrome
(`file:` URLs are treated as unique security origins) al pedir la URL local. Es una
restricción de seguridad del navegador al abrir dos pestañas `file://`, **no un error de
la aplicación**: la página original no muestra ningún error.

### 8. El objetivo solo aparece en su tarjeta — PASS

Buscando elementos con id `goal*` en el resto de la interfaz:

```
weekly-card: 0    streak/best-streak/monthly-card: 0
heatmap-section: 0    sessions-section: 0
```

Los once ids `goal*` de la página están todos dentro de `.goal-card`. No hay objetivo
en la tarjeta de minutos semanales, ni en el mapa de calor, ni en las métricas.

### 9. Sin objetivo la app sigue registrando sesiones — PASS

Con el almacenamiento sin meta, se registró una sesión de 60 minutos:

```
estado:  "Objetivo semanal: sin fijar"   formulario visible   barra oculta
racha 1, minutos de la semana 60, días del mes 1
historial de sesiones: 1 fila    mapa de calor: 1 celda con actividad
meta creada: null   aviso: oculto
```

La aplicación funciona con normalidad y **no crea ninguna meta por su cuenta**.

### 10. Literales de RF-28 y RF-34 — PASS

Los seis literales de la tabla de RF-28, comparados carácter a carácter:

| Situación | Texto obtenido | Coincide |
|---|---|---|
| Sin meta | `Objetivo semanal: sin fijar` | sí |
| Con meta | `Objetivo semanal: 600 min` | sí |
| Pendiente | `Esta semana: 240 de 600 min (40%)` | sí |
| Restantes | `Quedan 360 min` | sí |
| Cumplida | `¡Objetivo cumplido! 650 de 600 min` | sí |

Con el objetivo cumplido, las claves que devuelve el compositor son solo `met`, `status`
y `valueText`: **no hay `progress` ni `remaining`**, que es lo que exigen RF-29 y RF-32.

Cuatro literales de RF-34, también carácter a carácter:

```
lunes, 29 de septiembre de 2025 — 650 de 600 min — cumplida
lunes, 29 de septiembre de 2025 — 450 de 600 min — pendiente
lunes, 5 de enero de 2026 — 1200 de 1500 min — pendiente
lunes, 29 de diciembre de 2025 — 20000 de 10080 min — cumplida
```

Los cuatro coinciden. `1200` y `20000` van **sin punto ni separador de millares**, y el
guion largo es el correcto.

### 11. El historial sale en la misma carga en que se sella — PASS

Con dos semanas cerradas pendientes de sellar, **una sola recarga**:

```
en pantalla:  21 sept → 200 min · 14 sept → 300 min · 7 sept → 0 · 31 ago → 0
guardado:     2026-09-21:200  2026-09-14:300  2026-09-07:0  2026-08-31:0
```

Lo pintado y lo guardado son la misma lista, sin esperar una segunda carga (RF-22).

### 12. Abrir el lunes sella la anterior y deja la nueva en cero — PASS (por equivalencia)

**No se puede abrir en un lunes sin cambiar el reloj del sistema**, y esa comprobación no
depende de las herramientas. Se comprobó la relación equivalente, que es la que fija
RF-45:

Hoy es viernes 2026-10-02, dentro de la semana que empieza el 2026-09-28.

```
semana en curso (2026-09-28):  NO está en el historial     ← no se sella
semana anterior (2026-09-21):  SÍ está en el historial     ← se sella
progreso de la semana en curso: "Esta semana: 0 de 600 min (0%)"  barra 0
```

Es exactamente la situación de RF-45: la semana anterior queda anotada con lo que
tenía y la nueva empieza en cero. El sellado es semanal, así que el día concreto dentro
de la semana no cambia el resultado. Queda pendiente confirmar el caso literal de un
lunes cuando se pueda fijar la fecha del sistema.

### 13. La semana de la meta no aparece; la siguiente sí — PASS

Meta fijada en la semana del **2026-08-24**, hoy en la del 2026-09-28:

```
¿2026-08-24 (semana de la meta) en el historial?  NO
¿2026-09-21 (semana siguiente) en el historial?    SÍ
```

El historial empieza donde empieza el compromiso, y la semana de la fijación queda
fuera porque no había objetivo cuando empieza (D5).

### 14. Borrar los datos devuelve al estado sin objetivo — PASS

Tras `localStorage.clear()` y recargar:

```
claves: ninguna
estado: "Objetivo semanal: sin fijar"
formulario visible, barra oculta, historial oculto
aviso oculto, mensaje de error oculto
mapa de calor: 189 celdas
orden de secciones: el de A4
```

Vuelve exactamente al estado inicial, **sin aviso de meta corrupta**: sin datos no hay
nada que juzgar.

## Fallos encontrados

**Ninguno.** No se ha encontrado ningún fallo en los catorce puntos.

## Corrección de @reviewer — RF-26: historial guardado sin meta

Defecto encontrado por @reviewer **después** de esta nota, y reproducido aquí antes de
tocarlo. Se añade como comprobación 15.

### 15. Sin meta no se muestra historial — PASS tras la corrección

**Qué fallaba.** RF-26 dice, sin ambigüedad: "SI no existe meta semanal, ENTONCES EL
SISTEMA no sella ninguna semana **y no muestra historial**". Solo se cumplía la primera
mitad. `sealAndPersistWeeks` sale temprano sin meta, así que no sellaba; pero `weeks` se
carga en `initGoal` con independencia de que haya meta, y `paintGoalHistory` solo decida
por `weeks.length === 0`. Con semanas ya guardadas y sin meta, la lista se pintaba
entera.

Pasó desapercibida durante toda la spec porque el historial guardado **solo existe si
hubo una meta antes**: en el recorrido normal siempre hay meta y siempre hay lista. El
caso roto necesita una meta que desaparece, y eso no lo produce el flujo de usuario.

**Reproducción, antes de corregir.** Con las dos semanas guardadas
(`2026-09-14` con 700 min y `2026-09-21` con 200, ambas `met: 600`):

```
caso A — historial guardado, SIN study-diary-goal:
  estado ................. "Objetivo semanal: sin fijar"
  formulario ............. visible
  elementos en el historial ... 2        ← INCUMPLIMIENTO
  título "Semanas anteriores"  visible   ← INCUMPLIMIENTO

caso B — historial guardado, meta CORRUPTA (RF-38):
  aviso ................. "El objetivo guardado no era válido y se ha descartado. …"
  estado ................. "Objetivo semanal: sin fijar"
  formulario ............. visible
  elementos en el historial ... 2        ← INCUMPLIMIENTO
  título "Semanas anteriores"  visible   ← INCUMPLIMIENTO
```

Un detalle al reproducirlo: `met` es **el valor de la meta**, no un booleano. Plantar
`met: true` no reproduce nada, porque `normalizeHistory` descarta la entrada por `met`
fuera de rango y la lista sale vacía — el fallo se esconde detrás de datos malos. Con
`met: 600` aparecen los dos casos tal y como los reportó @reviewer.

**Qué se ha cambiado.** La regla "¿hay historial que mostrar?" es ahora una decisión de
`goal.js` (`selectVisibleHistory`), no de `app.js`, y por tanto la cubre `node --test`
con 11 tests nuevos. `paintGoalHistory` pinta lo que esa función devuelva y **oculta
también el `<h3>`** cuando no hay nada, que antes se quedaba siempre visible.

**Verificación, los cuatro escenarios, después de corregir:**

| Escenario | estado | formulario | título `h3` | elementos |
|---|---|---|---|---|
| 1. historial + **sin meta** | "sin fijar" | visible | **oculto** | **0** |
| 2. historial + **meta corrupta** | "sin fijar" | visible | **oculto** | **0** |
| 3. historial + **meta válida** | "Objetivo semanal: 600 min" | oculto | visible | 2 |
| 4. **sin** meta y **sin** historial | "sin fijar" | visible | oculto | 0 |

El escenario 2 arrastra el mismo comportamiento que el 1 porque una meta inválida deja a
la aplicación en el estado sin objetivo: `goalRecord` vale `null` en los dos casos. Se
comprobó, no se asumió.

**El escenario 3 no se ha roto.** Es el que más comprobaciones lleva, porque es el caso
normal y el que no debía tocar:

```
meta válida (600) + 2 semanas guardadas:
  elementos en pantalla ..... 2        lista visible
  estado .................... "Objetivo semanal: 600 min"
  barra ..................... visible, aria-valuenow="16"
  primera línea ............. "lunes, 21 de septiembre de 2026 — 200 de 600 min — pendiente"

sellado intacto (meta fijada en agosto, hoy en octubre):
  elementos en pantalla ..... 7        las semanas intermedias se sellan y se ven

corte a 12 intacto (15 semanas guardadas de golpe):
  plantadas ................. 15
  en pantalla ............... 12
  guardadas ................. 12        y el almacenamiento, no solo la vista
  primera ................... 2026-09-21     más reciente
  última .................... 2026-07-06     la 12.ª
```

## Pendiente de una comprobación que no depende de las herramientas

1. **`forced-colors: active` (punto 5)**: la media no se puede emular con las
   herramientas de navegador de las que se dispone. El bloque de la regla existe y es
   coherente con el del mapa de calor, pero conviene confirmarlo en un sistema con alto
   contraste activo antes de cerrar la spec.
2. **Lunes literal (punto 12)**: la relación de RF-45 está comprobada por equivalencia;
   el caso de abrir en un lunes exacto requiere cambiar la fecha del sistema.