const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

function createMockRequest(body) {
  return {
    method: "POST",
    headers: {},
    [Symbol.asyncIterator]: async function* iterateBody() {
      yield Buffer.from(JSON.stringify(body));
    }
  };
}

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
    OPENAI_IMAGE_API_KEY: process.env.OPENAI_IMAGE_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_IMAGE_BASE_URL: process.env.OPENAI_IMAGE_BASE_URL,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL
  };
  const previousFetch = global.fetch;

  process.env.OPENAI_IMAGE_API_KEY = "sk-test";
  process.env.OPENAI_IMAGE_BASE_URL = "http://provider.example/v1";
  process.env.OPENAI_IMAGE_MODEL = "gpt-image-2-pro";
  global.fetch = async () => {
    throw new TypeError("fetch failed");
  };

  clearApiModule("api/image.js");
  const handler = require(path.join(root, "api/image.js"));
  const res = createMockResponse();
  await handler(createMockRequest({ prompt: "A red apple", max_images: 1 }), res);

  global.fetch = previousFetch;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.strictEqual(res.statusCode, 502);
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.error, "IMAGE_GENERATION_FAILED");
  assert.strictEqual(payload.details.failures[0].details.error, "IMAGE_PROVIDER_NETWORK_FAILED");
  assert.strictEqual(payload.details.failures[0].details.provider_host, "provider.example");
  assert.strictEqual(payload.details.failures[0].details.endpoint, "/images/generations");

  process.env.OPENAI_IMAGE_API_KEY = "sk-test";
  process.env.OPENAI_IMAGE_BASE_URL = "http://154.64.230.35:3000/v1";
  process.env.OPENAI_IMAGE_MODEL = "gpt-image-2-pro";
  const requested = [];
  global.fetch = async (url, options = {}) => {
    requested.push({
      url: String(url),
      body: JSON.parse(options.body || "{}")
    });
    return new Response(JSON.stringify({ data: [{ b64_json: "ok" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  clearApiModule("api/image.js");
  const normalizedHandler = require(path.join(root, "api/image.js"));
  const normalizedRes = createMockResponse();
  await normalizedHandler(createMockRequest({ prompt: "A red apple", max_images: 1 }), normalizedRes);

  global.fetch = previousFetch;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.strictEqual(normalizedRes.statusCode, 200);
  const normalizedPayload = JSON.parse(normalizedRes.body);
  assert.strictEqual(normalizedPayload.provider.host, "154.64.230.35:3000");
  assert.strictEqual(normalizedPayload.provider.model, "gpt-image-2-pro");
  assert.strictEqual(requested[0].url, "http://154.64.230.35:3000/v1/images/generations");
  assert.strictEqual(requested[0].body.model, "gpt-image-2-pro");

  process.env.OPENAI_IMAGE_API_KEY = "sk-test";
  process.env.OPENAI_IMAGE_BASE_URL = "http://154.64.230.35:3000/v1";
  process.env.OPENAI_IMAGE_MODEL = "gpt-image-2-pro";
  const sizedRequests = [];
  global.fetch = async (url, options = {}) => {
    sizedRequests.push({
      url: String(url),
      body: JSON.parse(options.body || "{}")
    });
    return new Response(JSON.stringify({ data: [{ b64_json: `ok-${sizedRequests.length}` }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  clearApiModule("api/image.js");
  const sizedHandler = require(path.join(root, "api/image.js"));
  const sizedRes = createMockResponse();
  await sizedHandler(createMockRequest({
    prompt: "Marketplace images",
    size: "1024x1024",
    max_images: 2,
    prompts: [
      { type: "white_main", label: "Main", prompt: "main prompt", size: "1024x1024" },
      { type: "detail_hero_banner", label: "Detail", prompt: "detail prompt", size: "1536x1024" }
    ]
  }), sizedRes);

  global.fetch = previousFetch;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.strictEqual(sizedRes.statusCode, 200);
  assert.deepStrictEqual(sizedRequests.map((request) => request.body.size), ["1024x1024", "1536x1024"]);
  const sizedPayload = JSON.parse(sizedRes.body);
  assert.deepStrictEqual(sizedPayload.images.map((image) => image.size), ["1024x1024", "1536x1024"]);

  process.env.OPENAI_IMAGE_API_KEY = "sk-test";
  process.env.OPENAI_IMAGE_BASE_URL = "http://154.64.230.35:3000/v1";
  process.env.OPENAI_IMAGE_MODEL = "gpt-image-2-pro";
  const fallbackRequests = [];
  global.fetch = async (url, options = {}) => {
    fallbackRequests.push(String(url));
    if (String(url).endsWith("/images/edits")) {
      return new Response(JSON.stringify({ error: { message: "Invalid token (request id: test)" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ data: [{ b64_json: "fallback-ok" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  clearApiModule("api/image.js");
  const fallbackHandler = require(path.join(root, "api/image.js"));
  const fallbackRes = createMockResponse();
  await fallbackHandler(createMockRequest({
    prompt: "Reference image fallback",
    reference_image: "data:image/png;base64,iVBORw0KGgo=",
    max_images: 1
  }), fallbackRes);

  global.fetch = previousFetch;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.strictEqual(fallbackRes.statusCode, 200);
  assert.deepStrictEqual(fallbackRequests, [
    "http://154.64.230.35:3000/v1/images/edits",
    "http://154.64.230.35:3000/v1/images/generations"
  ]);
  const fallbackPayload = JSON.parse(fallbackRes.body);
  assert.strictEqual(fallbackPayload.images[0].b64_json, "fallback-ok");
  assert.strictEqual(fallbackPayload.mode, "text-generation");

  process.env.OPENAI_IMAGE_API_KEY = "sk-test";
  process.env.OPENAI_IMAGE_BASE_URL = "http://154.64.230.35:3000/v1";
  process.env.OPENAI_IMAGE_MODEL = "gpt-image-2-pro";
  const timeoutFallbackRequests = [];
  global.fetch = async (url, options = {}) => {
    timeoutFallbackRequests.push(String(url));
    if (String(url).endsWith("/images/edits")) {
      const abortError = new Error("The operation was aborted.");
      abortError.name = "AbortError";
      throw abortError;
    }
    return new Response(JSON.stringify({ data: [{ b64_json: "timeout-fallback-ok" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  clearApiModule("api/image.js");
  const timeoutFallbackHandler = require(path.join(root, "api/image.js"));
  const timeoutFallbackRes = createMockResponse();
  await timeoutFallbackHandler(createMockRequest({
    prompt: "Reference image timeout fallback",
    reference_image: "data:image/png;base64,iVBORw0KGgo=",
    max_images: 1
  }), timeoutFallbackRes);

  global.fetch = previousFetch;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.strictEqual(timeoutFallbackRes.statusCode, 200);
  assert.deepStrictEqual(timeoutFallbackRequests, [
    "http://154.64.230.35:3000/v1/images/edits",
    "http://154.64.230.35:3000/v1/images/generations"
  ]);
  const timeoutFallbackPayload = JSON.parse(timeoutFallbackRes.body);
  assert.strictEqual(timeoutFallbackPayload.images[0].b64_json, "timeout-fallback-ok");
  assert.strictEqual(timeoutFallbackPayload.mode, "text-generation");
}

run()
  .then(() => console.log("image api diagnostics ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
