const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModules() {
  for (const file of ["api/review-analysis.js", "api/generate.js"]) {
    try {
      delete require.cache[require.resolve(path.join(root, file))];
    } catch {}
  }
}

function createJsonResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return this.headers[String(name).toLowerCase()];
    },
    end(value = "") {
      this.body += value;
    }
  };
}

function createJsonRequest(body, headers = {}) {
  return {
    method: "POST",
    headers,
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(body));
    }
  };
}

function restoreEnv(previousEnv) {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function testReviewAnalysisRouteAnalyzesStandaloneLinks() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_TEXT_MODEL: process.env.OPENAI_TEXT_MODEL,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY
  };
  const previousFetch = global.fetch;
  const fetchCalls = [];

  process.env.NODE_ENV = "test";
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.OPENAI_BASE_URL = "http://model.example/v1";
  process.env.OPENAI_TEXT_MODEL = "text-test";
  delete process.env.BRIGHTDATA_API_KEY;

  global.fetch = async (url, options = {}) => {
    fetchCalls.push(String(url));
    if (String(url) === "https://reviews.example/product") {
      return new Response(`
        <html>
          <head><title>Standalone Review Product</title></head>
          <body>
            <span itemprop="ratingValue" content="4.6"></span>
            <span itemprop="reviewCount" content="456"></span>
            <section class="product-reviews">
              <p class="review-body">Great quality for daily use, package arrived safely, and I recommend it.</p>
              <p class="review-body">Delivery was slow, but the product worked well at home.</p>
            </section>
          </body>
        </html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }
    if (String(url) === "http://model.example/v1/chat/completions") {
      const body = JSON.parse(options.body || "{}");
      assert.match(body.messages?.[1]?.content || "", /只分析 review 信号/);
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              analysis_method: "gpt-5.5整体review分析",
              review_summary: "Customers like daily quality and safe packaging, but delivery speed needs expectation management.",
              sentiment_breakdown: {
                positive: ["daily quality", "safe packaging"],
                negative: ["slow delivery"],
                neutral: ["home use"]
              },
              customer_pain_points: ["slow delivery"],
              purchase_barriers: ["delivery speed concern"],
              customer_language_examples: ["Great quality for daily use"],
              high_frequency_praise: ["quality", "package"],
              high_frequency_complaints: ["delivery"],
              local_language: ["uso diario"],
              usage_scenarios: ["home"],
              competitor_weaknesses: ["delivery"],
              prompt_modifiers: {
                main_images: ["Emphasize daily use quality."],
                detail_pages: ["Explain delivery and packaging expectations."],
                negative_constraints: ["Do not change product appearance."]
              },
              evidence_summary: {
                source_count: 1,
                snippet_count: 2,
                rating_average: 4.6,
                review_count_total: 456
              },
              source_note: "standalone review analysis"
            })
          }
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    clearApiModules();
    const handler = require(path.join(root, "api/review-analysis.js"));
    const req = createJsonRequest({
      review_urls: ["https://reviews.example/product"],
      product: { name: "Standalone Review Product" }
    });
    const res = createJsonResponse();

    await handler(req, res);
    const data = JSON.parse(res.body);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(data.ok, true);
    assert.strictEqual(data.link_scan_results.length, 1);
    assert.strictEqual(data.review_modifier_analysis.source_note, "standalone review analysis");
    assert.deepStrictEqual(data.review_modifier_analysis.evidence_summary, {
      source_count: 1,
      snippet_count: 2,
      rating_average: 4.6,
      review_count_total: 456
    });
    assert(fetchCalls.includes("https://reviews.example/product"));
    assert(fetchCalls.includes("http://model.example/v1/chat/completions"));
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModules();
  }
}

async function run() {
  await testReviewAnalysisRouteAnalyzesStandaloneLinks();
}

run()
  .then(() => console.log("review analysis api ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
