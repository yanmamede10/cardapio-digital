import assert from "node:assert/strict";
import { after, test } from "node:test";
import { PrismaClient } from "@prisma/client";

// Security checks that aren't about one screen. The test database is the one tests/run.mjs migrated.
const db = new PrismaClient();
after(() => db.$disconnect());

test("RLS ligado em todas as tabelas do schema public (a API segue funcionando: ela é dona das tabelas)", async () => {
  const tables = await db.$queryRaw<{ tablename: string; rowsecurity: boolean }[]>`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
  assert.ok(tables.length >= 21, `só ${tables.length} tabelas`);
  assert.deepEqual(tables.filter((t) => !t.rowsecurity).map((t) => t.tablename), []);
});
