---
name: analyze_matchup
description: Use when the task requires a head-to-head win probability estimate for two college baseball teams. Applies park- and strength-of-schedule-adjusted sabermetrics (wRC+, FIP) combined via log5, with optional Bayesian shrinkage for small samples. Results are cached in Cloudflare KV (5-minute TTL) and session state is persisted in D1.
---

# Analyze Matchup

Use this skill to answer questions like:

- "Who is favored in tonight's Texas vs TCU game?"
- "What is the projected win probability for this weekend's SEC series?"
- "How does Oregon's pitching matchup against LSU's offense look on paper?"

## Working Model

Before computing a matchup probability, establish:

1. **Team identifiers** — BSI team IDs for both sides (`team1_id`, `team2_id`).
2. **Date context** — Is this a live matchup (current season averages) or historical analysis? Pass `date` for historical queries.
3. **Sample size** — College seasons are 55–65 games. Fewer than 30 qualifying PA / IP triggers heavier Bayesian shrinkage automatically.
4. **Session continuity** — Pass `session_id` to enable multi-turn memory (e.g., "now compare them against Florida").

## Methodology

### Adjusted Metrics

| Input | Adjustment | Why |
|-------|-----------|-----|
| Team wRC+ | × `sosFactor` | Credit for facing tougher competition |
| Team FIP  | ÷ (`parkFactor` × `sosFactor`) | Normalize for park and opponent quality |

### Win Probability Pipeline

1. Compute `adjWRCPlus` and `adjFIP` for each team.
2. Convert to a strength scalar: `√((wRC+/100) × (lgFIP/adjFIP))`, where `lgFIP ≈ 4.0` for NCAA DI.
3. Apply log5: `P(A beats B) = (A − A×B) / (A + B − 2×A×B)`.
4. Apply Bayesian shrinkage (default on) to pull estimates toward 0.5 when sample size is small.

### Bayesian Shrinkage

Shrinkage is James-Stein inspired. Key parameters:

| Parameter | Default | Meaning |
|-----------|---------|---------|
| `leagueMean` | 0.5 | Neutral prior |
| `popVar` | 0.012 | Prior variance — controls shrinkage strength |
| `sampleSize` | 100 | Set dynamically from actual game/PA counts in production |

Disable shrinkage with `use_bayesian: false` for end-of-season full samples.

## Caching & State

- **KV cache** (`BSI_CACHE_KV`): Results cached for 5 minutes. Cache key format: `matchup_{team1Id}_{team2Id}_{date}`.
- **D1 state** (`BSI_STATE_D1`): When `session_id` is provided, the tool records the matchup key in `scouted[]` and stores `lastMatchup` in the session. Use `getSessionState` to retrieve history in follow-up turns.

## Output Shape

```typescript
{
  team1_win_prob: number,           // 0–1 probability
  confidence_interval: [lo, hi],    // 95% CI
  breakdown: {
    team1: { offense_adj: number, pitching_adj: number },
    team2: { offense_adj: number, pitching_adj: number },
  },
  assumptions: string[],            // transparency trail
  metadata: {
    cacheHit: boolean,
    latencyMs: number,
    dataFreshness: "live" | "historical" | "error",
    shrinkageApplied?: boolean,
  },
  error?: string,                   // populated only on partial failure
}
```

## Hard Rules

- Never report a win probability without the accompanying confidence interval.
- Always surface `shrinkageApplied` in the narrative when Bayesian shrinkage was used.
- Flag samples under 30 PA or IP as preliminary: "Win probability estimate is preliminary (< 30 innings of data)."
- If `error` is present in the output, explain what data was unavailable rather than presenting the 0.5 default as a meaningful estimate.
- Always list at least two `assumptions` in any narrative summary derived from this tool.

## Production Checklist

Before deploying to the Cloudflare Workers MCP endpoint:

- [ ] Replace placeholder team data in `tool.ts` with real `bsiFetch` calls.
- [ ] Set `BSI_CACHE_KV` and `BSI_STATE_D1` bindings in `wrangler.toml`.
- [ ] Run `wrangler d1 execute bsi-agent-state --command "CREATE TABLE IF NOT EXISTS agent_sessions (session_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)"` to initialise D1.
- [ ] Register this tool in `.mcp.json` and your MCP tool router.
- [ ] Test via `curl -X POST https://blazesportsintel.com/mcp -d '{"tool":"analyze_matchup","input":{"team1_id":"texas","team2_id":"tcu"}}'`.
