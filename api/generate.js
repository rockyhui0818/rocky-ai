const { getAccountByToken, publicAccount } = require("./_lib/auth");
const { getBearerToken, handleOptions, readJson, sendJson } = require("./_lib/http");
const { filter, supabaseRequest } = require("./_lib/supabase");

const MODEL_TIMEOUT_MS = 120000;
const DIRECT_LINK_SCAN_TIMEOUT_MS = 6000;
const BRIGHTDATA_LINK_SCAN_TIMEOUT_MS = 60000;
const MAX_SCAN_LINKS = 6;
const MAX_IMAGE_CANDIDATES = 14;
const MAX_MAIN_IMAGE_CANDIDATES = 6;
const MAX_DETAIL_IMAGE_CANDIDATES = 8;
const MAX_HEADINGS = 10;
const MAX_REVIEW_SNIPPETS = 8;
const PAGE_TEXT_SAMPLE_LENGTH = 900;
const DEFAULT_MAX_COMPLETION_TOKENS = 900;
const DEFAULT_SYNTHESIS_MAX_TOKENS = 1100;
const STEP_IMAGE_LIMIT = 1;
const MAX_IMAGE_ANALYSIS_UNITS = 10;
const MAX_IMAGE_ANALYSIS_UNITS_PER_BUCKET = 3;
const IMAGE_ANALYSIS_BUDGET_MS = 85000;
const REVIEW_ANALYSIS_BUDGET_TOKENS = 450;
const BRIGHTDATA_API_URL = "https://api.brightdata.com/request";
const USEFUL_IMAGE_TYPES = new Set(["main-image", "detail-page-image"]);
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
  const imageMatch = decoded.match(/https?:\/\/[^\s"'<>\\]+?\.(?:jpg|jpeg|png|webp)/i);
  return String(imageMatch?.[0] || decoded)
    .replace(/["'}\]]+.*$/i, "")
    .replace(/%7D.*$/i, "")
    .trim();
}

function extractImageUrlsFromHtml(fragment = "") {
  const urls = [];
  const patterns = [
    /data-a-dynamic-image=["']([^"']+)["']/gi,
    /\b(?:src|data-src|data-old-hires)=["']([^"']+)["']/gi
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(fragment))) {
      const source = decodeHtmlEntities(match[1] || "").replace(/\\\//g, "/").replace(/\\u0026/g, "&");
      const found = Array.from(source.matchAll(/https?:\/\/[^\s"'<>\\]+?\.(?:jpg|jpeg|png|webp)/gi)).map((item) => cleanImageUrl(item[0]));
      if (found.length) urls.push(...found);
      if (/^https?:\/\//i.test(source)) urls.push(source);
    }
  }
  return urls.map(cleanImageUrl).filter(Boolean);
}

function extractHtmlSections(html, markers = []) {
  const sections = [];
  const lower = html.toLowerCase();
  for (const marker of markers) {
    let index = 0;
    const needle = marker.toLowerCase();
    while ((index = lower.indexOf(needle, index)) !== -1 && sections.length < 12) {
      const start = Math.max(0, index - 3000);
      const end = Math.min(html.length, index + 45000);
      sections.push(html.slice(start, end));
      index += needle.length;
    }
  }
  return sections;
}

function extractImageCandidates(html, baseUrl) {
  const candidates = [];
  const ogImage = extractMeta(html, "og:image");
  if (ogImage && !isNonProductImage(ogImage)) {
    candidates.push({ type: "main-image", src: absolutizeUrl(ogImage, baseUrl), alt: "Open Graph product image", score: 12 });
  }

  const dynamicImageBlocks = Array.from(html.matchAll(/data-a-dynamic-image=["']([^"']+)["']/gi));
  for (const block of dynamicImageBlocks.slice(0, 12)) {
    const decodedBlock = decodeHtmlEntities(block[1]).replace(/\\\//g, "/").replace(/\\u0026/g, "&");
    const urls = Array.from(decodedBlock.matchAll(/https?:\/\/[^\s"'<>\\]+?\.(?:jpg|jpeg|png|webp)/gi)).map((match) => cleanImageUrl(match[0]));
    for (const src of urls.slice(0, 8)) {
      if (!src || isNonProductImage(src)) continue;
      candidates.push({
        type: "main-image",
        src: absolutizeUrl(src, baseUrl),
        alt: "Amazon product gallery image",
        score: 12
      });
    }
  }

  const detailSections = extractHtmlSections(html, [
    "aplus",
    "a-plus",
    "dpx-aplus",
    "productDescription",
    "product-description",
    "detail-bullets",
    "feature-bullets"
  ]);
  for (const section of detailSections) {
    for (const src of extractImageUrlsFromHtml(section).slice(0, 16)) {
      if (!src || isNonProductImage(src)) continue;
      candidates.push({
        type: "detail-page-image",
        src: absolutizeUrl(src, baseUrl),
        alt: "Detail page/A+ content image",
        score: src.includes("m.media-amazon.com/images/I/") ? 10 : 6
      });
    }
  }

  const unique = new Map();
  for (const item of candidates) {
    if (!USEFUL_IMAGE_TYPES.has(item.type)) continue;
    if (!unique.has(item.src)) unique.set(item.src, item);
  }
  return Array.from(unique.values())
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, MAX_IMAGE_CANDIDATES);
}

function isNonProductImage(src = "") {
  const value = String(src || "").toLowerCase();
  return (
    value.includes("/oc-csi/") ||
    value.includes("fls-na.amazon.") ||
    value.includes("/error/") ||
    value.includes("/captcha/") ||
    value.includes("/sprites/") ||
    value.includes("nav-sprite") ||
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
  const patterns = [
    /data-hook=["']review-body["'][^>]*>([\s\S]*?)<\/(?:span|div)>/gi,
    /data-hook=["']review-title["'][^>]*>([\s\S]*?)<\/(?:span|a|div)>/gi,
    /class=["'][^"']*(?:review|comentario|comment)[^"']*["'][^>]*>([\s\S]*?)<\/(?:p|span|div)>/gi
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) && snippets.length < MAX_REVIEW_SNIPPETS) {
      const text = cleanText(match[1], 260);
      if (text.length >= 18 && !snippets.includes(text)) snippets.push(text);
    }
  }

  if (snippets.length < 3) {
    const text = cleanText(html, 12000);
    const reviewLike = text
      .split(/(?<=[.!?。！？])\s+|\s{2,}/)
      .map((item) => cleanText(item, 260))
      .filter((item) => /(quality|size|easy|durable|package|shipping|delivery|recommend|qualidade|tamanho|f[aá]cil|dur[aá]vel|embalagem|entrega|recomendo|bom|boa|ruim|excelente)/i.test(item));
    for (const item of reviewLike) {
      if (snippets.length >= MAX_REVIEW_SNIPPETS) break;
      if (item.length >= 18 && !snippets.includes(item)) snippets.push(item);
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

function cleanBrightDataScanResult(scan) {
  const allUsefulImages = Array.isArray(scan.image_candidates)
    ? scan.image_candidates.filter((image) => USEFUL_IMAGE_TYPES.has(image.type) && image.src && !isNonProductImage(image.src))
    : [];
  const mainImages = allUsefulImages
    .filter((image) => image.type === "main-image")
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, MAX_MAIN_IMAGE_CANDIDATES);
  const detailImages = allUsefulImages
    .filter((image) => image.type === "detail-page-image")
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, MAX_DETAIL_IMAGE_CANDIDATES);
  const usefulHeadings = scan.title
    ? [{ level: 1, text: scan.title }]
    : [];
  return {
    ...scan,
    image_candidates: [...mainImages, ...detailImages],
    headings: usefulHeadings,
    page_text_sample: "",
    description: cleanText(scan.description, 220),
    scan_scope: brightDataScanScope(mainImages.length, detailImages.length)
  };
}

function brightDataScanScope(mainImageCount = 0, detailImageCount = 0) {
  return {
    mode: "brightdata-useful-only",
    collected: ["main_images", "detail_page_images", "review_insights"],
    main_image_count: mainImageCount,
    detail_page_image_count: detailImageCount,
    ignored: ["navigation", "ads", "menus", "footer", "full_page_text", "unrelated_images"]
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

async function fetchProductHtml(url, signal) {
  const brightDataKey = process.env.BRIGHTDATA_API_KEY;
  const brightDataZone = process.env.BRIGHTDATA_ZONE || "web_unlocker1";
  if (brightDataKey) {
    try {
      const response = await fetch(BRIGHTDATA_API_URL, {
        method: "POST",
        signal,
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
    } catch {
      // Fall through to direct fetch when Web Unlocker is unavailable.
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
  const scanTimeoutMs = process.env.BRIGHTDATA_API_KEY ? BRIGHTDATA_LINK_SCAN_TIMEOUT_MS : DIRECT_LINK_SCAN_TIMEOUT_MS;
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
    const scan = {
      url,
      market_hint: marketHint,
      ok: response.ok,
      status: response.status,
      final_url: response.url,
      scanner,
      title,
      description: cleanText(extractMeta(html, "description") || extractMeta(html, "og:description"), 500),
      image_candidates: extractImageCandidates(html, response.url),
      headings: extractHeadings(html),
      review_insights: extractReviewInsights(html),
      page_text_sample: cleanText(html, PAGE_TEXT_SAMPLE_LENGTH)
    };
    return scanner === "brightdata" ? cleanBrightDataScanResult(scan) : scan;
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
  if (Array.isArray(payload?.link_scan_results) && payload.link_scan_results.length) {
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
  return {
    us: reviewEvidenceFor(grouped.us),
    brazil: reviewEvidenceFor(grouped.brazil),
    other: reviewEvidenceFor(grouped.other)
  };
}

function fallbackReviewModifierAnalysis(reviewEvidence = {}) {
  const allEvidence = [...(reviewEvidence.us || []), ...(reviewEvidence.brazil || []), ...(reviewEvidence.other || [])];
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
    high_frequency_praise: positiveTerms.slice(0, 5),
    high_frequency_complaints: negativeTerms.slice(0, 5),
    local_language: [...positiveTerms, ...negativeTerms].slice(0, 8),
    usage_scenarios: sceneTerms.slice(0, 5),
    competitor_weaknesses: negativeTerms.slice(0, 5),
    prompt_modifiers: {
      main_images: positiveTerms.slice(0, 4).map((term) => `可在主图/副图文案中自然体现 ${term}，但不改变产品外观。`),
      detail_pages: negativeTerms.slice(0, 4).map((term) => `在详情页提前解释 ${term} 相关疑虑，降低误解和退货。`),
      negative_constraints: ["Review 只能修饰卖点措辞、本土语言和差评预防，不能覆盖上传产品图、美国链接图片结构或真实产品外观。"]
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

function buildImageAnalysisUnits(scanResults = []) {
  const units = [];
  const bucketCounts = {};
  for (const scan of scanResults.map(compactScanResult)) {
    const market = marketBucket(scan);
    for (const image of scan.image_candidates || []) {
      if (!image.src || !/^https?:\/\//i.test(image.src)) continue;
      const isDetail = image.type === "detail-page-image";
      const section = isDetail ? "detail" : "main";
      const bucket = `${market}:${section}`;
      if ((bucketCounts[bucket] || 0) >= MAX_IMAGE_ANALYSIS_UNITS_PER_BUCKET) continue;
      bucketCounts[bucket] = (bucketCounts[bucket] || 0) + 1;
      units.push({
        id: `img_${units.length + 1}`,
        market,
        section,
        source_url: scan.url,
        page_title: scan.title,
        page_description: scan.description,
        image_url: image.src,
        image_type: image.type,
        inferred_type: classifyImageCandidate(image),
        alt: image.alt,
        scan_scope: scan.scan_scope || null
      });
      if (units.length >= MAX_IMAGE_ANALYSIS_UNITS) return units;
    }
  }
  return units;
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
    "必须记录：设计架构、版式、色彩、文字/卖点、可复刻方向、必须去除的品牌/IP 元素。",
    "不要分析 review，不要使用评价数据；本任务只处理这张图片本身。",
    "上传产品图仍是最终产品外观唯一基准；这张竞品图只提供风格、结构和内容方向。",
    "输出 JSON：{unit_id,market,section,image_role,layout,color_style,visual_hierarchy,claims_or_copy:[最多3条],localization_notes:[最多3条],prompt_takeaways:[最多4条],brand_removal:[最多3条]}。",
    JSON.stringify({ product: compactProduct(product), unit })
  ].join("\n");
}

function buildReviewModifierPrompt({ reviewEvidence, product }) {
  return [
    "任务：只分析 review 信号，把它变成最终图片提示词的修饰层。不要分析图片，不要改变产品外观。",
    "Review 权重低于上传产品图和美国链接图片结构；只能用于：卖点措辞校准、巴西葡语自然表达、真实使用场景、差评预防、竞品弱点补充。",
    "输出 JSON：{high_frequency_praise:[最多5条],high_frequency_complaints:[最多5条],local_language:[最多8个],usage_scenarios:[最多5条],competitor_weaknesses:[最多5条],prompt_modifiers:{main_images:[最多5条],detail_pages:[最多5条],negative_constraints:[最多4条]},source_note}。",
    JSON.stringify({ product: compactProduct(product), review_evidence: reviewEvidence })
  ].join("\n");
}

function buildSynthesisPrompt(payload, analyses, imageUnits = [], reviewModifierAnalysis = {}) {
  return [
    "任务：综合逐张图片分析结果，输出最终可编辑提示词。不要重新分析原始链接，不要再请求观察其它图片。",
    "逻辑：主图 = 美国主图设计方向 + 巴西主图本土化；详情页 = 美国详情页结构 + 巴西详情页本土化；上传产品图是基础产品输入，允许参考/复刻竞品外观、包装、颜色与版式，但必须去品牌化。",
    "Review Modifier 是最后的修饰层，权重低于上传产品图和美国链接主图/详情页结构。只能修饰文案、葡语、本土场景、差评预防和卖点顺序，不得覆盖产品外观和设计结构。",
    "输出 JSON 字段：",
    "workflow_analysis: {us_main,br_main,us_detail,br_detail,optimization_logic}",
    "review_insights: 直接整理 review_modifier_analysis，说明它如何修饰最终提示词。",
    "link_analysis: 最多6项短证据摘要。",
    "main_image_plan: 必须包含 white_main,lifestyle,infographic,details_specs,comparison 五类图片方向。",
    "detail_page_plan: 必须包含 hero_banner,core_features,lifestyle_usage,details_specs,faq,comparison_chart 六个详情页模块方向。",
    "keywords: {auto: 最多8个, manual: 用户人工词, final: 最多10个}。",
    "image_prompts: 生成 11 条简洁可编辑提示词对象；字段 {type,label,source_logic,br_localization,prompt}；前5条对应主图/附图类型，后6条对应详情页模块。",
    "每条 prompt 控制在 45-75 字：上传产品图是基础产品输入；美国链接图片提供外观、包装、颜色、构图、模块和风格；巴西链接图片提供本土场景；review_modifier_analysis 只修饰葡语文案、卖点和差评预防；禁止 logo/商标/品牌名。",
    "detail_page: {title_pt_br, bullets_pt_br: 5条以内, description_pt_br: 180字以内, faq_pt_br: 2条以内, platform_notes: 3条以内}。",
    "compliance_notes: 最多4条。",
    "usage_note: 一句话。",
    JSON.stringify({
      product: compactProduct(payload.product || {}),
      platform: payload.platform,
      assets: payload.assets,
      constraints: payload.constraints,
      prompt_pack: payload.prompts,
      image_analysis_units: imageUnits,
      analyses,
      review_modifier_analysis: reviewModifierAnalysis
    })
  ].join("\n");
}

function fallbackSegmentedResult(payload, analysisFlow, analysisMeta, imageUnits = [], reviewModifierAnalysis = null) {
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
  const imagePrompts = [
    ["white_main", "白底主图", "白底、产品居中、无文字无水印，清晰展示产品本体。"],
    ["lifestyle", "巴西场景图", "巴西家庭、办公室、出行或户外场景，突出真实使用。"],
    ["infographic", "葡语卖点信息图", "用葡语短句表达 3-5 个强卖点，指向真实可见部位。"],
    ["details_specs", "尺寸细节图", "展示材质、接口、容量、规格或包装内容，不虚构参数。"],
    ["comparison", "优势对比图", "与普通方案对比优势，不出现竞品品牌或攻击性表达。"],
    ["hero_banner", "详情页顶部视觉海报", "全宽 Hero 海报，产品和核心口号建立第一印象。"],
    ["core_features", "详情页核心卖点", "大图加侧边文字或网格拆解 3-4 个核心卖点。"],
    ["lifestyle_usage", "详情页生活方式", "真实使用场景建立代入感，突出产品调性与审美。"],
    ["details_specs", "详情页细节技术说明", "微距细节、规格、使用方法和注意事项，降低退货率。"],
    ["faq", "详情页 FAQ", "回答使用步骤、适用人群、材质或注意事项。"],
    ["comparison_chart", "详情页产品线对比", "同品牌产品线表格对比，促进交叉销售。"]
  ].map(([type, label, prompt]) => ({
    type,
    label,
    source_logic: "没有可用链接证据时使用平台通用高转化结构。",
    br_localization: "使用巴西葡语短句和本土日常场景。",
    prompt: `图生图：上传产品图为基础产品输入，可参考/复刻竞品外观、包装、颜色和版式，但必须移除竞品 logo、品牌名、商标和水印。${prompt}`
  }));

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
    workflow_analysis: {
      us_main: "无美国链接证据，使用通用商品图结构。",
      br_main: "无巴西链接证据，采用巴西葡语与日常场景本土化。",
      us_detail: "无美国详情页证据，使用标准 A+ 模块结构。",
      br_detail: "无巴西详情页证据，采用本土语言、场景和信任表达。",
      optimization_logic: "链接采集结果会被拆成单图分析任务：美国图给设计结构，巴西图给本土化落地；全程禁止竞品 logo、商标和品牌名。"
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
        maxTokens: 360,
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
          prompt_takeaways: [
            unit.market === "brazil" ? "使用巴西本土语言和场景做本地化参考。" : "使用美国链接图片作为设计结构和视觉风格参考。",
            unit.section === "detail" ? "参考详情页模块信息层级。" : "参考商品图构图和卖点表达。",
            "必须去除竞品 logo、品牌名、商标和水印。"
          ]
        },
        usage: null,
        reasoning_effort: process.env.OPENAI_REASONING_EFFORT || "high",
        max_tokens: 360
      };
      settled.push([unit.id, fallback]);
      return fallback.result;
    }
  };

  for (const unit of imageUnits) {
    if (Date.now() - analysisStartedAt > IMAGE_ANALYSIS_BUDGET_MS) {
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
          prompt_takeaways: [
            unit.market === "brazil" ? "待分析：巴西本土化参考图。" : "待分析：美国设计结构参考图。",
            "接口先返回已完成分析，避免浏览器/Nginx 长请求断开。"
          ]
        },
        usage: null,
        reasoning_effort: "skipped-budget",
        max_tokens: 0
      }]);
      continue;
    }
    await runUnit(unit);
  }

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
    return {
      result: fallbackSegmentedResult(payload, analyses, analysisMeta, imageUnits, reviewModifierAnalysis),
      usage: {},
      reasoning_effort: "skipped-no-links",
      max_tokens: 0
    };
  }

  let synthesis;
  try {
    synthesis = await runJsonTask({
      baseUrl,
      apiKey,
      model,
      prompt: buildSynthesisPrompt(payload, analyses, imageUnits, reviewModifierAnalysis),
      maxTokens: Number(process.env.OPENAI_MAX_COMPLETION_TOKENS || DEFAULT_SYNTHESIS_MAX_TOKENS)
    });
  } catch (error) {
    const fallback = fallbackSegmentedResult(payload, analyses, analysisMeta, imageUnits, reviewModifierAnalysis);
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
      image_analysis_meta: {
        mode: "one-image-per-model-call",
        unit_count: imageUnits.length,
        completed_count: settled.filter(([, value]) => !value.result?.skipped).length,
        stopped_by_budget: stoppedByBudget,
        budget_ms: IMAGE_ANALYSIS_BUDGET_MS
      },
      ...synthesis.result
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
    "final_prompt_strategy: 最多4条短句，强调上传图是图生图基础，允许参考/复刻竞品外观包装和颜色，但必须去品牌化。",
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
  const requestId = `gen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
    logGenerate("generate_failed", { error: "OPENAI_API_KEY_MISSING" });
    return sendJson(res, 500, {
      error: "OPENAI_API_KEY_MISSING",
      message: "Set OPENAI_API_KEY in your deployment environment.",
      stage,
      request_id: requestId
    });
  }

  try {
    stage = "read_request";
    const payload = await readJson(req);
    logGenerate("generate_start", {
      source_url_count: Array.isArray(payload?.product?.source_urls) ? payload.product.source_urls.length : 0,
      platform: payload?.platform_key || payload?.platform || ""
    });
    stage = "link_scan";
    payload.link_scan_results = await scanProductLinks(payload);
    logGenerate("generate_stage_complete", {
      completed_stage: "link_scan",
      scan_count: payload.link_scan_results.length,
      scan_ok_count: payload.link_scan_results.filter((scan) => scan.ok).length,
      scanners: Array.from(new Set(payload.link_scan_results.map((scan) => scan.scanner).filter(Boolean)))
    });
    stage = "account_lookup";
    const account = await getAccountByToken(getBearerToken(req)).catch(() => null);
    stage = "model_analysis";
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
    return sendJson(res, 200, {
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
    });
  } catch (error) {
    const isTimeout = error.code === "MODEL_TIMEOUT";
    const isProviderError = Number(error.statusCode || 0) >= 400;
    logGenerate("generate_failed", {
      error: isTimeout ? "MODEL_TIMEOUT" : (isProviderError ? "MODEL_REQUEST_FAILED" : "GENERATE_FAILED"),
      message: error.message || "",
      code: error.code || "",
      status_code: error.statusCode || null
    });
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
