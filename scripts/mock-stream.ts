/**
 * Mock Streaming Server — `scripts/mock-stream.ts`
 *
 * Local development utility that simulates a live-baseball data feed over
 * WebSockets. Start it with:
 *
 *   npx tsx scripts/mock-stream.ts
 *
 * Connect any WebSocket client to `ws://localhost:8080` to receive a stream
 * of serialized `BaseballState` JSON ticks every 1.5 seconds.
 *
 * The server fast-forwards a dummy MLB game by randomly selecting from a
 * weighted pool of play events, applying each to the current state via the
 * pure `processBaseballEvent` function, then broadcasting the result.
 *
 * No vendor API keys or network access are required — this is entirely local.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { processBaseballEvent } from '../src/machines/evaluator.js';
import type { BaseballGameEvent } from '../src/machines/evaluator.js';
import type {
  BaseballState,
  Bases,
} from '../src/types/sports/index.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = 8080;
/** Interval between state-change ticks in milliseconds. */
const TICK_INTERVAL_MS = 1500;

// ---------------------------------------------------------------------------
// Dummy roster — enough player IDs to populate the simulation
// ---------------------------------------------------------------------------

/** Home team batting order (9 players). */
const HOME_LINEUP: readonly string[] = [
  'h-p1', 'h-p2', 'h-p3', 'h-p4', 'h-p5',
  'h-p6', 'h-p7', 'h-p8', 'h-p9',
];

/** Away team batting order (9 players). */
const AWAY_LINEUP: readonly string[] = [
  'a-p1', 'a-p2', 'a-p3', 'a-p4', 'a-p5',
  'a-p6', 'a-p7', 'a-p8', 'a-p9',
];

const HOME_PITCHER = 'h-sp1';
const AWAY_PITCHER = 'a-sp1';

// ---------------------------------------------------------------------------
// Batting order tracker
// ---------------------------------------------------------------------------

/** Tracks the current batter index within a lineup. */
let homeLineupIdx = 0;
let awayLineupIdx = 0;

function currentBatter(half: 'top' | 'bottom'): string {
  return half === 'top'
    ? AWAY_LINEUP[awayLineupIdx % AWAY_LINEUP.length]
    : HOME_LINEUP[homeLineupIdx % HOME_LINEUP.length];
}

function nextBatter(half: 'top' | 'bottom'): string {
  if (half === 'top') {
    awayLineupIdx += 1;
    return AWAY_LINEUP[awayLineupIdx % AWAY_LINEUP.length];
  }
  homeLineupIdx += 1;
  return HOME_LINEUP[homeLineupIdx % HOME_LINEUP.length];
}

// ---------------------------------------------------------------------------
// Initial game state
// ---------------------------------------------------------------------------

