// Creates a throwaway PostgreSQL database for integration tests and drops it afterwards.
// Never touches the configured development database: it only uses it to find the server,
// creates `bank_test_<random>`, migrates that, and points DATABASE_URL at it.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

export interface TestDatabase {
  name: string;
  url: string;
  drop: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase | null> {
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) return null;

  const name = `bank_test_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const adminUrl = new URL(base);
  adminUrl.pathname = "/postgres";
  const admin = new PrismaClient({ datasourceUrl: adminUrl.toString(), log: [] });

  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  } catch {
    await admin.$disconnect().catch(() => undefined);
    return null; // server not reachable / no permission -> integration tests are skipped
  }

  const testUrl = new URL(base);
  testUrl.pathname = `/${name}`;
  const url = testUrl.toString();

  try {
    execFileSync(
      process.execPath,
      [path.resolve("node_modules/prisma/build/index.js"), "migrate", "deploy"],
      { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe", cwd: process.cwd() }
    );
  } catch (error) {
    await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`).catch(() => undefined);
    await admin.$disconnect().catch(() => undefined);
    throw error;
  }

  // Hard safety: from here on every Prisma client in this process must use the throwaway database.
  process.env.DATABASE_URL = url;
  if (!new URL(process.env.DATABASE_URL).pathname.startsWith("/bank_test_")) {
    throw new Error("Refusing to run integration tests: DATABASE_URL is not a throwaway database.");
  }

  return {
    name,
    url,
    async drop() {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      await admin.$disconnect();
    },
  };
}
