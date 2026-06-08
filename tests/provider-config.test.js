const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const checkedFiles = [
  ".env.example",
  "README.md",
  "deploy/vps/README.md",
  "api/generate.js",
  "api/image.js",
  "api/video-score.js",
  "app.js",
  "tests/image-api-diagnostics.test.js"
];
const oldProviderIp = ["154", "40", "59", "124"].join(".");
const oldImageModelPattern = new RegExp("\\bgpt-image-" + "2(?![-\\w])");

for (const relativePath of checkedFiles) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) continue;
  const source = fs.readFileSync(filePath, "utf8");
  assert(
    !source.includes(oldProviderIp),
    `${relativePath} must not reference the old provider IP.`
  );
  assert(
    !oldImageModelPattern.test(source),
    `${relativePath} must not reference the old image model.`
  );
}

const imageSource = fs.readFileSync(path.join(root, "api/image.js"), "utf8");
assert(
  imageSource.includes("154.64.230.35:3000/v1") &&
    imageSource.includes("gpt-image-2-pro"),
  "api/image.js must use the verified image provider and model."
);

console.log("provider config ok");
