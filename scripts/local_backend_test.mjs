import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

const env = {
  ...readEnvFile(path.join(ROOT, ".env")),
  ...readEnvFile(path.join(ROOT, ".env.local"))
};

const SUPABASE_URL = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
const USERNAME = env.INITIAL_USERNAME || "admin";
const PASSWORD = env.INITIAL_PASSWORD || "123456";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing SUPABASE config. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env"
  );
}

function usernameToAuthEmail(username) {
  const normalized = username.trim().toLowerCase();
  const hex = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 32);
  return `u${hex}@example.com`;
}

async function signIn(email, password) {
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`登录失败: ${data?.msg || data?.error_description || data?.error || resp.status}`);
  }
  return data.access_token;
}

async function callFunction(pathname, token) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${pathname}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY
    }
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`${pathname} 调用失败: ${data?.error || resp.status}`);
  }
  return data;
}

async function main() {
  const email = usernameToAuthEmail(USERNAME);
  const token = await signIn(email, PASSWORD);
  const items = await callFunction("food-items", token);
  const stats = await callFunction("dashboard-stats?range=7", token);

  console.log("后端联调成功");
  console.log(`用户: ${USERNAME}`);
  console.log(`food-items 数量: ${(items.items || []).length}`);
  console.log("dashboard-stats:", stats.stats);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

