# The HUD's design language

Every panel over the world is built from the same few parts, on the same grid, in the same
material, so that a new sheet looks like the old ones without anyone having to match it by eye.
The parts are in `src/ui/pixel/Panel.tsx`, the rules in `src/ui/styles/panel.css`, and the sheets
that use them in `src/ui/Sheets.tsx`.

## Material

**Wood is the HUD.** The top bar, every sheet, the toast, the menu and the corner button are the
board rim around planks (`se-wood`). There is no second material for "another kind of panel":
the sand slab and the white tile were the old game's and are not used by the shell any more.
Inside the wood, anything you can put something into or press is a **well**: a square sunk into
the planks (`--se-well-floor`, a dark inset edge), 40 px, holding a 32 px icon or item. Wells
are the doll's slots, a store's contents, the allowed kinds and a station's orders. A section
title sits on a recessed band of the same floor, so the eye reads the panel as a stack of
bands even where plank seams cross it.

## Grid and spacing

Spacing is a scale of 4 px steps (`--se-gap-1` 4, `-2` 8, `-3` 12, `-4` 16, `-5` 24), and
nothing uses a number outside it. 12 px is the gutter: panels sit 12 px from the screen edge
and the top bar and 12 px from each other, and a section is 12 px below the one above. 8 px is
the gap inside a section (title to content, row to row, well to well), 16 px the gap between a
label column and its values.

**One column, on the right.** Sheets are not placed one by one; `ShellPanels` puts every sheet
in `se-column`, a 320 px column under the top bar that stacks them in a fixed order (the
subject you selected, then the tile you opened) and scrolls if they outgrow the screen. Only
modals (the menu, the mind) and the toast are centred. The middle of the screen is the world.

## Type

Two sizes and four colours, each with one job.

- **Title**, 3x (`PixelHeading`): the name of the thing the panel is about, once per panel.
- **Everything else**, 2x (`PixelText`).
- **Bone** (`--se-text`) is what something *is*: values, thoughts, section titles.
- **Sand** (`--se-text-label`) is what a value is *called*: field labels, the kicker above a
  title (`person`, `building`, `plan`, `tile x, y`), "nothing" in an empty row.
- **Ember** (`se-tone-warn`) is a need or a warning, **cold blue** (`se-tone-cold`) is cold. Ember
  on a button means it is the active one, as on the top bar.

## Anatomy of a panel

```
Panel     kicker (sand) / title (3x bone)                 close
Section   [ title band ]
            Fields: label (sand)          value (bone, right)
                                          meter
            Wells:  [■] [■] [■]
Section   [ title band ]
            ...
```

`Panel` owns the header and the close button, `Section` a titled band, `Fields` a two-column
grid (labels in their own column so every value lines up on the right edge and wraps within
it), `Field` a label and a value with an optional `Meter` under the value, `Wells` a wrapping
row of `Well`s (a `Well` with `onClick` is a button, `off` dims and greys it, `count` puts a
number in its corner). A sheet is a composition of these and never styles its own rows.

## Counting is done with slots

A place that holds a number of things shows that number as wells, never as a figure or a gauge:
a knapping floor's 12 places, a storage's 32 and a station's 8 queued orders are drawn as that
many wells, filled ones showing the thing and empty ones left empty, so how full it is reads at a
glance and nobody counts. `StructureView.capacity` asks for this on a structure's contents and
`SheetSection.slots` on a row of buttons. More than 16 places, or a row of 8, go into a grid of 8
columns with smaller wells (`Wells dense`), so a store is 8 by 4 rather than six rows and a ragged
end. Gauges are left for things that are not a count of places: how far a plan is built, how much
fuel a fire has.

## Adding to it

A new sheet is a `Panel` of `Section`s in `Sheets.tsx`, rendered inside `se-column`. A module that
wants controls on a structure's sheet returns `SheetSection`s from `registerSection`
(`modules/clientSlots.ts`), and they are drawn as `Section`s of `Well` buttons, so a module
never brings its own layout. A new spacing, size or colour is a token in `panel.css`, not a
number in a rule.
