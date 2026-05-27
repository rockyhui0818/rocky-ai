const { getAccountByToken, publicAccount } = require("./_lib/auth");
const { getBearerToken, handleOptions, readJson, sendJson } = require("./_lib/http");
const { filter, supabaseRequest } = require("./_lib/supabase");

function normalizeUsage(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    type: row.type,
    action: row.action,
    platform: row.platform,
    model: row.model,
    units: row.units,
    tokens: row.tokens,
    success: row.success,
    createdAt: new Date(row.created_at).toLocaleString("zh-CN", {
      hour12: false,
      timeZone: "America/Sao_Paulo"
    })
  };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  try {
    const currentAccount = await getAccountByToken(getBearerToken(req));
    if (!currentAccount) return sendJson(res, 401, { error: "UNAUTHENTICATED" });

    if (req.method === "GET") {
      const query = currentAccount.role === "owner" ? "" : `account_id=${filter(currentAccount.id)}&`;
      const rows = await supabaseRequest(`usage_logs?${query}select=*&order=created_at.desc&limit=200`);
      return sendJson(res, 200, {
        ok: true,
        account: publicAccount(currentAccount),
        usageLogs: rows.map(normalizeUsage)
      });
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const accountId = currentAccount.role === "owner" && body.accountId ? body.accountId : currentAccount.id;
      const rows = await supabaseRequest("usage_logs", {
        method: "POST",
        body: JSON.stringify({
          account_id: accountId,
          type: body.type || "generate",
          action: body.action || "生成商品方案",
          platform: body.platform || "all",
          model: body.model || "openai",
          units: Number(body.units || 1),
          tokens: Number(body.tokens || 0),
          success: body.success !== false,
          metadata: body.metadata || {}
        })
      });
      return sendJson(res, 201, { ok: true, usageLog: normalizeUsage(rows[0]) });
    }

    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: error.code || "USAGE_FAILED",
      message: error.message,
      details: error.details
    });
  }
};
