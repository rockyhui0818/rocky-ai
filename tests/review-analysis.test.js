const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule() {
  delete require.cache[require.resolve(path.join(root, "api/generate.js"))];
}

function restoreEnv(previousEnv) {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function testNestedAndSerializedReviewsAreExtracted() {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  clearApiModule();
  const { __test } = require(path.join(root, "api/generate.js"));

  const html = `
    <html>
      <body>
        <span itemprop="ratingValue" content="4.5"></span>
        <span itemprop="reviewCount" content="789"></span>
        <div id="cm-cr-dp-review-list">
          <div data-hook="review">
            <a data-hook="review-title"><span>Visible whitening without sensitivity</span></a>
            <span data-hook="review-body">
              <span>Great whitening strips, easy daily use, visible results after a few days.</span>
            </span>
          </div>
          <div data-hook="review">
            <span data-hook="review-body">
              <span>Packaging arrived damaged but the product still worked well for coffee stains.</span>
            </span>
          </div>
        </div>
        <script>
          window.__reviews = [{"reviewText":"The purple correction effect is convenient before work and the flavor is mild."}];
          window.__escaped = "{&quot;reviewBody&quot;:&quot;Customer service replaced a broken box quickly and I recommend it.&quot;}";
        </script>
      </body>
    </html>
  `;

  const insights = __test.extractReviewInsights(html);
  const joined = insights.snippets.join(" ");

  assert.strictEqual(insights.rating, 4.5);
  assert.strictEqual(insights.review_count, 789);
  assert(
    insights.snippets.length >= 4,
    `expected nested DOM and serialized review snippets, got ${insights.snippets.length}: ${JSON.stringify(insights.snippets)}`
  );
  assert.match(joined, /Great whitening strips/);
  assert.match(joined, /Packaging arrived damaged/);
  assert.match(joined, /purple correction effect/i);
  assert.match(joined, /Customer service replaced/i);

  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  clearApiModule();
}

async function testAmazonReviewBoilerplateIsFiltered() {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  clearApiModule();
  const { __test } = require(path.join(root, "api/generate.js"));

  const html = `
    <html>
      <body>
        <span data-hook="review-title">5.0 out of 5 stars</span>
        <span data-hook="review-body">Images in this review</span>
        <span data-hook="review-body">There was a problem filtering reviews. Please reload the page.</span>
        <span data-hook="review-body">Top reviews from the United States</span>
        <span data-hook="review-body">
          Amazon Customer 5 out of 5 stars Happy with the results Reviewed in the United States on March 17, 2026 Size: 1 Count (Pack of 14) Verified Purchase Brief content visible, double tap to read full content.
          Not permanent results but if u have a event great for here and there uses or add it to ur routine for teeth whitening Read more Read less
        </span>
        <span data-hook="review-body">The whitening effect was visible after a week and the strips were easy to use.</span>
        <span data-hook="review-body">Packaging arrived crushed, which made me worry about delivery quality.</span>
      </body>
    </html>
  `;

  const insights = __test.extractReviewInsights(html);
  const joined = insights.snippets.join(" ");

  assert.strictEqual(insights.snippets.length, 3);
  assert.match(joined, /event great|whitening effect/);
  assert.match(joined, /Packaging arrived crushed/);
  assert(!/Images in this review|problem filtering reviews|Top reviews|Brief content visible|Read more|Read less|Verified Purchase|Amazon Customer|out of 5 stars/i.test(joined));

  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  clearApiModule();
}

async function testAmazonReviewPageIsFetchedWhenProductPageHasOnlyReviewCount() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };
  const previousFetch = global.fetch;
  const calls = [];

  process.env.NODE_ENV = "test";
  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "200";

  global.fetch = async (url, options = {}) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    const body = JSON.parse(options.body || "{}");
    calls.push(body.url);
    if (String(body.url).includes("/product-reviews/B0F42ZTSZZ")) {
      return new Response(`
        <html>
          <body>
            <div data-hook="review">
              <span data-hook="review-body">I saw visible whitening in a week and it was easy to use every morning.</span>
            </div>
            <div data-hook="review">
              <span data-hook="review-body">The box arrived crushed, but customer support replaced it quickly.</span>
            </div>
          </body>
        </html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }
    return new Response(`
      <html>
        <head><title>Hismile Whitening Treatment</title></head>
        <body>
          <span itemprop="ratingValue" content="4.4"></span>
          <span itemprop="reviewCount" content="987"></span>
          <div id="landingImage" data-a-dynamic-image='{"https://m.media-amazon.com/images/I/main.jpg":[1000,1000]}'></div>
        </body>
      </html>
    `, { status: 200, headers: { "Content-Type": "text/html" } });
  };

  try {
    clearApiModule();
    const { scanProductLink } = require(path.join(root, "api/generate.js"));
    const result = await scanProductLink(
      "https://www.amazon.com/Hismile-Whitening-Treatment-Combining-Correction/dp/B0F42ZTSZZ?ref_=ast_sto_dp&th=1",
      { market: "us" }
    );

    assert(
      calls.some((url) => String(url).includes("/product-reviews/B0F42ZTSZZ")),
      `expected Amazon review page fetch, got ${JSON.stringify(calls)}`
    );
    assert.strictEqual(result.review_insights.review_count, 987);
    assert(result.review_insights.snippets.length >= 2);
    assert.match(result.review_insights.snippets.join(" "), /visible whitening/);
    assert.match(result.review_insights.snippets.join(" "), /box arrived crushed/);
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModule();
  }
}

async function testAmazonBrazilReviewUrlsUseRecentPaginatedReviewPath() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };
  const previousFetch = global.fetch;
  const calls = [];

  process.env.NODE_ENV = "test";
  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "200";

  global.fetch = async (url, options = {}) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    const body = JSON.parse(options.body || "{}");
    calls.push(body.url);
    const target = String(body.url);
    const pageNumber = Number(target.match(/pageNumber=(\d+)/)?.[1] || 1);

    if (target.includes("/product-reviews/B0F42ZTSZZ/ref=cm_cr_arp_d_viewopt_srt")) {
      return new Response(`
        <html><body>
          <div data-hook="review">
            <span data-hook="review-body">Brazil recent page ${pageNumber}: embalagem chegou danificada, mas o produto e facil de usar.</span>
          </div>
        </body></html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    return new Response(`
      <html>
        <head><title>Hismile Brazil</title></head>
        <body>
          <span itemprop="ratingValue" content="4.1"></span>
          <span itemprop="reviewCount" content="2700"></span>
          <div id="landingImage" data-a-dynamic-image='{"https://m.media-amazon.com/images/I/main-br.jpg":[1000,1000]}'></div>
        </body>
      </html>
    `, { status: 200, headers: { "Content-Type": "text/html" } });
  };

  try {
    clearApiModule();
    const { scanProductLink } = require(path.join(root, "api/generate.js"));
    const result = await scanProductLink(
      "https://www.amazon.com.br/Hismile-Whitening-Treatment-Combining-Correction/dp/B0F42ZTSZZ?ref_=ast_sto_dp&th=1",
      { market: "br" }
    );

    const reviewCalls = calls.filter((url) => String(url).includes("/product-reviews/B0F42ZTSZZ/ref=cm_cr_arp_d_viewopt_srt"));
    assert(reviewCalls.length, `expected Brazil Amazon review URL fetch, got ${JSON.stringify(calls)}`);
    assert(
      reviewCalls.every((url) => String(url).startsWith("https://www.amazon.com.br/product-reviews/B0F42ZTSZZ/ref=cm_cr_arp_d_viewopt_srt?")),
      `expected Brazilian review URLs to use the requested path, got ${JSON.stringify(reviewCalls)}`
    );
    assert(
      reviewCalls.some((url) => String(url).includes("reviewerType=all_reviews") && String(url).includes("sortBy=recent") && String(url).includes("pageNumber=1")),
      `expected recent page 1 URL, got ${JSON.stringify(reviewCalls)}`
    );
    assert(
      reviewCalls.some((url) => String(url).includes("sortBy=recent") && String(url).includes("pageNumber=2")),
      `expected paginated recent page 2 URL, got ${JSON.stringify(reviewCalls)}`
    );
    assert.match(result.review_insights.snippets.join(" "), /Brazil recent page/);
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModule();
  }
}

