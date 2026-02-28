import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, "utf8");
  const map = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const key = line.slice(0, i).trim().replace(/^\uFEFF/, "");
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

function requireValue(env, keys, label) {
  for (const k of keys) {
    if (env[k]) return env[k];
  }
  throw new Error(`Missing ${label}. Set one of: ${keys.join(", ")} in .env/.env.local`);
}

function deriveProjectRef(supabaseUrl) {
  return new URL(supabaseUrl).hostname.split(".")[0];
}

const env = {
  ...readEnvFile(path.join(ROOT, ".env")),
  ...readEnvFile(path.join(ROOT, ".env.local")),
  ...process.env
};

const supabaseUrl = requireValue(env, ["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"], "SUPABASE_URL");
const supabaseAnonKey = requireValue(
  env,
  ["SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"],
  "SUPABASE_ANON_KEY"
);
const projectRef = env.SUPABASE_PROJECT_REF || deriveProjectRef(supabaseUrl);
const initialUsername = env.INITIAL_USERNAME || "admin";
const initialPassword = env.INITIAL_PASSWORD || "123456";

const configJs = `export const SUPABASE_URL = "${supabaseUrl}";
export const SUPABASE_ANON_KEY = "${supabaseAnonKey}";
export const FUNCTIONS_BASE = \`\${SUPABASE_URL}/functions/v1\`;

export const INITIAL_USERNAME = "${initialUsername}";
export const INITIAL_PASSWORD = "${initialPassword}";
`;

fs.writeFileSync(path.join(ROOT, "config.js"), configJs, "utf8");
if (fs.existsSync(path.join(ROOT, "www"))) {
  fs.writeFileSync(path.join(ROOT, "www", "config.js"), configJs, "utf8");
}

console.log("Synced env to config.js");
console.log(`SUPABASE_PROJECT_REF=${projectRef}`);
