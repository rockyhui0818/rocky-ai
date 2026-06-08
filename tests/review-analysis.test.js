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
      assert.match(userMessage, /Great whitening strips/);
      assert.match(userMessage, /Packaging arrived damaged/);
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
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
              source_note: "model-reviewed snippets"
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
    assert.strictEqual(result.result.review_modifier_analysis.source_note, "model-reviewed snippets");
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
  assert(
    appSource.includes("Review 分析来源"),
    "review modifier panel should expose the model source note"
  );
}

async function run() {
  await testNestedAndSerializedReviewsAreExtracted();
  await testReviewEvidenceIsSentToModelAnalysis();
  await testFrontendShowsEnoughReviewEvidence();
}

run()
  .then(() => console.log("review analysis ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
