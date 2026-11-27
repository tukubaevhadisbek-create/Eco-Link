import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
// Тесты всегда работают на отдельной базе.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://ecolink@127.0.0.1:5433/ecolink_test";
