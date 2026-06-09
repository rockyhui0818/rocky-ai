const { getBearerToken, handleOptions, readJson, sendJson } = require("./_lib/http");
const { runReviewAnalysisWorkflow } = require("./generate");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const payload = await readJson(req);
    const result = await runReviewAnalysisWorkflow({
      payload,
      token: getBearerToken(req)
    });
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: error.code || "REVIEW_ANALYSIS_FAILED",
      message: error.message || "Review 分析失败。",
      details: {
        name: error.name || "",
        code: error.code || "",
        status_code: error.statusCode || null,
        provider_error: error.details || null
      }
    });
  }
};