async function testAmazonAllReviewsEntryLinkIsFetchedBeforeReviewPagination() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };
  const previousFetch = global.fetch;
  const calls = [];

  process.env.NODE_ENV = "test";
  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "200";

  global.fetch = async (url, options = {}) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    const body = JSON.parse(options.body || "{}");
    calls.push(body.url);
    const target = String(body.url);

    if (target.includes("/product-reviews/B0F42ZTSZZ/ref=cm_cr_dp_d_show_all_btm")) {
      return new Response(`
        <html><body>
          <div data-hook="review">
            <span data-hook="review-body">All reviews entry page: latest customer says results are good but packaging was damaged.</span>
          </div>
        </body></html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    if (target.includes("/product-reviews/B0F42ZTSZZ")) {
      return new Response(`
        <html><body>
          <div data-hook="review">
            <span data-hook="review-body">Paginated review page: easy routine and mild taste.</span>
          </div>
        </body></html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    return new Response(`
      <html>
        <head><title>Hismile Whitening Treatment</title></head>
        <body>
          <span itemprop="ratingValue" content="4.2"></span>
          <span itemprop="reviewCount" content="2700"></span>
          <div id="reviews-medley-footer">
            <a data-hook="see-all-reviews-link-foot" href="/product-reviews/B0F42ZTSZZ/ref=cm_cr_dp_d_show_all_btm?ie=UTF8&reviewerType=all_reviews">See all reviews</a>
          </div>
          <div id="landingImage" data-a-dynamic-image='{"https://m.media-amazon.com/images/I/main.jpg":[1000,1000]}'></div>
        </body>
      </html>
    `, { status: 200, headers: { "Content-Type": "text/html" } });
  };

  try {
    clearApiModule();
    const { scanProductLink } = require(path.join(root, "api/generate.js"));
    const result = await scanProductLink(
      "https://www.amazon.com/Hismile-Whitening-Treatment-Combining-Correction/dp/B0F42ZTSZZ?ref_=ast_sto_dp&th=1",
      { market: "us" }
    );

    const entryIndex = calls.findIndex((url) => String(url).includes("/product-reviews/B0F42ZTSZZ/ref=cm_cr_dp_d_show_all_btm"));
    const paginatedIndex = calls.findIndex((url) => String(url).includes("/product-reviews/B0F42ZTSZZ") && String(url).includes("filterByStar="));
    assert(entryIndex > 0, `expected all reviews entry link request, got ${JSON.stringify(calls)}`);
    assert(paginatedIndex > entryIndex, `expected all reviews entry before star pagination, got ${JSON.stringify(calls)}`);
    assert.match(result.review_insights.snippets.join(" "), /All reviews entry page/);
    assert.strictEqual(result.review_fetch_diagnostics.all_reviews_entry_found, true);
    assert.match(result.review_fetch_diagnostics.all_reviews_entry_url, /cm_cr_dp_d_show_all_btm/);
    assert(result.review_fetch_diagnostics.attempted_url_count >= 2);
    assert(result.review_fetch_diagnostics.successful_page_count >= 1);
    assert(result.review_fetch_diagnostics.extracted_snippet_count >= 1);
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModule();
  }
}

