const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

async function run() {
  const previousEnv = {
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };
  const previousFetch = global.fetch;

  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "20";

  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    if (String(url).includes("brightdata.com")) {
      await new Promise((resolve) => setTimeout(resolve, 60));
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    throw new Error("Direct fetch must not run when Bright Data is configured.");
  };

  clearApiModule("api/generate.js");
  const { scanProductLink } = require(path.join(root, "api/generate.js"));
  assert.strictEqual(typeof scanProductLink, "function", "generate.js must export scanProductLink for diagnostics.");
  const result = await scanProductLink("https://example.com/product", { market: "us" });

  global.fetch = previousFetch;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.deepStrictEqual(calls, ["https://api.brightdata.com/request"]);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.scanner, "brightdata");
  assert.strictEqual(result.error, "BRIGHTDATA_SCAN_TIMEOUT");
  assert.match(result.message, /Bright Data/i);
}

run()
  .then(() => console.log("brightdata required scan ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
