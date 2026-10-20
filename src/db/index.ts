import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: mysql.Pool };

const pool =
  globalForDb.pool ??
  mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
    timezone: "Z",
    dateStrings: false,
    // DB_SSL=rds uses mysql2's bundled Amazon RDS CA; DB_SSL=true uses Node's default CAs.
    ssl:
      process.env.DB_SSL === "rds"
        ? "Amazon RDS"
        : process.env.DB_SSL === "true"
          ? { rejectUnauthorized: true }
          : undefined,
  });
// All datetimes are stored in UTC regardless of the server's time_zone setting
// (RDS instances in Malaysia are often set to +08:00).
if (!globalForDb.pool) {
  (pool as unknown as { pool: { on: (e: string, cb: (c: { query: (q: string) => void }) => void) => void } }).pool.on(
    "connection",
    (conn) => conn.query("SET time_zone = '+00:00'"),
  );
}
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema, mode: "default" });
export { schema };
