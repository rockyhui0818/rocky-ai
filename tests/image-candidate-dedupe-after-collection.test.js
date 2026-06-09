const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

function variantImage(name, variant) {
  return `https://m.media-amazon.com/images/I/${name}._AC_${variant}_.jpg`;
}

function aplusImage(name, variant) {
  return `https://m.media-amazon.com/images/S/aplus-media-library-service-media/${name}.__CR0,0,1464,600_PT0_${variant}_V1___.png`;
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
  for (let index = 1; index <= 10; index += 1) {
    dynamicImages[variantImage(`main-dedupe-${index}`, "SX38")] = [38, 38];
    dynamicImages[variantImage(`main-dedupe-${index}`, "SX679")] = [679, 679];
    dynamicImages[variantImage(`main-dedupe-${index}`, "SL1500")] = [1500, 1500];
  }

  const detailImages = Array.from({ length: 9 }, (_, index) => `
    <picture>
      <source srcset="${aplusImage(`detail-dedupe-${index + 1}`, "SX300")}">
      <img src="${aplusImage(`detail-dedupe-${index + 1}`, "SX1464")}" alt="A+ module ${index + 1}">
    </picture>
  `).join("\n");

  global.fetch = async (url) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    return new Response(`
      <html>
        <head>
          <title>Dedupe Candidate Product</title>
          <meta name="description" content="Collect first, dedupe and select after collection.">
        </head>
        <body>
          <h1>Dedupe Candidate Product</h1>
          <div id="landingImage" data-a-dynamic-image='${JSON.stringify(dynamicImages)}'></div>
          <div id="sp_detail">
            <img src="https://m.media-amazon.com/images/I/recommended-other-product._AC_SL1500_.jpg" alt="Customers also bought">
          </div>
          <div id="aplus" class="aplus-v2 premium-aplus">
            ${detailImages}
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
  const detailImagesResult = result.image_candidates.filter((image) => image.type === "detail-page-image");
  const mainKeys = new Set(mainImages.map((image) => image.dedupe_key || image.src));
  const detailKeys = new Set(detailImagesResult.map((image) => image.dedupe_key || image.src));

  assert.strictEqual(result.ok, true);
  assert.strictEqual(mainImages.length, 8, "main gallery should keep eight unique images after collecting all variants.");
  assert.strictEqual(mainKeys.size, mainImages.length, "main gallery variants must be deduped before the eight-image selection.");
  assert(mainImages.every((image) => /SL1500/i.test(image.src)), "largest main-gallery variants should win after dedupe.");
  assert(mainImages.some((image) => /main-dedupe-8/i.test(image.src)), "later unique main images must survive duplicate variants before them.");
  assert.strictEqual(detailImagesResult.length, 7, "A+/detail should keep seven unique images after collecting all variants.");
  assert.strictEqual(detailKeys.size, detailImagesResult.length, "A+/detail variants must be deduped before the seven-image selection.");
  assert(detailImagesResult.every((image) => /SX1464/i.test(image.src)), "largest A+ variants should win after dedupe.");
  assert(result.image_candidates.every((image) => !/recommended-other-product/i.test(image.src)), "non A+/detail region images must not be collected.");
  assert.strictEqual(result.scan_scope.main_image_count, 8);
  assert.strictEqual(result.scan_scope.detail_page_image_count, 7);
}

run()
  .then(() => console.log("image candidate dedupe after collection ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
