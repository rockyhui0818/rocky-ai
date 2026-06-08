const { createToken, publicAccount, sha256 } = require("../_lib/auth");
const { handleOptions, readJson, sendJson } = require("../_lib/http");
const { filter, supabaseRequest } = require("../_lib/supabase");

function invalidCredentials(res, details = {}) {
  return sendJson(res, 401, {
    error: "INVALID_CREDENTIALS",
    message: "账号或密码错误，或账号已暂停。",
    details
  });
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });

  try {
    const { username, password } = await readJson(req);
    const rows = await supabaseRequest(`accounts?username=${filter(username || "")}&select=*`);
    const account = rows[0];
    const passwordHash = await sha256(password || "");

    if (!account) {
      return invalidCredentials(res, {
        reason: "ACCOUNT_NOT_FOUND",
        username: username || ""
      });
    }

    if (account.status !== "active") {
      return invalidCredentials(res, {
        reason: "ACCOUNT_NOT_ACTIVE",
        username: account.username,
        status: account.status
      });
    }

    if (account.password_hash !== passwordHash) {
      return invalidCredentials(res, {
        reason: "PASSWORD_HASH_MISMATCH",
        username: account.username
      });
    }

    const token = await createToken(account.id);
    return sendJson(res, 200, {
      ok: true,
      token,
      account: publicAccount(account)
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: error.code || "LOGIN_FAILED",
      message: error.message,
      details: error.details || null
    });
  }
};
