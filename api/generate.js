const { getAccountByToken, publicAccount } = require("./_lib/auth");
const { getBearerToken, handleOptions, readJson, sendJson } = require("./_lib/http");
const { filter, supabaseRequest } = require("./_lib/supabase");

const MODEL_TIMEOUT_MS = 120000;
const LINK_SCAN_TIMEOUT_MS = 6000;
const MAX_SCAN_LINKS = 6;
const MAX_IMAGE_CANDIDATES = 8;
const MAX_HEADINGS = 10;
const PAGE_TEXT_SAMPLE_LENGTH = 900;
const DEFAULT_MAX_COMPLETION_TOKENS = 900;
const DEFAULT_SYNTHESIS_MAX_TOKENS = 2400;
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

function extractMeta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return html.match(pattern)?.[1] || "";
}

function absolutizeUrl(src, baseUrl) {
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

function extractImageCandidates(html, baseUrl) {
  const candidates = [];
  const ogImage = extractMeta(html, "og:image");
  if (ogImage) candidates.push({ type: "og:image", src: absolutizeUrl(ogImage, baseUrl), alt: "Open Graph product image" });

  const imgPattern = /<img\b[^>]*>/gi;
  const attrPattern = /\b(src|data-src|data-old-hires|data-a-dynamic-image|alt|title)=["']([^"']*)["']/gi;
  const tags = html.match(imgPattern) || [];
  for (const tag of tags.slice(0, 48)) {
    const attrs = {};
    let attrMatch;
    while ((attrMatch = attrPattern.exec(tag))) {
      attrs[attrMatch[1]] = attrMatch[2];
    }
    const dynamicImage = attrs["data-a-dynamic-image"]?.match(/https?:[^"\\]+/i)?.[0] || "";
    const src = dynamicImage || attrs["data-old-hires"] || attrs["data-src"] || attrs.src || "";
    if (!src || src.startsWith("data:")) continue;
    const alt = cleanText(attrs.alt || attrs.title || "", 160);
    const scoreSource = `${src} ${alt}`.toLowerCase();
    const score = [
      scoreSource.includes("main") ? 3 : 0,
      scoreSource.includes("product") || scoreSource.includes("produto") ? 3 : 0,
      scoreSource.includes("detail") || scoreSource.includes("a-plus") || scoreSource.includes("aplus") ? 2 : 0,
      scoreSource.includes("hero") || scoreSource.includes("lifestyle") ? 2 : 0,
      src.length > 60 ? 1 : 0
    ].reduce((sum, item) => sum + item, 0);
    candidates.push({ type: "page-image", src: absolutizeUrl(src, baseUrl), alt, score });
  }

  const unique = new Map();
  for (const item of candidates) {
    if (!unique.has(item.src)) unique.set(item.src, item);
  }
  return Array.from(unique.values())
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, MAX_IMAGE_CANDIDATES);
}

function extractHeadings(html) {
  return Array.from(html.matchAll(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi))
    .map((match) => ({ level: Number(match[1]), text: cleanText(match[2], 220) }))
    .filter((item) => item.text)
    .slice(0, MAX_HEADINGS);
}

async function scanProductLink(url, marketHint) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LINK_SCAN_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 VISION-BRZAZIL-Link-Scanner/1.0",
        Accept: "text/html,application/xhtml+xml"
      }
    });
    const html = await response.text();
    return {
      url,
      market_hint: marketHint,
      ok: response.ok,
      status: response.status,
      final_url: response.url,
      title: cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "", 240),
      description: cleanText(extractMeta(html, "description") || extractMeta(html, "og:description"), 500),
      image_candidates: extractImageCandidates(html, response.url),
      headings: extractHeadings(html),
      page_text_sample: cleanText(html, PAGE_TEXT_SAMPLE_LENGTH)
    };
  } catch (error) {
    return {
      url,
      market_hint: marketHint,
      ok: false,
      error: error.name === "AbortError" ? "LINK_SCAN_TIMEOUT" : "LINK_SCAN_FAILED",
      message: error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function scanProductLinks(payload) {
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
    error: item.error,
    message: item.message,
    title: cleanText(item.title, 180),
    description: cleanText(item.description, 320),
    image_candidates: Array.isArray(item.image_candidates)
      ? item.image_candidates.slice(0, MAX_IMAGE_CANDIDATES).map((image) => ({
          type: image.type,
          src: image.src,
          alt: cleanText(image.alt, 120),
          score: image.score
        }))
      : [],
    headings: Array.isArray(item.headings)
      ? item.headings.slice(0, MAX_HEADINGS).map((heading) => ({
          level: heading.level,
          text: cleanText(heading.text, 140)
        }))
      : [],
    page_text_sample: cleanText(item.page_text_sample, PAGE_TEXT_SAMPLE_LENGTH)
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

function imageEvidenceFor(scans = [], mode) {
  return scans.map((scan) => ({
    url: scan.url,
    title: scan.title,
    description: scan.description,
    images: (scan.image_candidates || [])
      .filter((image) => mode === "detail" ? /detail|a-plus|aplus|module|lifestyle|hero/i.test(`${image.type} ${image.src} ${image.alt}`) : true)
      .slice(0, mode === "detail" ? 6 : 4),
    headings: (scan.headings || []).slice(0, mode === "detail" ? 8 : 4),
    text: mode === "detail" ? cleanText(scan.page_text_sample, 700) : cleanText(scan.page_text_sample, 320)
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
  const source = `${image.type || ""} ${image.src || ""} ${image.alt || ""}`.toLowerCase();
  if (source.includes("white") || source.includes("main") || source.includes("primary") || source.includes("principal")) return "white_main";
  if (source.includes("lifestyle") || source.includes("scene") || source.includes("use") || source.includes("hero")) return "lifestyle";
  if (source.includes("info") || source.includes("feature") || source.includes("benefit") || source.includes("aplus")) return "infographic";
  if (source.includes("detail") || source.includes("spec") || source.includes("size") || source.includes("dimension")) return "details_specs";
  if (source.includes("compare") || source.includes("comparison")) return "comparison";
  return "supporting";
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

function buildMainImageAnalysisPrompt({ market, scans, product, priorAnalysis }) {
  return [
    `任务：逐张分析 ${market} 链接的商品图片，不只看一张主图。`,
    "优先直接观察随消息附带的 image_url 图片；如果图片无法读取，再使用图片 URL、alt、标题和页面摘要。",
    `必须按这些类型归类并分析：${LISTING_IMAGE_TYPES.join(", ")}。`,
    "输出 JSON：{market,image_inventory:[{type,image_url,observations:[最多3条],layout,text_or_claims,localization_notes}],missing_types:[...],overall_style:[最多4条]}。",
    market === "US" ? "美国链接是最终主图与附图设计方向，逐张记录白底主图、场景图、信息图、尺寸细节图、对比图的构图、文案、视觉层级。" : "巴西链接只用于本土化，逐张记录葡语表达、生活场景、信任元素、当地审美和消费者关注点。",
    priorAnalysis ? "参考美国主图分析，只记录巴西本土化差异和可优化点，不重复美国内容。" : "",
    "产品外观最终必须以上传产品图为准，链接图片只参考设计逻辑。",
    JSON.stringify({ product: compactProduct(product), prior_analysis: priorAnalysis || null, image_inventory: imageInventoryFor(scans), evidence: imageEvidenceFor(scans, "main") })
  ].join("\n");
}

function buildDetailPageAnalysisPrompt({ market, scans, product, priorAnalysis }) {
  return [
    `任务：逐模块分析 ${market} 链接的详情页/A+模块/长图结构。`,
    "优先直接观察随消息附带的 image_url 图片；如果图片无法读取，再使用 image_candidates、headings 和 page_text_sample。",
    `必须按这些详情页模块归类：${DETAIL_MODULE_TYPES.join(", ")}。`,
    "输出 JSON：{market,module_inventory:[{type,image_url_or_section,observations:[最多3条],layout,copy_angle,localization_notes}],module_sequence:[最多6条],missing_modules:[...]}。",
    market === "US" ? "美国链接是详情页设计结构主方向，逐模块记录 Hero、核心卖点、生活方式、细节规格、FAQ、对比图的版式、信息层级和视觉节奏。" : "巴西链接用于本土化，逐模块记录葡语、当地场景、信任表达、消费者关注点。",
    priorAnalysis ? "参考美国详情页分析，只记录巴西本土化差异和可优化点，不重复美国内容。" : "",
    "不要发明页面没有证据的认证、保修、折扣或平台背书。",
    JSON.stringify({ product: compactProduct(product), prior_analysis: priorAnalysis || null, image_inventory: imageInventoryFor(scans), evidence: imageEvidenceFor(scans, "detail") })
  ].join("\n");
}

function buildSynthesisPrompt(payload, analyses) {
  return [
    "任务：综合四个小分析结果，输出最终可编辑提示词。不要重新分析原始链接。",
    "逻辑：主图 = 美国主图设计方向 + 巴西主图本土化；详情页 = 美国详情页结构 + 巴西详情页本土化；产品外观只以上传图为准。",
    "输出 JSON 字段：",
    "workflow_analysis: {us_main,br_main,us_detail,br_detail,optimization_logic}",
    "link_analysis: 最多6项短证据摘要。",
    "main_image_plan: 必须包含 white_main,lifestyle,infographic,details_specs,comparison 五类图片方向。",
    "detail_page_plan: 必须包含 hero_banner,core_features,lifestyle_usage,details_specs,faq,comparison_chart 六个详情页模块方向。",
    "keywords: {auto: 最多8个, manual: 用户人工词, final: 最多10个}。",
    "image_prompts: 生成 11 条可编辑提示词对象；字段 {type,label,source_logic,br_localization,prompt}；前5条对应主图/附图类型，后6条对应详情页模块。",
    "每条 prompt 必须以图生图逻辑写：上传产品图是唯一产品外观基准；美国链接提供构图/模块/风格；巴西链接提供葡语、本土场景和信任表达。",
    "detail_page: {title_pt_br, bullets_pt_br: 5条以内, description_pt_br: 180字以内, faq_pt_br: 2条以内, platform_notes: 3条以内}。",
    "compliance_notes: 最多4条。",
    "usage_note: 一句话。",
    JSON.stringify({
      product: compactProduct(payload.product || {}),
      platform: payload.platform,
      assets: payload.assets,
      constraints: payload.constraints,
      prompt_pack: payload.prompts,
      analyses
    })
  ].join("\n");
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
  const images = imageUrls.filter(Boolean).slice(0, 6);
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
  const grouped = splitScansByMarket(payload.link_scan_results || []);
  const usScans = grouped.us.length ? grouped.us : grouped.other;
  const brScans = grouped.brazil;
  const product = payload.product || {};
  const settled = [];
  const runStep = async (key, prompt, scans, mode) => {
    if (!scans.length) {
      const skipped = {
        result: { skipped: true, reason: "No matching links were provided for this stage." },
        usage: null,
        reasoning_effort: "skipped",
        max_tokens: 0
      };
      settled.push([key, skipped]);
      return skipped.result;
    }

    try {
      const value = await runJsonTask({
        baseUrl,
        apiKey,
        model,
        prompt,
        maxTokens: 650,
        imageUrls: imageUrlsFor(scans, mode, mode === "detail" ? 6 : 4)
      });
      settled.push([key, value]);
      return value.result;
    } catch (error) {
      const fallback = { result: { error: error.message }, usage: null, reasoning_effort: process.env.OPENAI_REASONING_EFFORT || "high", max_tokens: 650 };
      settled.push([key, fallback]);
      return fallback.result;
    }
  };

  const [usMain, usDetail] = await Promise.all([
    runStep("us_main_image_analysis", buildMainImageAnalysisPrompt({ market: "US", scans: usScans, product }), usScans, "main"),
    runStep("us_detail_page_analysis", buildDetailPageAnalysisPrompt({ market: "US", scans: usScans, product }), usScans, "detail")
  ]);

  await Promise.all([
    runStep("br_main_image_analysis", buildMainImageAnalysisPrompt({ market: "Brazil", scans: brScans, product, priorAnalysis: usMain }), brScans, "main"),
    runStep("br_detail_page_analysis", buildDetailPageAnalysisPrompt({ market: "Brazil", scans: brScans, product, priorAnalysis: usDetail }), brScans, "detail")
  ]);

  const analyses = Object.fromEntries(settled.map(([key, value]) => [key, value.result]));
  const analysisMeta = Object.fromEntries(settled.map(([key, value]) => [key, {
    usage: value.usage,
    reasoning_effort: value.reasoning_effort,
    max_tokens: value.max_tokens
  }]));
  const synthesis = await runJsonTask({
    baseUrl,
    apiKey,
    model,
    prompt: buildSynthesisPrompt(payload, analyses),
    maxTokens: Number(process.env.OPENAI_MAX_COMPLETION_TOKENS || DEFAULT_SYNTHESIS_MAX_TOKENS)
  });

  return {
    result: {
      analysis_flow: analyses,
      analysis_meta: analysisMeta,
      ...synthesis.result
    },
    usage: sumUsage([...settled.map(([, value]) => value.usage), synthesis.usage]),
    reasoning_effort: synthesis.reasoning_effort,
    max_tokens: synthesis.max_tokens
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
    "final_prompt_strategy: 最多4条短句，强调产品外观只以上传图为准。",
    "image_prompts: 生成 6 条可编辑提示词，每条 50-80 字，覆盖主图、副图、场景图、信息图、详情页顶部、详情页模块。",
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

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.5";

  if (!apiKey) {
    return sendJson(res, 500, {
      error: "OPENAI_API_KEY_MISSING",
      message: "Set OPENAI_API_KEY in your deployment environment."
    });
  }

  try {
    const payload = await readJson(req);
    payload.link_scan_results = await scanProductLinks(payload);
    const account = await getAccountByToken(getBearerToken(req)).catch(() => null);
    const analysis = await runSegmentedAnalysis({
      baseUrl,
      apiKey,
      model,
      payload
    });

    let updatedAccount = account;
    if (account) {
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
            workflow: "segmented_link_analysis"
          }
        })
      });
      const rows = await supabaseRequest(`accounts?id=${filter(account.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ used: Math.min(Number(account.quota || 0), Number(account.used || 0) + units) })
      });
      updatedAccount = rows[0] || account;
    }

    return sendJson(res, 200, {
      ok: true,
      model,
      reasoning_effort: analysis.reasoning_effort,
      max_tokens: analysis.max_tokens,
      usage: analysis.usage || null,
      account: publicAccount(updatedAccount),
      result: { ...analysis.result, link_scan_results: payload.link_scan_results },
      rawText: ""
    });
  } catch (error) {
    const isTimeout = error.code === "MODEL_TIMEOUT";
    const isProviderError = Number(error.statusCode || 0) >= 400;
    return sendJson(res, isTimeout ? 504 : (isProviderError ? error.statusCode : 500), {
      error: isTimeout ? "MODEL_TIMEOUT" : (isProviderError ? "MODEL_REQUEST_FAILED" : "GENERATE_FAILED"),
      message: error.message
    });
  }
};
