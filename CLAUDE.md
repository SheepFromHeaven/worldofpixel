# Element Circuit — working notes

`README.md` is the spec: channels, tick order, pressure rules, canvas behaviour, the bridge,
the levels. Read it before changing engine or bridge logic — the rules there are load-bearing
and most of them exist because something deadlocked without them. This file covers only how to
work in the repo.

## Commands

```
npm run typecheck      # tsc --noEmit, strict, covers .ts and .tsx
npm run sim            # the three verification levels, exit 1 on failure
npm run check:bridge   # Rete graph ⇄ engine sync, 23 assertions, headless
npm run dev            # canvas at http://localhost:5173
npm run build          # typecheck + vite build
```

Both `package-lock.json` and `pnpm-lock.yaml` are committed; the scripts run the same either way.

## Verification

There is no test framework. `npm run sim` and `npm run check:bridge` are the test suite — they
are plain `tsx` scripts that assert and set an exit code. Run both plus `typecheck` after any
change to `src/engine/` or `src/ui/EngineBridge.ts`; they are fast and they catch the failures
that matter (deadlock, tier miscounts, ports drifting from wiring).

New engine behaviour gets a new level in `src/cli/levels.ts`; new graph⇄engine behaviour gets a
new check in `src/cli/bridgeCheck.ts`. `bridgeCheck.ts` drives the real `EngineBridge` against a
stub area object, so it exercises the actual editor pipes without a DOM — keep it that way
rather than reaching for jsdom.

## Layering

`src/engine/` must not import from `src/ui/` or touch the DOM, React or Rete. The dependency
runs one way: ui → engine. `cli/levels.ts` uses the engine alone; only `cli/bridgeCheck.ts`
crosses into ui.

## Identity conventions

Ids are 1:1 across the two graphs, by construction and not by lookup table:

- a Rete node id **is** the engine node id
- a Rete socket key **is** the engine port id (`portId()` in `src/engine/nodes.ts`:
  `<nodeId>.<in|out>.<name ?? channel>`)
- a Rete connection id **is** the engine connection id

Don't introduce a mapping table. If an id needs to change, change it in `portId()` so both
sides move together.

## Buffer key prefixes

The internal buffer holds ingredients under `Channel:Resource` (`stackKey`) and undelivered
products under `out:Channel:Resource` (`productKey`). The prefix is the only thing distinguishing
them, and flush/ingest both depend on it. Use the helpers in `engine.ts` and `types.ts`; never
build these strings inline.

## TypeScript

`strict`, plus `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
`verbatimModuleSyntax` and `allowImportingTsExtensions`. Practical consequences:

- relative imports carry the real `.ts`/`.tsx` extension, so editor go-to-definition works.
  This relies on `allowImportingTsExtensions`, which in turn requires `noEmit` — nothing here
  emits via `tsc` (vite builds the bundle), so that holds. Don't write `.js` specifiers.
- type-only imports use `import type`
- indexing a `Record`/array yields `T | undefined` — handle it, don't assert
- an optional property is omitted, not set to `undefined` (see `if (spec.source)` in `nodes.ts`)

## Determinism

Node iteration follows insertion order, connections follow declaration order, buffer flushes
iterate sorted keys. The same graph must always produce the same trace — levels assert exact
counts at exact ticks. Anything that iterates a `Map` or `Set` in the tick path needs a defined
order; don't add `Math.random`, `Date.now` or unordered iteration there.

## UI specifics

- `rete-react-plugin` mounts every node in its own React root, so React context does not reach
  node components. Cross-component state goes through the module singletons: `simStore.ts`
  (visuals, via `useSyncExternalStore`), `menuStore.ts`, `bridgeRef.ts`.
- Ticking publishes a snapshot to `simStore`; node components re-render themselves from it. Do
  not make the canvas re-render per tick.
- All channel colours come from `theme.ts`. No hard-coded hex in components.
- Output ports are derived from `predictRecipe`, not placed by the player. Code that adds output
  ports by hand is almost certainly wrong — fix the prediction instead.
- Socket positions use the custom watcher in `socketPosition.ts` (`getBoundingClientRect`,
  zoom recovered from the node rect). Rete's stock watcher mismeasures under transforms.

## Style

Follow the existing code: no comments unless the *why* is genuinely non-obvious (the few in
`engine.ts` and `bridgeCheck.ts` are the bar), named exports, small pure helpers in
`buffers.ts`/`nodes.ts` rather than logic inlined into the tick loop.
