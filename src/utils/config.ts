import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

config({ path: resolve(projectRoot, ".env") });

export const TENANT_ID = process.env.PLANNER_TENANT_ID ?? "";
export const CLIENT_ID = process.env.PLANNER_CLIENT_ID ?? "";
export const CLIENT_SECRET = process.env.PLANNER_CLIENT_SECRET ?? "";
export const TOKENS_PATH = resolve(projectRoot, ".tokens.json");

export function validateConfig(): void {
  if (!TENANT_ID) throw new Error("PLANNER_TENANT_ID not set");
  if (!CLIENT_ID) throw new Error("PLANNER_CLIENT_ID not set");
  if (!CLIENT_SECRET) throw new Error("PLANNER_CLIENT_SECRET not set");
}
