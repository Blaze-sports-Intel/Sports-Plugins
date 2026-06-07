/**
 * Sabermetrics calculation library for college baseball analytics.
 *
 * All formulas follow standard Sabermetric definitions with optional
 * adjustments for the NCAA college baseball environment (BBCOR bats,
 * smaller sample sizes, park-factor variance).
 *
 * Usage:
 *   import { wOBA, fip, wRCPlus, babip, iso, kPct, bbPct, cswPct } from "./sabermetrics.js";
 */

import type { BattingLine, PitchingLine, BattingAdvanced, PitchingAdvanced } from "./types.js";

/* ------------------------------------------------------------------ */
/*  Constants — linear weights (NCAA-calibrated 2024-26 averages)     */
/* ------------------------------------------------------------------ */

/**
 * NCAA DI linear weights for wOBA.  These are slightly different from
 * MLB because the college run environment is higher (BBCOR bats, but
 * smaller parks, weaker pitching depth).  Recalibrate each season.
 */
export const NCAA_WOBA_WEIGHTS = {
  uBB: 0.69,
  HBP: 0.72,
  single: 0.89,
  double: 1.27,
  triple: 1.62,
  HR: 2.10,
} as const;

/** wOBA scale factor for converting wOBA to wRAA. */
export const WOBA_SCALE = 1.15;

/** League-average wOBA (NCAA DI — approximate). */
export const LG_WOBA = 0.32;

/** League-average runs per plate appearance (NCAA DI). */
export const LG_R_PER_PA = 0.126;

/** FIP constant — recalculated each season so league FIP ≈ league ERA. */
export const FIP_CONSTANT = 3.1;

/** League-average HR/FB rate for xFIP normalisation. */
export const LG_HR_PER_FB = 0.1;

/* ------------------------------------------------------------------ */
/*  Batting metrics                                                   */
/* ------------------------------------------------------------------ */

/** Batting average. */
export function avg(line: BattingLine): number {
  return line.ab === 0 ? 0 : line.h / line.ab;
}

/** On-base percentage. */
export function obp(line: BattingLine): number {
  const denom = line.ab + line.bb + line.hbp + line.sf;
  return denom === 0 ? 0 : (line.h + line.bb + line.hbp) / denom;
}

/** Slugging percentage. */
export function slg(line: BattingLine): number {
  if (line.ab === 0) return 0;
  const singles = line.h - line.doubles - line.triples - line.hr;
  const totalBases = singles + 2 * line.doubles + 3 * line.triples + 4 * line.hr;
  return totalBases / line.ab;
}

/** OPS (on-base plus slugging). */
export function ops(line: BattingLine): number {
  return obp(line) + slg(line);
}

/**
 * Weighted On-Base Average.
 * wOBA = (w×uBB + w×HBP + w×1B + w×2B + w×3B + w×HR) / (AB + BB − IBB + SF + HBP)
 */
export function wOBA(line: BattingLine): number {
  const singles = line.h - line.doubles - line.triples - line.hr;
  const uBB = line.bb - line.ibb;
  const numerator =
    NCAA_WOBA_WEIGHTS.uBB * uBB +
    NCAA_WOBA_WEIGHTS.HBP * line.hbp +
    NCAA_WOBA_WEIGHTS.single * singles +
    NCAA_WOBA_WEIGHTS.double * line.doubles +
    NCAA_WOBA_WEIGHTS.triple * line.triples +
    NCAA_WOBA_WEIGHTS.HR * line.hr;
  const denom = line.ab + line.bb - line.ibb + line.sf + line.hbp;
  return denom === 0 ? 0 : numerator / denom;
}

/**
 * Weighted Runs Above Average (total, not per PA).
 */
export function wRAA(line: BattingLine): number {
  return ((wOBA(line) - LG_WOBA) / WOBA_SCALE) * line.pa;
}

/**
 * Weighted Runs Created Plus (league-adjusted, 100 = average).
 *
 * Simplified (no park factor):
 *   wRC+ = ((wRAA/PA + lgR/PA) / lgR/PA) × 100
 *
 * @param parkFactor — defaults to 1.0 (neutral).
 */
export function wRCPlus(line: BattingLine, parkFactor = 1.0): number {
  if (line.pa === 0) return 0;
  const wRAAPerPA = wRAA(line) / line.pa;
  const adjLgR = LG_R_PER_PA * parkFactor;
  return ((wRAAPerPA + LG_R_PER_PA + (LG_R_PER_PA - adjLgR)) / LG_R_PER_PA) * 100;
}

/**
 * Batting Average on Balls in Play.
 * BABIP = (H − HR) / (AB − K − HR + SF)
 */
export function babip(line: BattingLine): number {
  const denom = line.ab - line.k - line.hr + line.sf;
  return denom <= 0 ? 0 : (line.h - line.hr) / denom;
}

/** Isolated Power — SLG minus AVG. */
export function iso(line: BattingLine): number {
  return slg(line) - avg(line);
}

/** Strikeout percentage. */
export function kPct(line: BattingLine): number {
  return line.pa === 0 ? 0 : line.k / line.pa;
}

