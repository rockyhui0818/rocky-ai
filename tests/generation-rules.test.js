const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const generateSource = fs.readFileSync(path.join(root, "api/generate.js"), "utf8");
const imageSource = fs.readFileSync(path.join(root, "api/image.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

function countImageQueueEntries(source) {
  const queueStart = source.indexOf("function buildImagePromptQueue(pack)");
  assert(queueStart >= 0, "buildImagePromptQueue should exist");
  const queueEnd = source.indexOf("function normalizePromptType", queueStart);
  assert(queueEnd > queueStart, "normalizePromptType should follow buildImagePromptQueue");
  return (source.slice(queueStart, queueEnd).match(/withTargetSpec\(/g) || []).length;
}

assert(
  generateSource.includes("美国链接权重：决定设计结构、图片架构、风格、色彩、构图"),
  "Synthesis prompt must state that US links drive design structure."
);

assert(
  generateSource.includes("巴西链接权重：只决定葡语表达、本土使用场景、信任点"),
  "Synthesis prompt must limit Brazil links to localization."
);

assert(
  generateSource.includes("如果没有上传或没有采集到 brazil_source，必须明确写：巴西对应图片未采集到"),
  "Synthesis prompt must explicitly handle missing Brazil image evidence."
);

assert(
  generateSource.includes("本图直接按美国链接图片结构、版式和风格生成"),
  "Missing Brazil links must fall back directly to US link structure, layout, and style."
);

assert(
  !generateSource.includes("再用巴西链接文本、Review、葡语和市场场景进行本土化"),
  "Missing Brazil links must not claim Brazil-link localization evidence."
);

assert(
  generateSource.includes("上传产品图权重最高"),
  "Synthesis prompt must make uploaded images the top priority."
);

assert(
  !imageSource.includes("you may adapt the final product styling, package form, color palette"),
  "Image endpoint must not allow changing product styling, package form, or color palette."
);

assert(
  imageSource.includes("The uploaded product reference is the only source of truth for product appearance"),
  "Image endpoint must enforce uploaded references as the only product appearance truth."
);

assert(
  imageSource.includes("Competitor/reference links may influence only layout, composition, scene, background, lighting style, information hierarchy, text treatment, and overall creative direction."),
  "Image endpoint must limit reference links to layout/style/text direction only."
);

assert(
  !appSource.includes("允许参考/复刻美国竞品的外观方向、包装形态、颜色、材质表达"),
  "Frontend queue consistency rules must not allow changing product packaging, colors, or material expression."
);

assert(
  !appSource.includes("允许参考/复刻美国竞品链接的外观、包装、颜色、材质表达"),
  "Frontend fallback queue must not allow changing product appearance, packaging, color, or material expression."
);

assert(
  !appSource.includes("可根据竞品参考优化/改造外观、包装、颜色"),
  "Base prompt must not allow optimizing or changing product appearance, packaging, or color."
);

assert(
  !generateSource.includes("允许参考/复刻竞品外观包装和颜色"),
  "Backend base prompt must not allow copying competitor product appearance, packaging, or color."
);

assert(
  appSource.includes("prompts.slice(0, 11)"),
  "Frontend remote prompt queue must cap model prompts at exactly 11 image jobs."
);

assert(
  generateSource.includes("region-first collect, dedupe variants, then select model evidence"),
  "Backend scan scope must describe 8 main / 7 detail images as post-collection selected evidence."
);

assert(
  appSource.includes("按页面区域采集标题、描述、主图库候选、A+/详情页候选"),
  "Frontend scan evidence must explain that image candidates are collected by page region before selection."
);

assert.strictEqual(
  countImageQueueEntries(appSource),
  11,
  "Frontend fallback image queue must generate exactly 11 single-image jobs."
);

console.log("generation rules ok");
