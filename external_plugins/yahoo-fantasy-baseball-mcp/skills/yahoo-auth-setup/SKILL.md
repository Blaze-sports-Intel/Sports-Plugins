---
name: yahoo-auth-setup
description: Use this skill when users need help configuring Yahoo OAuth credentials for the yahoo-fantasy-baseball MCP server.
version: 1.0.0
---

# Yahoo Auth Setup

Use this skill to help users complete Yahoo Fantasy API configuration.

## Instructions

1. Confirm user has a Yahoo Developer app with Fantasy Sports access.
2. Ensure `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET` are configured.
3. Ensure a valid `YAHOO_ACCESS_TOKEN` is set.
4. Advise rerunning the server after env updates.

## Notes

- Do not request users to paste secrets in shared outputs.
- If auth fails, ask for exact error text and isolate whether credentials or token freshness is the issue.
