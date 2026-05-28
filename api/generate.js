const { getAccountByToken, publicAccount } = require("./_lib/auth");
const { getBearerToken, handleOptions, readJson, sendJson } = require("./_lib/http");
const { filter, supabaseRequest } = require("./_lib/supabase");

const MODEL_TIMEOUT_MS = 120000;

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
  for (const tag of tags.slice(0, 80)) {
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
    .slice(0, 14);
}

function extractHeadings(html) {
  return Array.from(html.matchAll(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi))
    .map((match) => ({ level: Number(match[1]), text: cleanText(match[2], 220) }))
    .filter((item) => item.text)
    .slice(0, 18);
}

async function scanProductLink(url, marketHint) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
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
      page_text_sample: cleanText(html, 2600)
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
  const urls = Array.isArray(payload?.product?.source_urls) ? payload.product.source_urls.filter(Boolean).slice(0, 8) : [];
  const markets = Array.isArray(payload?.product?.source_markets) ? payload.product.source_markets : [];
  return Promise.all(urls.map((url, index) => scanProductLink(url, markets[index] || null)));
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
    "You are VISION BRZAZIL's senior Brazil ecommerce creative strategist.",
    "Before creating prompts, use the provided link_scan_results as observed evidence from downloaded product pages. Treat image_candidates, alt text, headings, descriptions, and page text as the concrete scan of product main images and detail-page assets.",
    "Follow this analysis order strictly: first deconstruct US links' main images and detail pages as the primary design direction, then deconstruct Brazil links with the same visual-analysis depth, then localize content, language, scenes, trust signals, and marketplace conventions for Brazil.",
    "For every US and Brazil link, analyze main image design, layout architecture, module sequence, style, color palette, typography, visual hierarchy, claims, icons, comparison logic, lifestyle scenes, and detail-page content blocks.",
    "Final creative direction must preserve the US links' design logic and information architecture while replacing content with Brazil-localized Portuguese language, local scenarios, trust points, and marketplace expectations.",
    "Uploaded product images are the only product-appearance truth for image-to-image generation. Never let competitor URLs change the product shape, color, packaging, accessories, or visible details.",
    "Return practical marketplace output for Brazil in Chinese operational notes plus Brazilian Portuguese listing copy.",
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
        product: payload.product,
        link_scan_results: payload.link_scan_results || [],
        assets: payload.assets,
        constraints: payload.constraints,
        prompt_pack: payload.prompts
      },
      null,
      2
    ),
    "",
    "输出 JSON，字段必须包含：",
    "link_analysis: 多链接拆解，必须区分美国竞品链接和巴西本地链接，并逐条列出扫描到的标题、描述、主图/详情页图片候选、图片 alt、页面模块和可用证据。",
    "us_visual_deconstruction: 对美国链接扫描到的主图和详情页图片/页面结构进行深度拆解，记录设计、架构、风格、色彩、模块顺序、视觉层级、表达内容、痛点和转化逻辑；这是最终设计的主要方向。",
    "br_visual_deconstruction: 对巴西链接扫描到的主图和详情页图片/页面结构用同样维度拆解，记录当地语言、场景、信任要素、平台习惯、价格敏感点和消费者关注点。",
    "localization_map: 说明如何把美国链接的设计逻辑映射到巴西市场，即设计结构跟随美国链接，内容语言、场景和信任表达按巴西链接本土化。",
    "keywords: 自动关键词、人工修正关键词、最终关键词。",
    "final_prompt_strategy: 综合美国设计方向、巴西本土化、上传产品图限制后，说明最终提示词策略。",
    "image_prompts: 可直接人工修改的主图、副图、场景图、信息图、详情页图片提示词；每条必须具体说明构图、背景、色彩、文案位置、模块结构、产品一致性约束，并说明产品外观来自上传图，设计结构参考美国链接，内容本土化参考巴西链接。",
    "detail_page: pt-BR 标题、5 bullet、描述、FAQ、平台适配建议。",
    "compliance_notes: 风险词、禁用表达、平台合规提醒。",
    "usage_note: 简短说明本次输出适合哪些平台。"
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
    const { response, data } = await fetchModelJson(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(payload) }
        ],
        response_format: { type: "json_object" }
      })
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
