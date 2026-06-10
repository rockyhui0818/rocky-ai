const { getBearerToken, handleOptions, readJson, sendJson } = require("./_lib/http");
const { createJob, publicJob, updateJob } = require("./_lib/jobs");
const { runReviewAnalysisWorkflow } = require("./generate");

let waitUntil = null;
try {
  ({ waitUntil } = require("@vercel/functions"));
} catch {
  waitUntil = null;
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  const payload = await readJson(req);
  const token = getBearerToken(req);
  let job;
  try {
    job = await createJob({
      status: "queued",
      stage: "review_queued",
      progress: 5,
      message: "Review 分析任务已创建，后台开始采集评论。"
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: error.code || "REVIEW_ANALYSIS_JOB_CREATE_FAILED",
      message: error.message || "Review 分析任务创建失败。",
      details: error.details || null
    });
  }

  const runJob = async () => {
    try {
      await updateJob(job.id, {
        status: "running",
        stage: "review_started",
        progress: 15,
        message: "正在采集 Review 页面并准备模型分析。"
      });
      const result = await runReviewAnalysisWorkflow({
        payload,
        token,
        requestId: job.id.replace(/^job_/, "review_")
      });
      await updateJob(job.id, {
        status: "success",
        stage: "review_complete",
        progress: 100,
        message: "Review 独立分析完成。",
        result
      });
    } catch (error) {
      await updateJob(job.id, {
        status: "error",
        stage: "review_failed",
        progress: 100,
        message: error.message || "Review 独立分析失败。",
        error: {
          error: error.code || error.name || "REVIEW_ANALYSIS_JOB_FAILED",
          message: error.message || "Review 独立分析失败。",
          details: {
            name: error.name || "",
            code: error.code || "",
            status_code: error.statusCode || null,
            provider_error: error.details || null
          }
        }
      });
    }
  };

  const jobPromise = runJob();
  if (typeof waitUntil === "function") {
    waitUntil(jobPromise);
  } else {
    jobPromise.catch((error) => {
      console.error(JSON.stringify({
        event: "review_analysis_job_unhandled_error",
        job_id: job.id,
        message: error.message
      }));
    });
  }

  return sendJson(res, 202, {
    ok: true,
    job: publicJob(job)
  });
};
