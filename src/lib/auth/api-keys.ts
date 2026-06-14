import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "rcsk_";

function pepper() {
  return (
    process.env.API_KEY_PEPPER ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "recall-dev-pepper"
  );
}

export function hashApiKey(key: string) {
  return createHash("sha256").update(`${pepper()}:${key}`).digest("hex");
}

export function generateApiKeyMaterial() {
  const secret = randomBytes(32).toString("base64url");
  const key = `${KEY_PREFIX}${secret}`;
  return {
    key,
    keyPrefix: key.slice(0, 14),
    keyHash: hashApiKey(key),
  };
}

export function extractBearerKey(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const key = auth.slice(7).trim();
  return key.startsWith(KEY_PREFIX) ? key : null;
}
