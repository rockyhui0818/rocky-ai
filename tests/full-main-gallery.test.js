const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

function mainImage(index) {
  return `https://m.media-amazon.com/images/I/full-gallery-${index}._AC_SL1500_.jpg`;
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

  const dynamicImages = {};
  for (let index = 1; index <= 18; index += 1) {
    dynamicImages[mainImage(index)] = [1500, 1500];
  }

  global.fetch = async (url) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    return new Response(`
      <html>
        <head>
          <title>Focused Main Gallery Product</title>
          <meta name="description" content="Main gallery evidence should follow the common marketplace image count.">
        </head>
        <body>
          <h1>Focused Main Gallery Product</h1>
          <div id="landingImage" data-a-dynamic-image='${JSON.stringify(dynamicImages)}'></div>
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
  assert.strictEqual(result.ok, true);
  assert.strictEqual(mainImages.length, 8, "main-gallery evidence should keep the common 7-8 image set instead of flooding the model.");
  assert(mainImages.some((image) => /主图图库第 8 张/.test(image.source_position || "")), "the common main-gallery positions must be preserved.");
  assert.strictEqual(result.scan_scope.main_image_count, mainImages.length);
}

run()
  .then(() => console.log("focused main gallery ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
