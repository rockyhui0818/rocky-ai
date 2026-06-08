const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

function imageUrl(index) {
  return `https://m.media-amazon.com/images/I/detail-${index}.jpg`;
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
  for (let index = 1; index <= 8; index += 1) {
    dynamicImages[`https://m.media-amazon.com/images/I/main-${index}.jpg`] = [1000, 1000];
  }
  const detailImages = Array.from({ length: 12 }, (_, index) => `<img src="${imageUrl(index + 1)}" alt="A+ detail ${index + 1}">`).join("");
  const reviewBodies = Array.from({ length: 12 }, (_, index) =>
    `<span data-hook="review-body">Review ${index + 1}: quality is excellent, whitening result is visible, package arrived safely, easy daily use.</span>`
  ).join("");

  global.fetch = async (url) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    return new Response(`
      <html>
        <head>
          <title>Full Evidence Product</title>
          <meta name="description" content="Complete product description for model analysis.">
          <meta property="og:image" content="https://m.media-amazon.com/images/I/hero.jpg">
        </head>
        <body>
          <h1>Full Evidence Product</h1>
          <div id="landingImage" data-a-dynamic-image='${JSON.stringify(dynamicImages)}'></div>
          <div id="feature-bullets">
            <ul>
              <li>Clinically inspired whitening strip set.</li>
              <li>Purple colour correction for visible stains.</li>
              <li>Designed for daily use and easy application.</li>
            </ul>
          </div>
          <div id="aplus" class="aplus-v2">${detailImages}</div>
          <span itemprop="ratingValue" content="4.6"></span>
          <span itemprop="reviewCount" content="456"></span>
          ${reviewBodies}
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

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.scanner, "brightdata");
  assert.strictEqual(result.title, "Full Evidence Product");
  assert.match(result.description, /Complete product description/);
  assert(result.page_text_sample.includes("Clinically inspired whitening strip set"), "product body text must be preserved for model analysis");
  assert(result.page_text_sample.includes("Review 1:"), "review text must be preserved in the page sample");
  assert.strictEqual(result.image_candidates.filter((image) => image.type === "main-image").length, 8, "main image evidence should follow the common 7-8 image set");
  assert.strictEqual(result.image_candidates.filter((image) => image.type === "detail-page-image").length, 7, "detail page image evidence should follow the common 5-7 image set");
  assert.strictEqual(result.review_insights.review_count, 456);
  assert(result.review_insights.snippets.length >= 10, "overall review snippets should not be capped at eight");
  assert.strictEqual(result.scan_scope.mode, "brightdata-full-evidence");
}

run()
  .then(() => console.log("full link evidence ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
