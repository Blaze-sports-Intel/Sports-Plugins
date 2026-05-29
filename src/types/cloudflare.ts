/**
 * Minimal Cloudflare Workers binding type declarations.
 *
 * In a Cloudflare Workers project these types are normally provided by
 * @cloudflare/workers-types. They are declared here so the rest of the
 * Sports-Plugins TypeScript sources can reference them without adding an
 * additional devDependency to this plugin-library project.
 */

export interface KVNamespace {
  get(key: string): Promise<string | null>;
  get(key: string, options: { type: "json" }): Promise<unknown>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean; error?: string }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
