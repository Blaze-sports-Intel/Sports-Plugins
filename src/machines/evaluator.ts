/**
 * Baseball State Machine — Evaluator
 *
 * Pure, deterministic state-transition function for MLB play-by-play events.
 * All logic is encoded here; no side effects, no I/O, no mutable state.
 *
 * Import `processBaseballEvent` wherever game events need to be applied to a
 * `BaseballState`. Never replicate transition logic in UI components or hooks.
 *
 * Transition invariants enforced by this module:
 *  - A `STRIKEOUT` or `OUT` event increments `outs` by 1.
 *  - When `outs` reaches 3 the half-inning flips, bases are cleared, and the
 *    pitch count resets. If `half` was `'bottom'` the inning number advances.
 *  - A `BALL` event increments `balls`; a 4th ball (walk) advances the batter
 *    to first base and force-advances any runners if necessary.
 *  - A `STRIKE` event increments `strikes`; the 3rd strike is a strikeout.
 *  - Hit events (`SINGLE`, `DOUBLE`, `TRIPLE`, `HOME_RUN`) advance runners by
 *    the appropriate number of bases and reset the pitch count.
 *  - The pitch count always resets to `{ balls: 0, strikes: 0 }` after any
 *    event that ends the plate appearance.
 */

import type {
  BaseballState,
  BaseballSituation,
  Bases,
  HalfInning,
  OutCount,
  PlayerId,
} from '../types/sports/index.js';

// ---------------------------------------------------------------------------
// Event payload discriminated union
// ---------------------------------------------------------------------------

/** A pitch event that adds a ball to the count. */
export interface BallEvent {
  readonly type: 'BALL';
}

/** A pitch event that adds a strike to the count (swinging or called). */
export interface StrikeEvent {
  readonly type: 'STRIKE';
}

/**
 * The batter records an out without hitting the ball into play
 * (e.g., strikeout looking — explicit form; use STRIKE for swinging/called,
 * or STRIKEOUT to end the PA immediately regardless of current count).
 */
export interface StrikeoutEvent {
  readonly type: 'STRIKEOUT';
}

/** The batter puts the ball in play and is retired (ground-out, fly-out, etc.). */
export interface OutEvent {
  readonly type: 'OUT';
  /** Runners that scored on this play (before the out was recorded). */
  readonly runnersScored?: readonly PlayerId[];
  /** New base occupancy after the out is recorded. */
  readonly basesAfter: Bases;
}

/** The batter reaches first base on a single. */
export interface SingleEvent {
  readonly type: 'SINGLE';
  readonly batterId: PlayerId;
  /** Runners that scored on this play. */
  readonly runnersScored?: readonly PlayerId[];
  /** Base occupancy after the play. */
  readonly basesAfter: Bases;
}

/** The batter reaches second base on a double. */
export interface DoubleEvent {
  readonly type: 'DOUBLE';
  readonly batterId: PlayerId;
  readonly runnersScored?: readonly PlayerId[];
  readonly basesAfter: Bases;
}

/** The batter reaches third base on a triple. */
export interface TripleEvent {
  readonly type: 'TRIPLE';
  readonly batterId: PlayerId;
  readonly runnersScored?: readonly PlayerId[];
  readonly basesAfter: Bases;
}

/** The batter hits a home run; all runners score and bases clear. */
export interface HomeRunEvent {
  readonly type: 'HOME_RUN';
  readonly batterId: PlayerId;
}

/** The batter is awarded first base on four balls (walk). */
export interface WalkEvent {
  readonly type: 'WALK';
  readonly batterId: PlayerId;
  /** Base occupancy after the walk (force advances already applied). */
  readonly basesAfter: Bases;
  readonly runnersScored?: readonly PlayerId[];
}

/** The batter is hit by a pitch and awarded first base. */
export interface HitByPitchEvent {
  readonly type: 'HIT_BY_PITCH';
  readonly batterId: PlayerId;
  readonly basesAfter: Bases;
  readonly runnersScored?: readonly PlayerId[];
}

/** The next batter's `PlayerId` — required when the plate appearance ends. */
export interface NextBatterEvent {
  readonly nextBatterId: PlayerId;
}

/**
 * Union of all play-by-play event payloads.
 * Every branch must be handled in `processBaseballEvent`.
 */
export type BaseballGameEvent =
  | BallEvent
  | StrikeEvent
  | (StrikeoutEvent & NextBatterEvent)
  | (OutEvent & NextBatterEvent)
  | (SingleEvent & NextBatterEvent)
  | (DoubleEvent & NextBatterEvent)
  | (TripleEvent & NextBatterEvent)
  | (HomeRunEvent & NextBatterEvent)
  | (WalkEvent & NextBatterEvent)
  | (HitByPitchEvent & NextBatterEvent);

// ---------------------------------------------------------------------------
// Internal helpers (not exported — keep the public surface minimal)
// ---------------------------------------------------------------------------

const EMPTY_BASES: Bases = {
  first: null,
  second: null,
  third: null,
};

const ZERO_COUNT = { balls: 0 as const, strikes: 0 as const };

