# AGENTS.md — Diario de Estudio

## Project Overview
Vanilla HTML/CSS/JS web app for tracking study sessions, streaks and a weekly study goal. No build step, no server — runs by opening `index.html` directly.

## Files
- `index.html` — Structure: metric cards, goal card, form, heat map, session list
- `styles.css` — Clean, modern, responsive, dark-mode via `prefers-color-scheme`, `forced-colors` fallbacks
- `diary.js` — **Pure** metrics logic (dates, streaks, weekly/monthly totals). No DOM, no storage. Receives `today` as a parameter.
- `heatmap.js` — **Pure** heat map logic (validation, window, intensity levels, cell text, keyboard navigation). No DOM, no storage. Receives `today` as a parameter.
- `goal.js` — **Pure** weekly-goal logic (parse, validation, week totals, progress, week sealing, history). No DOM, no storage. Receives `today` as a parameter.
- `app.js` — Storage, rendering, DOM events. The only file allowed to touch both.
- `diary.test.js`, `heatmap.test.js`, `goal.test.js` — `node --test`. Pure logic only.

## Layer boundary (constitution principle 3)
Anything that computes a date, a streak, a total, a colour or a progress figure **belongs in `diary.js`, `heatmap.js` or `goal.js`** and must take `today` as a parameter. `app.js` may read `TODAY` from the clock, exactly once, and pass it down. There is a test that fails if a bare `new Date()`, `Date.now()` or `toISOString()` appears in the pure files — keep it green.

## Load order
`diary.js` → `heatmap.js` → `goal.js` → `app.js`, in `index.html` and in the three `require` lines of `goal.test.js`. The order is a contract, not a preference: `goal.js` resolves its dependencies to `diary.js` and `heatmap.js` when it is evaluated, and `app.js` uses all three.

## Naming rule in `goal.js`
`goal.js` resolves its dependencies into a `GOAL_DEPS` object instead of declaring loose identifiers, because in the browser the other two files already expose those names globally and redeclaring any of them would be a `SyntaxError` that kills the whole page. Consequence: **no `const`, `let`, `class` or function in `goal.js` may repeat a name from `diary.js`, `heatmap.js` or `app.js`**. Hence the `GOAL_` prefixes. `GOAL_DEPS` lists its members explicitly, so a new dependency must be added to that list or it will work under `require()` and fail in the browser.

## Key Logic (diary.js)
- **Streak rule**: Consecutive days with ≥1 session ending *today*. If today has no session but yesterday does, streak stays alive (shows 1). Breaks only after a full day with no sessions.
- **Best streak**: Longest run of consecutive days across ALL history. A date continues the run only if it equals `shiftDateString(prev, 1)`. Independent of the current-streak rule.
- **Weekly total**: Sum of minutes in current week (Mon–Sun, local).
- **Monthly days**: Count of unique dates with sessions in current month (1st–last day, local).

## Key Logic (heatmap.js)
- **Window**: 27 columns × 7 rows, always. From the Monday 26 weeks before today's Monday, to the Sunday of today's week. 189 cells, oldest column leftmost, today's in the last column.
- **Cell index**: `column * 7 + row`, where `row` is the weekday (0 = Monday). So `ArrowDown` is `+1` and `ArrowRight` is `+7`.
- **Valid session**: date is an existing calendar date in `AAAA-MM-DD`, and minutes are an integer ≥ 1. Decimals are invalid.
- **Intensity levels** (absolute, never relative to the best day): `0` grey, `1–29` → 1, `30–59` → 2, `60–119` → 3, `120–239` → 4, `240+` → 5.
- **Cell text** is produced by one function (`composeCellText`) shared by the visible detail line and the cell's `aria-label`, so they cannot diverge. Names of weekdays and months are hardcoded tables, not `Intl`, because the spec fixes exact strings and tests assert them.
- **Future dates** get the same colour rule as any other date: their intensity if they have valid sessions, grey otherwise. Only the *text* differs ("aún no ha llegado").
- **Invalid sessions** are never deleted and never hidden: they are excluded from the map, counted in the warning, and shown in the history flagged as "datos no válidos".
- **Roving tabindex**: all cells are `tabindex="-1"` except today's cell at `0`. Arrows move focus; at the borders `moveFocusCell` returns `null` and focus does not move.
- **The detail line has `aria-hidden="true"`** on purpose. The cell's `aria-label` carries the same text, so a screen reader announces it once, not twice.

## Dates (the pure files)
Always local timezone. Never use `toISOString()` for date strings — it converts to UTC and shifts the day in negative-offset timezones. Use `toLocalDateString(date)` / `localDateFromKey(dateKey)`. `localDateFromKey` builds the date at noon so an offset can't move it to the previous or next day.

