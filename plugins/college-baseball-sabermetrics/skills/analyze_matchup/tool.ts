// plugins/college-baseball-sabermetrics/skills/analyze_matchup/tool.ts
//
// Cloudflare-native analyze_matchup tool.
// Cache layer: KV  (BSI_CACHE_KV)  — 5-minute TTL, globally replicated.
// State layer: D1  (BSI_STATE_D1)  — persistent multi-turn session memory.
//
// Replace the placeholder team-data objects with real bsiFetch calls once
// the BSI MCP data pipeline is wired up.

import type { Env } from "../../../src/index.js";
import { computeWRCPlus, computeFIP } from "../../../lib/sabermetrics.js";
import { getCache, setCache, matchupCacheKey } from "../../../lib/cache.js";
import { addScoutedPlayer, saveSessionState } from "../../../lib/state.js";
import type { TeamStats } from "../../../lib/types.js";

// ---------------------------------------------------------------------------
// League constants
// ---------------------------------------------------------------------------

/** NCAA DI league-average FIP used for pitching-strength normalisation. */
const LG_FIP = 4.0;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Log5 win probability (Bill James).
 *
 * Converts two team strength scalars (1.0 = league-average) into a win
 * probability for team A.
 */
function log5WinProb(strengthA: number, strengthB: number): number {
  const denom = strengthA + strengthB - 2 * strengthA * strengthB;
  if (denom === 0) return 0.5;
  return (strengthA - strengthA * strengthB) / denom;
}

/**
 * Combine adjusted wRC+ and adjusted FIP into a single team-strength scalar.
 *
 * - Offense: wRC+ / 100  (1.0 = league-average bat)
 * - Pitching: lgFIP / adjFIP  (1.0 = league-average arm; lower FIP → higher score)
 * - Combined: geometric mean of the two factors
 */
function teamStrength(adjWRCPlus: number, adjFIP: number): number {
  const offStrength = adjWRCPlus / 100;
  const pitchStrength = adjFIP > 0 ? LG_FIP / adjFIP : 1.0;
  return Math.sqrt(offStrength * pitchStrength);
}

/**
 * Bayesian shrinkage towards the league mean (James-Stein / beta-binomial).
 *
 * Pulls small-sample estimates towards 0.5 to avoid over-confidence.
 *
 * @param observed   - Raw observed win probability.
 * @param leagueMean - Prior mean (0.5 for a balanced prior).
 * @param popVar     - Prior variance (controls how strongly we shrink).
 * @param sampleSize - Number of games or equivalent trials.
 */
function bayesianShrinkage(
  observed: number,
  leagueMean: number,
  popVar: number,
  sampleSize: number,
): { estimate: number; lower: number; upper: number; shrinkageApplied: boolean } {
  const n = Math.max(sampleSize, 30);
  const likelihood = (observed * (1 - observed)) / n;
  const denom = popVar + likelihood;
  const weight = denom > 0 ? popVar / denom : 0;
  const estimate = weight * leagueMean + (1 - weight) * observed;
  const se = Math.sqrt(likelihood);
  return {
    estimate: Math.round(estimate * 1000) / 1000,
    lower: Math.max(0, Math.round((estimate - 1.96 * se) * 1000) / 1000),
    upper: Math.min(1, Math.round((estimate + 1.96 * se) * 1000) / 1000),
    shrinkageApplied: weight < 1,
  };
}

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface AnalyzeMatchupInput {
  /** BSI team identifier for the first team. */
  team1_id: string;
  /** BSI team identifier for the second team. */
  team2_id: string;
  /** Optional game date (YYYY-MM-DD). Omit for current-season averages. */
  date?: string;
  /** Apply Bayesian shrinkage to the win probability estimate. Default: true. */
  use_bayesian?: boolean;
  /** Optional session identifier for D1-backed multi-turn state. */
  session_id?: string;
  /** Minimum plate appearances / innings pitched before trusting a metric. */
  sample_size_threshold?: number;
}

