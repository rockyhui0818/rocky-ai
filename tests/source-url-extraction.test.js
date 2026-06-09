const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert(
  appSource.includes("function extractSourceUrls(rawText)"),
  "Frontend must extract real http(s) URLs from mixed platform labels and notes."
);

assert(
  appSource.includes("extractSourceUrls(els.productUrl.value)"),
  "Frontend API payloads must use extracted source URLs instead of splitting raw textarea lines."
);

assert(
  !appSource.includes("els.productUrl.value.split(/[\\n,，]+/)"),
  "Raw textarea splitting drops real links when users paste platform labels or notes with URLs."
);

console.log("source url extraction ok");
