# AI Coding Assistant Instructions for Sports-Plugins Repository

You are assisting with a real-time sports analytics platform. Follow these rules **strictly** at all times.

## Core Principles

1. **Never Guess or Hallucinate API Shapes**
   - Always import types from `src/types/sports/`.
   - Use `LiveSportState`, `BaseballState`, `BasketballState`, and related discriminated unions.
   - Never inline raw API response shapes. Reference exported types only.

2. **Live Sports as Rigid State Machines**
   - All game state transitions must be deterministic and pure.
   - Use explicit state machines with discriminated unions (`type: 'MLB' | 'NBA'`).
   - Handle transitions precisely (e.g., inning advance only when `outs === 3`, quarter advance only on `timeRemaining <= 0`).
   - Do not use loose objects or `any`. Enforce exhaustive type checking.

3. **UI Data Discipline**
   - Never dump raw verbose API payloads into components or UI state.
   - Transform all external data into compressed, discriminated unions defined in `src/types/sports/`.
   - Prefer small, focused state slices over large nested objects.

4. **Architecture Guardrails**
   - All state updates must go through pure transition functions in `src/machines/`.
   - Frontend should subscribe to WebSocket streams or use reactive stores fed by processed state.
   - Keep business logic out of React components, Vue components, or UI layers.

5. **Type Safety Requirements**
   - Use TypeScript `strict: true`, `exactOptionalPropertyTypes`, and `noUncheckedIndexedAccess`.
   - Exhaustively handle every discriminated union variant with `switch` or `if` guards.
   - Never use `as any`, `// @ts-ignore`, or force casts unless absolutely necessary (and document why).

6. **Performance & Real-time Considerations**
   - Assume high-frequency updates (multiple per second).
   - Favor immutable updates and structural sharing where possible.
   - Avoid deep cloning large objects on every tick.

When generating code:
- Start by importing required types from `src/types/sports`.
- Implement pure functions for state transitions.
- Keep UI layers thin and presentational.
- Include comprehensive JSDoc and inline comments for complex rules.

This file takes precedence over any conflicting instructions.