export interface AnalyzeMatchupOutput {
  team1_win_prob: number;
  confidence_interval: [number, number];
  breakdown: {
    team1: { offense_adj: number; pitching_adj: number };
    team2: { offense_adj: number; pitching_adj: number };
  };
  assumptions: string[];
  metadata: {
    cacheHit: boolean;
    latencyMs: number;
    dataFreshness: string;
    shrinkageApplied?: boolean;
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function analyzeMatchup(
  input: AnalyzeMatchupInput,
  env: Env,
): Promise<AnalyzeMatchupOutput> {
  const start = Date.now();
  const cacheKey = matchupCacheKey(input.team1_id, input.team2_id, input.date);

  // 1. KV cache check — return immediately on hit
  const cached = await getCache<AnalyzeMatchupOutput>(env, cacheKey);
  if (cached) {
    return {
      ...cached,
      metadata: { ...cached.metadata, cacheHit: true, latencyMs: Date.now() - start },
    };
  }

  try {
    // 2. Fetch team stats from the BSI data pipeline.
    //    Replace these placeholder objects with real bsiFetch calls, e.g.:
    //      const [team1, team2] = await Promise.all([
    //        bsiFetch('get_team_stats', { team_id: input.team1_id, date: input.date }),
    //        bsiFetch('get_team_stats', { team_id: input.team2_id, date: input.date }),
    //      ]);
    const [team1, team2] = await Promise.all<TeamStats>([
      Promise.resolve({
        offense: {
          pa: 250, ab: 220, h: 72, doubles: 16, triples: 2, hr: 14,
          bb: 25, ibb: 2, hbp: 3, sf: 2, k: 42, rbi: 52, sb: 8, cs: 3,
        },
        pitching: {
          ip: 95, h: 68, r: 30, er: 28, bb: 24, hbp: 5, k: 115, hr: 6,
          bf: 380, pitches: 1480,
        },
        parkFactor: 1.02,
        sosFactor: 0.98,
      }),
      Promise.resolve({
        offense: {
          pa: 240, ab: 210, h: 65, doubles: 13, triples: 1, hr: 12,
          bb: 22, ibb: 1, hbp: 4, sf: 3, k: 50, rbi: 44, sb: 5, cs: 2,
        },
        pitching: {
          ip: 90, h: 72, r: 32, er: 30, bb: 22, hbp: 4, k: 100, hr: 7,
          bf: 365, pitches: 1420,
        },
        parkFactor: 0.97,
        sosFactor: 1.03,
      }),
    ]);

    // 3. Compute park- and SoS-adjusted metrics for each team
    const adjOff1 = computeWRCPlus(team1.offense, team1.parkFactor, team1.sosFactor);
    const adjFIP1 = computeFIP(team1.pitching, team1.parkFactor, team1.sosFactor);
    const adjOff2 = computeWRCPlus(team2.offense, team2.parkFactor, team2.sosFactor);
    const adjFIP2 = computeFIP(team2.pitching, team2.parkFactor, team2.sosFactor);

    // 4. Combine into team-strength scalars then compute log5 win probability
    const s1 = teamStrength(adjOff1, adjFIP1);
    const s2 = teamStrength(adjOff2, adjFIP2);
    const rawWP = log5WinProb(s1, s2);

    // 5. Optionally apply Bayesian shrinkage (default on)
    const useBayesian = input.use_bayesian !== false;
    const sampleSize = input.sample_size_threshold ?? 100;
    const wpResult = useBayesian
      ? bayesianShrinkage(rawWP, 0.5, 0.012, sampleSize)
      : {
          estimate: Math.round(rawWP * 1000) / 1000,
          lower: Math.max(0, Math.round((rawWP - 0.08) * 1000) / 1000),
          upper: Math.min(1, Math.round((rawWP + 0.08) * 1000) / 1000),
          shrinkageApplied: false,
        };

    const result: AnalyzeMatchupOutput = {
      team1_win_prob: wpResult.estimate,
      confidence_interval: [wpResult.lower, wpResult.upper],
      breakdown: {
        team1: {
          offense_adj: Math.round(adjOff1 * 10) / 10,
          pitching_adj: Math.round(adjFIP1 * 100) / 100,
        },
        team2: {
          offense_adj: Math.round(adjOff2 * 10) / 10,
          pitching_adj: Math.round(adjFIP2 * 100) / 100,
        },
      },
      assumptions: [
        "BBCOR-calibrated linear weights (NCAA DI 2024-26)",
        `Park & SoS factors applied (team1 PF=${team1.parkFactor}, SoS=${team1.sosFactor}; ` +
          `team2 PF=${team2.parkFactor}, SoS=${team2.sosFactor})`,
        useBayesian
          ? "Bayesian shrinkage applied (prior mean=0.50, popVar=0.012)"
          : "Raw log5 only — no shrinkage",
        "Replace placeholder team data with real bsiFetch calls for production use",
      ],
      metadata: {
        cacheHit: false,
        latencyMs: Date.now() - start,
        dataFreshness: input.date ? "historical" : "live",
        shrinkageApplied: wpResult.shrinkageApplied,
      },
    };

    // 6. Write result to KV (5-minute TTL)
    await setCache(env, cacheKey, result, { ttlSeconds: 300 });

    // 7. Update D1 session state if a session ID was provided
    if (input.session_id) {
      const matchupKey = `${input.team1_id}_vs_${input.team2_id}`;
      await addScoutedPlayer(env, input.session_id, matchupKey);
      await saveSessionState(env, input.session_id, { lastMatchup: result });
    }

    return result;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[analyze_matchup error]", error);
    return {
      team1_win_prob: 0.5,
      confidence_interval: [0.4, 0.6],
      breakdown: {
        team1: { offense_adj: 0, pitching_adj: 0 },
        team2: { offense_adj: 0, pitching_adj: 0 },
      },
      assumptions: ["Partial result — an error occurred during computation"],
      metadata: {
        cacheHit: false,
        latencyMs: Date.now() - start,
        dataFreshness: "error",
        shrinkageApplied: false,
      },
      error: message,
    };
  }
}