/**
 * Flip the half-inning and, if necessary, advance the inning counter.
 * Returns updated `{ inning, half }` values.
 */
function advanceHalfInning(
  inning: number,
  half: HalfInning,
): { inning: number; half: HalfInning } {
  if (half === 'top') {
    return { inning, half: 'bottom' };
  }
  return { inning: inning + 1, half: 'top' };
}

/**
 * Apply a run-scoring event to the team scores and return updated `BaseballState`
 * home/away scores.
 */
function applyRuns(
  state: BaseballState,
  runnersScored: readonly PlayerId[] | undefined,
  batterAlsoScored: boolean,
): { homeScore: number; awayScore: number } {
  const runsScored =
    (runnersScored?.length ?? 0) + (batterAlsoScored ? 1 : 0);

  if (runsScored === 0) {
    return {
      homeScore: state.homeTeam.score,
      awayScore: state.awayTeam.score,
    };
  }

  // The batting team is determined by the current half-inning:
  //   top  → away team is batting
  //   bottom → home team is batting
  const half = state.situation?.half ?? 'top';
  return {
    homeScore:
      half === 'bottom'
        ? state.homeTeam.score + runsScored
        : state.homeTeam.score,
    awayScore:
      half === 'top'
        ? state.awayTeam.score + runsScored
        : state.awayTeam.score,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Apply a single play-by-play event to the current `BaseballState` and return
 * the resulting state.
 *
 * This is a **pure function**: it never mutates `currentState`, never reads
 * from external sources, and always returns a complete new `BaseballState`.
 *
 * @param currentState - The authoritative state before the event.
 * @param event        - The play-by-play event to apply.
 * @returns            A new `BaseballState` reflecting the post-event situation.
 *
 * @throws {Error} When called with a `currentState` whose `status` is not
 *   `'in-progress'`, or when `situation` is `null`.
 */
export function processBaseballEvent(
  currentState: BaseballState,
  event: BaseballGameEvent,
): BaseballState {
  if (
    currentState.status !== 'in-progress' ||
    currentState.situation === null
  ) {
    throw new Error(
      `processBaseballEvent: state must be 'in-progress' with a non-null situation. ` +
        `Received status="${currentState.status}".`,
    );
  }

  const now = new Date().toISOString();
  const sit = currentState.situation;

  switch (event.type) {
    // -----------------------------------------------------------------------
    // BALL — increment ball count; 4 balls = walk (handled by WALK event)
    // -----------------------------------------------------------------------
    case 'BALL': {
      const newBalls = (sit.count.balls + 1) as 0 | 1 | 2 | 3;
      const newSituation: BaseballSituation = {
        ...sit,
        count: { ...sit.count, balls: newBalls },
      };
      return {
        ...currentState,
        situation: newSituation,
        lastUpdated: now,
      };
    }

    // -----------------------------------------------------------------------
    // STRIKE — increment strike count (0→1 or 1→2 only).
    // When the batter already has 2 strikes, callers MUST dispatch a
    // STRIKEOUT event (which carries nextBatterId) instead of STRIKE.
    // -----------------------------------------------------------------------
    case 'STRIKE': {
      if (sit.count.strikes === 2) {
        throw new Error(
          'processBaseballEvent: STRIKE fired with count already at 2 strikes. ' +
            'Dispatch a STRIKEOUT event (with nextBatterId) to end the plate appearance.',
        );
      }
      const newStrikes = (sit.count.strikes + 1) as 0 | 1 | 2;
      return {
        ...currentState,
        situation: {
          ...sit,
          count: { ...sit.count, strikes: newStrikes },
        },
        lastUpdated: now,
      };
    }

    // -----------------------------------------------------------------------
    // STRIKEOUT — batter strikes out; record an out
    // -----------------------------------------------------------------------
    case 'STRIKEOUT': {
      const { nextBatterId } = event;
      const newOuts = (sit.outs + 1) as OutCount;

      if (newOuts === 3) {
        const { inning, half } = advanceHalfInning(sit.inning, sit.half);
        return {
          ...currentState,
          situation: {
            ...sit,
            inning,
            half,
            outs: 0,
            count: ZERO_COUNT,
            bases: EMPTY_BASES,
            batterId: nextBatterId,
          },
          lastUpdated: now,
        };
      }

      return {
        ...currentState,
        situation: {
          ...sit,
          outs: newOuts,
          count: ZERO_COUNT,
          batterId: nextBatterId,
        },
        lastUpdated: now,
      };
    }

    // -----------------------------------------------------------------------
    // OUT — batter puts the ball in play and is retired
    // -----------------------------------------------------------------------
    case 'OUT': {
      const { runnersScored, basesAfter, nextBatterId } = event;
      const scores = applyRuns(currentState, runnersScored, false);
      const newOuts = (sit.outs + 1) as OutCount;

      if (newOuts === 3) {
        const { inning, half } = advanceHalfInning(sit.inning, sit.half);
        return {
          ...currentState,
          homeTeam: { ...currentState.homeTeam, score: scores.homeScore },
          awayTeam: { ...currentState.awayTeam, score: scores.awayScore },
          situation: {
            ...sit,
            inning,
            half,
            outs: 0,
            count: ZERO_COUNT,
            bases: EMPTY_BASES,
            batterId: nextBatterId,
          },
          lastUpdated: now,
        };
      }

      return {
        ...currentState,
        homeTeam: { ...currentState.homeTeam, score: scores.homeScore },
        awayTeam: { ...currentState.awayTeam, score: scores.awayScore },
        situation: {
          ...sit,
          outs: newOuts,
          count: ZERO_COUNT,
          bases: basesAfter,
          batterId: nextBatterId,
        },
        lastUpdated: now,
      };
    }

    // -----------------------------------------------------------------------
    // SINGLE — batter reaches first
    // -----------------------------------------------------------------------
    case 'SINGLE': {
      const { runnersScored, basesAfter, nextBatterId } = event;
      const scores = applyRuns(currentState, runnersScored, false);
      return {
        ...currentState,
        homeTeam: { ...currentState.homeTeam, score: scores.homeScore },
        awayTeam: { ...currentState.awayTeam, score: scores.awayScore },
        situation: {
          ...sit,
          count: ZERO_COUNT,
          bases: basesAfter,
          batterId: nextBatterId,
        },
        lastUpdated: now,
      };
    }

    // -----------------------------------------------------------------------
    // DOUBLE — batter reaches second
    // -----------------------------------------------------------------------
    case 'DOUBLE': {
      const { runnersScored, basesAfter, nextBatterId } = event;
      const scores = applyRuns(currentState, runnersScored, false);
      return {
        ...currentState,
        homeTeam: { ...currentState.homeTeam, score: scores.homeScore },
        awayTeam: { ...currentState.awayTeam, score: scores.awayScore },
        situation: {
          ...sit,
          count: ZERO_COUNT,
          bases: basesAfter,
          batterId: nextBatterId,
        },
        lastUpdated: now,
      };
    }

    // -----------------------------------------------------------------------
    // TRIPLE — batter reaches third
    // -----------------------------------------------------------------------
    case 'TRIPLE': {
      const { runnersScored, basesAfter, nextBatterId } = event;
      const scores = applyRuns(currentState, runnersScored, false);
      return {
        ...currentState,
        homeTeam: { ...currentState.homeTeam, score: scores.homeScore },
        awayTeam: { ...currentState.awayTeam, score: scores.awayScore },
        situation: {
          ...sit,
          count: ZERO_COUNT,
          bases: basesAfter,
          batterId: nextBatterId,
        },
        lastUpdated: now,
      };
    }

    // -----------------------------------------------------------------------
    // HOME_RUN — batter and all runners score; bases clear
    // -----------------------------------------------------------------------
    case 'HOME_RUN': {
      const { nextBatterId } = event;
      const runners: PlayerId[] = [];
      if (sit.bases.first) runners.push(sit.bases.first);
      if (sit.bases.second) runners.push(sit.bases.second);
      if (sit.bases.third) runners.push(sit.bases.third);
      const scores = applyRuns(currentState, runners, true /* batter scored */);

      return {
        ...currentState,
        homeTeam: { ...currentState.homeTeam, score: scores.homeScore },
        awayTeam: { ...currentState.awayTeam, score: scores.awayScore },
        situation: {
          ...sit,
          count: ZERO_COUNT,
          bases: EMPTY_BASES,
          batterId: nextBatterId,
        },
        lastUpdated: now,
      };
    }

    // -----------------------------------------------------------------------
    // WALK — batter awarded first; force advances applied
    // -----------------------------------------------------------------------
    case 'WALK': {
      const { runnersScored, basesAfter, nextBatterId } = event;
      const scores = applyRuns(currentState, runnersScored, false);
      return {
        ...currentState,
        homeTeam: { ...currentState.homeTeam, score: scores.homeScore },
        awayTeam: { ...currentState.awayTeam, score: scores.awayScore },
        situation: {
          ...sit,
          count: ZERO_COUNT,
          bases: basesAfter,
          batterId: nextBatterId,
        },
        lastUpdated: now,
      };
    }

    // -----------------------------------------------------------------------
    // HIT_BY_PITCH — same effect as a walk
    // -----------------------------------------------------------------------
    case 'HIT_BY_PITCH': {
      const { runnersScored, basesAfter, nextBatterId } = event;
      const scores = applyRuns(currentState, runnersScored, false);
      return {
        ...currentState,
        homeTeam: { ...currentState.homeTeam, score: scores.homeScore },
        awayTeam: { ...currentState.awayTeam, score: scores.awayScore },
        situation: {
          ...sit,
          count: ZERO_COUNT,
          bases: basesAfter,
          batterId: nextBatterId,
        },
        lastUpdated: now,
      };
    }

    // -----------------------------------------------------------------------
    // Exhaustiveness guard — the compiler will error here if a new event type
    // is added to BaseballGameEvent without handling it in this switch.
    // -----------------------------------------------------------------------
    default: {
      const _exhaustive: never = event;
      throw new Error(
        `processBaseballEvent: unhandled event type "${(_exhaustive as BaseballGameEvent).type}"`,
      );
    }
  }
}
