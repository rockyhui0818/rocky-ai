const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule(relativePath) {
  delete require.cache[require.resolve(path.join(root, relativePath))];
}

async function run() {
  const previousEnv = {
    OPENAI_IMAGE_API_KEY: process.env.OPENAI_IMAGE_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_IMAGE_BASE_URL: process.env.OPENAI_IMAGE_BASE_URL,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL,
    OPENAI_IMAGE_CONCURRENCY: process.env.OPENAI_IMAGE_CONCURRENCY
  };
  const previousFetch = global.fetch;

  process.env.OPENAI_IMAGE_API_KEY = "sk-test";
  process.env.OPENAI_IMAGE_BASE_URL = "http://provider.example/v1";
  process.env.OPENAI_IMAGE_MODEL = "gpt-image-2-pro";
  process.env.OPENAI_IMAGE_CONCURRENCY = "4";

  let inFlight = 0;
  let maxInFlight = 0;
  const requestedPrompts = [];
  const delays = [40, 10, 30, 20];

  global.fetch = async (url, options = {}) => {
    assert.strictEqual(String(url), "http://provider.example/v1/images/generations");
    const body = JSON.parse(options.body || "{}");
    const match = String(body.prompt || "").match(/Prompt (\d+)/);
    const index = Number(match?.[1] || 0);
    requestedPrompts.push(index);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((resolve) => setTimeout(resolve, delays[index]));
    inFlight -= 1;
    return new Response(JSON.stringify({ data: [{ b64_json: `image-${index}` }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  clearApiModule("api/image.js");
  const { runImageWorkflow } = require(path.join(root, "api/image.js"));
  const result = await runImageWorkflow({
    token: "",
    payload: {
      prompt: "base prompt",
      max_images: 4,
      prompts: [0, 1, 2, 3].map((index) => ({
        type: `image-${index}`,
        label: `Image ${index}`,
        prompt: `Prompt ${index}`
      }))
    }
  });

  global.fetch = previousFetch;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  assert.strictEqual(maxInFlight, 4, "image workflow should run a batch of four requests concurrently");
  assert.deepStrictEqual(requestedPrompts.sort((a, b) => a - b), [0, 1, 2, 3]);
  assert.deepStrictEqual(
    result.images.map((image) => image.b64_json),
    ["image-0", "image-1", "image-2", "image-3"],
    "image results must keep the original prompt order even when provider responses finish out of order"
  );
}

run()
  .then(() => console.log("image batch concurrency ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
