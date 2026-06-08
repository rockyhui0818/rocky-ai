const { handleOptions, sendJson } = require("./_lib/http");
const { getJob, publicJob } = require("./_lib/jobs");

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  const url = new URL(req.url, "http://localhost");
  const id = url.searchParams.get("id") || "";
  let job;
  try {
    job = await getJob(id);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: error.code || "GENERATE_JOB_STATUS_FAILED",
      message: error.message || "读取后台任务状态失败。",
      details: error.details || null
    });
  }

  if (!job) {
    return sendJson(res, 404, {
      error: "JOB_NOT_FOUND",
      message: "任务不存在或已过期，请重新开始链接分析。"
    });
  }

  return sendJson(res, 200, {
    ok: true,
    job: publicJob(job)
  });
};
