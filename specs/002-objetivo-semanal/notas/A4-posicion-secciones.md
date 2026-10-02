# A4 — Posición de las secciones antes de tocar nada

Tarea A4 de `tasks.md`. Cubre el alcance de la spec 002 y RF-30. Es una nota de
observación: **`index.html` no se ha modificado** para cumplir esta tarea. El único
fichero escrito es este.

Estado del repo en el momento de tomar la nota (verificado leyendo `index.html`):

- SHA-256 de `index.html`: `EA7FB995F05CCA4C9F3F225A0E690550629CF36EBB7A4666E24C643D1B78E9FA`
- 90 líneas. Etiqueta `<script>` al final del `<body>`.

## Orden real de las secciones dentro de `<main class="container">`

Orden de arriba abajo, tal y como está hoy en `index.html`:

| # | Selector | Línea de apertura | Contenido anidado |
|---|----------|-------------------|-------------------|
| 1 | `section.streak-card` | 15 | `#streakValue` (línea 16), etiqueta "días seguidos" |
| 2 | `section.best-streak-card` | 20 | `#bestStreakValue` (línea 21), etiqueta "mejor racha" |
| 3 | `section.weekly-card` | 25 | `#weeklyValue` (línea 26), etiqueta "minutos esta semana" |
| 4 | `section.monthly-card` | 30 | `#monthlyValue` (línea 31), etiqueta "días este mes" |
| 5 | `section.form-section` | 35 | `<h2>Nueva sesión</h2>` + `#sessionForm` con `#date`, `#topic`, `#minutes` |
| 6 | `section.heatmap-section` | 54 | `<h2>Actividad reciente</h2>`, `#heatmap` (role="grid"), `#heatmapDetail`, `#heatmapWarning`, leyenda |
| 7 | `section.sessions-section` | 79 | `<h2>Historial</h2>`, `#sessionsList`, `#emptyMessage` |

Antes de la 1 va `<header>` con `<h1>Diario de Estudio</h1>` (líneas 11–13).
Después de la 7 se cierra `</main>` (línea 84).

## Orden de carga de los scripts

`diary.js` (86) → `heatmap.js` (87) → `app.js` (88). **`goal.js` todavía no existe**;
E1 lo insertará entre `heatmap.js` y `app.js`.

## Qué se espera que cambie y qué no (para F9)

Único cambio estructural previsto en toda la spec 002, según la tarea E1: se inserta una
sección nueva `section.goal-card` **inmediatamente después de `.weekly-card`** (es decir,
entre la fila 3 y la fila 4 de esta tabla) y el `<script src="goal.js">` entre
`heatmap.js` y `app.js`.

En F9, el orden esperado será por tanto:

1. `.streak-card`
2. `.best-streak-card`
3. `.weekly-card`
4. `.goal-card`   ← nueva
5. `.monthly-card`
6. `.form-section`
7. `.heatmap-section`
8. `.sessions-section`

Y las secciones 1, 2, 3, 5, 6, 7 y 8 deben conservar su orden relativo y su contenido
actual. Los números de línea de la tabla dejarán de ser válidos por la inserción, por eso
la comparación de F9 debe hacerse por **orden y contenido**, no por línea.

## Cómo comprobarlo en F9

Desde la raíz del repo, en PowerShell:

```powershell
Select-String -Path index.html -Pattern '<section class="([a-z-]+)"' -AllMatches |
  ForEach-Object { "$($_.LineNumber): $($_.Matches[0].Groups[1].Value)" }
```

La salida debe ser el orden de la lista de arriba, más `.goal-card` entre `.weekly-card`
y `.monthly-card`. Cualquier otra diferencia es una regresión de posición (RF-30).
