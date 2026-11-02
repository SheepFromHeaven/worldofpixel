# UI requests to the sim

Short bullets: what, why, the shape wanted. The UI session carries on with what exists.

## Audit

Method: ran the game in settle mode (headless Chrome, 1300 x 900), looked at title, create world, first frame, a selected person, the radial menu, and read `ShellPanels.tsx`, `personView.ts`, `radialSlices.ts`, `radialMenu.ts`, `shell.css`. The loop being judged: two people survive the first winter, are fed and sheltered, a third is born.

### A. The player cannot see the loop

1. First frame shows no people state at all. Needs (cold, hunger, thirst, tiredness) exist only in `PersonSheet`, only for one selected person, only after a click. The second person is invisible to the HUD. No roster, no portraits, no meters on the map.
2. Danger is legible only at the point of death. Gauges turn red at 0.7, the critical thought at the sim's own threshold, the over-head `!` only in normal view. Nothing escalates before that: no amber stage, no pulse, no "will starve in N hours", no off-screen indicator when the camera is not on the person.
3. No goal, no next action. The only achievement is `fire`. The radial menu at the start offers a single slice, `Inspect Ground`. Nothing says "find flint", "build a fire before night", "you are in winter". The mind panel is the only guidance and it is abstract.
4. No survival frame: no day count, no winter progress, no air temperature, no fire fuel on the map, no shelter status, no population number, no "third person born" state, no death or game-over surface at all (nothing in `src/ui` handles a person dying).
5. Time is shown as "10:10 here, winter, full moon" wrapped over three lines in the strip. Days survived and the season's progress are absent.

### B. Visual hierarchy

6. Developer controls outrank the game. Seed box with open and roll, menu, the copy-view target, the `cut` depth panel, `clear / tread / bolt / uproot` tools, `sky`, `map`, the fps counter all sit at the same weight as the pause button. The brain, the one real player verb, is a small tile.
7. Everything is one green board with one tan tile. Nothing is primary. Six boards fill the top edge; the seed form overlaps the strip panel (visible at x 285 to 350).
8. Red means three things: active tile (play, music on, selected speed), warning (`se-meter-warn`), and the brain's glow. A red play button reads as danger.
9. Bar semantics are inverted. Heat and stamina bars are good when full, hunger, thirst and tired are bad when full, same colour and same shape.
10. The person sheet is a debug dump: `pace 0.0 m/s`, `at 1088, 769`, `doing` wraps its value ("searching the ground" over three lines) and pushes the gauges down. Hand-held item is a word, not a thumbnail, though `ItemThumb` exists.
11. The sheet covers 300 px of the map at a hard-coded `top: 144px`, under the time controls, and moves again when the tile sheet opens.

### C. Text where a picture would do

12. Every tool, tile and state is a word: clear, tread, bolt, uproot, sky, map, open, roll, menu, close, up, down, sea. Icons exist for pause, play, fast, brain, target, pipes.
13. Needs are words ("peckish", "drowsy") with a bar; no icons for hunger, thirst, cold, tired, so nothing can be read at a glance or from across the screen.
14. Radial slices are text labels only. `Erect`, `Orders`, `Chop Wood` have no pictogram, the material cost is a sentence, never item thumbnails.
15. Thoughts are text lines at the bottom of the sheet, the critical one differs only by colour.
16. The structure sheet's gauge and needs use item thumbs, good, but a plan on the map shows no missing-materials icons.

### D. Dead ends and deadlocks

17. Greyed radial slices explain themselves only while hovered. "needs an axe in hand" gives no way to get an axe or a link to the recipe.
18. The radial menu is the only way to act, and only via right button or `E`. Nothing teaches it; a trackpad or touch player has no verbs at all.
19. `Erect` is hidden until something earned it, so the player cannot discover that building exists. The only hint is a text line in a toast after the fact.
20. Tools are disabled until zoomed in, with one hint far from the cursor. The locked world pins zoom and pan with no on-screen reason; the fog and tether are unexplained until fire.
21. The knapping trial pauses the world and `setSpeed` is silently refused while it is open. Nothing on the HUD says why the speed buttons do nothing.
22. Space pauses silently. Paused state is a highlighted tile, no banner or tint on the world, easy to leave paused and think the game is stuck.
23. `open` and `roll` in the seed box replace the world in one click and `menu` reloads the page, both beside the speed controls, no confirmation.
24. Armed brush (placing a bed or campfire) has no persistent on-screen state, only a ghost under the cursor. Escape cancels, but the key is not shown and the Escape order (tile, person, structure, tool) makes a player press it several times.
25. The mind panel is a full-screen popup over the game while people are dying; no needs strip stays visible inside it.

### E. Smaller bugs and inconsistencies

