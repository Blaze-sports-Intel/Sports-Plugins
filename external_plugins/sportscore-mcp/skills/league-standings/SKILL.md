---
name: league-standings
description: Use this skill when the user asks for standings tables, table position checks, title races, relegation status, or top scorers in a specific competition.
version: 1.0.0
---

# League Standings

Use this skill to fetch standings and top-scorer context for a competition.

## Instructions

1. Resolve sport and league/competition slug from the request.
2. Call `get_standings` for the competition table.
3. If requested, call `get_top_scorers` for leader context.
4. Present rank, points/record context, and movement implications.

## Notes

- If slug is unknown, ask for league name and season context.
- Keep output concise and sortable (top contenders + key cutoff lines).
