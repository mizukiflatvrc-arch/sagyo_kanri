import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspace = process.cwd();
const requiredEnvironmentKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

function readEnvironmentFile() {
  try {
    return readFileSync(resolve(workspace, ".env.local"), "utf8");
  } catch {
    throw new Error(
      ".env.local がありません。.env.example をコピーして設定してください。",
    );
  }
}

function parseEnvironment(source) {
  const values = new Map();
  for (const line of source.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^(['"])(.*)\1$/, "$2").trim();
    values.set(key, value);
  }
  return values;
}

try {
  const environment = parseEnvironment(readEnvironmentFile());
  const missing = requiredEnvironmentKeys.filter(
    (key) => !environment.get(key),
  );
  if (missing.length > 0) {
    throw new Error(`未設定の環境変数があります: ${missing.join(", ")}`);
  }

  process.stdout.write("デプロイ設定を確認しました。\n");
} catch (error) {
  const message =
    error instanceof Error ? error.message : "デプロイ設定を確認できませんでした。";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
