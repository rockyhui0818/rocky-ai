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

async function ignoresProvidedLocalScanResultsWhenBrightDataIsConfigured() {
  const previousEnv = {
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };
  const previousFetch = global.fetch;

  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "200";

  const calls = [];
  global.fetch = async (url) => {
    calls.push(String(url));
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    return new Response(`
      <html>
        <head>
          <title>Bright Product</title>
          <meta name="description" content="Bright Data product description">
        </head>
        <body>
          <h1>Bright Product</h1>
          <img src="https://cdn.example.com/main.jpg" alt="product main">
          <span itemprop="reviewCount" content="321"></span>
        </body>
      </html>
    `, { status: 200, headers: { "Content-Type": "text/html" } });
  };

  clearApiModule("api/generate.js");
  const { scanProductLinks } = require(path.join(root, "api/generate.js"));
  const results = await scanProductLinks({
    product: {
      source_urls: ["https://example.com/product"],
      source_markets: [{ market: "us" }]
    },
    link_scan_results: [{
      url: "https://example.com/product",
      ok: false,
      scanner: "local-browser",
      error: "LINK_SCAN_BLOCKED",
      title: "Security Check",
      image_candidates: [],
      review_insights: null
    }]
  });

  global.fetch = previousFetch;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.deepStrictEqual(calls, ["https://api.brightdata.com/request"]);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].ok, true);
  assert.strictEqual(results[0].scanner, "brightdata");
  assert.strictEqual(results[0].title, "Bright Product");
  assert.strictEqual(results[0].review_insights.review_count, 321);
}

run()
  .then(ignoresProvidedLocalScanResultsWhenBrightDataIsConfigured)
  .then(() => console.log("brightdata required scan ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
