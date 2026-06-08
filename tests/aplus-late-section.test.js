const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

function aplusImage(index) {
  return `https://m.media-amazon.com/images/I/late-aplus-${index}._AC_SL1500_.jpg`;
}

async function run() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };
  const previousFetch = global.fetch;

  process.env.NODE_ENV = "test";
  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "200";

  const emptyAplusPlaceholders = Array.from({ length: 20 }, (_, index) =>
    `<div id="aplus_feature_div_${index}">Aplus placeholder ${index}</div>`
  ).join("\n");
  const realAplusImages = Array.from({ length: 8 }, (_, index) =>
    `<img src="${aplusImage(index + 1)}" alt="Late A+ module ${index + 1}">`
  ).join("\n");

  global.fetch = async (url) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    return new Response(`
      <html>
        <head>
          <title>Late A+ Product</title>
          <meta name="description" content="A+ content appears after many placeholder markers.">
          <meta property="og:image" content="https://m.media-amazon.com/images/I/main.jpg">
        </head>
        <body>
          <h1>Late A+ Product</h1>
          ${emptyAplusPlaceholders}
          <div class="aplus-v2 premium-aplus">
            ${realAplusImages}
          </div>
        </body>
      </html>
    `, { status: 200, headers: { "Content-Type": "text/html" } });
  };

  clearApiModule("api/generate.js");
  const { scanProductLink } = require(path.join(root, "api/generate.js"));
  const result = await scanProductLink("https://example.com/product", { market: "us" });

  global.fetch = previousFetch;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  const detailImages = result.image_candidates.filter((image) => image.type === "detail-page-image");
  assert.strictEqual(result.ok, true);
  assert(detailImages.length >= 8, "A+ images after early placeholder markers must still be collected.");
  assert(detailImages.some((image) => image.source_marker === "aplus"), "late A+ images must retain the aplus source marker.");
}

run()
  .then(() => console.log("aplus late section ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
