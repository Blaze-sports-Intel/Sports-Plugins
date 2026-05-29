/**
 * Unified Sport Type Registry
 *
 * Single source of truth for all live-game state shapes used across
 * Sports-Plugins. Every module that consumes or produces game state MUST
 * import from this file. Never define inline game-state shapes elsewhere.
 *
 * Design principles:
 *  - Discriminated unions keyed on `type` allow exhaustive narrowing.
 *  - Nested situational objects (count, bases, possession, etc.) are kept
 *    compact — raw vendor payloads must be mapped to these types at the
 *    ingestion boundary before reaching UI or business logic.
 *  - All arrays and nested objects are `readonly` to prevent accidental
 *    mutation inside state machines.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** ISO 8601 timestamp string (e.g. "2025-09-14T19:05:00Z"). */
export type ISOTimestamp = string;

/** Unique game identifier, typically source-prefixed (e.g. "mlb-745804"). */
export type GameId = string;

/** Unique player identifier. */
export type PlayerId = string;

/** Canonical half-inning indicator. */
export type HalfInning = 'top' | 'bottom';

// ---------------------------------------------------------------------------
// Baseball (MLB) types
// ---------------------------------------------------------------------------

/**
 * Occupancy of a single base.
 * `null`  → base is empty
 * string  → the `PlayerId` of the runner occupying the base
 */
export type BaseOccupant = PlayerId | null;

/**
 * Snapshot of which bases are currently occupied.
 * Index 0 = first base, 1 = second, 2 = third.
 */
export interface Bases {
  readonly first: BaseOccupant;
  readonly second: BaseOccupant;
  readonly third: BaseOccupant;
}

/** Pitch count for the current plate appearance. */
export interface PitchCount {
  /** 0–3 balls in the current at-bat. */
  readonly balls: 0 | 1 | 2 | 3;
  /** 0–2 strikes in the current at-bat. */
  readonly strikes: 0 | 1 | 2;
}

/** Out count for the current half-inning. */
export type OutCount = 0 | 1 | 2 | 3;

/** Situational baseball context for the current half-inning. */
export interface BaseballSituation {
  /** Current inning number (1-based). */
  readonly inning: number;
  /** Whether the batting team is the visiting ('top') or home ('bottom') side. */
  readonly half: HalfInning;
  /** Number of outs recorded in this half-inning (3 = side retired). */
  readonly outs: OutCount;
  /** Pitch count for the batter currently at the plate. */
  readonly count: PitchCount;
  /** Base occupancy snapshot. */
  readonly bases: Bases;
  /** `PlayerId` of the batter currently at the plate. */
  readonly batterId: PlayerId;
  /** `PlayerId` of the pitcher currently facing the batter. */
  readonly pitcherId: PlayerId;
}

/** Minimally-typed team score record reused across sports. */
export interface TeamSnapshot {
  readonly teamId: string;
  readonly abbreviation: string;
  readonly score: number;
}

/** Full live state for an MLB game. */
export interface BaseballState {
  /** Sport discriminator — always `'MLB'` for this variant. */
  readonly type: 'MLB';
  readonly gameId: GameId;
  readonly status: 'scheduled' | 'in-progress' | 'final' | 'postponed' | 'cancelled';
  readonly homeTeam: TeamSnapshot;
  readonly awayTeam: TeamSnapshot;
  /** Current play-by-play situation. Absent when status is not `'in-progress'`. */
  readonly situation: BaseballSituation | null;
  /** ISO 8601 timestamp of the last state update. */
  readonly lastUpdated: ISOTimestamp;
}

// ---------------------------------------------------------------------------
// Basketball (NBA) types
// ---------------------------------------------------------------------------

/** Quarter number (1–4) plus overtime periods encoded as 5+. */
export type QuarterNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Which team currently has the possession arrow advantage for jump balls. */
export type PossessionArrow = 'home' | 'away';

/** Shot-clock and possession snapshot for the current possession. */
export interface BasketballSituation {
  /** Current quarter (or OT period). */
  readonly quarter: QuarterNumber;
  /** Time remaining in the quarter in seconds (0–720 for 12-min quarters). */
  readonly quarterSecondsRemaining: number;
  /** Shot clock remaining in seconds. 0 means violation just occurred. */
  readonly shotClockSeconds: number;
  /** Team currently in possession (`teamId`). `null` during dead ball / tip-off. */
  readonly possessionTeamId: string | null;
  /** Possession arrow direction for the next held-ball situation. */
  readonly possessionArrow: PossessionArrow;
  /**
   * Shot-clock reset value in seconds; varies by league rule
   * (NBA = 24, NCAA = 30, WNBA = 24).
   */
  readonly rules: {
    readonly shotClockSeconds: number;
    readonly quarterSeconds: number;
  };
}

/** Foul tracking for a single team. */
export interface TeamFoulState {
  readonly teamId: string;
  /** Team fouls in the current period (resets each quarter). */
  readonly periodFouls: number;
  /** `true` when the team is in the bonus (opponent shoots free throws on all fouls). */
  readonly inBonus: boolean;
}

/** Full live state for an NBA game. */
export interface BasketballState {
  /** Sport discriminator — always `'NBA'` for this variant. */
  readonly type: 'NBA';
  readonly gameId: GameId;
  readonly status: 'scheduled' | 'in-progress' | 'final' | 'postponed' | 'cancelled';
  readonly homeTeam: TeamSnapshot;
  readonly awayTeam: TeamSnapshot;
  /** Foul state for both teams. */
  readonly fouls: {
    readonly home: TeamFoulState;
    readonly away: TeamFoulState;
  };
  /** Current play situation. Absent when status is not `'in-progress'`. */
  readonly situation: BasketballSituation | null;
  /** ISO 8601 timestamp of the last state update. */
  readonly lastUpdated: ISOTimestamp;
}

// ---------------------------------------------------------------------------
// Generic union
// ---------------------------------------------------------------------------

/**
 * `LiveSportState` is the canonical top-level type for any live game snapshot.
 *
 * Narrow it with a `switch (state.type)` block; the TypeScript compiler will
 * enforce exhaustiveness when all variants are handled.
 *
 * @example
 * ```ts
 * function render(state: LiveSportState) {
 *   switch (state.type) {
 *     case 'MLB': return renderBaseball(state);
 *     case 'NBA': return renderBasketball(state);
 *     default:    return assertNever(state);
 *   }
 * }
 * ```
 */
export type LiveSportState = BaseballState | BasketballState;

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Compile-time exhaustiveness check. Call as the `default` branch of a
 * `switch` over a discriminated union to ensure all variants are handled.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled LiveSportState variant: ${JSON.stringify(value)}`);
}

/**
 * Type guard: narrows `LiveSportState` to `BaseballState`.
 */
export function isBaseballState(state: LiveSportState): state is BaseballState {
  return state.type === 'MLB';
}

/**
 * Type guard: narrows `LiveSportState` to `BasketballState`.
 */
export function isBasketballState(state: LiveSportState): state is BasketballState {
  return state.type === 'NBA';
}
