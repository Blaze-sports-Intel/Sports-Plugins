---
name: multi-provider-query
description: Use this skill when a user requests sports data that may come from different provider namespaces, such as cross-sport scoreboards, standings, odds, or team stat lookups.
version: 1.0.0
---

# Multi-Provider Query

Use this skill to answer sports questions by selecting the right `mcp-sports-hub` tool namespace.

## Instructions

1. Classify request type: score, schedule, standings, stats, odds, or player lookup.
2. Pick the likely provider namespace (for example `espn_`, `mlb_`, `nhl_`, `ncaa_`, `odds_`).
3. Call the minimum set of tools needed.
4. Return clear results and cite which provider namespace was used.

## Notes

- Prefer free-provider namespaces first when coverage is comparable.
- If tool access fails due to missing key, tell the user which provider key is needed.
