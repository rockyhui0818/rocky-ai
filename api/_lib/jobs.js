const jobs = new Map();
const JOB_TTL_MS = 45 * 60 * 1000;

function nowIso() {
  return new Date().toISOString();
}

function createJob(initial = {}) {
  const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    status: "queued",
    stage: "queued",
    progress: 0,
    message: "任务已创建，等待开始。",
    created_at: nowIso(),
    updated_at: nowIso(),
    result: null,
    error: null,
    ...initial
  };
  jobs.set(id, job);
  setTimeout(() => jobs.delete(id), JOB_TTL_MS).unref?.();
  return job;
}

function getJob(id) {
  return jobs.get(id) || null;
}

function updateJob(id, patch = {}) {
  const existing = getJob(id);
  if (!existing) return null;
  const next = {
    ...existing,
    ...patch,
    updated_at: nowIso()
  };
  jobs.set(id, next);
  return next;
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
