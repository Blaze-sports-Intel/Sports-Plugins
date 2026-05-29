/**
 * Cloudflare Workers environment bindings for the BSI MCP Worker.
 *
 * Import this wherever a tool handler needs access to KV or D1:
 *   import type { Env } from "../../src/index.js";
 */

import type { KVNamespace, D1Database } from "./cloudflare.js";

export interface Env {
  /** KV namespace for short-lived, globally replicated matchup result cache. */
  BSI_CACHE_KV: KVNamespace;
  /** D1 database for persistent multi-turn agent session state. */
  BSI_STATE_D1: D1Database;
}
