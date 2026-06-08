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
          <title>Pollution Product</title>
          <meta name="description" content="Only gallery images should be collected.">
        </head>
        <body>
          <h1>Pollution Product</h1>
          <div id="landingImage" data-a-dynamic-image='{"https://m.media-amazon.com/images/I/main-1._AC_SL1500_.jpg":[1500,1500],"https://m.media-amazon.com/images/I/main-2._AC_SL1500_.jpg":[1500,1500]}'></div>
          <div id="sp_detail">
            <img src="https://m.media-amazon.com/images/I/sponsored-other-product._AC_SL1500_.jpg" alt="Sponsored other product">
            <img src="https://m.media-amazon.com/images/I/recommended-other-product._AC_SL1500_.jpg" alt="Customers also bought">
          </div>
          <div id="reviews">
            <img src="https://m.media-amazon.com/images/I/review-customer-photo._AC_SL1500_.jpg" alt="Customer review image">
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

  const mainImages = result.image_candidates.filter((image) => image.type === "main-image");
  const detailImages = result.image_candidates.filter((image) => image.type === "detail-page-image");
  assert.strictEqual(result.ok, true);
  assert.strictEqual(mainImages.length, 2);
  assert.strictEqual(detailImages.length, 0, "images outside product gallery and A+/detail modules must not be collected as detail-page images.");
  assert(result.image_candidates.every((image) => !/sponsored|recommended|review-customer/i.test(image.src)), "unrelated page images must not be present in scan evidence.");
}

run()
  .then(() => console.log("no full page image pollution ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
