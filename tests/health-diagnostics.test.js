const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return this.headers[name.toLowerCase()];
    },
    end(payload = "") {
      this.body = payload;
    }
  };
}

async function run() {
  const previousEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_TEXT_MODEL: process.env.OPENAI_TEXT_MODEL,
    OPENAI_IMAGE_API_KEY: process.env.OPENAI_IMAGE_API_KEY,
    OPENAI_IMAGE_BASE_URL: process.env.OPENAI_IMAGE_BASE_URL,
    OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL,
    OPENAI_IMAGE_CONCURRENCY: process.env.OPENAI_IMAGE_CONCURRENCY,
    BRIGHTDATA_API_KEY: process.env.BRIGHTDATA_API_KEY,
    BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE,
    BRIGHTDATA_LINK_SCAN_TIMEOUT_MS: process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS
  };

  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  process.env.OPENAI_API_KEY = "sk-text";
  process.env.OPENAI_BASE_URL = "http://154.64.230.35:3000/v1";
  process.env.OPENAI_TEXT_MODEL = "gpt-5.5";
  process.env.OPENAI_IMAGE_API_KEY = "sk-image";
  process.env.OPENAI_IMAGE_BASE_URL = "http://154.64.230.35:3000/v1";
  process.env.OPENAI_IMAGE_MODEL = "gpt-image-2-pro";
  process.env.OPENAI_IMAGE_CONCURRENCY = "1";
  process.env.BRIGHTDATA_API_KEY = "brd-test";
  process.env.BRIGHTDATA_ZONE = "web_unlocker1";
  process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = "20000";

  delete require.cache[require.resolve(path.join(root, "api/health.js"))];
  const handler = require(path.join(root, "api/health.js"));
  const res = createMockResponse();
  await handler({ method: "GET", headers: {} }, res);

  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.strictEqual(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.diagnostics.supabase.configured, true);
  assert.strictEqual(payload.diagnostics.text_model.model, "gpt-5.5");
  assert.strictEqual(payload.diagnostics.image_model.model, "gpt-image-2-pro");
  assert.strictEqual(payload.diagnostics.image_model.concurrency, 1);
  assert.strictEqual(payload.diagnostics.link_scanner.mode, "brightdata-required");
  assert.strictEqual(payload.diagnostics.link_scanner.brightdata_timeout_ms, 20000);
  assert(!JSON.stringify(payload).includes("sk-image"), "health diagnostics must not leak API keys.");
}

run()
  .then(() => console.log("health diagnostics ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
