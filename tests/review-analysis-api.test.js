const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModules() {
  for (const file of ["api/review-analysis.js", "api/generate.js", "api/_lib/jobs.js", "api/_lib/supabase.js"]) {
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

async function testReviewAnalysisRouteCanStartBackgroundJob() {
  const previousEnv = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
  const previousFetch = global.fetch;
  const rows = [];

  process.env.NODE_ENV = "test";
  delete process.env.VERCEL;
  process.env.SUPABASE_URL = "https://supabase.example";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";

  global.fetch = async (url, options = {}) => {
    if (String(url).includes("/rest/v1/generate_jobs")) {
      const body = JSON.parse(options.body || "{}");
      rows.push(body);
      return new Response(JSON.stringify([body]), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    clearApiModules();
    const handler = require(path.join(root, "api/review-analysis.js"));
    const req = createJsonRequest({
      mode: "job",
      async: true,
      review_urls: ["https://reviews.example/product"],
      product: { name: "Async Review Product" }
    });
    const res = createJsonResponse();

    await handler(req, res);
    const data = JSON.parse(res.body);

    assert.strictEqual(res.statusCode, 202);
    assert.strictEqual(data.ok, true);
    assert.match(data.job.id, /^job_/);
    assert.strictEqual(data.job.stage, "review_queued");
    assert.strictEqual(rows[0].stage, "review_queued");
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModules();
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
              collection_overview: ["1 link, 456 reviews, 2 snippets collected."],
              negative_review_analysis: ["slow delivery creates expectation risk"],
              positive_selling_points: ["daily quality", "safe packaging"],
              product_improvement_suggestions: ["clarify shipping expectations"],
              listing_optimization_prompts: ["Use review insights to optimize listing images and detail-page prompts."],
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
                negative_snippet_count: 1,
                positive_snippet_count: 2,
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
    assert.deepStrictEqual(data.review_modifier_analysis.collection_overview, [
      "实际采集 Review：总计 3 条；差评 1 条；好评 2 条；混合/未分桶 0 条。",
      "1 link, 456 reviews, 2 snippets collected."
    ]);
    assert.deepStrictEqual(data.review_modifier_analysis.negative_review_analysis, ["slow delivery creates expectation risk"]);
    assert.deepStrictEqual(data.review_modifier_analysis.positive_selling_points, ["daily quality", "safe packaging"]);
    assert.deepStrictEqual(data.review_modifier_analysis.product_improvement_suggestions, ["clarify shipping expectations"]);
    assert.deepStrictEqual(data.review_modifier_analysis.listing_optimization_prompts, ["Use review insights to optimize listing images and detail-page prompts."]);
    assert.deepStrictEqual(data.review_modifier_analysis.evidence_summary, {
      source_count: 1,
      snippet_count: 2,
      collected_review_count: 3,
      mixed_snippet_count: 0,
      negative_snippet_count: 1,
      positive_snippet_count: 2,
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

async function testReviewAnalysisCoercesModelTextIntoVisibleInsights() {
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

  global.fetch = async (url) => {
    if (String(url) === "https://reviews.example/rich-text") {
      return new Response(`
        <html>
          <head><title>Rich Text Review Product</title></head>
          <body>
            <span itemprop="ratingValue" content="4.3"></span>
            <span itemprop="reviewCount" content="888"></span>
            <section class="product-reviews">
              <p class="review-body">Great quality for daily use, easy to carry, and I recommend it.</p>
              <p class="review-body">Package arrived broken and delivery was slow, but support replaced it.</p>
            </section>
          </body>
        </html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }
    if (String(url) === "http://model.example/v1/chat/completions") {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: [
              "整体 Review 结论：用户喜欢日常使用质量和便携性，但包装破损、物流慢会影响下单信心。",
              "客户痛点：包装破损；配送慢；售后替换需要提前说明。",
              "购买阻碍：担心到货损坏；担心等待时间。",
              "主图修饰：强调 easy daily use 和 recommend。",
              "详情页修饰：解释包装保护、售后替换、配送预期。"
            ].join("\n")
          }
        }],
        usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 }
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    clearApiModules();
    const handler = require(path.join(root, "api/review-analysis.js"));
    const req = createJsonRequest({
      review_urls: ["https://reviews.example/rich-text"],
      product: { name: "Rich Text Review Product" }
    });
    const res = createJsonResponse();

    await handler(req, res);
    const data = JSON.parse(res.body);
    const analysis = data.review_modifier_analysis;

    assert.strictEqual(res.statusCode, 200);
    assert.match(analysis.review_summary, /包装破损|物流慢|便携/);
    assert(
      analysis.customer_pain_points.some((item) => /包装|配送|物流|售后/.test(item)),
      `expected concrete pain points from model text, got ${JSON.stringify(analysis.customer_pain_points)}`
    );
    assert(
      analysis.prompt_modifiers.detail_pages.some((item) => /包装|售后|配送/.test(item)),
      `expected detail-page modifiers from model text, got ${JSON.stringify(analysis.prompt_modifiers)}`
    );
    assert.strictEqual(analysis.evidence_summary.review_count_total, 888);
    assert.strictEqual(analysis.source_note, "模型返回非 JSON 文本，已保留文本分析并补齐结构化字段。");
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModules();
  }
}

async function testReviewAnalysisShowsModelFailureReasonWhenFallbackIsUsed() {
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

  global.fetch = async (url) => {
    if (String(url) === "https://reviews.example/model-fails") {
      return new Response(`
        <html>
          <head><title>Fallback Review Product</title></head>
          <body>
            <span itemprop="ratingValue" content="3.8"></span>
            <span itemprop="reviewCount" content="2470"></span>
            <section class="product-reviews">
              <p class="review-body">Not permanent results but great for an event or occasional whitening routine.</p>
            </section>
          </body>
        </html>
      `, { status: 200, headers: { "Content-Type": "text/html" } });
    }
    if (String(url) === "http://model.example/v1/chat/completions") {
      return new Response(JSON.stringify({ error: { message: "Invalid model token" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    clearApiModules();
    const handler = require(path.join(root, "api/review-analysis.js"));
    const req = createJsonRequest({
      review_urls: ["https://reviews.example/model-fails"],
      product: { name: "Fallback Review Product" }
    });
    const res = createJsonResponse();

    await handler(req, res);
    const data = JSON.parse(res.body);
    const analysis = data.review_modifier_analysis;

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(data.review_modifier_meta.reasoning_effort, "fallback");
    assert.match(analysis.review_summary, /review|Review|摘要|评分|评价/);
    assert.match(analysis.model_error, /Invalid model token/);
    assert.match(analysis.source_note, /模型分析失败/);
  } finally {
    global.fetch = previousFetch;
    restoreEnv(previousEnv);
    clearApiModules();
  }
}

async function run() {
  await testReviewAnalysisRouteCanStartBackgroundJob();
  await testReviewAnalysisRouteAnalyzesStandaloneLinks();
  await testReviewAnalysisCoercesModelTextIntoVisibleInsights();
  await testReviewAnalysisShowsModelFailureReasonWhenFallbackIsUsed();
}

run()
  .then(() => console.log("review analysis api ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
