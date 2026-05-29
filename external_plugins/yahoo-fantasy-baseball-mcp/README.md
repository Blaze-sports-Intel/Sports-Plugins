# Yahoo Fantasy Baseball MCP Plugin

Integration entry for [yahoo-fantasy-baseball-mcp](https://github.com/jimbrig/yahoo-fantasy-baseball-mcp), focused on Yahoo fantasy baseball roster access.

## Why this plugin

- Direct Yahoo Fantasy Sports API integration
- Useful for roster-aware fantasy assistant workflows
- Good complement to existing fantasy strategy plugins

## Skills

| Skill | Type | Description |
|-------|------|-------------|
| `fantasy-roster-review` | Model-invoked | Pull a Yahoo team roster and summarize positional structure |
| `yahoo-auth-setup` | Model-invoked | Guide users through required Yahoo OAuth environment configuration |

## Current upstream MCP tool

- `get_team_roster`

## Setup requirements

This server currently runs from a local clone/build path and requires:

- `YAHOO_CLIENT_ID`
- `YAHOO_CLIENT_SECRET`
- `YAHOO_ACCESS_TOKEN`

## Source

- Repository: https://github.com/jimbrig/yahoo-fantasy-baseball-mcp
