const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

function restoreEnv(previousEnv) {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function scanFixture({ url, html }) {
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

  global.fetch = async (fetchUrl) => {
    assert.strictEqual(String(fetchUrl), "https://api.brightdata.com/request");
    return new Response(html, { status: 200, headers: { "Content-Type": "text/html" } });
  };

  clearApiModule("api/generate.js");
  const { scanProductLink } = require(path.join(root, "api/generate.js"));
  const result = await scanProductLink(url, { market: "br" });

  global.fetch = previousFetch;
  restoreEnv(previousEnv);
  clearApiModule("api/generate.js");

  return result;
}

async function testMercadoLivreRegions() {
  const result = await scanFixture({
    url: "https://www.mercadolivre.com.br/produto/p/MLB123",
    html: `
      <html>
        <head><title>Mercado Livre Product</title></head>
        <body>
          <section class="ui-pdp-gallery">
            <img src="https://http2.mlstatic.com/D_NQ_NP_main-1-O.jpg" alt="main 1">
            <img src="https://http2.mlstatic.com/D_NQ_NP_main-2-O.jpg" alt="main 2">
            <img src="https://http2.mlstatic.com/D_NQ_NP_main-3-O.jpg" alt="main 3">
          </section>
          <section class="ui-pdp-description">
            <img src="https://http2.mlstatic.com/D_NQ_NP_detail-1-O.jpg" alt="detail 1">
            <img src="https://http2.mlstatic.com/D_NQ_NP_detail-2-O.jpg" alt="detail 2">
          </section>
          <section class="ui-pdp-recommendations">
            <img src="https://http2.mlstatic.com/D_NQ_NP_recommended-O.jpg" alt="recommended item">
          </section>
        </body>
      </html>
    `
  });

  const mainImages = result.image_candidates.filter((image) => image.type === "main-image");
  const detailImages = result.image_candidates.filter((image) => image.type === "detail-page-image");

  assert.strictEqual(result.scan_scope.platform_key, "mercado_livre");
  assert.strictEqual(mainImages.length, 3);
  assert.strictEqual(detailImages.length, 2);
  assert(mainImages.every((image) => image.source_marker.includes("ui-pdp-gallery")));
  assert(detailImages.every((image) => image.source_marker.includes("ui-pdp-description")));
  assert(result.image_candidates.every((image) => !/recommended/i.test(image.src)));
}

async function testShopeeRegions() {
  const result = await scanFixture({
    url: "https://shopee.com.br/product/123/456",
    html: `
      <html>
        <head><title>Shopee Product</title></head>
        <body>
          <div class="product-briefing">
            <div class="flex-column">
              <img src="https://down-br.img.susercontent.com/file/main-shopee-1.webp" alt="main">
              <img src="https://down-br.img.susercontent.com/file/main-shopee-2.webp" alt="main">
            </div>
          </div>
          <div class="product-detail">
            <img src="https://down-br.img.susercontent.com/file/detail-shopee-1.webp" alt="detail">
            <img src="https://down-br.img.susercontent.com/file/detail-shopee-2.webp" alt="detail">
          </div>
          <div class="recommendation-by-carousel">
            <img src="https://down-br.img.susercontent.com/file/recommended-shopee.webp" alt="recommended">
          </div>
        </body>
      </html>
    `
  });

  const mainImages = result.image_candidates.filter((image) => image.type === "main-image");
  const detailImages = result.image_candidates.filter((image) => image.type === "detail-page-image");

  assert.strictEqual(result.scan_scope.platform_key, "shopee");
  assert.strictEqual(mainImages.length, 2);
  assert.strictEqual(detailImages.length, 2);
  assert(mainImages.every((image) => image.source_marker.includes("product-briefing")));
  assert(detailImages.every((image) => image.source_marker.includes("product-detail")));
  assert(result.image_candidates.every((image) => !/recommended/i.test(image.src)));
}

async function testShopifyRegions() {
  const result = await scanFixture({
    url: "https://brand.example/products/widget",
    html: `
      <html>
        <head>
          <title>Shopify Product</title>
          <meta property="og:image" content="https://cdn.shopify.com/s/files/1/main-og.jpg">
        </head>
        <body>
          <product-media-gallery class="product__media-gallery">
            <img src="https://cdn.shopify.com/s/files/1/main-shopify-1_1500x.jpg" alt="main">
            <img src="https://cdn.shopify.com/s/files/1/main-shopify-2_1500x.jpg" alt="main">
          </product-media-gallery>
          <section class="product-description rte">
            <img src="https://cdn.shopify.com/s/files/1/detail-shopify-1_1500x.jpg" alt="detail">
            <img src="https://cdn.shopify.com/s/files/1/detail-shopify-2_1500x.jpg" alt="detail">
          </section>
          <section class="related-products">
            <img src="https://cdn.shopify.com/s/files/1/recommended-shopify_1500x.jpg" alt="recommended">
          </section>
        </body>
      </html>
    `
  });

  const mainImages = result.image_candidates.filter((image) => image.type === "main-image");
  const detailImages = result.image_candidates.filter((image) => image.type === "detail-page-image");

  assert.strictEqual(result.scan_scope.platform_key, "shopify");
  assert.strictEqual(mainImages.length, 2);
  assert.strictEqual(detailImages.length, 2);
  assert(mainImages.every((image) => image.source_marker.includes("product__media-gallery")));
  assert(detailImages.every((image) => image.source_marker.includes("product-description")));
  assert(result.image_candidates.every((image) => !/recommended/i.test(image.src)));
}

async function run() {
  await testMercadoLivreRegions();
  await testShopeeRegions();
  await testShopifyRegions();
}

run()
  .then(() => console.log("platform aware image scan ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