function buildInitialState(): BaseballState {
  const batterId = currentBatter('top');
  return {
    type: 'MLB',
    gameId: 'mock-mlb-2025-09-14-home-away',
    status: 'in-progress',
    homeTeam: { teamId: 'home', abbreviation: 'HOM', score: 0 },
    awayTeam: { teamId: 'away', abbreviation: 'AWY', score: 0 },
    situation: {
      inning: 1,
      half: 'top',
      outs: 0,
      count: { balls: 0, strikes: 0 },
      bases: { first: null, second: null, third: null },
      batterId,
      pitcherId: HOME_PITCHER,
    },
    lastUpdated: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Random event generator
// ---------------------------------------------------------------------------

/** Returns `true` with probability `p` (0–1). */
function chance(p: number): boolean {
  return Math.random() < p;
}

/** Pick a random element from a non-empty array. */
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Advance a runner N bases from their current base, returning their new
 * base name (or `null` if they scored).
 */
type BaseName = 'first' | 'second' | 'third';

function advanceBase(from: BaseName, by: number): BaseName | null {
  const order: BaseName[] = ['first', 'second', 'third'];
  const idx = order.indexOf(from) + by;
  return idx >= order.length ? null : order[idx];
}

/**
 * Build the post-hit `Bases` object after a batter hits for `hitBases` bases.
 * Runners advance by the same number of bases (simplified model).
 * Returns `{ bases, runnersScored }`.
 */
function advanceRunnersOnHit(
  currentBases: Bases,
  hitBases: number,
  batterId: string,
): { bases: Bases; runnersScored: string[] } {
  const scored: string[] = [];
  let newFirst: string | null = null;
  let newSecond: string | null = null;
  let newThird: string | null = null;

  // Advance existing runners
  for (const base of ['first', 'second', 'third'] as BaseName[]) {
    const runnerId = currentBases[base];
    if (runnerId === null) continue;
    const dest = advanceBase(base, hitBases);
    if (dest === null) {
      scored.push(runnerId);
    } else if (dest === 'first') {
      newFirst = runnerId;
    } else if (dest === 'second') {
      newSecond = runnerId;
    } else {
      newThird = runnerId;
    }
  }

  // Place the batter
  if (hitBases === 1) newFirst = batterId;
  else if (hitBases === 2) newSecond = batterId;
  else if (hitBases === 3) newThird = batterId;
  // hitBases === 4 (HR) → batter scores, handled separately

  return {
    bases: { first: newFirst, second: newSecond, third: newThird },
    runnersScored: scored,
  };
}

/**
 * Apply a force-walk advance: if first base is occupied, push runners forward.
 */
function walkAdvance(
  currentBases: Bases,
  batterId: string,
): { bases: Bases; runnersScored: string[] } {
  const scored: string[] = [];
  let { first, second, third } = currentBases;

  if (first !== null && second !== null && third !== null) {
    // Bases loaded — runner on third scores
    scored.push(third);
    third = second;
    second = first;
    first = batterId;
  } else if (first !== null && second !== null) {
    third = second;
    second = first;
    first = batterId;
  } else if (first !== null) {
    second = first;
    first = batterId;
  } else {
    first = batterId;
  }

  return { bases: { first, second, third }, runnersScored: scored };
}

/**
 * Generate a random play event weighted toward realistic baseball outcomes.
 * Plate appearance distribution (rough MLB averages):
 *   ~20 % walks/HBP, ~22 % strikeouts, ~5 % HR, ~20 % singles,
 *   ~9 % doubles, ~2 % triples, ~22 % outs in play.
 *
 * Within a PA we simulate individual pitches (balls/strikes) until the PA ends.
 */
function generateEvent(state: BaseballState): BaseballGameEvent {
  const sit = state.situation!;
  const { balls, strikes } = sit.count;
  const batter = sit.batterId;

  // PA-ending events based on current count
  const fullCount = balls === 3 && strikes === 2;
  const twoStrikes = strikes === 2;
  const threeBalls = balls === 3;

  // Force a resolution on full count
  if (fullCount) {
    return resolvePA(state);
  }

  // Weighted: 45 % pitch (ball or strike), 55 % resolve PA early
  if (chance(0.45) && !twoStrikes && !threeBalls) {
    // Pitch
    if (chance(0.52)) {
      return { type: 'STRIKE' };
    }
    return { type: 'BALL' };
  }

  return resolvePA(state);
}

/** Generate a plate-appearance-ending event. */
function resolvePA(state: BaseballState): BaseballGameEvent {
  const sit = state.situation!;
  const batter = sit.batterId;
  const r = Math.random();

  // Determine next batter first
  const nextBatterId = nextBatter(sit.half);

  if (r < 0.22) {
    // Strikeout
    return { type: 'STRIKEOUT', nextBatterId };
  }
  if (r < 0.42) {
    // Out in play
    const { bases } = advanceRunnersOnHit(sit.bases, 0, batter);
    return {
      type: 'OUT',
      basesAfter: bases,
      runnersScored: [],
      nextBatterId,
    };
  }
  if (r < 0.56) {
    // Single
    const { bases, runnersScored } = advanceRunnersOnHit(sit.bases, 1, batter);
    return { type: 'SINGLE', batterId: batter, basesAfter: bases, runnersScored, nextBatterId };
  }
  if (r < 0.65) {
    // Double
    const { bases, runnersScored } = advanceRunnersOnHit(sit.bases, 2, batter);
    return { type: 'DOUBLE', batterId: batter, basesAfter: bases, runnersScored, nextBatterId };
  }
  if (r < 0.67) {
    // Triple
    const { bases, runnersScored } = advanceRunnersOnHit(sit.bases, 3, batter);
    return { type: 'TRIPLE', batterId: batter, basesAfter: bases, runnersScored, nextBatterId };
  }
  if (r < 0.72) {
    // Home run
    return { type: 'HOME_RUN', batterId: batter, nextBatterId };
  }
  // Walk (remaining ~28 %)
  const { bases, runnersScored } = walkAdvance(sit.bases, batter);
  return { type: 'WALK', batterId: batter, basesAfter: bases, runnersScored, nextBatterId };
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ port: PORT });

console.log(`[mock-stream] WebSocket server listening on ws://localhost:${PORT}`);
console.log('[mock-stream] Connect any client to receive live BaseballState ticks.');

let gameState: BaseballState = buildInitialState();

/** Broadcast the current state to all connected clients. */
function broadcast(state: BaseballState): void {
  const payload = JSON.stringify(state);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

wss.on('connection', (ws) => {
  console.log('[mock-stream] Client connected.');
  // Send the current state immediately on connect.
  ws.send(JSON.stringify(gameState));

  ws.on('close', () => {
    console.log('[mock-stream] Client disconnected.');
  });
});

// Advance the game on every tick.
const ticker = setInterval(() => {
  if (gameState.status !== 'in-progress') {
    console.log('[mock-stream] Game is over. Stopping ticker.');
    clearInterval(ticker);
    return;
  }

  const sit = gameState.situation!;

  try {
    const event = generateEvent(gameState);

    // Log the event for visibility
    const countStr = `${sit.count.balls}-${sit.count.strikes}`;
    const halfStr = `${sit.half === 'top' ? 'T' : 'B'}${sit.inning}`;
    console.log(`[mock-stream] ${halfStr} | ${sit.outs} out | ${countStr} | → ${event.type}`);

    gameState = processBaseballEvent(gameState, event);

    // End the game after 9 innings (when inning > 9 and bottom half completed).
    const newSit = gameState.situation;
    if (newSit && newSit.inning > 9 && newSit.half === 'top') {
      gameState = { ...gameState, status: 'final', situation: null };
      console.log(
        `[mock-stream] Final: ${gameState.awayTeam.abbreviation} ${gameState.awayTeam.score} – ` +
          `${gameState.homeTeam.abbreviation} ${gameState.homeTeam.score}`,
      );
    }

    broadcast(gameState);
  } catch (err) {
    console.error('[mock-stream] Error applying event:', err);
  }
}, TICK_INTERVAL_MS);
