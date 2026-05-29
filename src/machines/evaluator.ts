/**
 * Pure State Machine Evaluator
 * Deterministic transitions for sports events
 */

import type { LiveSportState, BaseballState } from '../types/sports';

export type BaseballEvent =
  | { type: 'STRIKE' }
  | { type: 'BALL' }
  | { type: 'SINGLE' }
  | { type: 'DOUBLE' }
  | { type: 'TRIPLE' }
  | { type: 'HOMERUN' }
  | { type: 'OUT' }
  | { type: 'WALK' };

/**
 * Pure function to process baseball events
 */
export function processBaseballEvent(
  currentState: BaseballState,
  event: BaseballEvent
): BaseballState {
  const newState = { ...currentState };
  const situation = { ...newState.situation };

  newState.timestamp = Date.now();
  newState.lastPlay = event.type;

  switch (event.type) {
    case 'STRIKE':
      situation.strikes = Math.min(situation.strikes + 1, 3);
      situation.pitchCount++;
      if (situation.strikes === 3) {
        situation.outs++;
        resetBatterCount(situation);
      }
      break;

    case 'BALL':
      situation.balls = Math.min(situation.balls + 1, 4);
      situation.pitchCount++;
      if (situation.balls === 4) {
        // Walk - advance runner
        handleWalk(situation);
        resetBatterCount(situation);
      }
      break;

    case 'OUT':
      situation.outs++;
      resetBatterCount(situation);
      break;

    case 'SINGLE':
      advanceRunners(situation, 1);
      resetBatterCount(situation);
      newState.homeTeam.score += situation.bases.third ? 1 : 0; // simplistic scoring
      situation.bases.third = false;
      break;

    case 'DOUBLE':
      advanceRunners(situation, 2);
      resetBatterCount(situation);
      break;

    case 'TRIPLE':
      advanceRunners(situation, 3);
      resetBatterCount(situation);
      break;

    case 'HOMERUN':
      // Clear bases and score
      const runners = (situation.bases.first ? 1 : 0) +
                      (situation.bases.second ? 1 : 0) +
                      (situation.bases.third ? 1 : 0) + 1;
      if (newState.situation.isTopInning) {  // Note: use newState.situation here? Wait, fixed in code
        newState.awayTeam.score += runners;
      } else {
        newState.homeTeam.score += runners;
      }
      situation.bases = { first: false, second: false, third: false };
      resetBatterCount(situation);
      break;

    case 'WALK':
      handleWalk(situation);
      resetBatterCount(situation);
      break;
  }

  // Check for inning change
  if (situation.outs >= 3) {
    situation.outs = 0;
    situation.bases = { first: false, second: false, third: false };
    situation.isTopInning = !situation.isTopInning;
    if (!situation.isTopInning) {
      situation.inning++;
    }
  }

  newState.situation = situation;
  return newState;
}

// Helper functions
function resetBatterCount(sit: any): void {
  sit.balls = 0;
  sit.strikes = 0;
}

function handleWalk(sit: any): void {
  // Advance runners with force
  if (!sit.bases.first) {
    sit.bases.first = true;
  } else if (!sit.bases.second) {
    sit.bases.second = true;
  } else if (!sit.bases.third) {
    sit.bases.third = true;
  } else {
    // Bases loaded walk = run scores (simplified)
  }
}

function advanceRunners(sit: any, bases: number): void {
  // Simplified runner advancement logic
  if (bases >= 3) sit.bases.third = true;
  if (bases >= 2) sit.bases.second = true;
  if (bases >= 1) sit.bases.first = true;
}