26. The `map` button cycles `% 6` views, the sky panel lists seven (`eco`); the button never reaches `eco`.
27. Seed input on create world is 108 px wide and clips a ten digit seed.
28. `Strip` text wraps at 2x scale in 340 px. `zoom 30.0, clear` is developer information.
29. Colour literals in `shell.css` (`#c9a066`, `#6f9fcf`, `#c05140`, `#e0a040`) bypass the palette rule.
30. The fps counter shows in the shipped frame.

### Ordering for the UI session

Smallest and most valuable first, UI code only: (1) a needs strip for every person, icons with escalating state, always visible, click selects and centres; (2) off-screen and pre-fatal warnings; (3) fix bar semantics and drop the debug rows from the person sheet; (4) show the reason a slice is greyed without hover and show icons for materials; (5) move dev controls out of the primary frame; (6) a "next step" line built from data the UI already has.

## Requests

- Day count and first-winter progress: `Frame` or `HudSnapshot` source with `{ day, daysInSeason, season }`, so the UI can show "winter, day 3 of 8".
- Thresholds for each need as exported constants (warn, critical, fatal) from `modules/people/api.ts`, so the UI can show a stage rather than guessing 0.7. The thoughts module already has `STARVING`, `PARCHED`, `EXHAUSTED`; export them.
- Time to fatal per need, or the per-second rate, per person: `{ hunger, thirst, tiredness, bodyTemp }` per second at current activity, so the UI can say "starves in about N hours".
- Person lifecycle events: died (with cause), born, so the UI can toast and the roster can grow. Shape: `Frame.events: { kind: 'died' | 'born', person, cause? }[]`.
- A next-action hint source: one short ranked list from the sim, `{ id, text, tile? }[]`, for example "no fire: find flint and kindling", "no shelter and night falls in 2 h".
- Shelter state per person: `sheltered: boolean` and which structure, for the needs strip.
- Fire fuel for every lit fire in `HudSnapshot` or readable from the replica, to draw a fuel ring on the map.

## Principle: information is earned

The HUD grows with what the people know. Every readout has a resolution ladder, and each rung is unlocked by a neuron or research entry, never by a UI flag.

- Body heat: icon and word (cold, fine, hot) first. Degrees only after the thermometer. Air temperature on the strip likewise.
- Hunger, thirst, tiredness: a three step icon (fine, needing, urgent) first. Bars once the people have named the need, numbers and "starves in N hours" much later.
- Position, pace, humidity, wind speed, soil and the other tile readout rows: absent until a tool that measures them exists. Today's debug rows move behind a dev toggle, outside the game's own ladder.
- Time: sun position and day or night first, then a clock, then a calendar and the season's progress.
- Discover mode shows every rung.

Consequences for the audit: items 4, 5, 10 and 28 are not fixed by adding numbers, they are fixed by choosing the lowest rung that still makes danger legible. The needs strip (A1) stays first, but starts qualitative.

### Requests for this principle

- Neurons for the measuring steps (quicksilver, thermometer, and later ones the sim wants to gate): a `research.ts` entry in the owning module, so `Mind.proven(key)` and `Game.mindKnows(key)` answer true.
- A readout registry in the sim or content, so the UI does not hardcode which neuron gates what: `{ id, rungs: [{ needs: neuronKey | null, show }] }`, for example `bodyHeat: [{ needs: null, show: 'word' }, { needs: 'thermometer', show: 'degrees' }]`. Until it exists the UI keeps this table in `src/ui` and moves it when the registry lands.

## Plan: the HUD arrives with the story

Stage 0, from the first frame: no HUD. People carry a bubble when a need is pressing, a picture only (snowflake cold, chopstick hunger, water drop thirst, moon tired). It escalates in size and pulse from concern to critical. Pause, speed and a small menu tile are the only chrome; the sky is the clock. Everything else (seed box, tools, depth cut, copy view, fps, map views, sky panel) moves behind a dev toggle.

Stage 1, on the `fire` achievement: a small dot in the HUD for the air temperature, blue through red, no number. Each campfire gets a fuel ring above it.

Stage 2, on the "we are family" achievement (the third person is born): a need bubble can be missed, so urgent ones also post to the toast system, with a locate click. The roster, grouping and counts follow later, each earned.

UI only: all of stage 0 (the glyphs come from `Game.thoughtsOf`, whose ids already name the needs), the dot and the ring (the replica has the air temperature and fuel), the toast queue.

### Requests

- Achievement `family`, earned when the population reaches three after a birth, with its unlock lines.
- A `born` event on the frame, with the person's index, for the toast.

### Addition: "it's back!"

Achievement `dawn`, earned at the first sunrise after the first night. It unlocks the day and night dial (`DayDial`), which until then is not in the frame. The people only learn that the dark is a cycle once they have lived through one.

Achievements are independent unlocks, so the HUD reads each flag on its own and never assumes an order: fire may come before or after the first night. Each needs a `coin-<id>` icon (UI, `pixel/ui/icons.ts`) for its toast.

Request: achievement `dawn` in `modules/achievements`, `reached` true once a night has fully passed and the sun is up again, with unlock lines ("You can read the hour from the dial").
