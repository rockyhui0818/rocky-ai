function applyCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function handleOptions(req, res) {
  applyCors(req, res);
  if (req.method !== "OPTIONS") return false;
  res.statusCode = 204;
  res.end();
  return true;
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Access-Control-Allow-Origin", res.getHeader("Access-Control-Allow-Origin") || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function methodNotAllowed(res, allowed = ["GET"]) {
  res.setHeader("Allow", allowed.join(", "));
  sendJson(res, 405, { error: "METHOD_NOT_ALLOWED", allowed });
}

function getBearerToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return "";
}

module.exports = {
  applyCors,
  getBearerToken,
  handleOptions,
  methodNotAllowed,
  readJson,
  sendJson
};
