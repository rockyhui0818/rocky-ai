const { getAccountByToken, publicAccount } = require("../_lib/auth");
const { getBearerToken, handleOptions, sendJson } = require("../_lib/http");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });

  try {
    const account = await getAccountByToken(getBearerToken(req));
    if (!account) return sendJson(res, 401, { error: "UNAUTHENTICATED" });
    return sendJson(res, 200, { ok: true, account: publicAccount(account) });
  } catch (error) {
    return sendJson(res, 500, { error: error.code || "SESSION_FAILED", message: error.message });
  }
};
