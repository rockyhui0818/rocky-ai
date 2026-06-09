const { getAccountByToken, publicAccount } = require("./_lib/auth");
const { getBearerToken, handleOptions, readJson, sendJson } = require("./_lib/http");
const { filter, supabaseRequest } = require("./_lib/supabase");

const MODEL_TIMEOUT_MS = 240000;
const DIRECT_LINK_SCAN_TIMEOUT_MS = 6000;
const BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = 120000;
const MAX_SCAN_LINKS = 6;
const MAX_IMAGE_CANDIDATES = 15;
const MAX_MAIN_IMAGE_CANDIDATES = 8;
const MAX_DETAIL_IMAGE_CANDIDATES = 7;
const MAX_HEADINGS = 10;
const MAX_REVIEW_SNIPPETS = 30;
const PAGE_TEXT_SAMPLE_LENGTH = 4000;
const DEFAULT_MAX_COMPLETION_TOKENS = 900;
const DEFAULT_SYNTHESIS_MAX_TOKENS = 4200;
const STEP_IMAGE_LIMIT = 1;
const MAX_IMAGE_ANALYSIS_UNITS = 44;
const IMAGE_ANALYSIS_CONCURRENCY = 4;
const IMAGE_ANALYSIS_BUDGET_MS = 220000;
const REVIEW_ANALYSIS_BUDGET_TOKENS = 900;
const BRIGHTDATA_API_URL = "https://api.brightdata.com/request";
const USEFUL_IMAGE_TYPES = new Set(["main-image", "detail-page-image"]);
const MIN_PRODUCTION_BRIGHTDATA_TIMEOUT_MS = 120000;
const MAX_RAW_MAIN_IMAGE_CANDIDATES = 80;
const MAX_RAW_DETAIL_IMAGE_CANDIDATES = 120;
const LISTING_IMAGE_TYPES = [
  "white_main",
  "lifestyle",
  "infographic",
  "details_specs",
  "comparison"
];
const DETAIL_MODULE_TYPES = [
  "hero_banner",
  "core_features",
  "lifestyle_usage",
  "details_specs",
  "faq",
  "comparison_chart"
];
const PLATFORM_SCAN_CONFIGS = [
  {
    key: "amazon",
    name: "Amazon",
    host_patterns: [/amazon\./i],
    html_patterns: [/data-a-dynamic-image/i, /colorImages\s*:\s*\{\s*initial\s*:/i],
    main_markers: ["landingImage", "imageBlock", "altImages", "imageBlock_feature_div"],
    detail_markers: ["aplus", "a-plus", "dpx-aplus", "productDescription", "product-description", "detail-bullets", "feature-bullets"],
    detail_required: /aplus|a-plus|productdescription|product-description|from the manufacturer|product details/i,
    detail_exclude: /sp_detail|sponsored|recommend|also-bought|similarities|desktop-dp-sims|purchase-sims/i
  },
  {
    key: "mercado_livre",
    name: "Mercado Livre",
    host_patterns: [/mercadolivre\.com/i, /mercadolibre\./i],
    html_patterns: [/ui-pdp-gallery/i, /ui-pdp-description/i],
    main_markers: ["ui-pdp-gallery", "ui-pdp-image", "ui-pdp-photos"],
    detail_markers: ["ui-pdp-description", "ui-pdp-specs", "ui-pdp-features"],
    detail_required: /ui-pdp-description|ui-pdp-specs|ui-pdp-features/i,
    detail_exclude: /recommend|recomend|sponsored|publicidad|advertising|also-bought/i
  },
  {
    key: "shopee",
    name: "Shopee",
    host_patterns: [/shopee\./i],
    html_patterns: [/product-briefing/i, /product-detail/i],
    main_markers: ["product-briefing", "product-image", "product-variation"],
    detail_markers: ["product-detail", "product-description", "shop-product-detail"],
    detail_required: /product-detail|product-description|shop-product-detail/i,
    detail_exclude: /recommend|recommendation|similar|sponsored|ads|also-like/i
  },
  {
    key: "shopify",
    name: "Shopify / independent store",
    host_patterns: [/\/products\//i],
    html_patterns: [/cdn\.shopify\.com/i, /product__media-gallery/i, /product-media-gallery/i],
    main_markers: ["product__media-gallery", "product-media-gallery", "product-gallery", "product__media", "product-single__media"],
    detail_markers: ["product-description", "product__description", "rte", "product-tabs", "product-details"],
    detail_required: /product-description|product__description|product-tabs|product-details|rte/i,
    detail_exclude: /related-products|recommend|upsell|cross-sell|recently-viewed|sponsored/i
  },
  {
    key: "generic",
    name: "Generic ecommerce",
    host_patterns: [],
    html_patterns: [],
    main_markers: ["product-gallery", "product-images", "gallery", "media-gallery", "carousel"],
    detail_markers: ["product-description", "description", "product-detail", "details", "features"],
    detail_required: /product-description|product-detail|description|details|features/i,
    detail_exclude: /related|recommend|upsell|cross-sell|sponsored|ads|footer|nav/i
  }
];
const IMAGE_PROMPT_SLOTS = [
  {
    sequence: 1,
    type: "white_main",
    label: "1. 白底主图",
    section: "main",
    role: "white_main",
    us_focus: "美国链接白底主图/图库首图：产品摆放、包装外观、光影、白底比例、主视觉质感。",
    br_focus: "巴西链接主图：当地平台主图干净度、裁切比例、消费者信任表达。",
    objective: "只展示产品本体，清晰、无文字、无水印、无 logo，适合平台首图。"
  },
  {
    sequence: 2,
    type: "brazil_scene",
    label: "2. 巴西场景图",
    section: "main",
    role: "lifestyle",
    us_focus: "美国链接场景图：使用姿态、空间构图、人物/道具关系、情绪氛围。",
    br_focus: "巴西链接场景图：巴西家庭、办公室、出行、户外或日常语境。",
    objective: "把美国场景设计方向本地化到巴西真实生活环境，突出真实使用。"
  },
  {
    sequence: 3,
    type: "portuguese_infographic",
    label: "3. 葡语卖点信息图",
    section: "main",
    role: "infographic",
    us_focus: "美国链接卖点图：信息层级、图标/箭头、卖点数量、排版节奏。",
    br_focus: "巴西链接卖点图：自然葡语短句、本土痛点、信任词和移动端可读性。",
    objective: "用葡语短句表达 3-5 个最强卖点，读图即懂。"
  },
  {
    sequence: 4,
    type: "dimension_detail",
    label: "4. 尺寸细节图",
    section: "main",
    role: "details_specs",
    us_focus: "美国链接细节/尺寸图：材质、接口、容量、规格、包装内容的展示方式。",
    br_focus: "巴西链接细节图：当地消费者关心的尺寸、适配、配件、使用难度。",
    objective: "展示真实尺寸、材质、接口、容量、规格或包装内容，不虚构参数。"
  },
  {
    sequence: 5,
    type: "advantage_comparison",
    label: "5. 优势对比图",
    section: "main",
    role: "comparison",
    us_focus: "美国链接对比图：普通方案 vs 本产品的版式、对比维度和视觉强调。",
    br_focus: "巴西链接对比图：当地未满足需求、价格敏感点、质量/配送/使用疑虑。",
    objective: "与普通方案对比优势，不攻击竞品，不出现竞品品牌。"
  },
  {
    sequence: 6,
    type: "detail_hero_banner",
    label: "6. 详情页顶部视觉海报",
    section: "detail",
    role: "hero_banner",
    us_focus: "美国详情页 Hero：首屏视觉冲击、品牌调性、口号位置、全宽构图。",
    br_focus: "巴西详情页 Hero：葡语口号、本土审美、信任和使用场景。",
    objective: "详情页第一屏定调，产品和核心 slogan 建立信任。"
  },
  {
    sequence: 7,
    type: "detail_core_features",
    label: "7. 详情页核心卖点",
    section: "detail",
    role: "core_features",
    us_focus: "美国详情页核心卖点模块：3-4 个功能拆解、网格/侧文版式、视觉层级。",
    br_focus: "巴西详情页卖点模块：葡语表达、痛点词、信任点、本土购买理由。",
    objective: "拆解 3-4 个核心卖点，解决痛点，文字只做辅助。"
  },
  {
    sequence: 8,
    type: "detail_lifestyle",
    label: "8. 详情页生活方式",
    section: "detail",
    role: "lifestyle_usage",
    us_focus: "美国详情页生活方式模块：人物/场景、情绪、审美调性、使用前后关系。",
    br_focus: "巴西详情页生活方式模块：家庭、办公室、出行、户外等本土使用语境。",
    objective: "建立情感共鸣和代入感，证明产品符合巴西目标客群审美。"
  },
  {
    sequence: 9,
    type: "detail_technical_specs",
    label: "9. 详情页细节技术说明",
    section: "detail",
    role: "details_specs",
    us_focus: "美国详情页技术说明：微距、结构、规格表、使用方法和注意事项。",
    br_focus: "巴西详情页技术说明：降低误解/退货的尺寸、材质、适配和使用说明。",
    objective: "用细节图和清晰规格管理预期，降低退货率。"
  },
  {
    sequence: 10,
    type: "detail_faq",
    label: "10. 详情页 FAQ",
    section: "detail",
    role: "faq",
    us_focus: "美国详情页 FAQ/答疑：常见购买障碍、适用人群、使用步骤。",
    br_focus: "巴西 review 和详情页疑问：尺寸、质量、包装、物流、使用难度。",
    objective: "主动回答最后购买障碍，缩短决策时间。"
  },
  {
    sequence: 11,
    type: "detail_product_line_comparison",
    label: "11. 详情页产品线对比",
    section: "detail",
    role: "comparison_chart",
    us_focus: "美国详情页产品线对比：表格结构、产品差异、交叉销售逻辑。",
    br_focus: "巴西详情页对比：当地消费者选择标准、性价比、规格/用途区分。",
    objective: "用同品牌产品线或普通方案对比，帮助用户选择并促进交叉销售。"
  }
];

function extractText(data) {
  return data?.choices?.[0]?.message?.content || data?.output_text || data?.content?.[0]?.text || "";
}

function cleanText(value, maxLength = 1800) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanReviewText(value, maxLength = 260) {
  return cleanText(
    decodeHtmlEntities(String(value || "")
      .replace(/\\\//g, "/")
      .replace(/\\u0026/g, "&")
      .replace(/\\n|\\r|\\t/g, " ")
      .replace(/\\"/g, '"')
      .replace(/\\'/g, "'")),
    maxLength
  );
}

function isUsefulReviewSnippet(text = "") {
  const value = String(text || "").trim();
  if (value.length < 18) return false;
  const lower = value.toLowerCase();
  const boilerplatePatterns = [
    /^\d(?:\.\d)?\s+out of\s+5\s+stars$/i,
    /^images in this review$/i,
    /^top reviews/i,
    /^customer reviews$/i,
    /^sort by/i,
    /^filter by/i,
    /^showing \d/i,
    /^verified purchase$/i,
    /there was a problem filtering reviews/i,
    /please reload the page/i,
    /translate all reviews to english/i,
    /review this product/i,
    /share your thoughts/i
  ];
  if (boilerplatePatterns.some((pattern) => pattern.test(value))) return false;
  const meaningfulTerms = /(quality|size|easy|durable|package|packaging|shipping|delivery|recommend|results?|worked|effect|visible|use|used|flavor|taste|support|replace|arrived|qualidade|tamanho|f[aá]cil|dur[aá]vel|embalagem|entrega|recomendo|resultado|funciona|chegou|bom|boa|ruim|excelente)/i;
  if (meaningfulTerms.test(value)) return true;
  return lower.split(/\s+/).length >= 8 && /[.!?。！？]/.test(value);
}

function extractMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return html.match(pattern)?.[1] || "";
}

function absolutizeUrl(src, baseUrl) {
  try {
    return new URL(cleanImageUrl(src), baseUrl).href;
  } catch {
    return cleanImageUrl(src);
  }
}

function decodeHtmlEntities(value = "") {
  return String(value || "")
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanImageUrl(src = "") {
  const decoded = decodeHtmlEntities(src)
    .replace(/\\\//g, "/")
    .replace(/\\u0026/g, "&")
    .trim();
  const imageMatch = decoded.match(/https?:\/\/[^\s"'<>\\{}[\],]+?\.(?:jpg|jpeg|png|webp)(?:[^\s"'<>\\{}[\],]*)?/i);
  return String(imageMatch?.[0] || decoded)
    .replace(/["'}\]]+.*$/i, "")
    .replace(/%7D.*$/i, "")
    .trim();
}

function imageDedupeKey(src = "") {
  let value = cleanImageUrl(src).toLowerCase();
  try {
    const parsed = new URL(value);
    parsed.search = "";
    parsed.hash = "";
    value = parsed.href;
  } catch {
    value = value.split(/[?#]/)[0];
  }
  return value
    .replace(/(?:\._[^./]+_\.)/g, ".")
    .replace(/(?:__[^/]*?__)/g, "__")
    .replace(/(?:PT\d+_)?(?:SX|SY|SL|US|SS)\d+_V\d+/gi, "")
    .replace(/_(?:AC_)?(?:SX|SY|SL|US|SS)\d+(?=[_.])/gi, "")
    .replace(/_V\d+(?=[_.])/gi, "")
    .replace(/_{2,}/g, "_")
    .replace(/\._+\./g, ".")
    .replace(/__+/g, "__");
}

function imageQualityScore(src = "") {
  const value = cleanImageUrl(src);
  const numbers = Array.from(value.matchAll(/(?:SL|SX|SY|US|SS|PT|_)(\d{2,4})(?=[_.])/gi))
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  const largest = numbers.length ? Math.max(...numbers) : 0;
  const libraryBoost = /aplus-media-library-service-media|media-library/i.test(value) ? 500 : 0;
  const fullSizeBoost = /SL1[0-9]{3}|SX1[0-9]{3}|SY1[0-9]{3}/i.test(value) ? 300 : 0;
  return largest + libraryBoost + fullSizeBoost;
}

function imageSelectionScore(image = {}) {
  return Number(image.score || 0) * 10000 + imageQualityScore(image.src);
}

function imageVariantScore(image = {}) {
  return imageQualityScore(image.src) * 10000 + Number(image.score || 0);
}

function extractDynamicImageUrls(value = "") {
  const source = decodeHtmlEntities(value).replace(/\\\//g, "/").replace(/\\u0026/g, "&").trim();
  const urls = [];
  try {
    const parsed = JSON.parse(source);
    for (const key of Object.keys(parsed || {})) {
      const clean = cleanImageUrl(key);
      if (clean) urls.push(clean);
    }
  } catch {
    // Amazon's dynamic image block is normally JSON; regex is a fallback for partial/escaped captures.
  }
  const found = Array.from(source.matchAll(/https?:\/\/[^\s"'<>\\{}[\]]+?\.(?:jpg|jpeg|png|webp)(?:[^\s"'<>\\{}[\]]*)?/gi)).map((item) => cleanImageUrl(item[0]));
  return [...urls, ...found].filter(Boolean);
}

function extractImageUrlsFromText(value = "") {
  const source = decodeHtmlEntities(value).replace(/\\\//g, "/").replace(/\\u0026/g, "&");
  return Array.from(source.matchAll(/https?:\/\/[^\s"'<>\\{}[\],]+?\.(?:jpg|jpeg|png|webp)(?:[^\s"'<>\\{}[\],]*)?/gi))
    .map((item) => cleanImageUrl(item[0]))
    .filter(Boolean);
}

function chooseAmazonGalleryUrl(item = {}) {
  if (!item || typeof item !== "object") return "";
  const preferred = item.hiRes || item.large || item.main || item.variant || item.thumb;
  return cleanImageUrl(preferred || "");
}

function extractBalancedJsonArray(source = "", startIndex = 0) {
  const openIndex = source.indexOf("[", startIndex);
  if (openIndex < 0) return "";
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex, index + 1);
    }
  }
  return "";
}

function extractAmazonCarouselGalleryUrls(html = "") {
  const source = decodeHtmlEntities(html).replace(/\\\//g, "/").replace(/\\u0026/g, "&");
  const urls = [];
  const markers = [/colorImages\s*:\s*\{\s*initial\s*:/gi, /"colorImages"\s*:\s*\{\s*"initial"\s*:/gi, /'colorImages'\s*:\s*\{\s*'initial'\s*:/gi];
  for (const marker of markers) {
    let match;
    while ((match = marker.exec(source))) {
      const arraySource = extractBalancedJsonArray(source, marker.lastIndex);
      if (!arraySource) continue;
      try {
        const items = JSON.parse(arraySource);
        for (const item of Array.isArray(items) ? items : []) {
          const clean = chooseAmazonGalleryUrl(item);
          if (clean) urls.push(clean);
        }
      } catch {
        urls.push(...extractDynamicImageUrls(arraySource));
      }
    }
  }
  return Array.from(new Set(urls.map(cleanImageUrl).filter(Boolean)));
}

function extractImageUrlsFromHtml(fragment = "") {
  const urls = [];
  const patterns = [
    /data-a-dynamic-image=(["'])([\s\S]*?)\1/gi,
    /\b(?:src|data-src|data-old-hires|data-a-hires|srcset|data-srcset)=(["'])([\s\S]*?)\1/gi
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(fragment))) {
      const source = decodeHtmlEntities(match[2] || "").replace(/\\\//g, "/").replace(/\\u0026/g, "&");
      const found = extractDynamicImageUrls(source);
      if (found.length) urls.push(...found);
      if (/^https?:\/\//i.test(source)) urls.push(source);
    }
  }
  urls.push(...extractImageUrlsFromText(fragment));
  return urls.map(cleanImageUrl).filter(Boolean);
}

function detectPlatform(url = "", html = "") {
  const source = `${url}\n${html.slice(0, 20000)}`;
  const specific = PLATFORM_SCAN_CONFIGS.find((config) =>
    config.key !== "generic" &&
    (
      (config.host_patterns || []).some((pattern) => pattern.test(source)) ||
      (config.html_patterns || []).some((pattern) => pattern.test(source))
    )
  );
  return specific || PLATFORM_SCAN_CONFIGS.find((config) => config.key === "generic");
}

function extractHtmlSections(html, markers = []) {
  const sections = [];
  const lower = html.toLowerCase();
  for (const marker of markers) {
    let index = 0;
    const needle = marker.toLowerCase();
    let markerMatches = 0;
    while ((index = lower.indexOf(needle, index)) !== -1 && markerMatches < 24) {
      const start = Math.max(0, index - 3000);
      const end = Math.min(html.length, index + 90000);
      sections.push(html.slice(start, end));
      index += needle.length;
      markerMatches += 1;
    }
  }
  return sections
    .map((section, index) => ({ section, index, imageCount: extractImageUrlsFromHtml(section).length }))
    .sort((a, b) => Number(b.imageCount > 0) - Number(a.imageCount > 0) || b.imageCount - a.imageCount || a.index - b.index)
    .slice(0, 36)
    .map((item) => item.section);
}

function extractTaggedHtmlSections(html = "", markers = []) {
  const sections = [];
  for (const marker of markers) {
    const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<([a-z][\\w:-]*)\\b[^>]*(?:id|class|data-testid|aria-label)=["'][^"']*${escaped}[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`, "gi"),
      new RegExp(`<([a-z][\\w:-]*)\\b[^>]*${escaped}[^>]*>[\\s\\S]*?<\\/\\1>`, "gi")
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) && sections.length < 80) {
        sections.push(match[0]);
      }
    }
  }
  return sections;
}

function platformSections(html = "", markers = []) {
  const tagged = extractTaggedHtmlSections(html, markers);
  if (tagged.length) return tagged;
  return extractHtmlSections(html, markers);
}

function isExcludedProductSection(section = "", platform = detectPlatform()) {
  const sectionText = String(section || "").toLowerCase();
  return Boolean((platform.detail_exclude || /recommend|sponsored|related/i).test(sectionText));
}

function isUsefulDetailSection(marker = "", section = "", platform = detectPlatform()) {
  if (isExcludedProductSection(section, platform)) return false;
  if ((platform.detail_required || /product|description|detail|aplus/i).test(`${marker}\n${section}`)) return true;
  return false;
}

function imagePositionLabel({ area, index, role }) {
  const areaLabel = area === "detail" ? "详情页/A+模块" : "主图图库";
  const roleLabel = role ? ` · ${role}` : "";
  return `${areaLabel}第 ${index} 张${roleLabel}`;
}

function enrichImageCandidate(candidate, { area, index, role, sourceMarker, confidence }) {
  return {
    ...candidate,
    dedupe_key: imageDedupeKey(candidate.src),
    quality_score: imageQualityScore(candidate.src),
    source_area: area,
    position_index: index,
    source_position: imagePositionLabel({ area, index, role }),
    source_marker: sourceMarker || "",
    inferred_role: role || classifyImageCandidate(candidate),
    position_confidence: confidence || "medium"
  };
}

function extractImageCandidates(html, baseUrl) {
  const candidates = [];
  const platform = detectPlatform(baseUrl, html);
  const ogImage = extractMeta(html, "og:image");
  if (platform.key === "amazon" && ogImage && !isNonProductImage(ogImage)) {
    candidates.push(enrichImageCandidate(
      { type: "main-image", src: absolutizeUrl(ogImage, baseUrl), alt: "Open Graph product image", score: 12 },
      { area: "main", index: 1, role: "white_main", sourceMarker: "og:image", confidence: "medium" }
    ));
  }

  let galleryIndex = 0;
  const addMainGalleryImage = (src, sourceMarker = "product-gallery", confidence = "high") => {
    if (!src || isNonProductImage(src)) return;
    galleryIndex += 1;
    const role = galleryIndex === 1 ? "white_main" : "supporting";
    candidates.push(enrichImageCandidate(
      {
        type: "main-image",
        src: absolutizeUrl(src, baseUrl),
        alt: galleryIndex === 1 ? `${platform.name} product gallery hero/main image` : `${platform.name} product gallery image ${galleryIndex}`,
        score: galleryIndex === 1 ? 14 : 12
      },
      { area: "main", index: galleryIndex, role, sourceMarker, confidence }
    ));
  };

  if (platform.key === "amazon") {
    const dynamicImageBlocks = Array.from(html.matchAll(/data-a-dynamic-image=(["'])([\s\S]*?)\1/gi));
    for (const block of dynamicImageBlocks.slice(0, 12)) {
      const urls = extractDynamicImageUrls(block[2]);
      for (const src of urls.slice(0, MAX_RAW_MAIN_IMAGE_CANDIDATES)) {
        addMainGalleryImage(src, "data-a-dynamic-image", "high");
      }
    }
    for (const src of extractAmazonCarouselGalleryUrls(html).slice(0, MAX_RAW_MAIN_IMAGE_CANDIDATES)) {
      const cleanSrc = cleanImageUrl(src);
      const key = imageDedupeKey(cleanSrc);
      if (!cleanSrc || candidates.some((item) => item.dedupe_key === key)) continue;
      addMainGalleryImage(cleanSrc, "colorImages.initial", "high");
    }
  } else {
    const mainSections = (platform.main_markers || []).flatMap((marker) =>
      platformSections(html, [marker]).map((section) => ({ marker, section }))
    ).filter(({ section }) => !isExcludedProductSection(section, platform));
    for (const { marker, section } of mainSections) {
      const urls = extractImageUrlsFromHtml(section)
        .map((src) => cleanImageUrl(src))
        .filter((src) => src && !isNonProductImage(src));
      let addedFromSection = 0;
      for (const src of urls) {
        addMainGalleryImage(src, marker, "high");
        addedFromSection += 1;
        if (addedFromSection >= MAX_RAW_MAIN_IMAGE_CANDIDATES) break;
      }
    }
    if (!galleryIndex && ogImage && !isNonProductImage(ogImage)) {
      addMainGalleryImage(ogImage, "og:image", "low");
    }
  }

  const detailSections = (platform.detail_markers || []).flatMap((marker) =>
    platformSections(html, [marker]).map((section) => ({ marker, section }))
  ).filter(({ marker, section }) => isUsefulDetailSection(marker, section, platform));
  let detailIndex = 0;
  for (const { marker, section } of detailSections) {
    const sectionImages = extractImageUrlsFromHtml(section)
      .map((src) => cleanImageUrl(src))
      .filter((src) => src && !isNonProductImage(src) && (platform.key === "amazon" ? isLikelyDetailImage(src) : true) && !isLowQualityDetailVariant(src));
    let addedFromSection = 0;
    for (const src of sectionImages) {
      detailIndex += 1;
      addedFromSection += 1;
      const baseCandidate = {
        type: "detail-page-image",
        src: absolutizeUrl(src, baseUrl),
        alt: `Detail page/A+ content image from ${marker}`,
        score: src.includes("m.media-amazon.com/images/I/") ? 10 : src.includes("m.media-amazon.com/images/S/") ? 9 : 6
      };
      candidates.push(enrichImageCandidate(
        baseCandidate,
        {
          area: "detail",
          index: detailIndex,
          role: classifyImageCandidate(baseCandidate),
          sourceMarker: marker,
          confidence: "medium"
        }
      ));
      if (addedFromSection >= MAX_RAW_DETAIL_IMAGE_CANDIDATES) break;
    }
  }

  return selectImageEvidence(candidates);
}

function dedupeImagesBySource(images = []) {
  const grouped = new Map();
  for (const image of images) {
    if (!USEFUL_IMAGE_TYPES.has(image.type) || !image.src || isNonProductImage(image.src)) continue;
    const key = image.dedupe_key || imageDedupeKey(image.src);
    if (!key) continue;
    const normalized = {
      ...image,
      dedupe_key: key,
      quality_score: image.quality_score || imageQualityScore(image.src)
    };
    const existing = grouped.get(key);
    if (!existing || imageVariantScore(normalized) > imageVariantScore(existing)) {
      grouped.set(key, existing ? { ...existing, ...normalized } : normalized);
    }
  }
  return Array.from(grouped.values());
}

function renumberImagePositions(images = [], area) {
  return images.map((image, index) => {
    const positionIndex = index + 1;
    const role = image.inferred_role || image.role || classifyImageCandidate(image);
    return {
      ...image,
      source_area: area,
      position_index: positionIndex,
      source_position: imagePositionLabel({ area, index: positionIndex, role }),
      inferred_role: role
    };
  });
}

function selectImageEvidence(images = []) {
  const uniqueValues = dedupeImagesBySource(images);
  const mainImages = renumberImagePositions(
    uniqueValues
      .filter((item) => item.type === "main-image")
      .sort((a, b) => Number(a.position_index || 999) - Number(b.position_index || 999) || imageSelectionScore(b) - imageSelectionScore(a))
      .slice(0, MAX_MAIN_IMAGE_CANDIDATES),
    "main"
  );
  const detailImages = renumberImagePositions(
    uniqueValues
      .filter((item) => item.type === "detail-page-image")
      .sort((a, b) => Number(a.position_index || 999) - Number(b.position_index || 999) || imageSelectionScore(b) - imageSelectionScore(a))
      .slice(0, MAX_DETAIL_IMAGE_CANDIDATES),
    "detail"
  );
  return [...mainImages, ...detailImages].slice(0, MAX_IMAGE_CANDIDATES);
}

function isNonProductImage(src = "") {
  const value = String(src || "").toLowerCase();
  return (
    value.includes("/oc-csi/") ||
    value.includes("fls-na.amazon.") ||
    value.includes("/images/g/01/ad-feedback/") ||
    value.includes("/images/g/01/advertising/preview_bg") ||
    value.includes("/ad-feedback/") ||
    value.includes("/advertising/preview_bg") ||
    value.includes("/error/") ||
    value.includes("/captcha/") ||
    value.includes("/sprites/") ||
    value.includes("nav-sprite") ||
    value.includes("info-icon") ||
    value.includes("/gno/") ||
    value.includes("/omaha/") ||
    value.includes("/prime/") ||
    value.includes("/yoda/") ||
    value.includes("fallback_cta") ||
    value.includes("transparent-pixel") ||
    value.includes("pixel.gif") ||
    value.includes("logo._")
  );
}

function isLikelyDetailImage(src = "") {
  const value = String(src || "").toLowerCase();
  return (
    value.includes("m.media-amazon.com/images/i/") ||
    value.includes("m.media-amazon.com/images/s/") ||
    value.includes("aplus") ||
    value.includes("media-library") ||
    value.includes("thumbnail_")
  );
}

function isLowQualityDetailVariant(src = "") {
  const value = String(src || "");
  return /_(?:AC_)?(?:US\d{2,3}|SS\d{2,3}|SY\d{2,3}|SX\d{2,3})(?:_|\\.)/i.test(value) && !/S(?:L|X)1[0-9]{3}/i.test(value);
}

function extractHeadings(html) {
  return Array.from(html.matchAll(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi))
    .map((match) => ({ level: Number(match[1]), text: cleanText(match[2], 220) }))
    .filter((item) => item.text)
    .slice(0, MAX_HEADINGS);
}

function extractRating(html) {
  const sources = [
    html.match(/"ratingValue"\s*:\s*"?([0-5](?:[.,]\d+)?)"?/i)?.[1],
    html.match(/itemprop=["']ratingValue["'][^>]+content=["']([0-5](?:[.,]\d+)?)["']/i)?.[1],
    html.match(/([0-5](?:[.,]\d+)?)\s+(?:out of|de)\s+5/i)?.[1]
  ].filter(Boolean);
  return sources[0] ? Number(String(sources[0]).replace(",", ".")) : null;
}

function extractReviewCount(html) {
  const sources = [
    html.match(/"reviewCount"\s*:\s*"?([\d.,]+)"?/i)?.[1],
    html.match(/itemprop=["']reviewCount["'][^>]+content=["']([\d.,]+)["']/i)?.[1],
    html.match(/([\d.,]+)\s+(?:ratings|reviews|avalia(?:ç|c)[õo]es|coment[aá]rios)/i)?.[1]
  ].filter(Boolean);
  return sources[0] ? Number(String(sources[0]).replace(/[^\d]/g, "")) || null : null;
}

function extractReviewSnippets(html) {
  const snippets = [];
  const addSnippet = (value) => {
    if (snippets.length >= MAX_REVIEW_SNIPPETS) return;
    const text = cleanReviewText(value, 260);
    if (isUsefulReviewSnippet(text) && !snippets.includes(text)) snippets.push(text);
  };

  const patterns = [
    /data-hook=["']review-body["'][^>]*>([\s\S]{0,2200}?)(?=<\/(?:span|div)>\s*<\/(?:span|div)>|<\/(?:span|div)>)/gi,
    /data-hook=["']review-title["'][^>]*>([\s\S]{0,1200}?)(?=<\/(?:span|a|div)>\s*<\/(?:span|a|div)>|<\/(?:span|a|div)>)/gi,
    /class=["'][^"']*(?:review|comentario|comment)[^"']*["'][^>]*>([\s\S]{0,2200}?)(?=<\/(?:p|span|div)>\s*<\/(?:p|span|div)>|<\/(?:p|span|div)>)/gi
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) && snippets.length < MAX_REVIEW_SNIPPETS) {
      addSnippet(match[1]);
    }
  }

  const decoded = decodeHtmlEntities(html);
  const serializedPatterns = [
    /["'](?:reviewText|reviewBody|review_text|review_body)["']\s*:\s*["']((?:\\.|[^"'\\]){18,1200})["']/gi,
    /(?:reviewText|reviewBody|review_text|review_body)\s*[:=]\s*["']((?:\\.|[^"'\\]){18,1200})["']/gi
  ];
  for (const pattern of serializedPatterns) {
    let match;
    while ((match = pattern.exec(decoded)) && snippets.length < MAX_REVIEW_SNIPPETS) {
      addSnippet(match[1]);
    }
  }

  if (snippets.length < 3) {
    const text = cleanText(html, 12000);
    const reviewLike = text
      .split(/(?<=[.!?。！？])\s+|\s{2,}/)
      .map((item) => cleanReviewText(item, 260))
      .filter((item) => /(quality|size|easy|durable|package|shipping|delivery|recommend|qualidade|tamanho|f[aá]cil|dur[aá]vel|embalagem|entrega|recomendo|bom|boa|ruim|excelente)/i.test(item));
    for (const item of reviewLike) {
      if (snippets.length >= MAX_REVIEW_SNIPPETS) break;
      if (isUsefulReviewSnippet(item) && !snippets.includes(item)) snippets.push(item);
    }
  }

  return snippets.slice(0, MAX_REVIEW_SNIPPETS);
}

function countTerms(text, terms) {
  const lower = String(text || "").toLowerCase();
  return terms
    .map((term) => ({ term, count: (lower.match(new RegExp(term, "gi")) || []).length }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function extractReviewInsights(html) {
  const snippets = extractReviewSnippets(html);
  const reviewText = snippets.join(" ");
  const rating = extractRating(html);
  const reviewCount = extractReviewCount(html);
  if (!rating && !reviewCount && !snippets.length) return null;
  return {
    rating,
    review_count: reviewCount,
    snippets,
    positive_terms: countTerms(reviewText, [
      "quality", "easy", "durable", "recommend", "comfortable", "great", "excellent",
      "qualidade", "fácil", "durável", "recomendo", "confortável", "ótimo", "excelente", "bom", "boa"
    ]),
    negative_terms: countTerms(reviewText, [
      "small", "large", "size", "broken", "hard", "difficult", "package", "shipping", "delivery",
      "pequeno", "grande", "tamanho", "quebrado", "difícil", "embalagem", "entrega", "ruim", "fraco"
    ]),
    scene_terms: countTerms(reviewText, [
      "home", "office", "travel", "outdoor", "daily", "family", "work",
      "casa", "escritório", "viagem", "rua", "dia a dia", "família", "trabalho"
    ])
  };
}

function extractAmazonAsin(url = "") {
  const text = String(url || "");
  const patterns = [
    /\/dp\/([A-Z0-9]{10})(?:[/?#]|$)/i,
    /\/gp\/product\/([A-Z0-9]{10})(?:[/?#]|$)/i,
    /\/product-reviews\/([A-Z0-9]{10})(?:[/?#]|$)/i,
    /(?:[?&]asin=)([A-Z0-9]{10})(?:[&#]|$)/i
  ];
  for (const pattern of patterns) {
    const asin = text.match(pattern)?.[1];
    if (asin) return asin.toUpperCase();
  }
  return "";
}

function amazonReviewUrl(productUrl = "") {
  const asin = extractAmazonAsin(productUrl);
  if (!asin) return "";
  try {
    const url = new URL(productUrl);
    if (!/amazon\./i.test(url.hostname)) return "";
    return `${url.protocol}//${url.hostname}/product-reviews/${asin}?sortBy=recent&reviewerType=all_reviews`;
  } catch {
    return "";
  }
}

function mergeReviewInsights(primary = null, extra = null) {
  if (!primary && !extra) return null;
  const base = primary || {};
  const addition = extra || {};
  const mergeTerms = (left = [], right = []) => {
    const counts = new Map();
    for (const item of [...left, ...right]) {
      const term = typeof item === "string" ? item : item?.term;
      const count = typeof item === "string" ? 1 : Number(item?.count || 1);
      if (!term) continue;
      counts.set(term, (counts.get(term) || 0) + count);
    }
    return Array.from(counts.entries())
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };
  const snippets = [];
  for (const snippet of [...(base.snippets || []), ...(addition.snippets || [])]) {
    if (snippet && !snippets.includes(snippet)) snippets.push(snippet);
  }
  const reviewText = snippets.join(" ");
  return {
    rating: base.rating || addition.rating || null,
    review_count: base.review_count || addition.review_count || null,
    snippets: snippets.slice(0, MAX_REVIEW_SNIPPETS),
    positive_terms: mergeTerms(base.positive_terms, addition.positive_terms).length
      ? mergeTerms(base.positive_terms, addition.positive_terms)
      : countTerms(reviewText, [
          "quality", "easy", "durable", "recommend", "comfortable", "great", "excellent",
          "qualidade", "fácil", "durável", "recomendo", "confortável", "ótimo", "excelente", "bom", "boa"
        ]),
    negative_terms: mergeTerms(base.negative_terms, addition.negative_terms).length
      ? mergeTerms(base.negative_terms, addition.negative_terms)
      : countTerms(reviewText, [
          "small", "large", "size", "broken", "hard", "difficult", "package", "shipping", "delivery",
          "pequeno", "grande", "tamanho", "quebrado", "difícil", "embalagem", "entrega", "ruim", "fraco"
        ]),
    scene_terms: mergeTerms(base.scene_terms, addition.scene_terms).length
      ? mergeTerms(base.scene_terms, addition.scene_terms)
      : countTerms(reviewText, [
          "home", "office", "travel", "outdoor", "daily", "family", "work",
          "casa", "escritório", "viagem", "rua", "dia a dia", "família", "trabalho"
        ])
  };
}

async function fetchSupplementalReviewInsights(url, signal) {
  const reviewUrl = amazonReviewUrl(url);
  if (!reviewUrl || !process.env.BRIGHTDATA_API_KEY) return null;
  try {
    const { response, html } = await fetchProductHtml(reviewUrl, signal);
    if (!response.ok || isBotProtectionPage(html, response.url)) return null;
    return extractReviewInsights(html);
  } catch {
    return null;
  }
}

function cleanBrightDataScanResult(scan) {
  const selectedImages = selectImageEvidence(Array.isArray(scan.image_candidates) ? scan.image_candidates : []);
  const mainImages = selectedImages.filter((image) => image.type === "main-image");
  const detailImages = selectedImages.filter((image) => image.type === "detail-page-image");
  const usefulHeadings = scan.title
    ? [{ level: 1, text: scan.title }]
    : [];
  return {
    ...scan,
    image_candidates: selectedImages,
    headings: usefulHeadings,
    page_text_sample: cleanText(scan.page_text_sample, PAGE_TEXT_SAMPLE_LENGTH),
    description: cleanText(scan.description, 700),
    platform_key: scan.platform_key || null,
    platform_name: scan.platform_name || null,
    scan_scope: brightDataScanScope(mainImages.length, detailImages.length, scan)
  };
}

function brightDataScanScope(mainImageCount = 0, detailImageCount = 0, scan = {}) {
  return {
    mode: "brightdata-full-evidence",
    platform_key: scan.platform_key || null,
    platform_name: scan.platform_name || null,
    collected: ["title", "description", "main_gallery_candidates", "detail_page_candidates", "review_insights", "page_text_sample"],
    selection_strategy: "region-first collect, dedupe variants, then select model evidence",
    main_image_count: mainImageCount,
    detail_page_image_count: detailImageCount,
    ignored: ["navigation", "ads", "menus", "footer", "unrelated_images"]
  };
}

function isBotProtectionPage(html, finalUrl = "") {
  const title = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "", 240).toLowerCase();
  const text = cleanText(html, 1800).toLowerCase();
  const url = String(finalUrl || "").toLowerCase();
  return (
    title.includes("security check") ||
    title.includes("captcha") ||
    title.includes("access denied") ||
    text.includes("security check") ||
    text.includes("robot check") ||
    text.includes("verify you are human") ||
    text.includes("unusual traffic") ||
    text.includes("automated access") ||
    text.includes("click the button below to continue shopping") ||
    text.includes("clique no botão abaixo para continuar comprando") ||
    text.includes("continue shopping") ||
    text.includes("continuar comprando") ||
    text.includes("getting things ready") ||
    text.includes("please enable cookies") ||
    text.includes("captcha") ||
    url.includes("/edgex/guard/") ||
    url.includes("captcha")
  );
}

function brightDataTimeoutMs() {
  const configuredMs = Number(process.env.BRIGHTDATA_LINK_SCAN_TIMEOUT_MS || BRIGHTDATA_LINK_SCAN_TIMEOUT_MS);
  if (process.env.NODE_ENV === "test") return configuredMs;
  return Math.max(configuredMs || 0, MIN_PRODUCTION_BRIGHTDATA_TIMEOUT_MS);
}

async function fetchProductHtml(url, signal) {
  const brightDataKey = process.env.BRIGHTDATA_API_KEY;
  const brightDataZone = process.env.BRIGHTDATA_ZONE || "web_unlocker1";
  if (brightDataKey) {
    const brightDataController = new AbortController();
    const relayAbort = () => brightDataController.abort();
    signal?.addEventListener?.("abort", relayAbort, { once: true });
    const brightDataTimeout = setTimeout(() => brightDataController.abort(), brightDataTimeoutMs());
    try {
      const response = await fetch(BRIGHTDATA_API_URL, {
        method: "POST",
        signal: brightDataController.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${brightDataKey}`
        },
        body: JSON.stringify({
          zone: brightDataZone,
          url,
          format: "raw"
        })
      });
      const html = await response.text();
      if (response.ok && html) {
        return {
          response: {
            ok: response.ok,
            status: response.status,
            url
          },
          html,
          scanner: "brightdata"
        };
      }
      const error = new Error(`Bright Data request failed with status ${response.status}.`);
      error.code = "BRIGHTDATA_SCAN_FAILED";
      error.statusCode = response.status;
      error.scanner = "brightdata";
      throw error;
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("Bright Data 扫描超时，未读取原始商品链接以避免 Amazon 风控页污染结果。");
        timeoutError.code = "BRIGHTDATA_SCAN_TIMEOUT";
        timeoutError.scanner = "brightdata";
        throw timeoutError;
      }
      if (!error.code) {
        error.code = "BRIGHTDATA_SCAN_FAILED";
      }
      error.scanner = "brightdata";
      throw error;
    } finally {
      clearTimeout(brightDataTimeout);
      signal?.removeEventListener?.("abort", relayAbort);
    }
  }

  const response = await fetch(url, {
    signal,
    headers: {
      "User-Agent": "Mozilla/5.0 VISION-BRZAZIL-Link-Scanner/1.0",
      Accept: "text/html,application/xhtml+xml"
    }
  });
  return {
    response,
    html: await response.text(),
    scanner: "direct-fetch"
  };
}

async function scanProductLink(url, marketHint) {
  const controller = new AbortController();
  const scanTimeoutMs = process.env.BRIGHTDATA_API_KEY
    ? brightDataTimeoutMs() + 2000
    : DIRECT_LINK_SCAN_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), scanTimeoutMs);
  try {
    const { response, html, scanner } = await fetchProductHtml(url, controller.signal);
    const title = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "", 240);
    const blockedByProtection = isBotProtectionPage(html, response.url);
    if (blockedByProtection) {
      return {
        url,
        market_hint: marketHint,
        ok: false,
        status: response.status,
        final_url: response.url,
        scanner,
        error: "LINK_SCAN_BLOCKED",
        message: "目标平台返回 Security Check/CAPTCHA 风控页，后端无法读取真实商品图片和 review。",
        title: title || "Security Check",
        description: "",
        image_candidates: [],
        headings: [],
        review_insights: null,
        page_text_sample: scanner === "brightdata" ? "" : cleanText(html, PAGE_TEXT_SAMPLE_LENGTH),
        scan_scope: scanner === "brightdata" ? brightDataScanScope() : undefined
      };
    }
    const platform = detectPlatform(response.url || url, html);
    const reviewInsights = extractReviewInsights(html);
    const supplementalReviews = !reviewInsights || (Array.isArray(reviewInsights.snippets) && reviewInsights.snippets.length < 3)
      ? await fetchSupplementalReviewInsights(response.url || url, controller.signal)
      : null;
    const scan = {
      url,
      market_hint: marketHint,
      ok: response.ok,
      status: response.status,
      final_url: response.url,
      scanner,
      platform_key: platform.key,
      platform_name: platform.name,
      title,
      description: cleanText(extractMeta(html, "description") || extractMeta(html, "og:description"), 500),
      image_candidates: extractImageCandidates(html, response.url),
      headings: extractHeadings(html),
      review_insights: mergeReviewInsights(reviewInsights, supplementalReviews),
      page_text_sample: cleanText(html, PAGE_TEXT_SAMPLE_LENGTH)
    };
    return scanner === "brightdata" ? cleanBrightDataScanResult(scan) : scan;
  } catch (error) {
    return {
      url,
      market_hint: marketHint,
      ok: false,
      scanner: error.scanner || undefined,
      error: error.code || (error.name === "AbortError" ? "LINK_SCAN_TIMEOUT" : "LINK_SCAN_FAILED"),
      message: error.message,
      scan_scope: error.scanner === "brightdata" ? brightDataScanScope() : undefined
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function scanProductLinks(payload) {
  if (!process.env.BRIGHTDATA_API_KEY && Array.isArray(payload?.link_scan_results) && payload.link_scan_results.length) {
    return payload.link_scan_results.map(compactScanResult);
  }
  const urls = Array.isArray(payload?.product?.source_urls) ? payload.product.source_urls.filter(Boolean).slice(0, MAX_SCAN_LINKS) : [];
  const markets = Array.isArray(payload?.product?.source_markets) ? payload.product.source_markets : [];
  return Promise.all(urls.map((url, index) => scanProductLink(url, markets[index] || null)));
}

function compactProduct(product = {}) {
  return {
    name: product.name || "",
    source_urls: Array.isArray(product.source_urls) ? product.source_urls.slice(0, MAX_SCAN_LINKS) : [],
    source_domains: Array.isArray(product.source_domains) ? product.source_domains.slice(0, MAX_SCAN_LINKS) : [],
    source_markets: Array.isArray(product.source_markets) ? product.source_markets.slice(0, MAX_SCAN_LINKS) : [],
    selling_points: cleanText(product.selling_points, 900),
    keyword_signals: cleanText(product.keyword_signals, 500),
    auto_keyword_signals: cleanText(product.auto_keyword_signals, 400),
    manual_keyword_overrides: cleanText(product.manual_keyword_overrides, 400)
  };
}

function compactScanResult(item = {}) {
  return {
    url: item.url,
    market_hint: item.market_hint,
    ok: item.ok,
    status: item.status,
    final_url: item.final_url,
    scanner: item.scanner,
    platform_key: item.platform_key || item.scan_scope?.platform_key || null,
    platform_name: item.platform_name || item.scan_scope?.platform_name || null,
    error: item.error,
    message: item.message,
    title: cleanText(item.title, 180),
    description: cleanText(item.description, 320),
    image_candidates: Array.isArray(item.image_candidates)
      ? item.image_candidates.slice(0, MAX_IMAGE_CANDIDATES).map((image) => ({
          type: image.type,
          src: image.src,
          alt: cleanText(image.alt, 120),
          score: image.score,
          dedupe_key: image.dedupe_key || imageDedupeKey(image.src),
          quality_score: image.quality_score || imageQualityScore(image.src),
          source_area: image.source_area || null,
          source_position: image.source_position || null,
          position_index: image.position_index || null,
          source_marker: image.source_marker || null,
          inferred_role: image.inferred_role || null,
          position_confidence: image.position_confidence || null
      }))
      : [],
    review_insights: item.review_insights || null,
    headings: Array.isArray(item.headings)
      ? item.headings.slice(0, MAX_HEADINGS).map((heading) => ({
          level: heading.level,
          text: cleanText(heading.text, 140)
        }))
      : [],
    page_text_sample: cleanText(item.page_text_sample, PAGE_TEXT_SAMPLE_LENGTH),
    scan_scope: item.scan_scope || null
  };
}

function isBrazilMarket(value) {
  const text = JSON.stringify(value || "").toLowerCase();
  return text.includes("brazil") || text.includes("brasil") || text.includes("mercado") || text.includes(".br") || text.includes("shopee");
}

function isUsMarket(value) {
  const text = JSON.stringify(value || "").toLowerCase();
  return text.includes("united states") || text.includes("usa") || text.includes("us") || text.includes(".com");
}

function marketBucket(scan = {}) {
  if (isBrazilMarket(scan.market_hint) || isBrazilMarket(scan.url) || isBrazilMarket(scan.final_url)) return "brazil";
  if (isUsMarket(scan.market_hint) || isUsMarket(scan.url) || isUsMarket(scan.final_url)) return "us";
  return "other";
}

function splitScansByMarket(scanResults = []) {
  const grouped = { us: [], brazil: [], other: [] };
  for (const scan of scanResults.map(compactScanResult)) {
    grouped[marketBucket(scan)].push(scan);
  }
  return grouped;
}

function reviewEvidenceFor(scans = []) {
  return scans.map((scan) => ({
    url: scan.url,
    title: scan.title,
    market_hint: scan.market_hint,
    review_insights: scan.review_insights || null
  })).filter((item) => hasReviewEvidence(item.review_insights));
}

function hasReviewEvidence(insights = {}) {
  return Boolean(
    insights &&
    (
      insights.rating ||
      insights.review_count ||
      (Array.isArray(insights.snippets) && insights.snippets.length) ||
      (Array.isArray(insights.positive_terms) && insights.positive_terms.length) ||
      (Array.isArray(insights.negative_terms) && insights.negative_terms.length) ||
      (Array.isArray(insights.scene_terms) && insights.scene_terms.length)
    )
  );
}

function buildReviewModifierEvidence(scanResults = []) {
  const grouped = splitScansByMarket(scanResults || []);
  const evidence = {
    us: reviewEvidenceFor(grouped.us),
    brazil: reviewEvidenceFor(grouped.brazil),
    other: reviewEvidenceFor(grouped.other)
  };
  evidence.overall_review_data = summarizeReviewEvidence(evidence);
  return evidence;
}

function summarizeReviewEvidence(reviewEvidence = {}) {
  const allEvidence = [...(reviewEvidence.us || []), ...(reviewEvidence.brazil || []), ...(reviewEvidence.other || [])];
  const snippets = [];
  let reviewCountTotal = 0;
  const ratings = [];
  for (const item of allEvidence) {
    const insights = item.review_insights || {};
    if (Number(insights.review_count || 0)) reviewCountTotal += Number(insights.review_count || 0);
    if (Number(insights.rating || 0)) ratings.push(Number(insights.rating));
    for (const snippet of insights.snippets || []) {
      if (snippet && !snippets.includes(snippet)) snippets.push(snippet);
    }
  }
  return {
    source_count: allEvidence.length,
    snippet_count: snippets.length,
    rating_average: ratings.length ? Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(2)) : null,
    review_count_total: reviewCountTotal || null,
    representative_snippets: snippets.slice(0, MAX_REVIEW_SNIPPETS)
  };
}

function fallbackReviewModifierAnalysis(reviewEvidence = {}) {
  const allEvidence = [...(reviewEvidence.us || []), ...(reviewEvidence.brazil || []), ...(reviewEvidence.other || [])];
  const summary = reviewEvidence.overall_review_data || summarizeReviewEvidence(reviewEvidence);
  const statsText = [
    summary.rating_average ? `平均评分 ${summary.rating_average}` : "",
    summary.review_count_total ? `${summary.review_count_total} 条评价` : "",
    summary.source_count ? `${summary.source_count} 个链接来源` : ""
  ].filter(Boolean).join("，");
  const positiveTerms = [];
  const negativeTerms = [];
  const sceneTerms = [];
  const snippets = [];
  for (const item of allEvidence) {
    const insights = item.review_insights || {};
    for (const term of insights.positive_terms || []) if (term?.term && !positiveTerms.includes(term.term)) positiveTerms.push(term.term);
    for (const term of insights.negative_terms || []) if (term?.term && !negativeTerms.includes(term.term)) negativeTerms.push(term.term);
    for (const term of insights.scene_terms || []) if (term?.term && !sceneTerms.includes(term.term)) sceneTerms.push(term.term);
    for (const snippet of insights.snippets || []) if (snippet && !snippets.includes(snippet)) snippets.push(snippet);
  }
  return {
    analysis_method: "fallback-review-terms",
    review_summary: snippets.length
      ? `已采集 ${summary.snippet_count || snippets.length} 条可见 review 摘要${statsText ? `，${statsText}` : ""}，规则降级提取好评、差评和使用场景信号。`
      : `未采集到足够 review 原文，规则降级使用${statsText || "评分、评论数和关键词信号"}生成 Review Modifier。`,
    sentiment_breakdown: {
      positive: positiveTerms.slice(0, 8),
      negative: negativeTerms.slice(0, 8),
      neutral: sceneTerms.slice(0, 8)
    },
    customer_pain_points: negativeTerms.slice(0, 8),
    purchase_barriers: negativeTerms.slice(0, 6).map((term) => `${term} 相关疑虑需要在详情页提前解释。`),
    customer_language_examples: snippets.slice(0, 8),
    high_frequency_praise: positiveTerms.slice(0, 5),
    high_frequency_complaints: negativeTerms.slice(0, 5),
    local_language: [...positiveTerms, ...negativeTerms].slice(0, 8),
    usage_scenarios: sceneTerms.slice(0, 5),
    competitor_weaknesses: negativeTerms.slice(0, 5),
    prompt_modifiers: {
      main_images: positiveTerms.slice(0, 4).map((term) => `可在主图/副图文案中自然体现 ${term}，但不改变产品外观。`),
      detail_pages: [
        statsText ? `详情页可引用 review 信号强度（${statsText}）作为卖点排序参考，但不要伪造用户原话。` : "",
        ...negativeTerms.slice(0, 4).map((term) => `在详情页提前解释 ${term} 相关疑虑，降低误解和退货。`)
      ].filter(Boolean),
      negative_constraints: ["Review 只能修饰卖点措辞、本土语言和差评预防，不能覆盖上传产品图、美国链接图片结构或真实产品外观。"]
    },
    evidence_summary: {
      source_count: summary.source_count || allEvidence.length,
      snippet_count: summary.snippet_count || snippets.length,
      rating_average: summary.rating_average || null,
      review_count_total: summary.review_count_total || null
    },
    source_note: snippets.length ? `基于 ${allEvidence.length} 条链接 review 信号和可见评论摘要。` : "未提取到足够 review 摘要，仅使用评分/关键词信号。"
  };
}

function imageEvidenceFor(scans = [], mode) {
  return scans.map((scan) => ({
    url: scan.url,
    title: scan.title,
    description: scan.description,
    images: (scan.image_candidates || [])
      .filter((image) => mode === "detail" ? /detail|a-plus|aplus|module|lifestyle|hero/i.test(`${image.type} ${image.src} ${image.alt}`) : true)
      .slice(0, mode === "detail" ? MAX_DETAIL_IMAGE_CANDIDATES : MAX_MAIN_IMAGE_CANDIDATES),
    headings: (scan.headings || []).slice(0, mode === "detail" ? 8 : 4),
    text: mode === "detail" ? cleanText(scan.page_text_sample, 1400) : cleanText(scan.page_text_sample, 700)
  }));
}

function imageUrlsFor(scans = [], mode, limit = 6) {
  const urls = [];
  for (const scan of scans) {
    for (const image of scan.image_candidates || []) {
      const source = `${image.type} ${image.src} ${image.alt}`;
      const isDetail = /detail|a-plus|aplus|module|lifestyle|hero/i.test(source);
      if (mode === "detail" && !isDetail && urls.length >= 2) continue;
      if (image.src && /^https?:\/\//i.test(image.src) && !urls.includes(image.src)) urls.push(image.src);
      if (urls.length >= limit) return urls;
    }
  }
  return urls;
}

function classifyImageCandidate(image = {}) {
  const semanticSource = `${image.src || ""} ${image.alt || ""}`.toLowerCase();
  const typeSource = String(image.type || "").toLowerCase();
  if (semanticSource.includes("faq") || semanticSource.includes("question") || semanticSource.includes("pergunta")) return "faq";
  if (semanticSource.includes("chart") || semanticSource.includes("compare") || semanticSource.includes("comparison") || semanticSource.includes("comparativo")) return "comparison_chart";
  if (semanticSource.includes("hero") || semanticSource.includes("banner") || semanticSource.includes("brand-story")) return "hero_banner";
  if (semanticSource.includes("lifestyle") || semanticSource.includes("scene") || semanticSource.includes("usage") || semanticSource.includes("use") || semanticSource.includes("vida") || semanticSource.includes("uso")) return "lifestyle";
  if (semanticSource.includes("info") || semanticSource.includes("feature") || semanticSource.includes("benefit") || semanticSource.includes("aplus") || semanticSource.includes("plus") || semanticSource.includes("module")) return "infographic";
  if (semanticSource.includes("detail") || semanticSource.includes("spec") || semanticSource.includes("size") || semanticSource.includes("dimension") || semanticSource.includes("material")) return "details_specs";
  if (semanticSource.includes("white") || semanticSource.includes("main") || semanticSource.includes("primary") || semanticSource.includes("principal")) return "white_main";
  if (typeSource === "main-image") return "white_main";
  if (typeSource === "detail-page-image") return "supporting";
  return "supporting";
}

const SLOT_ROLE_ALIASES = {
  white_main: ["white_main", "supporting"],
  lifestyle: ["lifestyle", "hero_banner", "supporting"],
  infographic: ["infographic", "core_features", "supporting"],
  details_specs: ["details_specs", "supporting"],
  comparison: ["comparison", "comparison_chart", "supporting"],
  hero_banner: ["hero_banner", "lifestyle", "supporting"],
  core_features: ["core_features", "infographic", "supporting"],
  lifestyle_usage: ["lifestyle_usage", "lifestyle", "supporting"],
  faq: ["faq", "details_specs", "supporting"],
  comparison_chart: ["comparison_chart", "comparison", "supporting"]
};

function normalizedRole(value = "") {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function analysisRole(analysis = {}) {
  return normalizedRole(analysis.image_role || analysis.inferred_type || analysis.role || "");
}

function unitMatchesSlot(unit = {}, analysis = {}, slot = {}) {
  const role = analysisRole(analysis) || normalizedRole(unit.inferred_type);
  const aliases = SLOT_ROLE_ALIASES[slot.role] || [slot.role];
  return aliases.includes(role);
}

function scoreUnitForSlot(unit = {}, analysis = {}, slot = {}, market = "") {
  let score = 0;
  if (unit.market === market) score += 20;
  if (unit.section === slot.section) score += 12;
  if (unitMatchesSlot(unit, analysis, slot)) score += 10;
  if (normalizedRole(unit.inferred_type) === slot.role || analysisRole(analysis) === slot.role) score += 8;
  score += Math.min(Number(unit.score || 0), 6);
  score -= Number(unit.id?.replace(/\D/g, "") || 0) * 0.01;
  return score;
}

function compactImageAnalysis(analysis = {}) {
  const takeaways = Array.isArray(analysis.takeaways) ? analysis.takeaways : analysis.prompt_takeaways;
  const copyPoints = Array.isArray(analysis.copy_points) ? analysis.copy_points : analysis.claims_or_copy;
  return {
    unit_id: analysis.unit_id,
    market: analysis.market,
    section: analysis.section,
    image_role: analysis.image_role,
    layout: cleanText(analysis.layout, 420),
    color_style: cleanText(analysis.color_style, 260),
    visual_hierarchy: cleanText(analysis.visual_hierarchy, 360),
    copy_points: Array.isArray(copyPoints) ? copyPoints.slice(0, 5) : [],
    localization_notes: Array.isArray(analysis.localization_notes) ? analysis.localization_notes.slice(0, 5) : [],
    takeaways: Array.isArray(takeaways) ? takeaways.slice(0, 6) : [],
    brand_removal: Array.isArray(analysis.brand_removal) ? analysis.brand_removal.slice(0, 5) : [],
    skipped: Boolean(analysis.skipped),
    reason: analysis.reason || ""
  };
}

function chooseUnitForSlot(imageUnits = [], analyses = {}, slot = {}, market = "us") {
  const candidates = imageUnits
    .filter((unit) => unit.market === market)
    .map((unit) => ({
      unit,
      analysis: analyses[unit.id] || {},
      score: scoreUnitForSlot(unit, analyses[unit.id] || {}, slot, market)
    }))
    .filter((item) => item.unit.section === slot.section || item.score >= 22)
    .sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

function buildPromptSlotEvidence(imageUnits = [], analyses = {}, reviewModifierAnalysis = {}) {
  return IMAGE_PROMPT_SLOTS.map((slot) => {
    const us = chooseUnitForSlot(imageUnits, analyses, slot, "us");
    const br = chooseUnitForSlot(imageUnits, analyses, slot, "brazil");
    const reviewLayer = slot.section === "detail"
      ? reviewModifierAnalysis?.prompt_modifiers?.detail_pages
      : reviewModifierAnalysis?.prompt_modifiers?.main_images;
    return {
      sequence: slot.sequence,
      type: slot.type,
      label: slot.label,
      section: slot.section,
      role: slot.role,
      objective: slot.objective,
      required_us_analysis: slot.us_focus,
      required_brazil_analysis: slot.br_focus,
      us_source: us ? {
        unit_id: us.unit.id,
        source_url: us.unit.source_url,
        image_url: us.unit.image_url,
        page_title: us.unit.page_title,
        inferred_type: us.unit.inferred_type,
        source_position: us.unit.source_position,
        source_area: us.unit.source_area,
        position_confidence: us.unit.position_confidence,
        analysis: compactImageAnalysis(us.analysis)
      } : null,
      brazil_source: br ? {
        unit_id: br.unit.id,
        source_url: br.unit.source_url,
        image_url: br.unit.image_url,
        page_title: br.unit.page_title,
        inferred_type: br.unit.inferred_type,
        source_position: br.unit.source_position,
        source_area: br.unit.source_area,
        position_confidence: br.unit.position_confidence,
        analysis: compactImageAnalysis(br.analysis)
      } : null,
      review_modifier: Array.isArray(reviewLayer) ? reviewLayer.slice(0, 3) : [],
      fallback_rule: "如果某一侧没有对应图片证据，使用同市场同 section 最接近的图片分析；仍缺失时使用平台标准结构，但必须标明证据不足。"
    };
  });
}

function compactSlotEvidenceForModel(promptSlotEvidence = []) {
  return promptSlotEvidence.map((slot) => ({
    sequence: slot.sequence,
    type: slot.type,
    label: slot.label,
    objective: slot.objective,
    us: slot.us_source ? {
      unit_id: slot.us_source.unit_id,
      image_role: slot.us_source.analysis?.image_role || slot.us_source.inferred_type,
      source_position: slot.us_source.source_position,
      position_confidence: slot.us_source.position_confidence,
      layout: slot.us_source.analysis?.layout || "",
      color_style: slot.us_source.analysis?.color_style || "",
      visual_hierarchy: slot.us_source.analysis?.visual_hierarchy || "",
      copy_points: slot.us_source.analysis?.copy_points || [],
      localization_notes: slot.us_source.analysis?.localization_notes || [],
      takeaways: slot.us_source.analysis?.takeaways || []
    } : null,
    br: slot.brazil_source ? {
      unit_id: slot.brazil_source.unit_id,
      image_role: slot.brazil_source.analysis?.image_role || slot.brazil_source.inferred_type,
      source_position: slot.brazil_source.source_position,
      position_confidence: slot.brazil_source.position_confidence,
      layout: slot.brazil_source.analysis?.layout || "",
      color_style: slot.brazil_source.analysis?.color_style || "",
      visual_hierarchy: slot.brazil_source.analysis?.visual_hierarchy || "",
      copy_points: slot.brazil_source.analysis?.copy_points || [],
      localization_notes: slot.brazil_source.analysis?.localization_notes || [],
      takeaways: slot.brazil_source.analysis?.takeaways || []
    } : null,
    review_modifier: slot.review_modifier || []
  }));
}

function imageInventoryFor(scans = []) {
  const inventory = [];
  for (const scan of scans) {
    for (const image of scan.image_candidates || []) {
      inventory.push({
        source_url: scan.url,
        page_title: scan.title,
        image_url: image.src,
        alt: image.alt,
        inferred_type: classifyImageCandidate(image),
        score: image.score
      });
    }
  }
  return inventory.slice(0, 18);
}

function scoreCandidateForSlot(candidate = {}, slot = {}, market = "") {
  let score = 0;
  if (candidate.market === market) score += 40;
  if (candidate.section === slot.section) score += 25;
  const aliases = SLOT_ROLE_ALIASES[slot.role] || [slot.role];
  if (candidate.inferred_type === slot.role) score += 24;
  else if (aliases.includes(candidate.inferred_type)) score += 14;
  if (candidate.section !== slot.section) score -= 20;
  if (candidate.inferred_type === "supporting") score -= 4;
  score += Math.min(Number(candidate.score || 0), 8);
  return score;
}

function pickCandidateForSlot(pool = [], slot = {}, market = "") {
  const candidates = pool
    .filter((item) => item.market === market)
    .map((item) => ({ item, score: scoreCandidateForSlot(item, slot, market) }))
    .filter(({ item, score }) => item.section === slot.section || score >= 42)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.item || null;
}

function buildImageAnalysisUnits(scanResults = []) {
  const pool = [];
  for (const scan of scanResults.map(compactScanResult)) {
    const market = marketBucket(scan);
    for (const image of scan.image_candidates || []) {
      if (!image.src || !/^https?:\/\//i.test(image.src)) continue;
      const isDetail = image.type === "detail-page-image";
      const section = isDetail ? "detail" : "main";
      pool.push({
        market,
        section,
        source_url: scan.url,
        page_title: scan.title,
        page_description: scan.description,
        image_url: image.src,
        image_type: image.type,
        inferred_type: image.inferred_role || classifyImageCandidate(image),
        source_area: image.source_area || section,
        source_position: image.source_position || imagePositionLabel({ area: section, index: image.position_index || pool.length + 1, role: image.inferred_role || classifyImageCandidate(image) }),
        position_index: image.position_index || null,
        source_marker: image.source_marker || null,
        position_confidence: image.position_confidence || "low",
        alt: image.alt,
        scan_scope: scan.scan_scope || null
      });
    }
  }

  const selected = [];
  const seen = new Set();
  const addCandidate = (candidate) => {
    if (!candidate) return;
    const key = `${candidate.market}:${candidate.image_url}`;
    if (seen.has(key)) return;
    seen.add(key);
    selected.push(candidate);
  };

  for (const slot of IMAGE_PROMPT_SLOTS) {
    addCandidate(pickCandidateForSlot(pool, slot, "us"));
    addCandidate(pickCandidateForSlot(pool, slot, "brazil"));
    if (selected.length >= MAX_IMAGE_ANALYSIS_UNITS) break;
  }

  const supportingCandidates = pool
    .map((item) => ({
      item,
      score:
        (item.market === "us" ? 8 : item.market === "brazil" ? 7 : 2) +
        (item.section === "main" ? 5 : 4) +
        (item.inferred_type === "supporting" ? 0 : 3) +
        Math.min(Number(item.score || 0), 8)
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
  for (const candidate of supportingCandidates) {
    if (selected.length >= MAX_IMAGE_ANALYSIS_UNITS) break;
    addCandidate(candidate);
  }

  if (!selected.length) {
    for (const candidate of pool.slice(0, Math.min(MAX_IMAGE_ANALYSIS_UNITS, 6))) addCandidate(candidate);
  }

  return selected.slice(0, MAX_IMAGE_ANALYSIS_UNITS).map((unit, index) => ({
    id: `img_${index + 1}`,
    ...unit
  }));
}

function buildSingleImageAnalysisPrompt({ unit, product }) {
  const marketRole = unit.market === "brazil"
    ? "巴西链接只做本土化分析：葡语表达、当地场景、信任点、消费者关注点。"
    : "美国链接是主要设计方向：构图、版式、风格、色彩、信息层级、包装/外观参考。";
  const typeGuide = unit.section === "detail"
    ? `按详情页模块归类：${DETAIL_MODULE_TYPES.join(", ")}。`
    : `按商品图类型归类：${LISTING_IMAGE_TYPES.join(", ")}。`;
  return [
    "任务：只分析这一张采集图片，不要分析其它图片，不要输出长文。",
    marketRole,
    typeGuide,
    "必须完整记录：设计架构、画面版式、色彩系统、光影/质感、产品/包装呈现方式、视觉层级、文字/卖点表达、情绪场景、可复刻方向、必须去除的品牌/IP 元素。",
    "必须先参考 unit.source_position、unit.source_area、unit.position_confidence 判断这张图在页面中的位置；如果位置不确定，在 localization_notes 或 takeaways 中明确写“位置不确定”。",
    "不要分析 review，不要使用评价数据；本任务只处理这张图片本身。",
    "上传产品图仍是最终产品外观唯一基准；这张竞品图只提供风格、结构和内容方向。",
    "输出 JSON：{unit_id,market,section,image_role,layout,color_style,visual_hierarchy,claims_or_copy:[最多5条],localization_notes:[最多5条],takeaways:[最多6条],brand_removal:[最多5条]}。",
    JSON.stringify({ product: compactProduct(product), unit })
  ].join("\n");
}

function buildReviewModifierPrompt({ reviewEvidence, product }) {
  return [
    "任务：只分析 review 信号；使用 ChatGPT gpt-5.5 对整体 review 数据做结构化分析，再把结论变成最终图片提示词的修饰层。不要分析图片，不要改变产品外观。",
    "必须把 review_evidence.overall_review_data、各链接 review_insights.snippets、rating、review_count、positive_terms、negative_terms、scene_terms 作为整体 review 数据一起分析；不要只做关键词罗列。",
    "Review 权重低于上传产品图和美国链接图片结构；只能用于：卖点措辞校准、巴西葡语自然表达、真实使用场景、差评预防、竞品弱点补充。",
    "输出 JSON：{analysis_method,review_summary,sentiment_breakdown:{positive:[最多8条],negative:[最多8条],neutral:[最多6条]},customer_pain_points:[最多8条],purchase_barriers:[最多8条],customer_language_examples:[最多8条],high_frequency_praise:[最多8条],high_frequency_complaints:[最多8条],local_language:[最多12个],usage_scenarios:[最多8条],competitor_weaknesses:[最多8条],prompt_modifiers:{main_images:[最多8条],detail_pages:[最多8条],negative_constraints:[最多6条]},evidence_summary:{source_count,snippet_count,rating_average,review_count_total},source_note}。",
    "review_summary 必须是模型对整体 review 的具体结论；customer_pain_points 和 purchase_barriers 必须来自 review 原文/评分/评论数综合判断；customer_language_examples 必须保留用户原话或贴近原文的短句。",
    JSON.stringify({ product: compactProduct(product), review_evidence: reviewEvidence })
  ].join("\n");
}

function buildSynthesisPrompt(payload, analyses, imageUnits = [], reviewModifierAnalysis = {}, promptSlotEvidence = []) {
  return [
    "任务：按固定 11 张图的顺序，逐张合成最终可编辑图生图提示词。不要重新分析原始链接，不要再请求观察其它图片。",
    "核心流程必须逐张执行：每一张图 = 该槽位的美国图片分析作为主要设计结构 + 如果存在巴西图片分析则只作为本土化落地 + Review Modifier 作为最后文案/痛点修饰。",
    "每张采集图都有 source_position/source_area/position_confidence，必须用这些字段确认它是主图图库第几张、详情页/A+ 第几张或具体模块位置；禁止把未知位置图片说成已确认模块。",
    "美国链接权重：决定设计结构、图片架构、风格、色彩、构图、包装/外观参考、表达框架。",
    "巴西链接权重：只决定葡语表达、本土使用场景、信任点、消费者语境和本土化优化。",
    "如果没有上传或没有采集到 brazil_source，必须明确写：巴西对应图片未采集到，本图直接按美国链接图片结构、版式和风格生成；只做必要葡语表达，不虚构任何巴西图片证据。",
    "Review 权重：低于上传产品图和链接图片结构，只能修饰高频好评点、差评预防、真实使用场景和自然葡语，不能改变产品外观或图片结构。",
    "上传产品图权重最高：最终生成必须以用户上传产品图为唯一产品外观基准；美国/巴西链接只能参考结构、版式、风格、场景、信息层级和文案方向，不能改变产品形状、颜色、包装、配件或可见细节；必须去品牌化。",
    "每条 prompt 必须是图生图指令，并明确：使用上传产品图作为基础产品输入；每次只生成一张独立图片；禁止拼图/四宫格；禁止竞品 logo、品牌名、商标、水印、平台 logo。",
    "输出 JSON 字段：",
    "workflow_analysis: {us_main,br_main,us_detail,br_detail,optimization_logic}",
    "review_insights: 直接整理 review_modifier_analysis，说明它如何修饰最终提示词。",
    "link_analysis: 最多6项短证据摘要，必须说明美国图负责设计、巴西图负责本土化。",
    "main_image_plan: 按顺序包含 white_main,brazil_scene,portuguese_infographic,dimension_detail,advantage_comparison。",
    "detail_page_plan: 按顺序包含 detail_hero_banner,detail_core_features,detail_lifestyle,detail_technical_specs,detail_faq,detail_product_line_comparison。",
    "keywords: {auto: 最多8个, manual: 用户人工词, final: 最多10个}。",
    "image_prompts: 必须刚好 11 条，顺序和 prompt_slots 完全一致；字段 {sequence,type,label,source_logic,us_source_unit,brazil_source_unit,br_localization,review_modifier,prompt}。",
    "每条 source_logic 必须说明：先分析哪个 source_position 的美国图/美国模块，提取了什么设计结构；如有巴西图，再说明哪个 source_position 的巴西图如何本土化；如无巴西图，必须写明未采集到巴西对应图片并直接按美国链接生成。",
    "每条 prompt 可以较完整，优先准确性而不是省 token：必须写清楚图生图、上传产品图基准、美国图设计结构、无巴西图时直接参考美国链接、Review 修饰、去品牌化、单张独立图、构图/色彩/文字/场景/细节要求。",
    "detail_page: {title_pt_br, bullets_pt_br: 5条以内, description_pt_br: 180字以内, faq_pt_br: 2条以内, platform_notes: 3条以内}。",
    "compliance_notes: 最多4条。",
    "usage_note: 一句话。",
    JSON.stringify({
      product: compactProduct(payload.product || {}),
      platform: payload.platform,
      assets: payload.assets,
      constraints: payload.constraints,
      prompt_pack: payload.prompts,
      prompt_slots: compactSlotEvidenceForModel(promptSlotEvidence),
      review_modifier_analysis: reviewModifierAnalysis
    })
  ].join("\n");
}

function fallbackPromptForSlot(slot, evidence = {}) {
  const usText = evidence.us_source
    ? `美国证据 ${evidence.us_source.unit_id}（${evidence.us_source.source_position || "位置未标注"}）：${(evidence.us_source.analysis?.takeaways || []).join("；") || evidence.us_source.inferred_type}`
    : "美国同类图证据不足，使用平台标准高转化结构。";
  const brText = evidence.brazil_source
    ? `巴西证据 ${evidence.brazil_source.unit_id}（${evidence.brazil_source.source_position || "位置未标注"}）：${(evidence.brazil_source.analysis?.takeaways || []).join("；") || evidence.brazil_source.inferred_type}`
    : "巴西对应图片未采集到：本图直接按美国链接图片结构、版式和风格生成，只做必要葡语表达，不虚构巴西图片证据。";
  const reviewText = Array.isArray(evidence.review_modifier) && evidence.review_modifier.length
    ? `Review 修饰：${evidence.review_modifier.join("；")}。`
    : "Review 修饰：只补充真实痛点、自然葡语和差评预防。";
  return `图生图：上传产品图是唯一产品外观基准。${slot.objective}${usText}${brText}${reviewText}参考链接图片的结构、版式、风格、场景和信息层级，但不得改变上传产品图中的产品形状、颜色、包装、配件或可见细节；去除 logo、品牌名、商标、水印；只生成一张独立图片。`;
}

function buildFallbackImagePrompts(promptSlotEvidence = []) {
  return promptSlotEvidence.map((evidence) => {
    const slot = IMAGE_PROMPT_SLOTS.find((item) => item.sequence === evidence.sequence) || evidence;
    return {
      sequence: slot.sequence,
      type: slot.type,
      label: slot.label,
      source_logic: evidence.us_source
        ? `先用美国链接 ${evidence.us_source.unit_id}（${evidence.us_source.source_position || "位置未标注"}）提取 ${slot.us_focus}`
        : `美国同类图不足，按 ${slot.us_focus} 的平台标准结构生成。`,
      us_source_unit: evidence.us_source?.unit_id || null,
      brazil_source_unit: evidence.brazil_source?.unit_id || null,
      br_localization: evidence.brazil_source
        ? `再用巴西链接 ${evidence.brazil_source.unit_id}（${evidence.brazil_source.source_position || "位置未标注"}）校准 ${slot.br_focus}`
        : `巴西对应图片未采集到，直接按美国链接的图片结构、版式和风格生成；只保留必要葡语表达，不使用或虚构巴西图片证据。`,
      review_modifier: evidence.review_modifier || [],
      prompt: fallbackPromptForSlot(slot, evidence)
    };
  });
}

function normalizeSynthesisPromptSlots(result = {}, promptSlotEvidence = []) {
  const bySequence = new Map();
  const byType = new Map();
  for (const item of Array.isArray(result.image_prompts) ? result.image_prompts : []) {
    if (Number(item?.sequence)) bySequence.set(Number(item.sequence), item);
    if (item?.type) byType.set(String(item.type), item);
  }
  const fallbackPrompts = buildFallbackImagePrompts(promptSlotEvidence);
  const normalizedPrompts = promptSlotEvidence.map((evidence, index) => {
    const slot = IMAGE_PROMPT_SLOTS[index] || evidence;
    const fallback = fallbackPrompts[index] || {};
    const modelItem = bySequence.get(slot.sequence) || byType.get(slot.type) || {};
    return {
      sequence: slot.sequence,
      type: slot.type,
      label: slot.label,
      source_logic: cleanText(modelItem.source_logic || fallback.source_logic, 420),
      us_source_unit: modelItem.us_source_unit || fallback.us_source_unit || evidence.us_source?.unit_id || null,
      brazil_source_unit: modelItem.brazil_source_unit || fallback.brazil_source_unit || evidence.brazil_source?.unit_id || null,
      br_localization: cleanText(modelItem.br_localization || fallback.br_localization, 320),
      review_modifier: Array.isArray(modelItem.review_modifier)
        ? modelItem.review_modifier.slice(0, 4)
        : fallback.review_modifier || [],
      prompt: cleanText(modelItem.prompt || fallback.prompt, 1200)
    };
  });
  return {
    ...result,
    prompt_slot_evidence: promptSlotEvidence,
    main_image_plan: normalizedPrompts.slice(0, 5).map((item) => item.type),
    detail_page_plan: normalizedPrompts.slice(5).map((item) => item.type),
    image_prompts: normalizedPrompts
  };
}

function fallbackSegmentedResult(payload, analysisFlow, analysisMeta, imageUnits = [], reviewModifierAnalysis = null, promptSlotEvidence = null) {
  const product = compactProduct(payload.product || {});
  const manual = product.manual_keyword_overrides ? product.manual_keyword_overrides.split(/[,，\s]+/).filter(Boolean) : [];
  const auto = [
    product.name,
    "produto leve",
    "produto durável",
    "uso diário",
    "prático",
    "resistente"
  ].filter(Boolean).slice(0, 8);
  const promptEvidence = promptSlotEvidence || buildPromptSlotEvidence(imageUnits, analysisFlow || {}, reviewModifierAnalysis || fallbackReviewModifierAnalysis(buildReviewModifierEvidence(payload.link_scan_results || [])));
  const imagePrompts = buildFallbackImagePrompts(promptEvidence);

  return {
    analysis_flow: analysisFlow,
    analysis_meta: analysisMeta,
    image_analysis_units: imageUnits,
    image_analysis_results: Object.values(analysisFlow || {}),
    image_analysis_meta: {
      mode: "one-image-per-model-call",
      unit_count: imageUnits.length,
      completed_count: Object.values(analysisFlow || {}).filter((item) => !item?.skipped).length,
      stopped_by_budget: false,
      budget_ms: IMAGE_ANALYSIS_BUDGET_MS
    },
    prompt_slot_evidence: promptEvidence,
    workflow_analysis: {
      us_main: "无美国链接证据，使用通用商品图结构。",
      br_main: "无巴西链接证据，直接按美国链接主图结构、版式和风格生成。",
      us_detail: "无美国详情页证据，使用标准 A+ 模块结构。",
      br_detail: "无巴西详情页证据，直接按美国详情页结构、版式和风格生成。",
      optimization_logic: "链接采集结果会被拆成单图分析任务：美国图给设计结构；只有存在巴西图时才做本土化参考；全程禁止改变上传产品外观和使用竞品 logo、商标、品牌名。"
    },
    review_modifier_analysis: reviewModifierAnalysis || fallbackReviewModifierAnalysis(buildReviewModifierEvidence(payload.link_scan_results || [])),
    review_insights: reviewModifierAnalysis || fallbackReviewModifierAnalysis(buildReviewModifierEvidence(payload.link_scan_results || [])),
    link_analysis: [],
    main_image_plan: LISTING_IMAGE_TYPES,
    detail_page_plan: DETAIL_MODULE_TYPES,
    keywords: { auto, manual, final: Array.from(new Set([...manual, ...auto])).slice(0, 10) },
    image_prompts: imagePrompts,
    detail_page: {
      title_pt_br: product.name || "Produto prático para uso diário",
      bullets_pt_br: ["Visual fiel ao produto real.", "Ideal para uso diário.", "Design prático e resistente.", "Conteúdo claro e objetivo.", "Fotos pensadas para marketplace."],
      description_pt_br: "Página otimizada para apresentar o produto com imagens claras, benefícios diretos e linguagem adequada ao consumidor brasileiro.",
      faq_pt_br: ["Como usar? Siga as instruções do produto.", "O que vem incluso? Consulte as imagens e descrição do anúncio."],
      platform_notes: ["Evitar claims sem comprovação.", "Não usar logos de plataforma.", "Manter texto curto e legível."]
    },
    compliance_notes: ["Não inventar certificações.", "Não copiar marca concorrente.", "Não alterar aparência do produto.", "Evitar promessas absolutas."],
    usage_note: "Adequado para Amazon, Mercado Livre, TikTok Shop e Shopee com ajustes de dimensão."
  };
}

function buildModelBody({ model, messages, includeReasoning = true, maxTokens = DEFAULT_MAX_COMPLETION_TOKENS }) {
  const body = {
    model,
    messages,
    response_format: { type: "json_object" },
    max_tokens: Number(maxTokens)
  };

  if (includeReasoning) {
    body.reasoning_effort = process.env.OPENAI_REASONING_EFFORT || "high";
  }

  return body;
}

function isUnsupportedReasoningError(response, data) {
  if (response.ok) return false;
  const message = String(data?.error?.message || data?.message || data?.rawText || "").toLowerCase();
  return (
    response.status === 400 &&
    (message.includes("reasoning_effort") ||
      message.includes("unsupported parameter") ||
      message.includes("unknown parameter") ||
      message.includes("unrecognized request argument"))
  );
}

function isUnsupportedMaxTokensError(response, data) {
  if (response.ok) return false;
  const message = String(data?.error?.message || data?.message || data?.rawText || "").toLowerCase();
  return (
    response.status === 400 &&
    (message.includes("max_tokens") ||
      message.includes("max_completion_tokens") ||
      message.includes("unsupported parameter") ||
      message.includes("unknown parameter") ||
      message.includes("unrecognized request argument"))
  );
}

async function requestModelWithFallback({ baseUrl, apiKey, model, messages, maxTokens = DEFAULT_MAX_COMPLETION_TOKENS }) {
  const url = `${baseUrl}/chat/completions`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
  const request = (body) =>
    fetchModelJson(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

  let usedReasoningEffort = process.env.OPENAI_REASONING_EFFORT || "high";
  let usedMaxTokens = Number(maxTokens);
  let body = buildModelBody({ model, messages, includeReasoning: true, maxTokens });
  let result = await request(body);

  if (isUnsupportedMaxTokensError(result.response, result.data)) {
    body = { ...body };
    delete body.max_tokens;
    usedMaxTokens = null;
    result = await request(body);
  }

  if (isUnsupportedReasoningError(result.response, result.data)) {
    body = buildModelBody({ model, messages, includeReasoning: false, maxTokens });
    if (usedMaxTokens === null) delete body.max_tokens;
    result = await request(body);
    usedReasoningEffort = "provider-unsupported";
  }

  return { ...result, usedReasoningEffort, usedMaxTokens };
}

function buildUserMessage(prompt, imageUrls = []) {
  const images = imageUrls.filter(Boolean).slice(0, STEP_IMAGE_LIMIT);
  if (!images.length) return { role: "user", content: prompt };
  return {
    role: "user",
    content: [
      { type: "text", text: prompt },
      ...images.map((url) => ({ type: "image_url", image_url: { url } }))
    ]
  };
}

function isUnsupportedVisionError(response, data) {
  if (response.ok) return false;
  const message = String(data?.error?.message || data?.message || data?.rawText || "").toLowerCase();
  return (
    response.status === 400 &&
    (message.includes("image_url") ||
      message.includes("content") ||
      message.includes("multi-modal") ||
      message.includes("multimodal") ||
      message.includes("vision") ||
      message.includes("unsupported"))
  );
}

async function runJsonTask({ baseUrl, apiKey, model, prompt, maxTokens, imageUrls = [] }) {
  const result = await requestModelWithFallback({
    baseUrl,
    apiKey,
    model,
    maxTokens,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      buildUserMessage(prompt, imageUrls)
    ]
  });

  if (!result.response.ok && imageUrls.length && isUnsupportedVisionError(result.response, result.data)) {
    return runJsonTask({ baseUrl, apiKey, model, prompt, maxTokens, imageUrls: [] });
  }

  if (!result.response.ok) {
    const error = new Error(result.data?.error?.message || result.data?.message || result.data?.rawText || "The model provider returned an error.");
    error.statusCode = result.response.status;
    error.details = result.data;
    throw error;
  }

  const text = extractText(result.data);
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  return {
    result: parsed && typeof parsed === "object" ? parsed : { rawText: text },
    usage: result.data.usage || null,
    reasoning_effort: result.usedReasoningEffort,
    max_tokens: result.usedMaxTokens
  };
}

function sumUsage(usages = []) {
  return usages.filter(Boolean).reduce((total, usage) => ({
    prompt_tokens: Number(total.prompt_tokens || 0) + Number(usage.prompt_tokens || 0),
    completion_tokens: Number(total.completion_tokens || 0) + Number(usage.completion_tokens || 0),
    total_tokens: Number(total.total_tokens || 0) + Number(usage.total_tokens || 0)
  }), {});
}

async function runSegmentedAnalysis({ baseUrl, apiKey, model, payload }) {
  const product = payload.product || {};
  const imageUnits = buildImageAnalysisUnits(payload.link_scan_results || []);
  const reviewEvidence = buildReviewModifierEvidence(payload.link_scan_results || []);
  let reviewModifierAnalysis = fallbackReviewModifierAnalysis(reviewEvidence);
  let reviewModifierMeta = {
    usage: null,
    reasoning_effort: "fallback",
    max_tokens: 0
  };
  const settled = [];
  const analysisStartedAt = Date.now();
  let stoppedByBudget = false;
  const runUnit = async (unit) => {
    try {
      const value = await runJsonTask({
        baseUrl,
        apiKey,
        model,
        prompt: buildSingleImageAnalysisPrompt({ unit, product }),
        maxTokens: 700,
        imageUrls: [unit.image_url]
      });
      settled.push([unit.id, value]);
      return value.result;
    } catch (error) {
      const fallback = {
        result: {
          unit_id: unit.id,
          market: unit.market,
          section: unit.section,
          image_url: unit.image_url,
          image_role: unit.inferred_type,
          error: error.message,
          takeaways: [
            unit.market === "brazil" ? "使用巴西本土语言和场景做本地化参考。" : "使用美国链接图片作为设计结构和视觉风格参考。",
            unit.section === "detail" ? "参考详情页模块信息层级。" : "参考商品图构图和卖点表达。",
            "必须去除竞品 logo、品牌名、商标和水印。"
          ]
        },
        usage: null,
        reasoning_effort: process.env.OPENAI_REASONING_EFFORT || "high",
        max_tokens: 700
      };
      settled.push([unit.id, fallback]);
      return fallback.result;
    }
  };

  let nextUnitIndex = 0;
  const markBudgetSkipped = (unit) => {
    stoppedByBudget = true;
    settled.push([unit.id, {
      result: {
        unit_id: unit.id,
        market: unit.market,
        section: unit.section,
        image_url: unit.image_url,
        image_role: unit.inferred_type,
        skipped: true,
        reason: "image-analysis-budget-exceeded",
        takeaways: [
          unit.market === "brazil" ? "待分析：巴西本土化参考图。" : "待分析：美国设计结构参考图。",
          "接口先返回已完成分析，避免浏览器/Nginx 长请求断开。"
        ]
      },
      usage: null,
      reasoning_effort: "skipped-budget",
      max_tokens: 0
    }]);
  };
  const worker = async () => {
    while (nextUnitIndex < imageUnits.length) {
      const unit = imageUnits[nextUnitIndex];
      nextUnitIndex += 1;
      if (Date.now() - analysisStartedAt > IMAGE_ANALYSIS_BUDGET_MS) {
        markBudgetSkipped(unit);
        continue;
      }
      await runUnit(unit);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(IMAGE_ANALYSIS_CONCURRENCY, Math.max(1, imageUnits.length)) }, () => worker())
  );

  const analyses = Object.fromEntries(settled.map(([key, value]) => [key, value.result]));
  const analysisMeta = Object.fromEntries(settled.map(([key, value]) => [key, {
    usage: value.usage,
    reasoning_effort: value.reasoning_effort,
    max_tokens: value.max_tokens
  }]));

  if ([...reviewEvidence.us, ...reviewEvidence.brazil, ...reviewEvidence.other].length) {
    try {
      const reviewResult = await runJsonTask({
        baseUrl,
        apiKey,
        model,
        prompt: buildReviewModifierPrompt({ reviewEvidence, product }),
        maxTokens: REVIEW_ANALYSIS_BUDGET_TOKENS,
        imageUrls: []
      });
      reviewModifierAnalysis = reviewResult.result;
      reviewModifierMeta = {
        usage: reviewResult.usage,
        reasoning_effort: reviewResult.reasoning_effort,
        max_tokens: reviewResult.max_tokens
      };
    } catch (error) {
      reviewModifierAnalysis = {
        ...reviewModifierAnalysis,
        error: cleanText(error.message, 220),
        source_note: `${reviewModifierAnalysis.source_note || ""} Review 模型分析失败，已使用规则降级结果。`
      };
    }
  }

  if (!imageUnits.length) {
    const promptSlotEvidence = buildPromptSlotEvidence(imageUnits, analyses, reviewModifierAnalysis);
    const fallback = fallbackSegmentedResult(payload, analyses, analysisMeta, imageUnits, reviewModifierAnalysis, promptSlotEvidence);
    return {
      result: {
        ...fallback,
        review_modifier_analysis: reviewModifierAnalysis,
        review_modifier_meta: reviewModifierMeta,
        review_insights: reviewModifierAnalysis
      },
      usage: sumUsage([reviewModifierMeta.usage]),
      reasoning_effort: reviewModifierMeta.reasoning_effort,
      max_tokens: reviewModifierMeta.max_tokens
    };
  }

  const promptSlotEvidence = buildPromptSlotEvidence(imageUnits, analyses, reviewModifierAnalysis);
  let synthesis;
  try {
    synthesis = await runJsonTask({
      baseUrl,
      apiKey,
      model,
      prompt: buildSynthesisPrompt(payload, analyses, imageUnits, reviewModifierAnalysis, promptSlotEvidence),
      maxTokens: Number(process.env.OPENAI_MAX_COMPLETION_TOKENS || DEFAULT_SYNTHESIS_MAX_TOKENS)
    });
  } catch (error) {
    const fallback = fallbackSegmentedResult(payload, analyses, analysisMeta, imageUnits, reviewModifierAnalysis, promptSlotEvidence);
    fallback.workflow_analysis.optimization_logic = `模型综合阶段超时或失败，已保留 Bright Data 链接扫描证据并生成可编辑提示词草稿。失败原因：${cleanText(error.message, 180)}`;
    fallback.usage_note = "本次使用扫描证据降级生成，建议先人工检查最终提示词，再继续逐张生图。";
    return {
      result: fallback,
      usage: sumUsage([...settled.map(([, value]) => value.usage), reviewModifierMeta.usage]),
      reasoning_effort: "fallback-after-synthesis-failure",
      max_tokens: 0,
      degraded: true
    };
  }

  return {
    result: {
      analysis_flow: analyses,
      analysis_meta: analysisMeta,
      image_analysis_units: imageUnits,
      image_analysis_results: Object.values(analyses),
      review_modifier_analysis: reviewModifierAnalysis,
      review_modifier_meta: reviewModifierMeta,
      prompt_slot_evidence: promptSlotEvidence,
      image_analysis_meta: {
        mode: "one-image-per-model-call",
        unit_count: imageUnits.length,
        completed_count: settled.filter(([, value]) => !value.result?.skipped).length,
        stopped_by_budget: stoppedByBudget,
        budget_ms: IMAGE_ANALYSIS_BUDGET_MS
      },
      ...normalizeSynthesisPromptSlots(synthesis.result, promptSlotEvidence)
    },
    usage: sumUsage([...settled.map(([, value]) => value.usage), reviewModifierMeta.usage, synthesis.usage]),
    reasoning_effort: synthesis.reasoning_effort,
    max_tokens: synthesis.max_tokens,
    degraded: false
  };
}

async function fetchModelJson(url, options) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const rawText = await response.text().catch(() => "");
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { rawText };
    }
    return { response, data, rawText };
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("模型接口超时：上游模型在 120 秒内没有返回，请稍后重试或检查 OPENAI_BASE_URL / 模型名称。");
      timeoutError.code = "MODEL_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function runGenerateWorkflow({ payload, token = "", requestId = `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, onProgress = () => {} }) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "http://154.64.230.35:3000/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.5";
  const startedAt = Date.now();
  let stage = "init";
  const logGenerate = (event, extra = {}) => {
    console.log(JSON.stringify({
      event,
      request_id: requestId,
      stage,
      elapsed_ms: Date.now() - startedAt,
      ...extra
    }));
  };

  if (!apiKey) {
    const error = new Error("Set OPENAI_API_KEY in your deployment environment.");
    error.code = "OPENAI_API_KEY_MISSING";
    throw error;
  }

  stage = "link_scan";
  onProgress({ status: "running", stage, progress: 15, message: process.env.BRIGHTDATA_API_KEY ? "正在强制通过 Bright Data 扫描主图、详情页图片和 review..." : "正在扫描主图、详情页图片和 review..." });
  logGenerate("generate_start", {
    source_url_count: Array.isArray(payload?.product?.source_urls) ? payload.product.source_urls.length : 0,
    platform: payload?.platform_key || payload?.platform || ""
  });
  payload.link_scan_results = await scanProductLinks(payload);
  logGenerate("generate_stage_complete", {
    completed_stage: "link_scan",
    scan_count: payload.link_scan_results.length,
    scan_ok_count: payload.link_scan_results.filter((scan) => scan.ok).length,
    scanners: Array.from(new Set(payload.link_scan_results.map((scan) => scan.scanner).filter(Boolean)))
  });

  stage = "account_lookup";
  onProgress({ status: "running", stage, progress: 35, message: "链接扫描完成，正在准备账号与模型分析..." });
  const account = await getAccountByToken(token).catch(() => null);

  stage = "model_analysis";
  onProgress({ status: "running", stage, progress: 45, message: "正在逐张分析采集图片，并独立分析 Review Modifier..." });
  const analysis = await runSegmentedAnalysis({
    baseUrl,
    apiKey,
    model,
    payload
  });
  logGenerate("generate_stage_complete", {
    completed_stage: "model_analysis",
    total_tokens: Number(analysis.usage?.total_tokens || 0),
    reasoning_effort: analysis.reasoning_effort
  });

  let updatedAccount = account;
  if (account) {
    stage = "usage_log";
    onProgress({ status: "running", stage, progress: 90, message: "模型分析完成，正在记录账号用量..." });
    const units = Number(payload?.usage_estimate?.units || 1);
    const tokens = Number(analysis.usage?.total_tokens || payload?.usage_estimate?.tokens || 0);
    await supabaseRequest("usage_logs", {
      method: "POST",
      body: JSON.stringify({
        account_id: account.id,
        type: "generate",
        action: payload?.product?.name ? `生成 ${payload.product.name}` : "生成商品方案",
        platform: payload?.platform_key || payload?.platform || "all",
        model: "openai",
        units,
        tokens,
        success: true,
        metadata: {
          provider_model: model,
          product: payload?.product,
          usage: analysis.usage || null,
          workflow: "background_segmented_link_analysis"
        }
      })
    });
    stage = "account_quota_update";
    const rows = await supabaseRequest(`accounts?id=${filter(account.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ used: Math.min(Number(account.quota || 0), Number(account.used || 0) + units) })
    });
    updatedAccount = rows[0] || account;
  }

  logGenerate("generate_success", {
    model,
    total_tokens: Number(analysis.usage?.total_tokens || 0)
  });
  return {
    ok: true,
    request_id: requestId,
    degraded: Boolean(analysis.degraded),
    model,
    reasoning_effort: analysis.reasoning_effort,
    max_tokens: analysis.max_tokens,
    usage: analysis.usage || null,
    account: publicAccount(updatedAccount),
    result: { ...analysis.result, link_scan_results: payload.link_scan_results },
    rawText: ""
  };
}

function buildSystemPrompt() {
  return [
    "You are VISION BRZAZIL's fast ecommerce link-analysis engine.",
    "Prioritize speed and evidence density. Produce concise minified JSON; avoid long prose, repeated explanations, markdown, and decorative language.",
    "Before creating prompts, use the provided link_scan_results as observed evidence from downloaded product pages. Treat image_candidates, alt text, headings, descriptions, and page text as the concrete scan of product main images and detail-page assets.",
    "Use this fixed order: US links define design logic; Brazil links define local language, scenarios, trust signals, and marketplace expectations.",
    "Do not deeply reason beyond provided evidence. Infer compactly when evidence is limited.",
    "Uploaded product images are the only product-appearance truth for image-to-image generation. Never let competitor URLs change the product shape, color, packaging, accessories, or visible details.",
    "Return Chinese operational notes plus Brazilian Portuguese listing copy.",
    "Never invent unsupported certifications, medical claims, fake discounts, platform logos, or guarantees."
  ].join(" ");
}

function buildUserPrompt(payload) {
  return [
    "请基于以下资料生成结构化方案：",
    "",
    JSON.stringify(
      {
        locale: payload.locale || "pt-BR",
        market: payload.market || "Brazil",
        account: payload.account,
        platform: payload.platform,
        product: compactProduct(payload.product || {}),
        link_scan_results: Array.isArray(payload.link_scan_results) ? payload.link_scan_results.map(compactScanResult) : [],
        assets: payload.assets,
        constraints: payload.constraints,
        prompt_pack: payload.prompts
      },
      null,
      2
    ),
    "",
    "输出 JSON，字段必须包含：",
    "速度要求：只返回压缩 JSON，不要 markdown，不要解释过程。",
    "link_analysis: 最多6项；每项 {market,url,title,design_evidence:[最多2条],content_evidence:[最多2条],image_evidence:[最多2条]}。",
    "us_visual_deconstruction: 最多4条短句，记录设计架构、模块顺序、风格、色彩、转化逻辑。",
    "br_visual_deconstruction: 最多4条短句，记录本土语言、场景、信任要素、消费者关注点。",
    "localization_map: 最多4条短句，说明美国设计逻辑如何映射到巴西内容。",
    "keywords: {auto: 最多8个, manual: 用户人工词, final: 最多10个}。",
    "final_prompt_strategy: 最多4条短句，强调上传图是唯一产品外观基准；链接只参考结构、版式、风格、场景和信息层级；不得改变产品形状、颜色、包装、配件或可见细节；必须去品牌化。",
    "image_prompts: 必须按固定顺序生成 11 条可编辑图生图提示词：白底主图、巴西场景图、葡语卖点信息图、尺寸细节图、优势对比图、详情页 Hero、核心卖点、生活方式、细节技术说明、FAQ、产品线对比。",
    "detail_page: {title_pt_br, bullets_pt_br: 5条以内且每条20词以内, description_pt_br: 180字以内, faq_pt_br: 2条以内, platform_notes: 3条以内}。",
    "compliance_notes: 最多4条。",
    "usage_note: 一句话说明适合哪些平台。"
  ].join("\n");
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  const requestId = `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  let stage = "init";

  try {
    stage = "read_request";
    const payload = await readJson(req);
    const result = await runGenerateWorkflow({
      payload,
      token: getBearerToken(req),
      requestId,
      onProgress: (progress) => {
        stage = progress.stage || stage;
      }
    });
    return sendJson(res, 200, result);
  } catch (error) {
    const isTimeout = error.code === "MODEL_TIMEOUT";
    const isProviderError = Number(error.statusCode || 0) >= 400;
    return sendJson(res, isTimeout ? 504 : (isProviderError ? error.statusCode : 500), {
      error: isTimeout ? "MODEL_TIMEOUT" : (isProviderError ? "MODEL_REQUEST_FAILED" : "GENERATE_FAILED"),
      message: error.message || "生成接口失败，但没有返回具体错误信息。",
      stage,
      request_id: requestId,
      details: {
        name: error.name || "",
        code: error.code || "",
        status_code: error.statusCode || null,
        provider_error: error.details || null
      }
    });
  }
};

module.exports.runGenerateWorkflow = runGenerateWorkflow;
module.exports.scanProductLink = scanProductLink;
module.exports.scanProductLinks = scanProductLinks;
if (process.env.NODE_ENV === "test") {
  module.exports.__test = {
    extractReviewInsights
  };
}
