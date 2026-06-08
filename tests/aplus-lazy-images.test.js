const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

function aplusImage(index) {
  return `https://m.media-amazon.com/images/I/aplus-${index}._AC_SL1500_.jpg`;
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

  global.fetch = async (url) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    return new Response(`
      <html>
        <head>
          <title>A+ Lazy Product</title>
          <meta name="description" content="A+ content uses Amazon lazy image attributes.">
          <meta property="og:image" content="https://m.media-amazon.com/images/I/main.jpg">
        </head>
        <body>
          <h1>A+ Lazy Product</h1>
          <div id="aplus" class="aplus-v2">
            <img data-a-hires="${aplusImage(1)}" alt="A+ benefit module">
            <img data-srcset="${aplusImage(2)} 1x, ${aplusImage(3)} 2x" alt="A+ comparison module">
            <div data-module='{"image":"${aplusImage(4)}","mobile":"${aplusImage(5)}"}'></div>
          </div>
          <span itemprop="reviewCount" content="44"></span>
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
  assert(detailImages.length >= 5, "A+ lazy-loaded image attributes and JSON image values must be collected as detail images.");
  assert(detailImages.some((image) => image.source_marker === "aplus"), "A+ detail images must keep the aplus source marker.");
  assert.strictEqual(result.scan_scope.detail_page_image_count, detailImages.length);
}

run()
  .then(() => console.log("aplus lazy images ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
