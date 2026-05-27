const { getAccountByToken, publicAccount, sha256 } = require("../_lib/auth");
const { getBearerToken, handleOptions, readJson, sendJson } = require("../_lib/http");
const { supabaseRequest } = require("../_lib/supabase");

function ensureOwner(account) {
  return account && account.role === "owner";
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  try {
    const currentAccount = await getAccountByToken(getBearerToken(req));
    if (!ensureOwner(currentAccount)) {
      return sendJson(res, 403, { error: "FORBIDDEN", message: "仅主管理员可管理子账号。" });
    }

    if (req.method === "GET") {
      const rows = await supabaseRequest("accounts?select=*&order=created_at.asc");
      return sendJson(res, 200, { ok: true, accounts: rows.map(publicAccount) });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const role = body.role || "operator";
      const account = {
        username: body.username,
        password_hash: await sha256(body.password || "123456"),
        name: body.name || body.username,
        role,
        status: "active",
        quota: Math.max(10, Number(body.quota || 120)),
        used: 0,
        platforms: body.platforms || ["amazon", "mercado", "tiktok", "shopee", "all"],
        models: body.models || ["openai"],
        created_by: currentAccount.id
      };
      const rows = await supabaseRequest("accounts", {
        method: "POST",
        body: JSON.stringify(account)
      });
      return sendJson(res, 201, { ok: true, account: publicAccount(rows[0]) });
    }

    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: error.code || "ACCOUNTS_FAILED",
      message: error.message,
      details: error.details
    });
  }
};
