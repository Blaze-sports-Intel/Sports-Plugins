/**
 * Shared TypeScript types for Sports-Plugins.
 *
 * These interfaces are used across plugins for consistent data exchange
 * between MCP tool calls, skill outputs, and library functions.
 */

/* ------------------------------------------------------------------ */
/*  Generic                                                           */
/* ------------------------------------------------------------------ */

/** Identifies a league or competition for which data can be retrieved. */
export type League =
  | "mlb"
  | "nfl"
  | "nba"
  | "college-baseball"
  | "college-football";

/** A simple date string in YYYY-MM-DD format. */
export type ISODate = string;

/* ------------------------------------------------------------------ */
/*  Scores                                                            */
/* ------------------------------------------------------------------ */

export type GameStatus = "scheduled" | "in_progress" | "final" | "postponed" | "delayed";

export interface GameScore {
  /** Unique external identifier for the game (e.g., ESPN event ID). */
  id: string;
  league: League;
  status: GameStatus;
  /** ISO-8601 date-time of the scheduled first pitch / kickoff. */
  startTime: string;
  homeTeam: TeamScore;
  awayTeam: TeamScore;
  /** Human-readable period text, e.g. "Top 7th", "Q3 4:32". */
  period?: string;
}

export interface TeamScore {
  name: string;
  abbreviation: string;
  score: number | null;
  rank?: number;
  record?: string;
}

/* ------------------------------------------------------------------ */
/*  Sabermetrics — Batting                                            */
/* ------------------------------------------------------------------ */

export interface BattingLine {
  pa: number;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  hr: number;
  bb: number;
  ibb: number;
  hbp: number;
  sf: number;
  k: number;
  rbi: number;
  sb: number;
  cs: number;
}

export interface BattingAdvanced {
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  wOBA: number;
  wRCPlus: number;
  babip: number;
  iso: number;
  bbPct: number;
  kPct: number;
  barrelPct?: number;
}

/* ------------------------------------------------------------------ */
/*  Sabermetrics — Pitching                                           */
/* ------------------------------------------------------------------ */

export interface PitchingLine {
  ip: number;
  h: number;
  r: number;
  er: number;
  bb: number;
  hbp: number;
  k: number;
  hr: number;
  bf: number;
  pitches?: number;
}

export interface PitchingAdvanced {
  era: number;
  fip: number;
  xfip: number;
  whip: number;
  kPer9: number;
  bbPer9: number;
  hrPer9: number;
  kPerBB: number;
  cswPct?: number;
  whiffPct?: number;
}

/* ------------------------------------------------------------------ */
/*  Player                                                            */
/* ------------------------------------------------------------------ */

export type PlayerPosition =
  | "C"
  | "1B"
  | "2B"
  | "3B"
  | "SS"
  | "LF"
  | "CF"
  | "RF"
  | "DH"
  | "SP"
  | "RP"
  | "UT";

export type PlayerClass = "Fr" | "So" | "Jr" | "Sr" | "R-Fr" | "R-So" | "R-Jr" | "R-Sr";

export interface Player {
  name: string;
  team: string;
  conference?: string;
  position: PlayerPosition;
  playerClass?: PlayerClass;
  bats?: "L" | "R" | "S";
  throws?: "L" | "R";
}

export interface PlayerBattingProfile extends Player {
  batting: BattingLine;
  advanced: BattingAdvanced;
}

export interface PlayerPitchingProfile extends Player {
  pitching: PitchingLine;
  advanced: PitchingAdvanced;
}

/* ------------------------------------------------------------------ */
/*  Team Analytics                                                    */
/* ------------------------------------------------------------------ */

/**
 * Aggregate team stats used by the analyze_matchup tool.
 *
 * `offense` holds the team's collective batting line (aggregated across
 * all hitters) and `pitching` holds the team's aggregate pitching line.
 * `parkFactor` and `sosFactor` are applied when computing adjusted metrics.
 */
export interface TeamStats {
  offense: BattingLine;
  pitching: PitchingLine;
  /** Park factor for the home ballpark (1.0 = neutral). */
  parkFactor: number;
  /** Strength-of-schedule factor (1.0 = average schedule). */
  sosFactor: number;
}

/* ------------------------------------------------------------------ */
/*  Team / Standings                                                  */
/* ------------------------------------------------------------------ */

export interface TeamStanding {
  rank: number;
  name: string;
  conference: string;
  conferenceRecord: string;
  overallRecord: string;
  rpi?: number;
  sos?: number;
  teamWOBA?: number;
  teamFIP?: number;
}

/* ------------------------------------------------------------------ */
/*  MCP Tool Schemas                                                  */
/* ------------------------------------------------------------------ */

/** Shape of a single MCP tool definition for the college-baseball MCP server. */
export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
