const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

function galleryImage(index) {
  return `https://m.media-amazon.com/images/I/carousel-${index}._AC_SL1500_.jpg`;
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

  const carouselImages = Array.from({ length: 9 }, (_, index) => ({
    hiRes: galleryImage(index + 1),
    large: galleryImage(index + 1).replace("SL1500", "SL1000"),
    thumb: galleryImage(index + 1).replace("SL1500", "SS40")
  }));

  global.fetch = async (url) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    return new Response(`
      <html>
        <head>
          <title>Carousel Gallery Product</title>
          <meta name="description" content="Product with Amazon carousel gallery.">
        </head>
        <body>
          <h1>Carousel Gallery Product</h1>
          <script>
            P.when('A').execute(function(A) {
              var imageBlockATF = {
                colorImages: {
                  initial: ${JSON.stringify(carouselImages)}
                }
              };
            });
          </script>
          <span itemprop="reviewCount" content="88"></span>
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
  assert.strictEqual(result.scanner, "brightdata");
  assert.strictEqual(mainImages.length, 8, "Amazon carousel left/right gallery images should be reduced to the common 7-8 image set.");
  assert(mainImages.some((image) => image.source_marker === "colorImages.initial"), "carousel images must keep their gallery source marker.");
  assert(mainImages.some((image) => /主图图库第 8 张/.test(image.source_position || "")), "carousel order must preserve the common gallery positions.");
  assert.strictEqual(result.scan_scope.main_image_count, mainImages.length);
}

run()
  .then(() => console.log("amazon gallery carousel ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