async function testAmazonNegativeReviewPagesArePrioritized() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };
  const previousFetch = global.fetch;
  const calls = [];

  process.env.NODE_ENV = "test";
  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "200";

  global.fetch = async (url, options = {}) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    const body = JSON.parse(options.body || "{}");
    calls.push(body.url);
    const target = String(body.url);

    if (target.includes("/product-reviews/B0F42ZTSZZ") && target.includes("filterByStar=critical")) {
      return new Response(`
        <html>
          <body>
            <div data-hook="review">
              <span data-hook="review-body">The whitening did not last long and the strips were hard to keep in place.</span>
            </div>
            <div data-hook="review">
              <span data-hook="review-body">Packaging arrived damaged and several strips were dry, so I would not recommend it.</span>
            </div>
          </body>
        </html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    if (target.includes("/product-reviews/B0F42ZTSZZ")) {
      return new Response(`
        <html>
          <body>
            <div data-hook="review">
              <span data-hook="review-body">Easy to use before an event and the taste was mild.</span>
            </div>
          </body>
        </html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    return new Response(`
      <html>
        <head><title>Hismile Whitening Treatment</title></head>
        <body>
          <span itemprop="ratingValue" content="3.8"></span>
          <span itemprop="reviewCount" content="2470"></span>
          <div id="landingImage" data-a-dynamic-image='{"https://m.media-amazon.com/images/I/main.jpg":[1000,1000]}'></div>
        </body>
      </html>
    `, { status: 200, headers: { "Content-Type": "text/html" } });
  };

  try {
    clearApiModule();
    const { scanProductLink } = require(path.join(root, "api/generate.js"));
    const result = await scanProductLink(
      "https://www.amazon.com/Hismile-Whitening-Treatment-Combining-Correction/dp/B0F42ZTSZZ?ref_=ast_sto_dp&th=1",
      { market: "us" }
    );

    assert(
      calls.some((url) => String(url).includes("filterByStar=critical")),
      `expected Amazon negative review page fetch, got ${JSON.stringify(calls)}`
    );
    assert(
      calls.findIndex((url) => String(url).includes("filterByStar=critical")) <
        calls.findIndex((url) => String(url).includes("sortBy=recent") && !String(url).includes("filterByStar=")),
      `expected negative review fetch before recent review fetch, got ${JSON.stringify(calls)}`
    );
    const joined = result.review_insights.snippets.join(" ");
    assert.match(joined, /did not last long/);
    assert.match(joined, /Packaging arrived damaged/);
    assert.match(joined, /Easy to use before an event/);
    assert.strictEqual(result.review_insights.review_count, 2470);
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModule();
  }
}

