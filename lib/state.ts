/**
 * Cloudflare D1-backed persistent agent session state.
 *
 * D1 gives multi-turn memory that survives across Worker invocations —
 * unlike in-memory Maps which evaporate on cold start.
 *
 * Typical use: remember which players have been scouted this session,
 * store the last matchup result for follow-up questions, etc.
 */

import type { Env } from "../src/index.js";

export interface SessionState {
  sessionId: string;
  /** Arbitrary JSON payload merged on every upsert. */
  data: Record<string, unknown>;
  updatedAt: string;
}

/**
 * Create the `agent_sessions` table if it does not already exist.
 *
 * Call once during Worker startup or via a dedicated initialisation route.
 */
export async function initStateTable(env: Env): Promise<void> {
  await env.BSI_STATE_D1.prepare(
    `CREATE TABLE IF NOT EXISTS agent_sessions (
       session_id TEXT PRIMARY KEY,
       data       TEXT NOT NULL,
       updated_at TEXT DEFAULT CURRENT_TIMESTAMP
     )`,
  ).run();
}

/**
 * Retrieve session state by ID. Returns `null` if no session exists yet.
 */
export async function getSessionState(
  env: Env,
  sessionId: string,
): Promise<SessionState | null> {
  const result = await env.BSI_STATE_D1
    .prepare(
      "SELECT data, updated_at FROM agent_sessions WHERE session_id = ?",
    )
    .bind(sessionId)
    .first<{ data: string; updated_at: string }>();

  if (!result) return null;

  return {
    sessionId,
    data: JSON.parse(result.data) as Record<string, unknown>,
    updatedAt: result.updated_at,
  };
}

/**
 * Upsert session state, merging `newData` with any existing data.
 *
 * Keys present in both the existing state and `newData` are overwritten
 * by the incoming values (shallow merge).
 */
export async function saveSessionState(
  env: Env,
  sessionId: string,
  newData: Record<string, unknown>,
): Promise<void> {
  const existing = await getSessionState(env, sessionId);
  const merged = existing ? { ...existing.data, ...newData } : newData;

  await env.BSI_STATE_D1
    .prepare(
      `INSERT INTO agent_sessions (session_id, data)
       VALUES (?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         data       = excluded.data,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(sessionId, JSON.stringify(merged))
    .run();
}

/**
 * Append a player ID to the session's `scouted` list (deduplicates automatically).
 */
export async function addScoutedPlayer(
  env: Env,
  sessionId: string,
  playerId: string,
): Promise<void> {
  const state = await getSessionState(env, sessionId);
  const scouted = new Set<string>(
    Array.isArray(state?.data?.scouted) ? (state.data.scouted as string[]) : [],
  );
  scouted.add(playerId);
  await saveSessionState(env, sessionId, { scouted: Array.from(scouted) });
}
