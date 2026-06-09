const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const summaryStart = appSource.indexOf("function summarizeApiError(error)");
const summaryEnd = appSource.indexOf("function normalizeApiErrorPayload", summaryStart);

assert(summaryStart >= 0, "summarizeApiError must exist.");
assert(summaryEnd > summaryStart, "normalizeApiErrorPayload must follow summarizeApiError.");

const summarySource = appSource.slice(summaryStart, summaryEnd);
const providerMessageIndex = summarySource.indexOf("providerDetails.provider_message");
const stageIndex = summarySource.indexOf("payload.stage");

assert(providerMessageIndex >= 0, "Image/API error summaries must include provider_message.");
assert(stageIndex >= 0, "Image/API error summaries must keep stage as fallback context.");
assert(
  providerMessageIndex < stageIndex,
  "Image/API error summaries must show the real provider failure before the generic image_failed stage."
);

console.log("image error summary ok");
