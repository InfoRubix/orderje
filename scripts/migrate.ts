import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

async function main() {
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL!, multipleStatements: true,
    ssl: process.env.DB_SSL === "rds" ? "Amazon RDS" : process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });
  await conn.query("SET time_zone = '+00:00'");
  await migrate(drizzle(conn), { migrationsFolder: "./drizzle" });
  await conn.end();
  console.log("Migrations applied");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