async function testAmazonPositiveReviewPagesFeedHighQualitySellingPoints() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };
  const previousFetch = global.fetch;
  const calls = [];

  process.env.NODE_ENV = "test";
  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "200";

  global.fetch = async (url, options = {}) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    const body = JSON.parse(options.body || "{}");
    calls.push(body.url);
    const target = String(body.url);

    if (target.includes("/product-reviews/B0F42ZTSZZ") && target.includes("filterByStar=critical")) {
      return new Response(`
        <html>
          <body>
            <div data-hook="review">
              <span data-hook="review-body">Packaging arrived damaged and the strips were difficult to keep in place.</span>
            </div>
          </body>
        </html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    if (target.includes("/product-reviews/B0F42ZTSZZ") && target.includes("filterByStar=positive")) {
      return new Response(`
        <html>
          <body>
            <div data-hook="review">
              <span data-hook="review-body">Great whitening results before an event, easy routine, and mild taste.</span>
            </div>
            <div data-hook="review">
              <span data-hook="review-body">Excellent quality strips, comfortable to use daily, and I recommend them.</span>
            </div>
          </body>
        </html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    if (target.includes("/product-reviews/B0F42ZTSZZ")) {
      return new Response(`
        <html>
          <body>
            <div data-hook="review">
              <span data-hook="review-body">Easy to use before an event and the taste was mild.</span>
            </div>
          </body>
        </html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    return new Response(`
      <html>
        <head><title>Hismile Whitening Treatment</title></head>
        <body>
          <span itemprop="ratingValue" content="3.8"></span>
          <span itemprop="reviewCount" content="2470"></span>
          <div id="landingImage" data-a-dynamic-image='{"https://m.media-amazon.com/images/I/main.jpg":[1000,1000]}'></div>
        </body>
      </html>
    `, { status: 200, headers: { "Content-Type": "text/html" } });
  };

  try {
    clearApiModule();
    const { scanProductLink } = require(path.join(root, "api/generate.js"));
    const result = await scanProductLink(
      "https://www.amazon.com/Hismile-Whitening-Treatment-Combining-Correction/dp/B0F42ZTSZZ?ref_=ast_sto_dp&th=1",
      { market: "us" }
    );

    assert(
      calls.some((url) => String(url).includes("filterByStar=positive")),
      `expected Amazon positive review page fetch, got ${JSON.stringify(calls)}`
    );
    const joined = result.review_insights.snippets.join(" ");
    assert.match(joined, /Great whitening results/);
    assert.match(joined, /Excellent quality strips/);
    assert(
      result.review_insights.positive_terms.some((item) => ["great", "excellent", "quality", "easy", "recommend"].includes(item.term)),
      `expected positive terms from quality reviews, got ${JSON.stringify(result.review_insights.positive_terms)}`
    );
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModule();
  }
}

async function testAmazonReviewPagesAreFetchedEvenWhenProductPageHasFewSnippets() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };
  const previousFetch = global.fetch;
  const calls = [];

  process.env.NODE_ENV = "test";
  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "200";

  global.fetch = async (url, options = {}) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    const body = JSON.parse(options.body || "{}");
    calls.push(body.url);
    const target = String(body.url);

    if (target.includes("/product-reviews/B0F42ZTSZZ") && target.includes("filterByStar=critical")) {
      return new Response(`
        <html>
          <body>
            <div data-hook="review"><span data-hook="review-body">Results faded quickly and the strips slipped during use.</span></div>
            <div data-hook="review"><span data-hook="review-body">The package arrived crushed and I worried the strips were dry.</span></div>
          </body>
        </html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    if (target.includes("/product-reviews/B0F42ZTSZZ") && target.includes("filterByStar=positive")) {
      return new Response(`
        <html>
          <body>
            <div data-hook="review"><span data-hook="review-body">Great for a quick event and easy to add into my whitening routine.</span></div>
          </body>
        </html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    if (target.includes("/product-reviews/B0F42ZTSZZ")) {
      return new Response(`
        <html>
          <body>
            <div data-hook="review"><span data-hook="review-body">Easy to use before an event and the taste was mild.</span></div>
          </body>
        </html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    return new Response(`
      <html>
        <head><title>Hismile Whitening Treatment</title></head>
        <body>
          <span itemprop="ratingValue" content="3.8"></span>
          <span itemprop="reviewCount" content="2470"></span>
          <div id="landingImage" data-a-dynamic-image='{"https://m.media-amazon.com/images/I/main.jpg":[1000,1000]}'></div>
          <div id="cm-cr-dp-review-list">
            <span data-hook="review-body">Not permanent results but great for an event or routine use.</span>
            <span data-hook="review-body">Easy to use and mild flavor.</span>
            <span data-hook="review-body">Size of the pack was confusing.</span>
            <span data-hook="review-body">Shipping was slower than expected.</span>
          </div>
        </body>
      </html>
    `, { status: 200, headers: { "Content-Type": "text/html" } });
  };

  try {
    clearApiModule();
    const { scanProductLink } = require(path.join(root, "api/generate.js"));
    const result = await scanProductLink(
      "https://www.amazon.com/Hismile-Whitening-Treatment-Combining-Correction/dp/B0F42ZTSZZ?ref_=ast_sto_dp&th=1",
      { market: "us" }
    );

    assert(
      calls.some((url) => String(url).includes("filterByStar=critical")) &&
        calls.some((url) => String(url).includes("filterByStar=positive")),
      `expected supplemental Amazon review pages despite product-page snippets, got ${JSON.stringify(calls)}`
    );
    const joined = result.review_insights.snippets.join(" ");
    assert.match(joined, /Results faded quickly/);
    assert.match(joined, /package arrived crushed/);
    assert.match(joined, /quick event/);
    assert(result.review_insights.snippets.length > 4);
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModule();
  }
}

async function testAmazonCollectsNegativeBucketsAndFiftyPositiveSamples() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };
  const previousFetch = global.fetch;
  const calls = [];

  process.env.NODE_ENV = "test";
  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "200";

  global.fetch = async (url, options = {}) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    const body = JSON.parse(options.body || "{}");
    calls.push(body.url);
    const target = String(body.url);
    const pageNumber = Number(target.match(/pageNumber=(\d+)/)?.[1] || 1);

    if (target.includes("/product-reviews/B0F42ZTSZZ") && target.includes("filterByStar=critical")) {
      return new Response(`
        <html><body>
          ${Array.from({ length: 4 }, (_, index) => `
            <div data-hook="review"><span data-hook="review-body">Critical page ${pageNumber} complaint ${index + 1}: strips slipped, results faded quickly, packaging arrived damaged.</span></div>
          `).join("")}
        </body></html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    if (target.includes("/product-reviews/B0F42ZTSZZ") && target.includes("filterByStar=positive")) {
      return new Response(`
        <html><body>
          ${Array.from({ length: 12 }, (_, index) => `
            <div data-hook="review"><span data-hook="review-body">Positive page ${pageNumber} praise ${index + 1}: great whitening results, easy routine, excellent quality, recommend for events.</span></div>
          `).join("")}
        </body></html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    if (target.includes("/product-reviews/B0F42ZTSZZ")) {
      return new Response(`<html><body></body></html>`, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    return new Response(`
      <html>
        <head><title>Hismile Whitening Treatment</title></head>
        <body>
          <span itemprop="ratingValue" content="3.8"></span>
          <span itemprop="reviewCount" content="2470"></span>
          <div id="landingImage" data-a-dynamic-image='{"https://m.media-amazon.com/images/I/main.jpg":[1000,1000]}'></div>
        </body>
      </html>
    `, { status: 200, headers: { "Content-Type": "text/html" } });
  };

  try {
    clearApiModule();
    const { scanProductLink } = require(path.join(root, "api/generate.js"));
    const result = await scanProductLink(
      "https://www.amazon.com/Hismile-Whitening-Treatment-Combining-Correction/dp/B0F42ZTSZZ?ref_=ast_sto_dp&th=1",
      { market: "us" }
    );

    assert(calls.some((url) => String(url).includes("filterByStar=critical") && String(url).includes("pageNumber=5")), `expected multiple critical pages, got ${JSON.stringify(calls)}`);
    assert(calls.some((url) => String(url).includes("filterByStar=positive") && String(url).includes("pageNumber=5")), `expected enough positive pages for 50 samples, got ${JSON.stringify(calls)}`);
    assert(Array.isArray(result.review_insights.negative_snippets), "negative review snippets should be separated for pain-point analysis.");
    assert(Array.isArray(result.review_insights.positive_snippets), "positive review snippets should be separated for selling-point analysis.");
    assert(result.review_insights.negative_snippets.length >= 20, `expected many negative snippets, got ${result.review_insights.negative_snippets.length}`);
    assert.strictEqual(result.review_insights.positive_snippets.length, 50);
    assert.match(result.review_insights.negative_snippets.join(" "), /results faded quickly/);
    assert.match(result.review_insights.positive_snippets.join(" "), /great whitening results/);
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModule();
  }
}

async function testAmazonCollectsExplicitOneTwoAndFiveStarPages() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };
  const previousFetch = global.fetch;
  const calls = [];

  process.env.NODE_ENV = "test";
  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "200";

  global.fetch = async (url, options = {}) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    const body = JSON.parse(options.body || "{}");
    calls.push(body.url);
    const target = String(body.url);
    const pageNumber = Number(target.match(/pageNumber=(\d+)/)?.[1] || 1);

    if (target.includes("/product-reviews/B0F42ZTSZZ") && target.includes("filterByStar=one_star")) {
      return new Response(`
        <html><body>
          ${Array.from({ length: 4 }, (_, index) => `
            <div data-hook="review"><span data-hook="review-body">One star complaint ${index + 1}: no whitening results, strips slipped, box arrived damaged.</span></div>
          `).join("")}
        </body></html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    if (target.includes("/product-reviews/B0F42ZTSZZ") && target.includes("filterByStar=two_star")) {
      return new Response(`
        <html><body>
          ${Array.from({ length: 5 }, (_, index) => `
            <div data-hook="review"><span data-hook="review-body">Two star complaint ${index + 1}: results faded quickly, difficult to use, package was crushed.</span></div>
          `).join("")}
        </body></html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    if (target.includes("/product-reviews/B0F42ZTSZZ") && target.includes("filterByStar=five_star")) {
      return new Response(`
        <html><body>
          ${Array.from({ length: 12 }, (_, index) => `
            <div data-hook="review"><span data-hook="review-body">Five star page ${pageNumber} praise ${index + 1}: great whitening results, easy routine, excellent quality, recommend for events.</span></div>
          `).join("")}
        </body></html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    if (target.includes("/product-reviews/B0F42ZTSZZ")) {
      return new Response(`<html><body></body></html>`, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    return new Response(`
      <html>
        <head><title>Hismile Whitening Treatment</title></head>
        <body>
          <span itemprop="ratingValue" content="3.8"></span>
          <span itemprop="reviewCount" content="2470"></span>
          <div id="landingImage" data-a-dynamic-image='{"https://m.media-amazon.com/images/I/main.jpg":[1000,1000]}'></div>
        </body>
      </html>
    `, { status: 200, headers: { "Content-Type": "text/html" } });
  };

  try {
    clearApiModule();
    const { scanProductLink } = require(path.join(root, "api/generate.js"));
    const result = await scanProductLink(
      "https://www.amazon.com/Hismile-Whitening-Treatment-Combining-Correction/dp/B0F42ZTSZZ?ref_=ast_sto_dp&th=1",
      { market: "us" }
    );

    assert(calls.some((url) => String(url).includes("filterByStar=one_star")), `expected one-star review page fetch, got ${JSON.stringify(calls)}`);
    assert(calls.some((url) => String(url).includes("filterByStar=two_star")), `expected two-star review page fetch, got ${JSON.stringify(calls)}`);
    assert(calls.some((url) => String(url).includes("filterByStar=five_star")), `expected five-star review page fetch, got ${JSON.stringify(calls)}`);
    assert.strictEqual(result.review_insights.negative_snippets.length, 9);
    assert.strictEqual(result.review_insights.positive_snippets.length, 50);
    assert.match(result.review_insights.negative_snippets.join(" "), /One star complaint 4/);
    assert.match(result.review_insights.negative_snippets.join(" "), /Two star complaint 5/);
    assert.match(result.review_insights.positive_snippets.join(" "), /Five star page 5 praise/);
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModule();
  }
}

async function testAmazonSupplementalReviewPagesFetchInParallelBatches() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };
  const previousFetch = global.fetch;
  let activeReviewFetches = 0;
  let maxActiveReviewFetches = 0;

  process.env.NODE_ENV = "test";
  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "300";

  global.fetch = async (url, options = {}) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    const body = JSON.parse(options.body || "{}");
    const target = String(body.url);
    const isReviewPage = target.includes("/product-reviews/B0F42ZTSZZ");
    if (isReviewPage) {
      activeReviewFetches += 1;
      maxActiveReviewFetches = Math.max(maxActiveReviewFetches, activeReviewFetches);
      await new Promise((resolve) => setTimeout(resolve, 20));
      activeReviewFetches -= 1;
      const bucketText = target.includes("five_star") || target.includes("positive")
        ? "Five star praise: great whitening results, easy routine, excellent quality."
        : "Low star complaint: results faded quickly, package arrived damaged, strips slipped.";
      return new Response(`<html><body><div data-hook="review"><span data-hook="review-body">${bucketText}</span></div></body></html>`, {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    }

    return new Response(`
      <html>
        <head><title>Hismile Whitening Treatment</title></head>
        <body>
          <span itemprop="ratingValue" content="3.8"></span>
          <span itemprop="reviewCount" content="2470"></span>
          <div id="landingImage" data-a-dynamic-image='{"https://m.media-amazon.com/images/I/main.jpg":[1000,1000]}'></div>
        </body>
      </html>
    `, { status: 200, headers: { "Content-Type": "text/html" } });
  };

  try {
    clearApiModule();
    const { scanProductLink } = require(path.join(root, "api/generate.js"));
    await scanProductLink(
      "https://www.amazon.com/Hismile-Whitening-Treatment-Combining-Correction/dp/B0F42ZTSZZ?ref_=ast_sto_dp&th=1",
      { market: "us" }
    );
    assert(maxActiveReviewFetches > 1, `expected supplemental review pages to fetch in parallel batches, got max concurrency ${maxActiveReviewFetches}`);
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModule();
  }
}

async function testAmazonKeepsExpandedLowStarSamplesBeyondInitialPages() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };
  const previousFetch = global.fetch;
  const calls = [];

  process.env.NODE_ENV = "test";
  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "300";

  global.fetch = async (url, options = {}) => {
    assert.strictEqual(String(url), "https://api.brightdata.com/request");
    const body = JSON.parse(options.body || "{}");
    calls.push(body.url);
    const target = String(body.url);
    const pageNumber = Number(target.match(/pageNumber=(\d+)/)?.[1] || 1);

    if (target.includes("/product-reviews/B0F42ZTSZZ") && /filterByStar=(one_star|two_star)/.test(target)) {
      const starLabel = target.includes("one_star") ? "one star" : "two star";
      return new Response(`
        <html><body>
          ${Array.from({ length: 8 }, (_, index) => `
            <div data-hook="review"><span data-hook="review-body">${starLabel} low star page ${pageNumber} complaint ${index + 1}: battery failed, package arrived damaged, difficult setup, refund requested.</span></div>
          `).join("")}
        </body></html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    if (target.includes("/product-reviews/B0F42ZTSZZ") && /filterByStar=(five_star|positive)/.test(target)) {
      return new Response(`
        <html><body>
          ${Array.from({ length: 10 }, (_, index) => `
            <div data-hook="review"><span data-hook="review-body">Five star page ${pageNumber} praise ${index + 1}: great quality, easy daily use, excellent value, recommend it.</span></div>
          `).join("")}
        </body></html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    if (target.includes("/product-reviews/B0F42ZTSZZ")) {
      return new Response(`<html><body></body></html>`, { status: 200, headers: { "Content-Type": "text/html" } });
    }

    return new Response(`
      <html>
        <head><title>Hismile Whitening Treatment</title></head>
        <body>
          <span itemprop="ratingValue" content="4.3"></span>
          <span itemprop="reviewCount" content="18569"></span>
          <div id="landingImage" data-a-dynamic-image='{"https://m.media-amazon.com/images/I/main.jpg":[1000,1000]}'></div>
        </body>
      </html>
    `, { status: 200, headers: { "Content-Type": "text/html" } });
  };

  try {
    clearApiModule();
    const { scanProductLink } = require(path.join(root, "api/generate.js"));
    const result = await scanProductLink(
      "https://www.amazon.com/Hismile-Whitening-Treatment-Combining-Correction/dp/B0F42ZTSZZ?ref_=ast_sto_dp&th=1",
      { market: "us" }
    );

    assert(calls.some((url) => String(url).includes("filterByStar=one_star") && String(url).includes("pageNumber=12")), "one-star collection should continue past the first 5 pages.");
    assert(calls.some((url) => String(url).includes("filterByStar=two_star") && String(url).includes("pageNumber=12")), "two-star collection should continue past the first 5 pages.");
    assert(result.review_insights.negative_snippets.length >= 150, `expected expanded low-star evidence, got ${result.review_insights.negative_snippets.length}`);
    assert.strictEqual(result.review_insights.positive_snippets.length, 50);
    assert.match(result.review_insights.negative_snippets.join(" "), /low star page 12 complaint/);
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModule();
  }
}

async function testPlatformReviewSectionsArePreferredOverPageWideFallback() {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  clearApiModule();
  const { __test } = require(path.join(root, "api/generate.js"));

  const mercadoLivreHtml = `
    <html>
      <body>
        <span itemprop="ratingValue" content="4.8"></span>
        <span itemprop="reviewCount" content="321"></span>
        <section class="marketing-review-banner">
          Review nossa loja oficial, aproveite cupom e frete gratis para novos clientes.
        </section>
        <section class="ui-review-capability">
          <article class="ui-review-capability__comments">
            <p class="ui-pdp-review__comment">Produto chegou rapido, embalagem bem protegida e qualidade excelente para uso diario.</p>
            <p class="ui-pdp-review__comment">Achei facil de usar em casa, o resultado apareceu rapido e recomendo.</p>
          </article>
        </section>
      </body>
    </html>
  `;

  const shopeeHtml = `
    <html>
      <body>
        <div class="site-review-strip">Review ofertas relampago com desconto progressivo para afiliados.</div>
        <section class="product-ratings">
          <div class="shopee-product-rating">
            <div class="product-rating-overview">4.9 out of 5</div>
            <div class="shopee-product-rating__content">Delivery was fast, package arrived clean, and the product worked well for travel.</div>
          </div>
        </section>
      </body>
    </html>
  `;

  const mercadoLivreInsights = __test.extractReviewInsights(mercadoLivreHtml, "mercado_livre");
  const shopeeInsights = __test.extractReviewInsights(shopeeHtml, "shopee");

  assert.strictEqual(mercadoLivreInsights.review_count, 321);
  assert.match(mercadoLivreInsights.snippets.join(" "), /Produto chegou rapido/);
  assert.match(mercadoLivreInsights.snippets.join(" "), /Achei facil de usar/);
  assert(!/cupom|frete gratis/i.test(mercadoLivreInsights.snippets.join(" ")));

  assert.match(shopeeInsights.snippets.join(" "), /Delivery was fast/);
  assert(!/ofertas relampago|afiliados/i.test(shopeeInsights.snippets.join(" ")));

  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  clearApiModule();
}

async function testReviewEvidenceIsSentToModelAnalysis() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_TEXT_MODEL: process.env.OPENAI_TEXT_MODEL,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    IMAGE_ANALYSIS_BUDGET_MS: process.env.IMAGE_ANALYSIS_BUDGET_MS
  };
  const previousFetch = global.fetch;
  const requests = [];

  process.env.NODE_ENV = "test";
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.OPENAI_BASE_URL = "http://model.example/v1";
  process.env.OPENAI_TEXT_MODEL = "text-test";
  delete process.env.BRIGHTDATA_API_KEY;

  global.fetch = async (url, options = {}) => {
    assert.strictEqual(String(url), "http://model.example/v1/chat/completions");
    const body = JSON.parse(options.body || "{}");
    const userMessage = body.messages?.[1]?.content || "";
    requests.push(userMessage);

    if (String(userMessage).includes("只分析 review 信号")) {
      assert.match(userMessage, /overall_review_data/);
      assert.match(userMessage, /review_summary/);
      assert.match(userMessage, /customer_pain_points/);
      assert.match(userMessage, /优先分析差评/);
      assert.match(userMessage, /优质评价用于统计优质卖点/);
      assert.match(userMessage, /negative_snippets/);
      assert.match(userMessage, /positive_snippets/);
      assert.match(userMessage, /Great whitening strips/);
      assert.match(userMessage, /Packaging arrived damaged/);
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis_method: "gpt-5.5整体review分析",
              review_summary: "Customers like visible whitening and easy daily use, but packaging damage creates purchase anxiety.",
              sentiment_breakdown: {
                positive: ["visible whitening", "easy daily use"],
                negative: ["damaged packaging"],
                neutral: ["coffee stain use case"]
              },
              customer_pain_points: ["packaging damage", "sensitivity concern"],
              purchase_barriers: ["fear of damaged delivery", "uncertainty about results"],
              customer_language_examples: ["visible results after a few days", "worked well for coffee stains"],
              high_frequency_praise: ["visible whitening", "easy daily use"],
              high_frequency_complaints: ["damaged packaging"],
              local_language: ["uso diario", "resultado visivel"],
              usage_scenarios: ["before work"],
              competitor_weaknesses: ["packaging damage"],
              prompt_modifiers: {
                main_images: ["Show easy daily use without changing product appearance."],
                detail_pages: ["Address packaging and sensitivity concerns."],
                negative_constraints: ["Do not alter product appearance."]
              },
              evidence_summary: {
                source_count: 1,
                snippet_count: 2,
                negative_snippet_count: 1,
                positive_snippet_count: 1,
                rating_average: 4.5,
                review_count_total: 789
              },
              source_note: "gpt-5.5 analyzed full review evidence"
            })
          }
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            workflow_analysis: { optimization_logic: "ok" },
            review_insights: {},
            link_analysis: [],
            main_image_plan: {},
            detail_page_plan: {},
            keywords: { auto: [], manual: "", final: [] },
            image_prompts: Array.from({ length: 11 }, (_, index) => ({
              sequence: index + 1,
              type: `slot_${index + 1}`,
              label: `Slot ${index + 1}`,
              source_logic: "fallback",
              prompt: "Use uploaded product image as sole appearance reference."
            })),
            detail_page: {},
            compliance_notes: [],
            usage_note: "ok"
          })
        }
      }],
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    clearApiModule();
    const { runGenerateWorkflow } = require(path.join(root, "api/generate.js"));
    const result = await runGenerateWorkflow({
      payload: {
        product: {
          name: "Review Test Product",
          source_urls: []
        },
        link_scan_results: [{
          url: "https://www.amazon.com/example/dp/B000000001",
          market_hint: "us",
          ok: true,
          title: "Competitor Product",
          image_candidates: [],
          review_insights: {
            rating: 4.5,
            review_count: 789,
            snippets: [
              "Great whitening strips, easy daily use, visible results after a few days.",
              "Packaging arrived damaged but the product still worked well for coffee stains."
            ],
            positive_snippets: [
              "Great whitening strips, easy daily use, visible results after a few days."
            ],
            negative_snippets: [
              "Packaging arrived damaged but the product still worked well for coffee stains."
            ],
            positive_terms: [{ term: "easy", count: 1 }],
            negative_terms: [{ term: "packaging", count: 1 }],
            scene_terms: [{ term: "daily", count: 1 }]
          }
        }]
      },
      token: "",
      requestId: "review_test"
    });

    assert(
      requests.some((prompt) => String(prompt).includes("只分析 review 信号")),
      "review modifier prompt should be sent to the model when review evidence exists"
    );
    assert.strictEqual(result.result.review_modifier_analysis.source_note, "gpt-5.5 analyzed full review evidence");
    assert.match(result.result.review_modifier_analysis.review_summary, /visible whitening/);
    assert.deepStrictEqual(result.result.review_modifier_analysis.evidence_summary, {
      source_count: 1,
      snippet_count: 2,
      negative_snippet_count: 1,
      positive_snippet_count: 1,
      rating_average: 4.5,
      review_count_total: 789
    });
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModule();
  }
}

async function testRatingOnlyReviewEvidenceStillShowsConcreteStats() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_TEXT_MODEL: process.env.OPENAI_TEXT_MODEL,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY
  };
  const previousFetch = global.fetch;

  process.env.NODE_ENV = "test";
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.OPENAI_BASE_URL = "http://model.example/v1";
  process.env.OPENAI_TEXT_MODEL = "text-test";
  delete process.env.BRIGHTDATA_API_KEY;

  global.fetch = async () => {
    throw new Error("model unavailable");
  };

  try {
    clearApiModule();
    const { runGenerateWorkflow } = require(path.join(root, "api/generate.js"));
    const result = await runGenerateWorkflow({
      payload: {
        product: {
          name: "Rating Only Product",
          source_urls: []
        },
        link_scan_results: [{
          url: "https://www.amazon.com/example/dp/B000000002",
          market_hint: "us",
          ok: true,
          title: "Rating Only Competitor",
          image_candidates: [],
          review_insights: {
            rating: 4.7,
            review_count: 1234,
            snippets: [],
            positive_terms: [],
            negative_terms: [],
            scene_terms: []
          }
        }]
      },
      token: "",
      requestId: "review_rating_only_test"
    });

    const review = result.result.review_modifier_analysis;
    assert.match(review.review_summary, /4\.7/);
    assert.match(review.review_summary, /1234/);
    assert.deepStrictEqual(review.evidence_summary, {
      source_count: 1,
      snippet_count: 0,
      negative_snippet_count: 0,
      positive_snippet_count: 0,
      rating_average: 4.7,
      review_count_total: 1234
    });
    assert(
      review.prompt_modifiers.detail_pages.some((item) => /4\.7|1234/.test(item)),
      "rating-only review modifier should still provide concrete detail-page guidance"
    );
    assert(
      review.customer_pain_points.length >= 2,
      `rating-only review modifier should produce concrete model-style analysis, got ${JSON.stringify(review.customer_pain_points)}`
    );
    assert(
      review.purchase_barriers.length >= 2,
      `rating-only review modifier should produce concrete purchase barriers, got ${JSON.stringify(review.purchase_barriers)}`
    );
    assert(
      review.high_frequency_praise.length >= 1,
      `rating-only review modifier should infer useful praise signals from stats, got ${JSON.stringify(review.high_frequency_praise)}`
    );
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModule();
  }
}

async function testFallbackReviewModifierUsesRequiredFiveSections() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_TEXT_MODEL: process.env.OPENAI_TEXT_MODEL,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY
  };
  const previousFetch = global.fetch;

  process.env.NODE_ENV = "test";
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.OPENAI_BASE_URL = "http://model.example/v1";
  process.env.OPENAI_TEXT_MODEL = "text-test";
  delete process.env.BRIGHTDATA_API_KEY;

  global.fetch = async () => {
    throw new Error("model unavailable");
  };

  try {
    clearApiModule();
    const { runGenerateWorkflow } = require(path.join(root, "api/generate.js"));
    const result = await runGenerateWorkflow({
      payload: {
        product: { name: "Structured Review Product", source_urls: [] },
        link_scan_results: [{
          url: "https://www.amazon.com/example/dp/B000000003",
          market_hint: "us",
          ok: true,
          title: "Structured Competitor",
          image_candidates: [],
          review_insights: {
            rating: 4.3,
            review_count: 18569,
            snippets: [],
            negative_snippets: [
              "Battery failed after one week and customer support was slow.",
              "Package arrived damaged and setup was difficult."
            ],
            positive_snippets: [
              "Great quality and easy daily use.",
              "Excellent value and reliable results.",
              "I recommend it for family use."
            ],
            positive_terms: [{ term: "quality", count: 2 }],
            negative_terms: [{ term: "package", count: 1 }],
            scene_terms: [{ term: "daily", count: 1 }]
          }
        }]
      },
      token: "",
      requestId: "review_five_section_test"
    });

    const review = result.result.review_modifier_analysis;
    for (const field of [
      "collection_overview",
      "negative_review_analysis",
      "positive_selling_points",
      "product_improvement_suggestions",
      "listing_optimization_prompts"
    ]) {
      assert(Array.isArray(review[field]) && review[field].length, `${field} should be a visible required section.`);
    }
    assert.match(review.negative_review_analysis.join(" "), /Battery failed|Package arrived damaged/);
    assert.match(review.positive_selling_points.join(" "), /Great quality|Excellent value/);
    assert.match(review.listing_optimization_prompts.join(" "), /图片|listing|详情页/i);
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModule();
  }
}

async function testFrontendShowsEnoughReviewEvidence() {
  const fs = require("fs");
  const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

  assert(
    appSource.includes("reviews.snippets.length} 条可见 review 摘要"),
    "scan evidence should show how many review snippets were collected"
  );
  assert(
    appSource.includes("reviews.snippets.slice(0, 5)"),
    "scan evidence should preview more than two review snippets"
  );
  const requiredLabels = ["1. 整体采集信息", "2. 整体差评分析结果", "3. 好评后的卖点总结", "4. 产品打磨修改建议", "5. Listing/图片生成优化提示词"];
  for (const label of requiredLabels) {
    assert(appSource.includes(label), `review modifier panel should show required section: ${label}`);
  }
  const cardEntriesBody = appSource.match(/function reviewModifierCardEntries\(insights = \{\}\) \{[\s\S]*?\n\}/)?.[0] || "";
  for (const label of requiredLabels) {
    assert(cardEntriesBody.includes(label), `review modifier cards should include required section: ${label}`);
  }
  for (const removedLabel of ["Review 分析来源", "整体 Review 结论", "购买阻碍", "分析方式", "模型失败原因", "情绪拆分", "客户痛点"]) {
    assert(!cardEntriesBody.includes(removedLabel), `review modifier cards should not include removed section: ${removedLabel}`);
  }
  const standaloneReviewBody = appSource.match(/function renderStandaloneReviewPanel\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert(!standaloneReviewBody.includes("单独链接 Review 原始证据"), "standalone review panel should not render extra raw-evidence section.");
  const reviewPageBody = appSource.match(/function renderReviewAnalysisPage\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert(!reviewPageBody.includes("逐链接 Review 原始证据"), "review analysis page should not render extra raw-evidence section.");
  assert(!reviewPageBody.includes("review-summary-grid"), "review analysis page should not render extra status summary cards.");
  assert(
    appSource.includes("renderReviewModifierCards"),
    "review modifier cards should be rendered through a shared complete result helper."
  );
  assert(
    appSource.includes("typeof value === \"string\""),
    "review modifier panel must render string fields such as analysis_method, review_summary, and source_note instead of showing empty placeholders."
  );
  assert(
    appSource.includes("reviewUrlInput: document.querySelector(\"#reviewUrlInput\")"),
    "review page should expose a standalone review URL input."
  );
  assert(
    appSource.includes("analyzeReviewBtn: document.querySelector(\"#analyzeReviewBtn\")"),
    "review page should expose a standalone review analysis button."
  );
  assert(
    appSource.includes("apiRequest(\"/api/review-analysis\""),
    "frontend should call the standalone review analysis API."
  );
  assert(
    appSource.includes("state.standaloneReviewResult"),
    "standalone review analysis must keep results separate from the main generation workflow."
  );
}

async function run() {
  await testNestedAndSerializedReviewsAreExtracted();
  await testAmazonReviewBoilerplateIsFiltered();
  await testAmazonReviewPageIsFetchedWhenProductPageHasOnlyReviewCount();
  await testAmazonBrazilReviewUrlsUseRecentPaginatedReviewPath();
  await testAmazonAllReviewsEntryLinkIsFetchedBeforeReviewPagination();
  await testAmazonNegativeReviewPagesArePrioritized();
  await testAmazonPositiveReviewPagesFeedHighQualitySellingPoints();
  await testAmazonReviewPagesAreFetchedEvenWhenProductPageHasFewSnippets();
  await testAmazonCollectsNegativeBucketsAndFiftyPositiveSamples();
  await testAmazonCollectsExplicitOneTwoAndFiveStarPages();
  await testAmazonSupplementalReviewPagesFetchInParallelBatches();
  await testAmazonKeepsExpandedLowStarSamplesBeyondInitialPages();
  await testPlatformReviewSectionsArePreferredOverPageWideFallback();
  await testReviewEvidenceIsSentToModelAnalysis();
  await testRatingOnlyReviewEvidenceStillShowsConcreteStats();
  await testFallbackReviewModifierUsesRequiredFiveSections();
  await testFrontendShowsEnoughReviewEvidence();
}

run()
  .then(() => console.log("review analysis ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