## Key Logic (goal.js)
- **Goal range**: `GOAL_MIN` 10 and `GOAL_MAX` 10080 (seven full days). One global goal, not one per week or per day.
- **`parseGoalInput(text)`**: trims, then requires `/^\d+$/`, an integer and the range; returns `null` on anything else. Rejects `"600.0"`, `"60,0"`, `"+600"`, `"6e2"`, `"600 min"` and non-occidental digits, because `\d` is ASCII-only. An integer *number* is accepted — it stringifies to what the user would have typed.
- **Goal record**: `{ value, setAt, setAtWeekStart }`. `setAt` is traceability only and **its absence or malformity does not invalidate a record**, because no calculation depends on it. `setAtWeekStart` is the only field the week sealing reads.
- **Valid minutes of a week**: `getValidMinutesForWeek(sessions, weekStart)` = `calculateWeeklyTotal(partitionSessions(sessions).valid, weekStart)`. The filter runs **before** the sum because `calculateWeeklyTotal` sums `s.minutes` blindly and returns `NaN` for non-numeric minutes or subtracts negatives. Consequence, deliberate: with corrupt data the weekly metric card and the goal show different numbers.
- **Progress**: `computeProgress(minutes, goalValue)` → `{ remaining, percent, met }`, or `null` with no goal. `percent` is **truncated**, never rounded (249/600 → 41), and capped at 100. `remaining` is never negative. With no goal there is no object with zeros — `null`, so nothing gets painted as an empty bar.
- **Bar fill and `aria-valuenow`** are the same truncated integer, so the accessible value and the visible fill cannot drift. The fill colour is decorative.
- **Card text** comes from `composeGoalLines(state)` and history lines from `composeWeekEntryLine(entry)` only. `app.js` contains no goal literals. With the goal met, only `status` and `met` exist: no percentage and no remaining line.
- **`selectVisibleHistory(goalRecord, history)`** is the RF-26 visibility rule: no goal → `[]`, otherwise the list untouched. It returns a **new empty array**, not the received reference, because `app.js` empties the DOM with it. This matters: `sealAndPersistWeeks` returning early stopped *sealing* but did nothing to stop *painting* — the title and the list are hidden on an empty result.
- **Week sealing**: `listWeeksToSeal` returns the closed weeks with `weekStart` strictly after `setAtWeekStart`, ascending — the fix week itself is never sealed, nor any earlier one, because the comparison is strict. A backwards clock returns `[]`.
- **`sealWeeks`** returns `{ history, changed }` with the history already normalised, and `changed: false` when nothing was sealed. `app.js` writes when `changed` **or** when the stored list is not the normalised one (compare with `isSameHistory` against the raw stored value, not against the normalised read).
- **`isWeekEntryMet(entry)`** takes only the entry and judges it against its own `met`. That signature makes the rule structural: there is no second argument to pass the current goal through. Each sealed week stays intelligible on its own.
- **Normalisation**: `normalizeHistory` drops what it cannot interpret, sorts newest-first, keeps the first entry per `weekStart` (ties on the same week broken by higher `minutes`, so the stored order never matters), and cuts to `HISTORY_LIMIT` (12).
- **`setAt` never invalidates; `weekStart` does.** `isValidGoalRecord` requires an integer `value` in range and a real `setAtWeekStart` date, and ignores `setAt` entirely.

## Storage
- Key `study-diary-sessions` — array of `{id, date: "YYYY-MM-DD", topic, minutes}`
- Key `study-diary-goal` — object `{ value, setAt, setAtWeekStart }`, written only via `buildGoalRecord`
- Key `study-diary-weeks` — array of `{ weekStart, minutes, met }`, always stored normalised
- The three keys are independent. **The goal code never writes or deletes `study-diary-sessions`** — it only reads it, in memory, to total minutes. `saveSessions` is the only function naming `STORAGE_KEY`, and `removeItem` is not used anywhere.
- Every read and write is wrapped in `try/catch`. On failure the app renders what it can and sets `storageAvailable = false`, which suppresses the invalid-data warning (no storage means no warning to give).
- **A read failure and corrupt data are different.** Unreadable storage means no warning at all; a key that exists but does not hold a valid goal record means the RF-38 warning. `readJsonKey` distinguishes them with `estado: 'ok' | 'vacio' | 'formato'`.
- Sessions rendered newest-first; same day = last added first.
- Startup order is fixed: read the goal, validate, read the history, seal in memory, write once if needed, then paint. Sealing before painting is what makes a sealed week visible in the same load.

## How to Test
1. Open `index.html` in browser (double-click works)
2. Add sessions for today → streak = 1
3. Add session for yesterday → streak = 2
4. Reload → data persists
5. Set a weekly goal in the goal card → the form disappears and a progress bar appears
6. Add a session this week → the bar moves without reloading

## Commands
- Tests: `node --test`
- Single file: `node --test heatmap.test.js`
- Single test: `node --test goal.test.js --test-name-pattern="parseGoalInput"`

## Editing files
Write file content with the file-editing tools, never with `Out-File`, `Set-Content`, `Add-Content`, shell redirection or a Node script that writes. Those read and write as ANSI on Windows and silently corrupt UTF-8, which destroyed `goal.test.js` once — accents became mojibake, then `?` — and forced a full rebuild. The shell is for running `node --test` and for reading.

## Rules
- Read `docs/constitution.md` and the active spec (`specs/NNN-*/`) before modifying any code.

## Conventions
- Spanish UI text, Spanish docs, English identifiers
- No frameworks, libraries, or compilation. Tests use only `node:test` and `node:assert/strict`.
- Pure logic files must stay loadable both by `<script>` and by `require()`, hence the `if (typeof module !== "undefined")` export guard. Do not switch to ES modules: they break `file://`.