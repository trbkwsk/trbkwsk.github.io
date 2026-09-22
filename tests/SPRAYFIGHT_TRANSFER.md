# SprayFight: area, layers, DripMap — 2026-09-23

Baseline: `e6b884a`. Working branch: `codex/sprayfight-area-layers-drips`.
The tree was clean before this change. Existing touch input, roam mode, WALLS,
walk/run constants and animation code are retained; no prototype overwrite.

## Verified evidence

Read the complete `~/GettingUp-ReverseEngineering/CODEX_HANDOFF.md` and all seven
parts / 1158 lines of `GETTING_UP_SYSTEMS_ANALYSIS_RU.md` before implementation.
Ran the three commands from handoff section 2 against the local game data:

```
разобрано 4317, не удалось 3
суммы весов: {255} вершин: 2123
совпало 47 из 47
```

The third command confirms membership in the set of mesh file sizes. On its own
it does not prove that each match is the same-named mesh or explain the bank blocks.

Read `game-data/USA/engine/GameInfo/TagAreas.xml` directly:
- line 12: `UndersprayEndPercent=.5`, `FillEndPercent=.85`;
- line 29: all three `TimePerQuad` values are 4.5 (under `Scoring`);
- lines 44–53: aerosol trigger 1 second, spot 2→12, streak width 8,
  length 25, time 3 seconds;
- `DripMap` elements contain authored pixel positions per grid size.

## Explicit SprayFight design decisions (not proven original runtime behavior)

- The requested battle deadline is columns × rows × 4.5 seconds. Both current
  walls explicitly use 4×2 quads, regardless of their physical metre dimensions.
  Countdown is excluded; free roam has no deadline. The original XML places this
  value under scoring; its exact original fail/bonus behavior was not established.
- Three independent paint masks. Sketch and outline use an outline derived from
  the existing TORB artwork; fill uses the existing final artwork. Stage thresholds
  are 50%, 85%, 85% of the current target, respectively. Aggregate progress maps
  these passes to 0–50, 50–85, 85–100. Completing a pass finishes its remaining
  pixels and starts a blank next mask; paint from earlier passes is not reused.
  The exact interpretation of those XML thresholds was not reverse engineered.
- Sketch opacity is .4; outline is full opacity. The unpainted guide is .16.
- DripMap has 24 original normalized coordinates for our 4×2 panels, selected
  within 110 texture pixels of the cursor. Unknown sizes get no drip map rather
  than an invented copied layout. Other grid sizes still calculate time correctly.
- A continuous one-second dwell within 12 texture pixels triggers an unused point.
  Release or moving outside that radius resets dwell. Each point can drip once per
  wall/reset. Spot growth takes .35 seconds, followed by the verified 3-second
  streak duration. Sizes are interpreted in our 1024×390 texture pixels.
- Each wall has its own original drip palette. Drips render in a separate canvas,
  never increase completion coverage, and finish animating after release/step-back.
- Existing quality/score formula remains; the original bonus system is not part
  of these first three priorities. Its existing remaining-time bonus now uses
  the fraction of the configured budget instead of the old fixed 90-second scale.

## Hypotheses not used

BAN 32-byte block meaning, BNM second-channel meaning and quaternion packing,
SLP numeric properties and PGP emitter parameters. Older parts of the analysis
contain superseded claims about MSH vertices; later verified float/strip findings
take precedence. No further binary-format inference was needed for this change.

## Validation

`node tests/sprayfight-rules.mjs` checks budgets, phase boundaries, deterministic
drips, dwell reset/slow movement, and spot/streak timing.

Serve the repository over HTTP and open `tests/sprayfight-browser.html`, then
Run checks. This exercises real Canvas masks, isolated wall progress, reset,
drip animation/coverage separation, real battle countdown and touch DOM presence.
It includes three layer previews. It is a developer test, not a game entry point.

Executed both tests successfully. Browser result: ALL CHECKS PASSED, including
actual Canvas stage transitions, independent wall completion, drip finishing
after release, reset and countdown exclusion. Viewed all three layer previews.
Compared touch setup from its marker through `window.SF`: byte-identical to
`e6b884a`; WALK_SPEED=1.61 and RUN_SPEED=4.6 retained. Physical-device touch play
and full-round difficulty balancing have not been tested in this pass.

No extracted game asset, converter output, game texture or model was added.
No production push or deployment is part of this change.
