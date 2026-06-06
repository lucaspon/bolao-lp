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
  // `prepare: false` keeps us compatible with connection poolers (Neon's pooled
  // endpoint / PgBouncer). One client is reused across hot reloads in dev.
  const client = globalForDb.pgClient ?? postgres(connectionString, { prepare: false });
  if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;
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
