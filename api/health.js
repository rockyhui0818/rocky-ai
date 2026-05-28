const { sendJson } = require("./_lib/http");

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  return sendJson(res, 200, {
    ok: true,
    service: "vision-brzazil-commerce-studio",
    api: "online",
    time: new Date().toISOString()
  });
};
