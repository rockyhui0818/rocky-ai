const fs = require("fs");
const path = require("path");

function unquote(value) {
  const trimmed = String(value || "").trim();
  const quote = trimmed[0];
  if ((quote === "\"" || quote === "'") && trimmed[trimmed.length - 1] === quote) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(filePath = path.join(__dirname, "..", "..", ".env")) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key]) continue;
    process.env[key] = unquote(trimmed.slice(index + 1));
  }
}

module.exports = { loadEnvFile };
