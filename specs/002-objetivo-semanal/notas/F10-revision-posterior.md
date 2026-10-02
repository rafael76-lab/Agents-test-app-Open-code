# F10 — Revisión posterior no bloqueante

Tarea F10 de `tasks.md`. No bloquea la entrega.

## Estado: PENDIENTE, no simulada

Esta revisión **no está hecha**, y no se ha simulado ni se ha dado por buena.

Motivo: la spec 002 es nueva. `goal.js`, `app.js` y las dos claves nuevas se han escrito
en esta misma ronda de trabajo, así que **no hay 12 semanas de uso real** que revisar.
Cualquier dato que se inventara para rellenar la casilla falsearía precisamente lo que
la revisión tiene que medir.

## Qué se miraría cuando haya historial real

El corte a 12 entradas viene de `HISTORY_LIMIT` en `goal.js` y de RF-24: la tarjeta
muestra las 12 semanas más recientes. La pregunta es si 12 son suficientes.

### 1. Si el usuario consulta semanas anteriores a las 12 últimas

La señal sería directa: sessions registradas **retroactivamente** con fecha de más de 12
semanas, o consultas repetidas al mismo historial antiguo. Si el usuario rellena a menudo
historial viejo, significa que el corte le está quitando algo que consulta.

Cómo se mediría, cuando haya datos: contar sesiones con fecha anterior a la semana número
12 del historial.

### 2. Qué proporción de las semanas del usuario tienen contenido

El riesgo real del corte no es que falten semanas, sino que **falten semanas con
actividad**. Una semana sellada con 0 minutos es "pendiente" y aporta poco; lo que
informa es cuántas de las semanas que se sellan tienen minutos de verdad.

Cómo se mediría: de las 12 entradas que se conservan, cuántas tienen `minutes > 0`. Si
la mayoría son 0, el límite de 12 está MAL puesto y se podría subir; si casi todas
tienen actividad, el límite está bien puesto y es el contenido el que hay que mirar.

### 3. Si el sellado llega a acumular más de 12 en el almacenamiento

Un caso límite que conviene mirar cuando haya uso denso: con muchas semanas
transcurridas de golpe, `sealWeeks` genera todas las intermedias y `normalizeHistory`
poda a 12. Si eso pasa a ser un patrón —usuario que vuelve tras meses de absence—,
merece la pena comprobar si el usuario echa de menos el historial intermedio.

### 4. Contraste con el resto de la aplicación

El mapa de calor muestra 26 semanas y no tiene recorte. Si el usuario nunca ha
preguntado más allá de 26 semanas, es un indicio de que 12 semanas de historial es un
corte cómodo de vivir.

## Cómo se cerraría la revisión

Repitiendo el punto 2 de F7 pero en lugar de 15 semanas escritas a mano: con historial
real acumulado, comprobando sobre el estado real del navegador si las 12 entradas
conservadas cubren lo que el usuario consulta, y anotando el resultado aquí con las
cifras. Se puede añadir en cualquier momento sin tocar código, porque
`HISTORY_LIMIT` es una constante y `normalizeHistory` ya está probado con cortes.

## Decisión

**Se mantiene el límite en 12.** Es lo que fija RF-24 y la decisión del plan. La revisión
es posterior y no bloquea, y sin datos reales cualquier ajuste sería especulativo.