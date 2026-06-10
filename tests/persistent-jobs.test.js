const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const schema = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
const jobsSource = fs.readFileSync(path.join(root, "api/_lib/jobs.js"), "utf8");
const generateJobSource = fs.readFileSync(path.join(root, "api/generate-job.js"), "utf8");
const reviewAnalysisJobSource = fs.readFileSync(path.join(root, "api/review-analysis-job.js"), "utf8");
const generateStatusSource = fs.readFileSync(path.join(root, "api/generate-status.js"), "utf8");
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    end(payload = "") {
      this.body = payload;
    }
  };
}

assert(
  /create table if not exists public\.generate_jobs/i.test(schema),
  "Supabase schema must include a persistent generate_jobs table."
);

assert(
  /id text primary key/i.test(schema) &&
    /result jsonb/i.test(schema) &&
    /error jsonb/i.test(schema),
  "generate_jobs must persist job id, result, and error payloads."
);

assert(
  /on conflict \(username\) do update set/i.test(schema) &&
    /password_hash = excluded\.password_hash/i.test(schema),
  "Supabase schema must repair default account password hashes when rerun."
);

assert(
  jobsSource.includes("supabaseRequest(\"generate_jobs\"") ||
    jobsSource.includes("supabaseRequest(`generate_jobs"),
  "Job helper must write/read generate_jobs through Supabase."
);

assert(
  !jobsSource.includes("const jobs = new Map()"),
  "Job helper must not use an in-memory Map as the primary store."
);

assert(
  /(?:const|let|var)?\s*job\s*=\s*await createJob/.test(generateJobSource),
  "generate-job handler must await persistent job creation before returning the id."
);

assert(
  generateJobSource.includes("waitUntil(jobPromise)"),
  "generate-job handler must register background work with Vercel waitUntil when available."
);

assert(
  reviewAnalysisJobSource.includes("runReviewAnalysisWorkflow") &&
    /(?:const|let|var)?\s*job\s*=\s*await createJob/.test(reviewAnalysisJobSource),
  "review-analysis-job handler must create a persistent job and run review analysis in the background."
);

assert(
  reviewAnalysisJobSource.includes("waitUntil(jobPromise)"),
  "review-analysis-job handler must register background work with Vercel waitUntil when available."
);

assert(
  /(?:const|let|var)?\s*job\s*=\s*await getJob/.test(generateStatusSource),
  "generate-status handler must await persistent job lookup."
);

assert(
  vercelConfig.functions?.["api/generate-job.js"]?.maxDuration >= 300,
  "Vercel generate-job function must have enough maxDuration for long-running generation."
);

assert(
  vercelConfig.functions?.["api/review-analysis-job.js"]?.maxDuration >= 300,
  "Vercel review-analysis-job function must have enough maxDuration for long-running review collection."
);

assert(
  packageJson.dependencies?.["@vercel/functions"],
  "package.json must include @vercel/functions for waitUntil support on Vercel."
);

async function rejectsMemoryOnlyJobsOnVercel() {
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = "1";
  clearApiModule("api/_lib/supabase.js");
  clearApiModule("api/_lib/jobs.js");
  clearApiModule("api/generate-job.js");

  const supabaseModule = require(path.join(root, "api/_lib/supabase.js"));
  supabaseModule.supabaseRequest = async () => {
    const error = new Error("relation public.generate_jobs does not exist");
    error.code = "SUPABASE_REQUEST_FAILED";
    error.statusCode = 404;
    error.details = { code: "PGRST205" };
    throw error;
  };

  const handler = require(path.join(root, "api/generate-job.js"));
  const req = {
    method: "POST",
    headers: {},
    [Symbol.asyncIterator]: async function* emptyBody() {}
  };
  const res = createMockResponse();
  await handler(req, res);

  if (previousVercel === undefined) {
    delete process.env.VERCEL;
  } else {
    process.env.VERCEL = previousVercel;
  }

  assert.strictEqual(res.statusCode, 503, "Vercel must reject job creation when durable storage is unavailable.");
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.error, "GENERATE_JOB_STORAGE_UNAVAILABLE");
  assert(!payload.job, "Response must not return a memory-only job id that status polling cannot find.");
}

async function reportsStorageFailureDuringStatusPolling() {
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = "1";
  clearApiModule("api/_lib/supabase.js");
  clearApiModule("api/_lib/jobs.js");
  clearApiModule("api/generate-status.js");

  const supabaseModule = require(path.join(root, "api/_lib/supabase.js"));
  supabaseModule.supabaseRequest = async () => {
    const error = new Error("relation public.generate_jobs does not exist");
    error.code = "SUPABASE_REQUEST_FAILED";
    error.statusCode = 404;
    error.details = { code: "PGRST205" };
    throw error;
  };

  const handler = require(path.join(root, "api/generate-status.js"));
  const req = {
    method: "GET",
    url: "/api/generate-status?id=job_missing_table",
    headers: {}
  };
  const res = createMockResponse();
  await handler(req, res);

  if (previousVercel === undefined) {
    delete process.env.VERCEL;
  } else {
    process.env.VERCEL = previousVercel;
  }

  assert.strictEqual(res.statusCode, 503, "Vercel status polling must expose durable storage failures.");
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.error, "GENERATE_JOB_STORAGE_UNAVAILABLE");
  assert.strictEqual(payload.details?.action, "get");
}

rejectsMemoryOnlyJobsOnVercel()
  .then(reportsStorageFailureDuringStatusPolling)
  .then(() => console.log("persistent jobs ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
