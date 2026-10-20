# AGENTS.md

Instructions for AI coding agents working in this repository.

## Commands

- `npm start`: launches electron with `--debug-mode --appid=480`, expects a dev server at `http://localhost:8000/` (override with `--url=`)
- `npm run fmt`: prettier write, `npx prettier . --check` is what CI runs
- `npm run generate-enums`: regenerates `src/steamworksEnums.cjs`, supports `--check`
- `npm run build-linux` / `npm run build-windows`: release builds, only used by the release workflow
- There is no test suite. Validation is `npx tsc -p .` (checkJs over the JS sources) plus `npx prettier . --check`. Run both before finishing.

## Generated code

`src/steamworksEnums.cjs` is generated from the `client.d.ts` of
`@jespertheend/steamworks.js` by `scripts/generateSteamworksEnums.mjs`. Never
edit it by hand. It is regenerated on `postinstall` (so bumping the dependency
regenerates it) and CI fails if it is out of date. The generated file contains:
`enums` (every const enum, forwarded to the renderer for synchronous access)
and `enumArgTypes` (which argument positions of which methods expect an enum, used
in the main process only).

The generator has a hardcoded list of signatures that must parse (such as
`networking.sendP2PPacket`). If it throws, the d.ts format changed and the
parser needs updating, not the list removing.

## Architecture

- `src/main.js`: electron main process, owns the steamworks sdk client
- `src/steamworksCalls.js`: ipc handlers the renderer calls into, converts
  enum member name strings to numeric values before native calls
- `src/preload.cjs`: isolated context preload, exposes `_steamWebWrapInternal`
  through the contextBridge plus the generated enums
- `src/sameContextPreload.js`: injected into the page as a `<script>`, builds
  the `globalThis.steamworks` proxy. Methods are async ipc calls; enum objects
  and a few constants are resolved synchronously from generated data
- In `--debug-mode` the proxy also populates placeholder props via
  `getSteamworksProps` so devtools autocompletion works. Real values must not
  be clobbered by these placeholders, keep the `Object.hasOwn` checks intact
- The `callback` interface passes callback names as strings over ipc. The renderer
  validates them against the generated `enums.callback.SteamCallback`, the main
  process passes them straight to the sdk

## Design decisions

- Enums live in the renderer synchronously because games may read them at
  module scope, lazy loading or sync ipc would be racy or blocking
- Enum args accept both member names (`"Reliable"`) and numeric values. Names
  hard-throw with the valid member list, unknown names should fail loudly
- Return values stay numeric. Converting them (including nested struct fields)
  is a possible future change, intentionally not done

## Style

- Prettier enforced: tabs, 4 spaces width, 120 print width
- Plain JavaScript with `checkJs`, types come from JSDoc. `.d.ts` files only
  exist for globals
- Keep code comments short and only for non-obvious intent
- `src/steamworksEnums.cjs` and `out/` are generated/build output, do not
  commit changes to them by hand or touch the release workflow flow
