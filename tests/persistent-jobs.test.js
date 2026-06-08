const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const schema = fs.readFileSync(path.join(root, "supabase/schema.sql"), "utf8");
const jobsSource = fs.readFileSync(path.join(root, "api/_lib/jobs.js"), "utf8");
const generateJobSource = fs.readFileSync(path.join(root, "api/generate-job.js"), "utf8");
const generateStatusSource = fs.readFileSync(path.join(root, "api/generate-status.js"), "utf8");
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

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
  jobsSource.includes("supabaseRequest(\"generate_jobs\"") ||
    jobsSource.includes("supabaseRequest(`generate_jobs"),
  "Job helper must write/read generate_jobs through Supabase."
);

assert(
  !jobsSource.includes("const jobs = new Map()"),
  "Job helper must not use an in-memory Map as the primary store."
);

assert(
  /const job = await createJob/.test(generateJobSource),
  "generate-job handler must await persistent job creation before returning the id."
);

assert(
  generateJobSource.includes("waitUntil(jobPromise)"),
  "generate-job handler must register background work with Vercel waitUntil when available."
);

assert(
  /const job = await getJob/.test(generateStatusSource),
  "generate-status handler must await persistent job lookup."
);

assert(
  vercelConfig.functions?.["api/generate-job.js"]?.maxDuration >= 300,
  "Vercel generate-job function must have enough maxDuration for long-running generation."
);

assert(
  packageJson.dependencies?.["@vercel/functions"],
  "package.json must include @vercel/functions for waitUntil support on Vercel."
);

console.log("persistent jobs ok");
