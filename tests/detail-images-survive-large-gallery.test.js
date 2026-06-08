const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

function mainImage(index) {
  return `https://m.media-amazon.com/images/I/large-gallery-${index}._AC_SL1500_.jpg`;
}

function detailImage(index) {
  return `https://m.media-amazon.com/images/S/aplus-media-library-service-media/detail-survive-${index}.__CR0,0,1464,600_PT0_SX1464_V1___.png`;
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

  const dynamicImageBlocks = Array.from({ length: 6 }, (_, blockIndex) => {
    const dynamicImages = {};
    for (let index = 1; index <= 8; index += 1) {
      dynamicImages[mainImage(blockIndex * 8 + index)] = [1500, 1500];
    }
    return `<div data-a-dynamic-image='${JSON.stringify(dynamicImages)}'></div>`;
  }).join("\n");
  const detailImages = Array.from({ length: 10 }, (_, index) =>
    `<img src="${detailImage(index + 1)}" alt="A+ detail module ${index + 1}">`
  ).join("\n");

  global.fetch = async (url) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    return new Response(`
      <html>
        <head>
          <title>Large Gallery With A+</title>
          <meta name="description" content="Large gallery must not hide A+ evidence.">
        </head>
        <body>
          <h1>Large Gallery With A+</h1>
          <div id="landingImage">${dynamicImageBlocks}</div>
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
  assert.strictEqual(result.ok, true);
  assert(mainImages.length <= 12, "main gallery should be capped independently.");
  assert(detailImagesResult.length >= 10, "detail/A+ images must survive even when the main gallery is large.");
  assert.strictEqual(result.scan_scope.detail_page_image_count, detailImagesResult.length);
}

run()
  .then(() => console.log("detail images survive large gallery ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
