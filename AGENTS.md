This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## Effect (required)

All non-UI logic is written with [Effect](https://effect.website) v4 (`effect` package). This is a project requirement.

- Use **Effect Schema** (`effect/Schema`) for every data shape: API request/response bodies, Claude structured outputs, and anything decoded from outside the app. Do not add zod or other schema libraries. Use `Schema.Finite` (not `Schema.Number`) for numbers sent to Claude, because `Number` also admits `"Infinity"`/`"NaN"` strings in its JSON Schema.
- Claude structured outputs: `betaStandardSchemaOutputFormat(Schema.toStandardSchemaV1(Schema.toStandardJSONSchemaV1(schema)))` from `@anthropic-ai/sdk/helpers/beta/standard-schema`. Call Claude through the official `@anthropic-ai/sdk` wrapped in the `Claude` service (`src/server/claude.ts`); do not use `effect/ai` provider packages.
- Model failures as `Data.TaggedError` classes and keep them in the error channel; map them to HTTP responses or UI messages only at the edge (`src/server/http.ts`, React components).
- Dependencies are `Context.Service` classes (`Claude`, `Database`) supplied by `Layer`s or `Effect.provideService`; API routes run on the `ManagedRuntime` in `src/server/http.ts`.
- Import per module (`import * as Effect from "effect/Effect"`), not from the `effect` barrel, to keep the Metro bundle smaller.
- React components stay plain React. They call Effects through the pantry context or run them with `Effect.runPromise` at the call site.
- SQLite stays on `expo-sqlite`, wrapped in the `Database` service (`src/lib/db.ts`). `@effect/sql-sqlite-react-native` requires op-sqlite and a development build, so it would break Expo Go.