/** Walk percentage. */
export function bbPct(line: BattingLine): number {
  return line.pa === 0 ? 0 : line.bb / line.pa;
}

/**
 * Build a complete BattingAdvanced object from a raw BattingLine.
 */
export function computeBattingAdvanced(line: BattingLine, parkFactor = 1.0): BattingAdvanced {
  return {
    avg: avg(line),
    obp: obp(line),
    slg: slg(line),
    ops: ops(line),
    wOBA: wOBA(line),
    wRCPlus: wRCPlus(line, parkFactor),
    babip: babip(line),
    iso: iso(line),
    bbPct: bbPct(line),
    kPct: kPct(line),
  };
}

/**
 * Park- and strength-of-schedule-adjusted wRC+.
 *
 * A sosFactor > 1 means the team faced tougher-than-average competition
 * (their output is more impressive, so the metric is scaled up accordingly).
 */
export function computeWRCPlus(
  line: BattingLine,
  parkFactor = 1.0,
  sosFactor = 1.0,
): number {
  return wRCPlus(line, parkFactor) * sosFactor;
}

/**
 * Park- and strength-of-schedule-adjusted FIP.
 *
 * A sosFactor > 1 means the pitcher faced tougher-than-average offenses,
 * which tends to inflate raw FIP. Dividing by sosFactor gives credit for
 * the quality of opposition faced.
 */
export function computeFIP(
  line: PitchingLine,
  parkFactor = 1.0,
  sosFactor = 1.0,
): number {
  // Park adjustment: pitcher-friendly parks (PF < 1) lower FIP, hitter-friendly raise it.
  const parkAdjustedFIP = fip(line) / Math.max(parkFactor, 0.01);
  return parkAdjustedFIP / Math.max(sosFactor, 0.01);
}

/* ------------------------------------------------------------------ */
/*  Pitching metrics                                                  */
/* ------------------------------------------------------------------ */

/** Earned Run Average. */
export function era(line: PitchingLine): number {
  return line.ip === 0 ? 0 : (line.er / line.ip) * 9;
}

/**
 * Fielding Independent Pitching.
 * FIP = ((13×HR) + (3×(BB+HBP)) − (2×K)) / IP + FIP_constant
 */
export function fip(line: PitchingLine): number {
  if (line.ip === 0) return 0;
  return (13 * line.hr + 3 * (line.bb + line.hbp) - 2 * line.k) / line.ip + FIP_CONSTANT;
}

/**
 * Expected FIP — normalises HR to league-average HR/FB rate.
 *
 * Uses a rough fly-ball estimate: FB ≈ (BF − K − BB − HBP) × 0.35
 * (standard ~35 % FB rate when exact FB data is unavailable).
 *
 * Clamp derived count estimates to 0 so inconsistent input data
 * cannot produce impossible negative expected HR totals.
 */
export function xfip(line: PitchingLine): number {
  if (line.ip === 0) return 0;
  const bip = Math.max(0, line.bf - line.k - line.bb - line.hbp);
  const estFB = Math.max(0, bip * 0.35);
  const expectedHR = Math.max(0, estFB * LG_HR_PER_FB);
  return (13 * expectedHR + 3 * (line.bb + line.hbp) - 2 * line.k) / line.ip + FIP_CONSTANT;
}

/** WHIP — Walks + Hits per Inning Pitched. */
export function whip(line: PitchingLine): number {
  return line.ip === 0 ? 0 : (line.bb + line.h) / line.ip;
}

/** Strikeouts per 9 innings. */
export function kPer9(line: PitchingLine): number {
  return line.ip === 0 ? 0 : (line.k / line.ip) * 9;
}

/** Walks per 9 innings. */
export function bbPer9(line: PitchingLine): number {
  return line.ip === 0 ? 0 : (line.bb / line.ip) * 9;
}

/** Home runs per 9 innings. */
export function hrPer9(line: PitchingLine): number {
  return line.ip === 0 ? 0 : (line.hr / line.ip) * 9;
}

/** K/BB ratio. */
export function kPerBB(line: PitchingLine): number {
  return line.bb === 0 ? line.k > 0 ? Infinity : 0 : line.k / line.bb;
}

/**
 * Called Strike + Whiff percentage.
 *
 * Requires pitch-level data — `calledStrikes` and `whiffs` must be
 * supplied separately since they aren't part of the standard line.
 */
export function cswPct(calledStrikes: number, whiffs: number, totalPitches: number): number {
  return totalPitches === 0 ? 0 : (calledStrikes + whiffs) / totalPitches;
}

/**
 * Build a complete PitchingAdvanced object from a raw PitchingLine.
 */
export function computePitchingAdvanced(line: PitchingLine): PitchingAdvanced {
  return {
    era: era(line),
    fip: fip(line),
    xfip: xfip(line),
    whip: whip(line),
    kPer9: kPer9(line),
    bbPer9: bbPer9(line),
    hrPer9: hrPer9(line),
    kPerBB: kPerBB(line),
  };
}
