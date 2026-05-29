# SportScore MCP Plugin

Integration for the open-source [sportscore-mcp](https://github.com/Backspace-me/sportscore-mcp) server.

## Why this plugin

- Broad multi-sport coverage (football, basketball, cricket, tennis)
- Free public API (no API key required)
- Live matches, standings, top scorers, brackets, and player data
- Works through a simple `npx` MCP setup

## Skills

| Skill | Type | Description |
|-------|------|-------------|
| `live-match-tracker` | Model-invoked | Pull live and recent games for a sport and summarize active scorelines |
| `league-standings` | Model-invoked | Retrieve standings and top scorers for a selected competition |

## MCP Tools (from upstream)

- `get_matches`
- `get_match_detail`
- `get_team_schedule`
- `get_standings`
- `get_top_scorers`
- `get_player`
- `get_bracket`
- `get_tracker`

## Source

- Repository: https://github.com/Backspace-me/sportscore-mcp
- Docs: https://sportscore.com/developers/
