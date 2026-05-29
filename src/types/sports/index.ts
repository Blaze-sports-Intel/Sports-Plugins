/**
 * Unified Sports Type Registry
 * Highly strict discriminated unions for real-time sports state
 */

export type SportType = 'MLB' | 'NBA';

export interface BaseSportState {
  gameId: string;
  sport: SportType;
  timestamp: number;
  status: 'scheduled' | 'live' | 'final';
  homeTeam: { id: string; name: string; score: number };
  awayTeam: { id: string; name: string; score: number };
}

// Baseball Specific
export interface BaseballSituation {
  balls: number;
  strikes: number;
  outs: number;
  bases: {
    first: boolean;
    second: boolean;
    third: boolean;
  };
  inning: number;
  isTopInning: boolean;
  pitchCount: number;
}

export interface BaseballState extends BaseSportState {
  sport: 'MLB';
  situation: BaseballSituation;
  currentBatter: { playerId: string; name: string } | null;
  lastPlay: string | null;
}

// Basketball Specific
export interface BasketballSituation {
  quarter: number;
  timeRemaining: number; // seconds
  shotClock: number; // seconds
  possession: 'home' | 'away';
  foulsHome: number;
  foulsAway: number;
}

export interface BasketballState extends BaseSportState {
  sport: 'NBA';
  situation: BasketballSituation;
  lastScoringPlay: string | null;
}

// Discriminated Union
export type LiveSportState = BaseballState | BasketballState;

// Type Guards
export function isBaseballState(state: LiveSportState): state is BaseballState {
  return state.sport === 'MLB';
}

export function isBasketballState(state: LiveSportState): state is BasketballState {
  return state.sport === 'NBA';
}

// Factory helpers
export function createInitialBaseballState(gameId: string): BaseballState {
  return {
    gameId,
    sport: 'MLB',
    timestamp: Date.now(),
    status: 'live',
    homeTeam: { id: 'HOU', name: 'Astros', score: 0 },
    awayTeam: { id: 'LAD', name: 'Dodgers', score: 0 },
    situation: {
      balls: 0,
      strikes: 0,
      outs: 0,
      bases: { first: false, second: false, third: false },
      inning: 1,
      isTopInning: true,
      pitchCount: 0,
    },
    currentBatter: null,
    lastPlay: null,
  };
}

export function createInitialBasketballState(gameId: string): BasketballState {
  return {
    gameId,
    sport: 'NBA',
    timestamp: Date.now(),
    status: 'live',
    homeTeam: { id: 'LAL', name: 'Lakers', score: 0 },
    awayTeam: { id: 'GSW', name: 'Warriors', score: 0 },
    situation: {
      quarter: 1,
      timeRemaining: 720,
      shotClock: 24,
      possession: 'home',
      foulsHome: 0,
      foulsAway: 0,
    },
    lastScoringPlay: null,
  };
}