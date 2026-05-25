const { getAccountByToken, publicAccount, sha256 } = require("../_lib/auth");
const { getBearerToken, readJson, sendJson } = require("../_lib/http");
const { filter, supabaseRequest } = require("../_lib/supabase");

module.exports = async function handler(req, res) {
  try {
    const currentAccount = await getAccountByToken(getBearerToken(req));
    if (!currentAccount || currentAccount.role !== "owner") {
      return sendJson(res, 403, { error: "FORBIDDEN", message: "仅主管理员可管理账号。" });
    }

    if (req.method === "DELETE") {
      const { id } = await readJson(req);
      if (!id || id === currentAccount.id) {
        return sendJson(res, 400, { error: "INVALID_ACCOUNT_ID", message: "不能删除主管理员账号。" });
      }
      await supabaseRequest(`accounts?id=${filter(id)}&role=neq.owner`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" }
      });
      return sendJson(res, 200, { ok: true, deletedId: id });
    }

    if (req.method !== "PATCH") return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });

    const body = await readJson(req);
    const targetId = body.id;
    if (!targetId) return sendJson(res, 400, { error: "INVALID_ACCOUNT_ID" });

    const patch = {};
    if (body.status && targetId !== currentAccount.id) patch.status = body.status;
    if (body.quota !== undefined && targetId !== currentAccount.id) patch.quota = Math.max(10, Number(body.quota));
    if (body.platforms && targetId !== currentAccount.id) patch.platforms = body.platforms;
    if (body.models && targetId !== currentAccount.id) patch.models = body.models;
    if (body.name) patch.name = body.name;
    if (body.username) patch.username = body.username;
    if (body.password) patch.password_hash = await sha256(body.password);

    if (!Object.keys(patch).length) {
      return sendJson(res, 400, { error: "EMPTY_PATCH", message: "没有可更新的字段。" });
    }

    const rows = await supabaseRequest(`accounts?id=${filter(targetId)}`, {
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
