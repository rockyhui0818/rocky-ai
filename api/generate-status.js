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
  const job = await getJob(id);
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
