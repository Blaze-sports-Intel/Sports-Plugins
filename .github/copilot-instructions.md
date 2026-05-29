# GitHub Copilot & AI Agent Instructions

> These rules apply to **every** AI coding assistant operating in this repository
> (GitHub Copilot, Codex, Claude Code, etc.). Follow them unconditionally.

---

## 1. Type Safety — Never Hallucinate API Shapes

- **Always** import data types from `src/types/sports/` before writing any
  code that consumes or produces sports state.
- **Never** invent inline object shapes for game state, events, or API
  responses. If a type does not exist, add it to `src/types/sports/index.ts`
  and import it.
- Payload types coming from external APIs (MLB Stats API, NBA API, ESPN, etc.)
  must be wrapped in the canonical discriminated unions defined in
  `src/types/sports/index.ts` before they reach any UI or business logic.
- Do **not** use `any`, `unknown` (unless narrowing immediately), or untyped
  `JSON.parse` results without a branded type assertion or Zod/io-ts parse.

```ts
// ✅ correct
import type { LiveSportState, BaseballState } from '../types/sports/index.js';

// ❌ wrong — shapes invented inline
const state = { balls: 0, strikes: 0, outs: 0 };
```

---

## 2. Live Sports Are Rigid State Machines

- Model every in-game transition as a **pure function** that accepts
  `(currentState: LiveSportState, event: GameEvent)` and returns a new
  `LiveSportState`. No mutations; no side effects.
- State machine logic lives exclusively in `src/machines/`. Do not embed
  transition rules in UI components, hooks, or utilities.
- Transitions must be **exhaustive**: use a `switch` or discriminated-union
  narrowing so the TypeScript compiler rejects unhandled event types.
- **Inning-flip rule (baseball):** when a batter records an out and the
  resulting `outs` count equals `3`, the half-inning must flip and the bases
  must be cleared before the function returns. This must be encoded in
  `processBaseballEvent` in `src/machines/evaluator.ts`.
- **Shot-clock rule (basketball):** a possession change resets the shot clock
  to `24` (NBA) or `30` (NCAA); hardcode neither — derive from
  `BasketballState.rules.shotClockSeconds`.
- Always use `===` for state comparisons; never use loose equality (`==`).

```ts
// ✅ correct — transition encoded in evaluator, not in a component
import { processBaseballEvent } from '../machines/evaluator.js';
const next = processBaseballEvent(current, { type: 'STRIKEOUT' });

// ❌ wrong — transition logic leaking into a React component
if (outs >= 3) { setBases({}); setHalf(half === 'top' ? 'bottom' : 'top'); }
```

---

## 3. No Raw Verbose Payloads in the UI

- The UI layer (components, hooks, pages) must **only** receive compressed,
  discriminated `LiveSportState` objects — never raw vendor API JSON.
- Strip all fields not present in `LiveSportState` at the ingestion boundary
  (API route, WebSocket message handler, or server action).
- When rendering, branch on the `type` discriminator (`'MLB' | 'NBA'`) using
  a `switch` or conditional so TypeScript narrows the type automatically.
- For streaming data, consume the WebSocket mock server in
  `scripts/mock-stream.ts` during local development; do **not** hard-code
  vendor API responses in component files.

```ts
// ✅ correct — narrow on discriminator before rendering
switch (state.type) {
  case 'MLB': return <BaseballScoreboard state={state} />;
  case 'NBA': return <BasketballScoreboard state={state} />;
  default: return assertNever(state);
}

// ❌ wrong — raw API blob passed directly to a component
<Scoreboard data={rawEspnApiResponse} />
```

---

## 4. Module & Import Conventions

- Use **`.js` extensions** on all relative TypeScript imports (Node16 module
  resolution requires it even for `.ts` source files).
- Path alias `@sports-plugins/*` maps to `./src/*` — use it for cross-module
  imports within `src/`.
- Keep each sport's logic self-contained: `MLB` concerns stay in files that
  import `BaseballState`; `NBA` concerns stay in files that import
  `BasketballState`.

---

## 5. General Code Quality

- All new code must pass `npm run typecheck` (`tsc --noEmit`) with zero errors.
- Do not disable ESLint rules inline (`// eslint-disable`) without a comment
  explaining why.
- Prefer `readonly` arrays and `Readonly<T>` objects in state machine types to
  prevent accidental mutation.
- Document every exported type and function with a JSDoc comment explaining
  its invariants.
