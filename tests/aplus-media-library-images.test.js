const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

function mediaImage(index) {
  return `https://m.media-amazon.com/images/S/al-na-9d5791cf-3faf/media-${index}.mp4/r/THUMBNAIL_360P_FRAME_3_CAPTURE_2.JPG`;
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

  const mediaImages = Array.from({ length: 6 }, (_, index) =>
    `<img src="${mediaImage(index + 1)}" alt="A+ media library module ${index + 1}">`
  ).join("\n");

  global.fetch = async (url) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    return new Response(`
      <html>
        <head>
          <title>A+ Media Library Product</title>
          <meta name="description" content="A+ content uses media library thumbnails.">
          <meta property="og:image" content="https://m.media-amazon.com/images/I/main.jpg">
        </head>
        <body>
          <h1>A+ Media Library Product</h1>
          <div id="aplus_feature_div"></div>
          <div cel_widget_id="aplus" class="aplus-v2 premium-aplus">
            <style>
              .ad { background-image: url(https://m.media-amazon.com/images/G/01/ad-feedback/info-icon-dark1x.png); }
              .preview { background-image: url(https://m.media-amazon.com/images/G/01/advertising/Preview_Bg_r13.png); }
            </style>
            ${mediaImages}
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
  assert(detailImages.length >= 6, "A+ media-library thumbnail assets must be collected as detail images.");
  assert(detailImages.every((image) => !/ad-feedback|advertising\/Preview_Bg/i.test(image.src)), "ad feedback and preview background assets must be filtered out.");
  assert(detailImages.some((image) => /images\/S\/al-na/i.test(image.src)), "images/S A+ media assets should be retained.");
}

run()
  .then(() => console.log("aplus media library images ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
