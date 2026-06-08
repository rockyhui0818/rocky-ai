const { getBearerToken, handleOptions, readJson, sendJson } = require("./_lib/http");
const { createJob, publicJob, updateJob } = require("./_lib/jobs");
const { runImageWorkflow } = require("./image");

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
      stage: "image_queued",
      progress: 5,
      message: "图片任务已创建，后台开始调用生图模型。"
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: error.code || "IMAGE_JOB_CREATE_FAILED",
      message: error.message || "图片任务创建失败。",
      details: error.details || null
    });
  }

  const runJob = async () => {
    try {
      await updateJob(job.id, {
        status: "running",
        stage: "image_started",
        progress: 15,
        message: "图片模型正在生成，请保持页面等待。"
      });
      const result = await runImageWorkflow({ payload, token });
      await updateJob(job.id, {
        status: "success",
        stage: "image_complete",
        progress: 100,
        message: "图片生成完成。",
        result
      });
    } catch (error) {
      await updateJob(job.id, {
        status: "error",
        stage: "image_failed",
        progress: 100,
        message: error.message || "图片生成失败。",
        error: {
          error: error.code || error.name || "IMAGE_GENERATION_FAILED",
          message: error.message || "图片生成失败。",
          details: error.details || null,
          provider: error.provider || null
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
        event: "image_job_unhandled_error",
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
