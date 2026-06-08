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
  global.fetch = async (url, options = {}) => {
    calls.push(String(url));
    if (String(url).includes("brightdata.com")) {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return new Response("", { status: 504 });
    }
    return new Response(`
      <html>
        <head>
          <title>Fallback Product</title>
          <meta name="description" content="Direct fetch product description">
        </head>
        <body>
          <h1>Fallback Product</h1>
          <img src="/main.jpg" alt="product main image">
          <span itemprop="ratingValue" content="4.7"></span>
          <span itemprop="reviewCount" content="123"></span>
          <span data-hook="review-body">Muito bom e resistente.</span>
        </body>
      </html>
    `, {
      status: 200,
      headers: { "Content-Type": "text/html" }
    });
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

  assert(calls.some((url) => url.includes("brightdata.com")), "Bright Data should be attempted first.");
  assert(calls.includes("https://example.com/product"), "Direct fetch fallback should run after Bright Data timeout.");
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.scanner, "direct-fetch");
  assert.strictEqual(result.title, "Fallback Product");
  assert.strictEqual(result.review_insights.review_count, 123);
}

run()
  .then(() => console.log("link scan fallback ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
