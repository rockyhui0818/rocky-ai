const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert(
  appSource.includes("const IMAGE_BATCH_SIZE = 4;"),
  "Frontend image jobs must use a batch size of four."
);

assert(
  appSource.includes("prompts: batchPrompts") &&
    appSource.includes("max_images: batchPrompts.length"),
  "Frontend must submit one image job per batch instead of one job per image."
);

assert(
  appSource.includes("priorityPrompts.slice(index, index + IMAGE_BATCH_SIZE)") &&
    appSource.includes("index += IMAGE_BATCH_SIZE"),
  "Frontend must process the 11 image prompts in four-image batches."
);

assert(
  !appSource.includes("prompts: [item]"),
  "Frontend must not submit every prompt as its own image job."
);

console.log("image job batching ok");
