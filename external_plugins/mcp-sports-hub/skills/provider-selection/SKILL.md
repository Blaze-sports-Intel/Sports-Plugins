---
name: provider-selection
description: Use this skill when deciding which provider family inside mcp-sports-hub should be used for a specific sport, league, or data domain.
version: 1.0.0
---

# Provider Selection

Use this skill to choose the best provider namespace before making tool calls.

## Instructions

1. Parse sport + league + geography + requested data type.
2. Select the best namespace based on coverage and expected reliability.
3. Prefer stable official or well-known free sources when available.
4. Explain fallback options if the first namespace has incomplete data.

## Example mapping guidance

- US major leagues: start with `espn_`, `mlb_`, `nhl_`
- NCAA use cases: start with `ncaa_`
- Betting/odds: use `odds_`, `oddsio_`, or `sgo_`
