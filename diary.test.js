const test = require('node:test');
const assert = require('node:assert/strict');

const {
  shiftDateString,
  getWeekRange,
  getMonthRange,
  calculateStreak,
  calculateBestStreak,
  calculateWeeklyTotal,
  calculateMonthlyDays
} = require('./diary.js');

// 2026-10-02 es viernes. Todas las fechas son literales: ningún test usa el reloj.
const TODAY = '2026-10-02';
const THURSDAY = '2026-10-01';
const WEDNESDAY = '2026-09-30';
const TUESDAY = '2026-09-29';

const session = (date, minutes = 30, id = 1) => ({ id, date, topic: 'Tema', minutes });

test('getWeekRange devuelve de lunes a domingo', () => {
  assert.deepEqual(getWeekRange(TODAY), { start: '2026-09-28', end: '2026-10-04' });
});

test('getWeekRange en domingo devuelve la semana que empieza ese lunes', () => {
  assert.deepEqual(getWeekRange('2026-10-04'), { start: '2026-09-28', end: '2026-10-04' });
});

test('getWeekRange en lunes devuelve esa misma semana', () => {
  assert.deepEqual(getWeekRange('2026-09-28'), { start: '2026-09-28', end: '2026-10-04' });
});

test('getMonthRange devuelve el mes natural completo', () => {
  assert.deepEqual(getMonthRange(TODAY), { start: '2026-10-01', end: '2026-10-31' });
});

test('getMonthRange en diciembre cruza el año', () => {
  assert.deepEqual(getMonthRange('2026-12-15'), { start: '2026-12-01', end: '2026-12-31' });
});

test('shiftDateString suma y resta días cruzando meses', () => {
  assert.equal(shiftDateString('2026-09-30', 1), '2026-10-01');
  assert.equal(shiftDateString('2026-10-01', -1), '2026-09-30');
});

test('calculateStreak con hoy, ayer y anteayer da 3', () => {
  const sessions = [session(TODAY, 45), session(THURSDAY, 30), session(WEDNESDAY, 60)];
  assert.equal(calculateStreak(sessions, TODAY), 3);
});

test('calculateStreak con hoy y ayer da 2', () => {
  assert.equal(calculateStreak([session(TODAY), session(THURSDAY)], TODAY), 2);
});

test('calculateStreak sin sesión hoy pero con ayer sigue viva con 1', () => {
  assert.equal(calculateStreak([session(THURSDAY)], TODAY), 1);
});

test('calculateStreak sin sesión hoy ni ayer vale 0', () => {
  assert.equal(calculateStreak([session(WEDNESDAY)], TODAY), 0);
});

test('calculateStreak con lista vacía vale 0', () => {
  assert.equal(calculateStreak([], TODAY), 0);
});

test('calculateStreak cuenta varias sesiones del mismo día como un solo día', () => {
  const sessions = [session(TODAY, 45, 1), session(TODAY, 30, 2), session(THURSDAY, 20, 3)];
  assert.equal(calculateStreak(sessions, TODAY), 2);
});

test('calculateBestStreak con racha actual de 3 da 3', () => {
  const sessions = [session(TODAY), session(THURSDAY), session(WEDNESDAY)];
  assert.equal(calculateBestStreak(sessions), 3);
});

test('calculateBestStreak recuerda un histórico de 5 con racha actual de 2', () => {
  const sessions = [
    session('2026-09-12'),
    session('2026-09-13'),
    session('2026-09-14'),
    session('2026-09-15'),
    session('2026-09-16'),
    session(THURSDAY),
    session(TODAY)
  ];
  assert.equal(calculateBestStreak(sessions), 5);
  assert.equal(calculateStreak(sessions, TODAY), 2);
});

test('calculateBestStreak con días sueltos vale 1', () => {
  const sessions = [session('2026-09-22'), session('2026-09-27'), session(TODAY)];
  assert.equal(calculateBestStreak(sessions), 1);
});

test('calculateBestStreak con una sola sesión vale 1', () => {
  assert.equal(calculateBestStreak([session(TODAY)]), 1);
});

test('calculateBestStreak con lista vacía vale 0', () => {
  assert.equal(calculateBestStreak([]), 0);
});

test('calculateBestStreak cuenta una racha rota en el pasado', () => {
  const sessions = [
    session('2026-09-26'),
    session('2026-09-27'),
    session('2026-09-28'),
    session('2026-09-29'),
    session(TODAY)
  ];
  assert.equal(calculateBestStreak(sessions), 4);
  assert.equal(calculateStreak(sessions, TODAY), 1);
});

test('calculateWeeklyTotal suma los minutos de la semana actual', () => {
  const sessions = [session(TODAY, 45), session(THURSDAY, 30), session(WEDNESDAY, 60)];
  assert.equal(calculateWeeklyTotal(sessions, TODAY), 135);
});

test('calculateWeeklyTotal excluye lo que cae fuera de la semana', () => {
  const sessions = [session(TODAY, 45), session('2026-09-27', 999)];
  assert.equal(calculateWeeklyTotal(sessions, TODAY), 45);
});

test('calculateMonthlyDays cuenta solo los días de octubre', () => {
  const sessions = [session(TODAY), session(THURSDAY), session(WEDNESDAY)];
  assert.equal(calculateMonthlyDays(sessions, TODAY), 2);
});

test('calculateMonthlyDays cuenta dos sesiones del mismo día como un solo día', () => {
  const sessions = [session(TODAY, 10, 1), session(TODAY, 20, 2)];
  assert.equal(calculateMonthlyDays(sessions, TODAY), 1);
});

test('calculateMonthlyDays con lista vacía vale 0', () => {
  assert.equal(calculateMonthlyDays([], TODAY), 0);
});