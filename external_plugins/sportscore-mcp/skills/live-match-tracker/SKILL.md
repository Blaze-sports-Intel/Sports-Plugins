---
name: live-match-tracker
description: Use this skill when the user asks for live games, in-progress score checks, current match status, or recent results in football, basketball, cricket, or tennis.
version: 1.0.0
---

# Live Match Tracker

Use this skill to fetch and summarize live and recent matches by sport.

## Instructions

1. Identify the target sport from the user request.
2. Use `get_matches` first to list live/recent events.
3. If the user asks for one game, call `get_match_detail` for deeper context.
4. Return a compact summary with status, scoreline, and next relevant action.

## Notes

- If no live games exist, return the most recent completed results.
- If a sport is missing, ask a concise clarification question.
