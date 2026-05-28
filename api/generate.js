const { getAccountByToken, publicAccount } = require("./_lib/auth");
const { getBearerToken, handleOptions, readJson, sendJson } = require("./_lib/http");
const { filter, supabaseRequest } = require("./_lib/supabase");

const MODEL_TIMEOUT_MS = 120000;
const LINK_SCAN_TIMEOUT_MS = 6000;
const MAX_SCAN_LINKS = 6;
const MAX_IMAGE_CANDIDATES = 8;
const MAX_HEADINGS = 10;
const PAGE_TEXT_SAMPLE_LENGTH = 900;
const DEFAULT_MAX_COMPLETION_TOKENS = 1800;

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

function buildModelBody({ model, payload, includeReasoning = true }) {
  const body = {
    model,
    messages: [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(payload) }
    ],
    response_format: { type: "json_object" },
    max_tokens: Number(process.env.OPENAI_MAX_COMPLETION_TOKENS || DEFAULT_MAX_COMPLETION_TOKENS)
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

async function requestModelWithFallback({ baseUrl, apiKey, model, payload }) {
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
  let usedMaxTokens = Number(process.env.OPENAI_MAX_COMPLETION_TOKENS || DEFAULT_MAX_COMPLETION_TOKENS);
  let body = buildModelBody({ model, payload, includeReasoning: true });
  let result = await request(body);

  if (isUnsupportedMaxTokensError(result.response, result.data)) {
    body = { ...body };
    delete body.max_tokens;
    usedMaxTokens = null;
    result = await request(body);
  }

  if (isUnsupportedReasoningError(result.response, result.data)) {
    body = buildModelBody({ model, payload, includeReasoning: false });
    if (usedMaxTokens === null) delete body.max_tokens;
    result = await request(body);
    usedReasoningEffort = "provider-unsupported";
  }

  return { ...result, usedReasoningEffort, usedMaxTokens };
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
    const { response, data, usedReasoningEffort, usedMaxTokens } = await requestModelWithFallback({
      baseUrl,
      apiKey,
      model,
      payload
    });

    if (!response.ok) {
      return sendJson(res, response.status, {
        error: "MODEL_REQUEST_FAILED",
        message: data?.error?.message || data?.message || data?.rawText || "The model provider returned an error.",
        provider_status: response.status
      });
    }

    const text = extractText(data);
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    let updatedAccount = account;
    if (account) {
      const units = Number(payload?.usage_estimate?.units || 1);
      const tokens = Number(data?.usage?.total_tokens || payload?.usage_estimate?.tokens || 0);
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
            usage: data.usage || null
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
      reasoning_effort: usedReasoningEffort,
      max_tokens: usedMaxTokens,
      usage: data.usage || null,
      account: publicAccount(updatedAccount),
      result: parsed && typeof parsed === "object" ? { ...parsed, link_scan_results: payload.link_scan_results } : parsed,
      rawText: parsed ? "" : text
    });
  } catch (error) {
    const isTimeout = error.code === "MODEL_TIMEOUT";
    return sendJson(res, isTimeout ? 504 : 500, {
      error: isTimeout ? "MODEL_TIMEOUT" : "GENERATE_FAILED",
      message: error.message
    });
  }
};
