const { sendJson } = require("./_lib/http");

function configured(value) {
  return Boolean(String(value || "").trim());
}

function safeHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  return sendJson(res, 200, {
    ok: true,
    service: "vision-brzazil-commerce-studio",
    api: "online",
    diagnostics: {
      supabase: {
        configured: configured(process.env.SUPABASE_URL) && configured(process.env.SUPABASE_SERVICE_ROLE_KEY),
        host: safeHost(process.env.SUPABASE_URL)
      },
      text_model: {
        configured: configured(process.env.OPENAI_API_KEY),
        host: safeHost(process.env.OPENAI_BASE_URL || "http://154.64.230.35:3000/v1"),
        model: process.env.OPENAI_TEXT_MODEL || "gpt-5.5"
      },
      image_model: {
        configured: configured(process.env.OPENAI_IMAGE_API_KEY || process.env.OPENAI_API_KEY),
        host: safeHost(process.env.OPENAI_IMAGE_BASE_URL || process.env.OPENAI_BASE_URL || "http://154.64.230.35:3000/v1"),
        model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2-pro",
        concurrency: Number(process.env.OPENAI_IMAGE_CONCURRENCY || 1)
      },
      link_scanner: {
        brightdata_configured: configured(process.env.BRIGHTDATA_API_KEY),
        mode: configured(process.env.BRIGHTDATA_API_KEY) ? "brightdata-required" : "direct-fetch",
        brightdata_zone: process.env.BRIGHTDATA_ZONE || "web_unlocker1",
        brightdata_timeout_ms: Number(process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS || 20000)
      }
    },
    time: new Date().toISOString()
  });
};
