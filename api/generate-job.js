const { getBearerToken, handleOptions, readJson, sendJson } = require("./_lib/http");
const { createJob, publicJob, updateJob } = require("./_lib/jobs");
const { runGenerateWorkflow } = require("./generate");

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
      stage: "queued",
      progress: 3,
      message: "任务已创建，后台开始扫描链接。"
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: error.code || "GENERATE_JOB_CREATE_FAILED",
      message: error.message || "后台任务创建失败。",
      details: error.details || null
    });
  }

  const runJob = async () => {
    try {
      await updateJob(job.id, {
        status: "running",
        stage: "started",
        progress: 5,
        message: "后台任务已开始。"
      });
      const result = await runGenerateWorkflow({
        payload,
        token,
        requestId: job.id.replace(/^job_/, "gen_"),
        onProgress: (progress) => updateJob(job.id, progress)
      });
      await updateJob(job.id, {
        status: "success",
        stage: "complete",
        progress: 100,
        message: result.degraded ? "任务完成：模型部分降级，但已返回可编辑提示词。" : "任务完成：链接扫描和模型拆解已完成。",
        result
      });
    } catch (error) {
      await updateJob(job.id, {
        status: "error",
        stage: "failed",
        progress: 100,
        message: error.message || "后台生成任务失败。",
        error: {
          error: error.code || error.name || "GENERATE_JOB_FAILED",
          message: error.message || "后台生成任务失败。",
          details: {
            name: error.name || "",
            code: error.code || "",
            status_code: error.statusCode || null
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
        event: "generate_job_unhandled_error",
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
