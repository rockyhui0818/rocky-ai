const { getAccountByToken, publicAccount } = require("../_lib/auth");
const { getBearerToken, readJson, sendJson } = require("../_lib/http");
const { filter, supabaseRequest } = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "PATCH") return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });

  try {
    const currentAccount = await getAccountByToken(getBearerToken(req));
    if (!currentAccount || currentAccount.role !== "owner") {
      return sendJson(res, 403, { error: "FORBIDDEN", message: "仅主管理员可修改子账号。" });
    }

    const { id, status, quota, platforms, models, name } = await readJson(req);
    if (!id || id === currentAccount.id) return sendJson(res, 400, { error: "INVALID_ACCOUNT_ID" });

    const patch = {};
    if (status) patch.status = status;
    if (quota !== undefined) patch.quota = Math.max(10, Number(quota));
    if (platforms) patch.platforms = platforms;
    if (models) patch.models = models;
    if (name) patch.name = name;

    const rows = await supabaseRequest(`accounts?id=${filter(id)}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    return sendJson(res, 200, { ok: true, account: publicAccount(rows[0]) });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: error.code || "ACCOUNT_UPDATE_FAILED",
      message: error.message,
      details: error.details
    });
  }
};
