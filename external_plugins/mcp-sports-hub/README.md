# MCP Sports Hub Plugin

Integration for [mcp-sports-hub](https://github.com/lacausecrypto/mcp-sports-hub), a unified MCP server that exposes many sports data providers from one installation.

## Why this plugin

- High tool breadth from a single MCP server
- Free-provider preset works without API keys
- Supports major US sports, college sports, soccer, chess, motorsport, and more
- Expandable with optional provider keys when needed

## Skills

| Skill | Type | Description |
|-------|------|-------------|
| `multi-provider-query` | Model-invoked | Route requests to the best provider namespace for scores, stats, and schedules |
| `provider-selection` | Model-invoked | Choose the right provider/tool family based on sport, geography, and data type |

## Suggested setup

Default to free providers:

```json
{
  "SPORTS_HUB_PROVIDERS": "free"
}
```

Expand later with API keys for paid/free-tier providers as needed.

## Source

- Repository: https://github.com/lacausecrypto/mcp-sports-hub
- Package: https://www.npmjs.com/package/mcp-sports-hub
