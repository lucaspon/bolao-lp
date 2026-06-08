import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type DB = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
  db?: DB;
};

function createDb(): DB {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Run via `doppler run` or set it in your env.");
  }
  // `prepare: false` is required for Supabase's transaction pooler (port 6543).
  // `max` must comfortably exceed the number of queries a single request fires
  // concurrently (the leaderboard fans out to ~5 via Promise.all). With max:1
  // those concurrent queries pipeline onto one pgBouncer-backed connection and
  // deadlock under cross-region latency, stalling the whole warm instance —
  // including link prefetches, so every navigation appears frozen. The
  // transaction pooler multiplexes these client connections safely.
  const client =
    globalForDb.pgClient ??
    postgres(connectionString, { prepare: false, max: 10, idle_timeout: 20 });
  globalForDb.pgClient = client;
  return drizzle(client, { schema });
}

// Lazy singleton: the DATABASE_URL check is deferred to first use, so importing
// this module during a build without env (e.g. `next build`) does not throw.
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = (globalForDb.db ??= createDb());
    const value = Reflect.get(instance, prop);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
