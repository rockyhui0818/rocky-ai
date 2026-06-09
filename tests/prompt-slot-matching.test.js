const assert = require("assert");
const path = require("path");

const root = path.resolve(__dirname, "..");

function clearApiModule() {
  delete require.cache[require.resolve(path.join(root, "api/generate.js"))];
}

async function run() {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";
  clearApiModule();
  const { __test } = require(path.join(root, "api/generate.js"));

  const imageUnits = [
    {
      id: "img_main_1",
      market: "us",
      section: "main",
      image_url: "https://example.com/main-1.jpg",
      source_url: "https://example.com/product",
      page_title: "US product",
      inferred_type: "white_main",
      source_position: "主图图库第 1 张 · white_main",
      source_area: "main",
      position_confidence: "high",
      score: 14
    },
    {
      id: "img_main_2",
      market: "us",
      section: "main",
      image_url: "https://example.com/main-2.jpg",
      source_url: "https://example.com/product",
      page_title: "US product",
      inferred_type: "infographic",
      source_position: "主图图库第 2 张 · infographic",
      source_area: "main",
      position_confidence: "high",
      score: 13
    },
    {
      id: "img_detail_1",
      market: "us",
      section: "detail",
      image_url: "https://example.com/detail-1.jpg",
      source_url: "https://example.com/product",
      page_title: "US product",
      inferred_type: "hero_banner",
      source_position: "详情页/A+模块第 1 张 · hero_banner",
      source_area: "detail",
      position_confidence: "high",
      score: 10
    },
    {
      id: "img_detail_2",
      market: "us",
      section: "detail",
      image_url: "https://example.com/detail-2.jpg",
      source_url: "https://example.com/product",
      page_title: "US product",
      inferred_type: "details_specs",
      source_position: "详情页/A+模块第 2 张 · details_specs",
      source_area: "detail",
      position_confidence: "high",
      score: 9
    }
  ];

  const analyses = Object.fromEntries(imageUnits.map((unit) => [unit.id, {
    unit_id: unit.id,
    market: unit.market,
    section: unit.section,
    image_role: unit.inferred_type,
    takeaways: [`Use ${unit.source_position}`]
  }]));

  const slots = __test.buildPromptSlotEvidence(imageUnits, analyses, {
    prompt_modifiers: {
      main_images: ["main modifier"],
      detail_pages: ["detail modifier"]
    }
  });

  const mainSlots = slots.slice(0, 5);
  const detailSlots = slots.slice(5);

  assert(mainSlots.every((slot) => !slot.us_source || slot.us_source.source_area === "main"), JSON.stringify(mainSlots, null, 2));
  assert(detailSlots.every((slot) => !slot.us_source || slot.us_source.source_area === "detail"), JSON.stringify(detailSlots, null, 2));
  assert(detailSlots.some((slot) => slot.us_source?.source_position.includes("详情页/A+模块")), "detail slots should use collected detail/A+ images when available.");
  assert(slots.every((slot) => slot.strict_section_match === true), "every prompt slot must record strict section matching.");

  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  clearApiModule();
}

run()
  .then(() => console.log("prompt slot matching ok"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
