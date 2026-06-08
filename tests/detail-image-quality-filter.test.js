const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
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
          <title>Detail Quality Product</title>
          <meta name="description" content="Detail images should exclude tiny variants.">
          <meta property="og:image" content="https://m.media-amazon.com/images/I/main.jpg">
        </head>
        <body>
          <h1>Detail Quality Product</h1>
          <div id="aplus" class="aplus-v2">
            <img src="https://m.media-amazon.com/images/I/tiny-thumb._AC_US40_.jpg" alt="thumbnail">
            <img src="https://m.media-amazon.com/images/I/tiny-swatch._SS100_.jpg" alt="swatch">
            <img src="https://m.media-amazon.com/images/I/medium-render._AC_SY355_.jpg" alt="medium render">
            <img src="https://m.media-amazon.com/images/S/aplus-media-library-service-media/real-aplus.__CR0,0,1464,600_PT0_SX1464_V1___.png" alt="real A+">
            <img src="https://m.media-amazon.com/images/I/large-aplus._AC_SL1500_.jpg" alt="large A+">
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
  assert(detailImages.some((image) => /aplus-media-library-service-media|large-aplus/i.test(image.src)), "real A+ images must remain.");
  assert(detailImages.every((image) => !/_AC_US40_|_SS100_|_AC_SY355_/i.test(image.src)), "tiny and medium thumbnail variants must be excluded from detail evidence.");
}

run()
  .then(() => console.log("detail image quality filter ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
