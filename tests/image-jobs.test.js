const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const imageJobPath = path.join(root, "api/image-job.js");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const serverSource = fs.readFileSync(path.join(root, "server.js"), "utf8");
const imageSource = fs.readFileSync(path.join(root, "api/image.js"), "utf8");
const vercelConfig = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

assert(fs.existsSync(imageJobPath), "api/image-job.js must exist for background image generation.");

const imageJobSource = fs.readFileSync(imageJobPath, "utf8");

assert(
  imageSource.includes("runImageWorkflow"),
  "api/image.js must expose reusable image workflow logic for the background job."
);

assert(
  imageJobSource.includes("waitUntil(jobPromise)") &&
    imageJobSource.includes("runImageWorkflow") &&
    imageJobSource.includes("createJob"),
  "api/image-job.js must create a durable job and run image generation in Vercel waitUntil."
);

assert(
  serverSource.includes("\"/api/image-job\""),
  "local server must route /api/image-job."
);

assert(
  vercelConfig.functions?.["api/image-job.js"]?.maxDuration >= 120,
  "Vercel image-job function must allow long-running image generation."
);

assert(
  appSource.includes("apiRequest(\"/api/image-job\"") &&
    !appSource.includes("apiRequest(\"/api/image\","),
  "Frontend image generation must use background image jobs instead of direct /api/image calls."
);

console.log("image jobs ok");
