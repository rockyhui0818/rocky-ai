const { supabaseRequest } = require("./supabase");

const memoryJobs = new Map();
const JOB_TTL_MS = 45 * 60 * 1000;

function requiresDurableJobs() {
  return process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
}

function createStorageError(action, error) {
  const storageError = new Error("生成任务持久化存储不可用，请检查 Supabase generate_jobs 表和环境变量。");
  storageError.code = "GENERATE_JOB_STORAGE_UNAVAILABLE";
  storageError.statusCode = 503;
  storageError.details = {
    action,
    cause_code: error.code || "",
    cause_status_code: error.statusCode || null,
    cause_message: error.message,
    cause_details: error.details || null,
    hint: "Run supabase/schema.sql so public.generate_jobs exists, then verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel."
  };
  return storageError;
}

function nowIso() {
  return new Date().toISOString();
}

function newJobId() {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeJob(row = {}) {
  return {
    id: row.id,
    status: row.status || "queued",
    stage: row.stage || "queued",
    progress: Number(row.progress || 0),
    message: row.message || "任务已创建，等待开始。",
    created_at: row.created_at || nowIso(),
    updated_at: row.updated_at || nowIso(),
    result: row.result || null,
    error: row.error || null
  };
}

function rememberJob(job) {
  memoryJobs.set(job.id, job);
  setTimeout(() => memoryJobs.delete(job.id), JOB_TTL_MS).unref?.();
  return job;
}

async function createJob(initial = {}) {
  const job = normalizeJob({
    id: newJobId(),
    status: "queued",
    stage: "queued",
    progress: 0,
    message: "任务已创建，等待开始。",
    created_at: nowIso(),
    updated_at: nowIso(),
    result: null,
    error: null,
    ...initial
  });

  try {
    const rows = await supabaseRequest("generate_jobs", {
      method: "POST",
      body: JSON.stringify(job)
    });
    return rememberJob(normalizeJob(rows[0] || job));
  } catch (error) {
    console.warn(JSON.stringify({
      event: "generate_job_memory_fallback",
      action: "create",
      job_id: job.id,
      message: error.message,
      code: error.code || ""
    }));
    if (requiresDurableJobs()) throw createStorageError("create", error);
    return rememberJob(job);
  }
}

async function getJob(id) {
  if (!id) return null;
  try {
    const rows = await supabaseRequest(`generate_jobs?id=eq.${encodeURIComponent(id)}&select=*`);
    const job = rows[0] ? normalizeJob(rows[0]) : null;
    if (job) rememberJob(job);
    return job;
  } catch (error) {
    console.warn(JSON.stringify({
      event: "generate_job_memory_fallback",
      action: "get",
      job_id: id,
      message: error.message,
      code: error.code || ""
    }));
    if (requiresDurableJobs()) throw createStorageError("get", error);
    return memoryJobs.get(id) || null;
  }
}

async function updateJob(id, patch = {}) {
  const existing = await getJob(id);
  if (!existing) return null;
  const next = normalizeJob({
    ...existing,
    ...patch,
    updated_at: nowIso()
  });

  try {
    const rows = await supabaseRequest(`generate_jobs?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: next.status,
        stage: next.stage,
        progress: next.progress,
        message: next.message,
        result: next.result,
        error: next.error,
        updated_at: next.updated_at
      })
    });
    return rememberJob(normalizeJob(rows[0] || next));
  } catch (error) {
    console.warn(JSON.stringify({
      event: "generate_job_memory_fallback",
      action: "update",
      job_id: id,
      message: error.message,
      code: error.code || ""
    }));
    if (requiresDurableJobs()) throw createStorageError("update", error);
    return rememberJob(next);
  }
}

function publicJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    message: job.message,
    created_at: job.created_at,
    updated_at: job.updated_at,
    result: job.result,
    error: job.error
  };
}

module.exports = {
  createJob,
  getJob,
  publicJob,
  updateJob
};
