const { filter, supabaseRequest } = require("./supabase");
const { createHash } = require("crypto");

async function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function createToken(accountId) {
  const secret = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "vision-local-secret";
  const timestamp = Date.now();
  const signature = await sha256(`${accountId}.${timestamp}.${secret}`);
  return `${accountId}.${timestamp}.${signature}`;
}

async function verifyToken(token) {
  if (!token || token.split(".").length !== 3) return null;
  const [accountId, timestamp, signature] = token.split(".");
  const maxAgeMs = 1000 * 60 * 60 * 24 * 7;
  if (Date.now() - Number(timestamp) > maxAgeMs) return null;
  const expected = await sha256(`${accountId}.${timestamp}.${process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "vision-local-secret"}`);
  if (signature !== expected) return null;
  return accountId;
}

async function getAccountByToken(token) {
  const accountId = await verifyToken(token);
  if (!accountId) return null;
  const rows = await supabaseRequest(`accounts?id=${filter(accountId)}&select=*`);
  return rows[0] || null;
}

function publicAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    username: account.username,
    name: account.name,
    role: account.role,
    status: account.status,
    quota: account.quota,
    used: account.used,
    platforms: account.platforms || [],
    models: account.models || []
  };
}

module.exports = {
  createToken,
  getAccountByToken,
  publicAccount,
  sha256
};
